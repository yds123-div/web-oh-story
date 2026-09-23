import { renderHook, waitFor } from '@testing-library/react';
import { useTask } from './useTask';

/** 后端信封：HTTP 恒 200，任务行在 data 里 */
function taskResponse(state: string, reason: string | null = null): Response {
  return new Response(
    JSON.stringify({
      code: 200,
      data: {
        id: 9001,
        projectId: 1790139230377,
        taskClass: '剧本资产提取',
        describe: '提取资产',
        state, // 后端中文状态：进行中 / 已完成
        startTime: 1790139273381,
        reason,
      },
      message: '成功',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('useTask', () => {
  it('polls running tasks until succeeded then stops', async () => {
    let n = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      n += 1;
      if (n < 3) return taskResponse('进行中');
      return taskResponse('已完成');
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSucceeded = vi.fn();

    renderHook(() => useTask('9001', { intervalMs: 20, onSucceeded }));

    // 后端无 pending，进行中持续轮询，已完成触发回调
    await waitFor(() => expect(onSucceeded).toHaveBeenCalledTimes(1));
    expect(onSucceeded).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded' }));
    const calls = fetchMock.mock.calls.length;
    await new Promise((r) => setTimeout(r, 80));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('clears polling when the component unmounts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(taskResponse('进行中'));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useTask('9001', { intervalMs: 20 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    unmount();
    const calls = fetchMock.mock.calls.length;
    await new Promise((r) => setTimeout(r, 80));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
