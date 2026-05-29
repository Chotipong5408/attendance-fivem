import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Modal from './Modal';

const emptyForm = { icName: '', number: '', password: '', role: 'user' };

export default function UserFormModal({ open, onClose, onSubmit, user, loading }) {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        icName: user.icName || user.username || '',
        number: user.number || '',
        password: '',
        role: user.role,
      });
    } else {
      setForm(emptyForm);
    }
    setShowPassword(false);
  }, [user, open]);

  const inputClass =
    'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none';

  return (
    <Modal open={open} onClose={onClose} title={user ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = { ...form };
          // Don't send empty password on edit
          if (user && !data.password) delete data.password;
          onSubmit(data);
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">IC Name (ชื่อผู้ใช้)</span>
          <input
            required
            placeholder="ชื่อในเกม"
            value={form.icName}
            onChange={(e) => setForm({ ...form, icName: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">หมายเลข </span>
          <input
            required={!user}
            placeholder={user ? "เช่น 001 (เว้นว่างได้)" : "เช่น 001"}
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">
            รหัสผ่าน{user ? ' (เว้นว่างถ้าไม่ต้องการเปลี่ยน)' : ''}
          </span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required={!user}
              minLength={4}
              placeholder={user ? 'ใส่เพื่อเปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่าน (อย่างน้อย 4 ตัว)'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <span className="mt-1 block text-xs text-slate-500">
            ผู้ใช้จะล็อกอินด้วยรหัสผ่านนี้เท่านั้น — ต้องไม่ซ้ำกับผู้ใช้อื่น
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">Role</span>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={inputClass}
          >
            <option value="user">User</option>
            <option value="head">Head</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <footer className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-400 hover:text-white">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
