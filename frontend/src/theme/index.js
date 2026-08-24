import PropTypes from 'prop-types';
import { useMemo } from 'react';
// @mui
import { CssBaseline } from '@mui/material';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
// locales
import { faIR as dataGridFaIR } from '@mui/x-data-grid/locales/faIR';
//
import palette from './palette';
import shadows from './shadows';
import typography from './typography';
import GlobalStyles from './globalStyles';
import customShadows from './customShadows';
import componentsOverride from './overrides';
import { LanguageProvider, useTranslation } from '../i18n';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';

// ----------------------------------------------------------------------

ThemeProvider.propTypes = {
  children: PropTypes.node,
};

function ThemedApp({ children }) {
  const { rtl, lang } = useTranslation();

  const themeOptions = useMemo(
    () => ({
      palette,
      shape: { borderRadius: 6 },
      typography: {
        ...typography,
        ...(lang === 'fa'
          ? { fontFamily: "'Vazirmatn', 'Public Sans', sans-serif" }
          : {}),
      },
      direction: rtl ? 'rtl' : 'ltr',
      shadows: shadows(),
      customShadows: customShadows(),
      // Persian chrome for MUI X DataGrid (pagination, filters, toolbar…)
      components:
        lang === 'fa'
          ? {
              MuiDataGrid: {
                defaultProps: { localeText: dataGridFaIR.components.MuiDataGrid.defaultProps.localeText },
              },
            }
          : {},
    }),
    [rtl, lang]
  );

  const theme = createTheme(themeOptions);
  // Merge (not replace) so the faIR DataGrid localeText in themeOptions survives
  theme.components = { ...theme.components, ...componentsOverride(theme) };

  return (
    <MUIThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles />
      {children}
    </MUIThemeProvider>
  );
}

/**
 * Owns THE emotion cache so MUI styles honor direction.
 * NOTE: we deliberately do NOT use StyledEngineProvider here — it would
 * create its own cache (key 'css') and silently bypass ours, killing RTL
 * (that was the original bug). `prepend: true` reproduces injectFirst's
 * style-ordering behaviour.
 */
function DirectionalThemeProvider({ children }) {
  const { rtl } = useTranslation();

  const emotionCache = useMemo(
    () =>
      createCache({
        key: rtl ? 'muirtl' : 'muiltr',
        prepend: true,
        stylisPlugins: rtl ? [prefixer, rtlPlugin] : [],
      }),
    [rtl]
  );

  return (
    <CacheProvider value={emotionCache}>
      <ThemedApp>{children}</ThemedApp>
    </CacheProvider>
  );
}

export default function ThemeProvider({ children }) {
  return (
    <LanguageProvider>
      <DirectionalThemeProvider>{children}</DirectionalThemeProvider>
    </LanguageProvider>
  );
}
