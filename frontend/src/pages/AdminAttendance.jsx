import { useState, useEffect, useCallback } from 'react';
import {
  Download, Filter, ChevronLeft, ChevronRight,
  RefreshCw, XCircle, CalendarDays, History,
  CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceApi, exportApi } from '../api/client';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import { getUserDisplayName } from '../utils/userDisplay';
import { useSlots } from '../hooks/useSlots';
import { formatReason } from '../utils/formatReason';
import DateInput from '../components/DateInput';

function NoteCell({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || text === '-') return <span className="text-slate-600">-</span>;
  const isLong = text.length > 40;
  return (
    <div className="text-xs text-slate-400 max-w-[180px]">
      <span className={!expanded && isLong ? 'line-clamp-2' : ''}>{text}</span>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(p => !p)}
          className="mt-0.5 block text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {expanded ? 'ย่อ' : 'ดูเพิ่มเติม'}
        </button>
      )}
    </div>
  );
}

/* ─── Constants ─── */
function getLocalDateInputValue(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseTimeSlots(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

const STATUS_COLOR = {
  present: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  absent: 'text-red-400 bg-red-500/10 border-red-500/30',
  leave: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
};
const STATUS_LABEL = { present: 'มา', absent: 'ขาด', leave: 'ลา' };

/* ─── SlotBadge ─── */
function SlotBadge({ status }) {
  // Default is "มา" — if no status recorded yet, show present
  const s = status || 'present';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[s]}`}>
      {s === 'present' && <CheckCircle2 size={10} />}
      {s === 'absent' && <XCircle size={10} />}
      {s === 'leave' && <Clock size={10} />}
      {STATUS_LABEL[s]}
    </span>
  );
}

/* ─── Get effective status for a slot ─── */
function getEffectiveSlot(slots, leave, slotKey) {
  const fromDb = slots[slotKey];

  // If admin has explicitly set a value in DB, that takes priority over leave
  if (fromDb) return fromDb;

  // No explicit admin override — check leave status
  if (leave) {
    if (leave.leaveType === 'full_day') return 'leave';
    if (leave.leaveType === 'partial' && leave.leaveTimeSlot && leave.leaveTimeSlot.includes(slotKey)) return 'leave';
  }

  return 'present';
}

/* ─── Summary bar ─── */
function DailySummary({ rows, attendanceSlots }) {
  const totals = {};
  attendanceSlots.forEach(slot => { totals[slot] = { present: 0, absent: 0, leave: 0 }; });

  rows.forEach(({ attendance, leave }) => {
    const s = parseTimeSlots(attendance?.timeSlots);
    attendanceSlots.forEach(slot => {
      const status = getEffectiveSlot(s, leave, slot);
      totals[slot][status] = (totals[slot][status] || 0) + 1;
    });
  });

  return (
    <div className="flex flex-wrap items-center gap-y-4 gap-x-5 rounded-xl border border-slate-700 bg-slate-800/40 px-5 py-4 text-xs shadow-sm">
      {attendanceSlots.map((slot, index) => (
        <div key={slot} className="flex items-center gap-3">
          <div className="font-mono text-[13px] font-semibold text-slate-300">
            {slot}
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-900/80 px-3 py-1.5 border border-slate-700/50">
            <span className="flex items-center gap-1 font-medium text-emerald-400">
              มา <span className="bg-emerald-500/20 px-1.5 rounded text-emerald-300">{totals[slot].present}</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1 font-medium text-red-400">
              ขาด <span className="bg-red-500/20 px-1.5 rounded text-red-300">{totals[slot].absent}</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1 font-medium text-amber-400">
              ลา <span className="bg-amber-500/20 px-1.5 rounded text-amber-300">{totals[slot].leave}</span>
            </span>
          </div>
          {index < attendanceSlots.length - 1 && <span className="mx-1 h-6 border-l border-slate-700" />}
        </div>
      ))}

    </div>
  );
}

/* ════════════════════════════════════════
   TAB A – รายวัน
════════════════════════════════════════ */
function DailyTab({ attendanceSlots }) {
  const [date, setDate] = useState(getLocalDateInputValue);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [editModal, setEditModal] = useState(null); // { user, timeSlot, currentStatus }
  const [editStatus, setEditStatus] = useState('present');
  const [editNote, setEditNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await attendanceApi.daily({ date });
      setRows(data.rows || []);
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void fetchDaily(); }, [fetchDaily]);

  useEffect(() => {
    const syncToday = () => setDate(getLocalDateInputValue());
    const handleVis = () => { if (document.visibilityState === 'visible') syncToday(); };
    window.addEventListener('focus', syncToday);
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      window.removeEventListener('focus', syncToday);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, []);

  const openEditModal = (user, timeSlot, currentStatus) => {
    setEditModal({ user, timeSlot, currentStatus });
    setEditStatus(currentStatus);
    setEditNote('');
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!editModal) return;
    setSubmitting(true);
    try {
      const payload = {
        userId: editModal.user.id,
        date,
        timeSlot: editModal.timeSlot,
        timeSlotStatus: editStatus,
        note: editNote.trim() || undefined,
      };
      await attendanceApi.updateDaily(payload);
      toast.success(`อัปเดตสถานะ ${editModal.timeSlot} สำเร็จ`);
      setEditModal(null);
      await fetchDaily();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">วันที่</span>
          <DateInput
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={fetchDaily}
          className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={15} />
          รีเฟรช
        </button>
        {!loading && rows.length > 0 && <DailySummary rows={rows} attendanceSlots={attendanceSlots} />}
      </div>

      {loading ? <Loading /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-300">
                <th className="px-4 py-3 font-medium text-slate-500">#</th>
                <th className="px-4 py-3 font-medium">IC Name</th>
                <th className="px-4 py-3 font-medium">หมายเลข</th>
                {attendanceSlots.map(slot => (
                  <th key={slot} className="px-3 py-3 font-medium text-center border-l border-slate-700">
                    <div className="text-indigo-300">{slot}</div>
                    <div className="text-xs font-normal text-slate-500 mt-0.5">สถานะ</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, attendance, leave }, idx) => {
                const slots = parseTimeSlots(attendance?.timeSlots);

                // Get effective status for each slot
                const slotStatuses = {};
                attendanceSlots.forEach(slot => {
                  slotStatuses[slot] = getEffectiveSlot(slots, leave, slot);
                });

                return (
                  <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-600 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 text-white font-medium">{getUserDisplayName(user)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{user.number}</td>

                    {attendanceSlots.map(slot => {
                      const st = slotStatuses[slot];
                      return (
                        <td key={slot} className="px-3 py-2 border-l border-slate-700 text-center">
                          <button
                            type="button"
                            onClick={() => openEditModal(user, slot, st)}
                            className="inline-flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                            title="คลิกเพื่อแก้ไขสถานะ"
                          >
                            <SlotBadge status={st} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!rows.length && (
            <div className="p-10 text-center text-slate-500">ไม่มีข้อมูลผู้ใช้</div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={`แก้ไขสถานะเวลา ${editModal?.timeSlot}`.trim()}
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 text-sm text-indigo-300">
            <CalendarDays size={16} className="shrink-0" />
            <span>
              ผู้ใช้: <b>{editModal ? getUserDisplayName(editModal.user) : ''}</b><br />
              วันที่: {date}
            </span>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-400">สถานะ</span>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="present">มา</option>
              <option value="absent">ขาด</option>
              <option value="leave">ลา</option>
            </select>
          </label>



          <footer className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setEditModal(null)}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors font-medium"
            >
              {submitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════
   TAB B – ประวัติ
════════════════════════════════════════ */
const STATUS_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'present', label: 'มา' },
  { value: 'absent', label: 'ขาด' },
  { value: 'leave', label: 'ลา' },
];

function HistoryTab({ attendanceSlots }) {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const todayDate = getLocalDateInputValue();
  const [filters, setFilters] = useState({ status: '', username: '', dateFrom: todayDate, dateTo: todayDate });
  const [applied, setApplied] = useState(filters);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (applied.status) params.status = applied.status;
      if (applied.username.trim()) params.username = applied.username.trim();
      if (applied.dateFrom) params.dateFrom = applied.dateFrom;
      if (applied.dateTo) params.dateTo = applied.dateTo;

      const { data } = await attendanceApi.list(params);
      setRecords(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { void fetchAttendance(); }, [fetchAttendance]);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (applied.status) params.status = applied.status;
      if (applied.username.trim()) params.username = applied.username.trim();
      if (applied.dateFrom) params.dateFrom = applied.dateFrom;
      if (applied.dateTo) params.dateTo = applied.dateTo;

      const { data } = await exportApi.attendance(params);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attendance-export.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export CSV สำเร็จ');
    } catch {
      toast.error('Export ไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  const inp = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <form onSubmit={applyFilters} className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex items-center gap-2 text-slate-300 lg:w-full">
            <Filter size={16} className="text-indigo-400" />
            <span className="text-sm font-medium">ตัวกรอง</span>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">สถานะ</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={inp}>
              {STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value || 'all'} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">ชื่อ / Username</label>
            <input type="text" placeholder="ค้นหา..." value={filters.username}
              onChange={(e) => setFilters({ ...filters, username: e.target.value })} className={inp} />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">จากวันที่</label>
            <DateInput value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className={inp} />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">ถึงวันที่</label>
            <DateInput value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className={inp} />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors">
              ค้นหา
            </button>
            <button type="button" disabled={exporting} onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors">
              <Download size={15} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      {loading ? <Loading /> : !records.length ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-10 text-center text-slate-400">ไม่มีข้อมูล</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80 text-left text-slate-400">
                <th className="px-4 py-3">วันที่</th>
                <th className="px-4 py-3">ผู้ใช้</th>
                <th className="px-4 py-3">หมายเลข</th>
                {attendanceSlots.map(slot => (
                  <th key={slot} className="px-3 py-3 text-center border-l border-slate-700">{slot}</th>
                ))}
                <th className="px-4 py-3 border-l border-slate-700">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const slots = parseTimeSlots(r.timeSlots);
                return (
                  <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(r.attendanceDate || r.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{getUserDisplayName(r.user)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.user?.number}</td>
                    {attendanceSlots.map(slot => (
                      <td key={slot} className="px-3 py-3 text-center border-l border-slate-700">
                        <SlotBadge status={getEffectiveSlot(slots, r.leave, slot)} />
                      </td>
                    ))}
                    <td className="px-4 py-3 border-l border-slate-700 align-top">
                      <NoteCell text={formatReason(r.leave?.reason || r.note)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
          <p className="text-sm text-slate-400">
            หน้า {pagination.page} / {pagination.totalPages} ({pagination.total} รายการ)
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">
              <ChevronLeft size={15} /> ก่อนหน้า
            </button>
            <button type="button" disabled={!pagination.hasNext} onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">
              ถัดไป <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   Main page
════════════════════════════════════════ */
const TABS = [
  { id: 'daily', label: 'เช็คชื่อรายวัน', icon: CalendarDays },
  { id: 'history', label: 'ประวัติ', icon: History },
];

export default function AdminAttendance() {
  const { attendanceSlots, loading: slotsLoading } = useSlots();
  const [targetDate, setTargetDate] = useState(getLocalDateInputValue());
  const [tab, setTab] = useState('daily');

  if (slotsLoading) return <Loading />;

  return (
    <section className="space-y-5">
      <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-800/50 p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all ${tab === id
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'daily' && <DailyTab attendanceSlots={attendanceSlots} />}
      {tab === 'history' && <HistoryTab attendanceSlots={attendanceSlots} />}
    </section>
  );
}
