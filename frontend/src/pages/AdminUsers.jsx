import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../api/client';
import UserFormModal from '../components/UserFormModal';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import { getUserDisplayName } from '../utils/userDisplay';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const { data } = await usersApi.list(params);
      setUsers(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('โหลดรายชื่อผู้ใช้ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      if (editUser) {
        await usersApi.update(editUser.id, formData);
        toast.success('อัปเดตผู้ใช้สำเร็จ');
      } else {
        await usersApi.create(formData);
        toast.success('เพิ่มผู้ใช้สำเร็จ');
      }
      setModalOpen(false);
      setEditUser(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget.id);
      toast.success('ลบผู้ใช้สำเร็จ');
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setEditUser(null);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="ค้นหา IC Name หรือ Number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus size={18} />
          เพิ่มผู้ใช้
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
          ไม่พบผู้ใช้
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50 text-left text-slate-400">
                <th className="px-4 py-3">IC Name</th>
                <th className="px-4 py-3">หมายเลข</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">สมัครเมื่อ</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-white">{getUserDisplayName(user)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{user.number}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${user.role === 'admin'
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-slate-500/20 text-slate-300'
                        }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(user.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-indigo-400"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
          <p className="text-sm text-slate-400">
            หน้า {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              ก่อนหน้า
            </button>
            <button
              type="button"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              ถัดไป
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <UserFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditUser(null);
        }}
        onSubmit={handleSubmit}
        user={editUser}
        loading={saving}
      />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="ยืนยันการลบ" size="sm">
        <p className="text-slate-300">
          ลบผู้ใช้ <strong className="text-white">{getUserDisplayName(deleteTarget)}</strong> ?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-slate-400 hover:text-white">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
          >
            {deleting ? 'กำลังลบ...' : 'ลบ'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
