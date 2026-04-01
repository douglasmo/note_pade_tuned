import {
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useState
} from "react";
import {
  buildAnnotationSelection,
  buildArrowAnnotation,
  buildImageSelection,
  buildPenAnnotation,
  buildShapeAnnotation,
  applyAnnotationPayload,
  extractAnnotationPayload,
  clearCanvasSelection,
  createAnnotationNode,
  createImageFigure,
  decodeClipboardImage,
  encodeClipboardImage,
  fileToDataUrl,
  getAnnotationNode,
  getAnnotationX,
  getAnnotationY,
  getEditorPoint,
  getFigureWidth,
  getFigureX,
  getFigureY,
  getImageFigure,
  getSelectionFloatingPosition,
  isImageFile
} from "../lib/editorDom";
import type {
  AnnotationType,
  ClipboardImagePayload,
  Point,
  SelectedElement,
  ToolMode
} from "../types/editor";

type UseCanvasInteractionsArgs = {
  editorRef: RefObject<HTMLDivElement | null>;
  imageResizeRef: MutableRefObject<{ id: string; startX: number; startWidth: number } | null>;
  imageDragRef: MutableRefObject<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>;
  annotationDragRef: MutableRefObject<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>;
  drawRef: MutableRefObject<{ id: string; annotationType: AnnotationType; color: string; strokeWidth: number; points: Point[] } | null>;
  clipboardImageRef: MutableRefObject<ClipboardImagePayload | null>;
  toolMode: ToolMode;
  strokeColor: string;
  strokeWidth: number;
  setStatus: (value: string) => void;
  syncEditorToState: () => void;
  refreshEditorReadingTone: () => void;
  openInlineNoteFromSelection: (noteNode: HTMLElement) => void;
  openInlineNoteFromPointer: (noteNode: HTMLElement) => void;
  openInlineScheduleFromSelection: (node: HTMLElement) => void;
  openInlineScheduleFromPointer: (node: HTMLElement) => void;
  clearNoteEditor: () => void;
  clearSelectionNote: () => void;
};

// ---------------------------------------------------------------------------
// Notepad++-style tab: real \t character, size 4 visually via CSS
// ---------------------------------------------------------------------------
const TAB_CHAR = "\t";

// ---------------------------------------------------------------------------
// Low-level DOM helpers
// ---------------------------------------------------------------------------

const getEditorText = (editor: HTMLDivElement) => {
  let text = "";
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ALL);
  let current = walker.nextNode();

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      text += current.textContent ?? "";
    } else if (current instanceof HTMLBRElement) {
      text += "\n";
    }
    current = walker.nextNode();
  }

  return text;
};

const resolveEditorPosition = (editor: HTMLDivElement, targetOffset: number) => {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ALL);
  let current = walker.nextNode();
  let remaining = targetOffset;
  let lastNode: Node | null = null;

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const textNode = current as Text;
      const length = textNode.textContent?.length ?? 0;
      lastNode = textNode;
      if (remaining <= length) {
        return { node: textNode, offset: remaining };
      }
      remaining -= length;
    } else if (current instanceof HTMLBRElement) {
      lastNode = current;
      const parent = current.parentNode;
      if (!parent) return null;
      const index = Array.prototype.indexOf.call(parent.childNodes, current);
      if (remaining === 0) return { node: parent, offset: index };
      remaining -= 1;
      if (remaining === 0) return { node: parent, offset: index + 1 };
    }
    current = walker.nextNode();
  }

  if (lastNode instanceof Text) {
    return { node: lastNode, offset: lastNode.textContent?.length ?? 0 };
  }
  if (lastNode instanceof HTMLBRElement) {
    const parent = lastNode.parentNode;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.childNodes, lastNode);
    return { node: parent, offset: index + 1 };
  }
  return { node: editor, offset: editor.childNodes.length };
};

const getSelectionTextOffsets = (editor: HTMLDivElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;

  const startRange = range.cloneRange();
  startRange.selectNodeContents(editor);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = range.cloneRange();
  endRange.selectNodeContents(editor);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
    collapsed: range.collapsed
  };
};

const replaceTextRange = (
  editor: HTMLDivElement,
  startOffset: number,
  endOffset: number,
  replacement: string,
  nextSelectionStart: number,
  nextSelectionEnd: number
) => {
  const selection = window.getSelection();
  const start = resolveEditorPosition(editor, startOffset);
  const end = resolveEditorPosition(editor, endOffset);
  if (!selection || !start || !end) return false;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  range.deleteContents();

  const lines = replacement.split("\n");
  const fragment = document.createDocumentFragment();
  lines.forEach((line, index) => {
    fragment.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });
  range.insertNode(fragment);

  const resolvedStart = resolveEditorPosition(editor, startOffset + nextSelectionStart);
  const resolvedEnd = resolveEditorPosition(editor, startOffset + nextSelectionEnd);
  if (!resolvedStart || !resolvedEnd) return false;

  const nextRange = document.createRange();
  nextRange.setStart(resolvedStart.node, resolvedStart.offset);
  nextRange.setEnd(resolvedEnd.node, resolvedEnd.offset);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
};

const insertTextAtSelection = (editor: HTMLDivElement, value: string) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return false;

  range.deleteContents();
  const textNode = document.createTextNode(value);
  range.insertNode(textNode);

  const caretRange = document.createRange();
  caretRange.setStart(textNode, textNode.textContent?.length ?? 0);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
  return true;
};

const insertLineBreakAtSelection = (editor: HTMLDivElement, indentation: string) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return false;

  range.deleteContents();
  const breakNode = document.createElement("br");
  const textNode = document.createTextNode(indentation);
  range.insertNode(textNode);
  range.insertNode(breakNode);

  const caretRange = document.createRange();
  caretRange.setStart(textNode, textNode.textContent?.length ?? 0);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
  return true;
};

// ---------------------------------------------------------------------------
// Notepad++-style indentation helpers
// ---------------------------------------------------------------------------

/**
 * Returns the leading whitespace (tabs + spaces) of the line where the caret is.
 * Works with real \t characters.
 */
const getCurrentLineIndentation = (editor: HTMLDivElement): string => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return "";

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return "";

  const textBeforeCaretRange = range.cloneRange();
  textBeforeCaretRange.selectNodeContents(editor);
  textBeforeCaretRange.setEnd(range.startContainer, range.startOffset);

  const currentLine = textBeforeCaretRange.toString().split("\n").pop() ?? "";
  // Match leading tabs and/or spaces (real whitespace, as in Notepad++)
  return currentLine.match(/^[\t ]+/u)?.[0] ?? "";
};

/**
 * Remove one level of indentation from a single line.
 * Priority: leading \t > leading 4 spaces > leading 1 space.
 */
const removeSingleIndent = (line: string): { line: string; removed: number } => {
  if (line.startsWith(TAB_CHAR)) {
    return { line: line.slice(1), removed: 1 };
  }
  if (line.startsWith("    ")) {
    return { line: line.slice(4), removed: 4 };
  }
  if (line.startsWith(" ")) {
    return { line: line.slice(1), removed: 1 };
  }
  return { line, removed: 0 };
};

/**
 * Indent or outdent every line that falls within the current selection.
 * Matches Notepad++ behaviour: Tab indents, Shift+Tab outdents, selection is
 * preserved and adjusted to reflect the new character positions.
 */
const updateSelectedLinesIndentation = (editor: HTMLDivElement, mode: "indent" | "outdent") => {
  const offsets = getSelectionTextOffsets(editor);
  if (!offsets) return false;

  const text = getEditorText(editor);
  const firstLineStart = text.lastIndexOf("\n", Math.max(0, offsets.start - 1)) + 1;
  const effectiveEndIndex = offsets.collapsed ? offsets.end : Math.max(offsets.start, offsets.end - 1);
  const lastLineEndIndex = text.indexOf("\n", effectiveEndIndex);
  const blockEnd = lastLineEndIndex === -1 ? text.length : lastLineEndIndex;
  const block = text.slice(firstLineStart, blockEnd);
  const lines = block.split("\n");

  if (mode === "indent") {
    const replacement = lines.map((line) => `${TAB_CHAR}${line}`).join("\n");
    const nextStart = offsets.start + 1; // +1 tab char per line for the first line
    const nextEnd = offsets.end + lines.length; // +1 per line for all lines
    return replaceTextRange(
      editor,
      firstLineStart,
      blockEnd,
      replacement,
      nextStart - firstLineStart,
      nextEnd - firstLineStart
    );
  }

  // outdent
  const outdented = lines.map(removeSingleIndent);
  if (!outdented.some((entry) => entry.removed > 0)) return false;

  const replacement = outdented.map((entry) => entry.line).join("\n");
  const removedFromFirstLine = outdented[0]?.removed ?? 0;
  const totalRemoved = outdented.reduce((sum, entry) => sum + entry.removed, 0);
  const nextStart = Math.max(firstLineStart, offsets.start - removedFromFirstLine);
  const nextEnd = Math.max(nextStart, offsets.end - totalRemoved);
  return replaceTextRange(
    editor,
    firstLineStart,
    blockEnd,
    replacement,
    nextStart - firstLineStart,
    nextEnd - firstLineStart
  );
};

/**
 * Smart Backspace: if the caret is at the end of a run of whitespace-only
 * content on the current line, delete back to the previous tab stop.
 * Mirrors Notepad++ "smart backspace" behaviour.
 */
const deleteTabIndentBeforeSelection = (editor: HTMLDivElement): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  if (!range.collapsed || !editor.contains(range.startContainer)) return false;

  const textBeforeCaretRange = range.cloneRange();
  textBeforeCaretRange.selectNodeContents(editor);
  textBeforeCaretRange.setEnd(range.startContainer, range.startOffset);

  const textBeforeCaret = textBeforeCaretRange.toString();
  const currentLine = textBeforeCaret.split("\n").pop() ?? "";

  // Only act when the line so far is pure whitespace (tabs / spaces)
  if (!/^[\t ]+$/u.test(currentLine)) return false;

  // Determine how many characters to remove:
  // - trailing \t → remove 1 character
  // - trailing spaces → remove up to 4 (or to the previous tab stop)
  let toRemove = 0;
  if (currentLine.endsWith(TAB_CHAR)) {
    toRemove = 1;
  } else {
    // Count trailing spaces and snap back to nearest tab-stop (multiple of 4)
    const trailingSpaces = currentLine.match(/ +$/u)?.[0].length ?? 0;
    const col = currentLine.length; // current column (0-based after)
    const prevTabStop = col - ((col % 4) || 4);
    toRemove = col - Math.max(0, prevTabStop);
    if (toRemove === 0) toRemove = trailingSpaces; // fallback
  }

  if (toRemove === 0) return false;

  const caretOffset = textBeforeCaret.length;
  return replaceTextRange(editor, caretOffset - toRemove, caretOffset, "", 0, 0);
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCanvasInteractions({
  editorRef,
  imageResizeRef,
  imageDragRef,
  annotationDragRef,
  drawRef,
  clipboardImageRef,
  toolMode,
  strokeColor,
  strokeWidth,
  setStatus,
  syncEditorToState,
  refreshEditorReadingTone,
  openInlineNoteFromSelection,
  openInlineNoteFromPointer,
  openInlineScheduleFromSelection,
  openInlineScheduleFromPointer,
  clearNoteEditor,
  clearSelectionNote
}: UseCanvasInteractionsArgs) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

  const selectElement = (element: SelectedElement | null) => {
    const editor = editorRef.current;
    if (!editor) return;

    clearCanvasSelection(editor);
    if (!element) {
      setSelectedElement(null);
      return;
    }

    if (element.kind === "image") {
      getImageFigure(editor, element.id)?.classList.add("editor-image-selected");
    } else {
      getAnnotationNode(editor, element.id)?.classList.add("editor-annotation-selected");
    }

    setSelectedElement(element);
  };

  const getSelectedImagePayload = (): ClipboardImagePayload | null => {
    const editor = editorRef.current;
    if (!editor || selectedElement?.kind !== "image") return null;

    const figure = getImageFigure(editor, selectedElement.id);
    const image = figure?.querySelector("img");
    const src = image?.getAttribute("src") ?? "";
    if (!figure || !src) return null;

    return {
      src,
      width: getFigureWidth(figure),
      x: getFigureX(figure),
      y: getFigureY(figure)
    };
  };

  const removeSelectedElement = () => {
    const editor = editorRef.current;
    if (!editor || !selectedElement) return;

    if (selectedElement.kind === "image") {
      getImageFigure(editor, selectedElement.id)?.remove();
      setStatus("Imagem removida");
    } else {
      getAnnotationNode(editor, selectedElement.id)?.remove();
      setStatus(selectedElement.annotationType === "arrow" ? "Seta removida" : "Desenho removido");
    }

    selectElement(null);
    clearNoteEditor();
    syncEditorToState();
    editor.focus();
  };

  const copySelectedImage = async (cut: boolean) => {
    const payload = getSelectedImagePayload();
    if (!payload) return;

    clipboardImageRef.current = payload;
    const token = encodeClipboardImage(payload);

    try {
      await navigator.clipboard.writeText(token);
    } catch {
      // Fallback em memória.
    }

    if (cut) {
      removeSelectedElement();
      setStatus("Imagem recortada");
      return;
    }

    setStatus("Imagem copiada");
  };

  const handleEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const target = event.target as HTMLElement;
    const figure = target.closest("figure.editor-image") as HTMLElement | null;
    const annotation = target.closest("div.editor-annotation") as HTMLElement | null;
    const inlineNote = target.closest("span.inline-note") as HTMLElement | null;
    const inlineSchedule = target.closest("span.inline-schedule") as HTMLElement | null;

    if (inlineNote?.dataset.noteId) {
      openInlineNoteFromSelection(inlineNote);
      return;
    }

    if (inlineSchedule?.dataset.scheduleId) {
      openInlineScheduleFromSelection(inlineSchedule);
      return;
    }

    if (figure?.dataset.imageId) {
      selectElement(buildImageSelection(figure));
      return;
    }

    if (annotation?.dataset.annotationId) {
      selectElement(buildAnnotationSelection(annotation));
      return;
    }

    selectElement(null);
    clearNoteEditor();
  };

  const handleEditorDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    if (toolMode !== "select") return;

    const target = event.target as HTMLElement;
    const annotation = target.closest("div.editor-annotation") as HTMLElement | null;

    if (annotation?.dataset.annotationType === "zone") {
      const currentPayload = extractAnnotationPayload(annotation);
      const currentTitle = currentPayload.geometry.text || "Quadro";
      const newText = prompt("Qual o titulo deste Kanban?", currentTitle);
      if (newText !== null && newText.trim() !== "") {
        currentPayload.geometry.text = newText;
        applyAnnotationPayload(annotation, currentPayload);
        syncEditorToState();
      }
    }
  };

  const handleEditorPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const target = event.target as HTMLElement;
    const figure = target.closest("figure.editor-image") as HTMLElement | null;
    const annotation = target.closest("div.editor-annotation") as HTMLElement | null;
    const inlineNote = target.closest("span.inline-note") as HTMLElement | null;
    const inlineSchedule = target.closest("span.inline-schedule") as HTMLElement | null;

    if (inlineNote?.dataset.noteId) {
      event.preventDefault();
      openInlineNoteFromPointer(inlineNote);
      return;
    }

    if (inlineSchedule?.dataset.scheduleId) {
      event.preventDefault();
      openInlineScheduleFromPointer(inlineSchedule);
      return;
    }

    if (figure?.dataset.imageId) {
      selectElement(buildImageSelection(figure));

      if (target.classList.contains("image-resize-handle")) {
        event.preventDefault();
        event.stopPropagation();
        imageResizeRef.current = {
          id: figure.dataset.imageId,
          startX: event.clientX,
          startWidth: getFigureWidth(figure)
        };
        return;
      }

      if (target.tagName === "IMG") {
        event.preventDefault();
        const point = getEditorPoint(editor, event.clientX, event.clientY);
        imageDragRef.current = {
          id: figure.dataset.imageId,
          startX: point.x,
          startY: point.y,
          originX: getFigureX(figure),
          originY: getFigureY(figure)
        };
      }

      return;
    }

    if (annotation?.dataset.annotationId) {
      event.preventDefault();
      selectElement(buildAnnotationSelection(annotation));
      const point = getEditorPoint(editor, event.clientX, event.clientY);
      annotationDragRef.current = {
        id: annotation.dataset.annotationId,
        startX: point.x,
        startY: point.y,
        originX: getAnnotationX(annotation),
        originY: getAnnotationY(annotation)
      };
      return;
    }

    selectElement(null);
    clearNoteEditor();

    if (toolMode === "select") return;

    event.preventDefault();
    const start = getEditorPoint(editor, event.clientX, event.clientY);
    const id = crypto.randomUUID();
    const initialPoints = [start];
    const payload =
      toolMode === "pen"
        ? buildPenAnnotation(id, strokeColor, initialPoints, strokeWidth)
        : toolMode === "arrow"
          ? buildArrowAnnotation(id, strokeColor, start, start, strokeWidth)
          : buildShapeAnnotation(id, toolMode, strokeColor, start, start, strokeWidth);

    const node = createAnnotationNode(payload);
    editor.appendChild(node);
    selectElement(buildAnnotationSelection(node));
    drawRef.current = {
      id,
      annotationType: toolMode,
      color: strokeColor,
      strokeWidth,
      points: initialPoints
    };
    syncEditorToState();
  };

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // -----------------------------------------------------------------------
    // Tab / Shift+Tab — Notepad++ style
    // -----------------------------------------------------------------------
    if (event.key === "Tab") {
      event.preventDefault();

      const offsets = getSelectionTextOffsets(event.currentTarget);
      const isMultiLine = (() => {
        if (!offsets || offsets.collapsed) return false;
        const text = getEditorText(event.currentTarget);
        return text.slice(offsets.start, offsets.end).includes("\n");
      })();

      let changed = false;

      if (event.shiftKey) {
        // Shift+Tab always outdents (single caret → removes indent on current line too)
        changed = updateSelectedLinesIndentation(event.currentTarget, "outdent");
      } else if (isMultiLine) {
        // Multi-line selection → indent all lines
        changed = updateSelectedLinesIndentation(event.currentTarget, "indent");
      } else {
        // Single caret or single-line selection → insert a real tab character
        changed = insertTextAtSelection(event.currentTarget, TAB_CHAR);
      }

      if (changed) {
        syncEditorToState();
        refreshEditorReadingTone();
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Space — insert non-breaking space to avoid browser collapsing
    // -----------------------------------------------------------------------
    if (event.key === " ") {
      event.preventDefault();
      if (insertTextAtSelection(event.currentTarget, " ")) {
        syncEditorToState();
        refreshEditorReadingTone();
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Enter — auto-indent: copy leading whitespace from current line
    // -----------------------------------------------------------------------
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Preserve real \t characters as-is (no conversion like the old code did)
      const indentation = getCurrentLineIndentation(event.currentTarget);

      if (insertLineBreakAtSelection(event.currentTarget, indentation)) {
        syncEditorToState();
        refreshEditorReadingTone();
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Backspace — smart backspace (delete whole indent unit)
    // -----------------------------------------------------------------------
    if (event.key === "Backspace") {
      // Try smart backspace first; fall through to default if not applicable
      if (deleteTabIndentBeforeSelection(event.currentTarget)) {
        event.preventDefault();
        syncEditorToState();
        refreshEditorReadingTone();
        return;
      }

      // Delete selected annotation/image element
      if (selectedElement) {
        event.preventDefault();
        removeSelectedElement();
      }

      return;
    }

    // -----------------------------------------------------------------------
    // Delete — remove selected element
    // -----------------------------------------------------------------------
    if (event.key === "Delete" && selectedElement) {
      event.preventDefault();
      removeSelectedElement();
    }
  };

  const handleInput = () => {
    syncEditorToState();
    refreshEditorReadingTone();
  };

  const insertImageAtCursor = (src: string) => {
    if (!editorRef.current) return;

    const figure = createImageFigure(src, getSelectionFloatingPosition(editorRef.current));
    editorRef.current.appendChild(figure);
    selectElement(buildImageSelection(figure));
    syncEditorToState();
    setStatus("Imagem colada");
  };

  const insertClipboardImageAtCursor = (payload: ClipboardImagePayload) => {
    if (!editorRef.current) return;

    const figure = createImageFigure(payload.src, payload);
    editorRef.current.appendChild(figure);
    selectElement(buildImageSelection(figure));
    syncEditorToState();
    setStatus("Imagem colada");
  };

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    const clipboardItems = Array.from(event.clipboardData.items);
    const imageItem = clipboardItems.find(isImageFile);

    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      insertImageAtCursor(await fileToDataUrl(file));
      return;
    }

    const text = event.clipboardData.getData("text/plain");
    const clipboardImage = decodeClipboardImage(text) ?? clipboardImageRef.current;
    if (!clipboardImage) return;

    event.preventDefault();
    insertClipboardImageAtCursor(clipboardImage);
  };

  return {
    selectedElement,
    setSelectedElement,
    selectElement,
    removeSelectedElement,
    copySelectedImage,
    handleEditorClick,
    handleEditorDoubleClick,
    handleEditorPointerDown,
    handleEditorKeyDown,
    handleInput,
    handlePaste
  };
}