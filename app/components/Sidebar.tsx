import SidebarClient from "@/app/components/SidebarClient";

export default function Sidebar() {
  return (
    <aside className="sidebar-shell flex w-full flex-col lg:w-72 lg:shrink-0">
      <div className="px-6 pt-6">
        <div className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
          Chatbot
        </div>
        <div className="heading-font mt-2 text-xl font-semibold text-slate-100">
          Conversation Hub
        </div>
        <div className="mt-4 h-px w-14 rounded-full bg-gradient-to-r from-emerald-400/60 to-transparent" />
      </div>
      <SidebarClient />
      <div className="mt-auto border-t border-white/10 px-6 py-4 text-sm text-slate-400">
        <button className="block w-full text-left transition hover:text-slate-200">
          Settings
        </button>
        <button className="mt-3 block w-full text-left transition hover:text-slate-200">
          Activity
        </button>
      </div>
    </aside>
  );
}
