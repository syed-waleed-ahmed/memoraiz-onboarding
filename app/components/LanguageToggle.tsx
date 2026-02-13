"use client";

import { useI18n } from "@/lib/i18n";

export default function LanguageToggle() {
    const { language, setLanguage, t } = useI18n();

    const toggleLanguage = () => {
        setLanguage(language === "en" ? "it" : "en");
    };

    return (
        <button
            type="button"
            onClick={toggleLanguage}
            className="panel-soft flex w-full items-center justify-between px-3 py-2 text-xs text-slate-300 transition hover:border-white/20"
            aria-label="Toggle language"
        >
            <span className="text-slate-200">
                {language === "en" ? t("common.english") : t("common.italian")}
            </span>
            <span className="flex h-5 items-center gap-1.5 rounded-full bg-white/5 px-2 font-medium text-[10px] uppercase tracking-wider text-slate-400">
                {language === "en" ? "EN" : "IT"}
            </span>
        </button>
    );
}
