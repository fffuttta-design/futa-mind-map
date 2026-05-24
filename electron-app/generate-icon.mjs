/**
 * generate-icon.mjs
 * アプリアイコン（PNG → ICO）を生成するスクリプト
 * 親プロジェクトの sharp と png-to-ico を使用
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Windowsパスを file:// URL に変換してからimport
const sharp = (await import(pathToFileURL(join(__dirname, "..", "node_modules", "sharp", "lib", "index.js")).href)).default;
const pngToIco = (await import(pathToFileURL(join(__dirname, "node_modules", "png-to-ico", "index.js")).href)).default;

const SIZE = 512;

// アプリアイコン SVG（インディゴ背景 + マインドマップ風）
const svg = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" rx="${Math.round(SIZE * 0.18)}" fill="#6366f1"/>

  <!-- 接続線 -->
  <line x1="195" y1="180" x2="110" y2="143" stroke="rgba(255,255,255,0.5)" stroke-width="14" stroke-linecap="round"/>
  <line x1="195" y1="256" x2="110" y2="256" stroke="rgba(255,255,255,0.5)" stroke-width="14" stroke-linecap="round"/>
  <line x1="195" y1="332" x2="110" y2="369" stroke="rgba(255,255,255,0.5)" stroke-width="14" stroke-linecap="round"/>
  <line x1="317" y1="180" x2="402" y2="143" stroke="rgba(255,255,255,0.5)" stroke-width="14" stroke-linecap="round"/>
  <line x1="317" y1="256" x2="402" y2="256" stroke="rgba(255,255,255,0.5)" stroke-width="14" stroke-linecap="round"/>
  <line x1="317" y1="332" x2="402" y2="369" stroke="rgba(255,255,255,0.5)" stroke-width="14" stroke-linecap="round"/>

  <!-- 子ノード（左） -->
  <rect x="30"  y="108" width="82" height="40" rx="12" fill="rgba(255,255,255,0.82)"/>
  <rect x="30"  y="234" width="82" height="40" rx="12" fill="rgba(255,255,255,0.82)"/>
  <rect x="30"  y="360" width="82" height="40" rx="12" fill="rgba(255,255,255,0.82)"/>

  <!-- 中央ノード -->
  <rect x="155" y="196" width="202" height="120" rx="28" fill="white"/>

  <!-- 子ノード（右） -->
  <rect x="400" y="108" width="82" height="40" rx="12" fill="rgba(255,255,255,0.82)"/>
  <rect x="400" y="234" width="82" height="40" rx="12" fill="rgba(255,255,255,0.82)"/>
  <rect x="400" y="360" width="82" height="40" rx="12" fill="rgba(255,255,255,0.82)"/>
</svg>
`;

mkdirSync(join(__dirname, "build"), { recursive: true });

// build-info.json（asar に焼き込む）
const builtAt = new Date().toISOString();
writeFileSync(
  join(__dirname, "build-info.json"),
  JSON.stringify({ builtAt }, null, 2)
);
console.log(`✅ build-info.json generated: ${builtAt}`);

const pngPath = join(__dirname, "build", "icon.png");
const icoPath = join(__dirname, "build", "icon.ico");

// PNG 生成（512×512）
await sharp(Buffer.from(svg)).png().resize(512, 512).toFile(pngPath);
console.log("✅ PNG generated: build/icon.png");

// ICO 生成（複数サイズ埋め込み）
const smallPng = await sharp(Buffer.from(svg)).png().resize(256, 256).toBuffer();
const icoBuffer = await pngToIco([smallPng]);
writeFileSync(icoPath, icoBuffer);
console.log("✅ ICO generated: build/icon.ico");
