"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MindMapNode } from "@/types";
import NodeToolbar from "./NodeToolbar";

interface Props {
  initialNodes: MindMapNode[];
  onNodesChange: (nodes: MindMapNode[]) => void;
  readOnly?: boolean;
  exportRef?: React.MutableRefObject<{ exportSVG: () => void; exportPNG: () => void } | null>;
}

const NODE_H = 34;
const NODE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

function nodeWidth(node: MindMapNode): number {
  const base = Math.max(80, Math.min(220, node.text.length * 8.5 + 48));
  if (node.shape === "circle") return NODE_H * 2 + 8;
  if (node.shape === "diamond") return base + 24;
  return base;
}

function nodeHeight(node: MindMapNode): number {
  if (node.shape === "circle") return NODE_H * 2 + 8;
  if (node.shape === "diamond") return NODE_H + 16;
  return NODE_H;
}

function NodeShape({ node, w, h, isSelected }: { node: MindMapNode; w: number; h: number; isSelected: boolean }) {
  const fill = node.color;
  const fillOp = isSelected ? 1 : 0.88;
  const stroke = isSelected ? "#1e293b" : "transparent";
  const sw = 2.5;
  switch (node.shape ?? "pill") {
    case "rect":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeWidth={sw} />;
    case "circle": {
      const r = Math.max(w, h) / 2;
      return <circle r={r} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeWidth={sw} />;
    }
    case "diamond": {
      return <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeWidth={sw} />;
    }
    default:
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeWidth={sw} />;
  }
}

function buildExportSVG(nodes: MindMapNode[]): string {
  const pad = 60;
  const xs = nodes.map(n => [n.x - nodeWidth(n) / 2, n.x + nodeWidth(n) / 2]).flat();
  const ys = nodes.map(n => [n.y - nodeHeight(n) / 2, n.y + nodeHeight(n) / 2]).flat();
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const W = Math.max(...xs) + pad - minX, H = Math.max(...ys) + pad - minY;
  const vids = new Set(nodes.map(n => n.id));

  const edges = nodes.filter(n => n.parentId && vids.has(n.parentId)).map(n => {
    const p = nodes.find(x => x.id === n.parentId)!;
    const x1 = p.x + nodeWidth(p) / 2, y1 = p.y, x2 = n.x - nodeWidth(n) / 2, y2 = n.y;
    const cx = (x1 + x2) / 2;
    return `<path d="M ${x1},${y1} C ${cx},${y1} ${cx},${y2} ${x2},${y2}" fill="none" stroke="${n.color}" stroke-width="2" stroke-opacity="0.45"/>`;
  }).join("\n");

  const nodeEls = nodes.map(node => {
    const w = nodeWidth(node), h = nodeHeight(node);
    const label = node.text.length > 16 ? node.text.slice(0, 16) + "…" : node.text;
    const fs = node.fontSize ?? 13, fw = node.fontBold ? "bold" : "500", tc = node.textColor ?? "white";
    const iconEl = node.icon ? `<text x="${node.x - w / 2 + 16}" y="${node.y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="14">${node.icon}</text>` : "";
    const tx = node.icon ? node.x + 8 : node.x;
    let shapeEl = "";
    switch (node.shape ?? "pill") {
      case "rect": shapeEl = `<rect x="${node.x - w / 2}" y="${node.y - h / 2}" width="${w}" height="${h}" rx="4" fill="${node.color}" fill-opacity="0.9"/>`; break;
      case "circle": { const r = Math.max(w, h) / 2; shapeEl = `<circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${node.color}" fill-opacity="0.9"/>`; break; }
      case "diamond": shapeEl = `<polygon points="${node.x},${node.y - h / 2} ${node.x + w / 2},${node.y} ${node.x},${node.y + h / 2} ${node.x - w / 2},${node.y}" fill="${node.color}" fill-opacity="0.9"/>`; break;
      default: shapeEl = `<rect x="${node.x - w / 2}" y="${node.y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${node.color}" fill-opacity="0.9"/>`;
    }
    return `${shapeEl}\n${iconEl}\n<text x="${tx}" y="${node.y}" text-anchor="middle" dominant-baseline="middle" fill="${tc}" font-size="${fs}" font-weight="${fw}" font-family="sans-serif">${label}</text>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}">\n<rect x="${minX}" y="${minY}" width="${W}" height="${H}" fill="#f9fafb"/>\n${edges}\n${nodeEls}\n</svg>`;
}

export default function MindMapCanvas({ initialNodes, onNodesChange, readOnly = false, exportRef }: Props) {
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ mx: number; my: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 });
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [editorStyle, setEditorStyle] = useState<{ left: number; top: number; width: number; height: number; fontSize: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNodes(initialNodes); }, [initialNodes]);

  // Track SVG size
  useEffect(() => {
    if (!svgRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: width, h: height });
    });
    obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, []);

  // Compute toolbar position from selected node
  useEffect(() => {
    const svg = svgRef.current;
    const node = selectedId ? nodes.find(n => n.id === selectedId) : undefined;
    if (svg && node) {
      const r = svg.getBoundingClientRect();
      setToolbarPos({
        x: r.left + r.width / 2 + pan.x + node.x * zoom,
        y: r.top + r.height / 2 + pan.y + node.y * zoom - (nodeHeight(node) / 2) * zoom,
      });
    } else {
      setToolbarPos(null);
    }
  }, [selectedId, nodes, pan, zoom]);

  // Compute inline editor position
  useEffect(() => {
    const svg = svgRef.current;
    const node = editingId ? nodes.find(n => n.id === editingId) : undefined;
    if (svg && node) {
      const r = svg.getBoundingClientRect();
      const sx = r.width / 2 + pan.x + node.x * zoom;
      const sy = r.height / 2 + pan.y + node.y * zoom;
      const w = nodeWidth(node) * zoom;
      const h = NODE_H * zoom;
      setEditorStyle({ left: sx - w / 2, top: sy - h / 2, width: w, height: h, fontSize: (node.fontSize ?? 13) * zoom });
    } else {
      setEditorStyle(null);
    }
  }, [editingId, nodes, pan, zoom]);

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
      id: `node-${Date.now()}`, text: "新しいノード",
      x: parent.x + 240,
      y: parent.y + siblings.length * 64 - Math.max(0, siblings.length - 1) * 32,
      parentId,
      color: parent.id === "root" ? NODE_COLORS[siblings.length % NODE_COLORS.length] : parent.color,
    };
    updateNodes([...nodes.map(n => n.id === parentId ? { ...n, collapsed: false } : n), newNode]);
    setSelectedIds(new Set([newNode.id]));
    setTimeout(() => { setEditingId(newNode.id); setEditText(newNode.text); }, 50);
  }, [nodes, updateNodes]);

  const addSibling = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.parentId) { addChild(nodeId); return; }
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`, text: "新しいノード",
      x: node.x, y: node.y + 64,
      parentId: node.parentId, color: node.color,
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
  }, [nodes, updateNodes]);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    updateNodes(nodes.map(n => n.id === editingId ? { ...n, text: editText.trim() || n.text } : n));
    setEditingId(null);
  }, [editingId, editText, nodes, updateNodes]);

  const toggleCollapse = useCallback((nodeId: string) => {
    updateNodes(nodes.map(n => n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n));
  }, [nodes, updateNodes]);

  const exportSVG = useCallback(() => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buildExportSVG(nodes)], { type: "image/svg+xml" }));
    a.download = "mindmap.svg"; a.click();
  }, [nodes]);

  const exportPNG = useCallback(() => {
    const s = buildExportSVG(nodes);
    const pad = 60;
    const xs = nodes.map(n => [n.x - nodeWidth(n) / 2, n.x + nodeWidth(n) / 2]).flat();
    const ys = nodes.map(n => [n.y - nodeHeight(n) / 2, n.y + nodeHeight(n) / 2]).flat();
    const W = (Math.max(...xs) - Math.min(...xs) + pad * 2) * 2;
    const H = (Math.max(...ys) - Math.min(...ys) + pad * 2) * 2;
    const url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#f9fafb"; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png"); a.download = "mindmap.png"; a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [nodes]);

  useEffect(() => {
    if (exportRef) exportRef.current = { exportSVG, exportPNG };
  }, [exportRef, exportSVG, exportPNG]);

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (editingId) { if (e.key === "Escape") setEditingId(null); return; }
      if (selectedIds.size === 0) return;
      const id = [...selectedIds][0];
      if (e.key === "Tab") { e.preventDefault(); addChild(id); }
      else if (e.key === "Enter") { e.preventDefault(); addSibling(id); }
      else if (e.key === "F2" || e.key === " ") {
        e.preventDefault();
        const n = nodes.find(n => n.id === id);
        if (n) { setEditingId(id); setEditText(n.text); }
      } else if (e.key === "Delete") { deleteNodes(selectedIds); }
      else if (e.key === "Escape") { setSelectedIds(new Set()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, editingId, addChild, addSibling, deleteNodes, nodes, readOnly]);

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
    if (readOnly) return;
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedIds(prev => {
        const s = new Set(prev);
        if (s.has(nodeId)) { s.delete(nodeId); } else { s.add(nodeId); }
        return s;
      });
      return;
    }
    if (!selectedIds.has(nodeId)) setSelectedIds(new Set([nodeId]));
    const node = nodes.find(n => n.id === nodeId)!;
    const p = toCanvas(e.clientX, e.clientY);
    setDragging({ id: nodeId, ox: p.x - node.x, oy: p.y - node.y });
  };

  const onBgMouseDown = (e: React.MouseEvent) => {
    if (editingId) commitEdit();
    if (!readOnly) setSelectedIds(new Set());
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
        <rect width="100%" height="100%" fill="transparent" onMouseDown={onBgMouseDown} />
        <g transform={`translate(${svgSize.w / 2 + pan.x},${svgSize.h / 2 + pan.y}) scale(${zoom})`}>
          {visible.filter(n => n.parentId && visibleIds.has(n.parentId)).map(n => {
            const p = nodes.find(x => x.id === n.parentId)!;
            return (
              <path key={`e-${n.id}`}
                d={edgePath(p.x + nodeWidth(p) / 2, p.y, n.x - nodeWidth(n) / 2, n.y)}
                fill="none" stroke={n.color} strokeWidth={2} strokeOpacity={0.45}
              />
            );
          })}

          {visible.map(node => {
            const w = nodeWidth(node), h = nodeHeight(node);
            const isSelected = selectedIds.has(node.id);
            const hasChildren = nodes.some(n => n.parentId === node.id);
            const label = node.text.length > 16 ? node.text.slice(0, 16) + "…" : node.text;

            return (
              <g key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={e => onNodeMouseDown(e, node.id)}
                onDoubleClick={e => {
                  if (readOnly) return;
                  e.stopPropagation();
                  setSelectedIds(new Set([node.id]));
                  setEditingId(node.id);
                  setEditText(node.text);
                }}
                style={{ cursor: readOnly ? "default" : "pointer" }}
              >
                <NodeShape node={node} w={w} h={h} isSelected={isSelected} />
                {node.icon && (
                  <text x={-w / 2 + 16} textAnchor="middle" dominantBaseline="middle" fontSize={14} style={{ pointerEvents: "none" }}>{node.icon}</text>
                )}
                {editingId !== node.id && (
                  <text
                    x={node.icon ? 8 : 0} textAnchor="middle" dominantBaseline="middle"
                    fill={node.textColor ?? "white"} fontSize={node.fontSize ?? 13}
                    fontWeight={node.fontBold ? "bold" : "500"}
                    fontStyle={node.fontItalic ? "italic" : "normal"}
                    style={{ pointerEvents: "none" }}
                  >{label}</text>
                )}
                {node.note && <circle cx={w / 2 - 6} cy={-h / 2 + 6} r={4} fill="#fbbf24" style={{ pointerEvents: "none" }} />}
                {node.url && <circle cx={w / 2 - (node.note ? 16 : 6)} cy={-h / 2 + 6} r={4} fill="#60a5fa" style={{ pointerEvents: "none" }} />}
                {node.imageUrl && (
                  <image href={node.imageUrl} x={-w / 2} y={h / 2 + 4} width={w} height={40} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
                )}
                {!readOnly && hasChildren && (
                  <g transform={`translate(${w / 2 + 12}, 0)`} onClick={e => { e.stopPropagation(); toggleCollapse(node.id); }} style={{ cursor: "pointer" }}>
                    <circle r={9} fill="white" stroke={node.color} strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={node.color} fontWeight="bold" style={{ pointerEvents: "none" }}>
                      {node.collapsed ? `+${nodes.filter(n => n.parentId === node.id).length}` : "−"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {!readOnly && editingId && editorStyle && (
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
          style={{ position: "absolute", ...editorStyle }}
          className="text-center font-medium text-white bg-transparent border-none outline-none px-2"
        />
      )}

      {!readOnly && selectedId && toolbarPos && !editingId && (
        <NodeToolbar
          node={nodes.find(n => n.id === selectedId)!}
          screenX={toolbarPos.x}
          screenY={toolbarPos.y}
          onUpdate={updated => updateNodes(nodes.map(n => n.id === selectedId ? updated : n))}
        />
      )}

      {!readOnly && selectedIds.size > 0 && !editingId && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {selectedId && (
            <button onClick={() => addChild(selectedId)} className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 shadow-sm">＋ 子 (Tab)</button>
          )}
          {selectedId && (
            <button onClick={() => addSibling(selectedId)} className="px-3 py-1.5 bg-indigo-100 text-indigo-600 text-xs rounded-lg hover:bg-indigo-200 shadow-sm">＋ 兄弟 (Enter)</button>
          )}
          <button onClick={() => deleteNodes(selectedIds)} className="px-3 py-1.5 bg-red-100 text-red-500 text-xs rounded-lg hover:bg-red-200 shadow-sm">
            削除{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
          </button>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-sm px-4 py-2 flex items-center gap-4 text-xs text-gray-400 border border-gray-100">
        {readOnly
          ? <span>スクロール: ズーム　ドラッグ: 移動</span>
          : <><span>Tab: 子</span><span>Enter: 兄弟</span><span>F2: 編集</span><span>Delete: 削除</span><span>Shift+クリック: 複数選択</span></>
        }
      </div>
    </div>
  );
}
