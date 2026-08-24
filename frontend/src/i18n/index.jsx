import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from './en';
import fa from './fa';

// ----------------------------------------------------------------------

const dictionaries = { en, fa };

const LANG_KEY = 'app_lang_v2'; // rotated 2026-08-24: default language switched to Farsi

export const LANGUAGES = [
  { value: 'en', label: 'English', flagIcon: '/assets/icons/ic_flag_en.svg' },
  { value: 'fa', label: 'فارسی', flagIcon: '/assets/icons/ic_flag_de.svg' }, // de-flag svg reused as generic non-en marker
];

export const isRtlLang = (lang) => lang === 'fa';

const LanguageContext = createContext(null);

function getInitialLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && dictionaries[stored]) return stored;
    if (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('fa')) return 'fa';
  } catch (e) {
    /* localStorage unavailable — fall through */
  }
  return 'fa'; // Farsi is the product default
}

// ----------------------------------------------------------------------

LanguageProvider.propTypes = {
  children: PropTypes.node,
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);
  const rtl = isRtlLang(lang);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {
      /* ignore */
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl]);

  const value = useMemo(() => {
    const dict = dictionaries[lang] || en;
    return {
      lang,
      rtl,
      setLang,
      /**
       * Translate a source string.
       * Falls back to the original string when no translation exists,
       * so un-migrated pages keep working while dictionaries grow.
       */
      t: (text) => (text == null ? text : dict[text] ?? text),
    };
  }, [lang, rtl]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe default for components rendered outside the provider
    return { lang: 'en', rtl: false, setLang: () => {}, t: (text) => text };
  }
  return ctx;
}