import { useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import Iconify from '../iconify/Iconify';
import {
  toJalaali,
  toGregorian,
  JALALI_MONTHS,
  WEEKDAY_INITIALS_FA,
  toPersianDigits,
} from '../../utils/jalali';

// ----------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const eventKey = (j) => `${j.jy}-${j.jm}-${j.jd}`;

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Persian (Solar Hijri / Jalali) month calendar.
 * Saturday-first week, Persian digits, event chips per day.
 * Pure display component — data in via `events`
 * ({ title, start, backgroundColor, textColor, _id }); interactions leave
 * through onEventClick(event) / onDateClick(gregorianDate).
 */
export default function JalaliCalendar({ events = [], onEventClick, onDateClick }) {
  const today = useMemo(() => new Date(), []);
  const todayJ = useMemo(() => toJalaali(today), [today]);
  const [cursor, setCursor] = useState(() => ({ jy: todayJ.jy, jm: todayJ.jm }));

  // Events indexed by their (Jalali) start day
  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach((ev) => {
      const d = safeDate(ev.start);
      if (!d) return;
      const k = eventKey(toJalaali(d));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ ...ev, _start: d });
    });
    return map;
  }, [events]);

  // 42-cell grid starting on the Saturday before (or of) the 1st
  const cells = useMemo(() => {
    const first = toGregorian(cursor.jy, cursor.jm, 1);
    const offset = (first.getDay() + 1) % 7; // JS Sunday=0 -> Saturday=6 -> offset 0
    const startMs = first.getTime() - offset * DAY_MS;
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(startMs + i * DAY_MS);
      const j = toJalaali(date);
      return { date, ...j, inMonth: j.jm === cursor.jm, dowFri: date.getDay() === 5 };
    });
  }, [cursor]);

  const move = (deltaMonths) => {
    setCursor((c) => {
      let m = c.jm + deltaMonths;
      let y = c.jy;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      return { jy: y, jm: m };
    });
  };

  return (
    <Box sx={{ direction: 'rtl', width: '100%' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" variant="outlined" onClick={() => move(-1)} aria-label="month-prev">
            <Iconify icon="eva:arrow-forward-fill" />
          </Button>
          <Button size="small" onClick={() => setCursor({ jy: todayJ.jy, jm: todayJ.jm })}>
            امروز
          </Button>
          <Button size="small" variant="outlined" onClick={() => move(1)} aria-label="month-next">
            <Iconify icon="eva:arrow-back-fill" />
          </Button>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {`${JALALI_MONTHS[cursor.jm - 1]} ${toPersianDigits(cursor.jy)}`}
        </Typography>
      </Stack>

      {/* Weekday initials — Saturday first */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {WEEKDAY_INITIALS_FA.map((w, i) => (
          <Typography
            key={w}
            align="center"
            variant="subtitle2"
            sx={{ py: 1, color: i === 6 ? 'error.main' : 'text.secondary' }}
          >
            {w}
          </Typography>
        ))}
      </Box>

      {/* Day grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {cells.map((cell) => {
          const isToday = sameDay(cell.date, today);
          const dayEvents = eventsByDay.get(eventKey(cell)) || [];
          const visible = dayEvents.slice(0, 2);
          const overflow = dayEvents.length - visible.length;
          return (
            <Box
              key={cell.date.toISOString()}
              onClick={() => onDateClick && onDateClick(cell.date)}
              sx={(theme) => ({
                position: 'relative',
                minHeight: 96,
                p: 0.75,
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: cell.inMonth ? 'background.paper' : theme.palette.action.hover,
                border: '1px solid',
                borderColor: isToday ? 'primary.main' : theme.palette.divider,
                borderWidth: isToday ? 2 : 1,
                '&:hover': { bgcolor: theme.palette.action.selected },
                overflow: 'hidden',
              })}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isToday ? 700 : 400,
                  opacity: cell.inMonth ? 1 : 0.45,
                  ...(cell.dowFri && cell.inMonth ? { color: 'error.main' } : {}),
                }}
              >
                {toPersianDigits(cell.jd)}
              </Typography>

              {visible.map((ev, idx) => (
                <Box
                  key={`${eventKey(cell)}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick && onEventClick(ev);
                  }}
                  sx={{
                    mt: 0.25,
                    px: 0.5,
                    py: 0.1,
                    borderRadius: 0.5,
                    fontSize: 11,
                    lineHeight: 1.6,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    bgcolor: ev.backgroundColor || 'primary.lighter',
                    color: ev.textColor || 'text.primary',
                    '&:hover': { filter: 'brightness(0.95)' },
                  }}
                >
                  {ev.title}
                </Box>
              ))}
              {overflow > 0 && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'text.secondary' }}>
                  {`+${toPersianDigits(overflow)} بیشتر`}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
