// ノート本文の保存形式は TipTap JSON。ただしキャンバス上のカードのプレビューと
// 既存ノート（旧・簡易Markdown文字列）との両立のため、以下の変換を用意する。
//
//  - tiptapJsonToMarkdown : TipTap JSON → 簡易Markdown（カードプレビュー／旧パーサ用）
//  - markdownToTiptapHTML : 旧Markdown文字列 → TipTapが読めるHTML（既存ノートの初回読込）
//  - noteContentToMarkdown: noteContent（JSON or 旧文字列）→ Markdown（プレビュー供給）
//  - parseNoteInitial     : noteContent → エディタの初期content（JSONオブジェクト or HTML文字列）
//  - isTiptapDoc          : noteContent が TipTap JSON かどうか

type JSONContent = { type?: string; attrs?: Record<string, unknown>; content?: JSONContent[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };

function escMd(s: string): string {
  return s;
}

// インラインの marks を Markdown 記法へ
function inlineToMarkdown(node: JSONContent): string {
  let t = node.text ?? "";
  if (!t) return "";
  const marks = node.marks ?? [];
  const has = (n: string) => marks.some(m => m.type === n);
  const link = marks.find(m => m.type === "link");
  if (has("code")) t = "`" + t + "`";
  if (has("bold")) t = "**" + t + "**";
  if (has("italic")) t = "*" + t + "*";
  if (has("underline")) t = "__" + t + "__";
  if (has("strike")) t = "~~" + t + "~~";
  if (link && link.attrs && typeof link.attrs.href === "string") t = `[${t}](${link.attrs.href})`;
  return t;
}

function inlineChildren(node: JSONContent): string {
  if (!node.content) return node.text ? inlineToMarkdown(node) : "";
  return node.content.map(c => (c.type === "hardBreak" ? "\n" : inlineToMarkdown(c))).join("");
}

export function tiptapJsonToMarkdown(doc: JSONContent): string {
  const out: string[] = [];

  const walkList = (node: JSONContent, ordered: boolean, depth: number) => {
    const items = node.content ?? [];
    items.forEach((li, i) => {
      const indent = "  ".repeat(depth);
      const bullet = ordered ? `${i + 1}. ` : "- ";
      const checked = li.type === "taskItem" ? (li.attrs?.checked ? "[x] " : "[ ] ") : "";
      const para = (li.content ?? []).filter(c => c.type === "paragraph");
      const firstText = para.length ? inlineChildren(para[0]) : "";
      out.push(`${indent}${bullet}${checked}${firstText}`);
      // ネストしたリスト
      (li.content ?? []).forEach(c => {
        if (c.type === "bulletList") walkList(c, false, depth + 1);
        else if (c.type === "orderedList") walkList(c, true, depth + 1);
        else if (c.type === "taskList") walkList(c, false, depth + 1);
      });
    });
  };

  (doc.content ?? []).forEach(node => {
    switch (node.type) {
      case "heading": {
        const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
        out.push("#".repeat(level) + " " + inlineChildren(node));
        break;
      }
      case "paragraph":
        out.push(inlineChildren(node));
        break;
      case "bulletList": walkList(node, false, 0); break;
      case "orderedList": walkList(node, true, 0); break;
      case "taskList": walkList(node, false, 0); break;
      case "blockquote":
        (node.content ?? []).forEach(p => out.push("> " + inlineChildren(p)));
        break;
      case "codeBlock":
        out.push("```");
        out.push(inlineChildren(node));
        out.push("```");
        break;
      case "horizontalRule":
        out.push("---");
        break;
      default:
        if (node.content) out.push(inlineChildren(node));
    }
  });

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// 旧Markdown文字列 → TipTapが読めるHTML（既存ノートの初回読込用）
export function markdownToTiptapHTML(md: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) => {
    let t = escapeHtml(s);
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__([^_]+)__/g, "<u>$1</u>");
    t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    t = t.replace(/~~([^~]+)~~/g, "<s>$1</s>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    return t;
  };

  const lines = md.split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = null; } };

  for (const line of lines) {
    if (line.trim() === "") { closeList(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) { closeList(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    const ul = line.match(/^\s*[-*]\s+(.*)/);
    if (ol) {
      if (listType !== "ol") { closeList(); html.push("<ol>"); listType = "ol"; }
      html.push(`<li><p>${inline(ol[1])}</p></li>`); continue;
    }
    if (ul) {
      if (listType !== "ul") { closeList(); html.push("<ul>"); listType = "ul"; }
      html.push(`<li><p>${inline(ul[1])}</p></li>`); continue;
    }
    const q = line.match(/^>\s?(.*)/);
    if (q) { closeList(); html.push(`<blockquote><p>${inline(q[1])}</p></blockquote>`); continue; }
    if (/^---+$/.test(line.trim())) { closeList(); html.push("<hr>"); continue; }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join("") || "<p></p>";
}

export function isTiptapDoc(noteContent: string | undefined): boolean {
  if (!noteContent) return false;
  const s = noteContent.trim();
  if (!s.startsWith("{")) return false;
  try {
    const o = JSON.parse(s);
    return o && o.type === "doc";
  } catch { return false; }
}

// noteContent（JSON or 旧文字列）→ Markdown（カードプレビュー・旧パーサへ供給）
export function noteContentToMarkdown(noteContent: string | undefined): string {
  if (!noteContent) return "";
  if (isTiptapDoc(noteContent)) {
    try { return tiptapJsonToMarkdown(JSON.parse(noteContent)); } catch { return ""; }
  }
  return noteContent; // 旧・簡易Markdown文字列はそのまま
}

// エディタ初期content：JSONならパース済みオブジェクト、旧文字列ならHTMLへ変換
export function parseNoteInitial(noteContent: string | undefined): object | string {
  if (!noteContent || !noteContent.trim()) return "<p></p>";
  if (isTiptapDoc(noteContent)) {
    try { return JSON.parse(noteContent); } catch { /* fallthrough */ }
  }
  return markdownToTiptapHTML(noteContent);
}

void escMd;
