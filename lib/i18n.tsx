"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import en from "../public/locales/en.json";
import it from "../public/locales/it.json";

type Language = "en" | "it";
type Translations = typeof en;

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string) => string;
}

const dictionaries: Record<Language, Translations> = { en, it };
const STORAGE_KEY = "memoraiz-language";

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en");

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
        if (stored === "en" || stored === "it") {
            setLanguageState(stored);
        } else {
            // Default to Italian if browser language is Italian, otherwise English
            const browserLang = navigator.language.split("-")[0];
            if (browserLang === "it") {
                setLanguageState("it");
            }
        }
    }, []);

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.lang = lang;
    }, []);

    const t = useCallback(
        (path: string) => {
            const keys = path.split(".");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let current: any = dictionaries[language];
            for (const key of keys) {
                if (current && typeof current === "object" && key in current) {
                    current = current[key];
                } else {
                    return path;
                }
            }
            return typeof current === "string" ? current : path;
        },
        [language]
    );

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error("useI18n must be used within an I18nProvider");
    }
    return context;
}
