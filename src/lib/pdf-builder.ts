import type jsPDF from "jspdf";

// Every document type (Invoice, Estimate, Sale Order, Purchase, Purchase
// Order, Delivery Note, Sale Return, Purchase Return) used to build its own
// jsPDF layout from scratch — plain black text, no branding, no borders, a
// bare autoTable dump that left 90% of the page blank. This is the one
// shared, properly laid-out template every document now renders through, so
// what a customer actually receives looks like a real business document
// instead of a debug printout.

const THEME_HEX: Record<string, { primary: [number, number, number]; accent: [number, number, number] }> = {
  prestige: { primary: [13, 92, 71], accent: [31, 138, 107] },
  emerald: { primary: [21, 128, 61], accent: [34, 197, 94] },
  blue: { primary: [29, 78, 216], accent: [59, 130, 246] },
  gold: { primary: [146, 64, 14], accent: [212, 160, 23] },
};

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
};

export async function buildDocumentPdf(data: PdfDocData): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const colors = THEME_HEX[data.theme ?? "prestige"] ?? THEME_HEX.prestige;
  const symbol = /^[\x00-\x7F]*$/.test(data.currencySymbol) ? data.currencySymbol : "Rs";
  const money = (n: number) => `${symbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const doc = new JsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;

  // Header band
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 36, "F");
  if (data.logoDataUrl) {
    try { doc.addImage(data.logoDataUrl, "PNG", marginX, 6, 20, 20); } catch { /* unsupported image format — skip */ }
  }
  const textX = data.logoDataUrl ? marginX + 24 : marginX;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.businessName || "Your Business", textX, 15);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  // Each held to a single line (long addresses truncated rather than
  // wrapped) so they can never collide inside this fixed-height header band.
  const oneLine = (s: string, maxWidth: number) => doc.splitTextToSize(s, maxWidth)[0];
  const headerTextWidth = pageWidth - textX - marginX - 60;
  if (data.businessAddress) doc.text(oneLine(data.businessAddress, headerTextWidth), textX, 20);
  const contactLine = [data.businessPhone, data.businessEmail].filter(Boolean).join("  ·  ");
  if (contactLine) doc.text(oneLine(contactLine, headerTextWidth), textX, 25);
  if (data.businessTaxId) doc.text(`Tax ID: ${data.businessTaxId}`, textX, 30);

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(data.documentTitle.toUpperCase(), pageWidth - marginX, 14, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`# ${data.documentNumber}`, pageWidth - marginX, 20, { align: "right" });
  if (data.status) doc.text(data.status, pageWidth - marginX, 26, { align: "right" });

  // Date block + party block
  let y = 46;
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(9);
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
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(data.partyLabel.toUpperCase(), marginX, 46);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.text(data.partyName || "-", marginX, 53);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  let partyY = 58;
  if (data.partyAddress) {
    const addressLines = doc.splitTextToSize(data.partyAddress, 90);
    doc.text(addressLines, marginX, partyY);
    partyY += addressLines.length * 4.2 + 1;
  }
  if (data.partyPhone) doc.text(data.partyPhone, marginX, partyY);

  // Items table
  const showPricing = data.showPricing !== false;
  const tableStartY = 76;
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginX, right: marginX },
    head: showPricing ? [["#", "Description", "Qty", "Rate", "Disc", "Amount"]] : [["#", "Description", "Qty"]],
    body: data.items.map((it, i) => showPricing
      ? [String(i + 1), it.name, String(it.qty), money(it.rate), it.discount ? `${it.discount}%` : "-", money(it.qty * it.rate * (1 - it.discount / 100))]
      : [String(i + 1), it.name, String(it.qty)]),
    styles: { fontSize: 9, cellPadding: 3 },
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
    const baseAmount = data.items.reduce((s, it) => s + it.qty * it.rate * (1 - it.discount / 100), 0);
    const totalsLines: [string, string][] = [["Base Amount", money(baseAmount)]];
    if (data.discountAmount) totalsLines.push(["Discount", `- ${money(data.discountAmount)}`]);
    totalsLines.push([`Tax${data.taxRate ? ` (${data.taxRate}%${data.taxInclusive ? ", incl." : ""})` : ""}`, money(data.taxAmount ?? 0)]);
    if (data.shippingAmount) totalsLines.push(["Shipping", money(data.shippingAmount)]);

    doc.setFontSize(9);
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
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", boxX, finalY + 5);
    doc.text(money(data.total ?? 0), pageWidth - marginX, finalY + 5, { align: "right" });
    finalY += 12;

    if (data.balance !== undefined && data.balance !== data.total) {
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(9.5);
      doc.text("Balance due", boxX, finalY);
      doc.text(money(data.balance), pageWidth - marginX, finalY, { align: "right" });
      finalY += 8;
    }
  } else {
    const totalQty = data.items.reduce((s, it) => s + it.qty, 0);
    doc.setTextColor(...colors.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Quantity: ${totalQty}`, pageWidth - marginX, finalY, { align: "right" });
    finalY += 8;
  }

  finalY += 4;

  if (data.notes) {
    doc.setTextColor(...colors.primary);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("NOTES", marginX, finalY);
    finalY += 5;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - marginX * 2);
    doc.text(noteLines, marginX, finalY);
    finalY += noteLines.length * 4.5 + 4;
  }

  if (data.terms) {
    doc.setTextColor(...colors.primary);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TERMS & CONDITIONS", marginX, finalY);
    finalY += 5;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const termLines = doc.splitTextToSize(data.terms, pageWidth - marginX * 2);
    doc.text(termLines, marginX, finalY);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...colors.accent);
  doc.setLineWidth(0.5);
  doc.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16);
  doc.setTextColor(140, 140, 140);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Thank you for your business.", marginX, pageHeight - 10);
  doc.text(data.businessName || "", pageWidth - marginX, pageHeight - 10, { align: "right" });

  return doc;
}
