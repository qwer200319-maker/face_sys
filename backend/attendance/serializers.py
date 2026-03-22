from rest_framework import serializers
from .models import Employee, AttendanceRecord, Camera, Department, Shift, OvertimeRecord, LeaveRequest


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Department
        fields = '__all__'


class ShiftSerializer(serializers.ModelSerializer):
    duration_hours = serializers.FloatField(read_only=True)

    class Meta:
        model  = Shift
        fields = [
            'id', 'name', 'start_time', 'end_time', 'grace_minutes',
            'checkin_before', 'checkin_after',
            'checkout_before', 'checkout_after',
            'break_start', 'break_end',
            'is_overnight', 'color', 'duration_hours', 'created_at',
        ]


class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    shift_name      = serializers.CharField(source='shift.name',      read_only=True)
    has_face        = serializers.BooleanField(source='has_face_registered', read_only=True)
    face_count      = serializers.IntegerField(read_only=True)
    photo_url       = serializers.SerializerMethodField()

    class Meta:
        model  = Employee
        fields = [
            'id', 'employee_id', 'name', 'name_kh',
            'department', 'department_name',
            'shift', 'shift_name',
            'position', 'phone', 'email', 'hourly_rate',
            'photo_url', 'has_face', 'face_count', 'is_active', 'created_at',
        ]

    def get_photo_url(self, obj):
        req = self.context.get('request')
        if obj.photo and req:
            return req.build_absolute_uri(obj.photo.url)
        return None


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_name    = serializers.CharField(source='employee.name',            read_only=True)
    employee_name_kh = serializers.CharField(source='employee.name_kh',         read_only=True)
    employee_id      = serializers.CharField(source='employee.employee_id',      read_only=True)
    department       = serializers.CharField(source='employee.department.name',  read_only=True)
    shift_name       = serializers.CharField(source='employee.shift.name',       read_only=True)
    camera_name      = serializers.CharField(source='camera.name',              read_only=True)
    snapshot_url     = serializers.SerializerMethodField()

    class Meta:
        model  = AttendanceRecord
        fields = [
            'id', 'employee_name', 'employee_name_kh', 'employee_id',
            'department', 'shift_name', 'timestamp', 'camera_name',
            'status', 'confidence', 'is_unknown',
            'is_late', 'late_minutes', 'work_hours', 'snapshot_url',
        ]

    def get_snapshot_url(self, obj):
        req = self.context.get('request')
        if obj.snapshot and req:
            return req.build_absolute_uri(obj.snapshot.url)
        return None


class OvertimeRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name',            read_only=True)
    employee_id   = serializers.CharField(source='employee.employee_id',     read_only=True)
    department    = serializers.CharField(source='employee.department.name', read_only=True)
    ot_pay        = serializers.FloatField(read_only=True)

    class Meta:
        model  = OvertimeRecord
        fields = '__all__'


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name',        read_only=True)
    employee_id   = serializers.CharField(source='employee.employee_id', read_only=True)
    days          = serializers.IntegerField(read_only=True)

    class Meta:
        model  = LeaveRequest
        fields = '__all__'


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Camera
        fields = '__all__'
