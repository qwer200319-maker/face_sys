import json, cv2, numpy as np, asyncio, logging
from datetime import datetime, time as dtime, timedelta
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .face_engine import face_engine

logger = logging.getLogger(__name__)


def _is_late(shift, checkin_dt: datetime):
    """Return (is_late, late_minutes)"""
    if not shift:
        return False, 0
    deadline = datetime.combine(checkin_dt.date(), shift.start_time)
    deadline += timedelta(minutes=shift.grace_minutes)
    if checkin_dt > deadline:
        return True, int((checkin_dt - deadline).seconds / 60)
    return False, 0


class CameraStreamConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.camera_id  = self.scope['url_route']['kwargs']['camera_id']
        self.group_name = f"camera_{self.camera_id}"
        self.recent_checkins: dict = {}

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._boot)
        logger.info("Camera %s connected", self.camera_id)

    def _boot(self):
        face_engine.initialize()
        face_engine.reload()   # always fresh on connect

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not bytes_data:
            return
        nparr = np.frombuffer(bytes_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return

        loop    = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, lambda: face_engine.identify_frame(frame))

        labeled = [await self._enrich(r, frame) for r in results]

        await self.send(text_data=json.dumps({
            'type':         'face_results',
            'faces':        labeled,
            'timestamp':    datetime.now().isoformat(),
            'camera_id':    self.camera_id,
            'frame_width':  frame.shape[1],
            'frame_height': frame.shape[0],
        }))

    async def _enrich(self, r: dict, frame: np.ndarray) -> dict:
        from django.conf import settings
        cooldown = getattr(settings, 'CHECKIN_COOLDOWN_SECONDS', 300)

        emp_id = r.get('employee_id')
        if emp_id:
            emp = await self._get_employee(emp_id)
            if emp:
                now  = datetime.now()
                last = self.recent_checkins.get(emp_id)
                if not last or (now - last).seconds >= cooldown:
                    is_late, late_min = _is_late(emp.get('shift'), now)
                    await self._record(emp, r['confidence'], self.camera_id, is_late, late_min)
                    self.recent_checkins[emp_id] = now
                    await self._broadcast(emp, now, is_late, late_min)
                    if is_late:
                        await self._send_late_alert(emp, late_min)

                return {
                    'bbox':        r['bbox'],
                    'label':       emp['name'],
                    'label_kh':    emp['name_kh'],
                    'employee_id': emp_id,
                    'department':  emp['department'],
                    'shift':       emp['shift_name'],
                    'confidence':  round(r['confidence'] * 100, 1),
                    'is_unknown':  False,
                    'is_late':     self.recent_checkins.get(f'{emp_id}_late', False),
                    'color':       '#10b981',
                }

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self._save_unknown(r['bbox'], frame))
        return {
            'bbox': r['bbox'], 'label': 'Unknown', 'label_kh': 'មិនស្គាល់',
            'employee_id': None, 'department': '', 'shift': '',
            'confidence': 0, 'is_unknown': True, 'is_late': False, 'color': '#ef4444',
        }

    async def _broadcast(self, emp, now, is_late, late_min):
        await self.channel_layer.group_send('dashboard', {
            'type':        'attendance_update',
            'employee_id': emp['employee_id'],
            'name':        emp['name'],
            'name_kh':     emp['name_kh'],
            'department':  emp['department'],
            'shift':       emp['shift_name'],
            'is_late':     is_late,
            'late_minutes': late_min,
            'timestamp':   now.isoformat(),
            'camera_id':   self.camera_id,
        })

    async def _send_late_alert(self, emp, late_min):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self._telegram_late(emp, late_min))

    def _telegram_late(self, emp, late_min):
        from .notify import notify_late
        notify_late(emp['name'], emp['employee_id'], late_min, emp['shift_name'] or 'N/A')

    @database_sync_to_async
    def _get_employee(self, employee_id):
        from .models import Employee
        try:
            e = Employee.objects.select_related('department', 'shift').get(employee_id=employee_id)
            return {
                'employee_id': e.employee_id,
                'name':        e.name,
                'name_kh':     e.name_kh,
                'department':  e.department.name if e.department else '',
                'shift':       e.shift,
                'shift_name':  str(e.shift) if e.shift else '',
            }
        except Employee.DoesNotExist:
            return None

    @database_sync_to_async
    def _record(self, emp, confidence, camera_id, is_late, late_min):
        from .models import Employee, AttendanceRecord, Camera
        try:
            e   = Employee.objects.get(employee_id=emp['employee_id'])
            cam = Camera.objects.filter(camera_id=camera_id).first()
            AttendanceRecord.objects.create(
                employee=e, camera=cam, confidence=confidence,
                status='check_in', is_unknown=False,
                is_late=is_late, late_minutes=late_min,
            )
            # Auto-create OT if checkin is after shift end
            if e.shift:
                from .models import OvertimeRecord
                from django.utils import timezone
                now = timezone.localtime()
                shift_end = datetime.combine(now.date(), e.shift.end_time)
                if e.shift.is_overnight:
                    shift_end += timedelta(hours=24)
                if now.time() > e.shift.end_time and not e.shift.is_overnight:
                    OvertimeRecord.objects.get_or_create(
                        employee=e,
                        date=now.date(),
                        defaults={'ot_start': now, 'status': 'pending'},
                    )
        except Exception as ex:
            logger.error("Record error: %s", ex)

    def _save_unknown(self, bbox, frame):
        try:
            from .models import AttendanceRecord
            from django.core.files.base import ContentFile
            x1, y1, x2, y2 = bbox
            h, w = frame.shape[:2]
            pad  = 20
            crop = frame[max(0,y1-pad):min(h,y2+pad), max(0,x1-pad):min(w,x2+pad)]
            rec  = AttendanceRecord.objects.create(is_unknown=True, confidence=0)
            _, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
            rec.snapshot.save(f"unk_{rec.id}.jpg", ContentFile(buf.tobytes()), save=True)
            from .notify import notify_unknown
            snap_path = rec.snapshot.path if rec.snapshot else None
            notify_unknown(self.camera_id, snap_path)
            rec.unknown_alerted = True
            rec.save(update_fields=['unknown_alerted'])
        except Exception as ex:
            logger.error("Unknown save error: %s", ex)


class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add('dashboard', self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard('dashboard', self.channel_name)

    async def attendance_update(self, event):
        await self.send(text_data=json.dumps({**event, 'type': 'attendance_update'}))
