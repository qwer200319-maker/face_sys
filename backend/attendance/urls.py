from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (EmployeeViewSet, AttendanceViewSet, CameraViewSet,
                    DepartmentViewSet, ShiftViewSet, OvertimeViewSet, LeaveViewSet)

router = DefaultRouter()
router.register('departments', DepartmentViewSet)
router.register('shifts',      ShiftViewSet)
router.register('employees',   EmployeeViewSet)
router.register('attendance',  AttendanceViewSet)
router.register('overtime',    OvertimeViewSet)
router.register('leaves',      LeaveViewSet)
router.register('cameras',     CameraViewSet)

urlpatterns = [path('', include(router.urls))]
