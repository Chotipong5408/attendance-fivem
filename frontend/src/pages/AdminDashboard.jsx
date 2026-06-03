import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, CalendarDays, CheckCircle2, XCircle, Clock, Activity, Target, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceApi } from '../api/client';
import Loading from '../components/Loading';
import { getUserDisplayName } from '../utils/userDisplay';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

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

function formatDateShort(dateVal) {
  if (!dateVal) return '';
  return new Date(dateVal).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function formatDayName(dateVal) {
  if (!dateVal) return '';
  return new Date(dateVal).toLocaleDateString('th-TH', { weekday: 'short' });
}

function MiniLeaderboard({ title, rows, valueKey, icon: Icon, colorClass, bgClass }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3 mb-3">
        <div className={`p-1.5 rounded-lg ${bgClass} ${colorClass}`}>
          <Icon size={18} />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-3">
        {!rows || rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-2">ไม่มีข้อมูล</p>
        ) : (
          rows.map((row, i) => (
            <div key={row.user.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500 font-mono w-4 text-right">{i + 1}.</span>
                <span className="text-slate-200">{getUserDisplayName(row.user)}</span>
              </div>
              <span className={`font-bold ${colorClass}`}>{row[valueKey]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi.dashboard()
      .then((res) => setStats(res.data))
      .catch(() => toast.error('โหลดสถิติไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const { summary, todaySummary, recentActivities, dailyTrend, userStats } = stats || {};

  const dateFrom = userStats?.dateFrom ? formatDateShort(userStats.dateFrom) : '';
  const dateTo = userStats?.dateTo ? formatDateShort(userStats.dateTo) : '';
  const weekRange = `${dateFrom} - ${dateTo}`;

  const attendanceRate = summary?.total > 0
    ? Math.round((summary.present / summary.total) * 100)
    : 0;

  // Format chart data
  const chartData = (dailyTrend || []).map(d => ({
    name: formatDayName(d.date),
    มา: d.present,
    ขาด: d.absent,
    ลา: d.leave
  }));

  return (
    <section className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mt-1">
            สถิติประจำสัปดาห์: {weekRange}
          </p>
        </div>
        <Link
          to="/admin/attendance"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <CalendarDays size={16} />
          เช็คชื่อรายวัน
        </Link>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
          <p className="text-slate-400 text-xs mb-1">สมาชิกทั้งหมด</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-white">{summary?.totalMembers || 0}</span>
            <Users size={20} className="text-slate-500" />
          </div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-emerald-400/80 text-xs mb-1">มาวันนี้</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-emerald-400">{todaySummary?.present || 0}</span>
            <CheckCircle2 size={20} className="text-emerald-500/50" />
          </div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-red-400/80 text-xs mb-1">ขาดวันนี้</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-red-400">{todaySummary?.absent || 0}</span>
            <XCircle size={20} className="text-red-500/50" />
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-amber-400/80 text-xs mb-1">ลาวันนี้</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-amber-400">{todaySummary?.leave || 0}</span>
            <Clock size={20} className="text-amber-500/50" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <section className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-indigo-400" size={20} />
            <h3 className="font-semibold text-white">สถิติการมารายวัน (สัปดาห์นี้)</h3>
          </div>
          <div className="h-72 w-full text-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ fontSize: '13px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                <Bar dataKey="มา" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="ลา" stackId="a" fill="#f59e0b" />
                <Bar dataKey="ขาด" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg flex flex-col">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
            <Activity className="text-indigo-400" size={20} />
            <h3 className="font-semibold text-white">ความเคลื่อนไหวล่าสุด</h3>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[280px] custom-scrollbar">
            {!recentActivities?.length ? (
              <p className="text-slate-500 text-sm text-center py-4">ไม่มีประวัติ</p>
            ) : (
              recentActivities.map((log) => (
                <div key={log.id} className="flex gap-3 text-sm">
                  <div className="mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
                  </div>
                  <div>
                    <p className="text-slate-300">
                      <span className="font-medium text-white">{getUserDisplayName(log.user)}</span>{' '}
                      {actionLabels[log.action] || log.action}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(log.createdAt).toLocaleString('th-TH')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <MiniLeaderboard
          title="มาบ่อยที่สุดในสัปดาห์นี้"
          rows={userStats?.topPresent}
          valueKey="present"
          icon={CheckCircle2}
          colorClass="text-emerald-400"
          bgClass="bg-emerald-500/10"
        />
        <MiniLeaderboard
          title="ขาดบ่อยที่สุดในสัปดาห์นี้"
          rows={userStats?.topAbsent}
          valueKey="absent"
          icon={XCircle}
          colorClass="text-red-400"
          bgClass="bg-red-500/10"
        />
      </div>

      {/* Main Weekly Table */}
      <section className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden shadow-lg">
        <div className="border-b border-slate-800 bg-slate-800/50 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-white">ตารางสรุปรายบุคคล (สัปดาห์นี้)</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          {!userStats?.stats?.length ? (
            <p className="py-10 text-center text-slate-500">ไม่มีข้อมูลผู้ใช้ในระบบ</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/30 text-left text-slate-400">
                  <th className="px-5 py-3 font-medium w-16">#</th>
                  <th className="px-5 py-3 font-medium">ชื่อ-นามสกุล</th>
                  <th className="px-5 py-3 font-medium">หมายเลข</th>
                  <th className="px-5 py-3 font-medium text-center border-l border-slate-700">มา (ครั้ง)</th>
                  <th className="px-5 py-3 font-medium text-center border-l border-slate-700">ขาด (ครั้ง)</th>
                  <th className="px-5 py-3 font-medium text-center border-l border-slate-700">ลา (ครั้ง)</th>
                  <th className="px-5 py-3 font-medium text-center border-l border-slate-700">อัตราการมา</th>
                </tr>
              </thead>
              <tbody>
                {userStats.stats.map((row, i) => (
                  <tr key={row.user.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-5 py-3 text-white font-medium">{getUserDisplayName(row.user)}</td>
                    <td className="px-5 py-3 font-mono text-slate-400">{row.user.number}</td>
                    <td className="px-5 py-3 text-center border-l border-slate-700">
                      <span className="inline-block min-w-[32px] rounded-md bg-emerald-500/10 px-2 py-1 font-bold text-emerald-400">
                        {row.present}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center border-l border-slate-700">
                      <span className="inline-block min-w-[32px] rounded-md bg-red-500/10 px-2 py-1 font-bold text-red-400">
                        {row.absent}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center border-l border-slate-700">
                      <span className="inline-block min-w-[32px] rounded-md bg-amber-500/10 px-2 py-1 font-bold text-amber-400">
                        {row.leave}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center border-l border-slate-700">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-8 text-right text-xs font-medium text-indigo-300">
                          {row.total > 0 ? Math.round((row.present / row.total) * 100) : 0}%
                        </span>
                        <div className="h-2 w-16 rounded-full bg-slate-800 overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${row.total > 0 ? (row.present / row.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </section>
  );
}
