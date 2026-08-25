/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
// @mui
import { Card, Button, Box, Container, Stack, Typography, Chip } from '@mui/material';
// components
import { useNavigate } from 'react-router-dom';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
// sections
import { apiget } from '../../service/api';
import TableStyle from '../../components/TableStyle';

import Header from '../../components/Header';

import { useTranslation } from '../../i18n';

const directionOf = (row) => {
  if (row.direction) return row.direction;
  // legacy rows only carry the direction inside the subject text
  if (/^inbound/i.test(row.subject || '')) return 'Inbound';
  if (/^outbound/i.test(row.subject || '')) return 'Outbound';
  return '';
};

const Recordings = () => {
  const { t } = useTranslation();
  const [allCalls, setAllCalls] = useState([]);
  const [player, setPlayer] = useState(null); // { id, url, subject }
  const navigate = useNavigate();

  const columns = [
    {
      field: 'startDateTime',
      headerName: t('Start Date & Time'),
      flex: 1,
      valueFormatter: (params) => {
        const date = new Date(params.value);
        return date.toLocaleString();
      },
    },
    {
      field: 'phoneNumber',
      headerName: t('Phone Number'),
      flex: 1,
      renderCell: (params) => params?.value || '-',
    },
    {
      field: 'match',
      headerName: t('Related To'),
      cellClassName: 'name-column--cell name-column--cell--capitalize',
      flex: 1,
      renderCell: (params) => {
        const handleNameClick = () => {
          navigate(
            params?.row?.relatedTo === 'Lead'
              ? `/dashboard/lead/view/${params?.row?.lead_id?._id}`
              : `/dashboard/contact/view/${params?.row?.contact_id?._id}`
          );
        };
        return (
          <Box onClick={handleNameClick}>
            {params?.row?.relatedTo === 'Lead'
              ? `${params?.row?.lead_id?.firstName ?? ''} ${params?.row?.lead_id?.lastName ?? ''}`.trim()
              : `${params?.row?.contact_id?.firstName ?? ''} ${params?.row?.contact_id?.lastName ?? ''}`.trim() ||
                '-'}
          </Box>
        );
      },
    },
    {
      field: 'direction',
      headerName: t('Direction'),
      flex: 0.8,
      renderCell: (params) => {
        const dir = directionOf(params.row);
        if (!dir) return <Typography variant="body2">-</Typography>;
        return (
          <Chip
            size="small"
            variant="outlined"
            color={dir === 'Inbound' ? 'secondary' : 'primary'}
            icon={dir === 'Inbound' ? <CallReceivedIcon fontSize="small" /> : <CallMadeIcon fontSize="small" />}
            label={t(dir)}
          />
        );
      },
    },
    { field: 'status', headerName: t('Status'), headerAlign: 'left', align: 'left', flex: 0.8 },
    { field: 'duration', headerName: t('Duration'), headerAlign: 'left', align: 'left', flex: 0.7 },
    {
      field: 'recordingUrl',
      headerName: t('Recording'),
      flex: 0.8,
      sortable: false,
      renderCell: (params) => {
        if (!params?.value) {
          return <Typography variant="body2">-</Typography>;
        }
        return (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={() =>
              setPlayer({ id: params.row._id, url: params.value, subject: params.row.subject })
            }
            sx={{ textTransform: 'capitalize' }}
          >
            {t('Play')}
          </Button>
        );
      },
    },
  ];

  const fetchdata = async () => {
    const result = await apiget(`call/list`);
    if (result && result.status === 200) {
      const rows = result?.data?.result || [];
      setAllCalls(rows.filter((r) => r.source === 'freepbx'));
    }
  };

  useEffect(() => {
    fetchdata();
  }, []);

  return (
    <>
      {/* Floating recording player */}
      {player && (
        <Card sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1300, p: 2, boxShadow: 8, maxWidth: 420 }}>
          <Stack spacing={1}>
            <Header title={t('Recording')} subtitle={player.subject} />
            <audio controls autoPlay src={player.url} style={{ width: '100%' }}>
              <track kind="captions" />
            </audio>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button size="small" href={player.url} target="_blank" rel="noopener noreferrer">
                {t('Open Link')}
              </Button>
              <Button size="small" color="error" onClick={() => setPlayer(null)}>
                {t('Close')}
              </Button>
            </Stack>
          </Stack>
        </Card>
      )}

      <Container>
        <TableStyle>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={5}>
            <Header title={t('Call Recordings')} />
          </Stack>
          <Box width="100%">
            <Card style={{ height: '600px', paddingTop: '15px' }}>
              <DataGrid
                rows={allCalls}
                columns={columns}
                components={{ Toolbar: GridToolbar }}
                getRowId={(row) => row._id}
              />
            </Card>
          </Box>
        </TableStyle>
      </Container>
    </>
  );
};

export default Recordings;
