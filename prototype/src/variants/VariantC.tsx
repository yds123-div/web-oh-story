/**
 * 变体 C — demo CSS 原样移植（成本上限 / ground truth）
 *
 * 直接把 space.html 的标记结构搬进 JSX，样式来自 demo-c.css
 * （hogee-demo-assets/shared.css 的本屏子集，数值零改动）。
 * AntD 在这个变体里完全退出视觉层 —— 测量「追求 100% 保真时，
 * 现成组件库帮不上忙，成本是多少」。
 */
import { useState } from 'react';
import './demo-c.css';
import { navItems, projects } from '../data';

export default function VariantC() {
  const [open, setOpen] = useState(false);

  return (
    <div className="demo-root">
      <aside id="sideNav">
        <div className="logo">D</div>
        {navItems.map((n) => (
          <button key={n.key} className={n.key === 'home' ? 'navItem on' : 'navItem'}>
            <span className="ico">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </aside>

      <div id="main">
        <header id="topBar">
          <div className="brand">
            <div className="mark">D</div>
            <div>
              <b>DeepSFV</b>
              <br />
              <span>AI 短剧工坊 · 逆命木叶</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="tbBtn">领取创作者权益</button>
          <button className="tbBtn">商务合作</button>
          <button className="tbBtn vip">⚡ 开通会员</button>
          <div id="creditChip">◆ 940</div>
          <button className="bell">
            🔔<i />
          </button>
          <div className="avatar">赵</div>
        </header>

        <section className="page">
          <div className="viewInner">
            <div className="h2">
              空间 <em>· 个人</em>
            </div>
            <div className="sub2">个人项目卡 · 重命名 / 归档 · 项目积分余额 · 成片下载 · 存储用量</div>

            <div className="docPanel" style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 20 }}>
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
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b style={{ fontSize: 15 }}>个人空间</b>
                  <span className="miniTag">免费版</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>
                  存储用量 <b style={{ color: 'var(--txt)' }}>3.4 GB</b> / 10 GB · 成片保留 30 天 · 合成完成后可在此下载
                </div>
                <div className="storeBar">
                  <i />
                </div>
              </div>
              <button className="btn ghost sm">👥 切换团队空间</button>
            </div>

            <div className="secHead">
              <h3>📁 我的项目</h3>
              <button className="btn acc sm" onClick={() => setOpen(true)}>
                ＋ 新建项目
              </button>
            </div>

            <div className="spGrid">
              {projects.map((p) => (
                <div key={p.name} className="spCard">
                  <div className="cv">
                    {p.cover ? (
                      <img src={p.cover} alt={p.name} />
                    ) : (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          color: 'rgba(255,255,255,.85)',
                        }}
                      >
                        {p.name}
                      </span>
                    )}
                    {p.cover && (
                      <span className="aigcTag">
                        ✦ AI生成
                      </span>
                    )}
                    <div className="ops">
                      <button>✎ 重命名</button>
                      <button>📦 归档</button>
                    </div>
                  </div>
                  <div className="bd">
                    <b>{p.name}</b>
                    <div className="row">
                      <span>{p.updated}</span>
                      <span className={`pill ${p.status}`} style={{ padding: '2px 9px' }}>
                        <span className="dot" />
                        {p.statusText}
                      </span>
                    </div>
                    {p.rows.map(([l, r]) => (
                      <div className="row" key={l}>
                        <span>{l}</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="spNewCard" onClick={() => setOpen(true)}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>＋</div>
                  <div style={{ fontSize: 12 }}>新建项目</div>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>

      {open && (
        <div className="modalMask" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <h3>新建项目</h3>
              <button className="x" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <div className="fRow">
              <label>项目名称</label>
              <input placeholder="输入项目名称" />
            </div>
            <div className="f2 fRow">
              <div>
                <label>默认比例</label>
                <select>
                  <option>9:16</option>
                  <option>16:9</option>
                </select>
              </div>
              <div>
                <label>默认风格</label>
                <select>
                  <option>赛博朋克电影</option>
                  <option>国漫写实</option>
                </select>
              </div>
            </div>
            <div className="modalFoot">
              <button className="btn ghost sm" onClick={() => setOpen(false)}>
                取消
              </button>
              <button className="btn acc sm" onClick={() => setOpen(false)}>
                创 建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
