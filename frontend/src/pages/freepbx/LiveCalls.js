import { useCallback, useEffect, useState } from 'react';
// @mui
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { constant } from '../../constant';
import { useTranslation } from '../../i18n';

// ----------------------------------------------------------------------
// Live-calls panel. Polls /freepbx/status + /freepbx/livecalls every 5 s.
// Uses plain axios (not the shared api helpers) because those fire success
// toasts on every 200 - unacceptable for a poller.
// ----------------------------------------------------------------------

const authHeaders = () => ({ headers: { Authorization: localStorage.getItem('token') } });

const fmtDuration = (sec) => {
  const s = Math.max(0, Number(sec) || 0);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${ss}`;
};

const LiveCalls = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [calls, setCalls] = useState([]);
  const [reload, setReload] = useState(0);

  const fetchdata = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        axios.get(`${constant.baseUrl}freepbx/status`, authHeaders()),
        axios.get(`${constant.baseUrl}freepbx/livecalls`, authHeaders()),
      ]);
      if (s?.status === 200) setStatus(s.data?.data || null);
      if (l?.status === 200) setCalls(Array.isArray(l.data?.data) ? l.data.data : []);
    } catch (err) {
      /* engine offline - keep last snapshot */
    }
  }, []);

  useEffect(() => {
    fetchdata();
    const timer = setInterval(fetchdata, 5000);
    return () => clearInterval(timer);
  }, [fetchdata, reload]);

  const connected = Boolean(status && status.enabled && status.connected);

  return (
    <Container>
      <Stack direction="row" alignItems="center" mb={3} justifyContent="space-between">
        <Typography variant="h4">{t('Live Calls')}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={connected ? 'success' : 'default'}
            label={connected ? t('PBX Connected') : t('PBX Disconnected')}
          />
          <Tooltip title={t('Refresh')}>
            <IconButton onClick={() => setReload((r) => r + 1)}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Card>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t('Phone Number')}</TableCell>
                <TableCell>{t('Name')}</TableCell>
                <TableCell>{t('Direction')}</TableCell>
                <TableCell>{t('State')}</TableCell>
                <TableCell>{t('Extension')}</TableCell>
                <TableCell>{t('Duration')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {t('No active calls')}
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((c) => (
                  <TableRow key={c.uniqueId || c.channel}>
                    <TableCell>{c.number || '-'}</TableCell>
                    <TableCell>{c.matchedName || '-'}</TableCell>
                    <TableCell>{c.direction || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={c.state === 'Up' ? 'success' : 'warning'}
                        label={c.state}
                      />
                    </TableCell>
                    <TableCell>{c.exten || '-'}</TableCell>
                    <TableCell>{fmtDuration(c.durationSec)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {t('Auto refresh every 5 seconds')}
      </Typography>
    </Container>
  );
};

export default LiveCalls;
