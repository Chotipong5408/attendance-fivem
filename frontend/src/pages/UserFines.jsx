import { useState, useEffect, useCallback } from 'react';
import { DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { finesApi } from '../api/client';
import Loading from '../components/Loading';

export default function UserFines() {
  const [loading, setLoading] = useState(true);
  const [fines, setFines] = useState({ totalAmount: 0, details: [] });

  const fetchFines = useCallback(async () => {
    try {
      const { data } = await finesApi.list();
      // data is an array for admin, but for user it should return array of length 1 or 0
      if (data && data.length > 0) {
        setFines(data[0]);
      } else {
        setFines({ totalAmount: 0, details: [] });
      }
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูลค่าปรับได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFines();
  }, [fetchFines]);

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-red-500/20 p-2 text-red-400">
          <DollarSign size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">ยอดค้างชำระค่าปรับ</h1>
          <p className="text-sm text-slate-400">รายการค่าปรับจากการขาดหรือลาเกินโควต้า</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden relative shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>

        <div className="p-8 text-center border-b border-slate-800 bg-slate-800/30">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-2">ยอดค่าปรับรวม</p>
          <div className="text-5xl font-black text-red-500 drop-shadow-sm">
            ฿{fines.totalAmount.toLocaleString()}
          </div>
          {fines.totalAmount > 0 ? (
            <p className="mt-4 text-sm text-slate-400">กรุณาติดต่อเพื่อชำระค่าปรับในเมือง (IC)</p>
          ) : (
            <p className="mt-4 text-sm text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> ไม่มีค่าปรับค้างชำระ ยอดเยี่ยมมาก!
            </p>
          )}
        </div>

        {fines.details.length > 0 && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-white mb-4">รายละเอียดบิลค่าปรับ ({fines.details.length} รายการ)</h3>
            <div className="space-y-3">
              {fines.details.map((detail) => {
                // Parse absent fine reason: "ขาดเช็คชื่อ X รอบ (รอบ 19:30, 20:00)"
                const absentMatch = detail.reason.match(/ขาดเช็คชื่อ (\d+) รอบ(?:\s*\(รอบ\s*(.+?)\))?/);
                // Parse excess leave reason: "ลาเกินโควต้า (X รอบ)"
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
                  <div key={detail.id} className="flex items-center justify-between rounded-xl bg-slate-800 p-4 border border-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-red-400">
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{title}</p>
                        {times && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-slate-400 mr-1">ช่วงเวลาที่ขาด:</span>
                            {times.map(t => (
                              <span key={t} className="inline-block rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-400 border border-red-500/20">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-sm text-slate-400 mt-1.5">
                          วันที่: {new Date(detail.date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block rounded-lg bg-red-500/10 px-3 py-1 font-bold text-red-400">
                        ฿{detail.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
