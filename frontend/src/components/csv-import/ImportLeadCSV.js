import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import { useTranslation } from '../../i18n';
import { apipost } from '../../service/api';

const ImportLeadCSV = ({ open, handleClose, fetchdata }) => {
  const { t } = useTranslation();
  const [file, setFile] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [message, setMessage] = React.useState(null);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    setMessage(null);

    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('createdBy', localStorage.getItem('user_id'));

    try {
      setProgress(30);
      const result = await apipost('lead/import-csv', formData);
      setProgress(100);

      if (result && result.status === 200) {
        setMessage({ type: 'success', text: result.data.message });
        setTimeout(() => {
          handleClose();
          setFile(null);
          setProgress(0);
          fetchdata();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.data?.message || 'Import failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Import failed: ${  error.message || 'Unknown error'}` });
    }

    setUploading(false);
  };

  const handleCloseModal = () => {
    setFile(null);
    setProgress(0);
    setMessage(null);
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCloseModal}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{t('Import Leads from CSV')}</Typography>
          <IconButton onClick={handleCloseModal} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          {t('Upload a CSV file to import leads. The first row should contain column headers.')}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('Supported columns:')}</Typography>
          <Typography variant="caption" component="div" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            {t('title, firstName, lastName, dateOfBirth, gender, phoneNumber, emailAddress, address, leadSource, leadStatus, leadScore, alternatePhoneNumber, additionalEmailAddress, instagramProfile, twitterProfile, typeOfInsurance, desiredCoverageAmount, specificPolicyFeatures, QualificationStatus, policyType, policyNumber, startDate, endDate, coverageAmount, termLength, conversionReason, conversionDateTime, leadCategory, leadPriority, assigned_agent')}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ width: '100%' }}
          />
          {file && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'primary.main' }}>
              {t('Selected:')} {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </Typography>
          )}
        </Box>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        {uploading && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('Uploading...')} {progress}%
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseModal} color="error" disabled={uploading}>
          {t('Cancel')}
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={uploading || !file}
        >
          {t('Import')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportLeadCSV;