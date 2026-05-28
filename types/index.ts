export interface ListItem {
  id: string;
  text: string;
  checked: boolean;
  children?: ListItem[];
}

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
  isCheckbox?: boolean;
  checked?: boolean;
  priority?: number;
  listItems?: ListItem[];
  listFontSize?: number;
  listType?: "checkbox" | "numbered" | "bullet";
  noteContent?: string;   // 定義されていればノートノード（空文字列も有効）
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

export interface CanvasArea {
  id: string;
  x: number;        // top-left corner in canvas space
  y: number;
  width: number;
  height: number;
  title: string;
  color: string;
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
  name?: string;
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
  defaultShape?: "pill" | "rect" | "circle" | "diamond" | "text";
  nodeBorderWidth?: number;
  stickyNotes?: StickyNote[];
  areas?: CanvasArea[];
  mode?: "mindmap" | "line";
}
