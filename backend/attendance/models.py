from django.db import models
from django.utils import timezone
import numpy as np
from datetime import time, timedelta


class Department(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self): return self.name


class Shift(models.Model):
    """Factory work shifts e.g. Morning / Afternoon / Night"""
    name       = models.CharField(max_length=50)          # e.g. "Morning Shift"
    start_time = models.TimeField()                        # e.g. 06:00
    end_time   = models.TimeField()                        # e.g. 14:00
    grace_minutes = models.IntegerField(default=15)        # late grace period
    is_overnight  = models.BooleanField(default=False)     # True for night shift
    color      = models.CharField(max_length=7, default='#3b82f6')  # hex color for UI
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self): return f"{self.name} ({self.start_time:%H:%M}–{self.end_time:%H:%M})"

    @property
    def duration_hours(self):
        start = timedelta(hours=self.start_time.hour, minutes=self.start_time.minute)
        end   = timedelta(hours=self.end_time.hour,   minutes=self.end_time.minute)
        if self.is_overnight:
            end += timedelta(hours=24)
        return (end - start).seconds / 3600


class Employee(models.Model):
    employee_id    = models.CharField(max_length=20, unique=True)
    name           = models.CharField(max_length=100)
    name_kh        = models.CharField(max_length=100, blank=True)
    department     = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    shift          = models.ForeignKey(Shift, on_delete=models.SET_NULL, null=True, blank=True)
    position       = models.CharField(max_length=100, blank=True)
    phone          = models.CharField(max_length=20, blank=True)
    email          = models.EmailField(blank=True)
    hourly_rate    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    photo          = models.ImageField(upload_to='employee_photos/', null=True, blank=True)
    face_embedding = models.BinaryField(null=True, blank=True)  # averaged embedding
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee_id']

    def __str__(self): return f"{self.employee_id} – {self.name}"

    @property
    def has_face_registered(self):
        return FaceEmbedding.objects.filter(employee=self).exists()

    @property
    def face_count(self):
        return FaceEmbedding.objects.filter(employee=self).count()


class FaceEmbedding(models.Model):
    """Multiple raw embeddings per person for multi-angle accuracy"""
    employee       = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='embeddings')
    embedding_data = models.BinaryField()
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class Camera(models.Model):
    camera_id  = models.CharField(max_length=20, unique=True)
    name       = models.CharField(max_length=100)
    location   = models.CharField(max_length=200)
    stream_url = models.CharField(max_length=500, blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self): return f"{self.camera_id} – {self.name}"


class AttendanceRecord(models.Model):
    STATUS = [('check_in','Check In'),('check_out','Check Out')]

    employee        = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='records')
    timestamp       = models.DateTimeField(auto_now_add=True)
    camera          = models.ForeignKey(Camera, on_delete=models.SET_NULL, null=True, blank=True)
    status          = models.CharField(max_length=10, choices=STATUS, default='check_in')
    confidence      = models.FloatField(default=0.0)
    snapshot        = models.ImageField(upload_to='snapshots/%Y/%m/%d/', null=True, blank=True)
    is_unknown      = models.BooleanField(default=False)
    is_late         = models.BooleanField(default=False)
    late_minutes    = models.IntegerField(default=0)
    unknown_alerted = models.BooleanField(default=False)

    class Meta:
        ordering = ['-timestamp']
        indexes  = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['employee', '-timestamp']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        who = self.employee.name if self.employee else "Unknown"
        return f"{who} @ {self.timestamp:%Y-%m-%d %H:%M:%S}"


class OvertimeRecord(models.Model):
    """Tracks overtime hours per employee per day"""
    STATUS = [('pending','Pending'),('approved','Approved'),('rejected','Rejected')]

    employee     = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='overtime_records')
    date         = models.DateField()
    ot_start     = models.DateTimeField()
    ot_end       = models.DateTimeField(null=True, blank=True)
    ot_hours     = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    ot_rate      = models.DecimalField(max_digits=5, decimal_places=2, default=1.5)  # 1.5x normal
    status       = models.CharField(max_length=10, choices=STATUS, default='pending')
    approved_by  = models.CharField(max_length=100, blank=True)
    note         = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering      = ['-date']
        unique_together = ['employee', 'date']

    def __str__(self): return f"{self.employee.name} OT {self.date} ({self.ot_hours}h)"

    @property
    def ot_pay(self):
        if self.employee.hourly_rate:
            return float(self.ot_hours) * float(self.employee.hourly_rate) * float(self.ot_rate)
        return 0


class LeaveRequest(models.Model):
    LEAVE_TYPES = [
        ('annual','Annual Leave'),
        ('medical','Medical Leave'),
        ('emergency','Emergency'),
        ('unpaid','Unpaid Leave'),
        ('other','Other'),
    ]
    STATUS = [('pending','Pending'),('approved','Approved'),('rejected','Rejected')]

    employee   = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPES)
    start_date = models.DateField()
    end_date   = models.DateField()
    reason     = models.TextField()
    status     = models.CharField(max_length=10, choices=STATUS, default='pending')
    approved_by = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def days(self):
        return (self.end_date - self.start_date).days + 1
