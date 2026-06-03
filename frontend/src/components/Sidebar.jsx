import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  History,
  Users,
  Activity,
  LogOut,
  Menu,
  X,
  Settings,
  DollarSign
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserDisplayName } from '../utils/userDisplay';

const userLinks = [
  { to: '/leave', icon: FileText, label: 'แจ้งลา' },
  { to: '/history', icon: History, label: 'ประวัติเช็คชื่อ' },
  { to: '/fines', icon: DollarSign, label: 'สรุปยอดค่าปรับ' },
];

const managerLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Admin Dashboard' },
  { to: '/admin/attendance', icon: CalendarCheck, label: 'รายการเช็คชื่อ' },
  { to: '/admin/fines', icon: DollarSign, label: 'จัดการค่าปรับ' },
];

const adminLinks = [
  { to: '/admin/users', icon: Users, label: 'จัดการผู้ใช้' },
  { to: '/admin/activity', icon: Activity, label: 'Activity Logs' },
  { to: '/admin/settings', icon: Settings, label: 'ตั้งค่าระบบ' },
];

export default function Sidebar() {
  const { user, logout, isAdmin, isHead } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  let links = [];
  if (isAdmin) {
    links = [...managerLinks, ...adminLinks];
  } else if (isHead) {
    links = [...userLinks, ...managerLinks];
  } else {
    links = [...userLinks];
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navContent = (
    <>
      <div className="border-b border-slate-700 px-6 py-5">
        <h1 className="text-lg font-bold text-indigo-400">DissHunter Gang</h1>
        <div className="mt-4 flex items-center gap-3">
          {user?.avatar ? (
            <img src={user.avatar} alt="Avatar" className="h-10 w-10 rounded-full border border-slate-600 object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700">
              <span className="text-sm font-medium text-slate-300">
                {getUserDisplayName(user)?.charAt(0)?.toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-200">{getUserDisplayName(user)}</p>
            <span className="inline-block rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
              {user?.role === 'admin' ? 'Admin' : user?.role === 'head' ? 'Head' : 'User'}
            </span>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard' || to === '/admin'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-700 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
        >
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 rounded-lg bg-slate-800 p-2 lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-700 bg-slate-900 lg:flex">
        {navContent}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} role="presentation" />
          <aside className="relative flex h-full w-64 flex-col bg-slate-900">
            <button type="button" className="absolute right-4 top-4 text-slate-400" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
