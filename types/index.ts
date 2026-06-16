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
  noteContent?: string;
  isCheckbox?: boolean;
  checked?: boolean;
  priority?: number;
  listItems?: ListItem[];
  listFontSize?: number;
  listType?: "checkbox" | "numbered" | "bullet";
  // タグ・友だち情報（Lステップ風）: マスタの id を参照
  tagIds?: string[];
  friendFieldIds?: string[];
}

// ── タグ・友だち情報マスタ（マップ単位で共通） ──────────────
export interface TagGroup {
  id: string;
  name: string;
}
export interface TagDef {
  id: string;
  name: string;
  color: string;
  groupId: string | null;
}
export interface FriendFieldDef {
  id: string;
  name: string;
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

// ノード同士を自由につなぐ関連線（親子ツリーとは別物）。
export interface Connection {
  id: string;
  from: string;   // 始点ノード id
  to: string;     // 終点ノード id
  color?: string; // 線の色（省略時はデフォルトのグレー）
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
  connections?: Connection[];
  mode?: "mindmap" | "line";
  // タグ・友だち情報マスタ（Lステップ風）。既存の tags?: string[] とは別物。
  tagGroups?: TagGroup[];
  tagDefs?: TagDef[];
  friendFields?: FriendFieldDef[];
}
