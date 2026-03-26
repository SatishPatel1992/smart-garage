/**
 * CreditNotePDF.tsx
 * Generates a print-ready Credit Note document.
 */

import type { CreditNoteDto } from '../api/client';
import type { OrgInfo } from './InvoicePDF';

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const int = Math.floor(n);
  return (cvt(int) || 'Zero') + ' Only';
}

export interface PrintCreditNoteParams {
  cn: CreditNoteDto;
  org: OrgInfo;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
}

export function printCreditNote({ cn, org, customerName, customerPhone, customerAddress }: PrintCreditNoteParams) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Credit Note ${cn.creditNoteNumber}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm 10mm 10mm; }

  .header-band {
    background: #7c3aed; color: #fff;
    padding: 10px 16px 9px; border-radius: 4px 4px 0 0;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }
  .org-name  { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; line-height: 1.2; }
  .org-sub   { font-size: 10px; opacity: 0.8; margin-top: 3px; line-height: 1.5; }
  .doc-badge { text-align: right; flex-shrink: 0; }
  .doc-type  { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.7; }
  .doc-num   { font-size: 16px; font-weight: 800; font-family: 'Courier New', monospace; display: block; margin-top: 2px; }

  .notice-band {
    background: #f5f3ff; border: 1px solid #ddd6fe; border-top: none;
    padding: 6px 14px; font-size: 11px; color: #5b21b6; font-weight: 600;
    text-align: center; letter-spacing: 0.03em;
  }

  .meta-strip { display: grid; grid-template-columns: repeat(4,1fr); border: 1px solid #999; border-top: none; }
  .mc { padding: 6px 10px; border-right: 1px solid #999; }
  .mc:last-child { border-right: none; }
  .ml { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #666; margin-bottom: 2px; }
  .mv { font-size: 11.5px; font-weight: 700; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #999; border-top: none; }
  .ic { padding: 8px 12px; border-right: 1px solid #999; }
  .ic:last-child { border-right: none; }
  .il { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #666; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #e5e7eb; }
  .iname { font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 3px; }
  .idet  { font-size: 11px; color: #444; line-height: 1.6; }

  .cn-body { border: 1px solid #999; border-top: none; }

  .amount-block {
    padding: 20px 24px;
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
    border-bottom: 1px solid #e5e7eb;
  }
  .amt-label { font-size: 13px; color: #555; font-weight: 500; margin-bottom: 4px; }
  .amt-value { font-size: 32px; font-weight: 900; color: #7c3aed; font-variant-numeric: tabular-nums; }
  .amt-words { font-size: 11px; color: #666; margin-top: 4px; font-style: italic; }

  .reason-block { padding: 14px 24px; border-bottom: 1px solid #e5e7eb; }
  .reason-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #666; margin-bottom: 6px; }
  .reason-text  { font-size: 12px; color: #222; line-height: 1.6; padding: 8px 12px; background: #f9f9f9; border-left: 3px solid #7c3aed; border-radius: 0 4px 4px 0; }

  .ref-block { padding: 12px 24px; }
  .ref-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #666; margin-bottom: 6px; }
  .ref-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ref-table th { font-size: 9px; font-weight: 700; color: #666; text-transform: uppercase; padding: 4px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  .ref-table td { padding: 5px 8px; color: #333; border-bottom: 1px solid #f0f0f0; }
  .ref-table tr:last-child td { border-bottom: none; }

  .footer { border: 1px solid #999; border-top: none; display: grid; grid-template-columns: 1fr auto; align-items: end; padding: 10px 14px; gap: 12px; }
  .fn { font-size: 9px; color: #999; line-height: 1.7; }
  .sig-line { width: 120px; border-top: 1px solid #333; margin: 24px 0 0 auto; padding-top: 3px; font-size: 9.5px; font-weight: 700; text-align: center; }

  @media print {
    body { padding: 0; }
    .page { padding: 6mm 8mm; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header-band">
    <div>
      <div class="org-name">${org.name}</div>
      <div class="org-sub">
        ${org.address ? org.address + '<br>' : ''}
        ${org.phone ? 'Ph: ' + org.phone : ''}
        ${org.gstin ? ' | GSTIN: ' + org.gstin : ''}
      </div>
    </div>
    <div class="doc-badge">
      <div class="doc-type">Credit Note</div>
      <span class="doc-num">${cn.creditNoteNumber}</span>
    </div>
  </div>

  <div class="notice-band">
    This Credit Note is issued against Invoice <strong>${cn.invoiceNumber ?? cn.invoiceId}</strong>.
    The credit amount may be adjusted against future invoices or refunded as agreed.
  </div>

  <div class="meta-strip">
    <div class="mc"><div class="ml">Credit Note No.</div><div class="mv">${cn.creditNoteNumber}</div></div>
    <div class="mc"><div class="ml">Date Issued</div><div class="mv">${fmtDate(cn.createdAt)}</div></div>
    <div class="mc"><div class="ml">Against Invoice</div><div class="mv">${cn.invoiceNumber ?? '—'}</div></div>
    <div class="mc"><div class="ml">Job Card</div><div class="mv">${cn.jobCardId ?? '—'}</div></div>
  </div>

  ${customerName ? `
  <div class="info-grid">
    <div class="ic">
      <div class="il">Issued To</div>
      <div class="iname">${customerName}</div>
      <div class="idet">
        ${customerPhone ? `<b>Ph:</b> ${customerPhone}<br>` : ''}
        ${customerAddress ? `<b>Address:</b> ${customerAddress}` : ''}
      </div>
    </div>
    <div class="ic">
      <div class="il">Original Invoice</div>
      <div class="iname">${cn.invoiceNumber ?? cn.invoiceId}</div>
      <div class="idet">Credit note issued on ${fmtDate(cn.createdAt)}</div>
    </div>
  </div>` : ''}

  <div class="cn-body">
    <!-- Credit amount block -->
    <div class="amount-block">
      <div>
        <div class="amt-label">Credit Amount</div>
        <div class="amt-value">${fmtINR(cn.amount)}</div>
        <div class="amt-words">${numberToWords(cn.amount)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#666;margin-bottom:4px">Against Invoice</div>
        <div style="font-size:14px;font-weight:800;font-family:'Courier New',monospace;color:#1a1a1a">${cn.invoiceNumber ?? '—'}</div>
      </div>
    </div>

    <!-- Reason block -->
    <div class="reason-block">
      <div class="reason-label">Reason for Credit Note</div>
      <div class="reason-text">${cn.reason || 'Not specified'}</div>
    </div>

    <!-- Reference table -->
    <div class="ref-block">
      <div class="ref-label">Summary</div>
      <table class="ref-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Reference</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Credit issued against Invoice ${cn.invoiceNumber ?? cn.invoiceId}</td>
            <td>${cn.creditNoteNumber}</td>
            <td style="text-align:right;font-weight:700;color:#7c3aed">${fmtINR(cn.amount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <div class="fn">
      This is a computer generated credit note and requires no signature.<br>
      For queries, contact us at ${org.phone ?? org.name}.
    </div>
    <div>
      <div class="sig-line">For ${org.name}</div>
    </div>
  </div>

</div>
<script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Pop-up blocked. Please allow pop-ups to print.'); return; }
  win.document.write(html);
  win.document.close();
}
