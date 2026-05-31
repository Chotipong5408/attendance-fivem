import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Activity, Search, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { activityApi } from '../api/client';
import Loading from '../components/Loading';
import { getUserDisplayName } from '../utils/userDisplay';
import DateInput from '../components/DateInput';

const actionLabels = {
  LOGIN: 'เข้าสู่ระบบ',
  CHECKIN: 'ลงชื่อเข้างาน',
  LEAVE_REQUEST: 'แจ้งลา',
  LEAVE_STATUS_UPDATE: 'อัปเดตสถานะการลา',
  LEAVE_CANCEL: 'ยกเลิกการลา',
  USER_CREATE: 'เพิ่มผู้ใช้',
  USER_UPDATE: 'แก้ไขผู้ใช้',
  USER_DELETE: 'ลบผู้ใช้',
  MARK_ABSENT: 'ลงชื่อขาดงาน',
  UPDATE_SETTINGS: 'ตั้งค่าระบบ',
};

function formatThaiLogDetails(details) {
  if (!details || Object.keys(details).length === 0) return '-';
  
  const parts = [];
  
  const d = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (details.leaveDate) parts.push(`วันที่ลา: ${d(details.leaveDate)}`);
  if (details.endDate && details.endDate !== details.leaveDate) parts.push(`ถึง: ${d(details.endDate)}`);
  if (details.leaveType) parts.push(`ประเภท: ${details.leaveType === 'full_day' ? 'ทั้งวัน' : 'บางเวลา'}`);
  if (details.leaveTimeSlot) parts.push(`เวลา: ${details.leaveTimeSlot}`);
  if (details.totalDays) parts.push(`จำนวน: ${details.totalDays} วัน`);
  if (details.reason) parts.push(`เหตุผล: ${details.reason}`);
  
  if (details.username) parts.push(`ชื่อผู้ใช้: ${details.username}`);
  if (details.icName) parts.push(`ชื่อ IC: ${details.icName}`);
  if (details.role) parts.push(`ระดับ: ${details.role === 'admin' ? 'แอดมิน' : 'ผู้ใช้ทั่วไป'}`);
  if (details.targetUserId) parts.push(`เป้าหมาย ID: ${details.targetUserId}`);
  if (details.method) parts.push(`ช่องทาง: ${details.method === 'password' ? 'รหัสผ่าน' : details.method}`);
  
  if (details.date) parts.push(`วันที่: ${d(details.date)}`);
  if (details.timeSlot) parts.push(`เวลา: ${details.timeSlot}`);
  
  if (details.changes) {
    const chg = [];
    if (details.changes.name) chg.push(`ชื่อ: ${details.changes.name}`);
    if (details.changes.number) chg.push(`เลข: ${details.changes.number}`);
    if (details.changes.role) chg.push(`ระดับ: ${details.changes.role}`);
    if (details.changes.password) chg.push(`รหัสผ่าน (ถูกเปลี่ยน)`);
    if (chg.length > 0) parts.push(`เปลี่ยน: ${chg.join(', ')}`);
  }

  if (parts.length > 0) return parts.join(' | ');
  return JSON.stringify(details);
}

export default function AdminActivity() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await activityApi.list({ 
        page, 
        limit: 20, 
        action: actionFilter,
        search: debouncedSearch || undefined,
        date: dateFilter || undefined
      });
      setLogs(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('โหลด activity logs ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, debouncedSearch, dateFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [actionFilter, debouncedSearch, dateFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  if (loading && logs.length === 0) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-2 text-slate-400">
          <Activity size={18} className="text-indigo-400" />
          <p className="text-sm font-medium">บันทึกกิจกรรมทั้งหมดในระบบ</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ใช้, IC Name, รหัสพนักงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 py-1.5 pl-9 pr-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 min-w-[200px]">
            <CalendarDays className="text-slate-500" size={16} />
            <DateInput
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ล้าง
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400 whitespace-nowrap">กิจกรรม:</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">ทั้งหมด</option>
              {Object.entries(actionLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
          ไม่มีข้อมูล
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50 text-left text-slate-400">
                <th className="px-4 py-3">วันที่/เวลา</th>
                <th className="px-4 py-3">ผู้ใช้</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">รายละเอียด</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                    {new Date(log.createdAt).toLocaleString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {getUserDisplayName(log.user)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="max-w-[400px] px-4 py-3 text-slate-400" title={JSON.stringify(log.details)}>
                    <div className="text-xs">{formatThaiLogDetails(log.details)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {log.ipAddress === '::1' ? 'Localhost (::1)' : (log.ipAddress || '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
          <p className="text-sm text-slate-400">
            หน้า {pagination.page} / {pagination.totalPages} ({pagination.total} รายการ)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              ก่อนหน้า
            </button>
            <button
              type="button"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              ถัดไป
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
