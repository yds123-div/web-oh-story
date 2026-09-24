import { useEffect, useState } from 'react';
import { App, Button, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowHeader } from '../components/WorkflowHeader';
import { useWorkflowStep } from '../hooks/useWorkflowStep';
import { fetchProject, listEpisodes } from '../lib/api';
import { errorMessage } from '../lib/errors';
import type { Episode } from '../types/api';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 分集视频：领域映射「剧本即分集」——后端没有"集"实体，
 * 一个剧本就是一集，卡片直接展示该剧本的分镜数与总时长。
 */
export default function EpisodesPage() {
  const { message } = App.useApp();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { scripts } = useWorkflowStep();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // 项目名是页面自身所需（门控查询不含），单独取
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const project = await fetchProject(id, controller.signal);
        setProjectName(project.name);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        message.error(errorMessage(err, '加载项目失败'));
      }
    })();
    return () => controller.abort();
  }, [id, message]);

  // 门控 Provider 已拉过剧本列表；有剧本才聚合分镜统计，避免空项目白发请求
  const hasScripts = (scripts?.length ?? 0) > 0;
  useEffect(() => {
    if (scripts == null) return;
    if (!hasScripts) {
      setEpisodes([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setFailed(false);
    void listEpisodes(id, controller.signal)
      .then((data) => setEpisodes(data.episodes))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, scripts, hasScripts]);

  const firstReady = episodes[0];

  return (
    <div className="ds-flowPage">
      <WorkflowHeader projectName={projectName || '项目'} tag="分集视频管理" current="episodes" />
      <div className="ds-viewInner">
        <div className="ds-h2" style={{ fontSize: 20 }}>
          分集视频
        </div>
        <div style={{ fontSize: 13, color: 'var(--ant-color-text-tertiary)', marginTop: 6 }}>
          每个剧本就是一集 · 共 {episodes.length} 集
        </div>

        <div style={{ marginTop: 22 }}>
          {loading ? null : failed ? (
            <div className="ds-emptyBox">
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                加载分集失败，请确认后端服务是否可用
              </Typography.Text>
            </div>
          ) : (
            episodes.map((ep) => (
              <button
                key={ep.id}
                type="button"
                className="ds-epCard"
                style={{ marginBottom: 14 }}
                onClick={() => navigate(`/project/${id}/episode/${ep.id}`)}
              >
                <div className="cv">
                  {ep.coverUrl ? (
                    <img src={ep.coverUrl} alt={ep.title} />
                  ) : (
                    <span className="draft">第{ep.number}集</span>
                  )}
                  <span className="ds-status ok" style={{ position: 'absolute', top: 10, left: 10 }}>
                    <i className="ds-dot" />
                    {ep.storyboardCount > 0 ? '已建分镜' : '待建分镜'}
                  </span>
                </div>
                <div className="bd">
                  <h4>
                    第{ep.number}集：{ep.title}
                  </h4>
                  <div className="mt">
                    {ep.storyboardCount > 0
                      ? `共 ${ep.storyboardCount} 个分镜 · 总时长 ${formatDuration(ep.durationSec)}`
                      : '还没有分镜 · 进入后新建'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="ds-flowBar">
        <span className="msg">分集就绪后，进入分镜工作区编排分镜</span>
        <Button className="ds-ghost ds-pill" size="small" onClick={() => navigate(`/project/${id}/assets`)}>
          上一步
        </Button>
        <Button
          type="primary"
          className="ds-grad ds-pill"
          size="small"
          disabled={!firstReady}
          onClick={() => firstReady && navigate(`/project/${id}/episode/${firstReady.id}`)}
        >
          进入分镜工作区
        </Button>
      </div>
    </div>
  );
}
