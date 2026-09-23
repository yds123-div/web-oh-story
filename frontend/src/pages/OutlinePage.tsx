import { Navigate, useParams } from 'react-router-dom';

/**
 * 剧本大纲页 - 重定向到剧本列表页
 * 数据源改为后端剧本，原有大纲概念已合并到剧本列表
 */
export default function OutlinePage() {
  const { id = '' } = useParams();
  return <Navigate to={`/project/${id}/scripts`} replace />;
}
