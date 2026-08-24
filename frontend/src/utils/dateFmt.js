import { useMemo } from 'react';
import moment from 'moment';
import { useTranslation } from '../i18n';
import { toJalaali, JALALI_MONTHS, toPersianDigits } from './jalali';

// ----------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

function faParts(value) {
  const m = moment(value);
  if (!m.isValid()) return null;
  const j = toJalaali(m.toDate());
  return {
    jy: j.jy,
    jm: j.jm,
    jd: j.jd,
    hh: m.hours(),
    mm: m.minutes(),
    hasTime: m.hours() !== 0 || m.minutes() !== 0 || m.seconds() !== 0,
  };
}

/** «۰۲/۰۶/۱۴۰۵» */
export function formatJalaliDate(value) {
  const p = faParts(value);
  if (!p) return '--';
  return toPersianDigits(`${pad(p.jd)}/${pad(p.jm)}/${p.jy}`);
}

/** «۲ شهریور ۱۴۰۵، ۱۴:۳۰» */
export function formatJalaliDateTime(value) {
  const p = faParts(value);
  if (!p) return '--';
  const base = `${toPersianDigits(p.jd)} ${JALALI_MONTHS[p.jm - 1]} ${toPersianDigits(p.jy)}`;
  return p.hasTime ? `${base}، ${toPersianDigits(`${pad(p.hh)}:${pad(p.mm)}`)}` : base;
}

/**
 * Language-aware formatters for DISPLAY-only dates.
 * - fa: Persian (Jalali) calendar with Persian digits
 * - en: previous Gregorian formats, byte-for-byte
 * Never use these for form input values or API payloads — keep those ISO/Gregorian.
 */
export function useDateFmt() {
  const { lang } = useTranslation();
  return useMemo(
    () => ({
      lang,
      /** Date-only display value. */
      fd: (value) => {
        if (value == null || value === '') return '--';
        return lang === 'fa' ? formatJalaliDate(value) : moment(value).format('DD/MM/YYYY');
      },
      /** Date+time display value. */
      fdt: (value) => {
        if (value == null || value === '') return '--';
        return lang === 'fa' ? formatJalaliDateTime(value) : moment(value).format('lll');
      },
    }),
    [lang]
  );
}
