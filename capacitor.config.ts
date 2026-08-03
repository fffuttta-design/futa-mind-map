import type { CapacitorConfig } from "@capacitor/cli";

/**
 * FutaMindMap Android（Capacitor）
 * 本番Web(Vercel)を読み込む薄いシェル。中身は常に最新。
 * Googleログインは Android WebView ではポップアップ不可のため、
 * @capacitor-firebase/authentication のネイティブGoogleサインインを使い、
 * 取得した idToken で Firebase JS SDK に signInWithCredential する
 *（skipNativeAuth: true = ネイティブ側では署名せずJS側で処理）。
 */
const config: CapacitorConfig = {
  appId: "com.futa.mindmap",
  appName: "FutaMindMap",
  webDir: "www",
  server: {
    url: "https://futa-mind-map.vercel.app",
    cleartext: false,
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
};

export default config;
