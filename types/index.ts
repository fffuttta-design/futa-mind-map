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
  shape?: "pill" | "rect" | "circle" | "diamond";
  fontBold?: boolean;
  fontItalic?: boolean;
  fontSize?: number;
  textColor?: string;
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
}
