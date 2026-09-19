import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

/**
 * hogee-demo-assets/shared.css → AntD 5 暗色主题 token 映射。
 * 这份映射本身即是产出物之一（FINDINGS.md 的「token 定制方案」）。
 *
 *  demo CSS 变量       值        →  AntD token
 *  --bg       #0a0a10      →  colorBgLayout        （页面底）
 *  --bg2      #101018      →  Layout.siderBg / headerBg（侧栏、顶栏）
 *  --panel    #15151f      →  colorBgContainer     （卡片、Modal、弹层）
 *  --panel2   #1b1b28      →  colorBgElevated      （下拉、hover 底）
 *  --line     #2a2a3a      →  colorBorderSecondary
 *  --line2    #3a3a50      →  colorBorder
 *  --txt      #ececf4      →  colorText
 *  --sub      #9a9ab2      →  colorTextSecondary
 *  --dim      #6b6b82      →  colorTextTertiary
 *  --acc      #8b5cf6      →  colorPrimary
 *  --green    #4ecf8d      →  colorSuccess
 *  --red      #e05d5d      →  colorError
 *  --gold     #e8c37a      →  colorWarning
 *  --cyan     #5eead4      →  colorInfo
 *  --shadow   0 10px 30px… →  boxShadowSecondary
 */
export const hogeeDarkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  cssVar: true, // 正式工程需要明暗切换，按 spec 用 CSS 变量模式
  token: {
    colorPrimary: '#8b5cf6',
    colorSuccess: '#4ecf8d',
    colorError: '#e05d5d',
    colorWarning: '#e8c37a',
    colorInfo: '#5eead4',
    colorText: '#ececf4',
    colorTextSecondary: '#9a9ab2',
    colorTextTertiary: '#6b6b82',
    colorBgLayout: '#0a0a10',
    colorBgContainer: '#15151f',
    colorBgElevated: '#1b1b28',
    colorBorder: '#3a3a50',
    colorBorderSecondary: '#2a2a3a',
    borderRadius: 10,
    borderRadiusLG: 16,
    boxShadowSecondary: '0 10px 30px rgba(0,0,0,.45)',
    fontFamily: '"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif',
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: '#101018',
      siderBg: '#101018',
      bodyBg: '#0a0a10',
      headerHeight: 56,
      headerPadding: '0 20px',
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemColor: '#6b6b82',
      itemHoverColor: '#9a9ab2',
      itemHoverBg: '#1b1b28',
      itemSelectedBg: 'rgba(139,92,246,.30)',
      itemSelectedColor: '#fff',
      itemMarginInline: 9,
      itemMarginBlock: 3,
      itemHeight: 44,
      itemBorderRadius: 12,
    },
    Button: {
      primaryShadow: '0 6px 18px rgba(139,92,246,.35)',
      fontWeight: 600,
    },
    Modal: {
      contentBg: '#15151f',
      headerBg: 'transparent',
    },
  },
};
