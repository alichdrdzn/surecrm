/* eslint-disable react/prop-types */
/* eslint-disable arrow-body-style */
import { useEffect, useState } from 'react';
import { Card, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Typography, IconButton, Dialog, DialogActions, DialogContent, DialogTitle, CircularProgress } from '@mui/material';
import { DeleteOutline, GetApp, Clear, Close } from '@mui/icons-material';
import { apiget, apipost, apidelete } from '../../service/api';
import { constant } from '../../constant';
import { useTranslation } from '../../i18n';

const DocumentManagement = ({ type, entityId, onRefresh }) => {
    const { t } = useTranslation();
    const [documents, setDocuments] = useState([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [fileName, setFileName] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const userid = localStorage.getItem('user_id');

    const fetchDocuments = async () => {
        if (!entityId) return;
        try {
            const result = await apiget(`document/by-entity/${type}/${entityId}`);
            if (result && result.status === 200) {
                setDocuments(result.data?.result || []);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [entityId, onRefresh]);

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        const data = new FormData();
        data.append('file', file);
        data.append('fileName', fileName || file.name);
        data.append('createdBy', userid);
        data.append('category', type);
        if (type === 'contact') {
            data.append('contact_id', entityId);
        } else if (type === 'lead') {
            data.append('lead_id', entityId);
        }

        try {
            const result = await apipost('document/upload', data);
            if (result && result.status === 200) {
                setFileName('');
                setFile(null);
                setOpenDialog(false);
                fetchDocuments();
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        }
        setLoading(false);
    };

    const handleDelete = async (docId) => {
        try {
            await apidelete(`document/delete/${docId}`);
            fetchDocuments();
        } catch (error) {
            console.error('Error deleting document:', error);
        }
    };

    const downloadUrl = (fileId) => `${constant.baseUrl}document/file/${fileId}`;

    return (
        <Card sx={{ mt: 3 }}>
            <Box p={3}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">{t('Attached Documents')}</Typography>
                    <Button variant="contained" size="small" onClick={() => setOpenDialog(true)}>
                        {t('Upload File')}
                    </Button>
                </Box>

                {documents.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        {t('No documents attached')}
                    </Typography>
                ) : (
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('File Name')}</TableCell>
                                    <TableCell>{t('Category')}</TableCell>
                                    <TableCell>{t('Uploaded')}</TableCell>
                                    <TableCell align="right">{t('Actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {documents.map((doc) => (
                                    <TableRow key={doc._id}>
                                        <TableCell>{doc.fileName || doc.file}</TableCell>
                                        <TableCell>{t(doc.category)}</TableCell>
                                        <TableCell>{new Date(doc.createdOn).toLocaleDateString()}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" href={downloadUrl(doc._id)} target="_blank" color="primary">
                                                <GetApp fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleDelete(doc._id)} color="error">
                                                <DeleteOutline fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Upload Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('Upload Document')}</DialogTitle>
                <Close onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 8, top: 8, cursor: 'pointer' }} />
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>{t('File Description')}</Typography>
                        <Box component="input" type="text" fullWidth size="small" value={fileName}
                            onChange={(e) => setFileName(e.target.value)} sx={{ mb: 2 }}
                            placeholder="e.g., Government ID, Passport, etc." />
                        <Typography variant="body2" sx={{ mb: 1 }}>{t('Select File')}</Typography>
                        <Box component="input" type="file" fullWidth size="small"
                            onChange={(e) => setFile(e.target.files[0])} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)} color="error">{t('Cancel')}</Button>
                    <Button onClick={handleUpload} variant="contained" disabled={!file || loading}>
                        {loading ? <CircularProgress size={20} /> : t('Upload')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default DocumentManagement;
