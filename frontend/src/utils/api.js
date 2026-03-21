import axios from 'axios';
const api = axios.create({ baseURL: '/api', timeout: 15000 });

export const deptAPI = {
  list:   ()     => api.get('/departments/'),
  create: (data) => api.post('/departments/', data),
};
export const shiftAPI = {
  list:   ()      => api.get('/shifts/'),
  create: (data)  => api.post('/shifts/', data),
  update: (id, d) => api.patch(`/shifts/${id}/`, d),
  delete: (id)    => api.delete(`/shifts/${id}/`),
};
export const employeeAPI = {
  list:         (p)       => api.get('/employees/', { params: p }),
  create:       (data)    => api.post('/employees/', data),
  update:       (id, d)   => api.patch(`/employees/${id}/`, d),
  delete:       (id)      => api.delete(`/employees/${id}/`),
  registerFace: (id, b64) => api.post(`/employees/${id}/register-face/`, { image: b64 }),
  clearFace:    (id)      => api.delete(`/employees/${id}/clear-face/`),
  stats:        ()        => api.get('/employees/stats/'),
  mobileInfo:   (empId)   => api.get('/employees/mobile-list/', { params: { employee_id: empId } }),
};
export const attendanceAPI = {
  todaySummary: ()     => api.get('/attendance/today-summary/'),
  liveFeed:     ()     => api.get('/attendance/live-feed/'),
  shiftSummary: ()     => api.get('/attendance/shift-summary/'),
  list:         (p)    => api.get('/attendance/', { params: p }),
  exportExcel:  (f, t) => api.get('/attendance/export-excel/', { params:{date_from:f,date_to:t}, responseType:'blob' }),
  exportPDF:    (f, t) => api.get('/attendance/export-pdf/',   { params:{date_from:f,date_to:t}, responseType:'blob' }),
};
export const overtimeAPI = {
  list:        (p)     => api.get('/overtime/', { params: p }),
  create:      (data)  => api.post('/overtime/', data),
  update:      (id, d) => api.patch(`/overtime/${id}/`, d),
  approve:     (id)    => api.post(`/overtime/${id}/approve/`),
  reject:      (id)    => api.post(`/overtime/${id}/reject/`),
  summary:     (m, y)  => api.get('/overtime/summary/', { params:{month:m,year:y} }),
  exportExcel: (m, y)  => api.get('/overtime/export-excel/', { params:{month:m,year:y}, responseType:'blob' }),
};
export const leaveAPI = {
  list:    (p)    => api.get('/leaves/', { params: p }),
  create:  (data) => api.post('/leaves/', data),
  approve: (id)   => api.post(`/leaves/${id}/approve/`),
  reject:  (id)   => api.post(`/leaves/${id}/reject/`),
};
export const cameraAPI = {
  list:   ()      => api.get('/cameras/'),
  create: (data)  => api.post('/cameras/', data),
  delete: (id)    => api.delete(`/cameras/${id}/`),
};
export function saveBlob(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=u; a.download=name; a.click();
  URL.revokeObjectURL(u);
}
export default api;
