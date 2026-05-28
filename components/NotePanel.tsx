"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MindMapNode } from "@/types";

interface Props {
  node: MindMapNode;
  onUpdate: (noteContent: string) => void;
  onClose: () => void;
}

export default function NotePanel({ node, onUpdate, onClose }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onUpdateRef = useRef(onUpdate);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);

  // onUpdate は毎レンダリングで変わるため ref で保持（stale closure 対策）
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  // ノード変更時のみ初期化
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = node.noteContent ?? "";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // アンマウント時に残っている保存を確定
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (editorRef.current) {
          onUpdateRef.current(editorRef.current.innerHTML);
        }
      }
    };
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (editorRef.current) onUpdateRef.current(editorRef.current.innerHTML);
      saveTimerRef.current = null;
    }, 1000);
  }, []);

  const syncFormatState = useCallback(() => {
    setBoldActive(document.queryCommandState("bold"));
    setItalicActive(document.queryCommandState("italic"));
  }, []);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) {
      setPopup(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setPopup({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 44,
    });
    syncFormatState();
  }, [syncFormatState]);

  const applyFormat = useCallback((cmd: "bold" | "italic") => {
    editorRef.current?.focus();
    document.execCommand(cmd);
    scheduleSave();
    setTimeout(handleSelectionChange, 10);
  }, [scheduleSave, handleSelectionChange]);

  return (
    <div className="w-72 bg-white border-l border-gray-100 flex flex-col overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-base">📝</span>
        <h3 className="text-sm font-semibold text-gray-700 truncate flex-1">{node.text}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
        >×</button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto relative p-3">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="ノートを入力..."
          onInput={scheduleSave}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onBlur={() => {
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
              if (editorRef.current) onUpdateRef.current(editorRef.current.innerHTML);
            }
            setTimeout(() => setPopup(null), 200);
          }}
          className="outline-none text-sm text-gray-700 leading-relaxed"
          style={{ whiteSpace: "pre-wrap", minHeight: "200px" }}
        />
        {popup && (
          <div
            className="absolute flex rounded-lg overflow-hidden shadow-lg z-10"
            style={{
              left: Math.max(0, popup.x - 36),
              top: Math.max(4, popup.y),
              background: "#1e293b",
            }}
          >
            <button
              onMouseDown={e => { e.preventDefault(); applyFormat("bold"); }}
              className={`w-9 h-8 text-sm font-bold transition-colors ${boldActive ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10"}`}
            >B</button>
            <button
              onMouseDown={e => { e.preventDefault(); applyFormat("italic"); }}
              className={`w-9 h-8 text-sm italic transition-colors ${italicActive ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10"}`}
            >I</button>
          </div>
        )}
      </div>
    </div>
  );
}
