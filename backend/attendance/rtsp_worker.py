import base64
import os
import threading
import time
import logging
import cv2

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.utils import timezone

from .attendance_logic import (
    get_scan_status, is_late, is_in_cooldown,
    update_cooldown, save_checkout_with_hours,
)
from .face_engine import face_engine
from .notify import notify_late, notify_unknown


STATUS_COLOR = {
    'check_in':  '#10b981',
    'check_out': '#3b82f6',
    'break':     '#8b5cf6',
    'ignore':    '#94a3b8',
}
logger = logging.getLogger(__name__)

STATUS_SUFFIX = {
    'check_in':  '',
    'check_out': ' [OUT]',
    'break':     ' [BREAK]',
    'ignore':    '',
}


class RTSPWorker:
    def __init__(self, camera_id: str, stream_url: str, fps: float = None, quality: int = None):
        self.camera_id = camera_id
        self.stream_url = stream_url
        self.group_name = f"camera_{camera_id}"
        self.fps = fps
        self.quality = quality
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._cooldowns = {}
        self._last_unknown_alert = 0.0

    def start(self):
        if not self._thread.is_alive():
            self._thread.start()

    def stop(self):
        self._stop.set()

    def _run(self):
        face_engine.initialize()
        fps = float(self.fps) if self.fps and self.fps > 0 else float(getattr(settings, 'RTSP_FPS', 5))
        interval = 1.0 / max(fps, 0.1)
        quality = int(self.quality) if self.quality and self.quality > 0 else int(getattr(settings, 'RTSP_JPEG_QUALITY', 70))
        skip = int(getattr(settings, 'RTSP_SKIP_FRAMES', 0))
        channel_layer = get_channel_layer()

        def open_capture():
            if 'OPENCV_FFMPEG_CAPTURE_OPTIONS' not in os.environ:
                os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|stimeout;5000000'
            cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)
            try:
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass
            if hasattr(cv2, 'CAP_PROP_OPEN_TIMEOUT_MSEC'):
                try:
                    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
                except Exception:
                    pass
            if hasattr(cv2, 'CAP_PROP_READ_TIMEOUT_MSEC'):
                try:
                    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
                except Exception:
                    pass
            return cap

        cap = open_capture()
        if not cap.isOpened():
            logger.warning("RTSP open failed for %s", self.stream_url)
        last_send = 0.0
        while not self._stop.is_set():
            if skip > 0:
                for _ in range(skip):
                    if not cap.grab():
                        break
            ok, frame = cap.read()
            if not ok:
                time.sleep(1)
                cap.release()
                cap = open_capture()
                continue

            now = time.time()
            if now - last_send < interval:
                continue
            last_send = now

            results = face_engine.identify_frame(frame)
            labeled = [self._process_sync(r, frame) for r in results]

            try:
                _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                b64 = base64.b64encode(buf).decode('ascii')
            except Exception:
                continue

            async_to_sync(channel_layer.group_send)(self.group_name, {
                'type': 'rtsp_frame',
                'frame': b64,
                'faces': labeled,
                'frame_width': frame.shape[1],
                'frame_height': frame.shape[0],
                'camera_id': self.camera_id,
            })

        cap.release()

    # ── Processing (sync) ───────────────────────────────────
    def _process_sync(self, r: dict, frame) -> dict:
        emp_id = r.get('employee_id')
        if not emp_id:
            if self._can_alert_unknown():
                self._save_unknown(r['bbox'], frame)
            return self._unknown_label(r)

        emp = self._get_employee(emp_id)
        if not emp:
            return self._unknown_label(r)

        now = timezone.localtime()
        shift = emp['shift_obj']
        status = get_scan_status(shift, now)

        if status in ('break', 'ignore'):
            return self._build_label(r, emp, status)

        cooldown_sec = getattr(settings, 'CHECKIN_COOLDOWN_SECONDS', 300)
        if is_in_cooldown(self._cooldowns, emp_id, status, now, cooldown_sec):
            return self._build_label(r, emp, status)

        late_flag, late_min = (False, 0)
        hours_data = {}
        if status == 'check_in':
            late_flag, late_min = is_late(shift, now)
            self._record_checkin(emp, r['confidence'], self.camera_id, late_flag, late_min)
            if late_flag:
                notify_late(emp['name'], emp['employee_id'], late_min, emp['shift_name'] or 'N/A')
        elif status == 'check_out':
            hours_data = self._record_checkout(emp, r['confidence'], self.camera_id, now)

        update_cooldown(self._cooldowns, emp_id, status, now)
        self._broadcast(emp, now, status, late_flag, late_min, hours_data)

        return self._build_label(r, emp, status, late_flag, late_min, hours_data)

    def _build_label(self, r, emp, status, is_late=False, late_min=0, hours=None):
        hours = hours or {}
        suffix = STATUS_SUFFIX.get(status, '')
        if is_late and status == 'check_in':
            suffix = f' ⏰+{late_min}m'
        color = STATUS_COLOR.get(status, '#94a3b8')
        label = {
            'bbox':         r['bbox'],
            'label':        emp['name'] + suffix,
            'label_kh':     emp['name_kh'],
            'employee_id':  emp['employee_id'],
            'department':   emp['department'],
            'shift':        emp['shift_name'],
            'confidence':   round(r['confidence'] * 100, 1),
            'status':       status,
            'is_unknown':   False,
            'is_late':      is_late,
            'late_minutes': late_min,
            'color':        color,
        }
        if hours:
            label['net_hours'] = hours.get('net_hours', 0)
            label['ot_hours'] = hours.get('ot_hours', 0)
        return label

    def _unknown_label(self, r):
        return {
            'bbox': r['bbox'], 'label': 'Unknown', 'label_kh': 'មិនស្គាល់',
            'employee_id': None, 'department': '', 'shift': '',
            'confidence': 0, 'status': 'unknown',
            'is_unknown': True, 'is_late': False, 'color': '#ef4444',
        }

    def _broadcast(self, emp, now, status, late_flag, late_min, hours):
        channel_layer = get_channel_layer()
        msg = {
            'type':         'attendance_update',
            'employee_id':  emp['employee_id'],
            'name':         emp['name'],
            'name_kh':      emp['name_kh'],
            'department':   emp['department'],
            'shift':        emp['shift_name'],
            'status':       status,
            'is_late':      late_flag,
            'late_minutes': late_min,
            'timestamp':    now.isoformat(),
            'camera_id':    self.camera_id,
        }
        if hours:
            msg['net_hours'] = hours.get('net_hours', 0)
            msg['ot_hours'] = hours.get('ot_hours', 0)
        async_to_sync(channel_layer.group_send)('dashboard', msg)

    def _get_employee(self, employee_id):
        from .models import Employee
        try:
            e = Employee.objects.select_related('department', 'shift').get(employee_id=employee_id)
            return {
                'employee_id': e.employee_id,
                'name':        e.name,
                'name_kh':     e.name_kh,
                'department':  e.department.name if e.department else '',
                'shift_obj':   e.shift,
                'shift_name':  str(e.shift) if e.shift else '',
            }
        except Employee.DoesNotExist:
            return None

    def _record_checkin(self, emp, confidence, camera_id, late_flag, late_min):
        from .models import Employee, Camera, AttendanceRecord
        try:
            e = Employee.objects.get(employee_id=emp['employee_id'])
            cam = Camera.objects.filter(camera_id=camera_id).first()
            AttendanceRecord.objects.create(
                employee=e, camera=cam, confidence=confidence,
                status='check_in', is_unknown=False,
                is_late=late_flag, late_minutes=late_min,
            )
        except Exception:
            pass

    def _record_checkout(self, emp, confidence, camera_id, now):
        from .models import Employee, Camera
        try:
            e = Employee.objects.select_related('shift').get(employee_id=emp['employee_id'])
            cam = Camera.objects.filter(camera_id=camera_id).first()
            now_aware = timezone.make_aware(now) if timezone.is_naive(now) else now
            _, hours_data = save_checkout_with_hours(e, now_aware, cam, confidence)
            return hours_data or {}
        except Exception:
            return {}

    def _save_unknown(self, bbox, frame):
        from .models import AttendanceRecord
        try:
            x1, y1, x2, y2 = bbox
            h, w = frame.shape[:2]
            pad = 20
            crop = frame[max(0, y1-pad):min(h, y2+pad), max(0, x1-pad):min(w, x2+pad)]
            rec = AttendanceRecord.objects.create(is_unknown=True, confidence=0)
            _, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
            try:
                from io import BytesIO
                photo = BytesIO(buf.tobytes())
                photo.name = f"unk_{rec.id}.jpg"
                notify_unknown(self.camera_id, photo)
            except Exception:
                notify_unknown(self.camera_id, None)
            rec.unknown_alerted = True
            rec.save(update_fields=['unknown_alerted'])
        except Exception:
            pass

    def _can_alert_unknown(self):
        cooldown = int(getattr(settings, 'UNKNOWN_ALERT_COOLDOWN_SECONDS', 30))
        now = time.time()
        if (now - self._last_unknown_alert) < cooldown:
            return False
        self._last_unknown_alert = now
        return True


class RTSPManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._workers = {}

    def add_client(self, camera_id: str, stream_url: str, fps: float = None, quality: int = None):
        with self._lock:
            entry = self._workers.get(camera_id)
            if not entry:
                worker = RTSPWorker(camera_id, stream_url, fps=fps, quality=quality)
                entry = {'worker': worker, 'clients': 0}
                self._workers[camera_id] = entry
                worker.start()
            entry['clients'] += 1

    def remove_client(self, camera_id: str):
        with self._lock:
            entry = self._workers.get(camera_id)
            if not entry:
                return
            entry['clients'] -= 1
            if entry['clients'] <= 0:
                entry['worker'].stop()
                del self._workers[camera_id]


rtsp_manager = RTSPManager()


