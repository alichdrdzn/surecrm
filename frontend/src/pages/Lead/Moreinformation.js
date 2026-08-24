/* eslint-disable react/prop-types */
import { Box, Card, Grid, Rating, Typography } from '@mui/material'
import React from 'react'
import moment from 'moment'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import Palette from '../../theme/palette'

import { useTranslation } from '../../i18n';
import { useDateFmt } from '../../utils/dateFmt';
const Moreinformation = ({ data }) => {
  const { t } = useTranslation();
  const { fd, fdt } = useDateFmt();
    // open instagram
    const handleInsta = (link) => {
        const url = `https://www.instagram.com/${link}`
        window.open(url)
    }

    // open Twitter
    const handleTwitter = (link) => {
        const url = `https://twitter.com/${link}`
        window.open(url)
    }

    return (
        <div>
            <Card style={{borderTopLeftRadius:"0px",borderTopRightRadius:"0px"}}>
                <Box p={3}>
                    <Grid container display="flex" spacing={4}>
                        <Grid item xs={12} sm={12}>
                            <Typography variant="h4" >{t('Source Information :-')}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} >
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Lead Source :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.leadSource ? data?.leadSource : "--"}</Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Lead Status :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.leadStatus ? data?.leadStatus : "--"}</Typography>
                            </Grid>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Lead Score :')}</Typography>
                                <Typography display="flex">
                                    <Typography variant="body2" color={Palette.grey[600]} >
                                        <Rating name="lead_score" precision={0.1} value={data?.leadScore} readOnly size="small" />
                                    </Typography>
                                    <Typography variant="body2" color={Palette.grey[600]} pl={1}>{data?.leadScore}</Typography>
                                </Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Assigned Agent :')}</Typography>
                                <Typography variant="body2" color={Palette.primary.main} textTransform={"capitalize"}>
                                    <Link to={`/dashboard/user/view/${data?.assigned_agent?._id}`} style={{ cursor: "pointer",textDecoration:"none", color: Palette.primary.main }}>
                                        {`${data?.assigned_agent.firstName} ${data?.assigned_agent.lastName}`}
                                    </Link>
                                </Typography>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} sm={12}>
                            <Typography variant="h4" >{t('Additional Contact Details :-')}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Alternate Phone Number :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.alternatePhoneNumber ? data?.alternatePhoneNumber : "--"}</Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Additional Email Address :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.additionalEmailAddress ? data?.additionalEmailAddress : "--"}</Typography>
                            </Grid>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Instagram Profile :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]} onClick={() => data?.instagramProfile ? handleInsta(data?.instagramProfile) : "--"} style={{ cursor: "pointer", textDecoration: "none", color: Palette.primary.main }}>
                                    {data?.instagramProfile ? data?.instagramProfile : "--"}
                                </Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Twitter Profile :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]} onClick={() => data?.twitterProfile ? handleTwitter(data?.twitterProfile) : "--"} style={{ cursor: "pointer", textDecoration: "none", color: Palette.primary.main }}>
                                    {data?.twitterProfile ? data?.twitterProfile : "--"}
                                </Typography>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} sm={12}>
                            <Typography variant="h4" >{t('Policy Requirements :-')}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Types Of Insurance :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.typeOfInsurance ? data?.typeOfInsurance : "--"}</Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Desired Coverage Amount :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.desiredCoverageAmount ? data?.desiredCoverageAmount : "--"} <span style={{ marginLeft: "3px" }}>&#8377;</span></Typography>
                            </Grid>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Specifice Policy Feature Or Add-ons Requested :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.specificPolicyFeatures ? data?.specificPolicyFeatures : "--"}</Typography>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} sm={12}>
                            <Typography variant="h4">{t('Lead Qualification :-')}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={12}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1"> Qualification Status : </Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.QualificationStatus ? data?.QualificationStatus : "--"}</Typography>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} sm={12}>
                            <Typography variant="h4" >{t('Lead Conversion Information :-')}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">Policy Types :</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.policyType ? data?.policyType : "--"}</Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Start Date :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>
                                    {
                                        data?.startDate ? dayjs(data?.startDate).format('MM/DD/YYYY') : "--"
                                    }
                                </Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Coverage Amount :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.coverageAmount ? data?.coverageAmount : "--"} <span style={{ marginLeft: "3px" }}>&#8377;</span></Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Conversion Date & Time :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>
                                    {data?.conversionDateTime ? fdt(data?.conversionDateTime) : "--"}
                                </Typography>
                            </Grid>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Policy Number :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.policyNumber ? data?.policyNumber : "--"} </Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('End Date :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>
                                    <Typography variant="body2" color={Palette.grey[600]}>
                                        {
                                            data?.endDate ? dayjs(data?.endDate).format('MM/DD/YYYY') : "--"
                                        }
                                    </Typography>
                                </Typography>
                            </Grid>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                                <Typography variant="body1">{t('Tearm Length :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.termLength ? data?.termLength : "--"}</Typography>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} sm={12}>
                            <Typography variant="h4">{t('Lead Segmentation :-')}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Lead category or segment :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.leadCategory ? data?.leadCategory : "--"}</Typography>
                            </Grid>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                                <Typography variant="body1">{t('Lead priority or urgency level :')}</Typography>
                                <Typography variant="body2" color={Palette.grey[600]}>{data?.leadPriority ? data?.leadPriority : "--"}</Typography>
                            </Grid>
                        </Grid>
                    </Grid>
                </Box>
            </Card>
        </div >
    )
}

export default Moreinformation
