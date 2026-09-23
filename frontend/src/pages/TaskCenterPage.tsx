import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Flex, Modal, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listTaskCategories, listTaskProjects, listTasks, TASK_STATES } from '../lib/api';
import type { TaskListParams, TaskOption, TaskRecord, TaskStateName } from '../types/api';
import { errorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';

const PAGE_LIMIT = 10;

// 筛选选项来自 api.ts 的唯一状态表
const STATE_OPTIONS = (Object.keys(TASK_STATES) as TaskStateName[]).map((value) => ({
  value,
  label: TASK_STATES[value].label,
}));

/** Tag 颜色是纯 UI 信息，留在页面层 */
const STATE_TAG_COLOR: Record<TaskStateName, string> = {
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
};

export default function TaskCenterPage() {
  const { message } = App.useApp();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [stateFilter, setStateFilter] = useState<TaskStateName | undefined>();
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [categories, setCategories] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<TaskOption[]>([]);

  const [detail, setDetail] = useState<TaskRecord | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const params: TaskListParams = { page: targetPage, limit: PAGE_LIMIT };
        if (stateFilter) params.state = stateFilter;
        if (classFilter) params.taskClass = classFilter;
        if (projectFilter) params.projectId = projectFilter;
        const data = await listTasks(params);
        setTasks(data.tasks);
        setTotal(data.total);
        setPage(targetPage);
      } catch (err) {
        message.error(errorMessage(err, '加载任务列表失败'));
      } finally {
        setLoading(false);
      }
    },
    [stateFilter, classFilter, projectFilter, message],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  // 筛选下拉的选项来自后端
  useEffect(() => {
    void listTaskCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    void listTaskProjects()
      .then(setProjectOptions)
      .catch(() => setProjectOptions([]));
  }, []);

  const columns: ColumnsType<TaskRecord> = [
    {
      title: '分类',
      dataIndex: 'taskClass',
      width: 130,
      render: (taskClass: string) => <Tag>{taskClass}</Tag>,
    },
    { title: '描述', dataIndex: 'describe', ellipsis: true },
    {
      title: '所属项目',
      dataIndex: 'projectName',
      width: 150,
      ellipsis: true,
      render: (name: string | null) => name ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'state',
      width: 100,
      render: (state: TaskStateName) => (
        <Tag color={STATE_TAG_COLOR[state]}>{TASK_STATES[state].label}</Tag>
      ),
    },
    {
      title: '失败原因',
      dataIndex: 'reason',
      ellipsis: true,
      render: (reason: string | null, record) =>
        record.state === 'failed' && reason ? (
          <Typography.Text type="danger" title={reason}>
            {reason}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 170,
      render: (startTime: string | null) => formatDateTime(startTime, 19),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => setDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '30px 32px 70px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      <h2 className="ds-h2">
        任务中心 <em>· 后台任务</em>
      </h2>
      <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6, marginBottom: 18 }}>
        提取资产、生成图片 / 视频等后台任务的执行记录，来自后端任务表
      </Typography.Text>

      <Card className="ds-card" styles={{ body: { padding: '14px 16px' } } as never} style={{ marginBottom: 14 }}>
        <Flex gap={10} wrap>
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 130 }}
            value={stateFilter}
            onChange={(v) => {
              setStateFilter(v);
              setPage(1);
            }}
            options={STATE_OPTIONS}
          />
          <Select
            allowClear
            placeholder="分类"
            style={{ minWidth: 160 }}
            value={classFilter}
            onChange={(v) => {
              setClassFilter(v);
              setPage(1);
            }}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
          <Select
            allowClear
            placeholder="所属项目"
            style={{ minWidth: 160 }}
            value={projectFilter}
            onChange={(v) => {
              setProjectFilter(v);
              setPage(1);
            }}
            options={projectOptions.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Button className="ds-ghost ds-pill" size="small" loading={loading} onClick={() => void load(page)}>
            ↻ 刷新
          </Button>
        </Flex>
      </Card>

      <Table<TaskRecord>
        rowKey={(_, index) => String(index)}
        columns={columns}
        dataSource={tasks}
        loading={loading}
        size="middle"
        pagination={{
          current: page,
          pageSize: PAGE_LIMIT,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (next) => void load(next),
        }}
        locale={{
          emptyText: (
            <div style={{ padding: '26px 0' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🧾</div>
              <div style={{ fontSize: 13.5, marginBottom: 4 }}>暂无任务</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                提交创作、提取资产或生成图片 / 视频后，这里会展示任务记录
              </Typography.Text>
            </div>
          ),
        }}
      />

      <Modal
        open={detail !== null}
        className="ds-modal"
        title="任务详情"
        onCancel={() => setDetail(null)}
        footer={[
          <Button key="ok" type="primary" className="ds-grad ds-pill" size="small" onClick={() => setDetail(null)}>
            关闭
          </Button>,
        ]}
      >
        {detail ? (
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'class', label: '分类', children: detail.taskClass || '—' },
              { key: 'describe', label: '描述', children: detail.describe || '—' },
              { key: 'project', label: '所属项目', children: detail.projectName ?? '—' },
              {
                key: 'state',
                label: '状态',
                children: (
                  <Tag color={STATE_TAG_COLOR[detail.state]}>
                    {detail.stateText || TASK_STATES[detail.state].label}
                  </Tag>
                ),
              },
              { key: 'model', label: '模型', children: detail.model ?? '—' },
              { key: 'startTime', label: '开始时间', children: formatDateTime(detail.startTime, 19) },
              { key: 'reason', label: '失败原因', children: detail.reason ?? '—' },
              {
                key: 'related',
                label: '关联对象',
                children: (
                  <Typography.Text style={{ fontSize: 12, wordBreak: 'break-all' }}>
                    {detail.relatedObjects ?? '—'}
                  </Typography.Text>
                ),
              },
            ]}
          />
        ) : null}
      </Modal>
    </div>
  );
}
