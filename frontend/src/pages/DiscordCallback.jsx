import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const hasCalled = React.useRef(false);

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
        // Login with token and user data
        login(res.data.token, res.data.user);
        navigate('/');
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Discord');
        setTimeout(() => navigate('/login'), 5000);
      }
    };

    authenticate();
  }, [searchParams, navigate, login]);

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
