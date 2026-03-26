import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EstimateDto, InvoiceDto, JobCardDto } from '../api/client';
import { buildInvoiceHtml } from './InvoicePDF';
import type { OrgInfo, PrintMode } from './InvoicePDF';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function buildEstimatePdfFile(params: {
  estimate: EstimateDto;
  job: JobCardDto;
  org: OrgInfo;
}): Promise<File> {
  const { estimate, job, org } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(org.name || 'Smart Garage', 40, 40);
  doc.setFontSize(10);
  doc.text(`Estimate: ${estimate.estimateNumber}`, 40, 58);
  doc.text(`Customer: ${job.customer.name}`, 40, 74);
  doc.text(`Vehicle: ${job.vehicle.registrationNo} (${job.vehicle.make} ${job.vehicle.model})`, 40, 90);
  doc.text(`Date: ${new Date(estimate.createdAt).toLocaleDateString('en-IN')}`, 40, 106);

  const rows = estimate.lines.map((l, i) => {
    const lineSub = round2(l.quantity * l.unitPrice);
    const tax = round2(l.amount - lineSub);
    return [i + 1, l.description, l.type.toUpperCase(), l.quantity, fmtMoney(l.unitPrice), fmtMoney(tax), fmtMoney(l.amount)];
  });

  autoTable(doc, {
    startY: 122,
    head: [['#', 'Item', 'Type', 'Qty', 'Unit (INR)', 'Tax (INR)', 'Amount (INR)']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 39, 68] },
  });

  const subtotal = round2(estimate.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const total = round2(estimate.totalAmount);
  const tax = round2(total - subtotal);
  const y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 140;
  doc.text(`Subtotal: INR ${fmtMoney(subtotal)}`, 360, y + 24);
  doc.text(`Tax: INR ${fmtMoney(tax)}`, 360, y + 40);
  doc.setFontSize(11);
  doc.text(`Total: INR ${fmtMoney(total)}`, 360, y + 58);

  const blob = doc.output('blob');
  const name = `${estimate.estimateNumber || 'estimate'}.pdf`;
  return new File([blob], name, { type: 'application/pdf' });
}

export async function buildInvoicePdfFile(params: {
  inv: InvoiceDto;
  estimate: EstimateDto;
  job: JobCardDto;
  org: OrgInfo;
  mode: PrintMode;
}): Promise<File> {
  const { inv, estimate, job, org, mode } = params;
  const isInsurance = mode === 'insurance';

  // Build the exact same HTML that printInvoice() opens in the browser window
  const fullHtml = buildInvoiceHtml({ inv, estimate, job, org, mode }, false);
  const name = `${inv.invoiceNumber}${isInsurance ? '-insurance' : '-customer'}.pdf`;

  // ── Strategy: render into a hidden iframe at A4 width, screenshot with
  //   html2canvas, then embed into jsPDF. This produces a PDF that looks
  //   pixel-identical to what the browser's print window shows.
  //
  //   A4 at 96 dpi → 794px wide.  We render at 2× scale for sharpness.
  const A4_WIDTH_PX  = 794;
  const A4_HEIGHT_PT = 842;  // jsPDF A4 height in pt
  const A4_WIDTH_PT  = 595;  // jsPDF A4 width  in pt
  const SCALE        = 2;    // retina-quality rendering

  // 1. Create a blob URL from the HTML so the iframe can load fonts/styles
  const blob = new Blob([fullHtml], { type: 'text/html; charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // 2. Mount a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.cssText = [
    'position:fixed',
    'left:-20000px',
    'top:0',
    `width:${A4_WIDTH_PX}px`,
    'height:1200px',
    'border:none',
    'visibility:hidden',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(iframe);

  try {
    // 3. Wait for the iframe to fully render (fonts, layout, images)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Invoice iframe load timeout')), 15000);
      iframe.onload = () => { clearTimeout(timeout); resolve(); };
      iframe.src = blobUrl;
    });

    // Small extra delay so web fonts & layout fully settle
    await new Promise(r => setTimeout(r, 300));

    const iframeDoc = iframe.contentDocument!;
    const pageEl    = iframeDoc.querySelector<HTMLElement>('.page') ?? iframeDoc.body;

    // 4. Dynamically import html2canvas (bundled via npm — added to package.json)
    const h2c = await import('html2canvas');
    const html2canvas = h2c.default ?? h2c;

    const canvas = await html2canvas(pageEl, {
      scale:           SCALE,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      width:           A4_WIDTH_PX,
      windowWidth:     A4_WIDTH_PX,
      logging:         false,
    });

    // 5. Slice canvas into A4 pages and embed into jsPDF
    const imgData      = canvas.toDataURL('image/jpeg', 0.95);
    const canvasHeight = canvas.height;           // total px (scaled)
    const canvasWidth  = canvas.width;            // A4_WIDTH_PX * SCALE

    // How many px (at canvas scale) fit on one A4 page?
    const pxPerPage = Math.floor((A4_HEIGHT_PT / A4_WIDTH_PT) * canvasWidth);
    const totalPages = Math.ceil(canvasHeight / pxPerPage);

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();

      // Crop the relevant slice from the full canvas
      const srcY   = page * pxPerPage;
      const srcH   = Math.min(pxPerPage, canvasHeight - srcY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width  = canvasWidth;
      sliceCanvas.height = srcH;
      const ctx = sliceCanvas.getContext('2d')!;

      // Draw the cropped slice
      ctx.drawImage(canvas, 0, srcY, canvasWidth, srcH, 0, 0, canvasWidth, srcH);

      const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      const sliceHeightPt = (srcH / canvasWidth) * A4_WIDTH_PT;

      doc.addImage(sliceImgData, 'JPEG', 0, 0, A4_WIDTH_PT, sliceHeightPt);
    }

    const pdfBlob = doc.output('blob');
    return new File([pdfBlob], name, { type: 'application/pdf' });

  } finally {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(blobUrl);
  }
}

