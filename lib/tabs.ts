export interface Tab { id: string; title: string; }

const STORAGE_KEY = "fmm-tabs";

export function loadTabs(): Tab[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

export function saveTabs(tabs: Tab[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

/** タブを開く（既存なら title だけ更新）。更新後の配列を返す */
export function openTab(id: string, title: string): Tab[] {
  const tabs = loadTabs();
  const i = tabs.findIndex(t => t.id === id);
  if (i >= 0) { tabs[i].title = title; }
  else { tabs.push({ id, title }); }
  saveTabs(tabs);
  return tabs;
}

/** タブを閉じる。残りの配列を返す */
export function closeTab(id: string): Tab[] {
  const tabs = loadTabs().filter(t => t.id !== id);
  saveTabs(tabs);
  return tabs;
}

/** タブのタイトルだけ更新（変化がなければ何もしない） */
export function updateTabTitle(id: string, title: string): void {
  const tabs = loadTabs();
  const t = tabs.find(t => t.id === id);
  if (t && t.title !== title) { t.title = title; saveTabs(tabs); }
}
