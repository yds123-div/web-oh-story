/**
 * 变体 A — 纯 token（成本下限）
 *
 * 纪律：视觉外观只来自 ConfigProvider token / 组件 token / AntD 组件默认样式。
 * 内联样式只允许布局（flex/grid/宽高/aspect）和通过 theme.useToken() 取 token 值。
 * 不引入任何 CSS 文件 —— 切换器上显示的自定义 CSS 行数必须是 0。
 */
import { useState } from 'react';
import { theme } from 'antd';
import { Avatar, Badge, Button, Card, Flex, Input, Layout, Menu, Modal, Progress, Select, Tag, Typography } from 'antd';
import { navItems, projects } from '../data';

export default function VariantA() {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  return (
    <Layout style={{ height: '100vh' }}>
      <Layout.Sider width={78}>
        <Flex vertical align="center" gap={6} style={{ height: '100%', padding: '14px 0' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: token.colorPrimary, // token 无渐变 → 纯色（保真缺口）
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 19,
              marginBottom: 12,
            }}
          >
            D
          </div>
          <Menu
            mode="vertical"
            selectable
            defaultSelectedKeys={['home']}
            items={navItems.map((n) => ({
              key: n.key,
              icon: <span style={{ fontSize: 19 }}>{n.icon}</span>,
              label: n.label,
            }))}
          />
        </Flex>
      </Layout.Sider>

      <Layout>
        <Layout.Header>
          <Flex align="center" gap={10} style={{ height: '100%' }}>
            <Avatar shape="square" size={30} style={{ background: token.colorPrimary, fontWeight: 800 }}>
              D
            </Avatar>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>DeepSFV</div>
              <Typography.Text type="secondary" style={{ fontSize: 10, letterSpacing: 1 }}>
                AI 短剧工坊 · 逆命木叶
              </Typography.Text>
            </div>
            <div style={{ flex: 1 }} />
            <Button>领取创作者权益</Button>
            <Button>商务合作</Button>
            <Button>⚡ 开通会员</Button>
            <Tag>◆ 940</Tag>
            <Badge dot color={token.colorError}>
              <Button type="text">🔔</Button>
            </Badge>
            <Avatar style={{ background: token.colorPrimary }}>赵</Avatar>
          </Flex>
        </Layout.Header>

        <Layout.Content style={{ padding: '30px 32px 70px', maxWidth: 1200, width: '100%', margin: '0 auto', overflowY: 'auto' }}>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            空间 · 个人
          </Typography.Title>
          <Typography.Text type="secondary">
            个人项目卡 · 重命名 / 归档 · 项目积分余额 · 成片下载 · 存储用量
          </Typography.Text>

          <Card style={{ marginTop: 20 }}>
            <Flex align="center" gap={18}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: token.colorPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                🧊
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Flex align="center" gap={10}>
                  <b style={{ fontSize: 15 }}>个人空间</b>
                  <Tag>免费版</Tag>
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', margin: '5px 0 8px' }}>
                  存储用量 <b style={{ color: token.colorText }}>3.4 GB</b> / 10 GB · 成片保留 30 天 · 合成完成后可在此下载
                </Typography.Text>
                <Progress
                  percent={34}
                  showInfo={false}
                  size={['100%', 8]}
                  strokeColor={{ from: '#8b5cf6', to: '#6366f1' }}
                />
              </div>
              <Button>👥 切换团队空间</Button>
            </Flex>
          </Card>

          <Flex align="center" justify="space-between" style={{ margin: '26px 0 13px' }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              📁 我的项目
            </Typography.Title>
            <Button type="primary" size="small" onClick={() => setOpen(true)}>
              ＋ 新建项目
            </Button>
          </Flex>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 15 }}>
            {projects.map((p) => (
              <Card
                key={p.name}
                hoverable
                style={{ overflow: 'hidden', cursor: 'pointer' }}
                cover={
                  <div
                    style={{
                      aspectRatio: '16 / 10',
                      background: token.colorBgElevated,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {p.cover ? (
                      <img src={p.cover} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          color: 'rgba(255,255,255,.85)',
                        }}
                      >
                        {p.name}
                      </div>
                    )}
                  </div>
                }
              >
                <Card.Meta title={<span style={{ fontSize: 13.5 }}>{p.name}</span>} />
                <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <Flex align="center" justify="space-between">
                    <Typography.Text type="secondary" style={{ fontSize: 10.5 }}>
                      {p.updated}
                    </Typography.Text>
                    <Tag
                      color={p.status === 'ok' ? 'success' : 'default'}
                      style={{ marginInlineEnd: 0, fontSize: 11, padding: '2px 9px' }}
                    >
                      {p.status === 'ok' && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'currentColor',
                            marginRight: 4,
                          }}
                        />
                      )}
                      {p.statusText}
                    </Tag>
                  </Flex>
                  {p.rows.map(([l, r]) => (
                    <Flex key={l} align="center" justify="space-between">
                      <Typography.Text type="secondary" style={{ fontSize: 10.5 }}>
                        {l}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 10.5 }}>
                        {r}
                      </Typography.Text>
                    </Flex>
                  ))}
                </div>
              </Card>
            ))}
            <Card style={{ minHeight: 240, cursor: 'pointer' }} onClick={() => setOpen(true)}>
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: token.colorTextSecondary,
                }}
              >
                <div style={{ fontSize: 26 }}>＋</div>
                <div style={{ fontSize: 12 }}>新建项目</div>
              </div>
            </Card>
          </div>
        </Layout.Content>
      </Layout>

      <Modal
        open={open}
        title="新建项目"
        okText="创 建"
        cancelText="取消"
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <Flex vertical gap={13}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
              项目名称
            </Typography.Text>
            <Input placeholder="输入项目名称" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                默认比例
              </Typography.Text>
              <Select style={{ width: '100%' }} defaultValue="9:16" options={[{ value: '9:16' }, { value: '16:9' }]} />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                默认风格
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                defaultValue="赛博朋克电影"
                options={[{ value: '赛博朋克电影' }, { value: '国漫写实' }]}
              />
            </div>
          </div>
        </Flex>
      </Modal>
    </Layout>
  );
}
