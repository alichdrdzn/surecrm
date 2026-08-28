/* eslint-disable react/prop-types */
import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { FormControl, FormControlLabel, FormHelperText, FormLabel, Grid, InputAdornment, MenuItem, OutlinedInput, Radio, RadioGroup, Rating, Select, TextField, CircularProgress, Box, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper, IconButton } from '@mui/material';
import { Close, GetApp, DeleteOutline } from '@mui/icons-material';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import ClearIcon from "@mui/icons-material/Clear";
import { useFormik } from 'formik';
import * as yup from "yup";
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import { apiget, apipost } from '../../service/api';
import Palette from '../../theme/palette';

import { useTranslation } from '../../i18n';
import JalaliDatePicker from '../../components/jalali/JalaliDatePicker';
import { constant } from '../../constant';

const Add = (props) => {
  const { t } = useTranslation();

  const { open, handleClose, _id, setUserAction } = props
  const [user, setUser] = useState([])
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [tempFileName, setTempFileName] = useState('');
  const [tempFile, setTempFile] = useState(null);
  const [docUploadLoading, setDocUploadLoading] = useState(false);
  const [openDocDialog, setOpenDocDialog] = useState(false);

  const userid = localStorage.getItem('user_id');
  const userdata = JSON.parse(localStorage.getItem('user'));

  // -----------  validationSchema
  const validationSchema = yup.object({
    title: yup.string().required("Title is required"),
    firstName: yup.string().required("First Name is required"),
    lastName: yup.string().required("Last Name is required"),
    dateOfBirth: yup.date().required("Date of Birth is required"),
    gender: yup.string().required("Gender is required"),
    phoneNumber: yup.string().matches(/^[0-9]{10}$/, 'Phone number is invalid').required('Phone number is required'),
    emailAddress: yup.string().email('Invalid email').required("Email is required"),
    address: yup.string().required("Address is required"),
    desiredCoverageAmount: yup.number(),
    coverageAmount: yup.number(),
    alternatePhoneNumber: yup.string().matches(/^[0-9]{10}$/, 'Phone number is invalid'),
    additionalEmailAddress: yup.string().email('Invalid email'),
    assigned_agent: yup.string().required("Assigned Agent is required")
  });

  // -----------   initialValues
  const initialValues = {
    title: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    phoneNumber: "",
    emailAddress: "",
    address: "",
    leadSource: "0",
    leadStatus: "",
    leadScore: "",
    alternatePhoneNumber: "",
    additionalEmailAddress: "",
    instagramProfile: "",
    twitterProfile: "",
    typeOfInsurance: "",
    desiredCoverageAmount: "",
    specificPolicyFeatures: "",
    QualificationStatus: "",
    policyType: "",
    policyNumber: "",
    startDate: "",
    endDate: "",
    coverageAmount: "",
    termLength: "",
    conversionReason: "",
    conversionDateTime: "",
    leadCategory: "",
    leadPriority: "",
    assigned_agent: "",
    createdBy: userid,
    contact_id: _id
  };

  // add Lead api
  const addLead = async (values) => {
    const data = values;
    const result = await apipost('lead/add', data)
    setUserAction(result)

    if (result && result.status === 201) {
      // Upload any temp files with the new lead ID
      const newLeadId = result.data.lead._id;
      if (tempFile && newLeadId) {
        await uploadFileToLead(newLeadId, tempFile, tempFileName);
      }
      formik.resetForm();
      handleClose();
      toast.success(result.data.message)
    }
  }

  // upload file to lead
  const uploadFileToLead = async (leadId, fileObj, desc) => {
    setDocUploadLoading(true);
    const formData = new FormData();
    formData.append('file', fileObj);
    formData.append('fileName', desc || fileObj.name);
    formData.append('createdBy', userid);
    formData.append('category', 'lead');
    formData.append('lead_id', leadId);
    try {
      await apipost('document/upload', formData);
      setTempFile(null);
      setTempFileName('');
      setUploadedDocs([]);
    } catch (e) {
      console.error('File upload failed', e);
    }
    setDocUploadLoading(false);
  };

  // formik
  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: async (values) => {
      addLead(values)
    },
  });
  // user api
  const fetchUserData = async () => {
    const result = await apiget('user/list')
    if (result && result.status === 200) {
      setUser(result?.data?.result)
    }
  }

  useEffect(() => {
    fetchUserData();
  }, [])

  return (
    <div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
      // TransitionComponent={Transition}
      >
        <DialogTitle
          id="scroll-dialog-title"
          style={{
            display: "flex",
            justifyContent: "space-between",
            // backgroundColor: "#2b4054",
            // color: "white",
          }}
        >
          <Typography variant="h6">{t('Add New')}</Typography>
          <Typography>
            <ClearIcon
              onClick={handleClose}
              style={{ cursor: "pointer" }}
            />
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <form>
            <DialogContentText
              id="scroll-dialog-description"
              tabIndex={-1}
            >
              <Typography style={{ marginBottom: "15px" }} variant="h6">{t('Basic Information')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={4} md={4}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Title')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="title"
                      name="title"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.title || null}
                      onChange={formik.handleChange}
                      error={
                        formik.touched.title &&
                        Boolean(formik.errors.title)
                      }
                      helperText={
                        formik.touched.title && formik.errors.title
                      }
                    >
                      <MenuItem value="Mr.">{t('Mr.')}</MenuItem>
                      <MenuItem value="Mrs.">{t('Mrs.')}</MenuItem>
                      <MenuItem value="Miss.">{t('Miss.')}</MenuItem>
                      <MenuItem value="Ms.">{t('Ms.')}</MenuItem>
                      <MenuItem value="Dr.">{t('Dr.')}</MenuItem>
                    </Select>
                    <FormHelperText style={{ color: Palette.error.main }}>{formik.touched.title && formik.errors.title}</FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4} md={4}>
                  <FormLabel>{t('First name')}</FormLabel>
                  <TextField
                    id="fristName"
                    name="firstName"
                    label=""
                    size='small'
                    maxRows={10}
                    fullWidth
                    value={formik.values.firstName}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.firstName &&
                      Boolean(formik.errors.firstName)
                    }
                    helperText={
                      formik.touched.firstName && formik.errors.firstName
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4} md={4}>
                  <FormLabel>{t('Last name')}</FormLabel>
                  <TextField
                    id="lastName"
                    name="lastName"
                    label=""
                    size='small'
                    fullWidth
                    value={formik.values.lastName}
                    onChange={formik.handleChange}
                    error={formik.touched.lastName && Boolean(formik.errors.lastName)}
                    helperText={formik.touched.lastName && formik.errors.lastName}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Date Of Birth')}</FormLabel>
                  <JalaliDatePicker
                    name='dateOfBirth'
                    size='small'
                    fullWidth
                    value={formik.values.dateOfBirth}
                    onChange={formik.handleChange}
                    error={formik.touched.dateOfBirth && Boolean(formik.errors.dateOfBirth)}
                    helperText={formik.touched.dateOfBirth && formik.errors.dateOfBirth}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Phone number')}</FormLabel>
                  <TextField
                    id="phoneNumber"
                    name="phoneNumber"
                    type='number'
                    size='small'
                    fullWidth
                    value={formik.values.phoneNumber}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.phoneNumber &&
                      Boolean(formik.errors.phoneNumber)
                    }
                    helperText={
                      formik.touched.phoneNumber && formik.errors.phoneNumber
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormLabel>{t('Email')}</FormLabel>
                  <TextField
                    id="emailAddress"
                    name="emailAddress"
                    label=""
                    size='small'
                    fullWidth
                    value={formik.values.emailAddress}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.emailAddress &&
                      Boolean(formik.errors.emailAddress)
                    }
                    helperText={
                      formik.touched.emailAddress && formik.errors.emailAddress
                    }
                  />
                </Grid>
                <Grid item xs={12} >
                  <FormControl fullWidth>
                    <FormLabel>{t('Gender')}</FormLabel>
                    <RadioGroup row name="gender" onChange={formik.handleChange} value={formik.values.gender}>
                      <FormControlLabel value="Male" control={<Radio />} label={t('Male')} />
                      <FormControlLabel value="Female" control={<Radio />} label={t('Female')} />
                      <FormControlLabel value="Other" control={<Radio />} label={t('Other')} />
                    </RadioGroup>
                    <FormHelperText style={{ color: Palette.error.main }}>{formik.touched.gender && formik.errors.gender}</FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={12} md={12}>
                  <FormLabel>{t('Address')}</FormLabel>
                  <TextField
                    id="address"
                    name="address"
                    label=""
                    size='small'
                    multiline
                    rows={5}
                    fullWidth
                    value={formik.values.address}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.address &&
                      Boolean(formik.errors.address)
                    }
                    helperText={
                      formik.touched.address && formik.errors.address
                    }
                  />
                </Grid>
              </Grid>
              <Typography
                style={{ marginBottom: "15px", marginTop: "15px" }}
                variant="h6"
              >{t('Source Information')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={12} md={12}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Lead Source')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="leadSource"
                      name="leadSource"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.leadSource || null}
                      onChange={formik.handleChange}

                    >
                      <MenuItem value="Website Referrals">{t('Website Referrals')}</MenuItem>
                      <MenuItem value="Advertising">{t('Advertising')}</MenuItem>
                      <MenuItem value="Social Media">{t('Social Media')}</MenuItem>
                      <MenuItem value="Events and Trade Shows">
                        Events and Trade Shows{" "}
                      </MenuItem>
                      <MenuItem value="Call Centers or Telemarketing">{t('Call Centers or Telemarketing')}</MenuItem>
                      <MenuItem value="Partnerships">{t('Partnerships')}</MenuItem>
                      <MenuItem value="Direct Mail">{t('Direct Mail')}</MenuItem>
                      <MenuItem value="Online Aggregators or Comparison Websites">{t('Online Aggregators or Comparison Websites')}</MenuItem>
                      <MenuItem value="Content Marketing">{t('Content Marketing')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Typography
                style={{ marginBottom: "15px", marginTop: "15px" }}
                variant="h6"
              >{t('Lead Details')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={4} md={4}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Lead Status')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="leadStatus"
                      name="leadStatus"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.leadStatus}
                      onChange={formik.handleChange}

                    >
                      <MenuItem value="New">{t('New')}</MenuItem>
                      <MenuItem value="Contacted">{t('Contacted')}</MenuItem>
                      <MenuItem value="Qualified">{t('Qualified')}</MenuItem>
                      <MenuItem value="Not Qualified">{t('Not Qualified')}</MenuItem>
                      <MenuItem value="In Progress">{t('In Progress')}</MenuItem>
                      <MenuItem value="Closed/Won">{t('Closed/Won')}</MenuItem>
                      <MenuItem value="Closed/Lost">{t('Closed/Lost')}</MenuItem>
                      <MenuItem value="Follow-up Required">{t('Follow-up Required')}</MenuItem>
                      <MenuItem value="On Hold">{t('On Hold')}</MenuItem>
                      <MenuItem value="Converted">{t('Converted')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4} md={4}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Assigned Agent')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="assigned_agent"
                      name="assigned_agent"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.assigned_agent}
                      onChange={formik.handleChange}
                      error={
                        formik.touched.assigned_agent &&
                        Boolean(formik.errors.assigned_agent)
                      }
                      helperText={
                        formik.touched.assigned_agent && formik.errors.assigned_agent
                      }
                    >
                      {
                        user.role === 'admin' ?
                          user.map((user) => {
                            if (user.role === 'admin') {
                              return (
                                <MenuItem key={user._id} value={user._id}>
                                  {`${user.firstName} ${user.lastName}`}
                                </MenuItem>
                              );
                            }
                            return null;
                          })
                          :
                          <MenuItem key={userdata._id} value={userdata._id}>
                            {`${userdata.firstName} ${userdata.lastName}`}
                          </MenuItem>
                      }
                    </Select>
                    <FormHelperText style={{ color: Palette.error.main }}>{formik.touched.assigned_agent && formik.errors.assigned_agent}</FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4} md={4}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Lead score or rating')}</FormLabel>
                    <Typography display="flex">
                      <Rating name="leadScore" precision={0.1} onChange={(event, newValue) => formik.setFieldValue("leadScore", newValue)} />
                    </Typography>
                  </FormControl>
                </Grid>
              </Grid>
              <Typography
                style={{ marginBottom: "15px", marginTop: "15px" }}
                variant="h6"
              >{t('Additional Contact Details')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Alternate phone number')}</FormLabel>
                  <TextField
                    id="alternatePhoneNumber"
                    name="alternatePhoneNumber"
                    type="number"
                    size='small'
                    fullWidth
                    value={formik.values.alternatePhoneNumber}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.alternatePhoneNumber &&
                      Boolean(formik.errors.alternatePhoneNumber)
                    }
                    helperText={
                      formik.touched.alternatePhoneNumber && formik.errors.alternatePhoneNumber
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Additional email address')}</FormLabel>
                  <TextField
                    id="additionalEmailAddress"
                    name="additionalEmailAddress"
                    type="email"
                    size='small'
                    fullWidth
                    value={formik.values.additionalEmailAddress}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.additionalEmailAddress &&
                      Boolean(formik.errors.additionalEmailAddress)
                    }
                    helperText={
                      formik.touched.additionalEmailAddress && formik.errors.additionalEmailAddress
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Instagram profile')}</FormLabel>
                  <TextField
                    id="instagramProfile"
                    name="instagramProfile"
                    size='small'
                    fullWidth
                    onChange={(e) => formik.setFieldValue('instagramProfile', `${e.target.value}`)}
                  />
                  {formik.values.instagramProfile && <a href={`https://www.instagram.com/${formik.values.instagramProfile}`} target="_blank" rel="noreferrer">{t('Link')}</a>}
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Twitter profile')}</FormLabel>
                  <TextField
                    id="twitterProfile"
                    name="twitterProfile"
                    size='small'
                    fullWidth
                    onChange={(e) => formik.setFieldValue('twitterProfile', `${e.target.value}`)}
                  />
                  {formik.values.twitterProfile && <a href={`https://twitter.com/${formik.values.twitterProfile}`} target="_blank" rel="noreferrer">{t('Link')}</a>}
                </Grid>
              </Grid>
              <Typography
                style={{ marginBottom: "15px", marginTop: "15px" }}
                variant="h6"
              >{t('Policy Requirements')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Type of insurance')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="typeOfInsurance"
                      name="typeOfInsurance"
                      size='small'
                      fullWidth
                      value={formik.values.typeOfInsurance}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="Auto">{t('Auto Insurance')}</MenuItem>
                      <MenuItem value="Home Insurance">{t('Home Insurance')}</MenuItem>
                      <MenuItem value="Health Insurance">{t('Health Insurance')}</MenuItem>
                      <MenuItem value="Life Insurance">{t('Life Insurance')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Desired coverage amount')}</FormLabel>
                    <OutlinedInput
                      id="desiredCoverageAmount"
                      name="desiredCoverageAmount"
                      endAdornment={
                        <InputAdornment position="end">&#8377;</InputAdornment>
                      }
                      type='number'
                      size='small'
                      fullWidth
                      value={formik.values.desiredCoverageAmount}
                      onChange={formik.handleChange}
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={12} md={12}>
                  <FormLabel>{t('Specific policy features')}</FormLabel>
                  <TextField
                    id="specificPolicyFeatures"
                    name="specificPolicyFeatures"
                    size='small'
                    rows={3}
                    multiline
                    fullWidth
                    value={formik.values.specificPolicyFeatures}
                    onChange={formik.handleChange}
                  />
                </Grid>
              </Grid>
              <Typography
                style={{ marginBottom: "15px", marginTop: "15px" }}
                variant="h6"
              >{t('Lead Qualification')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={12}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Qualification Status')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="QualificationStatus"
                      name="QualificationStatus"
                      size='small'
                      fullWidth
                      value={formik.values.QualificationStatus}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="Qualified">{t('Qualified')}</MenuItem>
                      <MenuItem value="Not Qualified">{t('Not Qualified')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

              </Grid>
              <Typography
                style={{ marginBottom: "15px", marginTop: "15px" }}
                variant="h6"
              >{t('Lead Conversion Information')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Policy Type')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="policyType"
                      name="policyType"
                      size='small'
                      fullWidth
                      value={formik.values.policyType}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="Auto">{t('Auto Insurance')}</MenuItem>
                      <MenuItem value="Home Insurance">{t('Home Insurance')}</MenuItem>
                      <MenuItem value="Health Insurance">{t('Health Insurance')}</MenuItem>
                      <MenuItem value="Life Insurance">{t('Life Insurance')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Policy Number')}</FormLabel>
                  <TextField
                    id="policyNumber"
                    name="policyNumber"
                    type='number'
                    size='small'
                    fullWidth
                    value={formik.values.policyNumber}
                    onChange={formik.handleChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Start Date')}</FormLabel>
                  <JalaliDatePicker
                    id="startDate"
                    name="startDate"
                    size='small'
                    fullWidth
                    value={formik.values.startDate}
                    onChange={formik.handleChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('End Date')}</FormLabel>
                  <JalaliDatePicker
                    id="endDate"
                    name="endDate"
                    size='small'
                    fullWidth
                    value={formik.values.endDate}
                    onChange={formik.handleChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Coverage Amount')}</FormLabel>
                  <OutlinedInput
                    id="coverageAmount"
                    name="coverageAmount"
                    endAdornment={
                      <InputAdornment position="end">&#8377;</InputAdornment>
                    }
                    type='number'
                    size='small'
                    fullWidth
                    value={formik.values.coverageAmount}
                    onChange={formik.handleChange}
                  />

                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Term Length')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="termLength"
                      name="termLength"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.termLength}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="1 year">1 year</MenuItem>
                      <MenuItem value="2 years">2 years </MenuItem>
                      <MenuItem value="5 years">5 years </MenuItem>
                      <MenuItem value="10 years">10 years </MenuItem>
                      <MenuItem value="15 years">15 years</MenuItem>
                    </Select>
                  </FormControl>

                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Conversion Reason')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="conversionReason"
                      name="conversionReason"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.conversionReason}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="Coverage Needs">{t('Coverage Needs')}</MenuItem>
                      <MenuItem value="Trust and Reputation">{t('Trust and Reputation')}</MenuItem>
                      <MenuItem value="Competitive Pricing">{t('Competitive Pricing')}</MenuItem>
                      <MenuItem value="Excellent Customer Service">{t('Excellent Customer Service')}</MenuItem>
                      <MenuItem value="Referrals or Recommendations">{t('Referrals or Recommendations')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormLabel>{t('Conversion Date&Time')}</FormLabel>
                  <JalaliDatePicker
                    id=""
                    name="conversionDateTime"
                    showTime
                    size='small'
                    fullWidth
                    value={formik.values.conversionDateTime}
                    onChange={formik.handleChange}
                  />
                </Grid>
              </Grid>
              <Typography
                style={{ marginBottom: "15px", marginTop: "15px" }}
                variant="h6"
              >{t('Lead Segmentation')}</Typography>
              <Grid
                container
                rowSpacing={3}
                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
              >
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Lead Category')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="leadCategory"
                      name="leadCategory"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.leadCategory}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="Hot Lead">{t('Hot Lead')}</MenuItem>
                      <MenuItem value="Cold Lead">{t('Cold Lead')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <FormLabel>{t('Lead Priority')}</FormLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="leadPriority"
                      name="leadPriority"
                      label=""
                      size='small'
                      fullWidth
                      value={formik.values.leadPriority}
                      onChange={formik.handleChange}
                    >
                      <MenuItem value="High">{t('High')}</MenuItem>
                      <MenuItem value="Medium">{t('Medium')}</MenuItem>
                      <MenuItem value="Low">{t('Low')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </DialogContentText>

            {/* File Upload Section */}
            <Typography style={{ marginBottom: "15px" }} variant="h6" mt={3}>{t('Attached Documents')}</Typography>
            <Box mb={2}>
              <Button variant="outlined" component="label" startIcon={<GetApp />}>
                {t('Upload File')}
                <input type="file" hidden onChange={(e) => {
                  if (e.target.files[0]) {
                    setTempFile(e.target.files[0]);
                    setTempFileName(e.target.files[0].name);
                    setOpenDocDialog(true);
                  }
                }} />
              </Button>
            </Box>

            {/* Upload Dialog */}
            <Dialog open={openDocDialog} onClose={() => setOpenDocDialog(false)} maxWidth="sm" fullWidth>
              <DialogTitle>{t('Upload Document')}</DialogTitle>
              <Close onClick={() => setOpenDocDialog(false)} sx={{ position: 'absolute', right: 8, top: 8, cursor: 'pointer' }} />
              <DialogContent>
                <Box sx={{ pt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>{t('File Description')}</Typography>
                  <TextField
                    fullWidth size="small"
                    value={tempFileName}
                    onChange={(e) => setTempFileName(e.target.value)}
                    placeholder="e.g., Application Form, ID Proof, etc."
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="body2">{t('File Selected:')} {tempFile?.name}</Typography>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setOpenDocDialog(false)} color="error">{t('Cancel')}</Button>
                <Button onClick={() => {
                  if (!tempFile) return;
                  uploadFileToLead(_id || 'temp', tempFile, tempFileName);
                }} variant="contained" disabled={docUploadLoading || !tempFile}>
                  {docUploadLoading ? <CircularProgress size={20} /> : t('Upload')}
                </Button>
              </DialogActions>
            </Dialog>
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={formik.handleSubmit} variant='contained' color='primary'>{t('Save')}</Button>
          <Button onClick={() => {
            formik.resetForm()
            handleClose()
          }} variant='outlined' color='error'>Cancle</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Add