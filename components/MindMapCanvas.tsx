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
const LINE_H = 20;
const TEXT_PAD = 16;

// 改修② コンテキストメニュー用定数
const CTX_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f97316","#f59e0b","#10b981","#14b8a6",
  "#3b82f6","#06b6d4","#64748b","#1e293b",
];
const CTX_TEXT_COLORS = ["#ffffff","#1e293b","#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"];
const CTX_SHAPES = [
  { id: "pill", l: "⬭" }, { id: "rect", l: "▭" }, { id: "circle", l: "⊙" },
  { id: "diamond", l: "◇" }, { id: "text", l: "T" },
] as const;
const CTX_SIZES = [11, 13, 15, 17] as const;

function nodeWidth(node: MindMapNode): number {
  if (node.imageWidth) return node.imageWidth;
  const maxLineLen = Math.max(...node.text.split("\n").map(l => l.length), 1);
  const base = Math.max(80, Math.min(220, maxLineLen * 8.5 + 48));
  if (node.shape === "circle") return NODE_H * 2 + 8;
  if (node.shape === "diamond") return base + 24;
  return base;
}

function nodeHeight(node: MindMapNode): number {
  if (node.imageHeight) return node.imageHeight;
  if (node.shape === "circle") return NODE_H * 2 + 8;
  if (node.shape === "diamond") return NODE_H + 16;
  const lines = node.text.split("\n").length;
  return Math.max(NODE_H, lines * LINE_H + TEXT_PAD);
}

/** ④ 親子の相対位置から接続点と方向を計算 */
function calcEdgePoints(parent: MindMapNode, child: MindMapNode) {
  const pw = nodeWidth(parent), ph = nodeHeight(parent);
  const cw = nodeWidth(child), ch = nodeHeight(child);
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x1: parent.x + pw / 2, y1: parent.y,  x2: child.x - cw / 2, y2: child.y,  v: false }
      : { x1: parent.x - pw / 2, y1: parent.y,  x2: child.x + cw / 2, y2: child.y,  v: false };
  } else {
    return dy >= 0
      ? { x1: parent.x, y1: parent.y + ph / 2, x2: child.x, y2: child.y - ch / 2, v: true }
      : { x1: parent.x, y1: parent.y - ph / 2, x2: child.x, y2: child.y + ch / 2, v: true };
  }
}

function makeEdgePath(x1: number, y1: number, x2: number, y2: number, v: boolean): string {
  if (v) {
    const cy = (y1 + y2) / 2;
    return `M ${x1},${y1} C ${x1},${cy} ${x2},${cy} ${x2},${y2}`;
  }
  const cx = (x1 + x2) / 2;
  return `M ${x1},${y1} C ${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

function NodeShape({ node, w, h, isSelected }: { node: MindMapNode; w: number; h: number; isSelected: boolean }) {
  const fill = node.color;
  const stroke = isSelected ? "#1e293b" : "transparent";
  const sw = 2.5;
  switch (node.shape ?? "pill") {
    case "rect":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case "circle": {
      const r = Math.max(w, h) / 2;
      return <circle r={r} fill={fill} stroke={stroke} strokeWidth={sw} />;
    }
    case "diamond":
      return <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case "text":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" stroke={isSelected ? "#6366f1" : "transparent"} strokeWidth={1.5} strokeDasharray={isSelected ? "4 2" : undefined} />;
    default:
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
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
    const { x1, y1, x2, y2, v } = calcEdgePoints(p, n);
    return `<path d="${makeEdgePath(x1, y1, x2, y2, v)}" fill="none" stroke="${n.color}" stroke-width="2" stroke-opacity="0.45"/>`;
  }).join("\n");

  const nodeEls = nodes.map(node => {
    const w = nodeWidth(node), h = nodeHeight(node);
    const fs = node.fontSize ?? 13, fw = node.fontBold ? "bold" : "500", tc = node.textColor ?? "white";
    const iconEl = node.icon ? `<text x="${node.x - w / 2 + 16}" y="${node.y}" text-anchor="middle" dominant-baseline="middle" font-size="14">${node.icon}</text>` : "";
    const tx = node.icon ? node.x + 8 : node.x;
    let shapeEl = "";
    switch (node.shape ?? "pill") {
      case "rect": shapeEl = `<rect x="${node.x - w / 2}" y="${node.y - h / 2}" width="${w}" height="${h}" rx="4" fill="${node.color}"/>`; break;
      case "circle": { const r = Math.max(w, h) / 2; shapeEl = `<circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${node.color}"/>`; break; }
      case "diamond": shapeEl = `<polygon points="${node.x},${node.y - h / 2} ${node.x + w / 2},${node.y} ${node.x},${node.y + h / 2} ${node.x - w / 2},${node.y}" fill="${node.color}"/>`; break;
      default: shapeEl = `<rect x="${node.x - w / 2}" y="${node.y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${node.color}"/>`;
    }
    const textLines = node.text.split("\n");
    const startY = node.y - (textLines.length - 1) * LINE_H / 2;
    const tspans = textLines.map((line, i) => {
      const display = line.length > 20 ? line.slice(0, 20) + "…" : line;
      return `<tspan x="${tx}" y="${startY + i * LINE_H}" dominant-baseline="middle">${display}</tspan>`;
    }).join("");
    return `${shapeEl}\n${iconEl}\n<text text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="${fw}" font-family="sans-serif">${tspans}</text>`;
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
  const [resizing, setResizing] = useState<{
    id: string; corner: "se" | "sw" | "ne" | "nw";
    startCx: number; startCy: number;
    startW: number; startH: number; startNx: number; startNy: number;
  } | null>(null);
  const [editorStyle, setEditorStyle] = useState<{ left: number; top: number; width: number; height: number; fontSize: number } | null>(null);
  const [nodeCtxMenu, setNodeCtxMenu] = useState<{ nodeId: string; sx: number; sy: number } | null>(null);
  // 相談: ラバーバンド（範囲選択）
  const [rubberBand, setRubberBand] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

  // Refs for window-level handlers
  const nodesRef = useRef(nodes);
  const draggingRef = useRef(dragging);
  const resizingRef = useRef(resizing);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const onNodesChangeRef = useRef(onNodesChange);
  const editingIdRef = useRef(editingId);
  const rubberBandRef = useRef(rubberBand);
  nodesRef.current = nodes;
  draggingRef.current = dragging;
  resizingRef.current = resizing;
  panRef.current = pan;
  zoomRef.current = zoom;
  onNodesChangeRef.current = onNodesChange;
  editingIdRef.current = editingId;
  rubberBandRef.current = rubberBand;

  // Undo / Redo
  const undoStack = useRef<MindMapNode[][]>([]);
  const redoStack = useRef<MindMapNode[][]>([]);

  const pushUndo = useCallback(() => {
    undoStack.current.push([...nodesRef.current]);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNodes(initialNodes); }, [initialNodes]);

  useEffect(() => {
    if (!svgRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: width, h: height });
    });
    obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, []);

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

  useEffect(() => {
    const svg = svgRef.current;
    const node = editingId ? nodes.find(n => n.id === editingId) : undefined;
    if (svg && node) {
      const r = svg.getBoundingClientRect();
      const sx = r.width / 2 + pan.x + node.x * zoom;
      const sy = r.height / 2 + pan.y + node.y * zoom;
      const w = nodeWidth(node) * zoom;
      const lineCount = Math.max(1, editText.split("\n").length);
      const h = Math.max(NODE_H, lineCount * LINE_H + TEXT_PAD) * zoom;
      setEditorStyle({ left: sx - w / 2, top: sy - h / 2, width: w, height: h, fontSize: (node.fontSize ?? 13) * zoom });
    } else {
      setEditorStyle(null);
    }
  }, [editingId, nodes, pan, zoom, editText]);

  const updateNodes = useCallback((updated: MindMapNode[]) => {
    pushUndo();
    setNodes(updated);
    onNodesChange(updated);
  }, [onNodesChange, pushUndo]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push([...nodesRef.current]);
    setNodes(prev);
    onNodesChangeRef.current(prev);
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push([...nodesRef.current]);
    setNodes(next);
    onNodesChangeRef.current(next);
  }, []);

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

  const addFloatingTextNode = useCallback((cx: number, cy: number) => {
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`, text: "テキスト",
      x: cx, y: cy, parentId: null, color: "#374151",
      shape: "text",
    };
    updateNodes([...nodes, newNode]);
    setSelectedIds(new Set([newNode.id]));
    setInsertMenu(null);
    setTimeout(() => { setEditingId(newNode.id); setEditText(newNode.text); }, 50);
  }, [nodes, updateNodes]);

  const addFloatingImageNode = useCallback((cx: number, cy: number, dataUrl: string) => {
    if (!dataUrl.trim()) return;
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`, text: "",
      x: cx, y: cy, parentId: null, color: "#64748b",
      imageUrl: dataUrl.trim(), imageWidth: 200, imageHeight: 150,
    };
    updateNodes([...nodes, newNode]);
    setSelectedIds(new Set([newNode.id]));
    setInsertMenu(null);
    setInsertImageMode(false);
    setInsertImageUrl("");
  }, [nodes, updateNodes]);

  const alignSiblings = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const siblings = nodes.filter(n => n.parentId === node.parentId).sort((a, b) => a.y - b.y);
    if (siblings.length <= 1) return;
    const maxH = Math.max(...siblings.map(s => nodeHeight(s)));
    const spacing = maxH + 24;
    const avgX = siblings.reduce((s, n) => s + n.x, 0) / siblings.length;
    const avgY = siblings.reduce((s, n) => s + n.y, 0) / siblings.length;
    const startY = avgY - (siblings.length - 1) * spacing / 2;
    updateNodes(nodes.map(n => {
      const idx = siblings.findIndex(s => s.id === n.id);
      if (idx === -1) return n;
      return { ...n, x: avgX, y: startY + idx * spacing };
    }));
    setNodeCtxMenu(null);
  }, [nodes, updateNodes]);

  // ─── 範囲選択ノード整列 ───
  const applyAlignUpdate = useCallback((updater: (sel: MindMapNode[]) => MindMapNode[]) => {
    const sel = nodesRef.current.filter(n => selectedIds.has(n.id));
    if (sel.length < 2) return;
    pushUndo();
    const moved = updater(sel);
    const movedMap = new Map(moved.map(n => [n.id, n]));
    const updated = nodesRef.current.map(n => movedMap.get(n.id) ?? n);
    setNodes(updated);
    onNodesChangeRef.current(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, pushUndo]);

  const alignSelectedLeft   = useCallback(() => applyAlignUpdate(sel => {
    const edge = Math.min(...sel.map(n => n.x - nodeWidth(n) / 2));
    return sel.map(n => ({ ...n, x: edge + nodeWidth(n) / 2 }));
  }), [applyAlignUpdate]);

  const alignSelectedCenterH = useCallback(() => applyAlignUpdate(sel => {
    const cx = sel.reduce((s, n) => s + n.x, 0) / sel.length;
    return sel.map(n => ({ ...n, x: cx }));
  }), [applyAlignUpdate]);

  const alignSelectedRight  = useCallback(() => applyAlignUpdate(sel => {
    const edge = Math.max(...sel.map(n => n.x + nodeWidth(n) / 2));
    return sel.map(n => ({ ...n, x: edge - nodeWidth(n) / 2 }));
  }), [applyAlignUpdate]);

  const alignSelectedTop    = useCallback(() => applyAlignUpdate(sel => {
    const edge = Math.min(...sel.map(n => n.y - nodeHeight(n) / 2));
    return sel.map(n => ({ ...n, y: edge + nodeHeight(n) / 2 }));
  }), [applyAlignUpdate]);

  const alignSelectedCenterV = useCallback(() => applyAlignUpdate(sel => {
    const cy = sel.reduce((s, n) => s + n.y, 0) / sel.length;
    return sel.map(n => ({ ...n, y: cy }));
  }), [applyAlignUpdate]);

  const alignSelectedBottom = useCallback(() => applyAlignUpdate(sel => {
    const edge = Math.max(...sel.map(n => n.y + nodeHeight(n) / 2));
    return sel.map(n => ({ ...n, y: edge - nodeHeight(n) / 2 }));
  }), [applyAlignUpdate]);

  const distributeSelectedH = useCallback(() => applyAlignUpdate(sel => {
    if (sel.length < 3) return sel;
    const sorted = [...sel].sort((a, b) => a.x - b.x);
    const step = (sorted[sorted.length - 1].x - sorted[0].x) / (sorted.length - 1);
    return sorted.map((n, i) => ({ ...n, x: sorted[0].x + i * step }));
  }), [applyAlignUpdate]);

  const distributeSelectedV = useCallback(() => applyAlignUpdate(sel => {
    if (sel.length < 3) return sel;
    const sorted = [...sel].sort((a, b) => a.y - b.y);
    const step = (sorted[sorted.length - 1].y - sorted[0].y) / (sorted.length - 1);
    return sorted.map((n, i) => ({ ...n, y: sorted[0].y + i * step }));
  }), [applyAlignUpdate]);

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
      if (e.ctrlKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
      if (editingIdRef.current) { if (e.key === "Escape") setEditingId(null); return; }
      if (selectedIds.size === 0) return;
      const id = [...selectedIds][0];
      if (e.key === "Tab") { e.preventDefault(); addChild(id); }
      else if (e.key === "Enter") { e.preventDefault(); addSibling(id); }
      else if (e.key === "F2" || e.key === " ") {
        e.preventDefault();
        const n = nodes.find(n => n.id === id);
        if (n) { setEditingId(id); setEditText(n.text); }
      } else if (e.key === "Delete") { deleteNodes(selectedIds); }
      else if (e.key === "Escape") {
        setSelectedIds(new Set()); setInsertMenu(null); setInsertImageMode(false);
        setNotePopup(null); setNodeCtxMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, addChild, addSibling, deleteNodes, nodes, readOnly, undo, redo]);

  useEffect(() => {
    if (editingId && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editingId]);

  // クリップボードから画像ペースト
  useEffect(() => {
    if (readOnly) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgItem = items.find(it => it.type.startsWith("image/"));
      if (!imgItem) return;
      const file = imgItem.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const p = panRef.current, z = zoomRef.current;
        const cx = -p.x / z + (Math.random() - 0.5) * 80;
        const cy = -p.y / z + (Math.random() - 0.5) * 80;
        const newNode: MindMapNode = {
          id: `node-${Date.now()}`, text: "",
          x: cx, y: cy, parentId: null, color: "#64748b",
          imageUrl: dataUrl, imageWidth: 200, imageHeight: 150,
        };
        setNodes(prev => { const updated = [...prev, newNode]; onNodesChangeRef.current(updated); return updated; });
        setSelectedIds(new Set([newNode.id]));
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [readOnly]);

  // Window-level drag/resize/rubberband
  useEffect(() => {
    const getCanvasPos = (cx: number, cy: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      const p = panRef.current, z = zoomRef.current;
      return { x: (cx - r.left - p.x - r.width / 2) / z, y: (cy - r.top - p.y - r.height / 2) / z };
    };
    const onMove = (e: MouseEvent) => {
      // ラバーバンド更新
      if (rubberBandRef.current) {
        const cp = getCanvasPos(e.clientX, e.clientY);
        setRubberBand(prev => prev ? { ...prev, ex: cp.x, ey: cp.y } : null);
        return;
      }
      const drag = draggingRef.current;
      if (drag) {
        const p = getCanvasPos(e.clientX, e.clientY);
        setNodes(prev => prev.map(n => n.id === drag.id ? { ...n, x: p.x - drag.ox, y: p.y - drag.oy } : n));
        return;
      }
      const res = resizingRef.current;
      if (res) {
        const cp = getCanvasPos(e.clientX, e.clientY);
        const dx = cp.x - res.startCx, dy = cp.y - res.startCy;
        const minW = 60, minH = 40;
        let newW: number, newH: number, newX: number, newY: number;
        switch (res.corner) {
          case "se": newW = Math.max(minW, res.startW + dx); newH = Math.max(minH, res.startH + dy);
            newX = (res.startNx - res.startW / 2) + newW / 2; newY = (res.startNy - res.startH / 2) + newH / 2; break;
          case "sw": newW = Math.max(minW, res.startW - dx); newH = Math.max(minH, res.startH + dy);
            newX = (res.startNx + res.startW / 2) - newW / 2; newY = (res.startNy - res.startH / 2) + newH / 2; break;
          case "ne": newW = Math.max(minW, res.startW + dx); newH = Math.max(minH, res.startH - dy);
            newX = (res.startNx - res.startW / 2) + newW / 2; newY = (res.startNy + res.startH / 2) - newH / 2; break;
          default: newW = Math.max(minW, res.startW - dx); newH = Math.max(minH, res.startH - dy);
            newX = (res.startNx + res.startW / 2) - newW / 2; newY = (res.startNy + res.startH / 2) - newH / 2;
        }
        setNodes(prev => prev.map(n => n.id === res.id
          ? { ...n, imageWidth: newW, imageHeight: newH, x: newX, y: newY } : n));
      }
    };
    const onUp = (e: MouseEvent) => {
      // ラバーバンド確定 → 範囲内ノードを選択
      if (rubberBandRef.current) {
        const rb = rubberBandRef.current;
        const x1 = Math.min(rb.sx, rb.ex), x2 = Math.max(rb.sx, rb.ex);
        const y1 = Math.min(rb.sy, rb.ey), y2 = Math.max(rb.sy, rb.ey);
        if (x2 - x1 > 4 || y2 - y1 > 4) { // 微小ドラッグは無視
          const selected = nodesRef.current
            .filter(n => {
              const nw = nodeWidth(n), nh = nodeHeight(n);
              return n.x + nw / 2 >= x1 && n.x - nw / 2 <= x2 && n.y + nh / 2 >= y1 && n.y - nh / 2 <= y2;
            })
            .map(n => n.id);
          setSelectedIds(new Set(selected));
        }
        setRubberBand(null);
        return;
      }
      if (draggingRef.current || resizingRef.current) {
        onNodesChangeRef.current(nodesRef.current);
        setDragging(null);
        setResizing(null);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setNodeCtxMenu(null);
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
    pushUndo();
    setDragging({ id: nodeId, ox: p.x - node.x, oy: p.y - node.y });
  };

  const onBgMouseDown = (e: React.MouseEvent) => {
    setNotePopup(null);
    setNodeCtxMenu(null);
    if (insertMenu) { setInsertMenu(null); setInsertImageMode(false); return; }
    if (editingId) commitEdit();

    // 相談: Shift+ドラッグ → ラバーバンド範囲選択
    if (e.shiftKey && !readOnly) {
      const cv = toCanvas(e.clientX, e.clientY);
      setRubberBand({ sx: cv.x, sy: cv.y, ex: cv.x, ey: cv.y });
      return;
    }

    if (!readOnly) setSelectedIds(new Set());
    setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
  };

  const onBgContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const cv = toCanvas(e.clientX, e.clientY);
    setInsertMenu({ sx: e.clientX - r.left, sy: e.clientY - r.top, cx: cv.x, cy: cv.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (panStart) setPan({ x: panStart.px + e.clientX - panStart.mx, y: panStart.py + e.clientY - panStart.my });
  };

  const onMouseUp = () => { if (panStart) setPanStart(null); };
  const onMouseLeave = () => { setPanStart(null); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.2, z - e.deltaY * 0.001)));
  };

  const visible = getVisibleNodes(nodes);
  const visibleIds = new Set(visible.map(n => n.id));

  const editingNode = editingId ? nodes.find(n => n.id === editingId) : null;
  const editorTextColor = editingNode?.shape === "text"
    ? (editingNode.textColor ?? editingNode.color)
    : (editingNode?.textColor ?? "white");

  // 改修② コンテキストメニュー用: 対象ノードと一括適用ヘルパー
  const ctxNode = nodeCtxMenu ? nodes.find(n => n.id === nodeCtxMenu.nodeId) : null;
  const isBatch = selectedIds.size > 1 && ctxNode !== null && selectedIds.has(ctxNode?.id ?? "");
  const applyFormat = useCallback((updates: Partial<MindMapNode>) => {
    if (!nodeCtxMenu) return;
    if (isBatch) {
      setNodes(prev => {
        const updated = prev.map(n => selectedIds.has(n.id) ? { ...n, ...updates } : n);
        onNodesChangeRef.current(updated);
        return updated;
      });
      undoStack.current.push([...nodesRef.current]);
    } else {
      setNodes(prev => {
        const updated = prev.map(n => n.id === nodeCtxMenu.nodeId ? { ...n, ...updates } : n);
        onNodesChangeRef.current(updated);
        return updated;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeCtxMenu, isBatch, selectedIds]);

  return (
    <div className="w-full h-full bg-gray-50 relative overflow-hidden select-none">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: rubberBand ? "crosshair" : panStart ? "grabbing" : "grab" }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
        onContextMenu={onBgContextMenu}
      >
        <rect width="100%" height="100%" fill="transparent" onMouseDown={onBgMouseDown} />
        <g transform={`translate(${svgSize.w / 2 + pan.x},${svgSize.h / 2 + pan.y}) scale(${zoom})`}>
          {visible.filter(n => n.parentId && visibleIds.has(n.parentId)).map(n => {
            const p = nodes.find(x => x.id === n.parentId)!;
            const { x1, y1, x2, y2, v } = calcEdgePoints(p, n);
            return (
              <path key={`e-${n.id}`}
                d={makeEdgePath(x1, y1, x2, y2, v)}
                fill="none" stroke={n.color} strokeWidth={2} strokeOpacity={0.45}
              />
            );
          })}

          {visible.map(node => {
            // 改修③: 編集中は editText でサイズ計算 → 改行と同時に図形が拡大
            const isEditing = editingId === node.id;
            const renderNode = isEditing ? { ...node, text: editText } : node;
            const w = nodeWidth(renderNode), h = nodeHeight(renderNode);
            const isSelected = selectedIds.has(node.id);
            const isImageNode = !!node.imageWidth;
            const textLines = node.text.split("\n");

            return (
              <g key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={e => onNodeMouseDown(e, node.id)}
                onMouseEnter={() => { if (!readOnly) setHoveredId(node.id); }}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={e => {
                  if (readOnly || isImageNode) return;
                  e.stopPropagation();
                  setSelectedIds(new Set([node.id]));
                  setEditingId(node.id);
                  setEditText(node.text);
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (readOnly) return;
                  const svg = svgRef.current;
                  if (!svg) return;
                  const r = svg.getBoundingClientRect();
                  if (!selectedIds.has(node.id)) setSelectedIds(new Set([node.id]));
                  setNodeCtxMenu({ nodeId: node.id, sx: e.clientX - r.left, sy: e.clientY - r.top });
                }}
                style={{ cursor: readOnly ? "default" : "pointer" }}
              >
                {isImageNode ? (
                  <>
                    <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" />
                    <image href={node.imageUrl} x={-w / 2} y={-h / 2} width={w} height={h} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
                    {isSelected && <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" rx={4} />}
                    {isSelected && (
                      [["se", w / 2, h / 2], ["sw", -w / 2, h / 2], ["ne", w / 2, -h / 2], ["nw", -w / 2, -h / 2]] as ["se" | "sw" | "ne" | "nw", number, number][]
                    ).map(([corner, hx, hy]) => (
                      <rect
                        key={corner}
                        x={hx - 5} y={hy - 5} width={10} height={10}
                        fill="white" stroke="#6366f1" strokeWidth={1.5} rx={2}
                        style={{ cursor: (corner === "se" || corner === "nw") ? "nwse-resize" : "nesw-resize" }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          pushUndo();
                          const cp = toCanvas(e.clientX, e.clientY);
                          setResizing({ id: node.id, corner, startCx: cp.x, startCy: cp.y, startW: w, startH: h, startNx: node.x, startNy: node.y });
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <NodeShape node={node} w={w} h={h} isSelected={isSelected} />
                    {node.icon && (
                      <text x={-w / 2 + 16} textAnchor="middle" dominantBaseline="middle" fontSize={14} style={{ pointerEvents: "none" }}>{node.icon}</text>
                    )}
                    {editingId !== node.id && (
                      <text
                        textAnchor="middle"
                        fill={node.shape === "text" ? (node.textColor ?? node.color) : (node.textColor ?? "white")}
                        fontSize={node.fontSize ?? 13}
                        fontWeight={node.fontBold ? "bold" : "500"}
                        fontStyle={node.fontItalic ? "italic" : "normal"}
                        style={{ pointerEvents: "none" }}
                      >
                        {textLines.map((line, i) => {
                          const startY = -(textLines.length - 1) * LINE_H / 2;
                          const display = line.length > 20 ? line.slice(0, 20) + "…" : line;
                          return (
                            <tspan key={i} x={node.icon ? 8 : 0} y={startY + i * LINE_H} dominantBaseline="middle">
                              {display}
                            </tspan>
                          );
                        })}
                      </text>
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
                        <circle cx={w / 2 - 8} cy={-h / 2 + 8} r={10} fill="transparent" />
                        <text x={w / 2 - 8} y={-h / 2 + 8} textAnchor="middle" dominantBaseline="middle" fontSize={13} style={{ pointerEvents: "none" }}>💬</text>
                      </g>
                    )}
                    {node.url && <circle cx={w / 2 - (node.note ? 16 : 6)} cy={-h / 2 + 6} r={4} fill="#60a5fa" style={{ pointerEvents: "none" }} />}
                    {node.imageUrl && (
                      <image href={node.imageUrl} x={-w / 2} y={h / 2 + 4} width={w} height={40} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
                    )}
                    {!readOnly && (hoveredId === node.id || isSelected) && (
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
                  </>
                )}
              </g>
            );
          })}

          {/* 相談: ラバーバンド選択矩形 */}
          {rubberBand && (
            <rect
              x={Math.min(rubberBand.sx, rubberBand.ex)}
              y={Math.min(rubberBand.sy, rubberBand.ey)}
              width={Math.abs(rubberBand.ex - rubberBand.sx)}
              height={Math.abs(rubberBand.ey - rubberBand.sy)}
              fill="rgba(99,102,241,0.08)"
              stroke="#6366f1"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${5 / zoom} ${3 / zoom}`}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      </svg>

      {/* 複数選択 整列ツールバー */}
      {selectedIds.size > 1 && !readOnly && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-gray-100 px-2 py-1.5 flex items-center gap-0.5"
          onMouseDown={e => e.stopPropagation()}
        >
          <span className="text-xs text-indigo-600 font-semibold px-1.5 py-0.5 bg-indigo-50 rounded-lg mr-1 shrink-0">
            {selectedIds.size}個
          </span>
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          {/* 横方向揃え */}
          <button title="左揃え" onClick={alignSelectedLeft}    className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors">⊣</button>
          <button title="中央揃え（横）" onClick={alignSelectedCenterH} className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors">⊕</button>
          <button title="右揃え" onClick={alignSelectedRight}   className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors">⊢</button>
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          {/* 縦方向揃え */}
          <button title="上揃え" onClick={alignSelectedTop}     className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors">⊤</button>
          <button title="中央揃え（縦）" onClick={alignSelectedCenterV} className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors">⊗</button>
          <button title="下揃え" onClick={alignSelectedBottom}  className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors">⊥</button>
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          {/* 等間隔配置（3個以上で有効）*/}
          <button title="水平に等間隔" onClick={distributeSelectedH} disabled={selectedIds.size < 3}
            className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-30">↔</button>
          <button title="垂直に等間隔" onClick={distributeSelectedV} disabled={selectedIds.size < 3}
            className="w-7 h-7 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-30">↕</button>
        </div>
      )}

      {/* インラインエディタ（Ctrl+Enter / Shift+Enter 改行対応）*/}
      {!readOnly && editingId && editorStyle && (
        <textarea
          ref={inputRef}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            // 改修③: Ctrl+Enter または Shift+Enter → 改行
            if (e.key === "Enter" && (e.ctrlKey || e.shiftKey)) { return; }
            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitEdit(); }
            if (e.key === "Escape") { e.stopPropagation(); setEditingId(null); }
            if (e.key === "Tab") { e.preventDefault(); e.stopPropagation(); commitEdit(); setTimeout(() => addChild(editingId!), 30); }
          }}
          style={{
            position: "absolute",
            ...editorStyle,
            color: editorTextColor,
            resize: "none",
            overflow: "hidden",
            lineHeight: `${LINE_H}px`,
          }}
          className="text-center font-medium bg-transparent border-none outline-none px-2 py-2"
        />
      )}

      {!readOnly && selectedId && toolbarPos && !editingId && !nodes.find(n => n.id === selectedId)?.imageWidth && (
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

      {/* 背景右クリックメニュー */}
      {!readOnly && insertMenu && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 flex flex-col gap-0.5 min-w-[140px]"
          style={{ left: insertMenu.sx, top: insertMenu.sy }}
          onMouseDown={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          {!insertImageMode ? (
            <>
              <button onClick={() => addFloatingTextNode(insertMenu.cx, insertMenu.cy)} className="px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">📝 テキスト</button>
              <button onClick={() => addFloatingNode(insertMenu.cx, insertMenu.cy)} className="px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">＋ ノード</button>
              <button onClick={() => setInsertImageMode(true)} className="px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">🖼️ 画像</button>
            </>
          ) : (
            <div className="flex flex-col gap-2 p-1">
              <p className="text-xs text-gray-400 font-medium">画像を追加</p>
              <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer">
                📁 ファイルから選択
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file || !insertMenu) return;
                    const reader = new FileReader();
                    reader.onload = ev => { addFloatingImageNode(insertMenu.cx, insertMenu.cy, ev.target?.result as string); };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs text-gray-400 mb-1">または URL</p>
                <input autoFocus type="url" value={insertImageUrl} onChange={e => setInsertImageUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.stopPropagation(); addFloatingImageNode(insertMenu.cx, insertMenu.cy, insertImageUrl); }
                    if (e.key === "Escape") { e.stopPropagation(); setInsertMenu(null); setInsertImageMode(false); }
                  }}
                  placeholder="https://..."
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400 w-full"
                />
                <button onClick={() => addFloatingImageNode(insertMenu.cx, insertMenu.cy, insertImageUrl)}
                  disabled={!insertImageUrl.trim()}
                  className="mt-1.5 w-full px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 transition-colors"
                >追加</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 改修②: ノード右クリックメニュー（書式コントロール横並び + アクション）*/}
      {!readOnly && nodeCtxMenu && ctxNode && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-3 flex flex-col gap-2.5"
          style={{ left: nodeCtxMenu.sx, top: nodeCtxMenu.sy, minWidth: 228 }}
          onMouseDown={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          {/* 複数選択表示 */}
          {isBatch && (
            <div className="text-xs text-indigo-600 font-semibold bg-indigo-50 rounded-lg px-2 py-1">
              {selectedIds.size}個のノードに適用
            </div>
          )}

          {/* 形 */}
          <div>
            <p className="text-xs text-gray-400 mb-1">形</p>
            <div className="flex gap-1">
              {CTX_SHAPES.map(s => (
                <button key={s.id} onClick={() => applyFormat({ shape: s.id })}
                  className={`flex-1 h-7 rounded border text-sm transition-colors ${(ctxNode.shape ?? "pill") === s.id ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                >{s.l}</button>
              ))}
            </div>
          </div>

          {/* ノード色 */}
          <div>
            <p className="text-xs text-gray-400 mb-1">ノード色</p>
            <div className="grid grid-cols-6 gap-1">
              {CTX_COLORS.map(c => (
                <button key={c} onClick={() => applyFormat({ color: c })}
                  className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c, outline: ctxNode.color === c ? "2px solid #6366f1" : "none", outlineOffset: 1 }}
                />
              ))}
            </div>
          </div>

          {/* テキスト書式 */}
          <div>
            <p className="text-xs text-gray-400 mb-1">テキスト</p>
            <div className="flex gap-1 mb-1.5">
              <button onClick={() => applyFormat({ fontBold: !ctxNode.fontBold })}
                className={`w-7 h-7 rounded border font-bold text-sm transition-colors ${ctxNode.fontBold ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              >B</button>
              <button onClick={() => applyFormat({ fontItalic: !ctxNode.fontItalic })}
                className={`w-7 h-7 rounded border italic text-sm transition-colors ${ctxNode.fontItalic ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              >i</button>
              <div className="w-px bg-gray-200 mx-0.5" />
              {CTX_SIZES.map(size => (
                <button key={size} onClick={() => applyFormat({ fontSize: size })}
                  className={`flex-1 h-7 rounded border text-xs transition-colors ${(ctxNode.fontSize ?? 13) === size ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                >{size}</button>
              ))}
            </div>
            {/* 文字色 */}
            <div className="flex gap-1">
              {CTX_TEXT_COLORS.map(c => (
                <button key={c} onClick={() => applyFormat({ textColor: c })}
                  className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c, outline: (ctxNode.textColor ?? "#ffffff") === c ? "2px solid #6366f1" : "none", outlineOffset: 1 }}
                />
              ))}
            </div>
          </div>

          {/* アクション */}
          <div className="border-t border-gray-100 pt-2 flex flex-col gap-0.5">
            <button onClick={() => alignSiblings(nodeCtxMenu.nodeId)}
              className="w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">⚡ 兄弟ノードを整列</button>
            <button onClick={() => {
              if (ctxNode) { setEditingId(ctxNode.id); setEditText(ctxNode.text); }
              setNodeCtxMenu(null);
            }} className="w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg">✏️ 名前を変更</button>
          </div>
          <div className="border-t border-gray-100 pt-1">
            <button onClick={() => { deleteNodes(isBatch ? selectedIds : new Set([nodeCtxMenu.nodeId])); setNodeCtxMenu(null); }}
              className="w-full px-3 py-1.5 text-sm text-left text-red-500 hover:bg-red-50 rounded-lg">
              🗑️ {isBatch ? `${selectedIds.size}個を削除` : "削除"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
