import { Modal, Typography } from 'antd';

/**
 * 视频提示词编辑弹窗，分镜工作区与工作台共用。
 * 受控：`value === null` 表示关闭；文本与保存状态都由调用方持有。
 */
export function VideoPromptModal({
  value,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  value: string | null;
  saving: boolean;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={value != null}
      className="ds-modal"
      title="🎬 视频提示词"
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      onOk={onSave}
      onCancel={onCancel}
    >
      <textarea
        className="ds-gpText"
        rows={10}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
        保存在后端视频轨道上，生成视频时按它提交。
      </Typography.Text>
    </Modal>
  );
}
