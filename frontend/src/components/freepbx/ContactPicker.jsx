/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
// @mui
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
// api
import { apiget, apipost } from '../../service/api';
import { useTranslation } from '../../i18n';

/**
 * Click-to-call contact picker.
 *
 * Regular users see their OWN contacts (createdBy filter); admins see every
 * contact. The phone button places the call through POST freepbx/originate
 * passing contact_id, so the auto-created call record links back to the
 * contact automatically (no manual fields involved).
 */
const ContactPicker = ({ open, handleClose }) => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  const userid = localStorage.getItem('user_id');
  const userRole = localStorage.getItem('userRole');

  // Load contacts each time the dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const url = userRole === 'admin' ? 'contact/list' : `contact/list/?createdBy=${userid}`;
      const result = await apiget(url);
      if (result && result.status === 200) {
        setContacts(result?.data?.result || []);
      }
      setLoaded(true);
    })();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.firstName || ''} ${c.lastName || ''} ${c.phoneNumber || ''} ${c.alternatePhoneNumber || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [contacts, search]);

  const numberOf = (c) => c.phoneNumber || c.alternatePhoneNumber || '';

  const callContact = async (contact) => {
    const number = numberOf(contact);
    if (!number) return;
    const result = await apipost('freepbx/originate', { number, contact_id: contact._id });
    if (result) handleClose(); // success message is toasted by apipost
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('Contact List')}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          <TextField
            autoFocus
            size="small"
            placeholder={t('Search contacts')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ minHeight: 120, maxHeight: 380, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                {loaded ? t('No contacts found') : ''}
              </Typography>
            ) : (
              <List dense disablePadding>
                {filtered.map((c) => {
                  const number = numberOf(c);
                  return (
                    <ListItem
                      key={c._id}
                      secondaryAction={
                        <IconButton edge="end" color="primary" disabled={!number} onClick={() => callContact(c)}>
                          <PhoneIcon />
                        </IconButton>
                      }
                      sx={{ borderBottom: '1px dashed', borderColor: 'divider', pr: 7 }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ width: 34, height: 34 }}>
                          <PersonIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={`${c.firstName || ''} ${c.lastName || ''}`.trim()} secondary={number || t('No phone number')} />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>

          <Button variant="outlined" color="error" onClick={handleClose} style={{ textTransform: 'capitalize' }}>
            Close
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default ContactPicker;