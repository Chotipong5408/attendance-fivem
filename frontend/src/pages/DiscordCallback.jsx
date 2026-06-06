import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { UserCircle2, Loader2, CheckCircle } from 'lucide-react';

function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const hasCalled = React.useRef(false);

  // IC Name form state
  const [showIcNameForm, setShowIcNameForm] = useState(false);
  const [icName, setIcName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    if (hasCalled.current) return;

    const code = searchParams.get('code');
    if (!code) {
      setError('ไม่พบรหัสยืนยันจาก Discord');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    const authenticate = async () => {
      hasCalled.current = true;
      try {
        const res = await authApi.discordCallback(code);
        const { token, user, needsIcName } = res.data;

        if (needsIcName) {
          // Store token temporarily so the setIcName API call works (needs auth)
          localStorage.setItem('token', token);
          setPendingToken(token);
          setPendingUser(user);
          setShowIcNameForm(true);
        } else {
          // User already has IC name, go straight in
          login(token, user);
          navigate('/');
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Discord');
        setTimeout(() => navigate('/login'), 5000);
      }
    };

    authenticate();
  }, [searchParams, navigate, login]);

  const handleIcNameSubmit = async (e) => {
    e.preventDefault();
    if (!icName.trim() || icName.trim().length < 2) return;

    setSubmitting(true);
    try {
      const res = await authApi.setIcName(icName.trim());
      const updatedUser = res.data.user;
      // Now login with the updated user data
      login(pendingToken, updatedUser);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'ไม่สามารถบันทึกชื่อได้');
      setSubmitting(false);
    }
  };

  // IC Name form
  if (showIcNameForm) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* User avatar & info */}
          <div className="text-center mb-6">
            {pendingUser?.avatar ? (
              <img
                src={pendingUser.avatar}
                alt="avatar"
                className="w-20 h-20 rounded-full mx-auto mb-3 border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-indigo-500/20 flex items-center justify-center">
                <UserCircle2 size={40} className="text-indigo-400" />
              </div>
            )}
            <p className="text-slate-400 text-sm">
              ล็อคอินสำเร็จในชื่อ Discord: <span className="text-white font-medium">{pendingUser?.username}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-500"></div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">กรอกชื่อ IC ของคุณ</h2>
              <p className="text-slate-400 text-sm">กรุณากรอกชื่อตัวละครในเกม (IC Name) เพื่อเข้าสู่ระบบเช็คชื่อ</p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleIcNameSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">ชื่อ IC (ชื่อในเกม)</span>
                <input
                  type="text"
                  required
                  autoFocus
                  minLength={2}
                  maxLength={50}
                  value={icName}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^A-Za-z\s]/g, '');
                    val = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    setIcName(val);
                    setError('');
                  }}
                  placeholder="เช่น Somchai Naree"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-white placeholder-slate-500 transition-all focus:border-indigo-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-lg"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || icName.trim().length < 2}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-semibold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    ยืนยันและเข้าสู่ระบบ
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-xl max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-2">เข้าสู่ระบบไม่สำเร็จ</h2>
          <p>{error}</p>
          <p className="text-sm mt-4 text-gray-400">กำลังพากลับหน้าเข้าสู่ระบบ...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-bold text-white">กำลังตรวจสอบข้อมูล Discord...</h2>
          <p className="text-gray-400 mt-2">กรุณารอสักครู่ ระบบกำลังเชื่อมต่อบัญชีของคุณ</p>
        </div>
      )}
    </div>
  );
}

export default DiscordCallback;
