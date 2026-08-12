import type jsPDF from "jspdf";

// Every document type (Invoice, Estimate, Sale Order, Purchase, Purchase
// Order, Delivery Note, Sale Return, Purchase Return) used to build its own
// jsPDF layout from scratch — plain black text, no branding, no borders, a
// bare autoTable dump that left 90% of the page blank. This is the one
// shared, properly laid-out template every document now renders through, so
// what a customer actually receives looks like a real business document
// instead of a debug printout.

// UNI Invoice's Template setting offers an XS/S/M/L/XL text-size control —
// a simple global font-scale multiplier, not distinct layouts.
export const TEXT_SCALE: Record<string, number> = { XS: 0.85, S: 0.92, M: 1, L: 1.08, XL: 1.18 };

const THEME_HEX: Record<string, { primary: [number, number, number]; accent: [number, number, number] }> = {
  prestige: { primary: [13, 92, 71], accent: [31, 138, 107] },
  emerald: { primary: [21, 128, 61], accent: [34, 197, 94] },
  blue: { primary: [29, 78, 216], accent: [59, 130, 246] },
  gold: { primary: [146, 64, 14], accent: [212, 160, 23] },
};

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resolveColors(data: PdfDocData) {
  const preset = THEME_HEX[data.theme ?? "prestige"] ?? THEME_HEX.prestige;
  if (!data.customColors) return preset;
  const primary = hexToRgb(data.customColors.primary) ?? preset.primary;
  const accent = hexToRgb(data.customColors.accent) ?? preset.accent;
  return { primary, accent };
}

export type PdfLineItem = { name: string; qty: number; rate: number; discount: number };

export type PdfDocData = {
  documentTitle: string;
  documentNumber: string;
  dateLabel: string;
  dateValue: string;
  secondDateLabel?: string;
  secondDateValue?: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessTaxId?: string;
  logoDataUrl?: string;
  partyLabel: "Bill To" | "Bill From";
  partyName: string;
  partyAddress?: string;
  partyPhone?: string;
  items: PdfLineItem[];
  /** Delivery notes track quantity, not money — set false to render a plain
   * Description/Qty table with no rate/discount/totals section at all. */
  showPricing?: boolean;
  discountAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  taxInclusive?: boolean;
  shippingAmount?: number;
  total?: number;
  balance?: number;
  status?: string;
  notes?: string;
  terms?: string;
  currencySymbol: string;
  theme?: string;
  /** Overrides the theme preset with exact hex colors — set from Settings ▸
   * Template Setting's custom color pickers. Falls back to the theme preset
   * whenever a value is missing or fails to parse as #rrggbb. */
  customColors?: { primary: string; accent: string } | null;
  /** Extra line rendered under the business name in the header band, e.g. a
   * tagline or slogan ("what to write at the top"). */
  headerTagline?: string;
  /** Replaces the default "Thank you for your business." footer line
   * ("what to write at the bottom"). */
  footerText?: string;
  /** Hides the colored header band (business name/contact/logo + document
   * title) entirely, leaving headerHeightMm of blank space at the top
   * instead — for letterhead paper that already has its own header printed. */
  hideHeader?: boolean;
  headerHeightMm?: number;
  /** A background graphic (any uploaded PNG/JPG) placed behind the document
   * content at low opacity — UNI Invoice's own Template setting calls this
   * a "watermark": pick an image, a corner/center position, and how faint
   * it should be. */
  watermarkUrl?: string;
  watermarkPosition?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  watermarkOpacity?: number;
  /** Global font-scale multiplier — UNI Invoice's XS/S/M/L/XL text size
   * control. 1 = unchanged. */
  textScale?: number;
};

async function drawWatermark(doc: jsPDF, data: PdfDocData, pageWidth: number, bodyTop: number, bodyBottom: number) {
  if (!data.watermarkUrl) return;
  try {
    const { GState } = await import("jspdf");
    const size = Math.min(70, pageWidth * 0.4, Math.max(20, bodyBottom - bodyTop) * 0.6);
    const inset = 10;
    const positions: Record<string, [number, number]> = {
      center: [pageWidth / 2 - size / 2, bodyTop + (bodyBottom - bodyTop) / 2 - size / 2],
      "top-left": [inset, bodyTop + inset],
      "top-right": [pageWidth - inset - size, bodyTop + inset],
      "bottom-left": [inset, bodyBottom - inset - size],
      "bottom-right": [pageWidth - inset - size, bodyBottom - inset - size],
    };
    const [x, y] = positions[data.watermarkPosition ?? "bottom-right"] ?? positions["bottom-right"];
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: Math.max(0.03, Math.min(1, (data.watermarkOpacity ?? 15) / 100)) }));
    doc.addImage(data.watermarkUrl, "PNG", x, y, size, size);
    doc.restoreGraphicsState();
  } catch { /* unsupported image format/CORS — skip rather than break the whole document */ }
}

export async function buildDocumentPdf(data: PdfDocData): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const colors = resolveColors(data);
  const symbol = /^[\x00-\x7F]*$/.test(data.currencySymbol) ? data.currencySymbol : "Rs";
  const money = (n: number) => `${symbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const scale = data.textScale ?? 1;
  const fs = (n: number) => n * scale;

  const doc = new JsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  await drawWatermark(doc, data, pageWidth, 0, pageHeight - 20);

  // A custom header tagline needs an extra line of room — every fixed
  // header/date/party/table coordinate below shifts down by this amount so
  // the tagline never collides with the address/contact lines under it.
  const shift = data.headerTagline ? 4 : 0;
  // "Hide Header" leaves headerHeightMm of blank space instead of the
  // colored band — for letterhead paper that already has its own header.
  const bandHeight = data.hideHeader ? Math.max(4, data.headerHeightMm ?? 12) : 36 + shift;

  if (!data.hideHeader) {
    // Header band
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, bandHeight, "F");
    if (data.logoDataUrl) {
      try { doc.addImage(data.logoDataUrl, "PNG", marginX, 6, 20, 20); } catch { /* unsupported image format — skip */ }
    }
    const textX = data.logoDataUrl ? marginX + 24 : marginX;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(fs(16));
    doc.setFont("helvetica", "bold");
    doc.text(data.businessName || "Your Business", textX, 15);
    doc.setFontSize(fs(8.5));
    doc.setFont("helvetica", "normal");
    // Each held to a single line (long addresses truncated rather than
    // wrapped) so they can never collide inside this fixed-height header band.
    const oneLine = (s: string, maxWidth: number) => doc.splitTextToSize(s, maxWidth)[0];
    const headerTextWidth = pageWidth - textX - marginX - 60;
    let headerY = 15;
    if (data.headerTagline) {
      headerY += 4;
      doc.setFont("helvetica", "italic");
      doc.text(oneLine(data.headerTagline, headerTextWidth), textX, headerY);
      doc.setFont("helvetica", "normal");
    }
    if (data.businessAddress) doc.text(oneLine(data.businessAddress, headerTextWidth), textX, headerY + 5);
    const contactLine = [data.businessPhone, data.businessEmail].filter(Boolean).join("  ·  ");
    if (contactLine) doc.text(oneLine(contactLine, headerTextWidth), textX, headerY + 10);
    if (data.businessTaxId) doc.text(`Tax ID: ${data.businessTaxId}`, textX, headerY + 15);

    doc.setFontSize(fs(15));
    doc.setFont("helvetica", "bold");
    doc.text(data.documentTitle.toUpperCase(), pageWidth - marginX, 14, { align: "right" });
    doc.setFontSize(fs(9));
    doc.setFont("helvetica", "normal");
    doc.text(`# ${data.documentNumber}`, pageWidth - marginX, 20, { align: "right" });
    if (data.status) doc.text(data.status, pageWidth - marginX, 26, { align: "right" });
  }

  // Date block + party block
  const afterHeaderY = bandHeight + 10;
  let y = afterHeaderY;
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(fs(9));
  doc.text(data.dateLabel, pageWidth - marginX - 45, y);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.text(data.dateValue, pageWidth - marginX, y, { align: "right" });
  if (data.secondDateLabel) {
    y += 6;
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.text(data.secondDateLabel, pageWidth - marginX - 45, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(data.secondDateValue || "-", pageWidth - marginX, y, { align: "right" });
  }

  doc.setTextColor(...colors.primary);
  doc.setFontSize(fs(9));
  doc.setFont("helvetica", "bold");
  doc.text(data.partyLabel.toUpperCase(), marginX, afterHeaderY);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(fs(11));
  doc.text(data.partyName || "-", marginX, afterHeaderY + 7);
  doc.setFontSize(fs(8.5));
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  let partyY = afterHeaderY + 12;
  if (data.partyAddress) {
    const addressLines = doc.splitTextToSize(data.partyAddress, 90);
    doc.text(addressLines, marginX, partyY);
    partyY += addressLines.length * 4.2 + 1;
  }
  if (data.partyPhone) doc.text(data.partyPhone, marginX, partyY);

  // Items table
  const showPricing = data.showPricing !== false;
  const tableStartY = bandHeight + 40;
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginX, right: marginX },
    head: showPricing ? [["#", "Description", "Qty", "Rate", "Disc", "Amount"]] : [["#", "Description", "Qty"]],
    body: data.items.map((it, i) => showPricing
      ? [String(i + 1), it.name, String(it.qty), money(it.rate), it.discount ? `${it.discount}%` : "-", money(it.qty * it.rate * (1 - it.discount / 100))]
      : [String(i + 1), it.name, String(it.qty)]),
    styles: { fontSize: fs(9), cellPadding: 3 },
    headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 247, 245] },
    columnStyles: showPricing ? {
      0: { cellWidth: 10 },
      2: { halign: "right", cellWidth: 16 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 30 },
    } : {
      0: { cellWidth: 10 },
      2: { halign: "right", cellWidth: 20 },
    },
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (showPricing) {
    // Totals box, right-aligned
    const boxW = 78;
    const boxX = pageWidth - marginX - boxW;
    // `discountAmount` below is line+document discount combined (matches
    // calcInvoiceTotals' `discount`), so Base Amount here must be the raw
    // pre-discount subtotal — subtracting a per-item discount into this
    // figure too double-counts it against Discount, understating the
    // printed Total by the line-discount amount versus the real total.
    const baseAmount = data.items.reduce((s, it) => s + it.qty * it.rate, 0);
    const totalsLines: [string, string][] = [["Base Amount", money(baseAmount)]];
    if (data.discountAmount) totalsLines.push(["Discount", `- ${money(data.discountAmount)}`]);
    totalsLines.push([`Tax${data.taxRate ? ` (${data.taxRate}%${data.taxInclusive ? ", incl." : ""})` : ""}`, money(data.taxAmount ?? 0)]);
    if (data.shippingAmount) totalsLines.push(["Shipping", money(data.shippingAmount)]);

    doc.setFontSize(fs(9));
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    for (const [label, value] of totalsLines) {
      doc.text(label, boxX, finalY);
      doc.text(value, pageWidth - marginX, finalY, { align: "right" });
      finalY += 6;
    }

    doc.setFillColor(...colors.primary);
    doc.rect(boxX - 4, finalY - 2, boxW + 4, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(fs(11));
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", boxX, finalY + 5);
    doc.text(money(data.total ?? 0), pageWidth - marginX, finalY + 5, { align: "right" });
    finalY += 12;

    if (data.balance !== undefined && data.balance !== data.total) {
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(fs(9.5));
      doc.text("Balance due", boxX, finalY);
      doc.text(money(data.balance), pageWidth - marginX, finalY, { align: "right" });
      finalY += 8;
    }
  } else {
    const totalQty = data.items.reduce((s, it) => s + it.qty, 0);
    doc.setTextColor(...colors.primary);
    doc.setFontSize(fs(10));
    doc.setFont("helvetica", "bold");
    doc.text(`Total Quantity: ${totalQty}`, pageWidth - marginX, finalY, { align: "right" });
    finalY += 8;
  }

  finalY += 4;

  if (data.notes) {
    doc.setTextColor(...colors.primary);
    doc.setFontSize(fs(9));
    doc.setFont("helvetica", "bold");
    doc.text("NOTES", marginX, finalY);
    finalY += 5;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs(8.5));
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - marginX * 2);
    doc.text(noteLines, marginX, finalY);
    finalY += noteLines.length * 4.5 + 4;
  }

  if (data.terms) {
    doc.setTextColor(...colors.primary);
    doc.setFontSize(fs(9));
    doc.setFont("helvetica", "bold");
    doc.text("TERMS & CONDITIONS", marginX, finalY);
    finalY += 5;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs(8.5));
    const termLines = doc.splitTextToSize(data.terms, pageWidth - marginX * 2);
    doc.text(termLines, marginX, finalY);
  }

  doc.setDrawColor(...colors.accent);
  doc.setLineWidth(0.5);
  doc.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16);
  doc.setTextColor(140, 140, 140);
  doc.setFontSize(fs(8));
  doc.setFont("helvetica", "italic");
  doc.text(data.footerText || "Thank you for your business.", marginX, pageHeight - 10);
  doc.text(data.businessName || "", pageWidth - marginX, pageHeight - 10, { align: "right" });

  return doc;
}

export type ReceiptOptions = {
  /** Paper width in mm — any value the shop's printer actually uses, not
   * limited to the 58/80mm presets ("Photoshop custom size" style). */
  widthMm: number;
  /** When true (the default for receipt mode), the page grows downward as
   * more items are added instead of staying a fixed rectangle. When false,
   * the page is clipped/padded to fixedHeightMm regardless of item count. */
  dynamicHeight?: boolean;
  fixedHeightMm?: number;
};

function drawReceipt(doc: jsPDF, data: PdfDocData, width: number, colors: { primary: [number, number, number]; accent: [number, number, number] }, money: (n: number) => string): number {
  const marginX = 3;
  const contentWidth = width - marginX * 2;
  const center = width / 2;
  let y = 8;

  const dashedLine = () => {
    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, width - marginX, y);
    doc.setLineDashPattern([], 0);
    y += 4;
  };

  doc.setTextColor(...colors.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const nameLines = doc.splitTextToSize(data.businessName || "Your Business", contentWidth);
  doc.text(nameLines, center, y, { align: "center" });
  y += nameLines.length * 4.6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  if (data.headerTagline) {
    const t = doc.splitTextToSize(data.headerTagline, contentWidth);
    doc.text(t, center, y, { align: "center" });
    y += t.length * 3.4;
  }
  doc.setFont("helvetica", "normal");
  for (const line of [data.businessAddress, [data.businessPhone, data.businessEmail].filter(Boolean).join(" · ")]) {
    if (!line) continue;
    const l = doc.splitTextToSize(line, contentWidth);
    doc.text(l, center, y, { align: "center" });
    y += l.length * 3.4;
  }
  if (data.businessTaxId) { doc.text(`Tax ID: ${data.businessTaxId}`, center, y, { align: "center" }); y += 3.4; }
  y += 2;
  dashedLine();

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(data.documentTitle.toUpperCase(), marginX, y);
  doc.text(`#${data.documentNumber}`, width - marginX, y, { align: "right" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`${data.dateLabel}: ${data.dateValue}`, marginX, y);
  y += 3.6;
  if (data.status) { doc.text(`Status: ${data.status}`, marginX, y); y += 3.6; }
  doc.setFont("helvetica", "bold");
  doc.text(`${data.partyLabel}: ${data.partyName || "-"}`, marginX, y);
  y += 3.6;
  doc.setFont("helvetica", "normal");
  if (data.partyPhone) { doc.text(data.partyPhone, marginX, y); y += 3.6; }
  y += 1;
  dashedLine();

  const showPricing = data.showPricing !== false;
  doc.setFontSize(7.5);
  for (const it of data.items) {
    doc.setFont("helvetica", "bold");
    const nameL = doc.splitTextToSize(it.name, contentWidth);
    doc.text(nameL, marginX, y);
    y += nameL.length * 3.4;
    doc.setFont("helvetica", "normal");
    if (showPricing) {
      const amount = it.qty * it.rate * (1 - it.discount / 100);
      doc.text(`${it.qty} x ${money(it.rate)}${it.discount ? ` (-${it.discount}%)` : ""}`, marginX, y);
      doc.text(money(amount), width - marginX, y, { align: "right" });
    } else {
      doc.text(`Qty: ${it.qty}`, width - marginX, y, { align: "right" });
    }
    y += 4;
  }
  y += 1;
  dashedLine();

  if (showPricing) {
    // `discountAmount` below is line+document discount combined (matches
    // calcInvoiceTotals' `discount`), so Base Amount here must be the raw
    // pre-discount subtotal — subtracting a per-item discount into this
    // figure too double-counts it against Discount, understating the
    // printed Total by the line-discount amount versus the real total.
    const baseAmount = data.items.reduce((s, it) => s + it.qty * it.rate, 0);
    doc.setFont("helvetica", "normal");
    const rows: [string, string][] = [["Base Amount", money(baseAmount)]];
    if (data.discountAmount) rows.push(["Discount", `-${money(data.discountAmount)}`]);
    rows.push([`Tax${data.taxRate ? ` (${data.taxRate}%)` : ""}`, money(data.taxAmount ?? 0)]);
    if (data.shippingAmount) rows.push(["Shipping", money(data.shippingAmount)]);
    for (const [label, value] of rows) {
      doc.text(label, marginX, y);
      doc.text(value, width - marginX, y, { align: "right" });
      y += 3.8;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TOTAL", marginX, y);
    doc.text(money(data.total ?? 0), width - marginX, y, { align: "right" });
    y += 5;
    if (data.balance !== undefined && data.balance !== data.total) {
      doc.setFontSize(7.5);
      doc.text("Balance due", marginX, y);
      doc.text(money(data.balance), width - marginX, y, { align: "right" });
      y += 4;
    }
  } else {
    const totalQty = data.items.reduce((s, it) => s + it.qty, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Qty: ${totalQty}`, width - marginX, y, { align: "right" });
    y += 5;
  }

  if (data.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const n = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(n, marginX, y);
    y += n.length * 3.2 + 2;
  }

  y += 1;
  dashedLine();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  const footer = doc.splitTextToSize(data.footerText || "Thank you for your business.", contentWidth);
  doc.text(footer, center, y, { align: "center" });
  y += footer.length * 3.4 + 4;

  return y;
}

/**
 * Renders a narrow, thermal-receipt-style document at any custom width
 * (not just the 58/80mm presets) whose page length grows downward as more
 * items are added, instead of staying a fixed A4-shaped rectangle — the
 * "Photoshop custom size" print mode requested for shops (e.g. medical
 * stores) whose printers don't use a standard named paper size.
 */
export async function buildReceiptPdf(data: PdfDocData, opts: ReceiptOptions): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const colors = resolveColors(data);
  const symbol = /^[\x00-\x7F]*$/.test(data.currencySymbol) ? data.currencySymbol : "Rs";
  const money = (n: number) => `${symbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const width = Math.max(30, opts.widthMm || 80);

  if (opts.dynamicHeight === false) {
    const height = Math.max(40, opts.fixedHeightMm || 200);
    const doc = new JsPDF({ unit: "mm", format: [width, height] });
    drawReceipt(doc, data, width, colors, money);
    return doc;
  }

  // Two-pass: measure the real content height on a tall scratch page, then
  // rebuild the page at exactly that height so it always fits — this is
  // what makes 2 items render a short receipt and 50 items a long one.
  const scratch = new JsPDF({ unit: "mm", format: [width, 2000] });
  const measuredY = drawReceipt(scratch, data, width, colors, money);
  const doc = new JsPDF({ unit: "mm", format: [width, measuredY + 4] });
  drawReceipt(doc, data, width, colors, money);
  return doc;
}
