/* eslint-disable react/prop-types */
import { Box, Card, Grid, Typography } from '@mui/material'
import React from 'react'
import { Link } from 'react-router-dom'
import moment from 'moment'
import Palette from '../../theme/palette'


// eslint-disable-next-line arrow-body-style
import { useTranslation } from '../../i18n';
import { useDateFmt } from '../../utils/dateFmt';

const Overview = ({ data }) => {
  const { t } = useTranslation();
  const { fd, fdt } = useDateFmt();
  return (
    <div>
      <Card style={{ borderTopLeftRadius: "0px", borderTopRightRadius: "0px" }}>
        <Box p={3}>
          <Grid container display="flex" spacing={4}>
            <Grid item xs={12} sm={6}>
              <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                <Typography variant="body1">{t('Subject :')}</Typography>
                <Typography variant="body2" color={Palette.grey[600]} textTransform={"capitalize"}>{data?.subject}</Typography>
              </Grid>
              <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400], }} py={2}>
                <Typography variant="body1">{t('Call Date & Time :')}</Typography>
                <Typography variant="body2" color={Palette.grey[600]} >
                  {
                    data?.startDateTime ? fdt(data?.startDateTime) : "null"
                  }
                </Typography>
              </Grid>
              <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                <Typography variant="body1">{t('Phone Number :')}</Typography>
                <Typography variant="body2" color={Palette.grey[600]} >{data?.phoneNumber || '-'}</Typography>
              </Grid>
              <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                <Typography variant="body1">{t('Note :')}</Typography>
                <Typography variant="body2" color={Palette.grey[600]} >{data?.note}</Typography>
              </Grid>

            </Grid>

            <Grid item xs={12} sm={6}>
              <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
                <Typography variant="body1">{t('Status :')}</Typography>
                <Typography variant="body2" color={Palette.grey[600]} >{data?.status}</Typography>
              </Grid>
              <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                <Typography variant="body1">{t('Duration :')}</Typography>
                <Typography variant="body2" color={Palette.grey[600]} >{data?.duration}</Typography>
              </Grid>
              {
                (data?.lead_id?._id || data?.contact_id?._id) &&
                <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                  <Typography variant="body1">Related To {data?.lead_id?._id ? 'Lead' : 'Contact'} :</Typography>
                  {
                    data?.relatedTo === "Lead" ?
                      <Link to={`/dashboard/lead/view/${data?.lead_id?._id}`} style={{ textDecoration: "none" }}>
                        <Typography variant="body2" color={Palette.primary.main} textTransform={"capitalize"}>{`${data?.lead_id?.firstName} ${data?.lead_id?.lastName}`}</Typography>
                      </Link>
                      :
                      <Link to={`/dashboard/contact/view/${data?.contact_id?._id}`} style={{ textDecoration: "none" }}>
                        <Typography variant="body2" color={Palette.primary.main} textTransform={"capitalize"}>{`${data?.contact_id?.firstName} ${data?.contact_id?.lastName}`}</Typography>
                      </Link>
                  }
                </Grid>
              }
            </Grid>
          </Grid>
        </Box>
      </Card>
    </div>
  )
}

export default Overview
