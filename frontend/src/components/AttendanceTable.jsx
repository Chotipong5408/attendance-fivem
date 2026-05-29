import { CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { getUserDisplayName } from '../utils/userDisplay';
import { leaveApi } from '../api/client';
import { useSlots } from '../hooks/useSlots';
import { formatReason } from '../utils/formatReason';

import Swal from 'sweetalert2';

function parseTimeSlots(ts) {
  if (!ts) return {};
  if (typeof ts === 'object') return ts;
  try { return JSON.parse(ts); } catch { return {}; }
}

function getEffectiveSlot(slots, leave, slotKey) {
  const fromDb = slots[slotKey];
  if (fromDb === 'absent') return 'absent';
  if (leave) {
    if (leave.leaveType === 'full_day') return 'leave';
    if (leave.leaveType === 'partial' && leave.leaveTimeSlot && leave.leaveTimeSlot.includes(slotKey)) return 'leave';
  }
  return fromDb || 'present';
}

function SlotBadge({ status }) {
  if (status === 'present') return <span className="inline-flex items-center justify-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20 w-14"><CheckCircle2 size={12} className="mr-1"/> มา</span>;
  if (status === 'absent') return <span className="inline-flex items-center justify-center rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 border border-red-500/20 w-14"><XCircle size={12} className="mr-1"/> ขาด</span>;
  if (status === 'leave') return <span className="inline-flex items-center justify-center rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 border border-amber-500/20 w-14"><Clock size={12} className="mr-1"/> ลา</span>;
  return <span className="text-slate-600">-</span>;
}

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

export default function AttendanceTable({ records, loading, showUser = false, onLeaveCancelled = null }) {
  const { attendanceSlots, loading: slotsLoading } = useSlots();

  if (loading || slotsLoading) return <Loading />;

  if (!records?.length) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
        ไม่มีข้อมูล
      </div>
    );
  }

  const handleCancelLeave = async (leaveId) => {
    const result = await Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: "ที่จะยกเลิกการลานี้",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#475569',
      confirmButtonText: 'ใช่, ยกเลิกการลา',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#fff',
    });
    if (!result.isConfirmed) return;
    
    try {
      await leaveApi.delete(leaveId);
      toast.success('ยกเลิกการลาสำเร็จ');
      if (onLeaveCancelled) onLeaveCancelled();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ยกเลิกการลาไม่สำเร็จ');
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/80 text-left text-slate-400">
            <th className="px-4 py-3 font-medium">วันที่</th>
            {showUser && (
              <>
                <th className="px-4 py-3 font-medium">ผู้ใช้</th>
                <th className="px-4 py-3 font-medium">หมายเลข</th>
              </>
            )}
            {attendanceSlots.map(slot => (
              <th key={slot} className="px-3 py-3 font-medium text-center border-l border-slate-700">
                {slot}
              </th>
            ))}
            <th className="px-4 py-3 font-medium border-l border-slate-700">หมายเหตุ</th>
            {!!onLeaveCancelled && <th className="px-4 py-3 font-medium border-l border-slate-700 text-center">จัดการ</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const slots = parseTimeSlots(r.timeSlots);
            const isFutureOrToday = new Date(r.attendanceDate).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0);
            return (
              <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 text-slate-300">
                  {new Date(r.attendanceDate || r.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                {showUser && (
                  <>
                    <td className="px-4 py-3 text-white font-medium">
                      {getUserDisplayName(r.user)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {r.user?.number}
                    </td>
                  </>
                )}
                {attendanceSlots.map(slot => (
                  <td key={slot} className="px-3 py-3 text-center border-l border-slate-700">
                    <SlotBadge status={getEffectiveSlot(slots, r.leave, slot)} />
                  </td>
                ))}
                <td className="px-4 py-3 border-l border-slate-700 align-top">
                  <NoteCell text={formatReason(r.leave?.reason || r.note)} />
                </td>
                {!!onLeaveCancelled && (
                  <td className="px-4 py-3 text-center border-l border-slate-700">
                    {r.leave && isFutureOrToday ? (
                      <button 
                        onClick={() => handleCancelLeave(r.leave.id)}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600/80 hover:bg-red-500 transition-colors"
                      >
                        ยกเลิกลา
                      </button>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
