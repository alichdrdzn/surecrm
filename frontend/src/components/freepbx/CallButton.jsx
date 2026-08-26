import PropTypes from 'prop-types';
// @mui
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PhoneIcon from '@mui/icons-material/Phone';
import { toast } from 'react-toastify';
import { apipost } from '../../service/api';
import { useTranslation } from '../../i18n';

// ----------------------------------------------------------------------
// Click-to-call button. Asks the backend to ring MY extension first; once
// picked up, FreePBX bridges the call to `number`.
// ----------------------------------------------------------------------

const CallButton = ({ number, leadId, contactId, size = 'small' }) => {
  const { t } = useTranslation();

  const handleCall = async () => {
    if (!number) return;
    const body = { number };
    if (leadId) body.lead_id = leadId;
    if (contactId) body.contact_id = contactId;
    const result = await apipost('freepbx/originate', body);
    if (!result) {
      // axios threw (non-2xx): apipost only surfaces 400/401 messages itself
      toast.error(t('Failed to place call'));
    } else {
      // Pop the Outgoing Call dialog immediately from this browser
      window.dispatchEvent(new CustomEvent('surecrm-outgoing', { detail: { number } }));
    }
  };

  return (
    <Tooltip title={number ? `${t('Call')} ${number}` : t('No phone number')}>
      <span>
        <IconButton size={size} color="primary" onClick={handleCall} disabled={!number} sx={{ p: 0.5 }}>
          <PhoneIcon fontSize="inherit" />
        </IconButton>
      </span>
    </Tooltip>
  );
};

CallButton.propTypes = {
  number: PropTypes.string,
  leadId: PropTypes.string,
  contactId: PropTypes.string,
  size: PropTypes.string,
};

export default CallButton;
