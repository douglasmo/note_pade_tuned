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
  clearNoteEditor: () => void;
  clearSelectionNote: () => void;
};

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
  clearNoteEditor,
  clearSelectionNote
}: UseCanvasInteractionsArgs) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

  const selectElement = (element: SelectedElement | null) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

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
    if (!editor || selectedElement?.kind !== "image") {
      return null;
    }

    const figure = getImageFigure(editor, selectedElement.id);
    const image = figure?.querySelector("img");
    const src = image?.getAttribute("src") ?? "";
    if (!figure || !src) {
      return null;
    }

    return {
      src,
      width: getFigureWidth(figure),
      x: getFigureX(figure),
      y: getFigureY(figure)
    };
  };

  const removeSelectedElement = () => {
    const editor = editorRef.current;
    if (!editor || !selectedElement) {
      return;
    }

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
    if (!payload) {
      return;
    }

    clipboardImageRef.current = payload;
    const token = encodeClipboardImage(payload);

    try {
      await navigator.clipboard.writeText(token);
    } catch {
      // Fallback em memoria.
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
    if (!editor) {
      return;
    }

    const target = event.target as HTMLElement;
    const figure = target.closest("figure.editor-image") as HTMLElement | null;
    const annotation = target.closest("div.editor-annotation") as HTMLElement | null;
    const inlineNote = target.closest("span.inline-note") as HTMLElement | null;

    if (inlineNote?.dataset.noteId) {
      openInlineNoteFromSelection(inlineNote);
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

  const handleEditorPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const target = event.target as HTMLElement;
    const figure = target.closest("figure.editor-image") as HTMLElement | null;
    const annotation = target.closest("div.editor-annotation") as HTMLElement | null;
    const inlineNote = target.closest("span.inline-note") as HTMLElement | null;

    if (inlineNote?.dataset.noteId) {
      event.preventDefault();
      openInlineNoteFromPointer(inlineNote);
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

    if (toolMode === "select") {
      return;
    }

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
    if (event.key === "Tab") {
      event.preventDefault();
      document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
      syncEditorToState();
      return;
    }

    if (selectedElement && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      removeSelectedElement();
    }
  };

  const handleInput = () => {
    syncEditorToState();
    refreshEditorReadingTone();
  };

  const insertImageAtCursor = (src: string) => {
    if (!editorRef.current) {
      return;
    }

    const figure = createImageFigure(src, getSelectionFloatingPosition(editorRef.current));
    editorRef.current.appendChild(figure);
    selectElement(buildImageSelection(figure));
    syncEditorToState();
    setStatus("Imagem colada");
  };

  const insertClipboardImageAtCursor = (payload: ClipboardImagePayload) => {
    if (!editorRef.current) {
      return;
    }

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
      if (!file) {
        return;
      }

      insertImageAtCursor(await fileToDataUrl(file));
      return;
    }

    const text = event.clipboardData.getData("text/plain");
    const clipboardImage = decodeClipboardImage(text) ?? clipboardImageRef.current;
    if (!clipboardImage) {
      return;
    }

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
    handleEditorPointerDown,
    handleEditorKeyDown,
    handleInput,
    handlePaste
  };
}