/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import ClearIcon from "@mui/icons-material/Clear";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useFormik } from "formik";
import * as yup from "yup";
import { FormControlLabel, FormHelperText, FormLabel, Radio, RadioGroup } from "@mui/material";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { apiget, apiput } from "../../service/api";
import Palette from "../../theme/palette";


import { useTranslation } from '../../i18n';
import JalaliDatePicker from '../../components/jalali/JalaliDatePicker';
const Edit = (props) => {
  const { t } = useTranslation();

  const { open, handleClose, id, fetchContact } = props
  const [contactData, setContactData] = useState({});



  // -----------  validationSchema
  const validationSchema = yup.object({
    firstName: yup.string().required("First Name is required"),
    lastName: yup.string().required("Last Name is required"),
    dateOfBirth: yup.date().required("Date of Birth is required"),
    gender: yup.string().required("Gender is required"),
    phoneNumber: yup.string().matches(/^[0-9]{10}$/, 'Phone number is invalid').required('Phone number is required'),
    emailAddress: yup.string().email('Invalid email').required("Email is required"),
    address: yup.string().required(),
    alternatePhoneNumber: yup.string().matches(/^[0-9]{10}$/, 'Phone number is invalid'),
    additionalEmailAddress: yup.string().email('Invalid email')
  });

  // -----------   initialValues
  const initialValues = {
    firstName: contactData?.firstName,
    lastName: contactData?.lastName,
    dateOfBirth: contactData?.dateOfBirth,
    gender: contactData?.gender,
    phoneNumber: contactData?.phoneNumber,
    emailAddress: contactData?.emailAddress,
    address: contactData?.address,
    alternatePhoneNumber: contactData?.alternatePhoneNumber,
    additionalEmailAddress: contactData?.additionalEmailAddress,
    instagramProfile: contactData?.instagramProfile,
    twitterProfile: contactData?.twitterProfile,
    preferredContactMethod: contactData?.preferredContactMethod,
    referralSource: contactData?.referralSource,
    referralContactName: contactData?.referralContactName,
    relationshipToReferrer: contactData?.relationshipToReferrer,
    preferencesForMarketingCommunications: contactData?.preferencesForMarketingCommunications,
    preferredLanguage: contactData?.preferredLanguage,
    modifiedOn: ""
  };

  // add Contact Edit api
  const editContact = async (values) => {
    const data = values;
    const result = await apiput(`contact/edit/${id}`, data)

    if (result && result.status === 200) {
      handleClose();
      fetchContact();
    }
  }

  // fetch api
  const fetchdata = async () => {
    const result = await apiget(`contact/view/${id}`)
    if (result && result.status === 200) {
      setContactData(result?.data[0])
    }
  }

  useEffect(() => {
    fetchdata();
  }, [open])


  // formik
  const formik = useFormik({
    initialValues,
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      const ContactData = {
        firstName: values.firstName,
        lastName: values.lastName,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        phoneNumber: values.phoneNumber,
        emailAddress: values.emailAddress,
        address: values.address,
        alternatePhoneNumber: values.alternatePhoneNumber,
        additionalEmailAddress: values.additionalEmailAddress,
        instagramProfile: values.instagramProfile,
        twitterProfile: values.twitterProfile,
        preferredContactMethod: values.preferredContactMethod,
        referralSource: values.referralSource,
        referralContactName: values.referralContactName,
        relationshipToReferrer: values.relationshipToReferrer,
        preferencesForMarketingCommunications: values.preferencesForMarketingCommunications,
        preferredLanguage: values.preferredLanguage,
        modifiedOn: new Date()
      }
      editContact(ContactData)

    },
  });

  return (
    <div>
      <Dialog
        open={open}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
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
          <Typography variant="h6">{t('Edit')}</Typography>
          <Typography>
            <ClearIcon
              onClick={handleClose}
              style={{ cursor: "pointer" }}
            />
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <form>
            <Typography style={{ marginBottom: "15px" }} variant="h6">{t('Basic Information')}</Typography>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 0, sm: 5, md: 4 }}
            >
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('First name')}</FormLabel>
                <TextField
                  id="firstName"
                  name="firstName"
                  size="small"
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
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Last name')}</FormLabel>
                <TextField
                  id="lastName"
                  name="lastName"
                  size="small"
                  fullWidth
                  value={formik.values.lastName}
                  onChange={formik.handleChange}
                  error={
                    formik.touched.lastName && Boolean(formik.errors.lastName)
                  }
                  helperText={
                    formik.touched.lastName && formik.errors.lastName
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Date Of Birth')}</FormLabel>
                <JalaliDatePicker
                  name='dateOfBirth'
                  size='small'
                  fullWidth
                  value={dayjs(formik.values.dateOfBirth).format('YYYY-MM-DD')}
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
                  size="small"
                  type="number"
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
              <Grid item xs={12} >
                <FormLabel>{t('Email')}</FormLabel>
                <TextField
                  id="emailAddress"
                  name="emailAddress"
                  size="small"
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
                  size="small"
                  multiline
                  fullWidth
                  value={formik.values.address}
                  onChange={formik.handleChange}
                  error={
                    formik.touched.address && Boolean(formik.errors.address)
                  }
                  helperText={formik.touched.address && formik.errors.address}
                />
              </Grid>
            </Grid>
            <Typography style={{ marginBottom: "15px" }} variant="h6" mt={2}>{t('Additional Contact Details')}</Typography>
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
                  size="small"
                  fullWidth
                  value={formik.values.alternatePhoneNumber}
                  onChange={formik.handleChange}
                  error={
                    formik.touched.alternatePhoneNumber && Boolean(formik.errors.alternatePhoneNumber)
                  }
                  helperText={formik.touched.alternatePhoneNumber && formik.errors.alternatePhoneNumber}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Additional email address')}</FormLabel>
                <TextField
                  id="additionalEmailAddress"
                  name="additionalEmailAddress"
                  type="email"
                  size="small"
                  fullWidth
                  value={formik.values.additionalEmailAddress}
                  onChange={formik.handleChange}
                  error={
                    formik.touched.additionalEmailAddress && Boolean(formik.errors.additionalEmailAddress)
                  }
                  helperText={formik.touched.additionalEmailAddress && formik.errors.additionalEmailAddress}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Instagram profile')}</FormLabel>
                <TextField
                  id="instagramProfile"
                  name="instagramProfile"
                  type=""
                  size="small"
                  fullWidth
                  value={formik.values.instagramProfile}
                  onChange={(e) => formik.setFieldValue('instagramProfile', `${e.target.value}`)}
                />
                {formik.values.instagramProfile && <a href={`https://www.instagram.com/${formik.values.instagramProfile}`} target="_blank" rel="noreferrer">{t('Link')}</a>}
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Twitter profile')}</FormLabel>
                <TextField
                  id="twitterProfile"
                  name="twitterProfile"
                  type=""
                  size="small"
                  fullWidth
                  value={formik.values.twitterProfile}
                  onChange={(e) => formik.setFieldValue('twitterProfile', `${e.target.value}`)}
                />
                {formik.values.twitterProfile && <a href={`https://twitter.com/${formik.values.twitterProfile}`} target="_blank" rel="noreferrer">{t('Link')}</a>}
              </Grid>
              <Grid item xs={12} sm={12}>
                <FormLabel>{t('Preferred Contact Method')}</FormLabel>
                <TextField
                  id="preferredContactMethod"
                  name="preferredContactMethod"
                  type=""
                  size="small"
                  fullWidth
                  value={formik.values.preferredContactMethod}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
            <Typography style={{ marginBottom: "15px" }} variant="h6" mt={2}>{t('Referral Information')}</Typography>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 0, sm: 5, md: 4 }}
            >
              <Grid item xs={12} sm={6} md={6}>
                <FormControl fullWidth>
                  <FormLabel>{t('Referral source')}</FormLabel>
                  <Select
                    labelId="demo-simple-select-label"
                    id="referralSource"
                    name="referralSource"
                    size="small"
                    value={formik.values.referralSource}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.referralSource && Boolean(formik.errors.referralSource)
                    }
                  >
                    <MenuItem value="Existing Customers">{t('Existing Customers')}</MenuItem>
                    <MenuItem value="Professional Networks">{t('Professional Networks')}</MenuItem>
                    <MenuItem value="Business Partnerships">{t('Business Partnerships')}</MenuItem>
                    <MenuItem value="Employee Referrals">{t('Employee Referrals')}</MenuItem>
                    <MenuItem value="Online Reviews and Social Media">{t('Online Reviews and Social Media')}</MenuItem>
                  </Select>
                  <FormHelperText
                    error={
                      formik.touched.referralSource && Boolean(formik.errors.referralSource)
                    }
                  >
                    {formik.touched.referralSource && formik.errors.referralSource}
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Referral Contact Name')}</FormLabel>
                <TextField
                  id="referralContactName"
                  name="referralContactName"
                  size="small"
                  fullWidth
                  value={formik.values.referralContactName}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Relationship To Referrer')}</FormLabel>
                <TextField
                  id="relationshipToReferrer"
                  name="relationshipToReferrer"
                  size="small"
                  fullWidth
                  value={formik.values.relationshipToReferrer}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
            <Typography style={{ marginBottom: "15px" }} variant="h6" mt={2}>{t('Communication Preferences')}</Typography>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 0, sm: 5, md: 4 }}
            >
              <Grid item xs={12} sm={6} md={6}>
                <FormControl fullWidth>
                  <FormLabel>{t('Marketing Communications')}</FormLabel>
                  <Select
                    labelId="demo-simple-select-label"
                    id="preferencesForMarketingCommunications"
                    name="preferencesForMarketingCommunications"
                    size="small"
                    value={formik.values.preferencesForMarketingCommunications}
                    onChange={formik.handleChange}
                    error={
                      formik.touched.preferencesForMarketingCommunications && Boolean(formik.errors.preferencesForMarketingCommunications)
                    }
                  >
                    <MenuItem value="Opt-in">{t('Opt-in')}</MenuItem>
                    <MenuItem value="Opt-out">{t('Opt-out')}</MenuItem>
                  </Select>
                  <FormHelperText
                    error={
                      formik.touched.preferencesForMarketingCommunications && Boolean(formik.errors.preferencesForMarketingCommunications)
                    }
                  >
                    {formik.touched.preferencesForMarketingCommunications && formik.errors.preferencesForMarketingCommunications}
                  </FormHelperText>
                </FormControl>

              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <FormLabel>{t('Preferred language')}</FormLabel>
                <TextField
                  id="preferredLanguage"
                  name="preferredLanguage"
                  type=""
                  size="small"
                  fullWidth
                  value={formik.values.preferredLanguage}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
          </form>
        </DialogContent>
        <DialogActions>
          <Button
            type="submit"
            variant="contained"
            onClick={formik.handleSubmit}
            style={{ textTransform: "capitalize" }}
          >{t('Save')}</Button>
          <Button
            type="reset"
            variant="outlined"
            style={{ textTransform: "capitalize" }}
            color="error"
            onClick={() => {
              formik.resetForm()
              handleClose()
            }}
          >
            Cancle
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Edit