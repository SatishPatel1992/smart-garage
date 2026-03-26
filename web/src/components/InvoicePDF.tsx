/**
 * InvoicePDF.tsx — Tax Invoice generator matching industry-standard format.
 *
 * Customer copy : standard invoice billed to vehicle owner
 * Insurance copy: invoice billed to insurance company
 *   - Table: Sr | Description | HSN/SAC | Qty | Unit Price | Tax | % | Amount
 *   - Insurance company block top-left with name, address, GSTIN
 *   - Only includes lines where insurance has a payable share
 *   - Amount = insurance's share of (subtotal + tax)
 */

import type { InvoiceDto, EstimateDto, JobCardDto } from '../api/client';

export type OrgInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
};

export type PrintMode = 'customer' | 'insurance';

export interface PrintInvoiceParams {
  inv: InvoiceDto;
  estimate: EstimateDto;
  job: JobCardDto;
  org: OrgInfo;
  mode: PrintMode;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtINR(n: number) {
  return '₹' + fmt(n);
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function numberToWords(n: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function cvt(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)]+' Hundred'+(n%100 ? ' '+cvt(n%100) : '');
    if (n < 100000) return cvt(Math.floor(n/1000))+' Thousand'+(n%1000 ? ' '+cvt(n%1000) : '');
    if (n < 10000000) return cvt(Math.floor(n/100000))+' Lakh'+(n%100000 ? ' '+cvt(n%100000) : '');
    return cvt(Math.floor(n/10000000))+' Crore'+(n%10000000 ? ' '+cvt(n%10000000) : '');
  }
  const int = Math.floor(n); const dec = Math.round((n-int)*100);
  return (cvt(int)||'Zero') + (dec > 0 ? ` and ${cvt(dec)} Paise` : '') + ' Only';
}

export function buildInvoiceHtml(
  { inv, estimate, job, org, mode }: PrintInvoiceParams,
  includePrintScript = true
) {
  const isIns = mode === 'insurance';
  const insName = job.insuranceCompany?.name ?? 'Insurance Company';

  // ── Compute per-line figures ───────────────────────────────────────────────
  interface Row {
    sr: number; description: string; type: string;
    qty: number; unitPrice: number;
    insPct: number;       // insurance share %
    insShare: number;     // pre-tax insurance share
    custShare: number;    // pre-tax customer share
    taxPct: number;
    taxOnShare: number;   // tax on THIS party's share
    payable: number;      // what this invoice bills
  }

  const allRows: Row[] = estimate.lines.map((l, i) => {
    const fullSub  = round2(l.quantity * l.unitPrice);
    const fullTax  = round2(l.amount - fullSub);
    const taxPct   = fullSub > 0 ? round2((fullTax / fullSub) * 100) : 0;

    // Determine insurance share percentage
    let insPct = 0;
    if (l.insurancePayableMode === 'percent') {
      insPct = l.insurancePayableValue ?? 0;
    } else if (l.insurancePayableMode === 'rupees') {
      // convert fixed ₹ to equivalent % for display
      insPct = fullSub > 0 ? round2(((l.insurancePayableValue ?? 0) / fullSub) * 100) : 0;
    }

    // Both parties pay their proportional share of GST.
    // Ins pays insPct% of subtotal + insPct% of tax.
    // Cust pays remaining % of subtotal + remaining % of tax.
    const insSharePreTax  = round2(fullSub * insPct / 100);
    const custSharePreTax = round2(fullSub - insSharePreTax);
    const taxOnIns  = round2(fullTax * insPct / 100);
    const taxOnCust = round2(fullTax - taxOnIns);

    return {
      sr: i + 1, description: l.description, type: l.type,
      qty: l.quantity, unitPrice: l.unitPrice,
      insPct,
      insShare:   insSharePreTax,
      custShare:  custSharePreTax,
      taxPct,
      taxOnShare: isIns ? taxOnIns : taxOnCust,
      // payable = pre-tax share + proportional tax for this party
      payable:    isIns ? round2(insSharePreTax + taxOnIns) : round2(custSharePreTax + taxOnCust),
    };
  }).filter(r => r.payable > 0);

  const parts  = allRows.filter(r => r.type === 'part');
  const labour = allRows.filter(r => r.type === 'labour');

  // subTotal = pre-tax portion of what this invoice bills
  //   customer invoice: sum of customer pre-tax shares
  //   insurance invoice: sum of insurance pre-tax shares (no tax)
  const subTotal   = round2(allRows.reduce((s, r) => s + (isIns ? r.insShare : r.custShare), 0));
  const totalTax   = round2(allRows.reduce((s, r) => s + r.taxOnShare, 0));
  const sgst       = round2(totalTax / 2);
  const cgst       = round2(totalTax / 2);
  const grandTotal = round2(allRows.reduce((s, r) => s + r.payable, 0));
  const partsAmt   = round2(parts.reduce((s, r) => s + r.payable, 0));
  const labourAmt  = round2(labour.reduce((s, r) => s + r.payable, 0));

  const paidAmt  = isIns ? 0 : (inv.paidAmount ?? 0);
  const balance  = round2(grandTotal - paidAmt);
  const invLabel = isIns ? `${inv.invoiceNumber}-INS` : inv.invoiceNumber;

  // Row HTML
  const renderRow = (r: Row) => `
    <tr>
      <td align="center">${r.sr}</td>
      <td>${r.description}</td>
      <td align="center">—</td>
      <td align="center">${r.qty}</td>
      <td align="right">${fmtINR(r.unitPrice)}</td>
      <td align="right">${fmtINR(r.taxOnShare)}</td>
      <td align="center">(${r.taxPct}%)</td>
      <td align="right"><b>${fmtINR(r.payable)}</b></td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Tax Invoice ${invLabel}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm 10mm 10mm; }

  /* Top header — dark navy banner */
  .header-band {
    background: #1a3557; color: #fff;
    padding: 10px 16px 9px; border-radius: 4px 4px 0 0;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }
  .org-name  { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; line-height: 1.2; }
  .org-detail{ font-size: 10px; opacity: 0.8; margin-top: 3px; line-height: 1.5; }
  .inv-badge { text-align: right; flex-shrink: 0; }
  .inv-type  { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.7; }
  .inv-num-big { font-size: 16px; font-weight: 800; letter-spacing: 0.03em; font-family: 'Courier New', monospace; margin-top: 2px; display: block; }

  /* Bill to row */
  .bill-row { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #999; border-top: none; }
  .bill-cell { padding: 7px 10px; }
  .bill-cell:first-child { border-right: 1px solid #999; }
  .bill-section { font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #555; margin-bottom: 4px; letter-spacing: 0.05em; }
  .bill-name { font-size: 12.5px; font-weight: 900; margin-bottom: 2px; }
  .bill-detail { font-size: 10.5px; line-height: 1.6; color: #333; }

  /* Line items */
  table { width: 100%; border-collapse: collapse; margin-top: 0; }
  .items-table { border: 1px solid #999; border-top: none; }
  .items-table th {
    background: #e8e8e8;
    font-size: 10px;
    font-weight: 700;
    padding: 5px 6px;
    border-right: 1px solid #bbb;
    border-bottom: 2px solid #999;
    text-align: left;
    white-space: nowrap;
  }
  .items-table th:last-child { border-right: none; }
  .items-table td {
    padding: 4px 6px;
    font-size: 11px;
    border-bottom: 1px solid #ddd;
    border-right: 1px solid #e0e0e0;
    vertical-align: middle;
  }
  .items-table td:last-child { border-right: none; }
  .items-table tr:last-child td { border-bottom: none; }
  .items-table tbody tr:nth-child(even) td { background: #f7f9fc; }

  .section-row td {
    background: #d8d8d8 !important;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 6px;
    border-bottom: 1px solid #aaa;
    color: #111;
  }

  /* Totals section */
  .totals-wrap { display: grid; grid-template-columns: 1fr 200px; border: 1px solid #999; border-top: none; }
  .tax-block { padding: 8px 10px; border-right: 1px solid #999; }
  .tax-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #555; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  .tax-tbl   { width: 100%; border-collapse: collapse; font-size: 10px; }
  .tax-tbl th { font-size: 9px; font-weight: 700; color: #555; padding: 2px 5px; border-bottom: 1px solid #ddd; text-align: right; }
  .tax-tbl th:first-child { text-align: left; }
  .tax-tbl td { padding: 2px 5px; text-align: right; color: #222; }
  .tax-tbl td:first-child { text-align: left; }
  .sub-line  { font-size: 10.5px; margin-top: 8px; display: flex; gap: 16px; flex-wrap: wrap; }
  .sub-line b { color: #333; }

  .sum-block { padding: 8px 10px; }
  .sum-row   { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 11px; border-bottom: 1px solid #eee; gap: 6px; }
  .sum-row:last-child { border-bottom: none; }
  .sum-lbl   { color: #444; }
  .sum-val   { font-weight: 600; font-variant-numeric: tabular-nums; }
  .sum-grand { border-top: 2px solid #000; border-bottom: none; margin-top: 4px; padding-top: 6px; }
  .sum-grand .sum-lbl { font-weight: 900; font-size: 12px; }
  .sum-grand .sum-val { font-weight: 900; font-size: 14px; }
  .sum-paid  .sum-val { color: #166534; }
  .sum-bal   .sum-val { color: #b91c1c; font-weight: 800; }

  /* Words + footer */
  .words { border: 1px solid #999; border-top: none; padding: 5px 10px; font-size: 10.5px; display: flex; gap: 5px; align-items: baseline; }
  .words b { white-space: nowrap; }
  .words i  { color: #1a3557; font-weight: 600; }
  .footer { border: 1px solid #999; border-top: none; display: grid; grid-template-columns: 1fr auto; align-items: end; padding: 8px 12px; gap: 10px; }
  .footer-note { font-size: 9px; color: #777; line-height: 1.65; }
  .sig { text-align: right; }
  .sig-line { width: 120px; border-top: 1px solid #333; margin: 22px 0 0 auto; padding-top: 3px; font-size: 9.5px; font-weight: 700; text-align: center; }

  ${isIns ? `.ins-banner {
    background: #fff9e6; border: 1px solid #e0b800; border-top: none;
    color: #7a4f00; font-size: 10.5px; font-weight: 700;
    padding: 4px 10px; text-align: center; letter-spacing: 0.04em;
  }` : ''}

  @media print {
    body { padding: 0; }
    .page { padding: 5mm 7mm; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Dark navy header banner -->
  <div class="header-band">
    <div>
      <div class="org-name">${org.name}</div>
      <div class="org-detail">
        ${org.address ? org.address + '<br>' : ''}
        ${org.phone ? 'Ph: ' + org.phone : ''}
        ${org.gstin ? ' &nbsp;|&nbsp; GSTIN: ' + org.gstin : ''}
      </div>
    </div>
    <div class="inv-badge">
      <div class="inv-type">Tax Invoice</div>
      <span class="inv-num-big">${invLabel}</span>
    </div>
  </div>

  <!-- Meta strip below header -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border:1px solid #999;border-top:none;">
    <div style="padding:6px 10px;border-right:1px solid #999;">
      <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:2px">Invoice No</div>
      <div style="font-size:11.5px;font-weight:800;font-family:'Courier New',monospace">${invLabel}</div>
    </div>
    <div style="padding:6px 10px;border-right:1px solid #999;">
      <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:2px">Date</div>
      <div style="font-size:11.5px;font-weight:700">${fmtDate(inv.createdAt)}</div>
    </div>
    <div style="padding:6px 10px;border-right:1px solid #999;">
      <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:2px">Jobcard No</div>
      <div style="font-size:11.5px;font-weight:700">${job.jobNumber}</div>
    </div>
    <div style="padding:6px 10px;">
      <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:2px">Vehicle No</div>
      <div style="font-size:11.5px;font-weight:800">${job.vehicle.registrationNo}</div>
    </div>
  </div>

  ${isIns ? `<div class="ins-banner">🛡 INSURANCE COPY &nbsp;—&nbsp; Billed to: <b>${insName}</b></div>` : ''}

  <!-- Bill to + Customer/Vehicle -->
  <div class="bill-row">
    <div class="bill-cell">
      ${isIns ? `
      <div class="bill-section">Insurance Company</div>
      <div class="bill-name">${insName}</div>
      <div class="bill-detail">
        ${job.insuranceCompany?.name ? `<b>Company Name :</b> ${job.insuranceCompany.name}<br>` : ''}
        <b>Vehicle Owner :</b> ${job.customer.name}<br>
        <b>Vehicle :</b> ${job.vehicle.make} ${job.vehicle.model} &mdash; ${job.vehicle.registrationNo}
      </div>` : `
      <div class="bill-section">Customer</div>
      <div class="bill-name">${job.customer.name}</div>
      <div class="bill-detail">
        <b>Contact No. :</b> ${job.customer.phone ?? '—'}<br>
        ${job.customer.address ? `<b>Address :</b> ${job.customer.address}<br>` : ''}
        ${job.customer.gstin ? `<b>GSTIN :</b> ${job.customer.gstin}` : ''}
      </div>`}
    </div>
    <div class="bill-cell">
      <div class="bill-section">Vehicle Details</div>
      <div class="bill-name">${job.vehicle.registrationNo}</div>
      <div class="bill-detail">
        <b>Vehicle :</b> ${job.vehicle.make} ${job.vehicle.model}<br>
        <b>Kilometer :</b> ${job.odometerReading.toLocaleString('en-IN')} km
        ${job.vehicle.fuel ? `<br><b>Fuel :</b> ${job.vehicle.fuel}` : ''}
      </div>
    </div>
  </div>

  <!-- Line items table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:28px" align="center">SrNo</th>
        <th>Description</th>
        <th style="width:64px" align="center">HSN/SAC</th>
        <th style="width:30px" align="center">Qty</th>
        <th style="width:80px" align="right">Unit Price (₹)</th>
        <th style="width:68px" align="right">Tax (₹)</th>
        <th style="width:38px" align="center">%</th>
        <th style="width:80px" align="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${parts.length > 0 ? `
      <tr class="section-row"><td colspan="8">PART</td></tr>
      ${parts.map(renderRow).join('')}` : ''}
      ${labour.length > 0 ? `
      <tr class="section-row"><td colspan="8">LABOR</td></tr>
      ${labour.map(renderRow).join('')}` : ''}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <div class="tax-block">
      <div class="tax-title">HSN/SAC Tax Summary</div>
      <table class="tax-tbl">
        <thead>
          <tr>
            <th style="text-align:left">HSN/SAC</th>
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
            <td>—</td>
            <td>${fmtINR(subTotal)}</td>
            <td>9%</td><td>${fmtINR(cgst)}</td>
            <td>9%</td><td>${fmtINR(sgst)}</td>
            <td><b>${fmtINR(totalTax)}</b></td>
          </tr>
        </tbody>
      </table>
      <div class="sub-line">
        <span><b>Parts Total:</b> ${fmtINR(partsAmt)}</span>
        <span><b>Labour Total:</b> ${fmtINR(labourAmt)}</span>
        <span><b>Sub Total:</b> ${fmtINR(subTotal)}</span>
      </div>
    </div>
    <div class="sum-block">
      <div class="sum-row"><span class="sum-lbl">Sub Total</span><span class="sum-val">${fmtINR(subTotal)}</span></div>
      <div class="sum-row"><span class="sum-lbl">SGST (9%)</span><span class="sum-val">${fmtINR(sgst)}</span></div>
      <div class="sum-row"><span class="sum-lbl">CGST (9%)</span><span class="sum-val">${fmtINR(cgst)}</span></div>
      ${inv.discountAmount > 0 ? `<div class="sum-row"><span class="sum-lbl">Discount</span><span class="sum-val" style="color:#d97706">- ${fmtINR(inv.discountAmount)}</span></div>` : ''}
      <div class="sum-row sum-grand"><span class="sum-lbl">Total Payable</span><span class="sum-val">${fmtINR(grandTotal)}</span></div>
      ${!isIns ? `
      <div class="sum-row sum-paid"><span class="sum-lbl">Paid</span><span class="sum-val">${fmtINR(paidAmt)}</span></div>
      <div class="sum-row sum-bal"><span class="sum-lbl">Balance</span><span class="sum-val">${fmtINR(balance)}</span></div>` : ''}
    </div>
  </div>

  <!-- Amount in words -->
  <div class="words">
    <b>Amount in words:</b>
    <i>${numberToWords(grandTotal)}</i>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-note">
      ${isIns
        ? `<b>Insurance Copy</b> — Raised against <b>${insName}</b> for insurance-covered repairs on
           ${job.vehicle.registrationNo} (${job.vehicle.make} ${job.vehicle.model}).
           Owner: ${job.customer.name} &mdash; ${job.customer.phone ?? ''}<br>`
        : ''}
      THIS IS A COMPUTER GENERATED INVOICE AND REQUIRES NO SIGNATURE.
    </div>
    <div class="sig">
      <div class="sig-line">For ${org.name}</div>
    </div>
  </div>

</div>
${includePrintScript ? '<script>window.onload = function(){ window.print(); };</script>' : ''}
</body>
</html>`;

  return html;
}

export function printInvoice(params: PrintInvoiceParams) {
  const html = buildInvoiceHtml(params, true);
  const win = window.open('', '_blank');
  if (!win) { alert('Pop-up blocked. Please allow pop-ups to print invoices.'); return; }
  win.document.write(html);
  win.document.close();
}
