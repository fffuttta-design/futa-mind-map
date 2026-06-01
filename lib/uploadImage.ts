import { ref, uploadString, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * 画像を Firebase Storage にアップロードしてダウンロード URL を返す。
 *
 * Firestore は 1 ドキュメント 1MiB 上限のため、画像本体（data URL / base64）を
 * マップに直接保存すると保存全体が失敗する。画像は Storage に預け、
 * マップには URL だけを保存する。
 *
 * 既に http(s) URL の場合はアップロード不要なのでそのまま返す。
 */

const MAX_DATAURL_FALLBACK = 900_000; // ~0.9MB。アップロード失敗時に data URL を許容する上限

function uid(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** data URL からおおよそのバイト数を見積もる（base64 は元データの約 4/3） */
function approxBytesOfDataUrl(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/**
 * 画像ソース（data URL もしくは http URL）を受け取り、
 * Storage に保存して取得可能な URL を返す。
 * - http(s):// → そのまま返す（外部URL）
 * - data:image/... → Storage にアップロードしてダウンロード URL を返す
 *
 * @param src        画像ソース文字列
 * @param mapId      マップID（保存パスに使用）
 * @throws アップロードに失敗し、かつ data URL が大きすぎる場合は例外を投げる
 */
export async function uploadImageSrc(src: string, mapId: string): Promise<string> {
  const s = (src ?? "").trim();
  if (!s) return s;

  // 既にリモートURL（外部画像）ならそのまま使う
  if (/^https?:\/\//i.test(s)) return s;

  // data URL でなければそのまま返す（想定外フォーマットは触らない）
  if (!s.startsWith("data:")) return s;

  // MIME から拡張子を推定
  const mimeMatch = s.match(/^data:([^;,]+)[;,]/);
  const mime = mimeMatch?.[1] ?? "image/png";
  const ext = mime.split("/")[1]?.split("+")[0] ?? "png";

  const path = `maps/${mapId || "shared"}/images/${uid()}.${ext}`;
  const storageRef = ref(storage, path);

  try {
    // data_url 形式のまま安全にアップロード
    await uploadString(storageRef, s, "data_url");
    return await getDownloadURL(storageRef);
  } catch (err) {
    // アップロードに失敗した場合のフォールバック:
    // 小さい画像なら従来どおり data URL を埋め込み（保存上限を超えない範囲）
    if (approxBytesOfDataUrl(s) <= MAX_DATAURL_FALLBACK) {
      console.warn("[uploadImage] Storage upload failed, falling back to inline data URL:", err);
      return s;
    }
    console.error("[uploadImage] Storage upload failed and image too large for inline fallback:", err);
    throw err instanceof Error ? err : new Error("画像のアップロードに失敗しました");
  }
}

/**
 * File オブジェクトを直接 Storage にアップロードしてダウンロード URL を返す。
 * （FileReader で data URL 化せず、バイナリのまま送れるため大きな画像でも安全）
 */
export async function uploadImageFile(file: File, mapId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || (file.type.split("/")[1] ?? "png");
  const path = `maps/${mapId || "shared"}/images/${uid()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || undefined });
  return await getDownloadURL(storageRef);
}
