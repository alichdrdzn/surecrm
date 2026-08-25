import { useEffect, useState } from 'react';
// @mui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useFormik } from 'formik';
import * as yup from 'yup';
import axios from 'axios';
import { toast } from 'react-toastify';
import { constant } from '../../constant';
import { apiget, apiput } from '../../service/api';
import { useTranslation } from '../../i18n';

// ----------------------------------------------------------------------
// Admin > PBX Settings (FreePBX / Asterisk AMI integration)
// ----------------------------------------------------------------------

const authHeaders = () => ({
  headers: { Authorization: localStorage.getItem('token') },
});

const validationSchema = yup.object({
  port: yup.number().min(1).max(65535),
  dialTimeout: yup.number().min(5).max(300),
  matchDigits: yup.number().min(4).max(15),
});

const FreePbx = () => {
  const { t } = useTranslation();
  const [engine, setEngine] = useState(null);
  const [testing, setTesting] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      enabled: false,
      host: '',
      port: 5038,
      username: '',
      secret: '',
      dialContext: 'from-internal',
      dialTimeout: 45,
      countryCodesToStrip: '',
      nationalPrefixToStrip: '',
      matchDigits: 9,
      recordingUrlBase: '',
      recordingUrlPattern: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      const payload = {
        ...values,
        port: Number(values.port) || 5038,
        dialTimeout: Number(values.dialTimeout) || 45,
        matchDigits: Number(values.matchDigits) || 9,
        // empty secret keeps the stored one server-side
        secret: values.secret || undefined,
      };
      const result = await apiput('freepbx/settings', payload);
      if (result && result.status === 200) {
        setEngine(result.data.engine || null);
        formik.setFieldValue('secret', '');
      }
    },
  });

  // Load saved settings + live engine status
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${constant.baseUrl}freepbx/settings`, authHeaders());
        const d = res.data && res.data.data;
        if (res.status === 200 && d) {
          formik.setValues({
            enabled: Boolean(d.enabled),
            host: d.host || '',
            port: d.port || 5038,
            username: d.username || '',
            secret: '',
            dialContext: d.dialContext || 'from-internal',
            dialTimeout: d.dialTimeout || 45,
            countryCodesToStrip: d.countryCodesToStrip || '',
            nationalPrefixToStrip: d.nationalPrefixToStrip || '',
            matchDigits: d.matchDigits || 9,
            recordingUrlBase: d.recordingUrlBase || '',
            recordingUrlPattern: d.recordingUrlPattern || '',
          });
          if (res.data.status) setEngine(res.data.status);
        }
      } catch (err) {
        /* first run - singleton not created yet */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const v = formik.values;
      const res = await axios.post(
        `${constant.baseUrl}freepbx/settings/test`,
        {
          host: v.host,
          port: Number(v.port) || 5038,
          username: v.username,
          secret: v.secret || undefined,
          useSaved: !v.secret,
        },
        authHeaders()
      );
      const r = res.data || {};
      toast.success(
        `${r.message || t('Connection successful')}${r.version ? ` (${r.version})` : ''}`
      );
    } catch (err) {
      const r = (err.response && err.response.data) || {};
      toast.error(r.message || t('Connection failed'));
    } finally {
      setTesting(false);
    }
  };

  const connected = Boolean(engine && engine.connected);

  return (
    <Container>
      <Typography variant="h4" mb={3}>
        {t('PBX Settings')}
      </Typography>

      {/* Live engine status */}
      <Card sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            icon={connected ? <CheckCircleIcon /> : <ErrorIcon />}
            color={connected ? 'success' : 'default'}
            label={connected ? t('PBX Connected') : t('PBX Disconnected')}
          />
          <Chip size="small" label={`${t('Integration Enabled')}: ${engine?.enabled ? t('Yes') : t('No')}`} variant="outlined" />
          <Chip size="small" label={`AMI: ${engine?.host || '-'}:${engine?.port || '-'}`} variant="outlined" />
          <Chip size="small" label={`${t('Active Calls')}: ${engine?.activeChannels ?? 0}`} variant="outlined" />
          <Chip size="small" label={`SSE: ${engine?.sseClients ?? 0}`} variant="outlined" />
        </Stack>
      </Card>

      <Card sx={{ p: 3 }}>
        <Box component="form" onSubmit={formik.handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="enabled"
                    checked={formik.values.enabled}
                    onChange={formik.handleChange}
                  />
                }
                label={t('Integration Enabled')}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <FormLabel>{t('AMI Host')}</FormLabel>
              <TextField fullWidth size="small" name="host" value={formik.values.host} onChange={formik.handleChange} placeholder="192.168.12.133" />
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormLabel>{t('AMI Port')}</FormLabel>
              <TextField fullWidth size="small" name="port" type="number" value={formik.values.port} onChange={formik.handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormLabel>{t('Manager Username')}</FormLabel>
              <TextField fullWidth size="small" name="username" value={formik.values.username} onChange={formik.handleChange} placeholder="surecrm" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormLabel>
                {t('Manager Secret')} {engine?.hasSecret ? `(${t('saved - leave blank to keep')})` : ''}
              </FormLabel>
              <TextField fullWidth size="small" type="password" name="secret" value={formik.values.secret} onChange={formik.handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormLabel>{t('Dial Context')}</FormLabel>
              <TextField fullWidth size="small" name="dialContext" value={formik.values.dialContext} onChange={formik.handleChange} placeholder="from-internal" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormLabel>{t('Dial Timeout (seconds)')}</FormLabel>
              <TextField fullWidth size="small" name="dialTimeout" type="number" value={formik.values.dialTimeout} onChange={formik.handleChange} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormLabel>{t('Match Digits')}</FormLabel>
              <TextField fullWidth size="small" name="matchDigits" type="number" value={formik.values.matchDigits} onChange={formik.handleChange} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormLabel>{t('Country Codes To Strip')}</FormLabel>
              <TextField fullWidth size="small" name="countryCodesToStrip" value={formik.values.countryCodesToStrip} onChange={formik.handleChange} placeholder="98, +98" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormLabel>{t('National Prefix To Strip')}</FormLabel>
              <TextField fullWidth size="small" name="nationalPrefixToStrip" value={formik.values.nationalPrefixToStrip} onChange={formik.handleChange} placeholder="0" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormLabel>{t('Recording URL Base')}</FormLabel>
              <TextField fullWidth size="small" name="recordingUrlBase" value={formik.values.recordingUrlBase} onChange={formik.handleChange} placeholder="https://pbx.example.com" />
            </Grid>
            <Grid item xs={12} sm={8}>
              <FormLabel>{t('Recording URL Pattern')}</FormLabel>
              <TextField
                fullWidth
                size="small"
                name="recordingUrlPattern"
                value={formik.values.recordingUrlPattern}
                onChange={formik.handleChange}
                placeholder="{uniqueId}.wav"
                helperText={`${t('Placeholders')}: {uniqueId} {number} {ext} {date} {time}`}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" style={{ textTransform: 'capitalize' }}>
              {t('Save Settings')}
            </Button>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing}
              startIcon={testing ? <CircularProgress size={16} /> : null}
              style={{ textTransform: 'capitalize' }}
            >
              {t('Test Connection')}
            </Button>
          </Stack>
        </Box>
      </Card>
    </Container>
  );
};

export default FreePbx;
