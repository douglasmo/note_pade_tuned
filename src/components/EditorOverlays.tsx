import type { QuickAction } from "../lib/quickSearch";
import type { NoteEditorState, SelectionNoteState, SchedulePopoverState, ExistingScheduleState } from "../types/editor";
import type { Reminder } from "../hooks/useReminders";
import { useState, useEffect } from "react";
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
      <button type="button" className="selection-action-button" onClick={() => onRunQuickAction("schedule")}>Agendar</button>
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

export type SchedulePopoverProps = {
  schedulePopover: SchedulePopoverState | null;
  onClose: () => void;
  onSchedule: (text: string, date: Date) => void;
};

export function SchedulePopover({ schedulePopover, onClose, onSchedule }: SchedulePopoverProps) {
  const [customDate, setCustomDate] = useState("");

  if (!schedulePopover) {
    return null;
  }

  const handleSchedule = (minutes: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    onSchedule(schedulePopover.text, d);
    onClose();
  };

  const handleTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    onSchedule(schedulePopover.text, d);
    onClose();
  };

  const handleCustom = () => {
    if (customDate) {
      const d = new Date(customDate);
      if (!isNaN(d.getTime())) {
        onSchedule(schedulePopover.text, d);
        onClose();
      }
    }
  };

  return (
    <div className="inline-note-popover" style={{ left: schedulePopover.x, top: schedulePopover.y }}>
      <div className="inline-note-popover-title">Agendar retorno</div>
      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" className="mini-button" onClick={() => handleSchedule(1)}>Daqui a 1 min (teste)</button>
        <button type="button" className="mini-button" onClick={() => handleSchedule(5)}>Daqui a 5 min</button>
        <button type="button" className="mini-button" onClick={() => handleSchedule(30)}>Daqui a 30 min</button>
        <button type="button" className="mini-button" onClick={() => handleTomorrow()}>Amanhã</button>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input 
            type="datetime-local" 
            value={customDate} 
            onChange={(e) => setCustomDate(e.target.value)} 
            style={{ width: "100%", padding: "4px", fontSize: "12px", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--input-bg-color, transparent)" }}
          />
        </div>
        <button type="button" className="mini-button mini-button-active" onClick={handleCustom} disabled={!customDate}>Agendar Personalizado</button>
      </div>
      <div className="inline-note-actions">
        <button type="button" className="mini-button" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

export type ExistingSchedulePopoverProps = {
  existingSchedule: ExistingScheduleState | null;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export function ExistingSchedulePopover({ existingSchedule, onRemove, onClose }: ExistingSchedulePopoverProps) {
  if (!existingSchedule) return null;
  
  const formattedDate = new Date(existingSchedule.time).toLocaleString();

  return (
    <div className="inline-note-popover" style={{ left: existingSchedule.x, top: existingSchedule.y }}>
      <div className="inline-note-popover-title">Retorno agendado para:</div>
      <div style={{ padding: "0 12px 12px", fontSize: "14px", fontWeight: "bold" }}>
        {formattedDate}
      </div>
      <div className="inline-note-actions">
        <button type="button" className="mini-button" onClick={() => { onRemove(existingSchedule.id); onClose(); }}>Remover</button>
        <button type="button" className="mini-button" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export type RemindersDialogProps = {
  activeReminders: Reminder[];
  onDismiss: (id: string) => void;
};

export function RemindersDialog({ activeReminders, onDismiss }: RemindersDialogProps) {
  useEffect(() => {
    if (activeReminders.length > 0) {
      // Play a beep sound
      try {
        const ctx = new window.AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880; // A5
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (err) {
        // Ignore audio errors (may require user interaction depending on browser policy)
      }
    }
  }, [activeReminders.length]);

  if (activeReminders.length === 0) {
    return null;
  }

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div className="inline-note-popover" style={{
        position: 'relative',
        transform: 'none',
        minWidth: 340,
        boxShadow: '0 24px 54px rgba(26, 49, 74, 0.25)'
      }}>
        <div className="inline-note-popover-title" style={{ fontSize: '1.05rem', marginBottom: 16 }}>
          🔔 Lembrete de Retorno
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeReminders.map(reminder => (
            <div key={reminder.id} className="reminder-item" style={{ 
              padding: 12, border: "1px solid rgba(26, 63, 100, 0.16)", borderRadius: 12,
              display: "flex", flexDirection: "column", gap: 12, backgroundColor: "rgba(255,255,255,0.6)"
            }}>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#17314d", fontSize: "0.95rem" }}>"{reminder.text}"</p>
              <button type="button" className="mini-button mini-button-active" style={{ alignSelf: "flex-end" }} onClick={() => onDismiss(reminder.id)}>
                Entendido
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
