import type {
  AnnotationGeometry,
  AnnotationPayload,
  AnnotationType,
  ClipboardImagePayload,
  DocumentTab,
  Point,
  SelectedElement
} from "../types/editor";
import { EMPTY_DOCUMENT_HTML } from "./workspace";

export const DEFAULT_IMAGE_WIDTH = 420;
export const MIN_IMAGE_WIDTH = 160;
export const IMAGE_CLIPBOARD_PREFIX = "[[notepade:image-clipboard:";
export const IMAGE_CLIPBOARD_SUFFIX = "]]";
export const COLOR_PALETTE = ["#12355b", "#d64545", "#2d8f6f", "#c27b10", "#7a3db8", "#111111"];

export const isImageFile = (item: DataTransferItem) => item.type.startsWith("image/");
export const normalizeEditorHtml = (html: string) => html.trim() || EMPTY_DOCUMENT_HTML;

export const stripReadingToneMarkup = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("span[data-tone-token='true']").forEach((node) => {
    const parent = node.parentNode;
    while (node.firstChild) {
      parent?.insertBefore(node.firstChild, node);
    }
    parent?.removeChild(node);
  });
  return template.innerHTML;
};

export const applyReadingTone = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = stripReadingToneMarkup(html);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      textNodes.push(current as Text);
    }
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const parent = textNode.parentElement;
    if (!parent || !textNode.textContent?.trim()) {
      return;
    }

    if (parent.closest("figure.editor-image, div.editor-annotation, code, pre, span[data-tone-token='true'], span.inline-note")) {
      return;
    }

    const fragment = createToneFragment(textNode.textContent);
    if (!fragment) {
      return;
    }

    textNode.replaceWith(fragment);
  });

  return template.innerHTML;
};

export const createToneFragment = (text: string) => {
  const tokenPattern = /(?<![\p{L}\p{N}_])(={3,}|-{3,}|-?\d+(?:[.,]\d+)?%?|[\p{Lu}][\p{Lu}\p{N}²]{1,})(?![\p{L}\p{N}_])/gu;
  tokenPattern.lastIndex = 0;

  if (!tokenPattern.test(text)) {
    return null;
  }

  tokenPattern.lastIndex = 0;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    const token = match[0];

    if (index > lastIndex) {
      fragment.append(text.slice(lastIndex, index));
    }

    const span = document.createElement("span");
    span.dataset.toneToken = "true";
    span.className = getToneClassName(token);
    span.textContent = token;
    fragment.append(span);
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    fragment.append(text.slice(lastIndex));
  }

  return fragment;
};

export const getToneClassName = (token: string) => {
  if (/^(={3,}|-{3,})$/.test(token)) {
    return "tone-divider";
  }

  if (/\d/.test(token)) {
    return token.includes("-") ? "tone-number-negative" : "tone-number";
  }

  return "tone-acronym";
};

export const getCaretCharacterOffsetWithin = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return 0;
  }

  const anchorNode = selection.anchorNode;
  if (!anchorNode) {
    return 0;
  }

  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(element);
  range.setEnd(anchorNode, selection.anchorOffset);
  return range.toString().length;
};

export const restoreCaretCharacterOffset = (element: HTMLElement, offset: number) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let remaining = offset;

  while (current) {
    const textNode = current as Text;
    const length = textNode.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(textNode, Math.max(0, remaining));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    remaining -= length;
    current = walker.nextNode();
  }

  placeCaretAtEnd(element);
};

export const deriveTitle = (filePath: string | null, html: string) => {
  if (filePath) {
    return getFileName(filePath);
  }

  const text = htmlToPlainText(html).trim();
  return text ? text.slice(0, 24) : "Nova nota";
};

export const htmlToPlainText = (html: string) => {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent ?? "";
};

export const getFileName = (path: string) => {
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] ?? path;
};

export const sanitizeFileName = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
export const toErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const placeCaretAtEnd = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

export const getOverlayPoint = (editor: HTMLElement, rect: DOMRect) => ({
  x: rect.left - editor.getBoundingClientRect().left + rect.width / 2,
  y: rect.top - editor.getBoundingClientRect().top
});

export const getEditorPoint = (editor: HTMLElement, clientX: number, clientY: number): Point => {
  const rect = editor.getBoundingClientRect();
  return {
    x: clientX - rect.left + editor.scrollLeft,
    y: clientY - rect.top + editor.scrollTop
  };
};

export const getSelectionFloatingPosition = (editor: HTMLElement): ClipboardImagePayload => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { src: "", width: DEFAULT_IMAGE_WIDTH, x: 24 + editor.scrollLeft, y: 24 + editor.scrollTop };
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) {
    return { src: "", width: DEFAULT_IMAGE_WIDTH, x: 24 + editor.scrollLeft, y: 24 + editor.scrollTop };
  }

  const editorRect = editor.getBoundingClientRect();
  return {
    src: "",
    width: DEFAULT_IMAGE_WIDTH,
    x: Math.max(12, rect.left - editorRect.left + editor.scrollLeft),
    y: Math.max(12, rect.top - editorRect.top + editor.scrollTop)
  };
};

export const createImageFigure = (src: string, layout?: Partial<ClipboardImagePayload>) => {
  const figure = document.createElement("figure");
  figure.className = "editor-image";
  figure.contentEditable = "false";
  figure.dataset.imageId = crypto.randomUUID();

  const image = document.createElement("img");
  image.src = src;
  image.alt = "Imagem colada";
  image.draggable = false;

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "image-resize-handle";
  handle.tabIndex = -1;
  handle.setAttribute("aria-label", "Redimensionar imagem");

  figure.appendChild(image);
  figure.appendChild(handle);
  applyImageLayout(figure, {
    width: layout?.width ?? DEFAULT_IMAGE_WIDTH,
    x: layout?.x ?? 24,
    y: layout?.y ?? 24
  });
  return figure;
};

export const applyImageLayout = (figure: HTMLElement, layout: { width: number; x: number; y: number }) => {
  const width = Math.round(Math.max(MIN_IMAGE_WIDTH, layout.width));
  figure.dataset.width = String(width);
  figure.dataset.x = String(Math.round(layout.x));
  figure.dataset.y = String(Math.round(layout.y));
  figure.style.width = `${width}px`;
  figure.style.left = `${Math.round(layout.x)}px`;
  figure.style.top = `${Math.round(layout.y)}px`;
};

export const createAnnotationNode = (payload: AnnotationPayload) => {
  const node = document.createElement("div");
  node.className = "editor-annotation";
  node.contentEditable = "false";
  applyAnnotationPayload(node, payload);
  return node;
};

export const applyAnnotationPayload = (node: HTMLElement, payload: AnnotationPayload) => {
  node.dataset.annotationId = payload.id;
  node.dataset.annotationType = payload.annotationType;
  node.dataset.color = payload.color;
  node.dataset.strokeWidth = String(Math.round(payload.strokeWidth));
  node.dataset.x = String(Math.round(payload.x));
  node.dataset.y = String(Math.round(payload.y));
  node.dataset.width = String(Math.round(payload.width));
  node.dataset.height = String(Math.round(payload.height));
  node.dataset.geometry = encodeURIComponent(JSON.stringify(payload.geometry));
  node.style.left = `${Math.round(payload.x)}px`;
  node.style.top = `${Math.round(payload.y)}px`;
  node.style.width = `${Math.max(12, Math.round(payload.width))}px`;
  node.style.height = `${Math.max(12, Math.round(payload.height))}px`;
  node.innerHTML = renderAnnotationSvg(payload);
};

export const applyAnnotationPosition = (node: HTMLElement, position: { x: number; y: number }) => {
  node.dataset.x = String(Math.round(position.x));
  node.dataset.y = String(Math.round(position.y));
  node.style.left = `${Math.round(position.x)}px`;
  node.style.top = `${Math.round(position.y)}px`;
};

export const extractAnnotationPayload = (node: HTMLElement): AnnotationPayload => {
  const geometryRaw = decodeURIComponent(node.dataset.geometry ?? "%7B%7D");
  const geometry = JSON.parse(geometryRaw) as AnnotationGeometry;
  return {
    id: node.dataset.annotationId ?? crypto.randomUUID(),
    annotationType: (node.dataset.annotationType as AnnotationType) ?? "pen",
    color: node.dataset.color ?? COLOR_PALETTE[0],
    strokeWidth: Number.parseInt(node.dataset.strokeWidth ?? "4", 10) || 4,
    x: Number.parseInt(node.dataset.x ?? "0", 10) || 0,
    y: Number.parseInt(node.dataset.y ?? "0", 10) || 0,
    width: Number.parseInt(node.dataset.width ?? "12", 10) || 12,
    height: Number.parseInt(node.dataset.height ?? "12", 10) || 12,
    geometry
  };
};

export const buildPenAnnotation = (id: string, color: string, points: Point[], strokeWidth: number): AnnotationPayload => {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const padding = Math.max(8, strokeWidth * 2.5);
  return {
    id,
    annotationType: "pen",
    color,
    strokeWidth,
    x: minX - padding,
    y: minY - padding,
    width: Math.max(12, maxX - minX + padding * 2),
    height: Math.max(12, maxY - minY + padding * 2),
    geometry: {
      points: points.map((point) => ({ x: point.x - minX + padding, y: point.y - minY + padding }))
    }
  };
};

export const buildArrowAnnotation = (id: string, color: string, start: Point, end: Point, strokeWidth: number): AnnotationPayload => {
  const padding = Math.max(14, strokeWidth * 3.5);
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  return {
    id,
    annotationType: "arrow",
    color,
    strokeWidth,
    x: minX - padding,
    y: minY - padding,
    width: Math.max(24, maxX - minX + padding * 2),
    height: Math.max(24, maxY - minY + padding * 2),
    geometry: {
      startX: start.x - minX + padding,
      startY: start.y - minY + padding,
      endX: end.x - minX + padding,
      endY: end.y - minY + padding
    }
  };
};

export const buildShapeAnnotation = (id: string, annotationType: "square" | "circle" | "zone", color: string, start: Point, end: Point, strokeWidth: number): AnnotationPayload => {
  const padding = Math.max(10, strokeWidth * 2.5);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const size = Math.max(Math.abs(deltaX), Math.abs(deltaY), 8);
  const finalEnd = {
    x: start.x + (deltaX >= 0 ? size : -size),
    y: start.y + (deltaY >= 0 ? size : -size)
  };
  const minX = Math.min(start.x, finalEnd.x);
  const minY = Math.min(start.y, finalEnd.y);
  const maxX = Math.max(start.x, finalEnd.x);
  const maxY = Math.max(start.y, finalEnd.y);

  return {
    id,
    annotationType,
    color,
    strokeWidth,
    x: minX - padding,
    y: minY - padding,
    width: Math.max(24, maxX - minX + padding * 2),
    height: Math.max(24, maxY - minY + padding * 2),
    geometry: {
      startX: start.x - minX + padding,
      startY: start.y - minY + padding,
      endX: finalEnd.x - minX + padding,
      endY: finalEnd.y - minY + padding
    }
  };
};

export const getAnnotationCreatedStatus = (annotationType: AnnotationType) => {
  switch (annotationType) {
    case "arrow":
      return "Seta criada";
    case "square":
      return "Quadrado criado";
    case "zone":
      return "Zona Kanban criada";
    case "circle":
      return "Circulo criado";
    default:
      return "Desenho criado";
  }
};
export const renderAnnotationSvg = (payload: AnnotationPayload) => {
  const width = Math.max(12, payload.width);
  const height = Math.max(12, payload.height);
  const strokeWidth = Math.max(1, payload.strokeWidth);

  if (payload.annotationType === "pen") {
    const points = payload.geometry.points ?? [];
    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" aria-hidden="true"><polyline points="${polyline}" fill="none" stroke="${payload.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
  }

  if (payload.annotationType === "arrow") {
    const start = { x: payload.geometry.startX ?? 0, y: payload.geometry.startY ?? 0 };
    const end = { x: payload.geometry.endX ?? width, y: payload.geometry.endY ?? height };
    const head = getArrowHeadPoints(start, end, Math.max(10, strokeWidth * 3));
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" aria-hidden="true"><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${payload.color}" stroke-width="${strokeWidth}" stroke-linecap="round" /><polygon points="${head}" fill="${payload.color}" /></svg>`;
  }

  const start = { x: payload.geometry.startX ?? strokeWidth, y: payload.geometry.startY ?? strokeWidth };
  const end = { x: payload.geometry.endX ?? width - strokeWidth, y: payload.geometry.endY ?? height - strokeWidth };
  const shapeWidth = Math.max(4, end.x - start.x);
  const shapeHeight = Math.max(4, end.y - start.y);

  if (payload.annotationType === "square") {
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" aria-hidden="true"><rect x="${start.x}" y="${start.y}" width="${shapeWidth}" height="${shapeHeight}" rx="4" ry="4" fill="none" stroke="${payload.color}" stroke-width="${strokeWidth}" /></svg>`;
  }

  const radius = Math.max(2, Math.min(shapeWidth, shapeHeight) / 2);
  const centerX = start.x + shapeWidth / 2;
  const centerY = start.y + shapeHeight / 2;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" aria-hidden="true"><circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${payload.color}" stroke-width="${strokeWidth}" /></svg>`;
};

export const getArrowHeadPoints = (start: Point, end: Point, size: number) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const left = { x: end.x - size * Math.cos(angle - Math.PI / 6), y: end.y - size * Math.sin(angle - Math.PI / 6) };
  const right = { x: end.x - size * Math.cos(angle + Math.PI / 6), y: end.y - size * Math.sin(angle + Math.PI / 6) };
  return `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`;
};

export const buildImageSelection = (figure: HTMLElement): SelectedElement => ({
  kind: "image",
  id: figure.dataset.imageId ?? crypto.randomUUID(),
  width: getFigureWidth(figure),
  x: getFigureX(figure),
  y: getFigureY(figure)
});

export const buildAnnotationSelection = (node: HTMLElement): SelectedElement => {
  const payload = extractAnnotationPayload(node);
  return {
    kind: "annotation",
    id: payload.id,
    annotationType: payload.annotationType,
    color: payload.color,
    strokeWidth: payload.strokeWidth,
    x: payload.x,
    y: payload.y,
    width: payload.width,
    height: payload.height
  };
};

export const getFigureWidth = (figure: HTMLElement) => Number.parseInt(figure.dataset.width ?? "", 10) || DEFAULT_IMAGE_WIDTH;
export const getFigureX = (figure: HTMLElement) => Number.parseInt(figure.dataset.x ?? "", 10) || 0;
export const getFigureY = (figure: HTMLElement) => Number.parseInt(figure.dataset.y ?? "", 10) || 0;
export const getAnnotationX = (node: HTMLElement) => Number.parseInt(node.dataset.x ?? "", 10) || 0;
export const getAnnotationY = (node: HTMLElement) => Number.parseInt(node.dataset.y ?? "", 10) || 0;

export const clearCanvasSelection = (editor: HTMLElement) => {
  editor.querySelectorAll("figure.editor-image-selected, div.editor-annotation-selected").forEach((node) => {
    node.classList.remove("editor-image-selected", "editor-annotation-selected");
  });
};

export const getImageFigure = (editor: HTMLElement, imageId: string) =>
  editor.querySelector(`figure.editor-image[data-image-id="${imageId}"]`) as HTMLElement | null;

export const getAnnotationNode = (editor: HTMLElement, annotationId: string) =>
  editor.querySelector(`div.editor-annotation[data-annotation-id="${annotationId}"]`) as HTMLElement | null;

export const encodeClipboardImage = (payload: ClipboardImagePayload) =>
  `${IMAGE_CLIPBOARD_PREFIX}${encodeURIComponent(JSON.stringify(payload))}${IMAGE_CLIPBOARD_SUFFIX}`;

export const decodeClipboardImage = (value: string): ClipboardImagePayload | null => {
  if (!value.startsWith(IMAGE_CLIPBOARD_PREFIX) || !value.endsWith(IMAGE_CLIPBOARD_SUFFIX)) {
    return null;
  }

  try {
    const raw = value.slice(IMAGE_CLIPBOARD_PREFIX.length, -IMAGE_CLIPBOARD_SUFFIX.length);
    const parsed = JSON.parse(decodeURIComponent(raw)) as ClipboardImagePayload;
    return parsed?.src ? parsed : null;
  } catch {
    return null;
  }
};

