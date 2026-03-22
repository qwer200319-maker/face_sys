"""
consumers.py — WebSocket Camera Stream Consumer
Integrates attendance_logic for smart check-in/check-out detection.
"""
import json, cv2, numpy as np, asyncio, logging
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .face_engine import face_engine
from .attendance_logic import (
    get_scan_status, is_late, is_in_cooldown,
    update_cooldown, save_checkout_with_hours,
)

logger = logging.getLogger(__name__)

STATUS_COLOR = {
    'check_in':  '#10b981',  # green
    'check_out': '#3b82f6',  # blue
    'break':     '#8b5cf6',  # purple
    'ignore':    '#94a3b8',  # gray
}
STATUS_SUFFIX = {
    'check_in':  '',
    'check_out': ' [OUT]',
    'break':     ' [BREAK]',
    'ignore':    '',
}


class CameraStreamConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.camera_id  = self.scope['url_route']['kwargs']['camera_id']
        self.group_name = f"camera_{self.camera_id}"
        # Cooldown dict: "{emp_id}_{status}" → datetime
        self.cooldowns: dict = {}

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._boot)
        logger.info("Camera %s connected", self.camera_id)

    def _boot(self):
        face_engine.initialize()
        face_engine.reload()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # ── Receive binary JPEG frame ─────────────────────────────
    async def receive(self, text_data=None, bytes_data=None):
        if not bytes_data:
            return
        nparr = np.frombuffer(bytes_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return

        loop    = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None, lambda: face_engine.identify_frame(frame)
        )
        labeled = [await self._process(r, frame) for r in results]

        await self.send(text_data=json.dumps({
            'type':         'face_results',
            'faces':        labeled,
            'timestamp':    datetime.now().isoformat(),
            'camera_id':    self.camera_id,
            'frame_width':  frame.shape[1],
            'frame_height': frame.shape[0],
        }))

    # ── Process one detected face ─────────────────────────────
    async def _process(self, r: dict, frame: np.ndarray) -> dict:
        emp_id = r.get('employee_id')

        if not emp_id:
            # Unknown person — save snapshot + alert
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: self._save_unknown(r['bbox'], frame))
            return self._unknown_label(r)

        emp = await self._get_employee(emp_id)
        if not emp:
            return self._unknown_label(r)

        now    = datetime.now()
        shift  = emp['shift_obj']
        status = get_scan_status(shift, now)

        # ── Ignore: break or mid-work-hours ───────────────────
        if status in ('break', 'ignore'):
            return self._build_label(r, emp, status)

        # ── Cooldown check ─────────────────────────────────────
        from django.conf import settings
        cooldown_sec = getattr(settings, 'CHECKIN_COOLDOWN_SECONDS', 300)
        if is_in_cooldown(self.cooldowns, emp_id, status, now, cooldown_sec):
            return self._build_label(r, emp, status)

        # ── Record attendance ──────────────────────────────────
        late_flag, late_min = (False, 0)
        hours_data = {}

        if status == 'check_in':
            late_flag, late_min = is_late(shift, now)
            await self._record_checkin(emp, r['confidence'], self.camera_id, late_flag, late_min)
            if late_flag:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, lambda: self._notify_late(emp, late_min))

        elif status == 'check_out':
            result = await self._record_checkout(emp, r['confidence'], self.camera_id, now)
            hours_data = result or {}

        update_cooldown(self.cooldowns, emp_id, status, now)
        await self._broadcast(emp, now, status, late_flag, late_min, hours_data)

        return self._build_label(r, emp, status, late_flag, late_min, hours_data)

    # ── Label builders ────────────────────────────────────────
    def _build_label(self, r, emp, status, is_late=False, late_min=0, hours={}):
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
            label['net_hours']  = hours.get('net_hours', 0)
            label['ot_hours']   = hours.get('ot_hours', 0)
        return label

    def _unknown_label(self, r):
        return {
            'bbox': r['bbox'], 'label': 'Unknown', 'label_kh': 'មិនស្គាល់',
            'employee_id': None, 'department': '', 'shift': '',
            'confidence': 0, 'status': 'unknown',
            'is_unknown': True, 'is_late': False, 'color': '#ef4444',
        }

    # ── Broadcast to dashboard ────────────────────────────────
    async def _broadcast(self, emp, now, status, late_flag, late_min, hours):
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
            msg['ot_hours']  = hours.get('ot_hours', 0)
        await self.channel_layer.group_send('dashboard', msg)

    # ── DB helpers ────────────────────────────────────────────
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
                'shift_obj':   e.shift,
                'shift_name':  str(e.shift) if e.shift else '',
                '_obj':        e,
            }
        except Employee.DoesNotExist:
            return None

    @database_sync_to_async
    def _record_checkin(self, emp, confidence, camera_id, late_flag, late_min):
        from .models import Employee, AttendanceRecord, Camera
        try:
            e   = Employee.objects.get(employee_id=emp['employee_id'])
            cam = Camera.objects.filter(camera_id=camera_id).first()
            AttendanceRecord.objects.create(
                employee=e, camera=cam, confidence=confidence,
                status='check_in', is_unknown=False,
                is_late=late_flag, late_minutes=late_min,
            )
        except Exception as ex:
            logger.error("Check-in record error: %s", ex)

    @database_sync_to_async
    def _record_checkout(self, emp, confidence, camera_id, now):
        from .models import Employee, Camera
        from django.utils import timezone
        try:
            e    = Employee.objects.select_related('shift').get(employee_id=emp['employee_id'])
            cam  = Camera.objects.filter(camera_id=camera_id).first()
            now_aware = timezone.make_aware(now) if timezone.is_naive(now) else now
            rec, hours_data = save_checkout_with_hours(e, now_aware, cam, confidence)
            return hours_data
        except Exception as ex:
            logger.error("Check-out record error: %s", ex)
            return {}

    def _save_unknown(self, bbox, frame):
        try:
            from .models import AttendanceRecord
            from django.core.files.base import ContentFile
            x1, y1, x2, y2 = bbox
            h, w = frame.shape[:2]; pad = 20
            crop = frame[max(0,y1-pad):min(h,y2+pad), max(0,x1-pad):min(w,x2+pad)]
            rec  = AttendanceRecord.objects.create(is_unknown=True, confidence=0)
            _, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
            rec.snapshot.save(f"unk_{rec.id}.jpg", ContentFile(buf.tobytes()), save=True)
            from .notify import notify_unknown
            notify_unknown(self.camera_id, rec.snapshot.path if rec.snapshot else None)
            rec.unknown_alerted = True
            rec.save(update_fields=['unknown_alerted'])
        except Exception as ex:
            logger.error("Unknown save error: %s", ex)

    def _notify_late(self, emp, late_min):
        from .notify import notify_late
        notify_late(emp['name'], emp['employee_id'], late_min, emp['shift_name'] or 'N/A')


# ─────────────────────────────────────────────────────────────
class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add('dashboard', self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard('dashboard', self.channel_name)

    async def attendance_update(self, event):
        await self.send(text_data=json.dumps({**event, 'type': 'attendance_update'}))
