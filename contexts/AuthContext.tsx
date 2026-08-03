"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Android（Capacitor）: ハードウェア戻るボタンでWeb履歴を戻る／履歴が無ければ終了
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) window.history.back();
        else App.exitApp();
      }).then(h => { remove = () => h.remove(); });
    });
    return () => remove?.();
  }, []);

  const handleSignIn = async () => {
    // Android WebView では Google のポップアップ/リダイレクトが使えない（Google側で拒否）。
    // ネイティブのGoogleサインインで idToken を取り、Firebase JS SDK に渡す。
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error("Googleログインに失敗しました");
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      return;
    }
    await signInWithPopup(auth, googleProvider);
  };

  const handleSignOut = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        await FirebaseAuthentication.signOut();
      } catch { /* noop */ }
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn: handleSignIn, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
