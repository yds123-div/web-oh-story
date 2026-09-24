import { Tag } from 'antd';
import type { TrackVideo, VideoPromptStatus } from '../types/api';

/**
 * 视频链路的两个状态徽标，分镜工作区与工作台共用一份（文案与配色只写一次）。
 * 状态本身的中文→命名状态翻译在 API 层（lib/videoGenState.ts）完成，这里只配 UI。
 */
export function VideoPromptTag({ status }: { status: VideoPromptStatus }) {
  switch (status) {
    case 'running':
      return <Tag color="processing">提示词生成中</Tag>;
    case 'done':
      return <Tag color="success">提示词已生成</Tag>;
    case 'failed':
      return <Tag color="error">提示词生成失败</Tag>;
    default:
      return null;
  }
}

/**
 * 轨道上的视频版本状态。只要有过一版成功就报成功（失败的重试不该盖掉已有成片），
 * 其次才是「生成中」与「全部失败」；一版都没有时返回 null，由页面自己决定空态文案。
 */
export function VideoVersionTag({ videos }: { videos: TrackVideo[] }) {
  if (videos.length === 0) return null;
  const done = videos.filter((v) => v.status === 'done').length;
  if (done > 0) return <Tag color="success">视频已生成 {done} 版</Tag>;
  if (videos.some((v) => v.status === 'running')) return <Tag color="processing">视频生成中</Tag>;
  return <Tag color="error">视频生成失败</Tag>;
}
