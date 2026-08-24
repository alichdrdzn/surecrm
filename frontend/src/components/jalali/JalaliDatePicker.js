import { useEffect, useMemo, useState } from 'react';
import { Box, Button, IconButton, MenuItem, Popover, Stack, TextField, Typography } from '@mui/material';
import Iconify from '../iconify/Iconify';
import { useTranslation } from '../../i18n';
import {
  toJalaali,
  toGregorian,
  JALALI_MONTHS,
  WEEKDAY_INITIALS_FA,
  toPersianDigits,
  jalaaliMonthLength,
} from '../../utils/jalali';

// ----------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const DAY_MS = 24 * 60 * 60 * 1000;

const YEAR_MIN = 1330;
const YEAR_MAX = 1450;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MAX - i); // newest first
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Parse 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm[:ss]', 'YYYY-MM-DD HH:mm[:ss]' (or any Date-parsable value). */
function parseValue(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoLocal(d, showTime) {
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return showTime ? `${base}T${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
}

/**
 * Drop-in replacement for <TextField type="date" | type="datetime-local">.
 * - lang 'fa': read-only field showing a Jalali date (Persian digits) + popover
 *   month-grid picker (Saturday-first, Persian digits). Emits the SAME wire
 *   format as the native input: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'.
 * - other languages: renders the original native Gregorian input untouched.
 */
export default function JalaliDatePicker({
  name,
  value,
  onChange,
  showTime = false,
  error = false,
  helperText,
  size = 'small',
  fullWidth = true,
  ...other
}) {
  const { lang, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const parsed = useMemo(() => parseValue(value), [value]);
  const todayJ = useMemo(() => toJalaali(new Date()), []);
  const [cursor, setCursor] = useState({ jy: todayJ.jy, jm: todayJ.jm });
  const [time, setTime] = useState({ hh: 9, mm: 0 });

  // Keep view state in sync with externally-provided values
  useEffect(() => {
    if (parsed) {
      const j = toJalaali(parsed);
      setCursor({ jy: j.jy, jm: j.jm });
      setTime({ hh: parsed.getHours(), mm: parsed.getMinutes() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // 42-cell grid starting on the Saturday before (or of) the 1st
  // NOTE: kept above the lang early-return so hooks always run in the same order
  const cells = useMemo(() => {
    const first = toGregorian(cursor.jy, cursor.jm, 1);
    const offset = (first.getDay() + 1) % 7; // JS Sunday=0 -> Saturday=6 -> offset 0
    const startMs = first.getTime() - offset * DAY_MS;
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(startMs + i * DAY_MS);
      const j = toJalaali(date);
      return { date, j, inMonth: j.jm === cursor.jm };
    });
  }, [cursor]);

  const display = useMemo(() => {
    if (!parsed) return '';
    const j = toJalaali(parsed);
    const base = `${toPersianDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`;
    return showTime ? `${base}، ${toPersianDigits(`${pad(time.hh)}:${pad(time.mm)}`)}` : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, showTime, time.hh, time.mm]);

  // Non-Farsi locales keep the native Gregorian input (previous behaviour)
  if (lang !== 'fa') {
    return (
      <TextField
        name={name}
        type={showTime ? 'datetime-local' : 'date'}
        size={size}
        fullWidth={fullWidth}
        value={value ?? ''}
        onChange={onChange}
        error={error}
        helperText={helperText}
        {...other}
      />
    );
  }

  const move = (delta) => {
    setCursor((c) => {
      let m = c.jm + delta;
      let y = c.jy;
      if (m > 12) { m = 1; y += 1; }
      if (m < 1) { m = 12; y -= 1; }
      return { jy: y, jm: m };
    });
  };

  /** Emit the same wire format the native input would produce. */
  const emit = (gregDate) => {
    if (!onChange) return;
    const withTime = showTime
      ? new Date(gregDate.getFullYear(), gregDate.getMonth(), gregDate.getDate(), time.hh, time.mm)
      : gregDate;
    onChange({ target: { name, value: toIsoLocal(withTime, showTime) } });
    setAnchorEl(null);
  };

  return (
    <>
      <TextField
        name={name}
        size={size}
        fullWidth={fullWidth}
        value={display}
        error={error}
        helperText={helperText}
        inputProps={{ readOnly: true, style: { cursor: 'pointer' } }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        {...other}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { p: 1.5, width: 300, direction: 'rtl' } }}
      >
        {/* Header: month/year selectors + navigation */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
          <IconButton size="small" onClick={() => move(-1)} aria-label="month-prev">
            <Iconify icon="eva:arrow-forward-fill" />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 0.5 }}>
            <TextField
              select
              size="small"
              value={cursor.jm}
              fullWidth
              onChange={(e) => setCursor((c) => ({ ...c, jm: Number(e.target.value) }))}
              sx={{ minWidth: 110, '& .MuiInputBase-input': { py: 0.5, fontSize: 13 } }}
            >
              {JALALI_MONTHS.map((label, idx) => (
                <MenuItem key={label} value={idx + 1}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              value={cursor.jy}
              fullWidth
              onChange={(e) => setCursor((c) => ({ ...c, jy: Number(e.target.value) }))}
              sx={{ '& .MuiSelect-select': { textAlign: 'center' }, '& .MuiInputBase-input': { py: 0.5, fontSize: 13 } }}
            >
              {YEARS.map((y) => (
                <MenuItem key={y} value={y}>
                  {toPersianDigits(y)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <IconButton size="small" onClick={() => move(1)} aria-label="month-next">
            <Iconify icon="eva:arrow-back-fill" />
          </IconButton>
        </Stack>

        {/* Weekday initials — Saturday first */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {WEEKDAY_INITIALS_FA.map((w, i) => (
            <Typography
              key={w}
              align="center"
              variant="caption"
              sx={{ py: 0.5, color: i === 6 ? 'error.main' : 'text.secondary' }}
            >
              {w}
            </Typography>
          ))}
        </Box>

        {/* Day grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
          {cells.map(({ date, j, inMonth }) => {
            const isSelected = parsed && sameDay(date, parsed);
            const isToday = sameDay(date, new Date());
            return (
              <IconButton
                key={date.toISOString()}
                onClick={() => emit(date)}
                sx={{
                  aspectRatio: '1 / 1',
                  minHeight: 32,
                  borderRadius: 1.5,
                  fontSize: 13,
                  opacity: inMonth ? 1 : 0.35,
                  color: isSelected || isToday ? undefined : date.getDay() === 5 ? 'error.main' : 'text.primary',
                  ...(isSelected && {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }),
                  ...(!isSelected && isToday && { border: '1px solid', borderColor: 'primary.main' }),
                }}
              >
                {toPersianDigits(j.jd)}
              </IconButton>
            );
          })}
        </Box>

        {/* Time selection for datetime mode */}
        {showTime && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <TextField
              select
              size="small"
              label={t('Hour')}
              value={time.hh}
              fullWidth
              onChange={(e) => setTime((tm) => ({ ...tm, hh: Number(e.target.value) }))}
              sx={{ '& .MuiInputBase-input': { py: 0.75 } }}
            >
              {HOURS.map((h) => (
                <MenuItem key={h} value={h}>
                  {toPersianDigits(pad(h))}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('Minute')}
              value={time.mm}
              fullWidth
              onChange={(e) => setTime((tm) => ({ ...tm, mm: Number(e.target.value) }))}
              sx={{ '& .MuiInputBase-input': { py: 0.75 } }}
            >
              {MINUTES.map((mm) => (
                <MenuItem key={mm} value={mm}>
                  {toPersianDigits(pad(mm))}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        )}

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Button
            size="small"
            onClick={() => {
              const now = new Date();
              const j = toJalaali(now);
              setCursor({ jy: j.jy, jm: j.jm });
              if (showTime) setTime({ hh: now.getHours(), mm: now.getMinutes() });
              emit(now);
            }}
          >
            {t('Today')}
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => {
              if (onChange) onChange({ target: { name, value: '' } });
              setAnchorEl(null);
            }}
          >
            {t('Clear')}
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
