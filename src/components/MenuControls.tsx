import type { DropdownMenuProps, IconButtonProps } from "../types/editor";

export function IconButton({ label, title, onClick, active = false, children }: IconButtonProps) {
  return (
    <button type="button" className={`icon-button ${active ? "icon-button-active" : ""}`} onClick={onClick} title={title ?? label} aria-label={label}>
      {children}
    </button>
  );
}

export function DropdownMenu({ label, title, active, onToggle, children, items }: DropdownMenuProps) {
  return (
    <div className="dropdown-menu">
      <IconButton label={label} title={title} onClick={onToggle} active={active}>{children}</IconButton>
      {active ? (
        <div className="dropdown-panel" role="menu" aria-label={label}>
          {items.map((item) => (
            <button key={item.label} type="button" className="dropdown-item" role="menuitem" onClick={item.onClick}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}