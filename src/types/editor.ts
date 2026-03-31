import type { ReactNode } from "react";

export type DocumentTab = {
  id: string;
  title: string;
  filePath: string | null;
  html: string;
  isDirty: boolean;
  lineHeight: number;
};

export type PersistedWorkspace = {
  activeTabId: string;
  tabs: DocumentTab[];
};

export type AnnotationType = "pen" | "arrow" | "square" | "circle";

export type ToolMode = "select" | AnnotationType;

export type ClipboardImagePayload = {
  src: string;
  width: number;
  x: number;
  y: number;
};

export type Point = {
  x: number;
  y: number;
};

export type AnnotationGeometry = {
  points?: Point[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
};

export type AnnotationPayload = {
  id: string;
  annotationType: AnnotationType;
  color: string;
  strokeWidth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  geometry: AnnotationGeometry;
};

export type SelectedElement =
  | { kind: "image"; id: string; width: number; x: number; y: number }
  | { kind: "annotation"; id: string; annotationType: AnnotationType; color: string; strokeWidth: number; x: number; y: number; width: number; height: number };

export type SelectionNoteState = {
  x: number;
  y: number;
  text: string;
};

export type NoteEditorState = {
  id: string | null;
  text: string;
  x: number;
  y: number;
  targetText: string;
};

export type IconButtonProps = {
  label: string;
  title?: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
};

export type DropdownMenuProps = {
  label: string;
  title?: string;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  items: { label: string; onClick: () => void }[];
};