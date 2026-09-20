import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CanvasPage.css';
import { Toast, useToast, showToast } from '../components/Toast';

interface Canvas {
  id: string;
  name: string;
  ratio: string;
  cover?: string;
  tags?: string[];
  status: 'in-progress' | 'archived';
  segments?: number;
  duration?: string;
  isTemplate?: boolean;
  usageCount?: string;
}

export default function CanvasPage() {
  const navigate = useNavigate();
  const { toast, closeToast } = useToast();
  const [showNewCanvasModal, setShowNewCanvasModal] = useState(false);
  const [canvasName, setCanvasName] = useState('');
  const [selectedRatio, setSelectedRatio] = useState('9:16');
  const [selectedCategory, setSelectedCategory] = useState('全部');

  // 我的画布数据
  const [myCanvases, setMyCanvases] = useState<Canvas[]>([
    {
      id: '1',
      name: '逆命木叶',
      ratio: '9:16',
      cover: 'corridor.jpg',
      tags: ['进行中'],
      status: 'in-progress',
      segments: 3,
      duration: '00:37',
    },
    {
      id: '2',
      name: '火影乱斗',
      ratio: '16:9',
      status: 'archived',
      segments: 4,
      duration: '00:46',
    },
  ]);

  // 创作工坊画布数据
  const sharedCanvases: Canvas[] = [
    {
      id: 't1',
      name: 'ONE MOVE GOD MODE',
      ratio: '9:16',
      tags: ['EXCLUSIVE'],
      status: 'in-progress',
      isTemplate: true,
      usageCount: '12.8w 使用',
    },
    {
      id: 't2',
      name: '机甲废土 SCRAP KING',
      ratio: '16:9',
      status: 'in-progress',
      isTemplate: true,
      usageCount: '8.3w 使用',
    },
    {
      id: 't3',
      name: 'BEASTLY LORD',
      ratio: '9:16',
      status: 'in-progress',
      isTemplate: true,
      usageCount: '6.1w 使用',
    },
    {
      id: 't4',
      name: '披萨外送员的诸神黄昏',
      ratio: '16:9',
      status: 'in-progress',
      isTemplate: true,
      usageCount: '5.7w 使用',
    },
  ];

  const categories = ['全部', '精选画布', '教育生活', '专业影视', '声音剧场'];

  const handleCreateCanvas = () => {
    if (!canvasName.trim()) {
      showToast('请输入画布名称');
      return;
    }

    const newCanvas: Canvas = {
      id: Date.now().toString(),
      name: canvasName.trim(),
      ratio: selectedRatio,
      status: 'in-progress',
      segments: 0,
      duration: '00:00',
    };

    setMyCanvases((prev) => [newCanvas, ...prev]);
    setCanvasName('');
    setShowNewCanvasModal(false);
    showToast(`画布「${newCanvas.name}」已创建（${selectedRatio}）`);
  };

  const handleOpenCanvas = (canvasId: string) => {
    navigate(`/canvas/${canvasId}`);
  };

  const handleUseTemplate = () => {
    showToast('演示：复制他人画布到我的项目');
  };

  const filteredSharedCanvases = sharedCanvases.filter((canvas) => {
    const matchesCategory = selectedCategory === '全部' || canvas.tags?.includes(selectedCategory);
    return matchesCategory;
  });

  return (
    <div className="canvas-page">
      <div className="viewInner">
        <div className="page-header">
          <h2>
            画布 <em>· Canvas</em>
          </h2>
          <p className="sub2">
            参考 tiaoyue /aigc/canvas/canvasList ｜ 节点式创作画布的管理中枢：新建画布、选择生成比例、打开画布进入节点编辑器
          </p>
        </div>

        <div className="secHead"><h3>📁 项目 · 逆命木叶企划</h3><span style={{fontSize:'12px',color:'#a78bfa',cursor:'pointer'}}>全部 ›</span></div>

        <div className="canvasGrid">
          <div className="newCanvasCard" onClick={() => setShowNewCanvasModal(true)}>
            <span className="star">✦</span>
            创建画布
          </div>

          {myCanvases.map((canvas) => (
            <div key={canvas.id} className="workCard">
              <div
                className="workCover"
                style={{
                  background: canvas.cover
                    ? 'linear-gradient(150deg,#1c2440,#3a2f6b 55%,#141a33)'
                    : 'linear-gradient(150deg,#241a3d,#3a2a5c)',
                }}
              >
                {canvas.cover && (
                  <img
                    src={canvas.cover}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.55,
                    }}
                    alt=""
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
                  {canvas.name}
                  <span className="sub">
                    {canvas.segments} 片段 · {canvas.duration} · {canvas.ratio}
                  </span>
                </span>
                {canvas.tags?.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="workOps">
                <button className="pri" onClick={() => handleOpenCanvas(canvas.id)}>
                  打开画布
                </button>
                <button onClick={() => navigate('/outline')}>三步工作流</button>
              </div>
            </div>
          ))}
        </div>

        <div className="secHead" style={{marginTop:'30px'}}><h3>🎨 创作工坊 · 他人分享的画布</h3></div>

        <div className="chips">
          {categories.map((category) => (
            <button
              key={category}
              className={`chip ${selectedCategory === category ? 'on' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
          <div className="searchBox">
            🔍 描述你想要找的画布 / 资产
          </div>
        </div>

        <div className="canvasGrid">
          {filteredSharedCanvases.map((canvas) => (
            <div key={canvas.id} className="workCard" onClick={handleUseTemplate}>
              <div
                className="workCover"
                style={{
                  background: 'linear-gradient(150deg,#0f2b4d,#1d4a7a 60%,#0c1f3a)',
                }}
              >
                {canvas.tags?.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
                {canvas.name}
                <div className="tplOps">
                  <span className="cnt">{canvas.usageCount}</span>
                  <button
                    className="use"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseTemplate();
                    }}
                  >
                    用此创作
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNewCanvasModal && (
        <div className="modalMask" onClick={() => setShowNewCanvasModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <h3>新建画布</h3>
              <button className="x" onClick={() => setShowNewCanvasModal(false)}>
                ×
              </button>
            </div>
            <div className="fRow">
              <label>选择项目</label>
              <select>
                <option>逆命木叶企划</option>
                <option>默认项目</option>
              </select>
            </div>
            <div className="fRow">
              <label>画布名称</label>
              <input
                type="text"
                placeholder="输入画布名称"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
              />
            </div>
            <div className="fRow">
              <label>默认生成比例</label>
              <div className="ratioOpts">
                <div
                  className={`ratioOpt ${selectedRatio === '9:16' ? 'on' : ''}`}
                  onClick={() => setSelectedRatio('9:16')}
                >
                  <div className="box v"></div>
                  <div>
                    <b style={{ fontSize: '13.5px' }}>9:16</b>
                    <div style={{ fontSize: '10px', color: 'var(--ant-color-text-tertiary)' }}>竖屏 · 短剧</div>
                  </div>
                </div>
                <div
                  className={`ratioOpt ${selectedRatio === '16:9' ? 'on' : ''}`}
                  onClick={() => setSelectedRatio('16:9')}
                >
                  <div className="box h"></div>
                  <div>
                    <b style={{ fontSize: '13.5px' }}>16:9</b>
                    <div style={{ fontSize: '10px', color: 'var(--ant-color-text-tertiary)' }}>横屏 · 影视</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modalFoot">
              <button className="btn ghost sm" onClick={() => setShowNewCanvasModal(false)}>
                取 消
              </button>
              <button className="btn white sm" onClick={handleCreateCanvas}>
                创 建
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={closeToast} />}
    </div>
  );
}
