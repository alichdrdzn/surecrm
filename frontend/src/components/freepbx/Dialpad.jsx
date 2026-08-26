/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
// @mui
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import BackspaceIcon from '@mui/icons-material/Backspace';
import CallIcon from '@mui/icons-material/Call';
// api
import { toast } from 'react-toastify';
import axios from 'axios';
import { apipost, apiput } from '../../service/api';
import { constant } from '../../constant';

import { useTranslation } from '../../i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

/**
 * Click-to-call dialpad. Places the call through POST /freepbx/originate —
 * the PBX first rings the agent's own extension, then connects to the number.
 */
const Dialpad = ({ open, handleClose }) => {
  const { t } = useTranslation();
  const [number, setNumber] = useState('');
  const [extension, setExtension] = useState(''); // own saved extension
  const [extInput, setExtInput] = useState('');
  const [needExt, setNeedExt] = useState(false);
  const [dialing, setDialing] = useState(false);
  const userRole = localStorage.getItem('userRole');

  // Load my extension silently when the dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await axios.get(`${constant.baseUrl}freepbx/me`, {
          headers: { Authorization: localStorage.getItem('token') },
        });
        const ext = (res?.data?.data?.extension || '').toString();
        setExtension(ext);
        setExtInput(ext);
        setNeedExt(!ext);
      } catch (e) {
        setNeedExt(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const press = (d) => setNumber((v) => `${v}${d}`.slice(0, 24));

  const saveExtension = async () => {
    if (!extInput.trim()) return;
    const result = await apiput('freepbx/me/extension', { extension: extInput.trim() });
    if (result && result.status === 200) {
      toast.success(t('Extension saved'));
      setExtension(extInput.trim());
      setNeedExt(!extInput.trim());
    }
  };

  const placeCall = async () => {
    if (!number.trim()) {
      toast.warn(t('Enter phone number'));
      return;
    }
    setDialing(true);
    const payload = { number: number.trim() };
    if (userRole === 'admin' && extInput.trim()) payload.extension = extInput.trim();
    const result = await apipost('freepbx/originate', payload);
    setDialing(false);
    if (!result) {
      toast.error(t('Failed to place call'));
    } else {
      // Pop the Outgoing Call dialog immediately from this browser
      window.dispatchEvent(new CustomEvent('surecrm-outgoing', { detail: { number: number.trim() } }));
      handleClose(); // success message is toasted by apipost
    }
  };

  const onDialogKeyDown = (e) => {
    if (/^[0-9*#+]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') setNumber((v) => v.slice(0, -1));
    else if (e.key === 'Enter' && !e.shiftKey) placeCall();
  };

  return (
    <div>
      <Dialog open={open} onClose={handleClose} aria-labelledby="dialpad-title" onKeyDown={onDialogKeyDown}>
        <DialogTitle id="dialpad-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('Dialpad')}</span>
          {extension ? (
            <Chip size="small" color="primary" variant="outlined" label={`${t('Your Extension')}: ${extension}`} />
          ) : null}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ minWidth: 280 }}>
            <TextField
              autoFocus
              fullWidth
              placeholder={t('Enter phone number')}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              // Phone numbers always read LTR, even in Farsi/RTL mode
              inputProps={{ dir: 'ltr' }}
              InputProps={{
                endAdornment: (
                  <Button color="error" onClick={() => setNumber((v) => v.slice(0, -1))} disabled={!number}>
                    <BackspaceIcon />
                  </Button>
                ),
              }}
            />

            {/* Keypad keeps the universal telephone layout (1-2-3 on top-left)
                regardless of the UI language direction */}
            <Box dir="ltr" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {KEYS.map((k) => (
                <Button key={k} variant="outlined" onClick={() => press(k)} sx={{ py: 1.5, fontSize: '1.1rem' }}>
                  {k}
                </Button>
              ))}
            </Box>

            {(needExt || userRole === 'admin') && (
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={needExt ? t('Your Extension') : t('Dial From Extension')}
                  value={extInput}
                  onChange={(e) => setExtInput(e.target.value)}
                  helperText={needExt ? t('Set your extension so SureCRM can ring you and match your calls') : undefined}
                />
                <Button variant="outlined" onClick={saveExtension} disabled={!extInput.trim() || extInput.trim() === extension}>
                  {t('Save Extension')}
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CallIcon />}
            onClick={placeCall}
            disabled={dialing}
            style={{ textTransform: 'capitalize' }}
          >
            {t('Dial')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              setNumber('');
              handleClose();
            }}
            style={{ textTransform: 'capitalize' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Dialpad;
