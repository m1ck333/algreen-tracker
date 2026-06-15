import { theme as antdTheme, type ThemeConfig } from 'antd';

const sharedTokens = {
  colorPrimary: '#1677ff',
  borderRadius: 6,
};

const sharedComponents: ThemeConfig['components'] = {
  Form: {
    itemMarginBottom: 20,
    verticalLabelPadding: '0 0 4px',
  },
};

export const lightTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    ...sharedTokens,
    colorBgContainer: '#ffffff',
  },
  components: {
    ...sharedComponents,
    Layout: {
      siderBg: '#001529',
      headerBg: '#ffffff',
      triggerBg: '#000c17',
      triggerColor: '#ffffff',
    },
    Menu: {
      darkItemBg: '#001529',
      darkSubMenuItemBg: '#000c17',
      darkItemHoverBg: '#1a3045',
      darkPopupBg: '#001529',
    },
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...sharedTokens,
    // Popups/dropdowns lift slightly above the page bg so the user can tell
    // them apart in dark mode (default antd dark popup bg blends into the
    // dashboard's dark surface).
    colorBgElevated: '#262626',
  },
  components: {
    ...sharedComponents,
    Layout: {
      siderBg: '#000814',
      triggerBg: '#000408',
      triggerColor: '#ffffff',
    },
    Menu: {
      darkItemBg: '#000814',
      darkSubMenuItemBg: '#000408',
      darkItemHoverBg: '#0f1f33',
      darkPopupBg: '#000814',
    },
    Popover: {
      // Stronger contrast so Popconfirm and tooltips read clearly against
      // the dark dashboard. Default antd dark popup is too close to bg.
      colorBgElevated: '#2a2a2a',
    },
  },
};

export const theme = lightTheme;
