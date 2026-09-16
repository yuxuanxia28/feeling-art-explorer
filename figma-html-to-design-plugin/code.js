figma.showUI(__html__, { width: 420, height: 620, themeColors: true });

const FONT = { family: "Inter", style: "Regular" };
const BOLD_FONT = { family: "Inter", style: "Medium" };

function rgbaToPaint(color) {
  if (!color || color === "transparent") return null;
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map(part => part.trim());
  const r = Number(parts[0]) / 255;
  const g = Number(parts[1]) / 255;
  const b = Number(parts[2]) / 255;
  const a = parts[3] == null ? 1 : Number(parts[3]);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || a === 0) return null;
  return { type: "SOLID", color: { r, g, b }, opacity: Math.max(0, Math.min(1, a)) };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorPaint(color, fallback) {
  return rgbaToPaint(color) || fallback;
}

function setCornerRadius(node, radius) {
  const next = Number(radius);
  if (Number.isFinite(next)) node.cornerRadius = clamp(next, 0, 80);
}

async function createText(parent, item, scale) {
  await figma.loadFontAsync(FONT);
  await figma.loadFontAsync(BOLD_FONT);

  const node = figma.createText();
  node.name = item.name || "Text";
  node.x = item.x * scale;
  node.y = item.y * scale;
  node.resize(Math.max(1, item.width * scale), Math.max(1, item.height * scale));
  node.characters = item.text || "Text";
  node.fontName = item.fontWeight >= 500 ? BOLD_FONT : FONT;
  node.fontSize = clamp((item.fontSize || 14) * scale, 6, 96);
  node.lineHeight = { unit: "AUTO" };
  node.fills = [colorPaint(item.color, { type: "SOLID", color: { r: 0.05, g: 0.05, b: 0.05 } })];
  parent.appendChild(node);
}

function createBox(parent, item, scale) {
  const node = figma.createRectangle();
  node.name = item.name || item.tag || "Layer";
  node.x = item.x * scale;
  node.y = item.y * scale;
  node.resize(Math.max(1, item.width * scale), Math.max(1, item.height * scale));
  node.fills = [colorPaint(item.backgroundColor, { type: "SOLID", color: { r: 0.95, g: 0.96, b: 0.98 } })];
  setCornerRadius(node, (item.borderRadius || 0) * scale);

  const stroke = rgbaToPaint(item.borderColor);
  if (stroke) {
    node.strokes = [stroke];
    node.strokeWeight = Math.max(1, (item.borderWidth || 1) * scale);
  }
  parent.appendChild(node);
  return node;
}

async function importDesign(payload) {
  const width = payload.viewport?.width || 390;
  const height = payload.viewport?.height || 844;
  const scale = payload.scale || 1;

  const root = figma.createFrame();
  root.name = payload.name || "HTML Import";
  root.resize(width * scale, height * scale);
  root.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  root.clipsContent = true;

  const items = (payload.items || [])
    .filter(item => item.width > 0 && item.height > 0)
    .sort((a, b) => (a.depth - b.depth) || ((a.area || 0) - (b.area || 0)));

  for (const item of items) {
    if (item.type === "text") {
      await createText(root, item, scale);
    } else {
      createBox(root, item, scale);
    }
  }

  figma.currentPage.appendChild(root);
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.notify(`Imported ${items.length} editable layers`);
}

figma.ui.onmessage = async message => {
  if (message.type === "import-design") {
    try {
      await importDesign(message.payload);
      figma.ui.postMessage({ type: "done" });
    } catch (error) {
      figma.ui.postMessage({ type: "error", message: error.message || String(error) });
    }
  }

  if (message.type === "cancel") {
    figma.closePlugin();
  }
};
