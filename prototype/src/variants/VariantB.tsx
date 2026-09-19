/**
 * 变体 B — token + 定向 CSS（推荐的甜点位）
 *
 * theme.ts 的 token 打底（同 A），AntD 组件承担结构（Card/Modal/Input/Select/
 * Button/Progress/Typography），custom-b.css 只补 token 表达不了的视觉
 * （渐变、发光、竖排图标栏、hover 位移、pill）。CSS 行数见切换器实时计数。
 */
import { useState } from 'react';
import { Button, Card, Flex, Input, Layout, Modal, Progress, Select, Typography } from 'antd';
import './custom-b.css';
import { navItems, projects } from '../data';

export default function VariantB() {
  const [open, setOpen] = useState(false);

  return (
    <div className="proto-b">
      <Layout style={{ height: '100vh' }}>
        <Layout.Sider width={78}>
          <div className="pb-side">
            <div className="pb-logo">D</div>
            {navItems.map((n) => (
              <button key={n.key} className={n.key === 'home' ? 'pb-navItem on' : 'pb-navItem'}>
                <span className="ico">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
        </Layout.Sider>

        <Layout>
          <Layout.Header>
            <Flex align="center" gap={10} style={{ height: '100%' }}>
              <div className="pb-brand">
                <div className="pb-mark">D</div>
                <div className="bt">
                  <b>DeepSFV</b>
                  <span>AI 短剧工坊 · 逆命木叶</span>
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <Button className="pb-pill">领取创作者权益</Button>
              <Button className="pb-pill">商务合作</Button>
              <Button className="pb-pill pb-vip">⚡ 开通会员</Button>
              <div className="pb-credit">◆ 940</div>
              <Button type="text" style={{ fontSize: 16 }}>
                🔔
              </Button>
              <div className="pb-avatar">赵</div>
            </Flex>
          </Layout.Header>

          <Layout.Content style={{ padding: '30px 32px 70px', maxWidth: 1200, width: '100%', margin: '0 auto', overflowY: 'auto' }}>
            <h2 className="pb-h2">
              空间 <em>· 个人</em>
            </h2>
            <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
              个人项目卡 · 重命名 / 归档 · 项目积分余额 · 成片下载 · 存储用量
            </Typography.Text>

            <Card style={{ marginTop: 20 }} styles={{ body: { padding: '13px 24px' } }}>
              <Flex align="center" gap={18}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
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
                    <span className="pb-pill no" style={{ padding: '2px 7px', fontSize: 9.5, background: 'rgba(139,92,246,.14)', color: '#a78bfa' }}>
                      免费版
                    </span>
                  </Flex>
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', margin: '5px 0 8px' }}>
                    存储用量 <b style={{ color: '#ececf4' }}>3.4 GB</b> / 10 GB · 成片保留 30 天 · 合成完成后可在此下载
                  </Typography.Text>
                  <Progress percent={34} showInfo={false} size={['100%', 8]} strokeColor={{ from: '#8b5cf6', to: '#6366f1' }} />
                </div>
                <Button className="pb-ghost pb-pill" size="small">
                  👥 切换团队空间
                </Button>
              </Flex>
            </Card>

            <Flex align="center" justify="space-between" style={{ margin: '26px 0 13px' }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>📁 我的项目</h3>
              <Button type="primary" className="pb-grad pb-pill" size="small" onClick={() => setOpen(true)}>
                ＋ 新建项目
              </Button>
            </Flex>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 15 }}>
              {projects.map((p) => (
                <Card
                  key={p.name}
                  className="pb-card"
                  style={{ overflow: 'hidden', cursor: 'pointer' }}
                  styles={{ body: { padding: '12px 14px' } }}
                  cover={
                    <div className="pb-cv">
                      {p.cover ? (
                        <img src={p.cover} alt={p.name} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'rgba(255,255,255,.85)' }}>
                          {p.name}
                        </div>
                      )}
                      {p.cover && <span className="pb-aigc">✦ AI生成</span>}
                      <div className="pb-ops">
                        <button>✎ 重命名</button>
                        <button>📦 归档</button>
                      </div>
                    </div>
                  }
                >
                  <b style={{ fontSize: 13.5 }}>{p.name}</b>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 7 }}>
                    <Flex align="center" justify="space-between">
                      <span style={{ fontSize: 10.5, color: '#6b6b82' }}>{p.updated}</span>
                      <span className={`pb-pill ${p.status}`}>
                        {p.status === 'ok' && <i className="pb-dot" />}
                        {p.statusText}
                      </span>
                    </Flex>
                    {p.rows.map(([l, r]) => (
                      <Flex key={l} align="center" justify="space-between">
                        <span style={{ fontSize: 10.5, color: '#6b6b82' }}>{l}</span>
                        <span style={{ fontSize: 10.5, color: '#6b6b82' }}>{r}</span>
                      </Flex>
                    ))}
                  </div>
                </Card>
              ))}
              <button className="pb-newCard" onClick={() => setOpen(true)}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>＋</div>
                  <div style={{ fontSize: 12 }}>新建项目</div>
                </div>
              </button>
            </div>
          </Layout.Content>
        </Layout>
      </Layout>

      <Modal
        open={open}
        className="pb-modal"
        title="新建项目"
        okText="创 建"
        cancelText="取消"
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        styles={{ mask: { backdropFilter: 'blur(4px)', background: 'rgba(5,5,10,.62)' } }}
        footer={[
          <Button key="cancel" className="pb-ghost pb-pill" size="small" onClick={() => setOpen(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" className="pb-grad pb-pill" size="small" onClick={() => setOpen(false)}>
            创 建
          </Button>,
        ]}
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
    </div>
  );
}
