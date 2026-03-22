from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EmployeeViewSet, AttendanceViewSet, CameraViewSet,
    DepartmentViewSet, ShiftViewSet, OvertimeViewSet, LeaveViewSet,
    daily_report_json, daily_report_excel, daily_report_pdf,
)

router = DefaultRouter()
router.register('departments', DepartmentViewSet)
router.register('shifts',      ShiftViewSet)
router.register('employees',   EmployeeViewSet)
router.register('attendance',  AttendanceViewSet)
router.register('overtime',    OvertimeViewSet)
router.register('leaves',      LeaveViewSet)
router.register('cameras',     CameraViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # Daily report endpoints
    path('daily-report/',       daily_report_json,  name='daily-report-json'),
    path('daily-report/excel/', daily_report_excel, name='daily-report-excel'),
    path('daily-report/pdf/',   daily_report_pdf,   name='daily-report-pdf'),
]
