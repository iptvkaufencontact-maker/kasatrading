import type { Client, Order } from "@/lib/types";
import { statusLabels } from "@/lib/types";
import { packingLabel, quantityLabel, taxRateLabel, toCents } from "@/lib/packaging";

const PAGE_MARGIN = 14;

function amount(cents: number) {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function invoiceDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}

export async function createOrderInvoice(order: Order, client?: Client) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const right = pageWidth - PAGE_MARGIN;
  const tableWidth = right - PAGE_MARGIN;

  pdf.setProperties({
    title: `Facture ${order.orderNumber}`,
    subject: `Commande ${order.orderNumber} - ${order.clientName}`,
    author: "Kasa Trading",
    creator: "Kasa Trading",
  });

  function drawTableHeader(y: number) {
    pdf.setFillColor(35, 79, 60);
    pdf.roundedRect(PAGE_MARGIN, y, tableWidth, 10, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(255, 255, 255);
    pdf.text("PRODUIT", PAGE_MARGIN + 3, y + 6.4);
    pdf.text("QUANTITÉ", 76, y + 6.4);
    pdf.text("PU HT", 135, y + 6.4, { align: "right" });
    pdf.text("TOTAL HT", 159, y + 6.4, { align: "right" });
    pdf.text("TVA", 181, y + 6.4, { align: "right" });
    pdf.text("TOTAL TTC", right - 2, y + 6.4, { align: "right" });
  }

  function drawContinuationHeader() {
    pdf.setFillColor(25, 61, 50);
    pdf.rect(0, 0, pageWidth, 15, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(`FACTURE #${order.orderNumber}`, PAGE_MARGIN, 9.5);
    return 23;
  }

  pdf.setFillColor(25, 61, 50);
  pdf.rect(0, 0, pageWidth, 42, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("times", "bold");
  pdf.setFontSize(20);
  pdf.text("KASA TRADING", PAGE_MARGIN, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(218, 229, 218);
  pdf.text("LE GOÛT DU NATUREL", PAGE_MARGIN, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  pdf.setTextColor(255, 255, 255);
  pdf.text("FACTURE", right, 18, { align: "right" });
  pdf.setFontSize(9);
  pdf.text(`#${order.orderNumber}`, right, 26, { align: "right" });
  pdf.setDrawColor(204, 178, 115);
  pdf.setLineWidth(1);
  pdf.line(PAGE_MARGIN, 33, PAGE_MARGIN + 28, 33);

  pdf.setFillColor(248, 250, 246);
  pdf.roundedRect(PAGE_MARGIN, 51, tableWidth, 31, 2, 2, "F");
  pdf.setTextColor(119, 143, 122);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("FACTURÉ À", PAGE_MARGIN + 4, 58);
  pdf.setTextColor(31, 53, 40);
  pdf.setFontSize(11);
  pdf.text(order.clientName, PAGE_MARGIN + 4, 65);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(73, 94, 78);
  const clientLines = [client?.city || order.clientCity, client?.phone, client?.address].filter(Boolean);
  clientLines.slice(0, 3).forEach((line, index) => pdf.text(String(line), PAGE_MARGIN + 4, 71 + index * 3.5));

  const metaX = 126;
  pdf.setTextColor(119, 143, 122);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("DATE", metaX, 58);
  pdf.text("STATUT", metaX + 37, 58);
  pdf.setTextColor(31, 53, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(invoiceDate(order.createdAt), metaX, 65);
  pdf.setFont("helvetica", "bold");
  if (order.status === "cancelled") pdf.setTextColor(177, 73, 63);
  else pdf.setTextColor(49, 94, 63);
  pdf.text(statusLabels[order.status], metaX + 37, 65);
  if (order.status === "cancelled") {
    pdf.setFontSize(7);
    pdf.text("COMMANDE ANNULÉE", right - 4, 75, { align: "right" });
  }

  let y = 92;
  drawTableHeader(y);
  y += 10;

  for (const item of order.items) {
    const productLines = pdf.splitTextToSize(item.productName, 58) as string[];
    const quantityLines = pdf.splitTextToSize(quantityLabel(item.cartonQuantity, item.additionalSachets), 30) as string[];
    const packingLines = pdf.splitTextToSize(
      `${packingLabel(item.cartonQuantity, item.additionalSachets, item.sachetsPerCartonAtOrder)}${item.unit ? ` · ${item.unit}` : ""}`,
      58,
    ) as string[];
    const rowHeight = Math.max(18, productLines.length * 4 + packingLines.length * 3.4 + 6, quantityLines.length * 4 + 7);
    if (y + rowHeight > pageHeight - 35) {
      pdf.addPage();
      y = drawContinuationHeader();
      drawTableHeader(y);
      y += 10;
    }

    pdf.setDrawColor(231, 237, 229);
    pdf.setLineWidth(0.25);
    pdf.line(PAGE_MARGIN, y + rowHeight, right, y + rowHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(31, 53, 40);
    pdf.text(productLines, PAGE_MARGIN + 3, y + 5.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(105, 124, 108);
    pdf.text(packingLines, PAGE_MARGIN + 3, y + 5.5 + productLines.length * 3.6);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(43, 67, 49);
    pdf.text(quantityLines, 76, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(amount(toCents(item.sachetPriceAtOrder)), 135, y + 6, { align: "right" });
    pdf.text(amount(toCents(item.totalPrice)), 159, y + 6, { align: "right" });
    pdf.text(item.taxRateBps === null ? "—" : taxRateLabel(item.taxRateBps), 181, y + 6, { align: "right" });
    pdf.setFont("helvetica", "bold");
    const lineTtcCents = toCents(item.totalPrice) + (item.taxRateBps === null ? 0 : toCents(item.taxAmount));
    pdf.text(item.taxRateBps === null ? "—" : amount(lineTtcCents), right - 2, y + 6, { align: "right" });
    y += rowHeight;
  }

  if (y + 54 > pageHeight - 16) {
    pdf.addPage();
    y = drawContinuationHeader();
  }

  y += 9;
  const summaryX = 112;
  const summaryWidth = right - summaryX;
  pdf.setFillColor(248, 250, 246);
  pdf.roundedRect(summaryX, y, summaryWidth, 39, 2, 2, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(91, 111, 95);
  pdf.text("Sous-total HT", summaryX + 5, y + 9);
  pdf.text(amount(toCents(order.subtotal)), right - 5, y + 9, { align: "right" });
  pdf.text(order.items.some((item) => item.taxRateBps === null) ? "TVA historique" : "TVA totale", summaryX + 5, y + 18);
  pdf.text(order.items.some((item) => item.taxRateBps === null) ? "—" : amount(toCents(order.taxAmount)), right - 5, y + 18, { align: "right" });
  pdf.setDrawColor(219, 229, 216);
  pdf.line(summaryX + 5, y + 23, right - 5, y + 23);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(35, 79, 60);
  pdf.text(order.items.some((item) => item.taxRateBps === null) ? "Montant historique" : "TOTAL TTC", summaryX + 5, y + 32);
  pdf.text(amount(toCents(order.total)), right - 5, y + 32, { align: "right" });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(231, 237, 229);
    pdf.line(PAGE_MARGIN, pageHeight - 13, right, pageHeight - 13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(132, 148, 135);
    pdf.text("Kasa Trading · Document généré depuis votre espace commercial", PAGE_MARGIN, pageHeight - 8);
    pdf.text(`${page}/${pageCount}`, right, pageHeight - 8, { align: "right" });
  }

  const fileName = `Facture-${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  return { blob: pdf.output("blob") as Blob, fileName };
}
