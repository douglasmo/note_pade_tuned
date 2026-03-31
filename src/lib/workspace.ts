import type { DocumentTab, PersistedWorkspace } from "../types/editor";

export const STORAGE_KEY = "notepade-tuned.workspace.v1";
export const EMPTY_DOCUMENT_HTML = "<p><br /></p>";

export const createTab = (overrides: Partial<DocumentTab> = {}): DocumentTab => ({
  id: crypto.randomUUID(),
  title: "Nova nota",
  filePath: null,
  html: EMPTY_DOCUMENT_HTML,
  isDirty: false,
  lineHeight: 1.5,
  ...overrides
});

export const readWorkspace = (): PersistedWorkspace | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedWorkspace;
    if (!parsed.tabs?.length) {
      return null;
    }

    return {
      activeTabId: parsed.activeTabId,
      tabs: parsed.tabs.map((tab) => ({
        ...tab,
        lineHeight: tab.lineHeight ?? 1.5
      }))
    };
  } catch {
    return null;
  }
};

export const renderTabStatus = (tab: DocumentTab | null) => {
  if (!tab) {
    return "Nenhuma aba ativa";
  }

  if (tab.filePath) {
    return tab.isDirty ? "Edicoes pendentes" : "Tudo salvo no arquivo";
  }

  return tab.isDirty ? "Documento em memoria" : "Nova aba pronta";
};