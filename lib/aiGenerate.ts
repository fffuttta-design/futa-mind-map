import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { MindMapNode } from "@/types";

/** Functions(generateMindMap) が返す木構造ノード */
interface AiNode {
  id: string;
  text: string;
  parentId: string | null;
  color: string;
}
interface GenerateResult {
  title: string;
  nodes: AiNode[];
  costJpy: number;
}

/**
 * 設計書テキストを Cloud Functions に送り、AI 生成された
 * マインドマップ（座標付き MindMapNode[]）と中心テーマを得る。
 * AI は木構造のみ返し、座標はこのモジュールの自動レイアウトで決める。
 */
export async function generateMindMapFromText(
  text: string,
  origin: { x: number; y: number }
): Promise<{ nodes: MindMapNode[]; title: string }> {
  const call = httpsCallable<{ text: string }, GenerateResult>(functions, "generateMindMap");
  const res = await call({ text });
  const ai = res.data;
  const laidOut = layoutTree(ai.nodes, origin);
  return { nodes: laidOut, title: ai.title };
}

// ── 自動レイアウト ───────────────────────────────────────────
// 横型ツリー: ルートを左に置き、世代ごとに右へ展開。
// 各サブツリーが必要とする縦幅を計算して兄弟が重ならないように積む。

const X_GAP = 260; // 世代間の横間隔
const Y_GAP = 64;  // 葉ノード間の縦間隔

interface TreeNode {
  ai: AiNode;
  children: TreeNode[];
  subtreeHeight: number; // このサブツリーが占める縦幅（Y_GAP 単位の合算）
  y: number;
}

/**
 * AI ノード配列（親子関係つき）を座標付き MindMapNode[] に変換。
 * @param origin キャンバス上の基準点（ルートをこの付近に置く）
 */
export function layoutTree(aiNodes: AiNode[], origin: { x: number; y: number }): MindMapNode[] {
  if (aiNodes.length === 0) return [];

  // id→ツリーノード
  const map = new Map<string, TreeNode>();
  for (const a of aiNodes) {
    map.set(a.id, { ai: a, children: [], subtreeHeight: 0, y: 0 });
  }

  // 親子を接続。ルート（parentId=null or 不明な親）を収集
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    const pid = node.ai.parentId;
    if (pid && map.has(pid) && pid !== node.ai.id) {
      map.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // サブツリーの縦幅を計算（葉=1、内部=子の合計）
  function measure(n: TreeNode): number {
    if (n.children.length === 0) {
      n.subtreeHeight = 1;
      return 1;
    }
    let sum = 0;
    for (const c of n.children) sum += measure(c);
    n.subtreeHeight = sum;
    return sum;
  }

  // 縦位置を割り当て（中央寄せ）。topは「Y_GAP単位」のオフセット。
  function assignY(n: TreeNode, top: number) {
    if (n.children.length === 0) {
      n.y = top; // 葉は自分の枠の中央
      return;
    }
    let cursor = top;
    for (const c of n.children) {
      assignY(c, cursor);
      cursor += c.subtreeHeight;
    }
    // 親は子全体の中央
    const first = n.children[0].y;
    const last = n.children[n.children.length - 1].y;
    n.y = (first + last) / 2;
  }

  // 複数ルートがある場合は縦に積む
  let totalTop = 0;
  for (const r of roots) {
    measure(r);
    assignY(r, totalTop);
    totalTop += r.subtreeHeight;
  }

  // 中央寄せのため全体の縦幅の中心を origin.y に合わせる
  const centerOffset = (totalTop - 1) / 2;

  const out: MindMapNode[] = [];
  function emit(n: TreeNode, depth: number) {
    out.push({
      id: `node-${Date.now()}-${n.ai.id}`,
      text: n.ai.text || "",
      x: origin.x + depth * X_GAP,
      y: origin.y + (n.y - centerOffset) * Y_GAP,
      parentId: null, // 後で実IDに張り替える
      color: isValidColor(n.ai.color) ? n.ai.color : "#6366f1",
    });
    for (const c of n.children) emit(c, depth + 1);
  }
  for (const r of roots) emit(r, 0);

  // parentId を実 ID（node-...）に張り替える
  const idMap = new Map<string, string>(); // aiId → realId
  let i = 0;
  function collectIds(n: TreeNode) {
    idMap.set(n.ai.id, out[i].id);
    i++;
    for (const c of n.children) collectIds(c);
  }
  for (const r of roots) collectIds(r);

  i = 0;
  function setParents(n: TreeNode) {
    const realId = out[i].id;
    const pid = n.ai.parentId;
    out[i].parentId = pid && idMap.has(pid) ? idMap.get(pid)! : null;
    i++;
    void realId;
    for (const c of n.children) setParents(c);
  }
  for (const r of roots) setParents(r);

  return out;
}

function isValidColor(c: string): boolean {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
}
