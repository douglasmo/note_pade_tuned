import { DropdownMenu, IconButton } from "./MenuControls";
import type { DocumentTab, SelectedElement, ToolMode } from "../types/editor";

const MENU_ITEMS = ["Arquivo", "Editar", "Inserir", "Formatar", "Exibir", "Ferramentas", "Janela"];
const LINE_HEIGHT_OPTIONS = [1.2, 1.5, 1.8];
const STROKE_WIDTH_OPTIONS = [2, 4, 8];

type TopRibbonProps = {
  activeTab: DocumentTab | null;
  activeTabId: string;
  tabs: DocumentTab[];
  selectedElement: SelectedElement | null;
  toolMode: ToolMode;
  showMarkdown: boolean;
  strokeColor: string;
  strokeWidth: number;
  colorPalette: string[];
  openDropdown: string | null;
  onToggleDropdown: (name: string) => void;
  onNewTab: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onSetToolMode: (mode: ToolMode) => void;
  onToggleMarkdown: () => void;
  onSetStrokeColor: (color: string) => void;
  onSetStrokeWidth: (width: number) => void;
  onApplyTextAction: (kind: "h1" | "h2" | "bold" | "italic" | "list" | "quote" | "code") => void;
  onUpdateLineHeight: (value: number) => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
};

export function TopRibbon({
  activeTab,
  activeTabId,
  tabs,
  selectedElement,
  toolMode,
  showMarkdown,
  strokeColor,
  strokeWidth,
  colorPalette,
  openDropdown,
  onToggleDropdown,
  onNewTab,
  onOpenDocument,
  onSaveDocument,
  onSetToolMode,
  onToggleMarkdown,
  onSetStrokeColor,
  onSetStrokeWidth,
  onApplyTextAction,
  onUpdateLineHeight,
  onSwitchTab,
  onCloseTab
}: TopRibbonProps) {
  return (
    <div className="ribbon-shell">
      <header className="titlebar compact-titlebar">
        <div className="titleblock compact-titleblock">
          <h1>Notepade Tuned</h1>
        </div>
        <div className="selection-badge">
          {selectedElement?.kind === "annotation"
            ? `${selectedElement.annotationType} ${selectedElement.color}`
            : toolMode === "select"
              ? "Selecao"
              : toolMode === "pen"
                ? "Caneta"
                : toolMode === "arrow"
                  ? "Seta"
                  : toolMode === "square"
                    ? "Quadrado"
                    : "Circulo"}
        </div>
      </header>
      <nav className="menu-strip compact-menu-strip" aria-label="Menu principal">
        {MENU_ITEMS.map((item) => (
          <button key={item} type="button" className="menu-item compact-menu-item">
            {item}
          </button>
        ))}
      </nav>

      <section className="icon-strip compact-icon-strip" aria-label="Ferramentas rapidas">
        <IconButton label="Novo" onClick={onNewTab}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" /></svg>
        </IconButton>
        <IconButton label="Abrir" onClick={onOpenDocument}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h6l2 2h8v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zm2 4v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6z" /></svg>
        </IconButton>
        <IconButton label="Salvar" onClick={onSaveDocument}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5zm2 2v10h10V8.5L15.5 7H15v3H9V6zm4 0v2h2V6zm-2 8h6v4H9z" /></svg>
        </IconButton>
        <IconButton label="Selecionar" active={toolMode === "select"} onClick={() => onSetToolMode("select")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l11 8-5.5 1.5L13 20l-2.2 1-2.5-6.4L5 16z" /></svg>
        </IconButton>
        <IconButton label="Caneta" active={toolMode === "pen"} onClick={() => onSetToolMode("pen")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5l10-10-3.5-3.5zm12.8-9.3 1.7-1.7a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L19.8 10z" /></svg>
        </IconButton>
        <IconButton label="Seta" active={toolMode === "arrow"} onClick={() => onSetToolMode("arrow")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h11.2l-3.6-3.6L13 7l7 7-7 7-1.4-1.4 3.6-3.6H4z" /></svg>
        </IconButton>
        <IconButton label="Quadrado" active={toolMode === "square"} onClick={() => onSetToolMode("square")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        </IconButton>
        <IconButton label="Circulo" active={toolMode === "circle"} onClick={() => onSetToolMode("circle")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        </IconButton>
        <IconButton label="Quadro Kanban" active={toolMode === "zone"} onClick={() => onSetToolMode("zone")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="7" y="7" width="4" height="10" fill="currentColor" /><rect x="13" y="7" width="4" height="6" fill="currentColor" /></svg>
        </IconButton>
        <IconButton label="Markdown" active={showMarkdown} onClick={onToggleMarkdown}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zm2 2v8h3l2-2 2 2h2V8h-2v5l-2-2-2 2V8zm11 0h1.5L17 10h2l-2.5 3L19 16h-1.5L15 13z" /></svg>
        </IconButton>
        <div className="icon-strip-divider" />
        <div className="color-strip" aria-label="Cores">
          {colorPalette.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-swatch ${strokeColor === color ? "color-swatch-active" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => onSetStrokeColor(color)}
              title={`Cor ${color}`}
              aria-label={`Cor ${color}`}
            />
          ))}
        </div>
        <div className="line-height-tools stroke-width-tools">
          {STROKE_WIDTH_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`mini-button ${strokeWidth === option ? "mini-button-active" : ""}`}
              onClick={() => onSetStrokeWidth(option)}
              title={`Traço ${option}px`}
            >
              {option}px
            </button>
          ))}
        </div>
        <div className="icon-strip-divider" />
        <DropdownMenu
          label="Texto"
          title="Ferramentas de texto"
          active={openDropdown === "text"}
          onToggle={() => onToggleDropdown("text")}
          items={[
            { label: "H1", onClick: () => onApplyTextAction("h1") },
            { label: "H2", onClick: () => onApplyTextAction("h2") },
            { label: "Negrito", onClick: () => onApplyTextAction("bold") },
            { label: "Italico", onClick: () => onApplyTextAction("italic") }
          ]}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h6a4 4 0 0 1 0 8H7zm0 8h7a3 3 0 1 1 0 6H7zm2 2v2h4a1 1 0 1 0 0-2zM9 7v4h3a2 2 0 1 0 0-4z" /></svg>
        </DropdownMenu>
        <DropdownMenu
          label="Estrutura"
          title="Ferramentas de estrutura"
          active={openDropdown === "structure"}
          onToggle={() => onToggleDropdown("structure")}
          items={[
            { label: "Lista", onClick: () => onApplyTextAction("list") },
            { label: "Citacao", onClick: () => onApplyTextAction("quote") },
            { label: "Codigo", onClick: () => onApplyTextAction("code") }
          ]}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4zm0 5h10v2H4zm0 5h16v2H4zM17 10l2-2 1.4 1.4-2 2L21 14l-1.4 1.4-2-2-2.1 2.1L14 14z" /></svg>
        </DropdownMenu>
        <div className="icon-strip-divider" />
        <div className="line-height-tools compact-line-height-tools">
          {LINE_HEIGHT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`mini-button ${activeTab?.lineHeight === option ? "mini-button-active" : ""}`}
              onClick={() => onUpdateLineHeight(option)}
            >
              {option.toFixed(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="workspace-bar compact-bar tighter-workspace-bar">
        <div className="workspace-meta">
          <strong>{activeTab?.title ?? "Sem aba"}</strong>
          <span>
            {selectedElement?.kind === "annotation"
              ? "Delete remove e arraste para mover"
              : selectedElement?.kind === "image"
                ? "Ctrl+C copia, Ctrl+X recorta, Ctrl+V cola"
                : toolMode === "pen"
                  ? "Caneta ativa: clique e arraste para desenhar"
                  : toolMode === "arrow"
                    ? "Seta ativa: clique e arraste para criar"
                    : toolMode === "square"
                      ? "Quadrado ativo: arraste para desenhar"
                      : toolMode === "circle"
                        ? "Circulo ativo: arraste para desenhar"
                        : "Abas e acoes rapidas"}
          </span>
        </div>
        <div className="workspace-tools">
          <button type="button" className={`mini-button ${showMarkdown ? "mini-button-active" : ""}`} onClick={onToggleMarkdown}>
            {showMarkdown ? "Ocultar MD" : "Ver MD"}
          </button>
        </div>
        <nav className="tabs" aria-label="Abas abertas">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab ${tab.id === activeTabId ? "tab-active" : ""}`}
              onClick={() => onSwitchTab(tab.id)}
            >
              <span className="tab-label">{tab.title}{tab.isDirty ? " *" : ""}</span>
              <span
                className="tab-close"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }
                }}
              >
                x
              </span>
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}