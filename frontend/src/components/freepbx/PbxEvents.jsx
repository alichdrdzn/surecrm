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
import { constant } from '../../constant';
import { useTranslation } from '../../i18n';

// ----------------------------------------------------------------------
// Global FreePBX real-time layer.
//
// Opens ONE EventSource per browser session (JWT passed via ?token= since
// EventSource cannot set headers). Handles:
//   event "incoming_call" -> screen-pop dialog for the called agent
//   event "call_ended"    -> toast + auto-close of the popup
// Mounted once inside DashboardLayout so every page receives events.
// ----------------------------------------------------------------------

const PbxEvents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null); // {from, fromName, match}
  const [endedMsg, setEndedMsg] = useState(null);
  const incomingRef = useRef(null);

  const applyIncoming = (val) => {
    incomingRef.current = val;
    setIncoming(val);
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
      applyIncoming({
        from: data.from || '',
        fromName: data.fromName || '',
        match: data.match || null,
        at: data.at,
      });
    });

    es.addEventListener('call_ended', (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      const cur = incomingRef.current;
      // Close the screen-pop when its call finishes; surface a toast either way
      if (!cur || cur.from === data.number || !cur.from) {
        setEndedMsg(data.number || cur?.from || '');
        if (cur) applyIncoming(null);
      }
    });

    es.onerror = () => {
      /* EventSource retries automatically (server sends retry: 5000) */
    };

    return () => es.close();
  }, []);

  const match = incoming && incoming.match;
  const deepLink = match
    ? `/dashboard/${match.type === 'Contact' ? 'contact' : 'lead'}/view/${match.id}`
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
