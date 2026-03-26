import type { Invoice, InvoiceFormat, JobCard, Estimate } from '../types/models';

export type InvoiceCompanyInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  logoUrl?: string | null;
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Number to words (Indian style) for amount. Simplified for common ranges. */
function amountInWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const int = Math.floor(n);
  if (int === 0) return 'Zero Only';
  if (int > 999999) return `${n.toLocaleString('en-IN')} Only`;
  function upTo99(x: number): string {
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10);
    const o = x % 10;
    return (tens[t] + (o ? ' ' + ones[o] : '')).trim();
  }
  function upTo999(x: number): string {
    if (x < 100) return upTo99(x);
    const h = Math.floor(x / 100);
    const r = x % 100;
    return ones[h] + ' Hundred' + (r ? ' ' + upTo99(r) : '');
  }
  const lakh = Math.floor(int / 100000);
  const rest = int % 100000;
  let s = '';
  if (lakh > 0) s += upTo99(lakh) + ' Lakh ';
  if (rest >= 1000) {
    s += upTo999(Math.floor(rest / 1000)) + ' Thousand ';
    s += upTo999(rest % 1000);
  } else {
    s += upTo999(rest);
  }
  return (s.trim() + ' Only').replace(/\s+/g, ' ');
}

/** Optional bill-to override (e.g. insurance company name for insurance invoice). */
export type BillToOverride = {
  name: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
};

/** Build HTML for invoice PDF. When gstEnabled is false, GSTIN and tax labels are hidden. */
export function buildInvoiceHtml(
  inv: Invoice,
  format: InvoiceFormat,
  job?: JobCard | null,
  est?: Estimate | null,
  company?: InvoiceCompanyInfo | null,
  gstEnabled?: boolean,
  billToOverride?: BillToOverride | null
): string {
  const showGst = gstEnabled !== false;
  const isTax = showGst && format === 'tax';
  const title = isTax ? 'TAX INVOICE' : 'Proforma Invoice';
  const companyName = company?.name?.trim() || 'Company';
  const companyAddress = company?.address?.trim() || '';
  const companyPhone = company?.phone?.trim() || '';
  const companyGstin = showGst ? (company?.gstin?.trim() || '') : '';
  const companyLine = [companyAddress, companyPhone ? `MO: ${companyPhone}` : '', companyGstin ? `GSTIN : ${companyGstin}` : '']
    .filter(Boolean)
    .join(', ');

  const customerName = billToOverride?.name?.trim()
    ? escapeHtml(billToOverride.name)
    : (job?.customer?.name ? escapeHtml(job.customer.name) : '—');
  const contactNo = billToOverride?.phone?.trim()
    ? escapeHtml(billToOverride.phone)
    : (job?.customer?.phone ? escapeHtml(job.customer.phone) : '—');
  const vehicleDesc = job?.vehicle ? `${escapeHtml(job.vehicle.make)} ${escapeHtml(job.vehicle.model)}` : '—';
  const kilometer = job?.odometerReading != null ? job.odometerReading.toLocaleString() : '—';
  const customerGstin = showGst
    ? (billToOverride?.gstin?.trim() ?? job?.customer?.gstin?.trim() ?? '')
    : '';

  const invDate = new Date(inv.createdAt);
  const dateStr = invDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const jobNumber = job?.jobNumber ?? '—';
  const vehicleNo = job?.vehicle?.registrationNo ?? '—';

  const lines = est?.lines ?? [];
  const partLines = lines.filter((l) => l.type === 'part');
  const labourLines = lines.filter((l) => l.type === 'labour');

  const hsnSac = isTax ? '8708' : '—';
  const round2 = (n: number) => Math.round(n * 100) / 100;

  /** Group by tax rate for GST summary: ratePct -> { taxable, cgst, sgst } */
  const rateMap: Record<number, { taxable: number; tax: number }> = {};

  let rows = '';
  let sr = 1;
  let sumSubtotal = 0;
  let sumTaxAmount = 0;

  function addLine(l: { description: string; type: string; quantity: number; unitPrice: number; amount: number }) {
    const qty = Number(l.quantity);
    const unitPrice = Number(l.unitPrice);
    const amount = Number(l.amount);
    const lineSubtotal = round2(qty * unitPrice);
    const lineTaxAmount = round2(amount - lineSubtotal);
    const lineTaxPct = lineSubtotal > 0 ? round2((lineTaxAmount / lineSubtotal) * 100) : 0;
    sumSubtotal += lineSubtotal;
    sumTaxAmount += lineTaxAmount;
    const rateKey = Math.round(lineTaxPct * 100) / 100;
    if (rateKey > 0) {
      if (!rateMap[rateKey]) rateMap[rateKey] = { taxable: 0, tax: 0 };
      rateMap[rateKey].taxable += lineSubtotal;
      rateMap[rateKey].tax += lineTaxAmount;
    }
    const taxCell = lineTaxAmount > 0 ? `${lineTaxAmount.toFixed(2)} (${Math.round(lineTaxPct)}%)` : '—';
    return `<tr><td>${sr++}</td><td>${escapeHtml(l.description)}</td><td>${hsnSac}</td><td class="num">${qty}</td><td class="num">${unitPrice.toLocaleString('en-IN')}</td><td class="num">${taxCell}</td><td class="num">${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`;
  }

  if (partLines.length > 0) {
    rows += '<tr><td colspan="7" class="sec-head">PART</td></tr>';
    partLines.forEach((l) => { rows += addLine(l); });
  }
  if (labourLines.length > 0) {
    rows += '<tr><td colspan="7" class="sec-head">LABOR</td></tr>';
    labourLines.forEach((l) => { rows += addLine(l); });
  }
  if (!rows) {
    rows = `<tr><td>1</td><td>Service</td><td>—</td><td class="num">1</td><td class="num">${inv.totalAmount.toLocaleString('en-IN')}</td><td class="num">—</td><td class="num">${inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`;
    sumSubtotal = inv.totalAmount;
  }

  rows += `<tr class="tfoot-row"><td colspan="5">Sub Total</td><td class="num">${sumTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td class="num">${sumSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`;

  const paid = inv.paidAmount ?? 0;
  const balance = Math.max(0, inv.totalAmount - paid);
  const amountWords = amountInWords(inv.totalAmount);

  const rf = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  let gstSummaryRows = Object.keys(rateMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((ratePct) => {
      const { taxable, tax } = rateMap[ratePct];
      const cgstRate = round2(ratePct / 2);
      const sgstRate = round2(ratePct - cgstRate);
      const cgstAmt = round2(tax / 2);
      const sgstAmt = round2(tax - cgstAmt);
      return `<tr><td>${hsnSac}</td><td class="num">${rf(taxable)}</td><td class="num">${cgstRate.toFixed(0)}%</td><td class="num">${rf(cgstAmt)}</td><td class="num">${sgstRate.toFixed(0)}%</td><td class="num">${rf(sgstAmt)}</td><td class="num">${rf(tax)}</td></tr>`;
    });
  if (isTax && sumTaxAmount > 0 && gstSummaryRows.length === 0) {
    const cgstAmt = round2(sumTaxAmount / 2);
    const sgstAmt = round2(sumTaxAmount - cgstAmt);
    const gstRatePct = sumSubtotal > 0 ? round2((sumTaxAmount / sumSubtotal) * 100) : 0;
    const cgstRate = round2(gstRatePct / 2);
    const sgstRate = round2(gstRatePct - cgstRate);
    gstSummaryRows = [`<tr><td>${hsnSac}</td><td class="num">${rf(sumSubtotal)}</td><td class="num">${cgstRate.toFixed(0)}%</td><td class="num">${rf(cgstAmt)}</td><td class="num">${sgstRate.toFixed(0)}%</td><td class="num">${rf(sgstAmt)}</td><td class="num">${rf(sumTaxAmount)}</td></tr>`];
  }
  const gstTableHtml = isTax && gstSummaryRows.length > 0
    ? `
    <table class="gst-summary">
      <thead>
        <tr>
          <th>HSN/SAC</th>
          <th>Taxable Amt</th>
          <th colspan="2">CGST</th>
          <th colspan="2">SGST</th>
          <th>Total Tax</th>
        </tr>
        <tr class="gst-subhead">
          <th></th>
          <th></th>
          <th>Rate</th>
          <th>Amount</th>
          <th>Rate</th>
          <th>Amount</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${gstSummaryRows.join('')}</tbody>
    </table>`
    : '';

  const logoHtml = company?.logoUrl
    ? `<img src="${escapeHtml(company.logoUrl)}" alt="" class="logo" />`
    : '';

  const companySecondLine = [companyPhone ? `MO: ${companyPhone}` : '', companyGstin ? `GSTIN : ${companyGstin}` : ''].filter(Boolean).join(', ');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; line-height: 1.35; margin: 0; padding: 0; }
    .doc { max-width: 210mm; margin: 0 auto; padding: 14pt 16pt; border: 1px solid #000; }
    .inv-title { font-size: 13pt; font-weight: 700; text-align: center; margin-bottom: 6pt; text-transform: uppercase; }
    .co-name { font-size: 12pt; font-weight: 700; text-align: center; margin-bottom: 2pt; }
    .co-addr { font-size: 9pt; text-align: center; margin-bottom: 2pt; color: #222; }
    .co-mo { font-size: 9pt; text-align: center; margin-bottom: 8pt; color: #222; }
    .logo { max-height: 40px; max-width: 120px; margin: 0 auto 4pt; display: block; }
    .info-box { border: 1px solid #000; margin-bottom: 8pt; }
    .info-row { display: table; width: 100%; font-size: 9pt; border-collapse: collapse; }
    .info-left { display: table-cell; width: 50%; vertical-align: top; padding: 6pt 8pt; border-right: 1px solid #000; }
    .info-right { display: table-cell; width: 50%; vertical-align: top; padding: 6pt 8pt; }
    .info-left .line { margin-bottom: 2pt; }
    .info-grid { border-collapse: collapse; font-size: 9pt; width: 100%; }
    .info-grid td { padding: 2pt 6pt 2pt 0; vertical-align: top; border: none; }
    .info-grid .lbl { font-weight: 600; width: 70pt; }
    .items { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8pt; }
    .items th, .items td { border: 1px solid #000; padding: 4pt 6pt; text-align: left; }
    .items th { background: #f0f0f0; font-weight: 700; }
    .items td.num { text-align: right; }
    .items .sec-head { background: #e8e8e8; font-weight: 700; }
    .items .tfoot-row { font-weight: 700; background: #f5f5f5; }
    .summary-box { border: 1px solid #000; font-size: 9pt; margin-bottom: 6pt; padding: 6pt 8pt; }
    .summary-box .line { display: flex; justify-content: space-between; padding: 2pt 0; }
    .summary-box .line strong { margin-right: 8pt; }
    .words-line { font-size: 9pt; margin: 6pt 0; font-style: italic; }
    .gst-summary { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 8pt; margin-bottom: 10pt; }
    .gst-summary th, .gst-summary td { border: 1px solid #000; padding: 4pt 6pt; text-align: left; }
    .gst-summary th { background: #f0f0f0; font-weight: 700; }
    .gst-summary .gst-subhead th { font-weight: 600; font-size: 8pt; }
    .gst-summary td.num { text-align: right; }
    .footer { margin-top: 14pt; text-align: center; font-size: 9pt; }
    .footer .for { font-weight: 700; margin-bottom: 20pt; }
    .footer .gen { font-size: 8pt; color: #555; margin-top: 4pt; }
    .footer .pageno { font-size: 8pt; color: #666; margin-top: 8pt; }
  </style>
</head>
<body>
  <div class="doc">
    <div class="inv-title">${escapeHtml(title)}</div>
    ${logoHtml}
    <div class="co-name">${escapeHtml(companyName)}</div>
    ${companyAddress ? `<div class="co-addr">${escapeHtml(companyAddress)}</div>` : ''}
    ${companySecondLine ? `<div class="co-mo">${escapeHtml(companySecondLine)}</div>` : ''}
    <div class="info-box">
      <div class="info-row">
        <div class="info-left">
          <div class="line"><strong>Customer :</strong> ${customerName}</div>
          <div class="line"><strong>Contact No. :</strong> ${contactNo}</div>
          <div class="line"><strong>Vehicle :</strong> ${vehicleDesc}</div>
          <div class="line"><strong>Kilometer :</strong> ${kilometer}</div>
          <div class="line"><strong>GSTIN :</strong> ${customerGstin ? escapeHtml(customerGstin) : ''}</div>
        </div>
        <div class="info-right">
          <table class="info-grid">
            <tr><td class="lbl">Invoice No</td><td>${escapeHtml(inv.invoiceNumber)}</td><td class="lbl">Date</td><td>${dateStr}</td></tr>
            <tr><td class="lbl">Jobcard No</td><td>${escapeHtml(jobNumber)}</td><td class="lbl">Vehicle No</td><td>${escapeHtml(vehicleNo)}</td></tr>
          </table>
        </div>
      </div>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th style="width:26pt">Sr.No</th>
          <th>Description</th>
          <th style="width:44pt">HSN/SAC</th>
          <th style="width:28pt">Qty</th>
          <th style="width:52pt">Unit Price</th>
          <th style="width:70pt">Tax %</th>
          <th style="width:52pt">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary-box">
      <div class="line"><strong>Parts Total</strong><span>${rf(inv.partsAmount)}</span></div>
      <div class="line"><strong>Labour Total</strong><span>${rf(inv.labourAmount)}</span></div>
      <div class="line"><strong>Total Payable</strong><span>${rf(inv.totalAmount)}</span></div>
      <div class="line"><strong>Paid</strong><span>${rf(paid)}</span></div>
      <div class="line"><strong>Balance</strong><span>${rf(balance)}</span></div>
    </div>
    <div class="words-line">Amount in words: ${escapeHtml(amountWords)}</div>
    ${gstTableHtml}
    <div class="footer">
      <div class="for">For ${escapeHtml(companyName)}</div>
      <div class="gen">THIS IS A COMPUTER GENERATED INVOICE AND REQUIRES NO SIGNATURE.</div>
      <div class="pageno">— 1 of 1 —</div>
    </div>
  </div>
</body>
</html>`;
}
