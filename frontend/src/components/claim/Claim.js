/* eslint-disable react/prop-types */
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import React, { useState } from "react";
import RemoveIcon from "@mui/icons-material/Remove";
import HistoryIcon from "@mui/icons-material/History";
import AddIcon from "@mui/icons-material/Add";
import Addclaim from "./Addclaim";
import ViewClaim from "./ViewEdit";
import TableStyleTwo from "../TableStyleTwo";

import { useTranslation } from '../../i18n';
const Claim = ({ rows, toggleVisibilityClaim, isVisibleClaim, _id, setUserAction }) => {
  const { t } = useTranslation();

  const [claimId, setClaimId] = useState('');
  const [openClaimView, setOpenClaimView] = useState(false)
  const handleOpenView = () => setOpenClaimView(true)
  const handleCloseClaimView = () => setOpenClaimView(false)


  const columns = [
    {
      field: "policyNumber",
      headerName: t('Policy Number'),
      cellClassName: "name-column--cell",
      flex: 2,
      renderCell: (params) => {
        const handleFirstNameClick = () => {
          handleOpenView();
          setClaimId(params?.row?._id)
        };

        return (
          <Box onClick={handleFirstNameClick}>
            {params.value}
          </Box>
        );
      }
    },
    {
      field: "claimType",
      headerName: t('Claim Type'),
      flex: 2,
    },
    { field: "claimAmount", headerName: t('Claim Amount'), flex: 2 },
    {
      field: "claimDate",
      headerName: t('Claim Date'),
      flex: 2,
      valueFormatter: (params) => {
        const date = new Date(params.value);
        return date.toLocaleString();
      },
    }
    ,
    { field: "claimStatus", headerName: t('Claim Status'), flex: 2 },
  ];

  // open Claim model
  const [openClaim, setOpenClaim] = useState(false);
  const handleOpenClaim = () => {
    setOpenClaim(true);
  };
  const handleCloseClaim = () => setOpenClaim(false);
  return (
    <div>

      {/* View Claim */}
      <ViewClaim open={openClaimView} handleClose={handleCloseClaimView} id={claimId} setUserAction={setUserAction} />

      {/* Add Claim */}
      <Addclaim open={openClaim} handleClose={handleCloseClaim} _id={_id} setUserAction={setUserAction} />

      <Box style={{ cursor: "pointer" }} p={2}>
        <Grid container display="flex" alignItems="center">
          <Stack direction="row" alignItems="center" justifyContent={"space-between"} width={"100%"}>
            <Stack direction="row" spacing={1} alignItems={"center"}>
              <Button
                onClick={toggleVisibilityClaim}
                color="secondary"
                variant="contained"
                sx={{ width: "28px", minWidth: "0px", padding: "0px" }}
              >
                {isVisibleClaim ? <RemoveIcon /> : <AddIcon />}
              </Button>
              <HistoryIcon />
              <Typography variant="h6">{t('Claim History')}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent={"flex-end"} spacing={2}>
              {isVisibleClaim && (
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleOpenClaim}
                >{t('Claim')}</Button>
              )}
            </Stack>
          </Stack>
        </Grid>
      </Box>
      {
        isVisibleClaim &&
        <TableStyleTwo>
          <Box width="100%" height="30vh">
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={row => row._id}
              columnHeaderHeight={40}
            />
          </Box>
        </TableStyleTwo>
      }
    </div>
  );
};

export default Claim;
