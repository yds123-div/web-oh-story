import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { listScripts, projectHasAssets } from '../lib/api';
import { workflowStep, type WorkflowProgress } from '../lib/workflow';
import type { Script, WorkflowStep } from '../types/api';

export type WorkflowStepState = {
  /** null = 查询中 */
  step: WorkflowStep | null;
  failed: boolean;
  /** 门控查询拉回的剧本列表（null=查询中），页面直接消费避免重复请求 */
  scripts: Script[] | null;
  /** 失败后重查 */
  retry: () => void;
};

/** 工作流数据源：真查后端（有剧本→Step2，有资产→Step3），全页共享一次查询 */
function useWorkflowStepQuery(projectId: string | undefined): WorkflowStepState {
  const [step, setStep] = useState<WorkflowStep | null>(null);
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    setStep(null);
    setScripts(null);
    setFailed(false);
    void (async () => {
      try {
        const [listResult, hasAssets] = await Promise.all([
          listScripts(projectId, controller.signal),
          projectHasAssets(projectId, controller.signal),
        ]);
        setScripts(listResult.scripts);
        const progress: WorkflowProgress = {
          hasScripts: listResult.scripts.length > 0,
          hasAssets,
        };
        setStep(workflowStep(progress));
      } catch (err) {
        // 卸载/重挂载导致的取消：静默（StrictMode 下首挂请求即如此）
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [projectId, nonce]);

  return { step, scripts, failed, retry: () => setNonce((n) => n + 1) };
}

const WorkflowStepContext = createContext<WorkflowStepState | null>(null);

/**
 * 挂在 /project/:id/* 路由层：全页（Gate + Header + 内容）共享同一次查询，
 * 避免门控与页头各自拉取 listScripts/getAllAssets。
 */
export function WorkflowStepProvider({ children }: { children: ReactNode }) {
  const { id } = useParams();
  const state = useWorkflowStepQuery(id);
  return (
    <WorkflowStepContext.Provider value={state}>
      {children}
    </WorkflowStepContext.Provider>
  );
}

export function useWorkflowStep(): WorkflowStepState {
  const ctx = useContext(WorkflowStepContext);
  if (!ctx) {
    throw new Error('useWorkflowStep 必须在 WorkflowStepProvider 内使用');
  }
  return ctx;
}
