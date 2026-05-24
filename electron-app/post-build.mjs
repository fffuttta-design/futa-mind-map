/**
 * post-build.mjs
 * ビルド後に dist/win-unpacked/version.json を自動生成する
 * build-info.json の builtAt をそのまま使うので手動入力不要
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const pkg       = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));
const buildInfo = JSON.parse(readFileSync(join(__dirname, "build-info.json"), "utf-8"));

const versionJson = {
  version: pkg.version,
  builtAt: buildInfo.builtAt,
  notes: "",   // ← リリース時に更新内容を書いてもOK（省略可）
};

const outPath = join(__dirname, "dist", "win-unpacked", "version.json");
writeFileSync(outPath, JSON.stringify(versionJson, null, 2));

console.log("✅ version.json generated → dist/win-unpacked/version.json");
console.log(`   version : ${versionJson.version}`);
console.log(`   builtAt : ${versionJson.builtAt}`);
console.log("");
console.log("📁 次のステップ：");
console.log("   dist/win-unpacked/ の中身を Google ドライブフォルダに上書きコピーしてください");
