/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import ClearIcon from "@mui/icons-material/Clear";
import { useFormik } from "formik";
import * as yup from "yup";
import { useEffect, useState } from "react";
import { Autocomplete, FormControl, FormHelperText, FormLabel, Select } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import { useParams } from "react-router-dom";
import { apiget, apiput } from "../../service/api";

import { useTranslation } from '../../i18n';
import JalaliDatePicker from '../jalali/JalaliDatePicker';

const DIRECTIONS = ["Outbound", "Inbound"];
const STATUSES = ["Answered", "Missed", "No Answer", "Busy", "Failed"];
// hh:mm:ss (or m:ss)
const DURATION_REGEX = /^\d{1,2}:[0-5]\d(:[0-5]\d)?$/;

const Editcalls = (props) => {
  const { t } = useTranslation();
    const { handleClose, open, id, fetchcalls } = props

    const [callDetails, setCallDetails] = useState({});
    const [leadData, setLeadData] = useState([])
    const [contactData, setContactData] = useState([])

    const userRole = localStorage.getItem("userRole");
    const userid = localStorage.getItem('user_id')

    const params = useParams();

    // -----------  validationSchema
    const validationSchema = yup.object({
        direction: yup.string().oneOf(DIRECTIONS).required("Direction is required"),
        phoneNumber: yup.string().matches(/^[0-9*#+()\s-]*$/, "Invalid phone number"),
        status: yup.string().oneOf(STATUSES.concat(["Planned", "Held", "Not Held"])).required("Status is required"),
        startDateTime: yup.string().required("Start Date & Time is required"),
        duration: yup
            .string()
            .matches(DURATION_REGEX, "Duration must look like 00:05:30")
            .required("Duration is required"),
        relatedTo: yup.string(),
        note: yup.string(),
    });

    // legacy rows may only carry the direction inside their subject
    const initialDirection =
        callDetails.direction ||
        (/^inbound/i.test(callDetails.subject || "") ? "Inbound" : "Outbound");

    // -----------   initialValues
    const initialValues = {
        subject: callDetails.subject,
        direction: initialDirection,
        phoneNumber: callDetails.phoneNumber || "",
        status: callDetails.status,
        startDateTime: callDetails.startDateTime,
        duration: callDetails.duration,
        relatedTo: callDetails.relatedTo,
        note: callDetails.note,
        lead_id: callDetails?.lead_id?._id,
        contact_id: callDetails?.contact_id?._id,
        modifiedOn: ""

    };

    // fetch api
    const fetchdata = async () => {
        const result = await apiget(`call/view/${params.id}`)
        if (result && result.status === 200) {
            setCallDetails(result?.data?.calls)
        }
    }

    // lead api
    const fetchLeadData = async () => {
        const result = await apiget(userRole === 'admin' ? `lead/list` : `lead/list/?createdBy=${userid}`)
        if (result && result.status === 200) {
            setLeadData(result?.data?.result)
        }
    }

    // contact api
    const fetchContactData = async () => {
        const result = await apiget(userRole === 'admin' ? `contact/list` : `contact/list/?createdBy=${userid}`)
        if (result && result.status === 200) {
            setContactData(result?.data?.result)
        }
    }

    // edit api
    const EditCall = async (values) => {
        const data = values;
        const result = await apiput(`call/edit/${id}`, data)
        if (result && result.status === 200) {
            handleClose();
            fetchcalls();
        }
    }

    const formik = useFormik({
        initialValues,
        validationSchema,
        enableReinitialize: true,
        onSubmit: async (values) => {
            const callData = {
                subject: values.subject,
                direction: values.direction,
                phoneNumber: values.phoneNumber,
                status: values.status,
                startDateTime: values.startDateTime,
                duration: values.duration,
                relatedTo: values.relatedTo,
                note: values.note,
                lead_id: values.lead_id,
                contact_id: values.contact_id,
                modifiedOn: new Date()
            }
            EditCall(callData)
        },
    });

    useEffect(() => {
        fetchdata();
        fetchLeadData();
        fetchContactData();
    }, [])

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
                    <Typography variant="h6">{t('Edit Call')}</Typography>
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
                            <Grid
                                container
                                rowSpacing={3}
                                columnSpacing={{ xs: 0, sm: 5, md: 4 }}
                            >
                                <Grid item xs={12} sm={6} md={6}>
                                    <FormControl fullWidth>
                                        <FormLabel>{t('Direction')}</FormLabel>
                                        <Select
                                            labelId="demo-simple-select-label"
                                            id="direction"
                                            name="direction"
                                            size="small"
                                            value={formik.values.direction}
                                            onChange={formik.handleChange}
                                            error={formik.touched.direction && Boolean(formik.errors.direction)}
                                        >
                                            {DIRECTIONS.map((d) => (
                                                <MenuItem key={d} value={d}>{t(d)}</MenuItem>
                                            ))}
                                        </Select>
                                        <FormHelperText
                                            error={
                                                formik.touched.direction && Boolean(formik.errors.direction)
                                            }
                                        >
                                            {formik.touched.direction && formik.errors.direction}
                                        </FormHelperText>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6} md={6}>
                                    <FormLabel>{t('Phone Number')}</FormLabel>
                                    <TextField
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        size="small"
                                        fullWidth
                                        placeholder="09121234567"
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
                                <Grid item xs={12} sm={6} md={6}>
                                    <FormControl fullWidth>
                                        <FormLabel>{t('Status')}</FormLabel>
                                        <Select
                                            labelId="demo-simple-select-label"
                                            id="status"
                                            name="status"
                                            size="small"
                                            value={formik.values.status}
                                            onChange={formik.handleChange}
                                            error={formik.touched.status && Boolean(formik.errors.status)}
                                        >
                                            <MenuItem value="Planned">{t('Planned')}</MenuItem>
                                            <MenuItem value="Held">{t('Held')}</MenuItem>
                                            <MenuItem value="Not Held">{t('Not Held')}</MenuItem>
                                            <MenuItem value="Answered">{t('Answered')}</MenuItem>
                                            <MenuItem value="Missed">{t('Missed')}</MenuItem>
                                            <MenuItem value="No Answer">{t('No Answer')}</MenuItem>
                                            <MenuItem value="Busy">{t('Busy')}</MenuItem>
                                            <MenuItem value="Failed">{t('Failed')}</MenuItem>
                                        </Select>
                                        <FormHelperText
                                            error={
                                                formik.touched.status && Boolean(formik.errors.status)
                                            }
                                        >
                                            {formik.touched.status && formik.errors.status}
                                        </FormHelperText>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormLabel>{t('Start Date & Time')}</FormLabel>
                                    <JalaliDatePicker
                                        id="startDateTime"
                                        name="startDateTime"
                                        size="small"
                                        showTime
                                        fullWidth
                                        value={formik.values.startDateTime}
                                        onChange={formik.handleChange}
                                        error={
                                            formik.touched.startDateTime &&
                                            Boolean(formik.errors.startDateTime)
                                        }
                                        helperText={
                                            formik.touched.startDateTime && formik.errors.startDateTime
                                        }
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormLabel>{t('Duration')}</FormLabel>
                                    <TextField
                                        id="duration"
                                        name="duration"
                                        size="small"
                                        fullWidth
                                        placeholder="00:05:30"
                                        value={formik.values.duration}
                                        onChange={formik.handleChange}
                                        error={
                                            formik.touched.duration && Boolean(formik.errors.duration)
                                        }
                                        helperText={
                                            formik.touched.duration
                                                ? formik.errors.duration || "hh:mm:ss"
                                                : "hh:mm:ss"
                                        }
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <FormLabel>{t('Related To')}</FormLabel>
                                        <Select
                                            labelId="demo-simple-select-label"
                                            id="relatedTo"
                                            name="relatedTo"
                                            size="small"
                                            value={formik.values.relatedTo}
                                            onChange={formik.handleChange}
                                            error={formik.touched.relatedTo && Boolean(formik.errors.relatedTo)}
                                        >
                                            <MenuItem value="Lead">{t('Lead')}</MenuItem>
                                            <MenuItem value="Contact">{t('Contact')}</MenuItem>
                                        </Select>
                                        <FormHelperText
                                            error={
                                                formik.touched.relatedTo && Boolean(formik.errors.relatedTo)
                                            }
                                        >
                                            {formik.touched.relatedTo && formik.errors.relatedTo}
                                        </FormHelperText>
                                    </FormControl>
                                </Grid>
                                {
                                    formik.values.relatedTo === "Lead" &&
                                    <Grid item xs={12} sm={6}>
                                        <FormLabel>{t('Lead')}</FormLabel>
                                        <Autocomplete
                                            id="lead-autocomplete"
                                            options={leadData}
                                            getOptionLabel={(lead) => `${lead.firstName} ${lead.lastName}`}
                                            value={leadData.find(lead => lead._id === formik.values.lead_id) || null}
                                            onChange={(event, newValue) => {
                                                formik.setFieldValue("lead_id", newValue ? newValue._id : "");
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    size="small"
                                                    error={formik.touched.lead_id && Boolean(formik.errors.lead_id)}
                                                    helperText={formik.touched.lead_id && formik.errors.lead_id}
                                                />
                                            )}
                                        />
                                    </Grid>
                                }
                                {
                                    formik.values.relatedTo === "Contact" &&
                                    <Grid item xs={12} sm={6}>
                                        <FormLabel>{t('Contact')}</FormLabel>
                                        <Autocomplete
                                            id="contact-autocomplete"
                                            options={contactData}
                                            getOptionLabel={(contact) => `${contact.firstName} ${contact.lastName}`}
                                            value={contactData.find(contact => contact._id === formik.values.contact_id) || null}
                                            onChange={(event, newValue) => {
                                                formik.setFieldValue("contact_id", newValue ? newValue._id : "");
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    size="small"
                                                    error={formik.touched.contact_id && Boolean(formik.errors.contact_id)}
                                                    helperText={formik.touched.contact_id && formik.errors.contact_id}
                                                />
                                            )}
                                        />
                                    </Grid>
                                }
                                <Grid item xs={12} sm={12}>
                                    <FormLabel>{t('Note')}</FormLabel>
                                    <TextField
                                        id="note"
                                        name="note"
                                        size="small"
                                        fullWidth
                                        rows={4}
                                        multiline
                                        value={formik.values.note}
                                        onChange={formik.handleChange}
                                        error={
                                            formik.touched.note &&
                                            Boolean(formik.errors.note)
                                        }
                                        helperText={
                                            formik.touched.note && formik.errors.note
                                        }
                                    />
                                </Grid>
                            </Grid>
                        </DialogContentText>
                    </form>
                </DialogContent>
                <DialogActions>
                    <Button
                        type="submit"
                        variant="contained"
                        onClick={formik.handleSubmit}
                        style={{ textTransform: "capitalize" }}
                        color="secondary"
                    >{t('Save')}</Button>
                    <Button
                        type="reset"
                        variant="outlined"
                        style={{ textTransform: "capitalize" }}
                        onClick={() => {
                            formik.resetForm()
                            handleClose()
                        }}
                        color="error"
                    >
                        Cancle
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default Editcalls