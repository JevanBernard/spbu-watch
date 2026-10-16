import type { CardModel, CardTone } from "./share-card";

export type CardFormat = "story" | "square";

export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 }, // Instagram Story and other vertical formats
  square: { w: 1080, h: 1080 }, // feed posts, WhatsApp, X
};

const COLOR = {
  primary: "#006194",
  primaryFixed: "#cce5ff",
  ink: "#131b2e",
  slate: "#475569",
  line: "#cbd5e1",
  white: "#ffffff",
  amberBg: "#fef3c7",
  amberText: "#92400e",
};
const TONE: Record<CardTone, { fg: string; bg: string }> = {
  good: { fg: "#047857", bg: "#ecfdf5" },
  warn: { fg: "#b45309", bg: "#fffbeb" },
  bad: { fg: "#b91c1c", bg: "#fef2f2" },
  neutral: { fg: "#475569", bg: "#f1f5f9" },
};

const PAD_X = 72;
const SCALES = [1, 0.92, 0.85, 0.78, 0.7]; // the text is shrunk step by step until everything fits

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Word-wraps `text` to at most `maxLines` lines of `maxWidth`; the last line ends in "…" when it was cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      line = words.slice(i).join(" ");
      break;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  const last = lines.length - 1;
  if (last >= 0 && ctx.measureText(lines[last]).width > maxWidth) {
    let cut = lines[last];
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    lines[last] = `${cut.trimEnd()}…`;
  }
  return lines;
}

function bars(ctx: CanvasRenderingContext2D, cx: number, cy: number, tone: CardTone, size: number, font: string) {
  ctx.fillStyle = COLOR.white;
  if (tone === "neutral") {
    ctx.font = `700 ${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", cx, cy + size * 0.04);
    ctx.textAlign = "left";
    return;
  }
  const n = tone === "good" ? 1 : tone === "warn" ? 2 : 3;
  const w = size * 0.2;
  const gap = size * 0.12;
  const total = n * w + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    const h = size * (0.34 + i * 0.2);
    roundRect(ctx, cx - total / 2 + i * (w + gap), cy + size * 0.38 - h, w, h, w * 0.25);
    ctx.fill();
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Draws (or, when `paint` is false, only measures) the whole card and returns the y where the content ends. */
function layout(
  ctx: CanvasRenderingContext2D,
  card: CardModel,
  format: CardFormat,
  scale: number,
  font: string,
  qr: HTMLImageElement | null,
  paint: boolean,
): { contentEnd: number; footerTop: number } {
  const { w, h } = CARD_SIZE[format];
  const story = format === "story";
  const s = (n: number) => Math.round(n * scale * (story ? 1 : 0.84));
  const innerW = w - PAD_X * 2;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // ---- footer first, because it is anchored to the bottom and tells how much room the content has
  const qrSize = story ? 250 : 210;
  const bottom = story ? h - 230 : h - 60; // keep clear of the Story app's own buttons
  const footerW = innerW - qrSize - 36;
  const small = s(27);
  ctx.font = `600 ${small}px ${font}`;
  const discLines = wrap(ctx, card.disclaimer, footerW - 40, 4);
  ctx.font = `500 ${s(25)}px ${font}`;
  const noteLines = card.note ? wrap(ctx, card.note, footerW, 4) : [];
  const stampH = card.stamp ? s(40) : 0;
  const noteH = noteLines.length * s(33) + (noteLines.length ? 14 : 0);
  const discH = discLines.length * s(34) + 32;
  const footerH = Math.max(qrSize + s(40), stampH + noteH + discH);
  const footerTop = bottom - footerH;

  if (paint) {
    let fy = footerTop;
    if (card.stamp) {
      ctx.fillStyle = COLOR.ink;
      ctx.font = `700 ${s(29)}px ${font}`;
      ctx.fillText(card.stamp, PAD_X, fy + s(30));
      fy += stampH;
    }
    if (noteLines.length) {
      ctx.fillStyle = COLOR.slate;
      ctx.font = `500 ${s(25)}px ${font}`;
      noteLines.forEach((l, i) => ctx.fillText(l, PAD_X, fy + s(26) + i * s(33)));
      fy += noteH;
    }
    ctx.fillStyle = COLOR.amberBg;
    roundRect(ctx, PAD_X, fy, footerW, discH, 22);
    ctx.fill();
    ctx.fillStyle = COLOR.amberText;
    ctx.font = `600 ${small}px ${font}`;
    discLines.forEach((l, i) => ctx.fillText(l, PAD_X + 20, fy + 16 + s(26) + i * s(34)));

    // QR code on a white tile, with the address below it
    const qx = w - PAD_X - qrSize;
    const qy = bottom - qrSize - s(40);
    ctx.fillStyle = COLOR.white;
    roundRect(ctx, qx - 12, qy - 12, qrSize + 24, qrSize + 24, 24);
    ctx.fill();
    if (qr) ctx.drawImage(qr, qx, qy, qrSize, qrSize);
    ctx.fillStyle = COLOR.slate;
    ctx.font = `600 ${s(23)}px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(card.urlText, qx + qrSize / 2, bottom - 2);
    ctx.textAlign = "left";
  }

  // ---- content from the top
  let y = story ? 230 : 64;

  // brand row
  const mark = s(76);
  if (paint) {
    ctx.fillStyle = COLOR.primary;
    ctx.beginPath();
    ctx.arc(PAD_X + mark / 2, y + mark / 2, mark / 2, 0, Math.PI * 2);
    ctx.fill();
    bars(ctx, PAD_X + mark / 2, y + mark / 2, "bad", mark * 0.6, font);
    ctx.fillStyle = COLOR.primary;
    ctx.font = `700 ${s(38)}px ${font}`;
    ctx.fillText(card.eyebrow, PAD_X + mark + 22, y + mark / 2 + s(13));
  }
  y += mark + s(40);

  // title and subtitle
  ctx.font = `800 ${s(story ? 78 : 70)}px ${font}`;
  const titleLines = wrap(ctx, card.title, innerW, story ? 4 : 3);
  const titleLH = s(story ? 90 : 80);
  if (paint) {
    ctx.fillStyle = COLOR.ink;
    titleLines.forEach((l, i) => ctx.fillText(l, PAD_X, y + s(story ? 70 : 62) + i * titleLH));
  }
  y += titleLines.length * titleLH + s(14);

  if (card.subtitle) {
    ctx.font = `500 ${s(38)}px ${font}`;
    const lines = wrap(ctx, card.subtitle, innerW, 2);
    if (paint) {
      ctx.fillStyle = COLOR.slate;
      lines.forEach((l, i) => ctx.fillText(l, PAD_X, y + s(34) + i * s(48)));
    }
    y += lines.length * s(48) + s(22);
  }

  // badges and the open / closed line
  if (card.badges.length || card.open) {
    let x = PAD_X;
    const ph = s(58);
    ctx.font = `700 ${s(28)}px ${font}`;
    const pill = (label: string, fill: string, fg: string, stroke?: string) => {
      const pw = ctx.measureText(label).width + s(44);
      if (paint) {
        ctx.fillStyle = fill;
        roundRect(ctx, x, y, pw, ph, ph / 2);
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.fillStyle = fg;
        ctx.fillText(label, x + s(22), y + ph / 2 + s(10));
      }
      x += pw + 14;
    };
    card.badges.forEach((b, i) => (i === 0 ? pill(b, COLOR.primary, COLOR.white) : pill(b, TONE.good.bg, TONE.good.fg, TONE.good.fg)));
    if (card.open) {
      ctx.font = `700 ${s(28)}px ${font}`;
      const tone = TONE[card.open.tone];
      const label = `${card.open.tone === "good" ? "✓" : "✕"} ${card.open.title}`;
      // long labels ("Tutup menurut laporan warga (10 menit lalu)") go on their own line
      if (x + ctx.measureText(label).width + s(44) > w - PAD_X) {
        y += ph + 12;
        x = PAD_X;
      }
      pill(label, tone.bg, tone.fg, tone.fg);
    }
    y += ph + s(34);
  }

  // queue block
  if (card.queue) {
    const bh = story ? s(230) : s(200);
    const tone = TONE[card.queue.tone];
    if (paint) {
      ctx.fillStyle = tone.bg;
      roundRect(ctx, PAD_X, y, innerW, bh, 36);
      ctx.fill();
      ctx.strokeStyle = tone.fg;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const r = bh * 0.3;
      ctx.fillStyle = tone.fg;
      ctx.beginPath();
      ctx.arc(PAD_X + 40 + r, y + bh / 2, r, 0, Math.PI * 2);
      ctx.fill();
      bars(ctx, PAD_X + 40 + r, y + bh / 2, card.queue.tone, r * 1.1, font);
      const tx = PAD_X + 40 + r * 2 + 34;
      ctx.fillStyle = tone.fg;
      ctx.font = `800 ${s(58)}px ${font}`;
      ctx.fillText(card.queue.title, tx, y + bh / 2 - s(story ? 6 : 0));
      ctx.fillStyle = COLOR.slate;
      ctx.font = `500 ${s(31)}px ${font}`;
      wrap(ctx, card.queue.detail, w - PAD_X - 30 - tx, 2).forEach((l, i) =>
        ctx.fillText(l, tx, y + bh / 2 + s(story ? 44 : 40) + i * s(38)),
      );
    }
    y += bh + s(34);
  }

  // fuel rows (station) in two columns
  if (card.kind === "station") {
    const limit = story ? 6 : 4;
    const rows = card.rows.slice(0, limit);
    const gap = 22;
    const cw = (innerW - gap) / 2;
    const ch = s(story ? 176 : 150);
    if (rows.length === 0 && paint) {
      ctx.fillStyle = COLOR.slate;
      ctx.font = `500 ${s(34)}px ${font}`;
      ctx.fillText("Belum ada laporan stok untuk SPBU ini.", PAD_X, y + s(34));
    }
    rows.forEach((row, i) => {
      const x = PAD_X + (i % 2) * (cw + gap);
      const ry = y + Math.floor(i / 2) * (ch + gap);
      if (!paint) return;
      const tone = TONE[row.tone];
      ctx.fillStyle = tone.bg;
      roundRect(ctx, x, ry, cw, ch, 28);
      ctx.fill();
      ctx.strokeStyle = tone.fg;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR.ink;
      ctx.font = `700 ${s(36)}px ${font}`;
      ctx.fillText(row.name, x + 28, ry + s(52));
      ctx.fillStyle = tone.fg;
      ctx.font = `800 ${s(story ? 36 : 33)}px ${font}`;
      const mark = row.tone === "good" ? "✓ " : row.tone === "bad" ? "✕ " : "";
      ctx.fillText(wrap(ctx, mark + row.status, cw - 56, 1)[0], x + 28, ry + s(story ? 102 : 96));
      if (row.detail) {
        ctx.fillStyle = COLOR.slate;
        ctx.font = `500 ${s(24)}px ${font}`;
        ctx.fillText(wrap(ctx, row.detail, cw - 56, 1)[0], x + 28, ry + s(story ? 144 : 128));
      }
    });
    const lines = Math.ceil(rows.length / 2);
    y += lines ? lines * (ch + gap) : s(60);
    if (card.rows.length > limit) {
      if (paint) {
        ctx.fillStyle = COLOR.slate;
        ctx.font = `600 ${s(28)}px ${font}`;
        ctx.fillText(`dan ${card.rows.length - limit} jenis BBM lain di aplikasi`, PAD_X, y + s(26));
      }
      y += s(44);
    }
  }

  // bullets (app card)
  if (card.bullets.length) {
    y += s(20);
    ctx.font = `600 ${s(story ? 46 : 38)}px ${font}`;
    for (const b of card.bullets) {
      const lines = wrap(ctx, b, innerW - s(90), 2);
      if (paint) {
        ctx.fillStyle = TONE.good.fg;
        ctx.beginPath();
        ctx.arc(PAD_X + s(24), y + s(26), s(24), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLOR.white;
        ctx.lineWidth = s(5);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(PAD_X + s(14), y + s(26));
        ctx.lineTo(PAD_X + s(22), y + s(34));
        ctx.lineTo(PAD_X + s(35), y + s(18));
        ctx.stroke();
        ctx.fillStyle = COLOR.ink;
        ctx.font = `600 ${s(story ? 46 : 38)}px ${font}`;
        lines.forEach((l, i) => ctx.fillText(l, PAD_X + s(70), y + s(38) + i * s(54)));
      }
      y += lines.length * s(54) + s(30);
    }
  }

  return { contentEnd: y, footerTop };
}

/** Renders the share image as a PNG. Runs in the browser only (canvas, fonts, the QR code). */
export async function renderCardImage(card: CardModel, format: CardFormat): Promise<Blob> {
  const { w, h } = CARD_SIZE[format];
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  await Promise.all(["500", "600", "700", "800"].map((wt) => document.fonts.load(`${wt} 40px ${font}`).catch(() => [])));

  const QRCode = await import("qrcode");
  const qr = await loadImage(await QRCode.toDataURL(card.url, { width: 520, margin: 1, errorCorrectionLevel: "M" })).catch(() => null);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");

  // background
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#e0f2fe");
  g.addColorStop(0.45, "#f8fafc");
  g.addColorStop(1, "#f1f5f9");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLOR.primary;
  ctx.fillRect(0, 0, w, 14);

  // shrink the text until the content fits above the footer
  let scale = SCALES[SCALES.length - 1];
  for (const sc of SCALES) {
    const { contentEnd, footerTop } = layout(ctx, card, format, sc, font, qr, false);
    if (contentEnd <= footerTop - 24) {
      scale = sc;
      break;
    }
  }
  layout(ctx, card, format, scale, font, qr, true);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not make the image"))), "image/png");
  });
}
