/**
 * EstimatePDF.tsx
 *
 * Generates a print-ready HTML Service Estimate (Quotation) to share with the customer.
 * Opens window.print() in a new tab — user can Save as PDF from the browser print dialog.
 *
 * Usage:
 *   printEstimate({ estimate, job, org })
 */

import type { EstimateDto, JobCardDto } from '../api/client';
import type { OrgInfo } from './InvoicePDF';

// ─── helpers ─────────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function numberToWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
    'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
    'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  }

  const integer = Math.floor(n);
  const decimal = Math.round((n - integer) * 100);
  let words = convert(integer) || 'Zero';
  if (decimal > 0) words += ` and ${convert(decimal)} Paise`;
  return words + ' Only';
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface PrintEstimateParams {
  estimate: EstimateDto;
  job: JobCardDto;
  org: OrgInfo;
}

// ─── main export ─────────────────────────────────────────────────────────────

export function printEstimate({ estimate, job, org }: PrintEstimateParams) {

  // Compute per-line tax figures
  interface DisplayLine {
    sr: number;
    description: string;
    type: 'part' | 'labour';
    qty: number;
    unitPrice: number;
    subtotal: number;
    taxPct: number;
    taxAmt: number;
    total: number;
  }

  const lines: DisplayLine[] = estimate.lines.map((l, i) => {
    const subtotal = round2(l.quantity * l.unitPrice);
    const taxAmt   = round2(l.amount - subtotal);
    const taxPct   = subtotal > 0 ? round2((taxAmt / subtotal) * 100) : 0;
    return {
      sr: i + 1,
      description: l.description,
      type: l.type as 'part' | 'labour',
      qty: l.quantity,
      unitPrice: l.unitPrice,
      subtotal,
      taxPct,
      taxAmt,
      total: l.amount,
    };
  });

  const partsLines  = lines.filter(l => l.type === 'part');
  const labourLines = lines.filter(l => l.type === 'labour');

  const subTotal   = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const totalTax   = round2(lines.reduce((s, l) => s + l.taxAmt, 0));
  const sgst       = round2(totalTax / 2);
  const cgst       = round2(totalTax / 2);
  const grandTotal = round2(subTotal + totalTax);
  const hasGST     = totalTax > 0;
  const partsTotal = round2(partsLines.reduce((s, l) => s + l.total, 0));
  const labourTotal= round2(labourLines.reduce((s, l) => s + l.total, 0));

  const isExpired  = estimate.validUntil ? new Date(estimate.validUntil) < new Date() : false;

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    draft:    { bg: '#f6f8fa', color: '#374151',  border: '#d0d7de' },
    sent:     { bg: '#eff6ff', color: '#1d4ed8',  border: '#bfdbfe' },
    approved: { bg: '#f0fdf4', color: '#166534',  border: '#bbf7d0' },
    rejected: { bg: '#fef2f2', color: '#991b1b',  border: '#fecaca' },
  };
  const sc = statusColors[estimate.status] ?? statusColors.draft;

  // Row renderer helper
  const renderLine = (l: DisplayLine) => `
    <tr>
      <td class="center">${l.sr}</td>
      <td class="desc">${l.description}</td>
      <td class="center">
        <span class="type-badge type-${l.type}">${l.type === 'part' ? 'Part' : 'Labour'}</span>
      </td>
      <td class="num">${l.qty}</td>
      <td class="num">${fmtINR(l.unitPrice)}</td>
      ${hasGST ? `<td class="num tax-col">${l.taxPct > 0 ? l.taxPct + '%' : '—'}</td>` : ''}
      ${hasGST ? `<td class="num tax-col">${l.taxAmt > 0 ? fmtINR(l.taxAmt) : '—'}</td>` : ''}
      <td class="num total-col">${fmtINR(l.total)}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Estimate ${estimate.estimateNumber} – ${job.customer.name}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    background: #fff;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 10mm 12mm 12mm;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Header ── */
  .header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    padding: 12px 16px 10px;
    background: #0f2744;
    border-radius: 6px 6px 0 0;
    color: #fff;
  }
  .org-name {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1.2;
    margin-bottom: 4px;
  }
  .org-detail {
    font-size: 10px;
    opacity: 0.78;
    line-height: 1.6;
  }
  .doc-title-block { text-align: right; }
  .doc-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.65;
    margin-bottom: 3px;
  }
  .doc-number {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.04em;
    font-family: 'Courier New', monospace;
  }
  .doc-status {
    display: inline-block;
    margin-top: 5px;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: ${sc.bg};
    color: ${sc.color};
    border: 1px solid ${sc.border};
  }

  /* ── Expiry banner ── */
  .expiry-banner {
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-top: none;
    color: #92400e;
    font-size: 10.5px;
    font-weight: 700;
    padding: 5px 14px;
    text-align: center;
    letter-spacing: 0.04em;
  }

  /* ── Meta strip ── */
  .meta-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 1px solid #dde3ec;
    border-top: none;
  }
  .meta-cell {
    padding: 7px 10px;
    border-right: 1px solid #dde3ec;
  }
  .meta-cell:last-child { border-right: none; }
  .meta-label {
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b7280;
    margin-bottom: 2px;
  }
  .meta-value {
    font-size: 11.5px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .meta-value.expires {
    color: ${isExpired ? '#dc2626' : '#166534'};
  }

  /* ── Bill to / Vehicle ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid #dde3ec;
    border-top: none;
  }
  .info-cell {
    padding: 9px 12px;
    border-right: 1px solid #dde3ec;
  }
  .info-cell:last-child { border-right: none; }
  .info-section-label {
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b7280;
    margin-bottom: 5px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }
  .info-name {
    font-size: 13px;
    font-weight: 800;
    color: #0f2744;
    margin-bottom: 3px;
  }
  .info-detail {
    font-size: 11px;
    color: #4b5563;
    line-height: 1.65;
  }
  .info-detail b { color: #374151; }

  /* ── Intro note ── */
  .intro-note {
    border: 1px solid #dde3ec;
    border-top: none;
    padding: 8px 12px;
    font-size: 11px;
    color: #374151;
    background: #f9fafb;
    line-height: 1.5;
  }

  /* ── Line items table ── */
  .items-wrap {
    border: 1px solid #dde3ec;
    border-top: none;
    overflow: hidden;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  thead tr {
    background: #e8edf5;
  }
  th {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #374151;
    padding: 7px 8px;
    border-bottom: 2px solid #c5cfe0;
    border-right: 1px solid #d0d9e8;
    white-space: nowrap;
  }
  th:last-child { border-right: none; }
  td {
    padding: 5px 8px;
    font-size: 11px;
    border-bottom: 1px solid #eaeff7;
    border-right: 1px solid #eaeff7;
    vertical-align: middle;
    line-height: 1.4;
  }
  td:last-child { border-right: none; }
  tr:last-child td { border-bottom: none; }
  tbody tr:nth-child(even) td { background: #f7f9fc; }

  .section-row td {
    background: #eef2fa !important;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #0f2744;
    padding: 4px 8px;
    border-bottom: 1px solid #c5cfe0;
  }

  .center { text-align: center; }
  .num    { text-align: right; font-variant-numeric: tabular-nums; }
  .desc   { font-weight: 500; }
  .tax-col { color: #6b7280; }
  .total-col { font-weight: 700; color: #0f2744; }

  .type-badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .type-part   { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .type-labour { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }

  /* ── Totals area ── */
  .totals-area {
    display: grid;
    grid-template-columns: 1fr 210px;
    border: 1px solid #dde3ec;
    border-top: none;
  }
  .gst-block {
    padding: 10px 12px;
    border-right: 1px solid #dde3ec;
  }
  .gst-title {
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b7280;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }
  .gst-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .gst-table th {
    font-size: 8.5px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border: none;
    border-bottom: 1px solid #e5e7eb;
    background: transparent;
    text-align: right;
  }
  .gst-table th:first-child { text-align: left; }
  .gst-table td {
    padding: 3px 6px;
    border: none;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #374151;
    background: transparent !important;
  }
  .gst-table td:first-child { text-align: left; }
  .subtotals {
    display: flex;
    gap: 20px;
    margin-top: 10px;
    font-size: 10.5px;
  }
  .subtotals span b { color: #374151; }

  .summary-col {
    padding: 10px 12px;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
    font-size: 11px;
    border-bottom: 1px solid #f0f0f0;
    gap: 8px;
  }
  .sum-row:last-child { border-bottom: none; }
  .sum-label { color: #4b5563; }
  .sum-value { font-weight: 600; font-variant-numeric: tabular-nums; }
  .sum-row.grand {
    padding: 7px 0 5px;
    border-top: 2px solid #0f2744;
    border-bottom: none;
    margin-top: 5px;
  }
  .sum-row.grand .sum-label {
    font-weight: 800;
    font-size: 12px;
    color: #0f2744;
  }
  .sum-row.grand .sum-value {
    font-weight: 800;
    font-size: 15px;
    color: #0f2744;
  }

  /* ── Amount in words ── */
  .words-row {
    border: 1px solid #dde3ec;
    border-top: none;
    padding: 6px 12px;
    font-size: 10.5px;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .words-label { font-weight: 700; color: #374151; white-space: nowrap; }
  .words-value { font-style: italic; color: #0f2744; font-weight: 600; }

  /* ── Terms box ── */
  .terms {
    border: 1px solid #dde3ec;
    border-top: none;
    padding: 9px 12px;
    background: #f9fafb;
  }
  .terms-title {
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b7280;
    margin-bottom: 5px;
  }
  .terms-list {
    font-size: 10.5px;
    color: #4b5563;
    line-height: 1.7;
    padding-left: 12px;
  }

  /* ── Footer ── */
  .footer {
    border: 1px solid #dde3ec;
    border-top: none;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    padding: 10px 14px;
    gap: 12px;
  }
  .footer-note {
    font-size: 9px;
    color: #9ca3af;
    line-height: 1.7;
  }
  .sig-block { text-align: right; }
  .sig-line {
    width: 130px;
    border-top: 1px solid #374151;
    margin: 22px 0 0 auto;
    padding-top: 4px;
    font-size: 10px;
    font-weight: 700;
    color: #374151;
    text-align: center;
  }

  /* ── Approval CTA watermark-style ── */
  .approval-cta {
    border: 2px dashed #0d9488;
    border-radius: 8px;
    padding: 10px 16px;
    margin-top: 0;
    border-top: none;
    background: #f0fdf4;
    text-align: center;
    font-size: 11px;
    color: #166534;
  }
  .approval-cta strong { font-size: 12px; display: block; margin-bottom: 2px; }
  .approval-link {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #0d9488;
    word-break: break-all;
  }

  @media print {
    body { padding: 0; }
    .page { padding: 6mm 8mm; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="org-name">${org.name}</div>
      <div class="org-detail">
        ${org.address ? org.address + '<br>' : ''}
        ${org.phone ? 'Ph: ' + org.phone : ''}
        ${org.gstin ? ' &nbsp;|&nbsp; GSTIN: ' + org.gstin : ''}
      </div>
    </div>
    <div class="doc-title-block">
      <div class="doc-label">Service Estimate</div>
      <div class="doc-number">${estimate.estimateNumber}</div>
      <div class="doc-status">${estimate.status.toUpperCase()}</div>
    </div>
  </div>

  ${isExpired ? `<div class="expiry-banner">⚠ This estimate expired on ${fmtDate(estimate.validUntil)} — please contact us for a revised quote.</div>` : ''}

  <!-- Meta strip: Estimate # | Date | Valid Until | Job # -->
  <div class="meta-strip">
    <div class="meta-cell">
      <div class="meta-label">Estimate No.</div>
      <div class="meta-value">${estimate.estimateNumber}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Date Issued</div>
      <div class="meta-value">${fmtDate(estimate.createdAt)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Valid Until</div>
      <div class="meta-value expires">${fmtDate(estimate.validUntil)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Job Card No.</div>
      <div class="meta-value">${job.jobNumber}</div>
    </div>
  </div>

  <!-- Customer + Vehicle -->
  <div class="info-grid">
    <div class="info-cell">
      <div class="info-section-label">Prepared For</div>
      <div class="info-name">${job.customer.name}</div>
      <div class="info-detail">
        ${job.customer.phone ? `<b>Ph:</b> ${job.customer.phone}<br>` : ''}
        ${job.customer.email ? `<b>Email:</b> ${job.customer.email}<br>` : ''}
        ${job.customer.address ? `<b>Address:</b> ${job.customer.address}<br>` : ''}
        ${job.customer.gstin ? `<b>GSTIN:</b> ${job.customer.gstin}` : ''}
      </div>
    </div>
    <div class="info-cell">
      <div class="info-section-label">Vehicle</div>
      <div class="info-name">${job.vehicle.registrationNo}</div>
      <div class="info-detail">
        <b>Make / Model:</b> ${job.vehicle.make} ${job.vehicle.model}<br>
        <b>Odometer:</b> ${job.odometerReading.toLocaleString('en-IN')} km
        ${job.vehicle.fuel ? `<br><b>Fuel:</b> ${job.vehicle.fuel}` : ''}
      </div>
    </div>
  </div>

  <!-- Intro note -->
  <div class="intro-note">
    Dear <strong>${job.customer.name}</strong>, please find below the estimated cost for the
    repair / service of your vehicle <strong>${job.vehicle.registrationNo}</strong>.
    This estimate is valid until <strong>${fmtDate(estimate.validUntil)}</strong>.
    Kindly review and approve at your earliest convenience.
  </div>

  <!-- Line items -->
  <div class="items-wrap">
    <table>
      <thead>
        <tr>
          <th class="center" style="width:26px">Sr.</th>
          <th>Description</th>
          <th class="center" style="width:56px">Type</th>
          <th class="num" style="width:34px">Qty</th>
          <th class="num" style="width:80px">Unit (₹)</th>
          ${hasGST ? '<th class="num" style="width:46px">GST %</th>' : ''}
          ${hasGST ? '<th class="num" style="width:72px">Tax (₹)</th>' : ''}
          <th class="num" style="width:90px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${partsLines.length > 0 ? `
        <tr class="section-row"><td colspan="${hasGST ? 8 : 6}">Parts</td></tr>
        ${partsLines.map(renderLine).join('')}` : ''}
        ${labourLines.length > 0 ? `
        <tr class="section-row"><td colspan="${hasGST ? 8 : 6}">Labour</td></tr>
        ${labourLines.map(renderLine).join('')}` : ''}
      </tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="totals-area">
    <div class="gst-block">
      ${hasGST ? `
      <div class="gst-title">Tax Summary</div>
      <table class="gst-table">
        <thead>
          <tr>
            <th>Taxable Amt</th>
            <th>CGST Rate</th>
            <th>CGST Amt</th>
            <th>SGST Rate</th>
            <th>SGST Amt</th>
            <th>Total Tax</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${fmtINR(subTotal)}</td>
            <td>9%</td>
            <td>${fmtINR(cgst)}</td>
            <td>9%</td>
            <td>${fmtINR(sgst)}</td>
            <td><strong>${fmtINR(totalTax)}</strong></td>
          </tr>
        </tbody>
      </table>` : '<div class="gst-title" style="color:#6b7280">No GST applied on this estimate</div>'}
      <div class="subtotals">
        <span><b>Parts Total:</b> ${fmtINR(partsTotal)}</span>
        <span><b>Labour Total:</b> ${fmtINR(labourTotal)}</span>
      </div>
    </div>
    <div class="summary-col">
      <div class="sum-row"><span class="sum-label">Sub Total</span><span class="sum-value">${fmtINR(subTotal)}</span></div>
      ${hasGST ? `
      <div class="sum-row"><span class="sum-label">CGST (9%)</span><span class="sum-value">${fmtINR(cgst)}</span></div>
      <div class="sum-row"><span class="sum-label">SGST (9%)</span><span class="sum-value">${fmtINR(sgst)}</span></div>` : ''}
      <div class="sum-row grand">
        <span class="sum-label">Total Estimate</span>
        <span class="sum-value">${fmtINR(grandTotal)}</span>
      </div>
    </div>
  </div>

  <!-- Amount in words -->
  <div class="words-row">
    <span class="words-label">Estimate amount:</span>
    <span class="words-value">${numberToWords(grandTotal)}</span>
  </div>

  <!-- Terms & Conditions -->
  <div class="terms">
    <div class="terms-title">Terms &amp; Conditions</div>
    <ul class="terms-list">
      <li>This estimate is valid for the period mentioned above. Prices may change after the validity date.</li>
      <li>Final invoice may vary slightly if additional repairs are discovered during service.</li>
      <li>Parts replaced remain the property of the customer. Old parts will be returned on request.</li>
      <li>Payment is due upon delivery of the vehicle. We accept Cash, UPI, Card &amp; Bank Transfer.</li>
      <li>Warranty on parts: as per manufacturer warranty. Labour warranty: 30 days or 1,000 km, whichever is earlier.</li>
    </ul>
  </div>

  <!-- Online approval CTA -->
  <div class="approval-cta">
    <strong>✓ Approve this estimate online</strong>
    Visit the link below to review and approve (or request changes):
    <div class="approval-link">${window.location.origin}/public/estimate/${estimate.id}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-note">
      Thank you for trusting <strong>${org.name}</strong> with your vehicle.<br>
      For queries, please contact us at ${org.phone ?? 'our service centre'}.<br>
      This is a computer-generated estimate and requires no signature.
    </div>
    <div class="sig-block">
      <div class="sig-line">Authorised by<br>${org.name}</div>
    </div>
  </div>

</div>
<script>
  window.onload = function () { window.print(); };
</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to print the estimate.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
