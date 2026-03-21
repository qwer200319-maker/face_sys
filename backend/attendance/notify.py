"""
Telegram notification helper
Send alerts for: unknown person, late employee, daily summary
"""
import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _send(text: str, photo_path: str = None):
    token = settings.TELEGRAM_BOT_TOKEN
    chat  = settings.TELEGRAM_CHAT_ID
    if not token or not chat:
        return

    try:
        if photo_path:
            with open(photo_path, 'rb') as f:
                requests.post(
                    f"https://api.telegram.org/bot{token}/sendPhoto",
                    data={'chat_id': chat, 'caption': text, 'parse_mode': 'HTML'},
                    files={'photo': f},
                    timeout=10,
                )
        else:
            requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={'chat_id': chat, 'text': text, 'parse_mode': 'HTML'},
                timeout=10,
            )
    except Exception as e:
        logger.error("Telegram error: %s", e)


def notify_unknown(camera_id: str, snapshot_path: str = None):
    from django.utils import timezone
    now = timezone.localtime().strftime('%H:%M:%S')
    text = (
        f"⚠️ <b>Unknown Person Detected</b>\n"
        f"📹 Camera: <code>{camera_id}</code>\n"
        f"🕐 Time: {now}"
    )
    _send(text, snapshot_path)


def notify_late(employee_name: str, employee_id: str, late_minutes: int, shift_name: str):
    text = (
        f"⏰ <b>Late Arrival</b>\n"
        f"👤 {employee_name} (<code>{employee_id}</code>)\n"
        f"🔴 Late by <b>{late_minutes} minutes</b>\n"
        f"🏭 Shift: {shift_name}"
    )
    _send(text)


def notify_daily_summary(date_str: str, present: int, absent: int, total: int, unknown: int):
    rate = round(present / total * 100, 1) if total else 0
    text = (
        f"📊 <b>Daily Attendance Summary</b>\n"
        f"📅 Date: {date_str}\n\n"
        f"✅ Present:  <b>{present}</b>\n"
        f"❌ Absent:   <b>{absent}</b>\n"
        f"👥 Total:    <b>{total}</b>\n"
        f"⚠️ Unknown:  <b>{unknown}</b>\n"
        f"📈 Rate:     <b>{rate}%</b>"
    )
    _send(text)


def notify_overtime_approved(employee_name: str, ot_hours: float, date_str: str):
    text = (
        f"✅ <b>Overtime Approved</b>\n"
        f"👤 {employee_name}\n"
        f"⏱ OT Hours: <b>{ot_hours}h</b>\n"
        f"📅 Date: {date_str}"
    )
    _send(text)
