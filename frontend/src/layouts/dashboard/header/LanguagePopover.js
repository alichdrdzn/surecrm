import { useState } from 'react';
// @mui
import { alpha } from '@mui/material/styles';
import { MenuItem, IconButton, Popover, Typography } from '@mui/material';
//
import { LANGUAGES, useTranslation } from '../../../i18n';

// ----------------------------------------------------------------------

export default function LanguagePopover() {
  const [open, setOpen] = useState(null);
  const { lang, setLang } = useTranslation();

  const activeLang = LANGUAGES.find((l) => l.value === lang) || LANGUAGES[0];

  const handleOpen = (event) => {
    setOpen(event.currentTarget);
  };

  const handleClose = () => {
    setOpen(null);
  };

  const handleSelect = (value) => {
    setLang(value);
    handleClose();
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        sx={{
          padding: 0,
          width: 44,
          height: 44,
          ...(open && {
            bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.action.focusOpacity),
          }),
        }}
      >
        <img src={activeLang.flagIcon} alt={activeLang.label} />
      </IconButton>

      <Popover
        open={Boolean(open)}
        anchorEl={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            p: 0,
            mt: 1.5,
            ml: 0.75,
            width: 180,
            '& .MuiMenuItem-root': {
              px: 1,
              typography: 'body2',
              borderRadius: 0.75,
            },
          },
        }}
      >
        {LANGUAGES.map((language) => (
          <MenuItem
            key={language.value}
            selected={language.value === lang}
            onClick={() => handleSelect(language.value)}
            sx={{ my: 0.5, display: 'flex', gap: 1.5 }}
          >
            <img
              style={{ width: 28, flexShrink: 0 }}
              src={language.flagIcon}
              alt={language.label}
            />
            <Typography variant="body2" noWrap>
              {language.label}
            </Typography>
          </MenuItem>
        ))}
      </Popover>
    </>
  );
}

