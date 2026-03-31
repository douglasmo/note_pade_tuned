import type { QuickAction } from "../lib/quickSearch";
import type { NoteEditorState, SelectionNoteState } from "../types/editor";
type SelectionActionsProps = {
  selectionNote: SelectionNoteState | null;
  searchMenuOpen: boolean;
  onRunQuickAction: (action: QuickAction) => void;
  onToggleSearchMenu: () => void;
};

export function SelectionActions({ selectionNote, searchMenuOpen, onRunQuickAction, onToggleSearchMenu }: SelectionActionsProps) {
  if (!selectionNote) {
    return null;
  }

  return (
    <div className="selection-note-bubble" style={{ left: selectionNote.x, top: selectionNote.y }}>
      <button type="button" className="selection-action-button" onClick={() => onRunQuickAction("note")}>Nota</button>
      <div className="selection-search-menu">
        <button type="button" className="selection-action-button" onClick={onToggleSearchMenu}>Procurar...</button>
        {searchMenuOpen ? (
          <div className="selection-search-dropdown">
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("google")}>Google</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("wikipedia")}>{"Wikip\u00E9dia"}</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("translate")}>Traduzir</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("chatgpt")}>ChatGPT</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("youtube")}>YouTube</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("definition")}>{"Defini\u00E7\u00E3o"}</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("synonyms")}>{"Sin\u00F4nimos"}</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("maps")}>Maps</button>
            <button type="button" className="selection-dropdown-item" onClick={() => onRunQuickAction("copy")}>Copiar</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type NotePopoverProps = {
  noteEditor: NoteEditorState | null;
  onChangeText: (value: string) => void;
  onRemove: () => void;
  onClose: () => void;
  onSave: () => void;
};

export function NotePopover({ noteEditor, onChangeText, onRemove, onClose, onSave }: NotePopoverProps) {
  if (!noteEditor) {
    return null;
  }

  return (
    <div className="inline-note-popover" style={{ left: noteEditor.x, top: noteEditor.y }}>
      <div className="inline-note-popover-title">Nota em "{noteEditor.targetText}"</div>
      <textarea
        className="inline-note-textarea"
        value={noteEditor.text}
        onChange={(event) => onChangeText(event.target.value)}
        placeholder="Escreva sua observacao"
      />
      <div className="inline-note-actions">
        {noteEditor.id ? (
          <button type="button" className="mini-button" onClick={onRemove}>Remover</button>
        ) : null}
        <button type="button" className="mini-button" onClick={onClose}>Fechar</button>
        <button type="button" className="mini-button mini-button-active" onClick={onSave}>Salvar nota</button>
      </div>
    </div>
  );
}

type MarkdownPanelProps = {
  showMarkdown: boolean;
  markdownPreview: string;
};

export function MarkdownPanel({ showMarkdown, markdownPreview }: MarkdownPanelProps) {
  if (!showMarkdown) {
    return null;
  }

  return (
    <aside className="markdown-panel">
      <div className="markdown-panel-header">Markdown gerado</div>
      <pre className="markdown-preview">{markdownPreview || "Sem conteudo markdown ainda."}</pre>
    </aside>
  );
}
