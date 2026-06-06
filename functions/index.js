/**
 * FutaMindMap — Cloud Functions
 *
 * generateMindMap: 設計書テキストを受け取り、AI(Haiku)で
 *   マインドマップの「木構造」JSON を生成して返す callable 関数。
 *   - 座標(x/y)は AI に考えさせず、フロント側で自動レイアウトする。
 *   - AI 利用料を概算して Firestore(ai_usage/{YYYY-MM}) に月次で積算する
 *     （アプリ内の ¥100 超アラート用）。
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";

initializeApp();
const db = getFirestore();

// Anthropic API キーは Secret Manager に保存（フロントには出さない）
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const MODEL = "claude-haiku-4-5-20251001";

// Haiku 4.5 の概算単価（USD / 1M tokens）。請求の厳密値ではなく見張り用の概算。
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;
const USD_TO_JPY = 160; // 円換算レート（概算）

// ノードの色パレット（AI に選ばせる）
const COLOR_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b",
];

const SYSTEM_PROMPT = `あなたは設計書やメモからマインドマップの構造を作る専門家です。
入力されたテキストを読み取り、マインドマップの「木構造」を JSON で出力してください。

# 厳守するルール
- 出力は JSON のみ。前後に説明文・コードフェンス(\`\`\`)を一切付けない。
- 形式: {"title": string, "nodes": [{"id": string, "text": string, "parentId": string|null, "color": string}]}
- title はマップ全体のタイトル（中心テーマ）。
- nodes は全ノードの配列。座標は出力しない（こちらで自動配置する）。
- id は "n1","n2",... のような一意の短い文字列。
- ルート（中心）ノードは parentId を null にする。ルートは1つだけ。
- 各子ノードの parentId は親の id を指す。階層は深くなりすぎないよう2〜4階層程度に。
- text は簡潔に（長い文は要点に圧縮。1ノード40文字以内が目安）。
- color は次のいずれかから選ぶ。大きな枝ごとに色を変えると見やすい: ${COLOR_PALETTE.join(", ")}
- ノード数は内容に応じて 10〜40 個程度。多すぎず、全体像が一目で分かる粒度にする。
- 入力が日本語なら日本語で、英語なら英語で出力する。`;

/** AI 利用料を Firestore に月次積算する（アラート用の概算） */
async function recordUsage(uid, usage) {
  try {
    const inTok = usage?.input_tokens ?? 0;
    const outTok = usage?.output_tokens ?? 0;
    const costUsd =
      (inTok / 1_000_000) * PRICE_INPUT_PER_MTOK +
      (outTok / 1_000_000) * PRICE_OUTPUT_PER_MTOK;
    const costJpy = costUsd * USD_TO_JPY;

    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const ref = db.collection("ai_usage").doc(ym);
    await ref.set(
      {
        month: ym,
        inputTokens: FieldValue.increment(inTok),
        outputTokens: FieldValue.increment(outTok),
        costJpy: FieldValue.increment(costJpy),
        calls: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return costJpy;
  } catch (e) {
    console.error("[recordUsage] 利用料の記録に失敗:", e);
    return 0;
  }
}

export const generateMindMap = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    region: "asia-northeast1",
    timeoutSeconds: 120,
    memory: "512MiB",
    cors: true,
  },
  async (request) => {
    // 認証必須（ログインユーザーのみ）
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }

    const text = (request.data?.text ?? "").toString().trim();
    if (!text) {
      throw new HttpsError("invalid-argument", "設計書テキストが空です。");
    }
    if (text.length > 20000) {
      throw new HttpsError("invalid-argument", "テキストが長すぎます（2万文字以内にしてください）。");
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value().trim() });

    let message;
    try {
      message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      });
    } catch (e) {
      const status = e?.status;
      if (status === 401) throw new HttpsError("permission-denied", "APIキーが無効です。管理者に連絡してください。");
      if (status === 429) throw new HttpsError("resource-exhausted", "AIのレート制限に達しました。少し待って再試行してください。");
      if (status === 529) throw new HttpsError("unavailable", "AIサーバーが混雑しています。少し待って再試行してください。");
      console.error("[generateMindMap] Anthropic API エラー:", e);
      throw new HttpsError("internal", "AI生成に失敗しました。再試行してください。");
    }

    // 利用料を積算（アラート用）
    const costJpy = await recordUsage(request.auth.uid, message.usage);

    // 応答テキストを取り出して JSON パース
    const raw = message.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim() ?? "";

    let parsed;
    try {
      // 念のためコードフェンスが付いていたら剥がす
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[generateMindMap] JSONパース失敗。raw:", raw.slice(0, 500));
      throw new HttpsError("internal", "AIの応答を解釈できませんでした。もう一度お試しください。");
    }

    if (!parsed?.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      throw new HttpsError("internal", "AIが有効なマップを生成できませんでした。入力を変えて再試行してください。");
    }

    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      nodes: parsed.nodes,
      costJpy,
    };
  }
);
