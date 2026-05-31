import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Calendar, FileText, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { leaveApi } from '../api/client';
import { useSlots } from '../hooks/useSlots';
import { useAuth } from '../context/AuthContext';
import { getUserDisplayName } from '../utils/userDisplay';
import DateInput from '../components/DateInput';

function getLocalDateInputValue(targetDate = new Date()) {
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function LeaveForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { leaveSlots, loading: slotsLoading } = useSlots();
  const today = getLocalDateInputValue();
  const [leaveDate, setLeaveDate] = useState(today);
  const [endDate, setEndDate] = useState('');

  // Options for slots
  const [isFullDay, setIsFullDay] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);

  const [slotReasons, setSlotReasons] = useState({});
  const [fullDayReason, setFullDayReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Track existing leave slots on selected date
  const [takenSlots, setTakenSlots] = useState([]);
  const [existingLeaveType, setExistingLeaveType] = useState(null);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const { data } = await leaveApi.list({ dateFrom: leaveDate, dateTo: leaveDate });
        const records = data.data || [];
        if (records.length > 0) {
          const existing = records[0];
          setExistingLeaveType(existing.leaveType);
          if (existing.leaveType === 'partial' && existing.leaveTimeSlot) {
            setTakenSlots(existing.leaveTimeSlot.split(','));
          } else if (existing.leaveType === 'full_day') {
            setTakenSlots(['__full_day__']);
          } else {
            setTakenSlots([]);
          }
        } else {
          setTakenSlots([]);
          setExistingLeaveType(null);
        }
      } catch {
        setTakenSlots([]);
        setExistingLeaveType(null);
      }
    };

    // Only fetch for single-day leave (not range)
    if (!endDate) {
      fetchExisting();
    } else {
      setTakenSlots([]);
      setExistingLeaveType(null);
    }
  }, [leaveDate, endDate]);

  const inputClass =
    'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none';

  const toggleSlot = (slot) => {
    if (takenSlots.includes(slot)) return; // block already-taken slots
    setSelectedSlots(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = new Date(leaveDate);
    if (Number.isNaN(parsed.getTime())) {
      toast.error('วันที่ไม่ถูกต้อง');
      return;
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (Number.isNaN(parsedEnd.getTime()) || parsedEnd < parsed) {
        toast.error('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา');
        return;
      }
    }

    if (!isFullDay && selectedSlots.length === 0) {
      toast.error('กรุณาเลือกช่วงเวลาที่ต้องการลาอย่างน้อย 1 ช่วงเวลา');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('leaveDate', leaveDate);
      if (endDate) formData.append('endDate', endDate);
      formData.append('leaveType', isFullDay ? 'full_day' : 'partial');

      if (!isFullDay) {
        // Send as comma separated string
        formData.append('leaveTimeSlot', selectedSlots.join(','));
      }

      let finalReason = '';
      if (isFullDay) {
        if (fullDayReason.trim()) finalReason = fullDayReason.trim();
      } else {
        const activeReasons = {};
        selectedSlots.forEach(s => {
          if (slotReasons[s] && slotReasons[s].trim()) {
            activeReasons[s] = slotReasons[s].trim();
          }
        });
        if (Object.keys(activeReasons).length > 0) {
          finalReason = JSON.stringify(activeReasons);
        }
      }

      if (finalReason) formData.append('reason', finalReason);

      await leaveApi.create(formData);
      toast.success('บันทึกการลาสำเร็จ');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกการลาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="mx-auto max-w-xl">
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div className="flex items-center gap-2">
            <FileText className="text-indigo-400" size={22} />
            <h2 className="text-lg font-semibold text-white">แจ้งลากิจกรรม</h2>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
            <User size={14} className="text-indigo-400" />
            <span className="text-xs font-medium text-indigo-300">{getUserDisplayName(user)}</span>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm text-slate-300">
                <Calendar size={16} />
                เลือกวันที่ลา
              </span>
              <DateInput
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                className={inputClass}
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm text-slate-300">
                <Calendar size={16} className="text-slate-500" />
                ถึงวันที่ (ถ้ามี)
              </span>
              <DateInput
                value={endDate}
                min={leaveDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="block">
            <span className="mb-1.5 block text-sm text-slate-300">ช่วงเวลาลา</span>

            <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <label className={`flex items-center gap-3 ${existingLeaveType === 'partial' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={isFullDay}
                  disabled={existingLeaveType === 'partial'}
                  onChange={(e) => {
                    setIsFullDay(e.target.checked);
                    if (e.target.checked) setSelectedSlots([]);
                  }}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-600 focus:ring-indigo-600"
                />
                <span className="text-slate-200">ลาทั้งวัน</span>
                {existingLeaveType === 'partial' && (
                  <span className="text-xs text-amber-400">(มีลาบางช่วงเวลาแล้ว)</span>
                )}
              </label>

              <div className={`pl-7 pt-2 grid grid-cols-2 gap-3 border-t border-slate-700 mt-2 transition-opacity ${isFullDay ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {slotsLoading ? (
                  <span className="text-slate-400 text-sm">กำลังโหลด...</span>
                ) : (
                  leaveSlots.map((slot) => {
                    const isTaken = takenSlots.includes(slot);
                    return (
                      <label
                        key={slot}
                        className={`flex items-center gap-2 text-sm ${isTaken ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        title={isTaken ? `ลาช่วงเวลา ${slot} ไปแล้ว` : ''}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSlots.includes(slot)}
                          disabled={isTaken}
                          onChange={() => toggleSlot(slot)}
                          className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-600 focus:ring-indigo-500"
                        />
                        <span className={isTaken ? 'text-slate-500 line-through' : 'text-slate-300'}>
                          {slot}
                        </span>
                        {isTaken && <span className="text-xs text-amber-400/80 ml-1">ลาแล้ว</span>}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="min-h-[104px]">
            {!isFullDay && selectedSlots.length > 0 ? (
              <div className="space-y-4">
                <span className="block text-sm text-slate-300">หมายเหตุแยกตามช่วงเวลา</span>
                {selectedSlots.map(slot => (
                  <label key={slot} className="block">
                    <span className="mb-1 block text-xs text-slate-400">เหตุผลที่ลาเวลา {slot} น.</span>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="ระบุเหตุผล..."
                      value={slotReasons[slot] || ''}
                      onChange={(e) => setSlotReasons({ ...slotReasons, [slot]: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">หมายเหตุ</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="ระบุเหตุผล..."
                  value={fullDayReason}
                  onChange={(e) => setFullDayReason(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </label>
            )}
          </div>

          <footer className="flex justify-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
              {loading ? 'กำลังบันทึก...' : 'บันทึกการลา'}
            </button>
          </footer>
        </form>
      </section>
    </article>
  );
}
