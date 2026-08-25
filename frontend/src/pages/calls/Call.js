/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
// @mui
import { Card, Button, Box, Container, Stack, Typography, Chip, Menu, MenuItem, ListItemIcon } from '@mui/material';
// components
import { useNavigate } from 'react-router-dom';
import { DataGrid, GridToolbar, GridToolbarContainer } from '@mui/x-data-grid';
import { DeleteOutline } from '@mui/icons-material';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
// sections
// mock
import { apiget, deleteManyApi } from '../../service/api';
import DeleteModel from '../../components/Deletemodle'
import TableStyle from '../../components/TableStyle';
import Iconify from '../../components/iconify/Iconify';
import Dialpad from '../../components/freepbx/Dialpad';
import ContactPicker from '../../components/freepbx/ContactPicker';

// ----------------------------------------------------------------------
import { useTranslation } from '../../i18n';

const CustomToolbar = ({ selectedRowIds, fetchdata, onDial }) => {
  const { t } = useTranslation();
  const [opendelete, setOpendelete] = useState(false);

  // open DeleteModel
  const handleCloseDelete = () => setOpendelete(false);
  const handleOpenDelete = () => setOpendelete(true);

  const deleteManyCalls = async (data) => {
    await deleteManyApi('call/deletemany', data)
    fetchdata();
    handleCloseDelete();
  }

  return (
    <GridToolbarContainer>
      <GridToolbar />
      <Button variant="text" sx={{ textTransform: 'capitalize' }} onClick={onDial}>{t('Dial')}</Button>
      {selectedRowIds && selectedRowIds.length > 0 && <Button variant="text" sx={{ textTransform: 'capitalize' }} startIcon={<DeleteOutline />} onClick={handleOpenDelete}>{t('Delete')}</Button>}
      <DeleteModel opendelete={opendelete} handleClosedelete={handleCloseDelete} deletedata={deleteManyCalls} id={selectedRowIds} />
    </GridToolbarContainer>
  );
}

/** Direction of a call row; falls back to the subject for legacy records. */
export const directionOfCall = (row) => {
  if (row.direction) return row.direction;
  if (/^inbound/i.test(row.subject || '')) return 'Inbound';
  if (/^outbound/i.test(row.subject || '')) return 'Outbound';
  return '';
};

  const Call = () => {
  const { t } = useTranslation();
  const [allCall, setAllCall] = useState([]);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [openDial, setOpenDial] = useState(false);
  const [openContacts, setOpenContacts] = useState(false);
  const [newMenuAnchor, setNewMenuAnchor] = useState(null);
  const [userAction, setUserAction] = useState(null)
  const navigate = useNavigate()

  const userid = localStorage.getItem('user_id');
  const userRole = localStorage.getItem("userRole")

  const handleSelectionChange = (selectionModel) => {
    setSelectedRowIds(selectionModel);
  };

  const columns = [
    {
      field: "subject",
      headerName: t('Subject'),
      flex: 1,
      cellClassName: "name-column--cell name-column--cell--capitalize",
      renderCell: (params) => {
        const handleFirstNameClick = () => {
          navigate(`/dashboard/call/view/${params.row._id}`)
        };

        return (
          <Box onClick={handleFirstNameClick}>
            {params.value}
          </Box>
        );
      }
    },
    {
      field: "startDateTime",
      headerName: t('Start Date & Time'),
      flex: 1,
      valueFormatter: (params) => {
        const date = new Date(params.value);
        return date.toLocaleString();
      },
    },

    { field: "duration", headerName: t('Duration'), headerAlign: "left", align: "left", flex: 1 },
    { field: "status", headerName: t('Status'), headerAlign: "left", align: "left", flex: 1 },
    {
      field: "direction",
      headerName: t('Direction'),
      flex: 1,
      renderCell: (params) => {
        const dir = directionOfCall(params.row);
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
      }
    },
    {
      field: "phoneNumber",
      headerName: t('Phone Number'),
      headerAlign: "left",
      align: "left",
      flex: 1,
      renderCell: (params) => params?.value || '-',
    },
    {
      field: "source",
      headerName: t('Source'),
      flex: 1,
      renderCell: (params) => (
        <Chip
          size="small"
          variant="outlined"
          color={params.row.source === 'freepbx' ? 'primary' : 'default'}
          label={params.row.source === 'freepbx' ? t('FreePBX') : t('Manual')}
        />
      )
    },
    {
      field: "relatedTo",
      headerName: t('Related To'),
      cellClassName: "name-column--cell name-column--cell--capitalize",
      flex: 1,
      renderCell: (params) => {
        const row = params?.row || {};
        const lead = row.relatedTo === "Lead" ? row.lead_id : null;
        const contact = row.relatedTo === "Contact" ? row.contact_id : null;
        const target = lead || contact;
        // Unlinked calls (e.g. FreePBX auto-logs with relatedTo 'None') show a dash
        if (!target || (target.firstName == null && target.lastName == null)) return '-';
        const handleFirstNameClick = () => {
          navigate(lead ? `/dashboard/lead/view/${lead._id}` : `/dashboard/contact/view/${contact._id}`)
        };
        return (
          <Box onClick={handleFirstNameClick}>
            {`${target.firstName || ''} ${target.lastName || ''}`.trim()}
          </Box>
        );
      }
    },
    {
      field: "createdBy",
      headerName: t('Assigned User'),
      cellClassName: "name-column--cell name-column--cell--capitalize",
      flex: 1,
      renderCell: (params) => {
        const user = params?.row?.createdBy;
        // FreePBX auto-logged calls have no assigned user - never dereference blindly
        if (!user) return '-';
        const handleFirstNameClick = () => {
          navigate(`/dashboard/user/view/${user._id}`)
        };
        return (
          <Box onClick={handleFirstNameClick}>
            {`${user.firstName} ${user.lastName}`}
          </Box>
        );
      }
    }
  ];

  const fetchdata = async () => {
    const result = await apiget(userRole === "admin" ? `call/list` : `call/list/?createdBy=${userid}`)
    if (result && result.status === 200) {
      setAllCall(result?.data?.result)
    }
  }
  useEffect(() => {
    fetchdata();
  }, [userAction])

  return (
    <>
      {/* Click-to-call dialpad */}
      <Dialpad open={openDial} handleClose={() => { setOpenDial(false); setUserAction({}); }} />

      {/* Click-to-call contact picker */}
      <ContactPicker open={openContacts} handleClose={() => { setOpenContacts(false); setUserAction({}); }} />

      <Container>
        <TableStyle>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={5}>
            <Typography variant="h4">{t('Calls List')}</Typography>
            <>
              <Button variant="contained" startIcon={<Iconify icon="eva:plus-fill" />} onClick={(e) => setNewMenuAnchor(e.currentTarget)}>{t('New Call')}</Button>
              <Menu anchorEl={newMenuAnchor} open={Boolean(newMenuAnchor)} onClose={() => setNewMenuAnchor(null)}>
                <MenuItem onClick={() => { setNewMenuAnchor(null); setOpenDial(true); }}>
                  <ListItemIcon><Iconify icon="eva:phone-call-fill" /></ListItemIcon>{t('Dialpad')}
                </MenuItem>
                <MenuItem onClick={() => { setNewMenuAnchor(null); setOpenContacts(true); }}>
                  <ListItemIcon><Iconify icon="eva:people-fill" /></ListItemIcon>{t('Contact List')}
                </MenuItem>
              </Menu>
            </>
          </Stack>
          <Box width="100%">
            <Card style={{ height: "600px", paddingTop: "15px" }}>
              <DataGrid
                rows={allCall}
                columns={columns}
                components={{ Toolbar: () => CustomToolbar({ selectedRowIds, fetchdata, onDial: () => setOpenDial(true) }) }}
                checkboxSelection
                onRowSelectionModelChange={handleSelectionChange}
                rowSelectionModel={selectedRowIds}
                getRowId={row => row._id}
              />
            </Card>
          </Box>
        </TableStyle>
      </Container>
    </>
  );
}

export default Call