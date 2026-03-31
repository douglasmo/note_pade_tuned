import {
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { MarkdownPanel, NotePopover, SelectionActions } from "./components/EditorOverlays";
import { TopRibbon } from "./components/TopRibbon";
import { useCanvasInteractions } from "./hooks/useCanvasInteractions";
import { useWorkspace } from "./hooks/useWorkspace";
import { useSelectionNotes } from "./hooks/useSelectionNotes";
import {
  COLOR_PALETTE,
  MIN_IMAGE_WIDTH,
  applyAnnotationPayload,
  applyAnnotationPosition,
  applyImageLayout,
  applyReadingTone,
  buildAnnotationSelection,
  buildArrowAnnotation,
  buildImageSelection,
  buildPenAnnotation,
  buildShapeAnnotation,
  clearCanvasSelection,
  createAnnotationNode,
  createImageFigure,
  decodeClipboardImage,
  deriveTitle,
  fileToDataUrl,
  getAnnotationNode,
  getAnnotationX,
  getAnnotationY,
  getCaretCharacterOffsetWithin,
  getEditorPoint,
  getFigureWidth,
  getFileName,
  getFigureX,
  getFigureY,
  getImageFigure,
  getOverlayPoint,
  getSelectionFloatingPosition,
  isImageFile,
  normalizeEditorHtml,
  placeCaretAtEnd,
  restoreCaretCharacterOffset,
  sanitizeFileName,
  stripReadingToneMarkup,
  toErrorMessage,
  encodeClipboardImage
} from "./lib/editorDom";
import { createMarkdownPreview } from "./lib/documentFormat";
import { renderTabStatus } from "./lib/workspace";
import type {
  AnnotationType,
  ClipboardImagePayload,
  DocumentTab,
  PersistedWorkspace,
  Point,
  SelectedElement,
  ToolMode
} from "./types/editor";

const LINE_HEIGHT_OPTIONS = [1.2, 1.5, 1.8];
const STROKE_WIDTH_OPTIONS = [2, 4, 8];
const MENU_ITEMS = ["Arquivo", "Editar", "Inserir", "Formatar", "Exibir", "Ferramentas", "Janela"];

function App() {
  const editorLayoutRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const activeTabIdRef = useRef("");
  const imageResizeRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const imageDragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const annotationDragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const drawRef = useRef<{ id: string; annotationType: AnnotationType; color: string; strokeWidth: number; points: Point[] } | null>(null);
  const clipboardImageRef = useRef<ClipboardImagePayload | null>(null);
  const noteRangeRef = useRef<Range | null>(null);
  const [status, setStatus] = useState("Preparando editor");
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [strokeColor, setStrokeColor] = useState(COLOR_PALETTE[0]);
  const [strokeWidth, setStrokeWidth] = useState(4);

  const {
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
    saveDocumentAs
  } = useWorkspace({
    editorRef,
    activeTabIdRef,
    setStatus
  });

  const {
    selectionNote,
    noteEditor,
    searchMenuOpen,
    setSelectionNote,
    setNoteEditor,
    setSearchMenuOpen,
    saveInlineNote,
    removeInlineNote,
    runQuickAction,
    updateSelectionNoteState,
    openInlineNoteFromSelection,
    openInlineNoteFromPointer
  } = useSelectionNotes({
    editorRef,
    noteRangeRef,
    setStatus,
    syncEditorToState,
    refreshEditorReadingTone,
    getOverlayPoint
  });

  const {
    selectedElement,
    selectElement,
    removeSelectedElement,
    copySelectedImage,
    handleEditorClick,
    handleEditorPointerDown,
    handleEditorKeyDown,
    handleInput,
    handlePaste
  } = useCanvasInteractions({
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
    clearNoteEditor: () => setNoteEditor(null),
    clearSelectionNote: () => setSelectionNote(null)
  });


  const applyEditorCommand = (
    command: "bold" | "italic" | "insertUnorderedList" | "formatBlock" | "insertHTML",
    value?: string
  ) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorToState();
  };

  const insertCodeInline = () => applyEditorCommand("insertHTML", "<code>codigo</code>");

  function refreshEditorReadingTone() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const caretOffset = getCaretCharacterOffsetWithin(editor);
    const rawHtml = normalizeEditorHtml(stripReadingToneMarkup(editor.innerHTML));
    const highlightedHtml = applyReadingTone(rawHtml);

    if (editor.innerHTML === highlightedHtml) {
      return;
    }

    editor.innerHTML = highlightedHtml;
    restoreCaretCharacterOffset(editor, caretOffset);
  }

  const markdownPreview = useMemo(() => {
    if (!activeTab) {
      return "";
    }

    const html =
      activeTab.id === activeTabIdRef.current && editorRef.current
        ? normalizeEditorHtml(editorRef.current.innerHTML)
        : activeTab.html;

    return createMarkdownPreview(html);
  }, [activeTab, tabs]);


  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab) {
      return;
    }

    const highlightedHtml = applyReadingTone(activeTab.html);

    if (stripReadingToneMarkup(editor.innerHTML) !== activeTab.html) {
      editor.innerHTML = highlightedHtml;
      placeCaretAtEnd(editor);
    } else if (editor.innerHTML !== highlightedHtml) {
      editor.innerHTML = highlightedHtml;
    }

    editor.style.lineHeight = String(activeTab.lineHeight);
    clearCanvasSelection(editor);
    selectElement(null);
  }, [activeTab]);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const clearSelectionWidgets = () => {
      setSelectionNote(null);
      if (!document.activeElement || !(document.activeElement instanceof HTMLTextAreaElement)) {
        setNoteEditor((current) => current?.id ? current : null);
      }
    };

    editor.addEventListener("scroll", clearSelectionWidgets);
    window.addEventListener("scroll", clearSelectionWidgets, true);

    return () => {
      editor.removeEventListener("scroll", clearSelectionWidgets);
      window.removeEventListener("scroll", clearSelectionWidgets, true);
    };
  }, [activeTabId]);

  useEffect(() => {
    const handleWindowPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".dropdown-menu")) {
        setOpenDropdown(null);
      }
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (selectedElement && (key === "delete" || key === "backspace")) {
        event.preventDefault();
        removeSelectedElement();
        return;
      }

      if (event.ctrlKey && selectedElement?.kind === "image" && key === "c") {
        event.preventDefault();
        void copySelectedImage(false);
        return;
      }

      if (event.ctrlKey && selectedElement?.kind === "image" && key === "x") {
        event.preventDefault();
        void copySelectedImage(true);
        return;
      }

      if (!event.ctrlKey) {
        return;
      }

      if (key === "n") {
        event.preventDefault();
        void createNewTab();
      }

      if (key === "o") {
        event.preventDefault();
        void openDocument();
      }

      if (key === "s" && event.shiftKey) {
        event.preventDefault();
        void saveDocumentAs();
      } else if (key === "s") {
        event.preventDefault();
        void saveDocument();
      }
    };

    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [selectedElement, activeTab]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      if (imageResizeRef.current) {
        const figure = getImageFigure(editor, imageResizeRef.current.id);
        if (!figure) {
          return;
        }

        const nextWidth = Math.max(
          MIN_IMAGE_WIDTH,
          Math.min(editor.clientWidth - 48, imageResizeRef.current.startWidth + (event.clientX - imageResizeRef.current.startX))
        );

        applyImageLayout(figure, {
          width: nextWidth,
          x: getFigureX(figure),
          y: getFigureY(figure)
        });
        selectElement(buildImageSelection(figure));
        syncEditorToState();
        return;
      }

      if (imageDragRef.current) {
        const figure = getImageFigure(editor, imageDragRef.current.id);
        if (!figure) {
          return;
        }

        const delta = getEditorPoint(editor, event.clientX, event.clientY);
        applyImageLayout(figure, {
          width: getFigureWidth(figure),
          x: imageDragRef.current.originX + (delta.x - imageDragRef.current.startX),
          y: imageDragRef.current.originY + (delta.y - imageDragRef.current.startY)
        });
        figure.classList.add("editor-image-dragging");
        selectElement(buildImageSelection(figure));
        syncEditorToState();
        return;
      }

      if (annotationDragRef.current) {
        const node = getAnnotationNode(editor, annotationDragRef.current.id);
        if (!node) {
          return;
        }

        const delta = getEditorPoint(editor, event.clientX, event.clientY);
        applyAnnotationPosition(node, {
          x: annotationDragRef.current.originX + (delta.x - annotationDragRef.current.startX),
          y: annotationDragRef.current.originY + (delta.y - annotationDragRef.current.startY)
        });
        node.classList.add("editor-annotation-dragging");
        selectElement(buildAnnotationSelection(node));
        syncEditorToState();
        return;
      }

      if (drawRef.current) {
        const node = getAnnotationNode(editor, drawRef.current.id);
        if (!node) {
          return;
        }

        const point = getEditorPoint(editor, event.clientX, event.clientY);
        if (drawRef.current.annotationType === "pen") {
          const previous = drawRef.current.points[drawRef.current.points.length - 1];
          if (!previous || Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y) > 2) {
            drawRef.current.points.push(point);
          }
          applyAnnotationPayload(node, buildPenAnnotation(drawRef.current.id, drawRef.current.color, drawRef.current.points, drawRef.current.strokeWidth));
        } else {
          const start = drawRef.current.points[0] ?? point;
          const nextPayload = drawRef.current.annotationType === "arrow"
            ? buildArrowAnnotation(drawRef.current.id, drawRef.current.color, start, point, drawRef.current.strokeWidth)
            : buildShapeAnnotation(drawRef.current.id, drawRef.current.annotationType, drawRef.current.color, start, point, drawRef.current.strokeWidth);
          applyAnnotationPayload(node, nextPayload);
        }

        selectElement(buildAnnotationSelection(node));
        syncEditorToState();
      }
    };

    const handlePointerUp = () => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      if (imageResizeRef.current) {
        imageResizeRef.current = null;
        setStatus("Imagem redimensionada");
      }

      if (imageDragRef.current) {
        getImageFigure(editor, imageDragRef.current.id)?.classList.remove("editor-image-dragging");
        imageDragRef.current = null;
        setStatus("Imagem movida");
      }

      if (annotationDragRef.current) {
        getAnnotationNode(editor, annotationDragRef.current.id)?.classList.remove("editor-annotation-dragging");
        annotationDragRef.current = null;
        setStatus("Anotacao movida");
      }

      if (drawRef.current) {
        drawRef.current = null;
        setStatus(toolMode === "arrow" ? "Seta criada" : "Desenho criado");
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [toolMode]);
  const handleDropdownAction = (action: () => void) => {
    action();
    setOpenDropdown(null);
  };
  const handleTextAction = (kind: "h1" | "h2" | "bold" | "italic" | "list" | "quote" | "code") => {
    switch (kind) {
      case "h1":
        handleDropdownAction(() => applyEditorCommand("formatBlock", "<h1>"));
        break;
      case "h2":
        handleDropdownAction(() => applyEditorCommand("formatBlock", "<h2>"));
        break;
      case "bold":
        handleDropdownAction(() => applyEditorCommand("bold"));
        break;
      case "italic":
        handleDropdownAction(() => applyEditorCommand("italic"));
        break;
      case "list":
        handleDropdownAction(() => applyEditorCommand("insertUnorderedList"));
        break;
      case "quote":
        handleDropdownAction(() => applyEditorCommand("formatBlock", "<blockquote>"));
        break;
      case "code":
        handleDropdownAction(insertCodeInline);
        break;
    }
  }

  return (
    <main className="app-shell">
      <section className="window">
        <TopRibbon
          activeTab={activeTab}
          activeTabId={activeTabId}
          tabs={tabs}
          selectedElement={selectedElement}
          toolMode={toolMode}
          showMarkdown={showMarkdown}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          colorPalette={COLOR_PALETTE}
          openDropdown={openDropdown}
          onToggleDropdown={(name) => setOpenDropdown((current) => current === name ? null : name)}
          onNewTab={() => void createNewTab()}
          onOpenDocument={() => void openDocument()}
          onSaveDocument={() => void saveDocument()}
          onSetToolMode={setToolMode}
          onToggleMarkdown={() => setShowMarkdown((current) => !current)}
          onSetStrokeColor={setStrokeColor}
          onSetStrokeWidth={setStrokeWidth}
          onApplyTextAction={handleTextAction}
          onUpdateLineHeight={updateLineHeight}
          onSwitchTab={switchTab}
          onCloseTab={closeTab}
        />
        <section ref={editorLayoutRef} className={`editor-layout ${showMarkdown ? "editor-layout-split" : ""}`}>
          <div
            ref={editorRef}
            className={`editor ${toolMode !== "select" ? `editor-tool-${toolMode}` : ""}`}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onInput={handleInput}
            onPaste={handlePaste}
            onClick={handleEditorClick}
            onMouseUp={updateSelectionNoteState}
            onPointerDown={handleEditorPointerDown}
            onKeyDown={handleEditorKeyDown}
          />

          <SelectionActions
            selectionNote={selectionNote}
            searchMenuOpen={searchMenuOpen}
            onRunQuickAction={(action) => void runQuickAction(action)}
            onToggleSearchMenu={() => setSearchMenuOpen((current) => !current)}
          />

          <NotePopover
            noteEditor={noteEditor}
            onChangeText={(value) => setNoteEditor((current) => current ? { ...current, text: value } : current)}
            onRemove={removeInlineNote}
            onClose={() => setNoteEditor(null)}
            onSave={saveInlineNote}
          />

          <MarkdownPanel showMarkdown={showMarkdown} markdownPreview={markdownPreview} />
        </section>

        <footer className="statusbar">
          <span>{status}</span>
          <span>{renderTabStatus(activeTab)}</span>
        </footer>
      </section>
    </main>
  );
}

export default App;
