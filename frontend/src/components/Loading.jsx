export default function Loading({ fullScreen = false, text = 'กำลังโหลด...' }) {
  const cls = fullScreen
    ? 'min-h-screen flex items-center justify-center bg-slate-950'
    : 'flex items-center justify-center py-12';

  return (
    <div className={cls}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-slate-400">{text}</p>
      </div>
    </div>
  );
}
