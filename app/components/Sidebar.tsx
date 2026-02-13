"use client";

import { Suspense } from "react";
import SidebarClient from "@/app/components/SidebarClient";
import LanguageToggle from "@/app/components/LanguageToggle";
import ThemeToggle from "@/app/components/ThemeToggle";
import MemoraizLogo from "@/app/components/MemoraizLogo";
import { useI18n } from "@/lib/i18n";

export default function Sidebar() {
  const { t } = useI18n();

  return (
    <aside className="sidebar-shell flex w-full flex-col lg:w-72 lg:shrink-0 lg:h-full lg:overflow-y-auto canvas-scroll">
      <div className="px-6 pt-6">
        <div className="flex flex-col gap-3">
          <MemoraizLogo className="h-9 w-auto" />
          <div className="logo-divider" />
          <div className="section-title heading-font text-xl font-semibold text-slate-100">
            {t("common.conversation_hub")}
          </div>

        </div>
        <div className="mt-4 h-px w-14 rounded-full bg-gradient-to-r from-emerald-400/60 to-transparent" />
      </div>
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarClient />
      </Suspense>
      <div className="mt-auto border-t border-white/10 px-6 py-4 space-y-4">
        <div>
          <div className="label-caps text-[11px] uppercase tracking-[0.3em] text-slate-500">
            {t("common.language")}
          </div>
          <div className="mt-3">
            <LanguageToggle />
          </div>
        </div>
        <div>
          <div className="label-caps text-[11px] uppercase tracking-[0.3em] text-slate-500">
            {t("common.theme")}
          </div>
          <div className="mt-3">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}


