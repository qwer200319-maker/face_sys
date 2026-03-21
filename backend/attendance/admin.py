from django.contrib import admin
from .models import *

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name','description']

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['name','start_time','end_time','grace_minutes','is_overnight','duration_hours']

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display  = ['employee_id','name','name_kh','department','shift','position','has_face_registered','face_count','is_active']
    list_filter   = ['department','shift','is_active']
    search_fields = ['employee_id','name','name_kh']

@admin.register(FaceEmbedding)
class FaceEmbeddingAdmin(admin.ModelAdmin):
    list_display = ['employee','created_at']

@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display  = ['employee','timestamp','camera','status','confidence','is_unknown','is_late','late_minutes']
    list_filter   = ['is_unknown','status','is_late']
    search_fields = ['employee__name','employee__employee_id']

@admin.register(OvertimeRecord)
class OvertimeAdmin(admin.ModelAdmin):
    list_display  = ['employee','date','ot_hours','ot_rate','status','approved_by']
    list_filter   = ['status','date']
    search_fields = ['employee__name']

@admin.register(LeaveRequest)
class LeaveAdmin(admin.ModelAdmin):
    list_display  = ['employee','leave_type','start_date','end_date','days','status']
    list_filter   = ['status','leave_type']

@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ['camera_id','name','location','is_active']
