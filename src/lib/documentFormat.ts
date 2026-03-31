export const IMAGE_TOKEN_PREFIX = "[[notepade:image:";
export const IMAGE_TOKEN_SUFFIX = "]]";
export const ANNOTATION_TOKEN_PREFIX = "[[notepade:annotation:";
export const ANNOTATION_TOKEN_SUFFIX = "]]";

type ImageMeta = {
  src: string;
  width?: number;
  x?: number;
  y?: number;
};

type AnnotationGeometry = {
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
};

type AnnotationType = "pen" | "arrow" | "square" | "circle";

type InlineNoteMeta = {
  text: string;
  note: string;
};

type AnnotationMeta = {
  annotationType: AnnotationType;
  color: string;
  strokeWidth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  geometry: AnnotationGeometry;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const serializeEditorHtml = (html: string): string => {
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragments: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      fragments.push(node.textContent ?? "");
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.matches("figure.editor-image")) {
      const image = node.querySelector("img");
      const src = image?.getAttribute("src") ?? "";
      if (src) {
        fragments.push(`\n${IMAGE_TOKEN_PREFIX}${encodeImageToken({
          src,
          width: parseInt(node.dataset.width ?? "", 10) || undefined,
          x: parseInt(node.dataset.x ?? "", 10) || 0,
          y: parseInt(node.dataset.y ?? "", 10) || 0
        })}${IMAGE_TOKEN_SUFFIX}\n`);
      }
      return;
    }

    if (node.matches("div.editor-annotation")) {
      fragments.push(`\n${ANNOTATION_TOKEN_PREFIX}${encodeAnnotationToken(extractAnnotationMeta(node))}${ANNOTATION_TOKEN_SUFFIX}\n`);
      return;
    }

    if (node.tagName === "BR") {
      fragments.push("\n");
      return;
    }

    const isBlock = ["DIV", "P", "SECTION", "ARTICLE", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE"].includes(node.tagName);
    if (isBlock && fragments.length > 0 && !fragments[fragments.length - 1]?.endsWith("\n")) {
      fragments.push("\n");
    }

    node.childNodes.forEach(walk);

    if (isBlock && !fragments[fragments.length - 1]?.endsWith("\n")) {
      fragments.push("\n");
    }
  };

  template.content.childNodes.forEach(walk);
  return fragments.join("").replace(/\n{3,}/g, "\n\n").trimEnd();
};

export const createMarkdownPreview = (html: string): string => {
  const template = document.createElement("template");
  template.innerHTML = html;
  return Array.from(template.content.childNodes)
    .map((node) => nodeToMarkdown(node))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const deserializeDocument = (content: string): string => {
  if (!content.trim()) {
    return "<p><br /></p>";
  }

  const pattern = /(\[\[notepade:image:.*?\]\]|\[\[notepade:annotation:.*?\]\]|\[\[notepade:note:.*?\]\])/gs;
  const pieces: string[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(pattern)) {
    const start = match.index ?? 0;
    const textChunk = content.slice(lastIndex, start);
    if (textChunk.trim() || textChunk.includes("\n")) {
      pieces.push(renderTextChunk(textChunk));
    }

    const token = match[0];
    if (token.startsWith(IMAGE_TOKEN_PREFIX)) {
      const meta = decodeImageToken(token.slice(IMAGE_TOKEN_PREFIX.length, -IMAGE_TOKEN_SUFFIX.length));
      if (meta?.src) {
        pieces.push(renderImageFigure(meta));
      }
    } else if (token.startsWith(ANNOTATION_TOKEN_PREFIX)) {
      const meta = decodeAnnotationToken(token.slice(ANNOTATION_TOKEN_PREFIX.length, -ANNOTATION_TOKEN_SUFFIX.length));
      if (meta) {
        pieces.push(renderAnnotationNode(meta));
      }
    }

    lastIndex = start + token.length;
  }

  const rest = content.slice(lastIndex);
  if (rest.trim() || rest.includes("\n")) {
    pieces.push(renderTextChunk(rest));
  }

  return pieces.join("") || "<p><br /></p>";
};

const renderTextChunk = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line.length ? `<p>${escapeHtml(line)}</p>` : "<p><br /></p>"))
    .join("");

const renderImageFigure = (meta: ImageMeta) => {
  const width = meta.width && Number.isFinite(meta.width) ? Math.max(160, meta.width) : 420;
  const x = meta.x ?? 0;
  const y = meta.y ?? 0;
  return `<figure class="editor-image" contenteditable="false" data-image-id="${escapeHtml(crypto.randomUUID())}" data-width="${width}" data-x="${x}" data-y="${y}" style="width:${width}px;left:${x}px;top:${y}px"><img src="${escapeHtml(meta.src)}" alt="Imagem colada" draggable="false" /><button class="image-resize-handle" type="button" tabindex="-1" aria-label="Redimensionar imagem"></button></figure>`;
};

const renderInlineNoteSpan = (meta: InlineNoteMeta) => `<span class="inline-note" data-note-id="${escapeHtml(crypto.randomUUID())}" data-note-content="${encodeURIComponent(meta.note)}" contenteditable="false">${escapeHtml(meta.text)}</span>`;

const renderAnnotationNode = (meta: AnnotationMeta) => {
  const geometry = encodeURIComponent(JSON.stringify(meta.geometry));
  return `<div class="editor-annotation" contenteditable="false" data-annotation-id="${escapeHtml(crypto.randomUUID())}" data-annotation-type="${meta.annotationType}" data-color="${meta.color}" data-stroke-width="${meta.strokeWidth}" data-x="${meta.x}" data-y="${meta.y}" data-width="${meta.width}" data-height="${meta.height}" data-geometry="${geometry}" style="left:${meta.x}px;top:${meta.y}px;width:${meta.width}px;height:${meta.height}px">${renderAnnotationSvg(meta)}</div>`;
};

const extractAnnotationMeta = (node: HTMLElement): AnnotationMeta => ({
  annotationType: (node.dataset.annotationType as AnnotationType) ?? "pen",
  color: node.dataset.color ?? "#12355b",
  strokeWidth: parseInt(node.dataset.strokeWidth ?? "4", 10) || 4,
  x: parseInt(node.dataset.x ?? "0", 10) || 0,
  y: parseInt(node.dataset.y ?? "0", 10) || 0,
  width: parseInt(node.dataset.width ?? "12", 10) || 12,
  height: parseInt(node.dataset.height ?? "12", 10) || 12,
  geometry: JSON.parse(decodeURIComponent(node.dataset.geometry ?? "%7B%7D")) as AnnotationGeometry
});

const extractInlineNoteMeta = (node: HTMLElement): InlineNoteMeta => ({
  text: node.textContent ?? "",
  note: decodeURIComponent(node.dataset.noteContent ?? "")
});

const encodeNoteToken = (meta: InlineNoteMeta) => `text=${encodeURIComponent(meta.text)};note=${encodeURIComponent(meta.note)}`;

const decodeNoteToken = (token: string): InlineNoteMeta | null => {
  const meta: Partial<InlineNoteMeta> = {};
  for (const part of token.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const value = decodeURIComponent(rest.join("="));
    if (key === "text") meta.text = value;
    if (key === "note") meta.note = value;
  }
  return meta.text && meta.note ? { text: meta.text, note: meta.note } : null;
};

const encodeImageToken = (meta: ImageMeta) => {
  const parts = [`src=${encodeURIComponent(meta.src)}`];
  if (meta.width) parts.push(`width=${Math.round(meta.width)}`);
  if (Number.isFinite(meta.x)) parts.push(`x=${Math.round(meta.x ?? 0)}`);
  if (Number.isFinite(meta.y)) parts.push(`y=${Math.round(meta.y ?? 0)}`);
  return parts.join(";");
};

const decodeImageToken = (token: string): ImageMeta | null => {
  const meta: ImageMeta = { src: "", x: 0, y: 0 };
  for (const part of token.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const value = decodeURIComponent(rest.join("="));
    if (key === "src") meta.src = value;
    if (key === "width") meta.width = parseInt(value, 10) || undefined;
    if (key === "x") meta.x = parseInt(value, 10) || 0;
    if (key === "y") meta.y = parseInt(value, 10) || 0;
  }
  return meta.src ? meta : null;
};

const encodeAnnotationToken = (meta: AnnotationMeta) => {
  const geometry = encodeURIComponent(JSON.stringify(meta.geometry));
  return `type=${meta.annotationType};color=${encodeURIComponent(meta.color)};strokeWidth=${Math.round(meta.strokeWidth)};x=${Math.round(meta.x)};y=${Math.round(meta.y)};width=${Math.round(meta.width)};height=${Math.round(meta.height)};geometry=${geometry}`;
};

const decodeAnnotationToken = (token: string): AnnotationMeta | null => {
  const meta: Partial<AnnotationMeta> = {};
  for (const part of token.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const value = decodeURIComponent(rest.join("="));
    if (key === "type" && (value === "pen" || value === "arrow" || value === "square" || value === "circle")) meta.annotationType = value as AnnotationType;
    if (key === "color") meta.color = value;
    if (key === "strokeWidth") meta.strokeWidth = parseInt(value, 10) || 4;
    if (key === "x") meta.x = parseInt(value, 10) || 0;
    if (key === "y") meta.y = parseInt(value, 10) || 0;
    if (key === "width") meta.width = parseInt(value, 10) || 12;
    if (key === "height") meta.height = parseInt(value, 10) || 12;
    if (key === "geometry") meta.geometry = JSON.parse(value) as AnnotationGeometry;
  }
  return meta.annotationType && meta.color && meta.geometry
    ? { annotationType: meta.annotationType, color: meta.color, strokeWidth: meta.strokeWidth ?? 4, x: meta.x ?? 0, y: meta.y ?? 0, width: meta.width ?? 12, height: meta.height ?? 12, geometry: meta.geometry }
    : null;
};

const renderAnnotationSvg = (meta: AnnotationMeta) => {
  const strokeWidth = Math.max(1, meta.strokeWidth);

  if (meta.annotationType === "pen") {
    const points = (meta.geometry.points ?? []).map((point) => `${point.x},${point.y}`).join(" ");
    return `<svg viewBox="0 0 ${meta.width} ${meta.height}" width="100%" height="100%" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${meta.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
  }

  if (meta.annotationType === "arrow") {
    const start = { x: meta.geometry.startX ?? 0, y: meta.geometry.startY ?? 0 };
    const end = { x: meta.geometry.endX ?? meta.width, y: meta.geometry.endY ?? meta.height };
    const head = getArrowHeadPoints(start, end, Math.max(10, strokeWidth * 3));
    return `<svg viewBox="0 0 ${meta.width} ${meta.height}" width="100%" height="100%" aria-hidden="true"><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${meta.color}" stroke-width="${strokeWidth}" stroke-linecap="round" /><polygon points="${head}" fill="${meta.color}" /></svg>`;
  }

  const start = { x: meta.geometry.startX ?? strokeWidth, y: meta.geometry.startY ?? strokeWidth };
  const end = { x: meta.geometry.endX ?? meta.width - strokeWidth, y: meta.geometry.endY ?? meta.height - strokeWidth };
  const shapeWidth = Math.max(4, end.x - start.x);
  const shapeHeight = Math.max(4, end.y - start.y);

  if (meta.annotationType === "square") {
    return `<svg viewBox="0 0 ${meta.width} ${meta.height}" width="100%" height="100%" aria-hidden="true"><rect x="${start.x}" y="${start.y}" width="${shapeWidth}" height="${shapeHeight}" rx="4" ry="4" fill="none" stroke="${meta.color}" stroke-width="${strokeWidth}" /></svg>`;
  }

  const radius = Math.max(2, Math.min(shapeWidth, shapeHeight) / 2);
  const centerX = start.x + shapeWidth / 2;
  const centerY = start.y + shapeHeight / 2;
  return `<svg viewBox="0 0 ${meta.width} ${meta.height}" width="100%" height="100%" aria-hidden="true"><circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${meta.color}" stroke-width="${strokeWidth}" /></svg>`;
};

const getArrowHeadPoints = (start: { x: number; y: number }, end: { x: number; y: number }, size: number) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const left = { x: end.x - size * Math.cos(angle - Math.PI / 6), y: end.y - size * Math.sin(angle - Math.PI / 6) };
  const right = { x: end.x - size * Math.cos(angle + Math.PI / 6), y: end.y - size * Math.sin(angle + Math.PI / 6) };
  return `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`;
};

const nodeToMarkdown = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.matches("figure.editor-image")) {
    const src = node.querySelector("img")?.getAttribute("src") ?? "";
    return src ? `![Imagem](${src})\n\n` : "";
  }
  if (node.matches("div.editor-annotation")) {
    return "";
  }
  if (node.tagName === "BR") return "\n";

  const inline = Array.from(node.childNodes).map(nodeToMarkdown).join("");
  switch (node.tagName) {
    case "H1": return `# ${inline.trim()}\n\n`;
    case "H2": return `## ${inline.trim()}\n\n`;
    case "H3": return `### ${inline.trim()}\n\n`;
    case "STRONG":
    case "B": return `**${inline}**`;
    case "EM":
    case "I": return `*${inline}*`;
    case "CODE": return `\`${inline}\``;
    case "BLOCKQUOTE": return inline.trim().split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
    case "UL": return Array.from(node.children).map((item) => `- ${nodeToMarkdown(item).trim()}`).join("\n") + "\n\n";
    case "LI": return inline;
    case "P":
    case "DIV": return `${inline.trim()}\n\n`;
    default: return inline;
  }
};






