import { useEffect, useMemo, useState } from 'react';
import { App, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listTemplates } from '../lib/api';
import { filterTemplatesByTag } from '../lib/templates';
import type { Template } from '../types/api';

const TAGS = ['all', '科幻', '废土', '大女主', '爽文', '复仇', '悬疑烧脑', '权谋', '治愈', '逆袭'];

export default function IdeaPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tag, setTag] = useState('all');

  useEffect(() => {
    void listTemplates()
      .then((data) => setTemplates(data.templates))
      .catch(() => message.error('加载模板失败'));
  }, [message]);

  const visible = useMemo(() => filterTemplatesByTag(templates, tag), [templates, tag]);

  const apply = (tpl: Template) => {
    message.success(`已套用模板「${tpl.name}」· 进入创作`);
    navigate(`/create?templateId=${tpl.id}`);
  };

  return (
    <div style={{ padding: '30px 32px 70px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <h2 className="ds-h2">
        创意 <em>· 官方示例</em>
      </h2>
      <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
        官方出品模板 · 套用即开拍，预填剧本与创作参数
      </Typography.Text>

      <div className="ds-secHead">
        <h3>🏆 官方示例</h3>
        <span>点击标签筛选 · 「套用」自动填充创作入口</span>
      </div>
      <div className="ds-chips">
        {TAGS.map((item) => (
          <button
            key={item}
            type="button"
            className={`ds-chip${tag === item ? ' on' : ''}`}
            onClick={() => setTag(item)}
          >
            {item === 'all' ? '全部' : item}
          </button>
        ))}
      </div>
      <div className="ds-canvasGrid">
        {visible.map((tpl) => (
          <div key={tpl.id} className="ds-workCard">
            <div className="ds-tplCover">
              <img className="bg" src={tpl.coverUrl} style={{ filter: tpl.coverFilter }} alt="" />
              <div className="cap">
                {tpl.name}
                <span className="sub">{tpl.subtitle}</span>
              </div>
              <span className="covTags">{tpl.tags.join(' · ')}</span>
            </div>
            <div className="ds-tplOps">
              <span className="cnt">官方</span>
              <Button type="primary" className="ds-grad ds-pill" size="small" onClick={() => apply(tpl)}>
                套用
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
