import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url?.includes('/auth/')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);



export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getDiscordUrl: () => api.get('/auth/discord/url'),
  discordCallback: (code) => api.post('/auth/discord/callback', { code }),
};

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const settingsApi = {
  getSlots: () => api.get('/settings/slots').then((res) => res.data),
  updateSlots: (data) => api.put('/settings/slots', data).then((res) => res.data),
};

export const attendanceApi = {
  today: () => api.get('/attendance/today'),
  list: (params) => api.get('/attendance', { params }),
  stats: (params) => api.get('/attendance/stats', { params }),
  userStats: (params) => api.get('/attendance/stats/users', { params }),
  myPeriodStats: (params) => api.get('/attendance/stats/me-period', { params }),
  dashboard: (params) => api.get('/attendance/stats/dashboard', { params }),
  daily: (params) => api.get('/attendance/daily', { params }),
  markAbsent: (data) => api.post('/attendance/absent', data),
  updateDaily: (data) => api.put('/attendance/update-daily', data),
};

export const leaveApi = {
  create: (formData) =>
    api.post('/leave', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (params) => api.get('/leave', { params }),
  get: (id) => api.get(`/leave/${id}`),
  delete: (id) => api.delete(`/leave/${id}`),
};

export const activityApi = {
  list: (params) => api.get('/activity', { params }),
};

export const exportApi = {
  attendance: (params) => api.get('/export/attendance', { params, responseType: 'blob' }),
  leave: (params) => api.get('/export/leave', { params, responseType: 'blob' }),
};

export const finesApi = {
  list: (params) => api.get('/fines', { params }),
  create: (data) => api.post('/fines', data),
  pay: (userId) => api.put(`/fines/${userId}/pay`),
};

