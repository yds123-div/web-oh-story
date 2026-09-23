import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useWorkflowStep } from '../hooks/useWorkflowStep';
import { workflowRedirect, type WorkflowPage } from '../lib/workflow';

export function WorkflowGate({ page, children }: { page: WorkflowPage; children: ReactNode }) {
  const { id } = useParams();
  const { step, failed, retry } = useWorkflowStep();

  if (!id) return <Navigate to="/" replace />;

  if (failed) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>无法确认项目进度，请检查后端服务是否可用</p>
        <button
          type="button"
          className="ds-ghost ds-pill"
          style={{ marginTop: 16 }}
          onClick={retry}
        >
          重试
        </button>
      </div>
    );
  }

  // 查询中先不渲染，避免闪跳
  if (step == null) return null;

  const to = workflowRedirect(id, step, page);
  if (to) return <Navigate to={to} replace />;
  return children;
}
