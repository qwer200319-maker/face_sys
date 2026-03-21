"""
Production Face Recognition Engine — optimised for 2000+ employees
===================================================================
Key improvements:
  • CLAHE preprocessing  → handles poor factory lighting
  • Multi-angle averaging → up to 5 embeddings per person
  • Quality gate          → skip blurry / tiny faces
  • Thread-safe RLock     → safe for concurrent camera consumers
  • Atomic FAISS rebuild  → never serves a stale index
  • Warm-up on init       → first real frame is fast
  • FAISS IndexFlatIP     → cosine similarity, handles 10 k+ faces < 1 ms
"""

import numpy as np
import faiss
import cv2
import threading
import logging

logger = logging.getLogger(__name__)


def _clahe_enhance(img: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab = cv2.merge([clahe.apply(l), a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def _blur_score(img: np.ndarray) -> float:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _l2norm(v: np.ndarray) -> np.ndarray:
    v = v.astype(np.float32).reshape(1, -1)
    faiss.normalize_L2(v)
    return v


class FaceRecognitionEngine:
    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._ready = False
        return cls._instance

    # ── Initialise ────────────────────────────────────────────
    def initialize(self):
        with self._lock:
            if self._ready:
                return
            logger.info("⏳ Loading InsightFace buffalo_l …")
            try:
                from insightface.app import FaceAnalysis
                from django.conf import settings
                det = getattr(settings, 'FACE_DET_SIZE', 640)
                self._app = FaceAnalysis(
                    name='buffalo_l',
                    providers=['CUDAExecutionProvider', 'CPUExecutionProvider'],
                )
                self._app.prepare(ctx_id=0, det_size=(det, det))
            except Exception as e:
                logger.error("InsightFace init failed: %s", e)
                raise

            self._dim   = 512
            self._index = faiss.IndexFlatIP(self._dim)
            self._id_map: list = []
            self._ready = True

            # warm-up run
            try:
                self._app.get(np.zeros((320, 320, 3), dtype=np.uint8))
            except Exception:
                pass

            self.reload()
            logger.info("✅ Face engine ready — %d faces in FAISS", self._index.ntotal)

    # ── Reload FAISS from DB ──────────────────────────────────
    def reload(self):
        from attendance.models import FaceEmbedding
        with self._lock:
            rows = list(FaceEmbedding.objects.select_related('employee').filter(
                employee__is_active=True
            ).values('employee__employee_id', 'embedding_data'))

            # Group by employee → average embeddings
            emp_map: dict = {}
            for row in rows:
                eid = row['employee__employee_id']
                arr = np.frombuffer(row['embedding_data'], dtype=np.float32).copy()
                if arr.shape[0] == self._dim:
                    emp_map.setdefault(eid, []).append(arr)

            vecs, ids = [], []
            for eid, embs in emp_map.items():
                avg = np.mean(np.stack(embs), axis=0).astype(np.float32)
                vecs.append(avg)
                ids.append(eid)

            new_index = faiss.IndexFlatIP(self._dim)
            if vecs:
                mat = np.stack(vecs).astype(np.float32)
                faiss.normalize_L2(mat)
                new_index.add(mat)

            self._index = new_index
            self._id_map = ids
            logger.info("FAISS rebuilt — %d unique employees", new_index.ntotal)

    # ── Detect faces ─────────────────────────────────────────
    def _detect(self, image: np.ndarray, min_px: int = 60) -> list:
        enhanced = _clahe_enhance(image)
        try:
            faces = self._app.get(enhanced)
        except Exception as e:
            logger.warning("Detection error: %s", e)
            return []

        h, w = image.shape[:2]
        out = []
        for f in faces:
            x1, y1, x2, y2 = f.bbox.astype(int)
            if (x2 - x1) < min_px or (y2 - y1) < min_px:
                continue
            crop = image[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
            if crop.size > 0 and _blur_score(crop) < 30:
                continue
            out.append({
                'bbox':      [int(x1), int(y1), int(x2), int(y2)],
                'embedding': f.embedding.astype(np.float32),
                'det_score': float(f.det_score),
            })
        return out

    # ── Identify frame ───────────────────────────────────────
    def identify_frame(self, image: np.ndarray, threshold: float = None) -> list:
        if not self._ready:
            self.initialize()
        if threshold is None:
            from django.conf import settings
            threshold = getattr(settings, 'FACE_THRESHOLD', 0.38)

        results = []
        for face in self._detect(image):
            emb = _l2norm(face['embedding'])
            employee_id, confidence = None, 0.0
            with self._lock:
                if self._index.ntotal > 0:
                    dists, idxs = self._index.search(emb, k=1)
                    score = float(dists[0][0])
                    idx   = int(idxs[0][0])
                    if score >= threshold and 0 <= idx < len(self._id_map):
                        employee_id = self._id_map[idx]
                        confidence  = score
            results.append({
                'bbox':        face['bbox'],
                'employee_id': employee_id,
                'confidence':  round(confidence, 4),
                'is_unknown':  employee_id is None,
                'det_score':   face['det_score'],
            })
        return results

    # ── Register face ────────────────────────────────────────
    def register_face(self, employee_id: str, image: np.ndarray):
        if not self._ready:
            self.initialize()

        faces = self._detect(image, min_px=80)
        if not faces:
            return False, "រកមុខមិនឃើញ — ប្រើពន្លឺល្អ និងនៅជិត Camera"
        if len(faces) > 1:
            return False, "ឃើញ​មុខ​ច្រើន — ឲ្យ​មាន​មុខ​មួយ​ប៉ុណ្ណោះ"

        from attendance.models import Employee, FaceEmbedding
        from django.conf import settings
        max_e = getattr(settings, 'MAX_EMBEDDINGS_PER_PERSON', 5)

        try:
            emp = Employee.objects.get(employee_id=employee_id)
        except Employee.DoesNotExist:
            return False, "Employee not found"

        existing = FaceEmbedding.objects.filter(employee=emp)
        if existing.count() >= max_e:
            existing.order_by('created_at').first().delete()

        FaceEmbedding.objects.create(
            employee=emp,
            embedding_data=faces[0]['embedding'].tobytes(),
        )

        # Update averaged embedding on Employee
        all_embs = [
            np.frombuffer(e.embedding_data, dtype=np.float32).copy()
            for e in FaceEmbedding.objects.filter(employee=emp)
        ]
        avg = np.mean(np.stack(all_embs), axis=0).astype(np.float32)
        emp.face_embedding = avg.tobytes()
        emp.save(update_fields=['face_embedding', 'updated_at'])

        self.reload()
        count = FaceEmbedding.objects.filter(employee=emp).count()
        return True, f"ចុះបញ្ជីជោគជ័យ! ({count}/{max_e} angles)"

    def remove_employee(self, employee_id: str):
        self.reload()


face_engine = FaceRecognitionEngine()
