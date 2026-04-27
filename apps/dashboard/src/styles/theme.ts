import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2e7d32',
    borderRadius: 6,
    colorBgContainer: '#ffffff',
  },
  components: {
    Layout: {
      siderBg: '#0d3818',
      headerBg: '#ffffff',
      triggerBg: '#082612',
      triggerColor: '#ffffff',
    },
    Menu: {
      darkItemBg: '#0d3818',
      darkSubMenuItemBg: '#082612',
      darkItemHoverBg: '#1a4d28',
      darkPopupBg: '#0d3818',
    },
    Form: {
      itemMarginBottom: 20,
      verticalLabelPadding: '0 0 4px',
    },
  },
};
