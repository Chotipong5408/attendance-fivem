import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute, { AdminRoute, GuestRoute, ManagerRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import DiscordCallback from './pages/DiscordCallback';
import LeaveForm from './pages/LeaveForm';
import AttendanceHistory from './pages/AttendanceHistory';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminAttendance from './pages/AdminAttendance';
import AdminActivity from './pages/AdminActivity';
import AdminSettings from './pages/AdminSettings';
import AdminFines from './pages/AdminFines';
import UserFines from './pages/UserFines';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/discord/callback" element={<DiscordCallback />} />
      </Route>

      <Route element={<ProtectedRoute />}>

        <Route
          path="/leave"
          element={
            <Layout title="แจ้งลา">
              <LeaveForm />
            </Layout>
          }
        />
        <Route
          path="/history"
          element={
            <Layout title="ประวัติเช็คชื่อ">
              <AttendanceHistory />
            </Layout>
          }
        />
        <Route
          path="/fines"
          element={
            <Layout title="สรุปยอดค่าปรับ">
              <UserFines />
            </Layout>
          }
        />
      </Route>

      <Route element={<ManagerRoute />}>
        <Route
          path="/admin"
          element={
            <Layout title="Admin Dashboard">
              <AdminDashboard />
            </Layout>
          }
        />
        <Route
          path="/admin/attendance"
          element={
            <Layout title="รายการเช็คชื่อ">
              <AdminAttendance />
            </Layout>
          }
        />
        <Route
          path="/admin/fines"
          element={
            <Layout title="จัดการค่าปรับ">
              <AdminFines />
            </Layout>
          }
        />
      </Route>

      <Route element={<AdminRoute />}>
        <Route
          path="/admin/users"
          element={
            <Layout title="จัดการผู้ใช้">
              <AdminUsers />
            </Layout>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <Layout title="Activity Logs">
              <AdminActivity />
            </Layout>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <Layout title="ตั้งค่าระบบ">
              <AdminSettings />
            </Layout>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/leave" replace />} />
      <Route path="*" element={<Navigate to="/leave" replace />} />
    </Routes>
  );
}
