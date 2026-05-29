import { useState, useEffect, useCallback } from 'react';
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { finesApi } from '../api/client';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import { getUserDisplayName } from '../utils/userDisplay';

export default function AdminFines() {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [paying, setPaying] = useState(false);

  const fetchFines = useCallback(async () => {
    try {
      const { data } = await finesApi.list();
      // data is an array of { user, totalAmount, details: [] }
      setFines(data);
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูลค่าปรับได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFines();
  }, [fetchFines]);

  const handlePay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await finesApi.pay(payTarget.user.id);
      toast.success('ชำระเงินและล้างยอดเรียบร้อยแล้ว');
      setPayTarget(null);
      await fetchFines();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ทำรายการไม่สำเร็จ');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <Loading />;

  const totalOwed = fines.reduce((sum, f) => sum + f.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">จัดการค่าปรับ</h1>
          <p className="text-sm text-slate-400">ดูยอดค้างชำระและเคลียร์ยอดค่าปรับของสมาชิก</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-4 border border-slate-700">
          <div className="rounded-lg bg-red-500/20 p-2 text-red-400">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400">ยอดค้างชำระรวม</p>
            <p className="text-xl font-bold text-white">฿{totalOwed.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {fines.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
            <CheckCircle size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">ไม่มีค่าปรับค้างชำระ</h3>
          <p className="text-slate-400">สมาชิกทุกคนชำระค่าปรับเรียบร้อยแล้ว หรือยังไม่มีใครโดนปรับ</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fines.map((item) => (
            <div key={item.user.id} className="rounded-xl border border-red-500/30 bg-slate-900 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium text-white">{getUserDisplayName(item.user)}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{item.user.number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">ยอดค้างชำระ</p>
                  <p className="text-lg font-bold text-red-400">฿{item.totalAmount.toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">รายละเอียด ({item.details.length} รายการ)</p>
                <div className="max-h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {item.details.map((detail) => {
                    const absentMatch = detail.reason.match(/ขาดเช็คชื่อ (\d+) รอบ(?:\s*\(รอบ\s*(.+?)\))?/);
                    const leaveMatch = detail.reason.match(/ลาเกินโควต้า \((\d+) รอบ\)/);

                    let title = detail.reason;
                    let times = null;

                    if (absentMatch) {
                      title = `ขาดกิจกรรม ${absentMatch[1]} รอบ`;
                      times = absentMatch[2] ? absentMatch[2].split(',').map(t => t.trim()) : null;
                    } else if (leaveMatch) {
                      title = `ลาเกินโควต้า ${leaveMatch[1]} รอบ`;
                    }

                    return (
                      <div key={detail.id} className="flex flex-col rounded bg-slate-800 p-2 text-sm gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={14} className="text-red-400 shrink-0" />
                            <span className="text-slate-300 font-medium truncate" title={title}>{title}</span>
                          </div>
                          <span className="text-slate-400 shrink-0 text-xs">{new Date(detail.date).toLocaleDateString('th-TH')}</span>
                        </div>
                        {times && (
                          <div className="ml-5 flex flex-wrap gap-1">
                            {times.map(t => (
                              <span key={t} className="rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-400 border border-red-500/20">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setPayTarget(item)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 px-4 py-2 text-sm font-medium transition-colors"
              >
                <CheckCircle size={16} />
                ชำระเงินแล้ว (เคลียร์ยอด)
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title="ยืนยันการชำระเงิน" size="sm">
        <div className="text-slate-300 space-y-4">
          <p>
            คุณต้องการยืนยันว่า <strong className="text-white">{payTarget && getUserDisplayName(payTarget.user)}</strong> ได้ชำระค่าปรับจำนวน <strong className="text-red-400 font-bold">฿{payTarget?.totalAmount.toLocaleString()}</strong> เรียบร้อยแล้วใช่หรือไม่?
          </p>
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            * การกดปุ่มนี้จะล้างยอดค่าปรับทั้งหมดที่ค้างอยู่ของสมาชิกคนนี้ให้กลายเป็น 0
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setPayTarget(null)} className="px-4 py-2 text-slate-400 hover:text-white">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={paying}
            onClick={handlePay}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {paying ? 'กำลังดำเนินการ...' : 'ยืนยันชำระเงิน'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
