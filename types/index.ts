export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  color: string;
  icon?: string;
  note?: string;
  url?: string;
  imageUrl?: string;
  collapsed?: boolean;
  shape?: "pill" | "rect" | "circle" | "diamond" | "text";
  fontBold?: boolean;
  fontItalic?: boolean;
  fontSize?: number;
  textColor?: string;
  imageWidth?: number;
  imageHeight?: number;
  customWidth?: number;
  customHeight?: number;
  lineMessage?: LineMessageData;
  checklist?: ChecklistItem[];
  priority?: 1 | 2 | 3 | 4;
}

// ── LINE モード ──────────────────────────────────────
export interface LineButton {
  label: string;
  url?: string;
}

export interface LineCarouselCard {
  imageUrl?: string;
  title?: string;
  text?: string;
  buttons?: LineButton[];
}

export interface LineMessageData {
  type: "text" | "button" | "carousel";
  // テキスト
  text?: string;
  // ボタン（リッチメッセージ）
  buttonImageUrl?: string;
  buttonTitle?: string;
  buttonText?: string;
  buttons?: LineButton[];
  // カルーセル
  cards?: LineCarouselCard[];
}
// ──────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  width: number;
  height: number;
}

export interface HistoryEntry {
  id: string;
  nodes: MindMapNode[];
  savedAt: number;
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindMapNode[];
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  folder?: string;
  tags?: string[];
  isPublic?: boolean;
  edgeStyle?: "curve" | "straight";
  stickyNotes?: StickyNote[];
  mode?: "mindmap" | "line";
}
