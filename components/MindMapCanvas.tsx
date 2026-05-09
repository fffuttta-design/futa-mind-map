"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MindMapNode } from "@/types";

interface Props {
  initialNodes: MindMapNode[];
  onNodesChange: (nodes: MindMapNode[]) => void;
}

const NODE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function MindMapCanvas({ initialNodes, onNodesChange }: Props) {
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  const updateNodes = useCallback((updated: MindMapNode[]) => {
    setNodes(updated);
    onNodesChange(updated);
  }, [onNodesChange]);

  const addChild = useCallback((parentId: string) => {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return;
    const children = nodes.filter((n) => n.parentId === parentId);
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      text: "新しいノード",
      x: parent.x + 200,
      y: parent.y + children.length * 60 - (children.length * 30),
      parentId,
      color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
    };
    const updated = [...nodes, newNode];
    updateNodes(updated);
    setSelectedId(newNode.id);
    setTimeout(() => {
      setEditingId(newNode.id);
      setEditText(newNode.text);
    }, 50);
  }, [nodes, updateNodes]);

  const deleteNode = useCallback((id: string) => {
    if (id === "root") return;
    const toDelete = new Set<string>();
    const collect = (nId: string) => {
      toDelete.add(nId);
      nodes.filter((n) => n.parentId === nId).forEach((n) => collect(n.id));
    };
    collect(id);
    updateNodes(nodes.filter((n) => !toDelete.has(n.id)));
    setSelectedId(null);
  }, [nodes, updateNodes]);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    updateNodes(nodes.map((n) => n.id === editingId ? { ...n, text: editText } : n));
    setEditingId(null);
  }, [editingId, editText, nodes, updateNodes]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (editingId) return;
      if (!selectedId) return;
      if (e.key === "Tab") {
        e.preventDefault();
        addChild(selectedId);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        setEditingId(selectedId);
        const node = nodes.find((n) => n.id === selectedId);
        if (node) setEditText(node.text);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteNode(selectedId);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, editingId, addChild, deleteNode, nodes]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const toCanvas = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x - rect.width / 2) / zoom,
      y: (clientY - rect.top - pan.y - rect.height / 2) / zoom,
    };
  };

  const onMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedId(nodeId);
    const node = nodes.find((n) => n.id === nodeId)!;
    const pos = toCanvas(e.clientX, e.clientY);
    setDragging({ id: nodeId, offsetX: pos.x - node.x, offsetY: pos.y - node.y });
  };

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === "rect") {
      setSelectedId(null);
      if (editingId) commitEdit();
      setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const pos = toCanvas(e.clientX, e.clientY);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging.id ? { ...n, x: pos.x - dragging.offsetX, y: pos.y - dragging.offsetY } : n
        )
      );
    }
    if (panStart) {
      setPan({ x: panStart.panX + e.clientX - panStart.x, y: panStart.panY + e.clientY - panStart.y });
    }
  };

  const onMouseUp = () => {
    if (dragging) {
      onNodesChange(nodes);
    }
    setDragging(null);
    setPanStart(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  const getEdges = () => {
    return nodes
      .filter((n) => n.parentId)
      .map((n) => {
        const parent = nodes.find((p) => p.id === n.parentId);
        if (!parent) return null;
        return { id: n.id, x1: parent.x, y1: parent.y, x2: n.x, y2: n.y, color: n.color };
      })
      .filter(Boolean);
  };

  return (
    <div className="w-full h-full bg-gray-50 relative overflow-hidden select-none">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={onSvgMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <rect width="100%" height="100%" fill="transparent" />
        <g transform={`translate(${(svgRef.current?.clientWidth ?? 800) / 2 + pan.x}, ${(svgRef.current?.clientHeight ?? 600) / 2 + pan.y}) scale(${zoom})`}>
          {getEdges().map((edge) => edge && (
            <line
              key={edge.id}
              x1={edge.x1} y1={edge.y1}
              x2={edge.x2} y2={edge.y2}
              stroke={edge.color}
              strokeWidth={2}
              strokeOpacity={0.5}
            />
          ))}
          {nodes.map((node) => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseDown={(e) => onMouseDown(e, node.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingId(node.id);
                setEditText(node.text);
              }}
              className="cursor-pointer"
            >
              <rect
                x={-60} y={-18}
                width={120} height={36}
                rx={18}
                fill={node.color}
                fillOpacity={selectedId === node.id ? 1 : 0.85}
                stroke={selectedId === node.id ? "#1e1b4b" : "transparent"}
                strokeWidth={2}
              />
              {editingId === node.id ? null : (
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={13}
                  fontWeight={500}
                  style={{ pointerEvents: "none" }}
                >
                  {node.text.length > 12 ? node.text.slice(0, 12) + "…" : node.text}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>

      {editingId && (() => {
        const node = nodes.find((n) => n.id === editingId);
        if (!node || !svgRef.current) return null;
        const rect = svgRef.current.getBoundingClientRect();
        const sx = rect.width / 2 + pan.x + node.x * zoom;
        const sy = rect.height / 2 + pan.y + node.y * zoom;
        return (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditingId(null);
            }}
            style={{ position: "absolute", left: sx - 60, top: sy - 14, width: 120, height: 28 }}
            className="text-center text-sm font-medium text-white bg-transparent border-none outline-none rounded-full px-2"
          />
        );
      })()}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
        <span>Tab: 子ノード追加</span>
        <span>Enter: 編集</span>
        <span>Delete: 削除</span>
        <span>ダブルクリック: 編集</span>
      </div>

      {selectedId && selectedId !== "root" && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => addChild(selectedId)}
            className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 transition-colors"
          >
            ＋ 子ノード
          </button>
          <button
            onClick={() => deleteNode(selectedId)}
            className="px-3 py-1.5 bg-red-100 text-red-500 text-xs rounded-lg hover:bg-red-200 transition-colors"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}
