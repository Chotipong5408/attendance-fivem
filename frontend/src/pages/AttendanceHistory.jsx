import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceApi } from '../api/client';
import AttendanceTable from '../components/AttendanceTable';
import DateInput from '../components/DateInput';

export default function AttendanceHistory() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  // Filters
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (status) params.status = status;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const { data } = await attendanceApi.list(params);
      setRecords(data.data);
      setPagination(data.pagination);
      setSummary(data.summary);
    } catch {
      toast.error('โหลดประวัติไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, status, dateFrom, dateTo]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const resetFilters = () => {
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
            <p className="text-sm text-emerald-400">มาทั้งหมด</p>
            <p className="text-2xl font-bold text-emerald-300">{summary.present} ครั้ง</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center">
            <p className="text-sm text-rose-400">ขาดทั้งหมด</p>
            <p className="text-2xl font-bold text-rose-300">{summary.absent} ครั้ง</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-center">
            <p className="text-sm text-amber-400">ลาทั้งหมด</p>
            <p className="text-2xl font-bold text-amber-300">{summary.leave} ครั้ง</p>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-slate-300">
          <Filter size={18} className="text-indigo-400" />
          <h3 className="font-medium">ตัวกรองประวัติการเช็คชื่อ</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">ตั้งแต่วันที่</span>
            <DateInput
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">ถึงวันที่</span>
            <DateInput
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw size={16} />
              ล้างตัวกรอง
            </button>
          </div>
        </div>
      </div>

      <AttendanceTable records={records} loading={loading} showUser={true} onLeaveCancelled={fetchHistory} />

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
