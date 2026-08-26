import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// @mui
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import PhoneCallbackIcon from '@mui/icons-material/PhoneCallback';
import PhoneForwardedIcon from '@mui/icons-material/PhoneForwarded';
import { constant } from '../../constant';
import { useTranslation } from '../../i18n';

// ----------------------------------------------------------------------
// Global FreePBX real-time layer.
//
// Opens ONE EventSource per browser session (JWT passed via ?token= since
// EventSource cannot set headers). Handles:
//   event "incoming_call" -> screen-pop dialog for the called agent
//   event "outgoing_call" -> "calling..." dialog for the agent who placed
//                            the call from the CRM (Dialpad / CallButton)
//   event "call_ended"    -> toast + auto-close of the popup
// Mounted once inside DashboardLayout so every page receives events.
// ----------------------------------------------------------------------

const PbxEvents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null); // {from, fromName, match}
  const [outgoing, setOutgoing] = useState(null); // {to, match}
  const [endedMsg, setEndedMsg] = useState(null);
  const incomingRef = useRef(null);
  const outgoingRef = useRef(null);
  // Last click-to-call started from THIS browser: drives the optimistic
  // Outgoing popup and suppresses late "incoming" echoes of our own ring-back
  const lastDialedRef = useRef(null); // { digits, at }

  const applyIncoming = (val) => {
    incomingRef.current = val;
    setIncoming(val);
  };

  const applyOutgoing = (val) => {
    outgoingRef.current = val;
    setOutgoing(val);
  };

  // Re-render every second while a popup is in "Connected" state so the
  // live duration ticker advances.
  const [, setTick] = useState(0);
  const anyConnected = Boolean(outgoing?.connected || incoming?.connected);
  useEffect(() => {
    if (!anyConnected) return undefined;
    const iv = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(iv);
  }, [anyConnected]);

  const fmtElapsed = (fromIso) => {
    if (!fromIso) return '';
    const total = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 1000));
    const p = (n) => String(n).padStart(2, '0');
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const es = new EventSource(
      `${constant.baseUrl}freepbx/events?token=${encodeURIComponent(token)}`
    );

    es.addEventListener('incoming_call', (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      // Ignore echoes of a call placed from this browser moments ago: FreePBX
      // rings our own extension first, which must never read as "incoming".
      const dialed = lastDialedRef.current;
      const fromDigits = String(data.from || '').replace(/[^0-9*#+]/g, '');
      if (dialed && Date.now() - dialed.at < 25000 && (!fromDigits || fromDigits === dialed.digits)) {
        return;
      }
      applyIncoming({
        from: data.from || '',
        fromName: data.fromName || '',
        match: data.match || null,
        at: data.at,
      });
    });

    es.addEventListener('outgoing_call', (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      applyOutgoing({
        to: data.to || '',
        match: data.match || null,
        at: data.at,
      });
    });

    // The external party picked up -> switch popups to Connected with a timer
    es.addEventListener('call_answered', (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      const answeredAt = data.answeredAt || new Date().toISOString();
      if (outgoingRef.current && !outgoingRef.current.connected) {
        applyOutgoing({ ...outgoingRef.current, connected: true, answeredAt });
      }
      if (incomingRef.current && !incomingRef.current.connected) {
        applyIncoming({ ...incomingRef.current, connected: true, answeredAt });
      }
    });

    es.addEventListener('call_ended', (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      const cur = incomingRef.current;
      const curOut = outgoingRef.current;
      // Outcome line: number · duration · disposition (Answered / No Answer / …)
      const outcome = [data.number || cur?.from || curOut?.to || '', data.duration || '', data.status ? t(data.status) : '']
        .filter(Boolean)
        .join(' · ');
      // Close whichever screen-pop matches the finished call; surface a toast either way
      if (!cur || cur.from === data.number || !cur.from || !data.number) {
        setEndedMsg(outcome);
        if (cur) applyIncoming(null);
      }
      if (curOut && (curOut.to === data.number || !curOut.to || !data.number)) {
        setEndedMsg((m) => m || outcome);
        applyOutgoing(null);
      }
    });

    // Optimistic "Outgoing Call" popup the moment the user dials from this
    // browser (Dialpad / CallButton) - no waiting for PBX round-trips.
    const onLocalOutgoing = (e) => {
      let detail = {};
      try {
        detail = JSON.parse(e.detail || '{}');
      } catch (err) {
        detail = {};
      }
      const digits = String(detail.number || '').replace(/[^0-9*#+]/g, '');
      lastDialedRef.current = { digits, at: Date.now() };
      applyIncoming(null);
      applyOutgoing({ to: detail.number || '', match: null, at: new Date().toISOString() });
    };
    window.addEventListener('surecrm-outgoing', onLocalOutgoing);

    es.onerror = () => {
      /* EventSource retries automatically (server sends retry: 5000) */
    };

    return () => {
      window.removeEventListener('surecrm-outgoing', onLocalOutgoing);
      es.close();
    };
  }, []);

  const match = incoming && incoming.match;
  const deepLink = match
    ? `/dashboard/${match.type === 'Contact' ? 'contact' : 'lead'}/view/${match.id}`
    : null;

  const outMatch = outgoing && outgoing.match;
  const deepLinkOut = outMatch
    ? `/dashboard/${outMatch.type === 'Contact' ? 'contact' : 'lead'}/view/${outMatch.id}`
    : null;

  return (
    <>
      <Dialog open={Boolean(incoming)} onClose={() => applyIncoming(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhoneCallbackIcon color="primary" />
          {t('Incoming Call')}
        </DialogTitle>
        <DialogContent dividers sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="h4" gutterBottom>
            {incoming?.from || t('Unknown Number')}
          </Typography>
          {incoming?.fromName ? (
            <Typography variant="body1" color="text.secondary">
              {incoming.fromName}
            </Typography>
          ) : null}
          {match && match.label ? (
            <Typography variant="subtitle1" color="primary" sx={{ mt: 1 }}>
              {match.label}
            </Typography>
          ) : null}
          {incoming?.connected ? (
            <Typography variant="body1" sx={{ color: 'success.main', mt: 1 }}>
              {`${t('Connected')} · ${fmtElapsed(incoming.answeredAt)}`}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button variant="outlined" onClick={() => applyIncoming(null)}>
            {t('Dismiss')}
          </Button>
          {deepLink ? (
            <Button
              variant="contained"
              onClick={() => {
                navigate(deepLink);
                applyIncoming(null);
              }}
            >
              {t('Open Record')}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(outgoing)} onClose={() => applyOutgoing(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhoneForwardedIcon color="secondary" />
          {t('Outgoing Call')}
        </DialogTitle>
        <DialogContent dividers sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="h4" gutterBottom>
            {outgoing?.to || t('Unknown Number')}
          </Typography>
          {outgoing?.connected ? (
            <Typography variant="body1" sx={{ color: 'success.main' }}>
              {`${t('Connected')} · ${fmtElapsed(outgoing.answeredAt)}`}
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary">
              {`${t('Calling')} ${outgoing?.to || ''}…`}
            </Typography>
          )}
          {outMatch && outMatch.label ? (
            <Typography variant="subtitle1" color="primary" sx={{ mt: 1 }}>
              {outMatch.label}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button variant="outlined" onClick={() => applyOutgoing(null)}>
            {t('Dismiss')}
          </Button>
          {deepLinkOut ? (
            <Button
              variant="contained"
              onClick={() => {
                navigate(deepLinkOut);
                applyOutgoing(null);
              }}
            >
              {t('Open Record')}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(endedMsg)}
        autoHideDuration={5000}
        onClose={() => setEndedMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="info" onClose={() => setEndedMsg(null)} sx={{ width: '100%' }}>
          {`${t('Call ended')}${endedMsg ? ` - ${endedMsg}` : ''}`}
        </Alert>
      </Snackbar>
    </>
  );
};

export default PbxEvents;
