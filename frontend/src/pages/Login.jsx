import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';

export default function Login() {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDiscordLogin = async () => {
    setDiscordLoading(true);
    try {
      const { data } = await authApi.getDiscordUrl();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error('ไม่สามารถเชื่อมต่อระบบ Discord ได้ในขณะนี้');
      setDiscordLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const user = await login(username, password);
      toast.success(`ยินดีต้อนรับ ${user.icName || user.username}`);
      navigate('/admin', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-indigo-600/20 shadow-lg shadow-indigo-500/20">
            <img
              src="/DissHunter_LOGO8.png"
              alt="DissHunter Gang Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">DissHunter Gang</h1>
          <p className="mt-2 text-slate-400">ระบบเช็คชื่อของแก๊ง</p>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">

          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

          {!showAdminLogin ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-slate-300">ปิดปรับปรุงระบบชั่วคราว</p>
              </div>

              <button
                onClick={handleDiscordLogin}
                disabled={discordLoading}
                className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-4 py-4 font-semibold text-white transition-all hover:bg-[#4752C4] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {discordLoading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <svg className="w-6 h-6 fill-white" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a67.55,67.55,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.2,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                )}
                {discordLoading ? 'กำลังพาไปที่หน้า Discord...' : 'Login with Discord'}
              </button>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAdminLogin(true)}
                  className="text-sm text-slate-500 hover:text-indigo-400 transition-colors flex items-center justify-center gap-1 mx-auto"
                >
                  <ShieldAlert size={14} /> แอดมินล็อคอิน
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">แอดมินเข้าระบบ</h2>
                <button
                  onClick={() => setShowAdminLogin(false)}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  กลับไปใช้ Discord
                </button>
              </div>

              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-400">ชื่อผู้ใช้ (Admin)</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 transition-all focus:border-indigo-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Admin Username"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm text-slate-400">รหัสผ่าน</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:border-indigo-500 focus:bg-slate-800 focus:outline-none"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading || !username.trim() || !password.trim()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-medium text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      เข้าสู่ระบบแอดมิน
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer info (Jxff credit + contact) */}
        <div className="mt-8 text-center text-xs text-slate-500 space-y-2">
          <p>
            ติดต่อสอบถาม / พบปัญหาการใช้งาน
            <br />
            Discord:{" "}
            <a
              href="https://discord.gg/GQsNVYPfn6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 font-medium hover:text-indigo-400 transition-colors"
            >
              @DissHunter
            </a>
          </p>
          <div className="w-12 h-px bg-slate-800 mx-auto my-2"></div>
          <p>developed by <span className="font-semibold text-indigo-400">Jxff</span></p>
        </div>
      </div>
    </div>
  );
}
