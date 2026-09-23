import { getRecentProjectId, setRecentProjectId } from './recentProject';

describe('recentProject（最近访问项目记忆）', () => {
  beforeEach(() => localStorage.clear());

  it('未记录时返回 null', () => {
    expect(getRecentProjectId()).toBeNull();
  });

  it('写入后可读出', () => {
    setRecentProjectId('1790145377136');
    expect(getRecentProjectId()).toBe('1790145377136');
  });

  it('以最后一次写入为准', () => {
    setRecentProjectId('111');
    setRecentProjectId('222');
    expect(getRecentProjectId()).toBe('222');
  });
});
