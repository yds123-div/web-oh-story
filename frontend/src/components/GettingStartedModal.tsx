import { Button, Flex, Modal, Typography } from 'antd';

/** 首次运行引导读过一次就不再打扰 */
export const ONBOARDING_DONE_KEY = 'deepsfv-onboarding-done';

/** 标记已读；localStorage 不可用时静默忽略（最坏情况是下次再弹一次） */
export function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, '1');
  } catch {
    // 忽略：存储不可用不应阻塞界面
  }
}

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === '1';
  } catch {
    return true; // 读不到就别弹，宁可不打扰
  }
}

type Props = {
  open: boolean;
  /** 「开始配置」——去设置中心 */
  onStart: () => void;
  /** 「跳过」——同样记为已读，否则每次打开首页都会再弹 */
  onSkip: () => void;
};

/**
 * 极简首次运行引导：一张卡、一句欢迎、两个动作。
 * 只在「首次访问且确实缺东西」（没有项目，或后端没启用任何模型供应商）时出现。
 */
export function GettingStartedModal({ open, onStart, onSkip }: Props) {
  return (
    <Modal
      open={open}
      width={460}
      className="ds-modal"
      footer={null}
      closable
      onCancel={onSkip}
      classNames={{ mask: 'ds-mask' }}
    >
      <Flex vertical align="center" gap={6} style={{ padding: '18px 8px 8px', textAlign: 'center' }}>
        <div className="ds-logo" style={{ marginBottom: 14 }}>
          D
        </div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          欢迎使用 DeepSFV
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          AI 短剧创作工坊 · 从小说到成片的一条流水线
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12.5, marginTop: 10, display: 'block' }}>
          开始前建议先确认模型供应商已配置：没有可用的图像 / 视频模型时，建了项目也生成不出内容。
        </Typography.Text>
        <Flex gap={8} style={{ marginTop: 20 }}>
          <Button className="ds-pill ds-ghost" size="small" onClick={onSkip}>
            跳过引导
          </Button>
          <Button type="primary" className="ds-grad ds-pill" size="small" onClick={onStart}>
            开始配置
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}