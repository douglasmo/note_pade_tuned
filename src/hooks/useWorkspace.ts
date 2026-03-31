import { useEffect, useMemo, useState, type MutableRefObject, type RefObject } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { deserializeDocument, serializeEditorHtml } from "../lib/documentFormat";
import {
  deriveTitle,
  getFileName,
  normalizeEditorHtml,
  sanitizeFileName,
  stripReadingToneMarkup,
  toErrorMessage
} from "../lib/editorDom";
import { STORAGE_KEY, createTab, readWorkspace } from "../lib/workspace";
import type { DocumentTab, PersistedWorkspace } from "../types/editor";

type UseWorkspaceArgs = {
  editorRef: RefObject<HTMLDivElement | null>;
  activeTabIdRef: MutableRefObject<string>;
  setStatus: (value: string) => void;
};

export function useWorkspace({ editorRef, activeTabIdRef, setStatus }: UseWorkspaceArgs) {
  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  useEffect(() => {
    const workspace = readWorkspace();
    const initialTabs = workspace?.tabs?.length ? workspace.tabs : [createTab()];
    const initialActiveId = workspace?.activeTabId ?? initialTabs[0].id;

    setTabs(initialTabs);
    setActiveTabId(initialActiveId);
    setStatus(workspace ? "Abas restauradas da memoria local" : "Documento novo");
  }, [setStatus]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId, activeTabIdRef]);

  useEffect(() => {
    if (!tabs.length || !activeTabId) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeTabId, tabs } satisfies PersistedWorkspace));
  }, [tabs, activeTabId]);

  const updateActiveTab = (updater: (tab: DocumentTab) => DocumentTab) => {
    const currentActiveId = activeTabIdRef.current;
    if (!currentActiveId) {
      return;
    }

    setTabs((currentTabs) => currentTabs.map((tab) => (tab.id === currentActiveId ? updater(tab) : tab)));
  };

  const syncEditorToState = () => {
    if (!editorRef.current || !activeTabIdRef.current) {
      return;
    }

    const html = normalizeEditorHtml(stripReadingToneMarkup(editorRef.current.innerHTML));
    let changed = false;

    updateActiveTab((tab) => {
      changed = tab.html !== html;
      if (!changed) {
        return tab;
      }

      return {
        ...tab,
        html,
        isDirty: true,
        title: deriveTitle(tab.filePath, html)
      };
    });

    if (changed) {
      setStatus("Alteracoes locais salvas em memoria");
    }
  };

  const createNewTab = async () => {
    syncEditorToState();
    const newTab = createTab();
    setTabs((currentTabs) => [...currentTabs, newTab]);
    setActiveTabId(newTab.id);
    setStatus("Nova aba criada");
  };

  const switchTab = (tabId: string) => {
    syncEditorToState();
    setActiveTabId(tabId);
    const nextTab = tabs.find((tab) => tab.id === tabId);
    if (nextTab) {
      setStatus(nextTab.filePath ? `Editando ${nextTab.title}` : "Documento em memoria");
    }
  };

  const closeTab = (tabId: string) => {
    syncEditorToState();

    setTabs((currentTabs) => {
      const filteredTabs = currentTabs.filter((tab) => tab.id !== tabId);
      if (!filteredTabs.length) {
        const fallback = createTab();
        setActiveTabId(fallback.id);
        return [fallback];
      }

      if (activeTabIdRef.current === tabId) {
        const currentIndex = currentTabs.findIndex((tab) => tab.id === tabId);
        const nextTab = filteredTabs[Math.max(0, currentIndex - 1)] ?? filteredTabs[0];
        setActiveTabId(nextTab.id);
      }

      return filteredTabs;
    });

    setStatus("Aba fechada");
  };

  const updateLineHeight = (lineHeight: number) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.style.lineHeight = String(lineHeight);
    updateActiveTab((tab) => ({ ...tab, lineHeight, isDirty: true }));
    setStatus(`Espacamento ajustado para ${lineHeight.toFixed(1)}`);
  };

  const openDocument = async () => {
    try {
      syncEditorToState();
      const path = await open({
        title: "Abrir nota",
        multiple: false,
        filters: [{ name: "Notas de texto", extensions: ["txt"] }]
      });

      if (!path || Array.isArray(path)) {
        return;
      }

      const content = await readTextFile(path);
      const nextTab = createTab({
        title: getFileName(path),
        filePath: path,
        html: deserializeDocument(content),
        isDirty: false
      });

      setTabs((currentTabs) => [...currentTabs, nextTab]);
      setActiveTabId(nextTab.id);
      setStatus(`Arquivo aberto: ${path}`);
    } catch (error) {
      setStatus(`Falha ao abrir arquivo: ${toErrorMessage(error)}`);
    }
  };

  const persistTabToFile = async (tab: DocumentTab, saveAs: boolean) => {
    const sourceHtml =
      tab.id === activeTabIdRef.current && editorRef.current
        ? normalizeEditorHtml(editorRef.current.innerHTML)
        : tab.html;

    const targetPath =
      !saveAs && tab.filePath
        ? tab.filePath
        : await save({
            title: "Salvar nota",
            defaultPath: tab.filePath ?? `${sanitizeFileName(tab.title) || "nota"}.txt`,
            filters: [{ name: "Notas de texto", extensions: ["txt"] }]
          });

    if (!targetPath) {
      return;
    }

    await writeTextFile(targetPath, serializeEditorHtml(sourceHtml));
    setTabs((currentTabs) =>
      currentTabs.map((currentTab) =>
        currentTab.id === tab.id
          ? { ...currentTab, html: sourceHtml, filePath: targetPath, title: getFileName(targetPath), isDirty: false }
          : currentTab
      )
    );
    setStatus(`Salvo em ${targetPath}`);
  };

  const saveDocument = async () => {
    if (activeTab) {
      try {
        await persistTabToFile(activeTab, false);
      } catch (error) {
        setStatus(`Falha ao salvar: ${toErrorMessage(error)}`);
      }
    }
  };

  const saveDocumentAs = async () => {
    if (activeTab) {
      try {
        await persistTabToFile(activeTab, true);
      } catch (error) {
        setStatus(`Falha ao salvar como: ${toErrorMessage(error)}`);
      }
    }
  };

  return {
    tabs,
    activeTabId,
    activeTab,
    syncEditorToState,
    createNewTab,
    switchTab,
    closeTab,
    updateLineHeight,
    openDocument,
    saveDocument,
    saveDocumentAs,
    setTabs,
    setActiveTabId
  };
}