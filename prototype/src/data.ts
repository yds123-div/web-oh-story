// PROTOTYPE — mock 数据（不接请求层，硬编码）
export interface Project {
  name: string;
  cover: string | null; // null = 无封面，用渐变+文字占位
  status: 'ok' | 'no';
  statusText: string;
  updated: string;
  rows: [string, string][];
}

export const projects: Project[] = [
  {
    name: '逆命木叶',
    cover: '/corridor.jpg',
    status: 'ok',
    statusText: '进行中',
    updated: '更新于 2026-09-17 18:20',
    rows: [
      ['资产 5（角色4+场景1）', '片段 3 · 00:37'],
      ['项目积分余额 ◆132', '9:16 · 赛博朋克电影'],
    ],
  },
  {
    name: '火影乱斗',
    cover: null,
    status: 'no',
    statusText: '已归档',
    updated: '更新于 2026-09-16 21:04',
    rows: [
      ['资产 2', '片段 4 · 00:46'],
      ['项目积分余额 ◆0', '16:9'],
    ],
  },
];

export const navItems = [
  { key: 'home', icon: '🏠', label: '首页' },
  { key: 'idea', icon: '💡', label: '创意' },
  { key: 'create', icon: '🎬', label: '创作' },
];
