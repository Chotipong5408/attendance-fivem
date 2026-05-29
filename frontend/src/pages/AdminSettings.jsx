import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Save, Pencil, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi } from '../api/client';
import Loading from '../components/Loading';
import Swal from 'sweetalert2';
export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [attendanceSlots, setAttendanceSlots] = useState([]);
  const [leaveSlots, setLeaveSlots] = useState([]);

  const [newAttSlot, setNewAttSlot] = useState('');
  const [newLeaveSlot, setNewLeaveSlot] = useState('');

  const [absentFine, setAbsentFine] = useState(50000);
  const [excessLeaveFine, setExcessLeaveFine] = useState(50000);
  const [maxLeavesPerWeek, setMaxLeavesPerWeek] = useState(4);

  const [editingAttSlot, setEditingAttSlot] = useState({ oldVal: '', newVal: '' });
  const [editingLeaveSlot, setEditingLeaveSlot] = useState({ oldVal: '', newVal: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await settingsApi.getSlots();
      setAttendanceSlots(data.attendanceSlots || []);
      setLeaveSlots(data.leaveSlots || []);
      setAbsentFine(data.absentFine || 50000);
      setExcessLeaveFine(data.excessLeaveFine || 50000);
      setMaxLeavesPerWeek(data.maxLeavesPerWeek || 4);
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูลการตั้งค่าได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.updateSlots({
        attendanceSlots,
        leaveSlots,
        absentFine: Number(absentFine),
        excessLeaveFine: Number(excessLeaveFine),
        maxLeavesPerWeek: Number(maxLeavesPerWeek)
      });
      toast.success('บันทึกการตั้งค่าเวลาและค่าปรับสำเร็จ');
    } catch (err) {
      toast.error('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // --- Attendance Slots Handlers ---
  const addAttSlot = () => {
    if (!newAttSlot.trim() || !newAttSlot.includes(':')) {
      return toast.error('กรุณากรอกเวลาให้ถูกต้อง (เช่น 19:30)');
    }
    if (attendanceSlots.includes(newAttSlot)) return toast.error('มีเวลานี้อยู่แล้ว');

    const newArr = [...attendanceSlots, newAttSlot].sort();
    setAttendanceSlots(newArr);
    setNewAttSlot('');
  };

  const removeAttSlot = async (slot) => {
    const result = await Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: `ที่จะลบคอลัมน์เวลา ${slot}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#475569',
      confirmButtonText: 'ใช่, ลบเลย',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#fff',
    });
    if (result.isConfirmed) {
      setAttendanceSlots(attendanceSlots.filter(s => s !== slot));
    }
  };

  const saveEditAttSlot = () => {
    const { oldVal, newVal } = editingAttSlot;
    if (!newVal.trim() || !newVal.includes(':')) {
      return toast.error('กรุณากรอกเวลาให้ถูกต้อง (เช่น 19:30)');
    }
    if (newVal !== oldVal && attendanceSlots.includes(newVal)) {
      return toast.error('มีเวลานี้อยู่แล้ว');
    }

    const newArr = attendanceSlots.map(s => s === oldVal ? newVal : s).sort();
    setAttendanceSlots(newArr);
    setEditingAttSlot({ oldVal: '', newVal: '' });
  };

  // --- Leave Slots Handlers ---
  const addLeaveSlot = () => {
    if (!newLeaveSlot.trim() || !newLeaveSlot.includes(':')) {
      return toast.error('กรุณากรอกเวลาให้ถูกต้อง (เช่น 19:30)');
    }
    if (leaveSlots.includes(newLeaveSlot)) return toast.error('มีเวลานี้อยู่แล้ว');

    const newArr = [...leaveSlots, newLeaveSlot].sort();
    setLeaveSlots(newArr);
    setNewLeaveSlot('');
  };

  const removeLeaveSlot = async (slot) => {
    const result = await Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: `ที่จะลบเวลาลา ${slot}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#475569',
      confirmButtonText: 'ใช่, ลบเลย',
      cancelButtonText: 'ยกเลิก',
      background: '#1e293b',
      color: '#fff',
    });
    if (result.isConfirmed) {
      setLeaveSlots(leaveSlots.filter(s => s !== slot));
    }
  };

  const saveEditLeaveSlot = () => {
    const { oldVal, newVal } = editingLeaveSlot;
    if (!newVal.trim() || !newVal.includes(':')) {
      return toast.error('กรุณากรอกเวลาให้ถูกต้อง (เช่น 19:30)');
    }
    if (newVal !== oldVal && leaveSlots.includes(newVal)) {
      return toast.error('มีเวลานี้อยู่แล้ว');
    }

    const newArr = leaveSlots.map(s => s === oldVal ? newVal : s).sort();
    setLeaveSlots(newArr);
    setEditingLeaveSlot({ oldVal: '', newVal: '' });
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-slate-400">จัดการข้อมูลและคอลัมน์เวลาในระบบ</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Attendance Slots */}
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400">
              <Clock size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">เวลารอบเช็คชื่อ</h2>
              <p className="text-sm text-slate-400">คอลัมน์ที่จะแสดงในตารางเช็คชื่อ</p>
            </div>
          </div>

          <div className="space-y-4">
            {attendanceSlots.map(slot => (
              <div key={slot} className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3 border border-slate-700">
                {editingAttSlot.oldVal === slot ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editingAttSlot.newVal}
                      onChange={e => setEditingAttSlot({ ...editingAttSlot, newVal: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && saveEditAttSlot()}
                      autoFocus
                      className="flex-1 rounded border border-indigo-500 bg-slate-900 px-2 py-1 text-white focus:outline-none"
                    />
                    <button onClick={saveEditAttSlot} className="text-emerald-400 hover:text-emerald-300 p-1">
                      <Check size={18} />
                    </button>
                    <button onClick={() => setEditingAttSlot({ oldVal: '', newVal: '' })} className="text-slate-500 hover:text-slate-300 p-1">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-slate-200 font-mono">{slot}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingAttSlot({ oldVal: slot, newVal: slot })}
                        className="text-slate-500 hover:text-indigo-400 p-1 rounded transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => removeAttSlot(slot)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="เช่น 20:00"
                value={newAttSlot}
                onChange={e => setNewAttSlot(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addAttSlot()}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={addAttSlot}
                className="rounded-lg bg-slate-700 p-2.5 text-white hover:bg-slate-600"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Leave Slots */}
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
              <Clock size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ตัวเลือกเวลาลา</h2>
              <p className="text-sm text-slate-400">เวลาที่จะแสดงในหน้ายื่นลาของ User</p>
            </div>
          </div>

          <div className="space-y-4">
            {leaveSlots.map(slot => (
              <div key={slot} className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3 border border-slate-700">
                {editingLeaveSlot.oldVal === slot ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editingLeaveSlot.newVal}
                      onChange={e => setEditingLeaveSlot({ ...editingLeaveSlot, newVal: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && saveEditLeaveSlot()}
                      autoFocus
                      className="flex-1 rounded border border-indigo-500 bg-slate-900 px-2 py-1 text-white focus:outline-none"
                    />
                    <button onClick={saveEditLeaveSlot} className="text-emerald-400 hover:text-emerald-300 p-1">
                      <Check size={18} />
                    </button>
                    <button onClick={() => setEditingLeaveSlot({ oldVal: '', newVal: '' })} className="text-slate-500 hover:text-slate-300 p-1">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-slate-200 font-mono">{slot}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingLeaveSlot({ oldVal: slot, newVal: slot })}
                        className="text-slate-500 hover:text-indigo-400 p-1 rounded transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => removeLeaveSlot(slot)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="เช่น 20:30"
                value={newLeaveSlot}
                onChange={e => setNewLeaveSlot(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLeaveSlot()}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={addLeaveSlot}
                className="rounded-lg bg-slate-700 p-2.5 text-white hover:bg-slate-600"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fine Settings */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <div className="rounded-lg bg-red-500/20 p-2 text-red-400">
            <span className="text-xl font-bold">฿</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">ตั้งค่าเงินค่าปรับ (IC)</h2>
            <p className="text-sm text-slate-400">ระบบจะสร้างบิลค่าปรับอัตโนมัติตามยอดที่ตั้งไว้ที่นี่</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">ค่าปรับเมื่อขาดกิจกรรม (ต่อครั้ง/รอบ)</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">฿</span>
              <input
                type="number"
                min="0"
                value={absentFine}
                onChange={e => setAbsentFine(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2.5 pl-8 pr-4 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              ค่าปรับลาเกิน (ต่อครั้งที่เกินโควต้า)
            </span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">฿</span>
              <input
                type="number"
                min="0"
                value={excessLeaveFine}
                onChange={e => setExcessLeaveFine(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2.5 pl-8 pr-4 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-300">โควต้าการลา (ครั้ง/สัปดาห์)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={maxLeavesPerWeek}
                onChange={e => setMaxLeavesPerWeek(e.target.value)}
                className="w-full md:w-1/2 rounded-lg border border-slate-600 bg-slate-800 py-2.5 px-4 text-white focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-slate-400 text-sm">ครั้ง (1 ครั้ง = 1 รอบเช็คชื่อ, ลาทั้งวันนับเท่ากับจำนวนรอบเช็คชื่อ)</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
