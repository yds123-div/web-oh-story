import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './NodeCanvasPage.css';
import { Toast, useToast, showToast } from '../components/Toast';

// 节点类型定义
type NodeType = 'script' | 'sub' | 'sb' | 'img' | 'vid' | 'merge' | 'dyn';

interface NodeData {
  label: string;
  icon: string;
  type: NodeType;
  body: string;
  status: string;
  statusClass: 'ok' | 'no' | 'wip';
  img?: string;
  vid?: string;
  take?: number;
  [key: string]: unknown; // 添加索引签名以满足 Record<string, unknown>
}

interface GroupTemplate {
  id: string;
  name: string;
  nodeIds: string[];
}

// 节点类型颜色映射
const TYPE_COLOR: Record<NodeType, string> = {
  script: '#60a5fa',
  sub: '#a78bfa',
  sb: '#f472b6',
  img: '#2dd4bf',
  vid: '#fb923c',
  merge: '#e8c37a',
  dyn: '#94a3b8',
};

// 右键菜单节点类型定义
const CTX_MENU_ITEMS = [
  { id: 'text', icon: '📝', label: '文本节点', desc: '自由文本 · 对白 · 设定' },
  { id: 'image', icon: '🖼', label: '图片节点', desc: '图片资产 / 生成结果' },
  { id: 'video', icon: '🎥', label: '视频节点', desc: '视频素材 / 生成结果' },
  { id: 'audio', icon: '🎵', label: '音频节点', desc: '配音 · 音效 · BGM' },
  { id: 'script', icon: '📜', label: '脚本节点', desc: '剧本 → 分镜 脚本' },
  { id: 'character', icon: '🧊', label: '主体生成', desc: '角色形象资产' },
  { id: 'storyboard', icon: '🎬', label: '分镜生成', desc: '分集 · 片段拆分' },
  { id: 'image-gen', icon: '🖼', label: '图像生成', desc: '关键帧 · 场景图' },
  { id: 'video-gen', icon: '🎥', label: '视频生成', desc: '片段视频合成' },
  { id: 'edit', icon: '✂', label: '智能剪辑', desc: '多片段对齐剪接' },
];

// 预置管线图数据
const INITIAL_NODES: Node<NodeData>[] = [
  {
    id: 'script',
    type: 'custom',
    position: { x: 24, y: 216 },
    data: {
      label: '剧本 · 第1集：异世囚笼',
      icon: '📄',
      type: 'script',
      body: '【木叶长廊 内 夜】<br>△ 动作行 ×6 · 对白 ×5<br>黑屏字幕收尾',
      status: 'READY',
      statusClass: 'ok',
    },
  },
  {
    id: 'linwan',
    type: 'custom',
    position: { x: 316, y: 52 },
    data: {
      label: '主体 · 林晚',
      icon: '🧊',
      type: 'sub',
      body: '素色和服 · 一致性锁定',
      status: 'READY',
      statusClass: 'ok',
      img: 'linwan.png',
    },
  },
  {
    id: 'itachi',
    type: 'custom',
    position: { x: 316, y: 216 },
    data: {
      label: '主体 · 宇智波鼬',
      icon: '🧊',
      type: 'sub',
      body: '深色忍服 · 红瞳微光',
      status: 'READY',
      statusClass: 'ok',
      img: 'itachi.png',
    },
  },
  {
    id: 'scene',
    type: 'custom',
    position: { x: 316, y: 380 },
    data: {
      label: '场景 · 木叶长廊-月夜',
      icon: '🏛',
      type: 'sub',
      body: '16:9 · 冷白月光 · 地灯暖光',
      status: 'READY',
      statusClass: 'ok',
      img: 'corridor.jpg',
    },
  },
  {
    id: 'sb1',
    type: 'custom',
    position: { x: 616, y: 28 },
    data: {
      label: '分镜 · 片段1',
      icon: '🎬',
      type: 'sb',
      body: '2 分镜 · ⏱ 13s<br>扶柱独白 → 鼬显露',
      status: 'READY',
      statusClass: 'ok',
    },
  },
  {
    id: 'sb2',
    type: 'custom',
    position: { x: 616, y: 186 },
    data: {
      label: '分镜 · 片段2',
      icon: '🎬',
      type: 'sb',
      body: '3 分镜 · ⏱ 14s<br>质问 → 过肩否认（语音标注）',
      status: 'READY',
      statusClass: 'ok',
    },
  },
  {
    id: 'sb3',
    type: 'custom',
    position: { x: 616, y: 344 },
    data: {
      label: '分镜 · 片段3',
      icon: '🎬',
      type: 'sb',
      body: '2 分镜 · ⏱ 10s<br>预言 → 警告 → 黑屏字幕',
      status: 'READY',
      statusClass: 'ok',
    },
  },
  {
    id: 'img1',
    type: 'custom',
    position: { x: 906, y: 28 },
    data: {
      label: '图像 · 关键帧 S1',
      icon: '🖼',
      type: 'img',
      body: '9:16 首帧 · 冷月廊柱',
      status: 'READY',
      statusClass: 'ok',
      img: 'corridor.jpg',
    },
  },
  {
    id: 'img2',
    type: 'custom',
    position: { x: 906, y: 186 },
    data: {
      label: '图像 · 关键帧 S2',
      icon: '🖼',
      type: 'img',
      body: '过肩构图 · 石地灯光晕',
      status: 'READY',
      statusClass: 'ok',
      img: 'corridor.jpg',
    },
  },
  {
    id: 'img3',
    type: 'custom',
    position: { x: 906, y: 344 },
    data: {
      label: '图像 · 关键帧 S3',
      icon: '🖼',
      type: 'img',
      body: '收暗前帧 · 廊柱剪影',
      status: 'READY',
      statusClass: 'ok',
      img: 'corridor.jpg',
    },
  },
  {
    id: 'vid1',
    type: 'custom',
    position: { x: 1196, y: 28 },
    data: {
      label: '视频 · 片段1',
      icon: '🎥',
      type: 'vid',
      body: '13s · 480P',
      status: '✓ 已生成',
      statusClass: 'ok',
      vid: 'clip1.mp4',
    },
  },
  {
    id: 'vid2',
    type: 'custom',
    position: { x: 1196, y: 186 },
    data: {
      label: '视频 · 片段2',
      icon: '🎥',
      type: 'vid',
      body: '14s · 480P',
      status: '✓ 已生成',
      statusClass: 'ok',
      vid: 'clip2.mp4',
    },
  },
  {
    id: 'vid3',
    type: 'custom',
    position: { x: 1196, y: 344 },
    data: {
      label: '视频 · 片段3',
      icon: '🎥',
      type: 'vid',
      body: '10s · 待生成',
      status: '未生成',
      statusClass: 'no',
      vid: 'clip3.mp4',
    },
  },
  {
    id: 'merge',
    type: 'custom',
    position: { x: 1486, y: 186 },
    data: {
      label: '合成 · 第1集整片',
      icon: '⬇',
      type: 'merge',
      body: '3 片段 · 00:37<br>导出 720P / MP4',
      status: 'PENDING',
      statusClass: 'wip',
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e-script-linwan', source: 'script', target: 'linwan', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-script-itachi', source: 'script', target: 'itachi', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-script-scene', source: 'script', target: 'scene', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-script-sb1', source: 'script', target: 'sb1', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-script-sb2', source: 'script', target: 'sb2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-script-sb3', source: 'script', target: 'sb3', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-linwan-sb1', source: 'linwan', target: 'sb1', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-scene-sb1', source: 'scene', target: 'sb1', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-itachi-sb2', source: 'itachi', target: 'sb2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-linwan-sb2', source: 'linwan', target: 'sb2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-itachi-sb3', source: 'itachi', target: 'sb3', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-scene-sb3', source: 'scene', target: 'sb3', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-sb1-img1', source: 'sb1', target: 'img1', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-sb2-img2', source: 'sb2', target: 'img2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-sb3-img3', source: 'sb3', target: 'img3', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-img1-vid1', source: 'img1', target: 'vid1', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-img2-vid2', source: 'img2', target: 'vid2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-img3-vid3', source: 'img3', target: 'vid3', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-vid1-merge', source: 'vid1', target: 'merge', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-vid2-merge', source: 'vid2', target: 'merge', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-vid3-merge', source: 'vid3', target: 'merge', markerEnd: { type: MarkerType.ArrowClosed } },
];

export default function NodeCanvasPage() {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [previewNode, setPreviewNode] = useState<Node<NodeData> | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupTemplate[]>([]);
  const { toast, closeToast } = useToast();

  const onConnect = useCallback(
    (params: Connection) => {
      // 连线校验：只允许合法端口连接
      if (params.source && params.target) {
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              markerEnd: { type: MarkerType.ArrowClosed },
            },
            eds
          )
        );
      }
    },
    [setEdges]
  );

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: 'clientX' in event ? event.clientX : 0,
        y: 'clientY' in event ? event.clientY : 0,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const addNodeFromMenu = useCallback(
    (item: (typeof CTX_MENU_ITEMS)[0]) => {
      if (!contextMenu) return;

      const newNode: Node<NodeData> = {
        id: `dyn-${Date.now()}`,
        type: 'custom',
        position: { x: contextMenu.x - 200, y: contextMenu.y - 100 },
        data: {
          label: item.label,
          icon: item.icon,
          type: 'dyn',
          body: item.desc,
          status: 'READY',
          statusClass: 'ok',
        },
      };

      setNodes((nds) => [...nds, newNode]);
      closeContextMenu();
    },
    [contextMenu, setNodes, closeContextMenu]
  );

  const handleNodeAction = useCallback(
    (nodeId: string, action: 'preview' | 'duplicate' | 'delete') => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeData = node.data as NodeData;

      switch (action) {
        case 'preview':
          if (nodeData.img || nodeData.vid) {
            setPreviewNode(node);
          }
          break;
        case 'duplicate':
          const duplicatedNode: Node<NodeData> = {
            ...node,
            id: `${node.id}-copy-${Date.now()}`,
            position: { x: node.position.x + 28, y: node.position.y + 28 },
            data: {
              ...nodeData,
              label: `${nodeData.label} 副本`,
            },
          };
          setNodes((nds) => [...nds, duplicatedNode]);
          break;
        case 'delete':
          setNodes((nds) => nds.filter((n) => n.id !== nodeId));
          setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
          break;
      }
    },
    [nodes, setNodes, setEdges]
  );

  // 工具栏功能处理
  const handleToolAction = useCallback(
    (tool: string) => {
      if (selectedNodes.length === 0) {
        if (tool === 'group') {
          showToast('打组复用：请 Ctrl+点击 多选 2 个以上节点');
        } else {
          showToast('请先点击选中一个节点，再调用该功能');
        }
        return;
      }

      const selectedNode = nodes.find((n) => selectedNodes.includes(n.id));
      if (!selectedNode) return;

      const nodeData = selectedNode.data as NodeData;

      switch (tool) {
        case 'vid':
          const vidNode: Node<NodeData> = {
            id: `dyn-${Date.now()}`,
            type: 'custom',
            position: { x: selectedNode.position.x + 260, y: selectedNode.position.y + 40 },
            data: {
              label: `视频生成 · ${nodeData.label.split(' · ').pop()}`,
              icon: '🎥',
              type: 'vid',
              body: 'Seedance 2.5 · 9:16 · 480P · 13s',
              status: '✓ 已生成',
              statusClass: 'ok',
              vid: 'clip1.mp4',
            },
          };
          setNodes((nds) => [...nds, vidNode]);
          setEdges((eds) => [
            ...eds,
            { id: `e-${selectedNode.id}-${vidNode.id}`, source: selectedNode.id, target: vidNode.id, markerEnd: { type: MarkerType.ArrowClosed } },
          ]);
          showToast('已调用「视频生成」→ 生成子节点并自动连线（演示）');
          break;

        case 'img':
          const imgNode: Node<NodeData> = {
            id: `dyn-${Date.now()}`,
            type: 'custom',
            position: { x: selectedNode.position.x + 260, y: selectedNode.position.y + 40 },
            data: {
              label: `图片生成 · ${nodeData.label.split(' · ').pop()}`,
              icon: '🖼',
              type: 'img',
              body: '图片节点 · 4K · 9积分',
              status: 'READY',
              statusClass: 'ok',
              img: nodeData.img || 'corridor.jpg',
            },
          };
          setNodes((nds) => [...nds, imgNode]);
          setEdges((eds) => [
            ...eds,
            { id: `e-${selectedNode.id}-${imgNode.id}`, source: selectedNode.id, target: imgNode.id, markerEnd: { type: MarkerType.ArrowClosed } },
          ]);
          showToast('已调用「图片生成」→ 生成子节点并自动连线（演示）');
          break;

        case 'aud':
          const audNode: Node<NodeData> = {
            id: `dyn-${Date.now()}`,
            type: 'custom',
            position: { x: selectedNode.position.x + 260, y: selectedNode.position.y + 40 },
            data: {
              label: `音频生成 · ${nodeData.label.split(' · ').pop()}`,
              icon: '🎵',
              type: 'dyn',
              body: '音频 · 对白配音 + 现场环境声',
              status: 'READY',
              statusClass: 'ok',
            },
          };
          setNodes((nds) => [...nds, audNode]);
          setEdges((eds) => [
            ...eds,
            { id: `e-${selectedNode.id}-${audNode.id}`, source: selectedNode.id, target: audNode.id, markerEnd: { type: MarkerType.ArrowClosed } },
          ]);
          showToast('已调用「音频生成」→ 生成子节点并自动连线（演示）');
          break;

        case 'txt':
          const txtNode: Node<NodeData> = {
            id: `dyn-${Date.now()}`,
            type: 'custom',
            position: { x: selectedNode.position.x + 260, y: selectedNode.position.y + 40 },
            data: {
              label: `文本 · ${nodeData.label.split(' · ').pop()}`,
              icon: '📝',
              type: 'dyn',
              body: '自由文本 · 待编排对白草稿',
              status: 'READY',
              statusClass: 'ok',
            },
          };
          setNodes((nds) => [...nds, txtNode]);
          setEdges((eds) => [
            ...eds,
            { id: `e-${selectedNode.id}-${txtNode.id}`, source: selectedNode.id, target: txtNode.id, markerEnd: { type: MarkerType.ArrowClosed } },
          ]);
          showToast('已调用「文本」→ 生成子节点并自动连线（演示）');
          break;

        case 'edit':
          showToast('智能剪辑：多片段对齐 / 剪接 / 音乐收尾 ｜ 目标节点：' + nodeData.label);
          break;

        case 'tri':
          const triNodes = [
            { dx: 0, dy: -8, label: '三视图 · 正面', body: '正面 · 一致性参考' },
            { dx: 0, dy: 112, label: '三视图 · 侧面', body: '侧面 · 一致性参考' },
            { dx: 0, dy: 232, label: '三视图 · 背面', body: '背面 · 一致性参考' },
          ];
          triNodes.forEach((item, i) => {
            const newNode: Node<NodeData> = {
              id: `dyn-${Date.now()}-${i}`,
              type: 'custom',
              position: { x: selectedNode.position.x + 262, y: selectedNode.position.y - 20 + item.dy },
              data: {
                label: item.label,
                icon: '🖼',
                type: 'img',
                body: item.body,
                status: 'READY',
                statusClass: 'ok',
                img: nodeData.img || 'linwan.png',
              },
            };
            setNodes((nds) => [...nds, newNode]);
            setEdges((eds) => [
              ...eds,
              { id: `e-${selectedNode.id}-${newNode.id}`, source: selectedNode.id, target: newNode.id, markerEnd: { type: MarkerType.ArrowClosed } },
            ]);
          });
          showToast('已生成「角色三视图」：正 / 侧 / 背 三节点（一致性参考已锁定）');
          break;

        case 'grid':
          const gridNode: Node<NodeData> = {
            id: `dyn-${Date.now()}`,
            type: 'custom',
            position: { x: selectedNode.position.x + 262, y: selectedNode.position.y + 40 },
            data: {
              label: '多机位九宫格',
              icon: '🔲',
              type: 'dyn',
              body: '9 机位候选构图<br>已生成多机位布局',
              status: 'READY',
              statusClass: 'ok',
            },
          };
          setNodes((nds) => [...nds, gridNode]);
          setEdges((eds) => [
            ...eds,
            { id: `e-${selectedNode.id}-${gridNode.id}`, source: selectedNode.id, target: gridNode.id, markerEnd: { type: MarkerType.ArrowClosed } },
          ]);
          showToast('已生成「多机位九宫格」：一镜 9 机位候选构图节点');
          break;

        case 'light':
          const lightNodes = [
            { dy: -8, label: '灯光 · 冷月光', body: '冷白主光 · 高对比' },
            { dy: 112, label: '灯光 · 地灯暖光', body: '暖调氛围 · 柔和' },
            { dy: 232, label: '灯光 · 逆光剪影', body: '逆光 · 剪影构图' },
          ];
          lightNodes.forEach((item, i) => {
            const newNode: Node<NodeData> = {
              id: `dyn-${Date.now()}-${i}`,
              type: 'custom',
              position: { x: selectedNode.position.x + 262, y: selectedNode.position.y - 20 + item.dy },
              data: {
                label: item.label,
                icon: '🖼',
                type: 'img',
                body: item.body,
                status: 'READY',
                statusClass: 'ok',
                img: nodeData.img || 'corridor.jpg',
              },
            };
            setNodes((nds) => [...nds, newNode]);
            setEdges((eds) => [
              ...eds,
              { id: `e-${selectedNode.id}-${newNode.id}`, source: selectedNode.id, target: newNode.id, markerEnd: { type: MarkerType.ArrowClosed } },
            ]);
          });
          showToast('已生成 3 组灯光变体：冷月 / 地灯暖光 / 逆光剪影');
          break;

        case 'hd':
          setNodes((nds) =>
            nds.map((n) =>
              n.id === selectedNode.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: '4K 已扩图',
                    } as NodeData,
                  }
                : n
            )
          );
          showToast('高清扩图完成：480P 草稿 → 4K 外扩构图（节点状态已更新）');
          break;

        case 'frame':
          showToast('逐帧拉片：按帧检视表演与穿帮 ｜ 目标节点：' + nodeData.label);
          break;

        case 'retake':
          const takeCount = (nodeData.take as number || 1) + 1;
          setNodes((nds) =>
            nds.map((n) =>
              n.id === selectedNode.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: `TAKE ${takeCount}`,
                      take: takeCount,
                      body: `${(n.data as NodeData).body}<br>TAKE ${takeCount} · 保持资产一致性重拍`,
                    } as NodeData,
                  }
                : n
            )
          );
          showToast(`片段重拍已提交（TAKE ${takeCount}）· 旧版本保留可回滚`);
          break;

        case 'group':
          if (selectedNodes.length < 2) {
            showToast('打组复用：请 Ctrl+点击 多选 2 个以上节点');
            return;
          }
          const newGroup: GroupTemplate = {
            id: `group-${Date.now()}`,
            name: `组 ${groups.length + 1}`,
            nodeIds: [...selectedNodes],
          };
          setGroups((prev) => [...prev, newGroup]);
          setSelectedNodes([]);
          showToast('已打组 ' + selectedNodes.length + ' 个节点并保存为模板（左下角可一键重复执行）');
          break;

        default:
          showToast('演示功能');
      }
    },
    [selectedNodes, nodes, setNodes, setEdges]
  );

  // 执行组模板
  const executeGroup = useCallback(
    (group: GroupTemplate) => {
      const idMap: Record<string, string> = {};
      let nodeCount = 0;

      // 克隆节点
      group.nodeIds.forEach((oldId) => {
        const sourceNode = nodes.find((n) => n.id === oldId);
        if (!sourceNode) return;

        const newId = `dyn-${Date.now()}-${nodeCount}`;
        idMap[oldId] = newId;

        const newNode: Node<NodeData> = {
          ...sourceNode,
          id: newId,
          position: { x: sourceNode.position.x + 56, y: sourceNode.position.y + 56 },
          data: {
            ...sourceNode.data,
            label: sourceNode.data.label,
          },
        };

        setNodes((nds) => [...nds, newNode]);
        nodeCount++;
      });

      // 克隆连线
      setTimeout(() => {
        setEdges((eds) => {
          const newEdges: Edge[] = [];
          group.nodeIds.forEach((oldId) => {
            const relatedEdges = edges.filter((e) => e.source === oldId || e.target === oldId);
            relatedEdges.forEach((edge) => {
              const newSource = idMap[edge.source];
              const newTarget = idMap[edge.target];
              if (newSource && newTarget) {
                newEdges.push({
                  ...edge,
                  id: `e-${newSource}-${newTarget}`,
                  source: newSource,
                  target: newTarget,
                });
              }
            });
          });
          return [...eds, ...newEdges];
        });
      }, 100);

      showToast(`已重复执行「${group.name}」：克隆 ${nodeCount} 个节点并复刻内部连线`);
    },
    [nodes, edges, setNodes, setEdges]
  );

  const nodeTypes = useMemo(
    () => ({
      custom: ({ data, id, selected }: { data: NodeData; id: string; selected?: boolean }) => {
        const handleSelect = (e: React.MouseEvent) => {
          if (e.ctrlKey || e.metaKey) {
            if (selected) {
              setSelectedNodes((prev) => prev.filter((n) => n !== id));
            } else {
              setSelectedNodes((prev) => [...prev, id]);
            }
          } else {
            setSelectedNodes([id]);
          }
        };

        return (
          <div
            className={`custom-node ${selected ? 'selected' : ''}`}
            style={{ borderColor: TYPE_COLOR[data.type] || TYPE_COLOR.dyn }}
            onMouseDown={handleSelect}
          >
            <Handle type="target" position={Position.Left} className="port in" />
            <div className="node-header">
              <span className="node-icon">{data.icon}</span>
              <span className="node-title">{data.label}</span>
            </div>
            {(data.img || data.vid) && (
              <div className="node-thumb">
                {data.img ? (
                  <img src={data.img} alt="" draggable={false} />
                ) : (
                  <video src={data.vid} preload="metadata" muted />
                )}
              </div>
            )}
            <div className="node-body" dangerouslySetInnerHTML={{ __html: data.body }} />
            <span className={`node-status ${data.statusClass}`}>{data.status}</span>
            <div className="node-actions">
              <button
                title="画布快捷预览"
                onClick={() => handleNodeAction(id, 'preview')}
                disabled={!data.img && !data.vid}
              >
                ▶
              </button>
              <button title="复制节点" onClick={() => handleNodeAction(id, 'duplicate')}>
                ⧉
              </button>
              <button title="删除节点" onClick={() => handleNodeAction(id, 'delete')}>
                🗑
              </button>
            </div>
            <Handle type="source" position={Position.Right} className="port out" />
          </div>
        );
      },
    }),
    [handleNodeAction]
  );

  return (
    <div className="node-canvas-page">
      <div className="canvas-toolbar">
        <button className="back-btn" onClick={() => navigate('/canvas')}>
          ‹
        </button>
        <span className="canvas-title">逆命木叶 · 第1集「异世囚笼」</span>
        <div className="canvas-tools">
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('vid')}>🎥 视频生成</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('img')}>🖼 图片生成</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('aud')}>🎵 音频生成</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('txt')}>📝 文本</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('edit')}>✂ 智能剪辑</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('tri')}>👥 角色三视图</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('grid')}>🔲 多机位九宫格</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('light')}>💡 灯光控制</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('hd')}>🔍 高清扩图</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('frame')}>🎞 逐帧拉片</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('retake')}>↻ 片段重拍</button>
          <button className={`tool-btn ${selectedNodes.length > 0 ? 'hot' : ''}`} onClick={() => handleToolAction('group')}>📦 打组复用</button>
        </div>
        <div className="canvas-actions">
          <button className="action-btn" onClick={() => {}}>
            ↻ 重排
          </button>
          <button className="action-btn" onClick={() => {}}>
            🧹 清空
          </button>
        </div>
      </div>

      <div className="canvas-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={() => {
            setSelectedNodes([]);
            closeContextMenu();
          }}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={1.6}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const nodeData = node.data as NodeData;
              return TYPE_COLOR[nodeData.type] || TYPE_COLOR.dyn;
            }}
            position="bottom-right"
          />
        </ReactFlow>

        {groups.length > 0 && (
          <div className="group-panel">
            <div className="group-panel-header">📦 已保存的组模板</div>
            {groups.map((group) => (
              <div key={group.id} className="group-item">
                <span>📦 {group.name} · {group.nodeIds.length} 节点</span>
                <button onClick={() => executeGroup(group)}>▶ 执行</button>
              </div>
            ))}
          </div>
        )}

        {contextMenu && (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={closeContextMenu}
          >
            {CTX_MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  addNodeFromMenu(item);
                }}
              >
                <span>{item.icon}</span>
                {item.label}
                <i style={{ marginLeft: 'auto', fontStyle: 'normal', fontSize: '9.5px', color: '#888' }}>
                  {item.desc}
                </i>
              </button>
            ))}
          </div>
        )}

        {previewNode && (
          <div
            className="preview-modal"
            onClick={() => setPreviewNode(null)}
          >
            <div className="preview-content" onClick={(e) => e.stopPropagation()}>
              <div className="preview-header">
                <span>{(previewNode.data as NodeData).label}</span>
                <button onClick={() => setPreviewNode(null)}>×</button>
              </div>
              <div className="preview-body">
                {(previewNode.data as NodeData).vid ? (
                  <video src={(previewNode.data as NodeData).vid} controls autoPlay muted loop />
                ) : (
                  <img src={(previewNode.data as NodeData).img} alt="" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onClose={closeToast} />}
    </div>
  );
}
