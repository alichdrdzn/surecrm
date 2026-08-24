/* eslint-disable react/prop-types */
import { Box, Grid, Typography } from '@mui/material'
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
      <Box mt="0px" style={{ borderTop: "1px solid", borderTopColor: Palette.grey[400] }} p={3}>
        <Grid container display="flex" spacing={4}>
          <Grid item xs={12} sm={6}>
            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
              <Typography variant="body1">{t('Sender :')}</Typography>
              <Typography variant="body2" color={Palette.grey[600]}>{data?.sender ? data?.sender : "--"}</Typography>
            </Grid>

            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
              <Typography variant="body1">{t('Subject :')}</Typography>
              <Typography variant="body2" color={Palette.grey[600]}>{data?.subject ? data?.subject : "--"}</Typography>
            </Grid>

            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
              <Typography variant="body1">{t('Message :')}</Typography>
              <Typography variant="body2" color={Palette.grey[600]}>{data?.message ? data?.message : "--"}</Typography>
            </Grid>
            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
              <Typography variant="body1">{t('CreateOn :')}</Typography>
              <Typography variant="body2" color={Palette.grey[600]}>
                {fdt(data?.createdOn)}
              </Typography>
            </Grid>

          </Grid>
          <Grid item xs={12} sm={6}>
            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} pb={2}>
              <Typography variant="body1">{t('Receiver :')}</Typography>
              <Typography variant="body2" color={Palette.grey[600]}>{data?.receiver ? data?.receiver : "--"}</Typography>
            </Grid>
            <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
              <Typography variant="body1">{t('Created by :')}</Typography>
              {
                <Link to={`/dashboard/user/view/${data?.createdBy?._id}`} style={{textDecoration:"none"}}>
                  <Typography variant="body2" color={Palette.primary.main} textTransform={"capitalize"}>
                    {`${data?.createdBy?.firstName} ${data?.createdBy?.lastName}`}
                  </Typography>
                </Link>
              }
            </Grid>
            {
              <Grid style={{ borderBottom: "1.5px dashed", borderBottomColor: Palette.grey[400] }} py={2}>
                <Typography variant="body1">Related To {data?.lead_id?._id ? 'Lead' : 'Contact'} :</Typography>
                {
                  data?.lead_id !== null ?
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
    </div>
  )
}

export default Overview
