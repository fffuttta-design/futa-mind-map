"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MindMapNode } from "@/types";
import NodePropertiesPanel from "./NodePropertiesPanel";

interface Props {
  initialNodes: MindMapNode[];
  onNodesChange: (nodes: MindMapNode[]) => void;
}

const NODE_H = 34;
const NODE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

function nodeWidth(text: string) {
  return Math.max(80, Math.min(220, text.length * 8.5 + 48));
}

export default function MindMapCanvas({ initialNodes, onNodesChange }: Props) {
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ mx: number; my: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showPanel, setShowPanel] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<SVGRectElement>(null);

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

  useEffect(() => { setNodes(initialNodes); }, [initialNodes]);

  const updateNodes = useCallback((updated: MindMapNode[]) => {
    setNodes(updated);
    onNodesChange(updated);
  }, [onNodesChange]);

  const getVisibleNodes = useCallback((nodeList: MindMapNode[]) => {
    const collapsedIds = new Set(nodeList.filter(n => n.collapsed).map(n => n.id));
    const hidden = new Set<string>();
    const hide = (pid: string) => nodeList.filter(n => n.parentId === pid).forEach(n => { hidden.add(n.id); hide(n.id); });
    collapsedIds.forEach(id => hide(id));
    return nodeList.filter(n => !hidden.has(n.id));
  }, []);

  const addChild = useCallback((parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    const siblings = nodes.filter(n => n.parentId === parentId);
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      text: "新しいノード",
      x: parent.x + 220,
      y: parent.y + siblings.length * 60 - Math.max(0, siblings.length - 1) * 30,
      parentId,
      color: parent.id === "root" ? NODE_COLORS[siblings.length % NODE_COLORS.length] : parent.color,
    };
    const base = nodes.map(n => n.id === parentId ? { ...n, collapsed: false } : n);
    updateNodes([...base, newNode]);
    setSelectedIds(new Set([newNode.id]));
    setTimeout(() => { setEditingId(newNode.id); setEditText(newNode.text); }, 50);
  }, [nodes, updateNodes]);

  const addSibling = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.parentId) { addChild(nodeId); return; }
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      text: "新しいノード",
      x: node.x,
      y: node.y + 60,
      parentId: node.parentId,
      color: node.color,
    };
    updateNodes([...nodes, newNode]);
    setSelectedIds(new Set([newNode.id]));
    setTimeout(() => { setEditingId(newNode.id); setEditText(newNode.text); }, 50);
  }, [nodes, updateNodes, addChild]);

  const deleteNodes = useCallback((ids: Set<string>) => {
    const toDelete = new Set<string>();
    const collect = (id: string) => { toDelete.add(id); nodes.filter(n => n.parentId === id).forEach(n => collect(n.id)); };
    ids.forEach(id => { if (id !== "root") collect(id); });
    updateNodes(nodes.filter(n => !toDelete.has(n.id)));
    setSelectedIds(new Set());
    setShowPanel(false);
  }, [nodes, updateNodes]);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    updateNodes(nodes.map(n => n.id === editingId ? { ...n, text: editText.trim() || n.text } : n));
    setEditingId(null);
  }, [editingId, editText, nodes, updateNodes]);

  const toggleCollapse = useCallback((nodeId: string) => {
    updateNodes(nodes.map(n => n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n));
  }, [nodes, updateNodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) {
        if (e.key === "Escape") setEditingId(null);
        return;
      }
      if (selectedIds.size === 0) return;
      const id = [...selectedIds][0];
      if (e.key === "Tab") { e.preventDefault(); addChild(id); }
      else if (e.key === "Enter") { e.preventDefault(); addSibling(id); }
      else if (e.key === "F2" || e.key === " ") {
        e.preventDefault();
        const n = nodes.find(n => n.id === id);
        if (n) { setEditingId(id); setEditText(n.text); }
      } else if (e.key === "Delete") { deleteNodes(selectedIds); }
      else if (e.key === "Escape") { setSelectedIds(new Set()); setShowPanel(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, editingId, addChild, addSibling, deleteNodes, nodes]);

  useEffect(() => {
    if (editingId && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editingId]);

  const toCanvas = (cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - pan.x - r.width / 2) / zoom, y: (cy - r.top - pan.y - r.height / 2) / zoom };
  };

  const onNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedIds(prev => { const s = new Set(prev); s.has(nodeId) ? s.delete(nodeId) : s.add(nodeId); return s; });
      return;
    }
    if (!selectedIds.has(nodeId)) setSelectedIds(new Set([nodeId]));
    const node = nodes.find(n => n.id === nodeId)!;
    const p = toCanvas(e.clientX, e.clientY);
    setDragging({ id: nodeId, ox: p.x - node.x, oy: p.y - node.y });
  };

  const onBgMouseDown = (e: React.MouseEvent) => {
    if (editingId) commitEdit();
    setSelectedIds(new Set());
    setShowPanel(false);
    setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const p = toCanvas(e.clientX, e.clientY);
      setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x: p.x - dragging.ox, y: p.y - dragging.oy } : n));
    }
    if (panStart) setPan({ x: panStart.px + e.clientX - panStart.mx, y: panStart.py + e.clientY - panStart.my });
  };

  const onMouseUp = () => {
    if (dragging) onNodesChange(nodes);
    setDragging(null);
    setPanStart(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.2, z - e.deltaY * 0.001)));
  };

  const visible = getVisibleNodes(nodes);
  const visibleIds = new Set(visible.map(n => n.id));
  const svgW = svgRef.current?.clientWidth ?? 800;
  const svgH = svgRef.current?.clientHeight ?? 600;
  const tx = svgW / 2 + pan.x;
  const ty = svgH / 2 + pan.y;

  const edgePath = (x1: number, y1: number, x2: number, y2: number) => {
    const cx = (x1 + x2) / 2;
    return `M ${x1},${y1} C ${cx},${y1} ${cx},${y2} ${x2},${y2}`;
  };

  return (
    <div className="w-full h-full bg-gray-50 relative overflow-hidden select-none">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: panStart ? "grabbing" : "grab" }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <rect
          ref={bgRef}
          width="100%" height="100%"
          fill="transparent"
          onMouseDown={onBgMouseDown}
        />
        <g transform={`translate(${tx},${ty}) scale(${zoom})`}>
          {/* Edges */}
          {visible.filter(n => n.parentId && visibleIds.has(n.parentId)).map(n => {
            const p = nodes.find(x => x.id === n.parentId)!;
            const pw = nodeWidth(p.text);
            const nw = nodeWidth(n.text);
            return (
              <path
                key={`e-${n.id}`}
                d={edgePath(p.x + pw / 2, p.y, n.x - nw / 2, n.y)}
                fill="none"
                stroke={n.color}
                strokeWidth={2}
                strokeOpacity={0.45}
              />
            );
          })}

          {/* Nodes */}
          {visible.map(node => {
            const w = nodeWidth(node.text);
            const isSelected = selectedIds.has(node.id);
            const hasChildren = nodes.some(n => n.parentId === node.id);
            const hiddenCount = node.collapsed ? nodes.filter(n => n.parentId === node.id).length : 0;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={e => onNodeMouseDown(e, node.id)}
                onDoubleClick={e => {
                  e.stopPropagation();
                  setSelectedIds(new Set([node.id]));
                  setEditingId(node.id);
                  setEditText(node.text);
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={-w / 2} y={-NODE_H / 2}
                  width={w} height={NODE_H}
                  rx={NODE_H / 2}
                  fill={node.color}
                  fillOpacity={isSelected ? 1 : 0.88}
                  stroke={isSelected ? "#1e293b" : "transparent"}
                  strokeWidth={2.5}
                />
                {node.icon && (
                  <text x={-w / 2 + 16} textAnchor="middle" dominantBaseline="middle" fontSize={14} style={{ pointerEvents: "none" }}>
                    {node.icon}
                  </text>
                )}
                {editingId !== node.id && (
                  <text
                    x={node.icon ? 8 : 0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={13}
                    fontWeight={500}
                    style={{ pointerEvents: "none" }}
                  >
                    {node.text.length > 16 ? node.text.slice(0, 16) + "…" : node.text}
                  </text>
                )}
                {node.note && <circle cx={w / 2 - 6} cy={-NODE_H / 2 + 6} r={4} fill="#fbbf24" style={{ pointerEvents: "none" }} />}
                {node.url && <circle cx={w / 2 - (node.note ? 16 : 6)} cy={-NODE_H / 2 + 6} r={4} fill="#60a5fa" style={{ pointerEvents: "none" }} />}

                {hasChildren && (
                  <g
                    transform={`translate(${w / 2 + 12}, 0)`}
                    onClick={e => { e.stopPropagation(); toggleCollapse(node.id); }}
                    style={{ cursor: "pointer" }}
                  >
                    <circle r={9} fill="white" stroke={node.color} strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={node.color} fontWeight="bold" style={{ pointerEvents: "none" }}>
                      {node.collapsed ? `+${hiddenCount}` : "−"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Inline editor */}
      {editingId && (() => {
        const node = nodes.find(n => n.id === editingId);
        if (!node || !svgRef.current) return null;
        const r = svgRef.current.getBoundingClientRect();
        const sx = r.width / 2 + pan.x + node.x * zoom;
        const sy = r.height / 2 + pan.y + node.y * zoom;
        const w = nodeWidth(editText) * zoom;
        return (
          <input
            ref={inputRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") setEditingId(null);
              if (e.key === "Tab") { e.preventDefault(); commitEdit(); setTimeout(() => addChild(editingId!), 30); }
            }}
            style={{
              position: "absolute",
              left: sx - w / 2,
              top: sy - (NODE_H * zoom) / 2,
              width: w,
              height: NODE_H * zoom,
              fontSize: 13 * zoom,
            }}
            className="text-center font-medium text-white bg-transparent border-none outline-none px-2"
          />
        );
      })()}

      {/* Toolbar */}
      {selectedIds.size > 0 && !editingId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {selectedId && (
            <button
              onClick={() => { setShowPanel(p => !p); }}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 shadow-sm"
            >
              ✏️ プロパティ
            </button>
          )}
          {selectedId && (
            <button
              onClick={() => addChild(selectedId)}
              className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 shadow-sm"
            >
              ＋ 子ノード (Tab)
            </button>
          )}
          {selectedId && (
            <button
              onClick={() => addSibling(selectedId)}
              className="px-3 py-1.5 bg-indigo-100 text-indigo-600 text-xs rounded-lg hover:bg-indigo-200 shadow-sm"
            >
              ＋ 兄弟ノード (Enter)
            </button>
          )}
          <button
            onClick={() => deleteNodes(selectedIds)}
            className="px-3 py-1.5 bg-red-100 text-red-500 text-xs rounded-lg hover:bg-red-200 shadow-sm"
          >
            削除{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
          </button>
        </div>
      )}

      {/* Properties panel */}
      {selectedId && showPanel && (
        <NodePropertiesPanel
          node={nodes.find(n => n.id === selectedId)!}
          onUpdate={updated => updateNodes(nodes.map(n => n.id === selectedId ? updated : n))}
          onClose={() => setShowPanel(false)}
        />
      )}

      {/* Shortcut hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-sm px-4 py-2 flex items-center gap-4 text-xs text-gray-400 border border-gray-100">
        <span>Tab: 子ノード</span>
        <span>Enter: 兄弟ノード</span>
        <span>F2 / Space: 編集</span>
        <span>Delete: 削除</span>
        <span>Shift+クリック: 複数選択</span>
      </div>
    </div>
  );
}
