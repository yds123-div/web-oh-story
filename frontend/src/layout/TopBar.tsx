import { Flex, Button } from 'antd';
import { useThemeStore } from '../stores/themeStore';

export function TopBar() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <Flex align="center" gap={10} style={{ height: '100%' }}>
      <div className="ds-brand">
        <div className="ds-mark">D</div>
        <div className="bt">
          <b>DeepSFV</b>
          <span>AI 短剧工坊 · 逆命木叶</span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <Button className="ds-pill">领取创作者权益</Button>
      <Button className="ds-pill">商务合作</Button>
      <button type="button" className="ds-themeBtn" title="切换 明亮 / 暗色主题" onClick={toggle}>
        {mode === 'light' ? '🌙' : '☀️'}
      </button>
      <Button className="ds-pill ds-vip">⚡ 开通会员</Button>
      <div className="ds-avatar">赵</div>
    </Flex>
  );
}
