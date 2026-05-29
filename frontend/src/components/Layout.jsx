import Sidebar from './Sidebar';

export default function Layout({ children, title }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="border-b border-slate-800 px-6 py-4 lg:pl-6 pl-16">
          {title && <h1 className="text-xl font-semibold text-white">{title}</h1>}
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
