/* eslint-disable react-hooks/exhaustive-deps */
import { Helmet } from 'react-helmet-async';
import { faker } from '@faker-js/faker';
// @mui
import { useTheme } from '@mui/material/styles';
import { Grid, Container, Typography } from '@mui/material';
// components
import { useEffect, useState } from 'react';
import Iconify from '../components/iconify';
import { useTranslation } from '../i18n';
// sections
import {
  AppTasks,
  AppNewsUpdate,
  AppOrderTimeline,
  AppCurrentVisits,
  AppWebsiteVisits,
  AppTrafficBySite,
  AppWidgetSummary,
  AppCurrentSubject,
  AppConversionRates,
} from '../sections/@dashboard/app';
import { apiget } from '../service/api';

// ----------------------------------------------------------------------

export default function DashboardAppPage() {
  const theme = useTheme();
  const { t } = useTranslation();

  const [totalLead, setTotalLead] = useState([])
  const [totalContact, setTotalContact] = useState([])
  const [totalPolicy, setTotalPolicy] = useState([])
  const [totalEvent, setTotalEvent] = useState([])
  const userid = localStorage.getItem('user_id');
  const userRole = localStorage.getItem("userRole")

  // lead api
  const fetchLead = async () => {
    const result = await apiget(userRole === 'admin' ? `lead/list` : `lead/list/?createdBy=${userid}`)
    if (result && result.status === 200) {
      setTotalLead(result?.data?.total_recodes)
    }
  }

  // contact api
  const fetchContact = async () => {
    const result = await apiget(userRole === 'admin' ? `contact/list` : `contact/list/?createdBy=${userid}`)
    if (result && result.status === 200) {
      setTotalContact(result?.data?.total_recodes)
    }
  }

  // contact api
  const fetchPolicy = async () => {
    const result = await apiget(userRole === 'admin' ? `policy/list` : `policy/list/?createdBy=${userid}`)
    if (result && result.status === 200) {
      setTotalPolicy(result?.data?.total_recodes)
    }
  }

  // contact api
  const fetchEvent = async () => {
    const result = await apiget(userRole === 'admin' ? `task/list` : `task/list/?createdBy=${userid}`)
    if (result && result.status === 200) {
      setTotalEvent(result?.data?.total_recodes)
    }
  }

  useEffect(() => {
    fetchLead();
    fetchContact();
    fetchPolicy();
    fetchEvent();
  }, [])
  return (
    <>
      <Helmet>
        {/* <title> Dashboard | Minimal UI </title> */}
      </Helmet>

      <Container maxWidth="xl">
        <Typography variant="h4" sx={{ mb: 5 }}>
          {t('Hi, Welcome back')}
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary title={t('Leads')} total={totalLead} icon={'ic:baseline-leaderboard'} />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary title={t('Contacts')} total={totalContact} color="info" icon={'fluent:book-contacts-24-filled'} />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary title={t('Policies')} total={totalPolicy} color="warning" icon={'ic:baseline-policy'} />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary title={t('Tasks')} total={totalEvent} color="error" icon={'mdi:events'} />
          </Grid>

          <Grid item xs={12} md={6} lg={8}>
            <AppWebsiteVisits
              title={t('Website Visits')}
              subheader={t('(+43%) than last year')}
              chartLabels={[
                '01/01/2003',
                '02/01/2003',
                '03/01/2003',
                '04/01/2003',
                '05/01/2003',
                '06/01/2003',
                '07/01/2003',
                '08/01/2003',
                '09/01/2003',
                '10/01/2003',
                '11/01/2003',
              ]}
              chartData={[
                {
                  name: t('Team A'),
                  type: 'column',
                  fill: 'solid',
                  data: [23, 11, 22, 27, 13, 22, 37, 21, 44, 22, 30],
                },
                {
                  name: t('Team B'),
                  type: 'area',
                  fill: 'gradient',
                  data: [44, 55, 41, 67, 22, 43, 21, 41, 56, 27, 43],
                },
                {
                  name: t('Team C'),
                  type: 'line',
                  fill: 'solid',
                  data: [30, 25, 36, 30, 45, 35, 64, 52, 59, 36, 39],
                },
              ]}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <AppCurrentVisits
              title={t('Current Visits')}
              chartData={[
                { label: t('America'), value: 4344 },
                { label: t('Asia'), value: 5435 },
                { label: t('Europe'), value: 1443 },
                { label: t('Africa'), value: 4443 },
              ]}
              chartColors={[
                theme.palette.primary.main,
                theme.palette.info.main,
                theme.palette.warning.main,
                theme.palette.error.main,
              ]}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={8}>
            <AppConversionRates
              title={t('Conversion Rates')}
              subheader={t('(+43%) than last year')}
              chartData={[
                { label: t('Italy'), value: 400 },
                { label: t('Japan'), value: 430 },
                { label: t('China'), value: 448 },
                { label: t('Canada'), value: 470 },
                { label: t('France'), value: 540 },
                { label: t('Germany'), value: 580 },
                { label: t('South Korea'), value: 690 },
                { label: t('Netherlands'), value: 1100 },
                { label: t('United States'), value: 1200 },
                { label: t('United Kingdom'), value: 1380 },
              ]}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <AppCurrentSubject
              title={t('Current Subject')}
              chartLabels={[t('English'), t('History'), t('Physics'), t('Geography'), t('Chinese'), t('Math')]}
              chartData={[
                { name: t('Series 1'), data: [80, 50, 30, 40, 100, 20] },
                { name: t('Series 2'), data: [20, 30, 40, 80, 20, 80] },
                { name: t('Series 3'), data: [44, 76, 78, 13, 43, 10] },
              ]}
              chartColors={[...Array(6)].map(() => theme.palette.text.secondary)}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={8}>
            <AppNewsUpdate
              title={t('News Update')}
              list={[...Array(5)].map((_, index) => ({
                id: faker.datatype.uuid(),
                title: faker.name.jobTitle(),
                description: faker.name.jobTitle(),
                image: `/assets/images/covers/cover_${index + 1}.jpg`,
                postedAt: faker.date.recent(),
              }))}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <AppOrderTimeline
              title={t('Order Timeline')}
              list={[...Array(5)].map((_, index) => ({
                id: faker.datatype.uuid(),
                title: [
                  t('1983, orders, $4220'),
                  t('12 Invoices have been paid'),
                  t('Order #37745 from September'),
                  t('New order placed #XF-2356'),
                  t('New order placed #XF-2346'),
                ][index],
                type: `order${index + 1}`,
                time: faker.date.past(),
              }))}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <AppTrafficBySite
              title={t('Traffic by Site')}
              list={[
                {
                  name: 'FaceBook',
                  value: 323234,
                  icon: <Iconify icon={'eva:facebook-fill'} color="#1877F2" width={32} />,
                },
                {
                  name: 'Google',
                  value: 341212,
                  icon: <Iconify icon={'eva:google-fill'} color="#DF3E30" width={32} />,
                },
                {
                  name: 'Linkedin',
                  value: 411213,
                  icon: <Iconify icon={'eva:linkedin-fill'} color="#006097" width={32} />,
                },
                {
                  name: 'Twitter',
                  value: 443232,
                  icon: <Iconify icon={'eva:twitter-fill'} color="#1C9CEA" width={32} />,
                },
              ]}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={8}>
            <AppTasks
              title={t('Tasks')}
              list={[
                { id: '1', label: t('Create FireStone Logo') },
                { id: '2', label: t('Add SCSS and JS files if required') },
                { id: '3', label: t('Stakeholder Meeting') },
                { id: '4', label: t('Scoping & Estimations') },
                { id: '5', label: t('Sprint Showcase') },
              ]}
            />
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
