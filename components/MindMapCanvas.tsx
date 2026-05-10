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
const LINE_H_RATIO = 1.5;

function getLineCount(text: string): number {
  return text.split("\n").length;
}

function nodeWidth(node: MindMapNode): number {
  if (node.imageWidth) return node.imageWidth;
  const lines = node.text.split("\n");
  const maxLen = Math.max(...lines.map(l => l.length), 1);
  const base = Math.max(80, Math.min(220, maxLen * 8.5 + 48));
  if (node.shape === "circle") return NODE_H * 2 + 8;
  if (node.shape === "diamond") return base + 24;
  return base;
}

function nodeHeight(node: MindMapNode): number {
  if (node.imageHeight) return node.imageHeight;
  const lines = getLineCount(node.text);
  if (lines > 1) {
    const lineH = (node.fontSize ?? 13) * LINE_H_RATIO;
    return Math.max(NODE_H, lines * lineH + 16);
  }
  if (node.shape === "circle") return NODE_H * 2 + 8;
  if (node.shape === "diamond") return NODE_H + 16;
  return NODE_H;
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
    const x1 = p.x + nodeWidth(p) / 2, y1 = p.y, x2 = n.x - nodeWidth(n) / 2, y2 = n.y;
    const cx = (x1 + x2) / 2;
    return `<path d="M ${x1},${y1} C ${cx},${y1} ${cx},${y2} ${x2},${y2}" fill="none" stroke="${n.color}" stroke-width="2" stroke-opacity="0.45"/>`;
  }).join("\n");

  const nodeEls = nodes.map(node => {
    const w = nodeWidth(node), h = nodeHeight(node);
    const label = node.text.split("\n")[0];
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
    const displayLabel = label.length > 16 ? label.slice(0, 16) + "…" : label;
    return `${shapeEl}\n${iconEl}\n<text x="${tx}" y="${node.y}" text-anchor="middle" dominant-baseline="middle" fill="${tc}" font-size="${fs}" font-weight="${fw}" font-family="sans-serif">${displayLabel}</text>`;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

  // Always-current refs for use in window-level handlers
  const nodesRef = useRef(nodes);
  const draggingRef = useRef(dragging);
  const resizingRef = useRef(resizing);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const onNodesChangeRef = useRef(onNodesChange);
  const editingIdRef = useRef(editingId);
  nodesRef.current = nodes;
  draggingRef.current = dragging;
  resizingRef.current = resizing;
  panRef.current = pan;
  zoomRef.current = zoom;
  onNodesChangeRef.current = onNodesChange;
  editingIdRef.current = editingId;

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

  // Compute toolbar position
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

  // Compute inline editor position — recalculates on every keystroke for multiline
  useEffect(() => {
    const svg = svgRef.current;
    const node = editingId ? nodes.find(n => n.id === editingId) : undefined;
    if (svg && node) {
      const r = svg.getBoundingClientRect();
      const sx = r.width / 2 + pan.x + node.x * zoom;
      const sy = r.height / 2 + pan.y + node.y * zoom;
      const w = nodeWidth(node) * zoom;
      const lineCount = editText ? getLineCount(editText) : 1;
      const lineH = (node.fontSize ?? 13) * LINE_H_RATIO;
      const hCanvas = lineCount > 1 ? Math.max(NODE_H, lineCount * lineH + 16) : NODE_H;
      const h = hCanvas * zoom;
      setEditorStyle({ left: sx - w / 2, top: sy - h / 2, width: w, height: h, fontSize: (node.fontSize ?? 13) * zoom });
    } else {
      setEditorStyle(null);
    }
  }, [editingId, editText, nodes, pan, zoom]);

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
      parentId, color: parent.color,
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
      x: cx, y: cy, parentId: null, color: "#1e293b",
      shape: "text", textColor: "#1e293b",
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
      x: cx, y: cy, parentId: null, color: "#64748b",
      imageUrl: url.trim(), imageWidth: 200, imageHeight: 150,
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

  // Window-level drag/resize — mouse can leave SVG without dropping
  useEffect(() => {
    const getCanvasPos = (cx: number, cy: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      const p = panRef.current, z = zoomRef.current;
      return { x: (cx - r.left - p.x - r.width / 2) / z, y: (cy - r.top - p.y - r.height / 2) / z };
    };
    const onMove = (e: MouseEvent) => {
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
    const onUp = () => {
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

  // ⑦ Clipboard image paste
  useEffect(() => {
    if (readOnly) return;
    const onPaste = (e: ClipboardEvent) => {
      // Skip if user is editing text inside a textarea/input
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
        const cx = -panRef.current.x / zoomRef.current;
        const cy = -panRef.current.y / zoomRef.current;
        const newNode: MindMapNode = {
          id: `node-${Date.now()}`, text: "",
          x: cx + (Math.random() - 0.5) * 80,
          y: cy + (Math.random() - 0.5) * 80,
          parentId: null, color: "#64748b",
          imageUrl: dataUrl, imageWidth: 200, imageHeight: 150,
        };
        setNodes(prev => {
          const updated = [...prev, newNode];
          onNodesChangeRef.current(updated);
          return updated;
        });
        setSelectedIds(new Set([newNode.id]));
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  const toCanvas = (cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - pan.x - r.width / 2) / zoom, y: (cy - r.top - pan.y - r.height / 2) / zoom };
  };

  const onNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (readOnly || e.button !== 0) return;
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
    if (e.button === 2) return; // right-click handled by onBgContextMenu
    if (insertMenu) { setInsertMenu(null); setInsertImageMode(false); return; }
    if (editingId) commitEdit();
    if (!readOnly) setSelectedIds(new Set());
    setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
  };

  // ⑤ Right-click context menu
  const onBgContextMenu = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const cv = toCanvas(e.clientX, e.clientY);
    setInsertMenu({ sx: e.clientX - r.left, sy: e.clientY - r.top, cx: cv.x, cy: cv.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (panStart) setPan({ x: panStart.px + e.clientX - panStart.mx, y: panStart.py + e.clientY - panStart.my });
  };

  const onMouseUp = () => { setPanStart(null); };

  const onMouseLeave = () => { setPanStart(null); };

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

  // Compute editor text color before JSX
  const editingNode = editingId ? nodes.find(n => n.id === editingId) : null;
  const editorTextColor = editingNode?.shape === "text"
    ? (editingNode.textColor ?? editingNode.color ?? "#1e293b")
    : (editingNode?.textColor ?? "white");

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
        <rect width="100%" height="100%" fill="transparent" onMouseDown={onBgMouseDown} onContextMenu={onBgContextMenu} />
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
            const isImageNode = !!node.imageWidth;
            const fontSize = node.fontSize ?? 13;
            const lineH = fontSize * LINE_H_RATIO;
            const textLines = node.text.split("\n");
            const startY = -(textLines.length * lineH / 2) + lineH / 2;

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
                    {/* ⑧ Multiline text rendering */}
                    {editingId !== node.id && (
                      <text
                        textAnchor="middle"
                        fill={node.shape === "text" ? (node.textColor ?? node.color) : (node.textColor ?? "white")}
                        fontSize={fontSize}
                        fontWeight={node.fontBold ? "bold" : "500"}
                        fontStyle={node.fontItalic ? "italic" : "normal"}
                        style={{ pointerEvents: "none" }}
                      >
                        {textLines.map((line, i) => (
                          <tspan
                            key={i}
                            x={node.icon ? 8 : 0}
                            y={startY + i * lineH}
                            dominantBaseline="middle"
                          >
                            {line.length > 20 ? line.slice(0, 20) + "…" : line}
                          </tspan>
                        ))}
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
                    {node.url && <circle cx={w / 2 - (node.note ? 20 : 6)} cy={-h / 2 + 6} r={4} fill="#60a5fa" style={{ pointerEvents: "none" }} />}
                    {node.imageUrl && !isImageNode && (
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
        </g>
      </svg>

      {/* ⑧ Textarea editor with Ctrl+Enter for newline */}
      {!readOnly && editingId && editorStyle && (
        <textarea
          ref={inputRef}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === "Enter" && e.ctrlKey) { /* allow default newline */ return; }
            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitEdit(); }
            if (e.key === "Escape") { e.stopPropagation(); setEditingId(null); }
            if (e.key === "Tab") { e.preventDefault(); e.stopPropagation(); commitEdit(); setTimeout(() => addChild(editingId!), 30); }
          }}
          style={{
            position: "absolute",
            left: editorStyle.left,
            top: editorStyle.top,
            width: editorStyle.width,
            height: editorStyle.height,
            fontSize: editorStyle.fontSize,
            color: editorTextColor,
            resize: "none",
            overflow: "hidden",
            lineHeight: LINE_H_RATIO,
          }}
          className="text-center font-medium bg-transparent border-none outline-none px-2"
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

      {/* ③⑤ Right-click insert menu */}
      {!readOnly && insertMenu && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 flex flex-col gap-0.5 min-w-[140px]"
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
                onClick={() => addFloatingTextNode(insertMenu.cx, insertMenu.cy)}
                className="px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg"
              >Ｔ テキスト</button>
              <button
                onClick={() => setInsertImageMode(true)}
                className="px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg"
              >🖼️ 画像</button>
            </>
          ) : (
            <div className="flex flex-col gap-2 p-1">
              <p className="text-xs text-gray-400 font-medium">画像を追加</p>
              {/* ⑥ URL入力 */}
              <input
                autoFocus
                type="url"
                value={insertImageUrl}
                onChange={e => setInsertImageUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.stopPropagation(); addFloatingImageNode(insertMenu.cx, insertMenu.cy, insertImageUrl); }
                  if (e.key === "Escape") { e.stopPropagation(); setInsertMenu(null); setInsertImageMode(false); }
                }}
                placeholder="URLを入力..."
                className="text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400 w-44"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">または</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {/* ⑥ ローカルファイル選択 */}
              <label className="flex items-center justify-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer border border-indigo-200 hover:border-indigo-400 rounded px-2 py-1.5 transition-colors">
                <span>📁 ファイルを選択</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const dataUrl = ev.target?.result as string;
                      addFloatingImageNode(insertMenu.cx, insertMenu.cy, dataUrl);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
