import { invoke } from "@tauri-apps/api/core";
import { useState, type MutableRefObject, type RefObject } from "react";
import { getQuickSearchUrl, type QuickAction } from "../lib/quickSearch";
import type { NoteEditorState, SelectionNoteState, SchedulePopoverState, ExistingScheduleState } from "../types/editor";

type UseSelectionNotesArgs = {
  editorRef: RefObject<HTMLDivElement | null>;
  noteRangeRef: MutableRefObject<Range | null>;
  setStatus: (value: string) => void;
  syncEditorToState: () => void;
  refreshEditorReadingTone: () => void;
  getOverlayPoint: (editor: HTMLElement, rect: DOMRect) => { x: number; y: number };
};

export function useSelectionNotes({
  editorRef,
  noteRangeRef,
  setStatus,
  syncEditorToState,
  refreshEditorReadingTone,
  getOverlayPoint
}: UseSelectionNotesArgs) {
  const [selectionNote, setSelectionNote] = useState<SelectionNoteState | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null);
  const [schedulePopover, setSchedulePopover] = useState<SchedulePopoverState | null>(null);
  const [existingSchedule, setExistingSchedule] = useState<ExistingScheduleState | null>(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);

  const openExistingInlineNote = (noteNode: HTMLElement, position: { x: number; y: number }) => {
    setSelectionNote(null);
    setNoteEditor({
      id: noteNode.dataset.noteId ?? null,
      text: decodeURIComponent(noteNode.dataset.noteContent ?? ""),
      x: position.x,
      y: position.y,
      targetText: noteNode.textContent ?? ""
    });
  };

  const openExistingInlineScheduleState = (scheduleNode: HTMLElement, position: { x: number; y: number }) => {
    setSelectionNote(null);
    setExistingSchedule({
      id: scheduleNode.dataset.scheduleId ?? "",
      text: scheduleNode.textContent ?? "",
      x: position.x,
      y: position.y,
      time: Number(scheduleNode.dataset.scheduleTime ?? 0)
    });
  };

  const openNoteEditorForSelection = () => {
    const range = noteRangeRef.current;
    if (!range) {
      return;
    }

    setNoteEditor({
      id: null,
      text: "",
      x: selectionNote?.x ?? 120,
      y: selectionNote?.y ?? 120,
      targetText: range.toString().trim()
    });
  };

  const unwrapInlineNote = (noteNode: HTMLElement) => {
    const parent = noteNode.parentNode;
    while (noteNode.firstChild) {
      parent?.insertBefore(noteNode.firstChild, noteNode);
    }
    parent?.removeChild(noteNode);
  };

  const saveInlineNote = () => {
    const editor = editorRef.current;
    if (!editor || !noteEditor) {
      return;
    }

    const noteText = noteEditor.text.trim();
    if (!noteText) {
      setStatus("Digite uma nota antes de salvar");
      return;
    }

    if (noteEditor.id) {
      const noteNode = editor.querySelector(`span.inline-note[data-note-id="${noteEditor.id}"]`) as HTMLElement | null;
      if (!noteNode) {
        return;
      }

      noteNode.dataset.noteContent = encodeURIComponent(noteText);
      setStatus("Nota atualizada");
    } else {
      const range = noteRangeRef.current;
      if (!range || range.collapsed) {
        return;
      }

      const noteNode = document.createElement("span");
      noteNode.className = "inline-note";
      noteNode.dataset.noteId = crypto.randomUUID();
      noteNode.dataset.noteContent = encodeURIComponent(noteText);
      noteNode.contentEditable = "false";
      noteNode.appendChild(range.extractContents());
      range.insertNode(noteNode);
      setStatus("Nota adicionada");
    }

    setSelectionNote(null);
    setNoteEditor(null);
    noteRangeRef.current = null;
    syncEditorToState();
    refreshEditorReadingTone();
  };

  const removeInlineNote = () => {
    const editor = editorRef.current;
    if (!editor || !noteEditor?.id) {
      return;
    }

    const noteNode = editor.querySelector(`span.inline-note[data-note-id="${noteEditor.id}"]`) as HTMLElement | null;
    if (!noteNode) {
      return;
    }

    unwrapInlineNote(noteNode);
    setNoteEditor(null);
    setSelectionNote(null);
    syncEditorToState();
    refreshEditorReadingTone();
    setStatus("Nota removida");
  };

  const saveInlineSchedule = (text: string, triggerAt: number, id: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const range = noteRangeRef.current;
    if (range && !range.collapsed) {
      const scheduleNode = document.createElement("span");
      scheduleNode.className = "inline-schedule";
      scheduleNode.dataset.scheduleId = id;
      scheduleNode.dataset.scheduleTime = String(triggerAt);
      scheduleNode.contentEditable = "false";
      scheduleNode.style.textDecoration = "underline";
      scheduleNode.style.textDecorationStyle = "dashed";
      scheduleNode.style.textDecorationColor = "#4a90e2";
      scheduleNode.style.cursor = "pointer";
      scheduleNode.appendChild(range.extractContents());
      range.insertNode(scheduleNode);
    }
    
    setSelectionNote(null);
    setSchedulePopover(null);
    noteRangeRef.current = null;
    syncEditorToState();
    refreshEditorReadingTone();
  };

  const removeInlineSchedule = (id: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const node = editor.querySelector(`span.inline-schedule[data-schedule-id="${id}"]`) as HTMLElement | null;
    if (node) {
      unwrapInlineNote(node);
      syncEditorToState();
      refreshEditorReadingTone();
    }
    setExistingSchedule(null);
    setStatus("Agendamento removido");
  };

  const openQuickSearch = async (action: Exclude<QuickAction, "note" | "schedule" | "copy">, query: string) => {
    const url = getQuickSearchUrl(action, query);

    try {
      await invoke("open_external_url", { url });
      setStatus(`Abrindo pesquisa para ${query}`);
    } catch {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
        setStatus(`Abrindo pesquisa para ${query}`);
      } catch {
        setStatus("Falha ao abrir pesquisa externa");
      }
    }
  };

  const copySelectionText = async () => {
    if (!selectionNote?.text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectionNote.text);
      setStatus(`Texto copiado: ${selectionNote.text}`);
    } catch {
      setStatus("Falha ao copiar texto");
    }
  };

  const runQuickAction = async (action: QuickAction) => {
    if (!selectionNote) {
      return;
    }
    const term = selectionNote.text.trim();
    if (!term) {
      return;
    }

    switch (action) {
      case "note":
        openNoteEditorForSelection();
        break;
      case "schedule":
        setSchedulePopover({ 
          x: selectionNote.x, 
          y: selectionNote.y, 
          text: term 
        });
        setSelectionNote(null);
        break;
      case "google":
      case "wikipedia":
      case "translate":
      case "chatgpt":
      case "youtube":
      case "definition":
      case "synonyms":
      case "maps":
        await openQuickSearch(action, term);
        break;
      case "copy":
        await copySelectionText();
        break;
    }
  };

  const updateSelectionNoteState = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionNote(null);
      noteRangeRef.current = null;
      return;
    }

    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const container = common.nodeType === Node.ELEMENT_NODE ? (common as Element) : common.parentElement;
    if (!container || !editor.contains(container) || container.closest(".inline-note")) {
      setSelectionNote(null);
      noteRangeRef.current = null;
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectionNote(null);
      noteRangeRef.current = null;
      return;
    }

    const rect = range.getBoundingClientRect();
    const point = getOverlayPoint(editor, rect);
    noteRangeRef.current = range.cloneRange();
    setSelectionNote({ x: point.x, y: point.y - 12, text });
  };

  const openInlineNoteFromSelection = (noteNode: HTMLElement) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const rect = noteNode.getBoundingClientRect();
    const point = getOverlayPoint(editor, rect);
    openExistingInlineNote(noteNode, { x: point.x, y: point.y + rect.height + 10 });
  };

  const openInlineNoteFromPointer = (noteNode: HTMLElement) => {
    const rect = noteNode.getBoundingClientRect();
    openExistingInlineNote(noteNode, { x: rect.left + rect.width / 2, y: rect.bottom + 10 });
  };

  const openInlineScheduleFromSelection = (node: HTMLElement) => {
    const editor = editorRef.current;
    if (!editor) return;
    const rect = node.getBoundingClientRect();
    const point = getOverlayPoint(editor, rect);
    openExistingInlineScheduleState(node, { x: point.x, y: point.y + rect.height + 10 });
  };

  const openInlineScheduleFromPointer = (node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    openExistingInlineScheduleState(node, { x: rect.left + rect.width / 2, y: rect.bottom + 10 });
  };

  return {
    selectionNote,
    noteEditor,
    schedulePopover,
    existingSchedule,
    searchMenuOpen,
    setSelectionNote,
    setNoteEditor,
    setSchedulePopover,
    setExistingSchedule,
    setSearchMenuOpen,
    saveInlineNote,
    removeInlineNote,
    saveInlineSchedule,
    removeInlineSchedule,
    runQuickAction,
    updateSelectionNoteState,
    openInlineNoteFromSelection,
    openInlineNoteFromPointer,
    openInlineScheduleFromSelection,
    openInlineScheduleFromPointer
  };
}