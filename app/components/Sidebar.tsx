import { Suspense } from "react";
import SidebarClient from "@/app/components/SidebarClient";
import ThemeToggle from "@/app/components/ThemeToggle";
import MemoraizLogo from "@/app/components/MemoraizLogo";

export default function Sidebar() {
  return (
    <aside className="sidebar-shell flex w-full flex-col lg:w-72 lg:shrink-0 lg:h-full lg:overflow-y-auto canvas-scroll">
      <div className="px-6 pt-6">
        <div className="flex flex-col gap-3">
          <MemoraizLogo className="h-9 w-auto" />
          <div className="logo-divider" />
          <div className="section-title heading-font text-xl font-semibold text-slate-100">
            Conversation Hub
          </div>
        </div>
        <div className="mt-4 h-px w-14 rounded-full bg-gradient-to-r from-emerald-400/60 to-transparent" />
      </div>
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarClient />
      </Suspense>
      <div className="mt-auto border-t border-white/10 px-6 py-4">
        <div className="label-caps text-[11px] uppercase tracking-[0.3em] text-slate-500">
          Theme
        </div>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
