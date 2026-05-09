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
  const fillOp = 1;
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
    case "text":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" stroke={isSelected ? "#6366f1" : "transparent"} strokeWidth={1.5} strokeDasharray={isSelected ? "4 2" : undefined} />;
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [notePopup, setNotePopup] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [insertMenu, setInsertMenu] = useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const [insertImageMode, setInsertImageMode] = useState(false);
  const [insertImageUrl, setInsertImageUrl] = useState("");
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

  // Compute toolbar position from selected node (canvas-relative coordinates)
  useEffect(() => {
    const svg = svgRef.current;
    const node = selectedId ? nodes.find(n => n.id === selectedId) : undefined;
    if (svg && node) {
      const r = svg.getBoundingClientRect();
      setToolbarPos({
        x: r.width / 2 + pan.x + node.x * zoom,
        y: r.height / 2 + pan.y + node.y * zoom - (nodeHeight(node) / 2) * zoom,
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

  const getVisibleNodes = useCallback((nodeList: MindMapNode[]) => nodeList, []);

  const addChild = useCallback((parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    const siblings = nodes.filter(n => n.parentId === parentId);
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`, text: "新しいノード",
      x: parent.x + 240,
      y: parent.y + siblings.length * 64 - Math.max(0, siblings.length - 1) * 32,
      parentId,
      color: parent.color,
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

  const addFloatingNode = useCallback((cx: number, cy: number) => {
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`, text: "新しいノード",
      x: cx, y: cy, parentId: null, color: "#6366f1",
    };
    updateNodes([...nodes, newNode]);
    setSelectedIds(new Set([newNode.id]));
    setInsertMenu(null);
    setTimeout(() => { setEditingId(newNode.id); setEditText(newNode.text); }, 50);
  }, [nodes, updateNodes]);

  const addFloatingImageNode = useCallback((cx: number, cy: number, url: string) => {
    if (!url.trim()) return;
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`, text: "",
      x: cx, y: cy, parentId: null, color: "#64748b", imageUrl: url.trim(),
    };
    updateNodes([...nodes, newNode]);
    setSelectedIds(new Set([newNode.id]));
    setInsertMenu(null);
    setInsertImageMode(false);
    setInsertImageUrl("");
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
      else if (e.key === "Escape") { setSelectedIds(new Set()); setInsertMenu(null); setInsertImageMode(false); setNotePopup(null); }
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
    setInsertMenu(null);
    setNotePopup(null);
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
    setNotePopup(null);
    if (insertMenu) { setInsertMenu(null); setInsertImageMode(false); return; }
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

  const onMouseUp = (e: React.MouseEvent) => {
    if (dragging) {
      onNodesChange(nodes);
    } else if (!readOnly && panStart) {
      const dx = Math.abs(e.clientX - panStart.mx);
      const dy = Math.abs(e.clientY - panStart.my);
      if (dx < 5 && dy < 5) {
        const svg = svgRef.current;
        if (svg) {
          const r = svg.getBoundingClientRect();
          const cv = toCanvas(e.clientX, e.clientY);
          setInsertMenu({ sx: e.clientX - r.left, sy: e.clientY - r.top, cx: cv.x, cy: cv.y });
        }
      }
    }
    setDragging(null);
    setPanStart(null);
  };

  const onMouseLeave = () => {
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
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
        onContextMenu={e => e.preventDefault()}
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
            const label = node.text.length > 16 ? node.text.slice(0, 16) + "…" : node.text;

            return (
              <g key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={e => onNodeMouseDown(e, node.id)}
                onMouseEnter={() => { if (!readOnly) setHoveredId(node.id); }}
                onMouseLeave={() => setHoveredId(null)}
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
                    fill={node.shape === "text" ? (node.textColor ?? node.color) : (node.textColor ?? "white")} fontSize={node.fontSize ?? 13}
                    fontWeight={node.fontBold ? "bold" : "500"}
                    fontStyle={node.fontItalic ? "italic" : "normal"}
                    style={{ pointerEvents: "none" }}
                  >{label}</text>
                )}
                {node.note && (
                  <g
                    onClick={e => {
                      e.stopPropagation();
                      const svg = svgRef.current;
                      if (!svg) return;
                      const r = svg.getBoundingClientRect();
                      setNotePopup({ nodeId: node.id, x: e.clientX - r.left, y: e.clientY - r.top });
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ cursor: "pointer" }}
                  >
                    <rect x={w / 2 - 30} y={-h / 2 - 4} width={30} height={16} rx={8} fill="rgba(30,41,59,0.72)" />
                    <text x={w / 2 - 15} y={-h / 2 + 4} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="white" style={{ pointerEvents: "none" }}>💬 1</text>
                  </g>
                )}
                {node.url && <circle cx={w / 2 - (node.note ? 16 : 6)} cy={-h / 2 + 6} r={4} fill="#60a5fa" style={{ pointerEvents: "none" }} />}
                {node.imageUrl && (
                  <image href={node.imageUrl} x={-w / 2} y={h / 2 + 4} width={w} height={40} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
                )}
                {!readOnly && hoveredId === node.id && (
                  <>
                    <g
                      transform={`translate(${w / 2 + 14}, 0)`}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); addChild(node.id); }}
                      style={{ cursor: "pointer" }}
                    >
                      <circle r={10} fill="#6366f1" />
                      <text textAnchor="middle" dominantBaseline="middle" fontSize={16} fill="white" fontWeight="bold" style={{ pointerEvents: "none" }}>+</text>
                    </g>
                    {node.parentId && (
                      <g
                        transform={`translate(0, ${h / 2 + 16})`}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); addSibling(node.id); }}
                        style={{ cursor: "pointer" }}
                      >
                        <circle r={10} fill="#6366f1" />
                        <text textAnchor="middle" dominantBaseline="middle" fontSize={16} fill="white" fontWeight="bold" style={{ pointerEvents: "none" }}>+</text>
                      </g>
                    )}
                  </>
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
            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitEdit(); }
            if (e.key === "Escape") { e.stopPropagation(); setEditingId(null); }
            if (e.key === "Tab") { e.preventDefault(); e.stopPropagation(); commitEdit(); setTimeout(() => addChild(editingId!), 30); }
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

      {notePopup && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-4 w-64"
          style={{ left: notePopup.x + 10, top: notePopup.y + 10 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">💬 メモ</span>
            <button onClick={() => setNotePopup(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {nodes.find(n => n.id === notePopup.nodeId)?.note}
          </p>
        </div>
      )}

      {!readOnly && insertMenu && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 flex flex-col gap-0.5 min-w-[130px]"
          style={{ left: insertMenu.sx, top: insertMenu.sy }}
          onMouseDown={e => e.stopPropagation()}
        >
          {!insertImageMode ? (
            <>
              <button
                onClick={() => addFloatingNode(insertMenu.cx, insertMenu.cy)}
                className="px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg"
              >＋ ノード</button>
              <button
                onClick={() => setInsertImageMode(true)}
                className="px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg"
              >🖼️ 画像</button>
            </>
          ) : (
            <div className="flex flex-col gap-2 p-1">
              <p className="text-xs text-gray-400">画像URL</p>
              <input
                autoFocus
                type="url"
                value={insertImageUrl}
                onChange={e => setInsertImageUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.stopPropagation(); addFloatingImageNode(insertMenu.cx, insertMenu.cy, insertImageUrl); }
                  if (e.key === "Escape") { e.stopPropagation(); setInsertMenu(null); setInsertImageMode(false); }
                }}
                placeholder="https://..."
                className="text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400 w-44"
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
