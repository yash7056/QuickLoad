import { jsPDF } from 'jspdf';

// Converts a whole-rupee amount into words, Indian numbering (lakh/crore),
// the way it appears at the bottom of real GST invoices.
function amountInWords(amount) {
  const num = Math.round(amount);
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  };
  const threeDigits = (n) => {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
  };

  let n = num;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  const parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(' ') || 'Zero';
}

const VEHICLE_LABEL = { tempo: 'Tempo', minitruck: 'Mini Truck', trailer: 'Heavy Trailer' };

const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

/**
 * Renders a proper GST tax invoice PDF for a delivered ride and triggers a download.
 * `ride` is the full ride document from the backend (fare breakdown included).
 * `company` is the { name, address, gstin, pan, email, phone } object from GET /api/company.
 */
export function downloadInvoice(ride, company) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 48;

  const line = (yPos, weight = 0.75) => {
    doc.setLineWidth(weight);
    doc.setDrawColor(190, 190, 190);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // ---------- Letterhead ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 25, 40);
  doc.text(company.name, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 110);
  y += 16;
  doc.text(company.address, margin, y, { maxWidth: 300 });
  y += 22;
  doc.text(`GSTIN: ${company.gstin}   |   PAN: ${company.pan}`, margin, y);
  y += 12;
  doc.text(`${company.email}   |   ${company.phone}`, margin, y);

  // Tax invoice badge, top right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 25, 40);
  doc.text('TAX INVOICE', pageWidth - margin, 48, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 110);
  doc.text(`Invoice No: ${ride.invoiceNumber || 'N/A'}`, pageWidth - margin, 66, { align: 'right' });
  const invoiceDate = new Date(ride.updatedAt || ride.createdAt);
  doc.text(`Invoice Date: ${invoiceDate.toLocaleDateString('en-IN')}`, pageWidth - margin, 80, { align: 'right' });
  doc.text(`Place of Supply: Maharashtra`, pageWidth - margin, 94, { align: 'right' });

  y = 116;
  line(y);
  y += 24;

  // ---------- Bill To / Shipment summary, two columns ----------
  const colWidth = (pageWidth - margin * 2 - 20) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 25, 40);
  doc.text('Billed To', margin, y);
  doc.text('Shipment Details', margin + colWidth + 20, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 70, 80);
  let leftY = y + 16;
  doc.text(ride.customerName || 'Guest User', margin, leftY); leftY += 14;
  if (ride.customerPhone) { doc.text(`Phone: ${ride.customerPhone}`, margin, leftY); leftY += 14; }
  doc.text(ride.customerGSTIN ? `GSTIN: ${ride.customerGSTIN}` : 'GSTIN: Unregistered / Consumer', margin, leftY); leftY += 14;

  let rightY = y + 16;
  const rx = margin + colWidth + 20;
  doc.text(`Ride ID: ${ride._id}`, rx, rightY); rightY += 14;
  doc.text(`Vehicle: ${VEHICLE_LABEL[ride.vehicleType] || ride.vehicleType}`, rx, rightY); rightY += 14;
  doc.text(`Driver: ${ride.driverName || 'N/A'}${ride.driverVehicleNumber ? ' · ' + ride.driverVehicleNumber : ''}`, rx, rightY); rightY += 14;
  doc.text(`Distance: ${ride.distance} km`, rx, rightY); rightY += 14;

  y = Math.max(leftY, rightY) + 6;

  // Route banner
  doc.setFillColor(244, 247, 250);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 30, 45);
  doc.text(ride.pickupLocation, margin + 12, y + 20);
  doc.text('→', pageWidth / 2 - 4, y + 20);
  doc.text(ride.dropoffLocation, pageWidth - margin - 12, y + 20, { align: 'right' });

  y += 50;
  line(y);
  y += 20;

  // ---------- Charges table ----------
  const rows = [
    ['Base fare', VEHICLE_LABEL[ride.vehicleType] || ride.vehicleType, money(ride.baseFare)],
    ['Distance charge', `${ride.distance} km`, money(ride.distanceFare)],
  ];
  if (ride.rainSurcharge > 0) rows.push(['Weather surcharge', 'Rain conditions en route', money(ride.rainSurcharge)]);
  if (ride.rushHourSurcharge > 0) rows.push(['Peak-hour surcharge', 'High-demand time slot', money(ride.rushHourSurcharge)]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(20, 35, 55);
  doc.rect(margin, y, pageWidth - margin * 2, 22, 'F');
  doc.text('Description', margin + 10, y + 15);
  doc.text('Details', margin + 240, y + 15);
  doc.text('Amount', pageWidth - margin - 10, y + 15, { align: 'right' });
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 50, 60);
  rows.forEach((row, i) => {
    const rowH = 22;
    if (i % 2 === 1) {
      doc.setFillColor(248, 249, 251);
      doc.rect(margin, y, pageWidth - margin * 2, rowH, 'F');
    }
    doc.text(row[0], margin + 10, y + 15);
    doc.setTextColor(110, 120, 130);
    doc.text(row[1], margin + 240, y + 15);
    doc.setTextColor(40, 50, 60);
    doc.text(row[2], pageWidth - margin - 10, y + 15, { align: 'right' });
    y += rowH;
  });

  line(y, 0.5);
  y += 18;

  // ---------- Totals ----------
  const totalsX = pageWidth - margin - 160;
  const totalRow = (label, value, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.bold ? 10.5 : 9.5);
    doc.setTextColor(...(opts.bold ? [15, 25, 40] : [80, 90, 100]));
    doc.text(label, totalsX, y);
    doc.text(value, pageWidth - margin - 10, y, { align: 'right' });
    y += opts.bold ? 20 : 16;
  };

  totalRow('Subtotal (taxable value)', money(ride.subtotal));

  if (company.useIGST === false) {
    totalRow(`CGST @ ${(ride.taxRate / 2).toFixed(1)}%`, money(ride.taxAmount / 2));
    totalRow(`SGST @ ${(ride.taxRate / 2).toFixed(1)}%`, money(ride.taxAmount / 2));
  } else {
    totalRow(`IGST @ ${ride.taxRate}%`, money(ride.taxAmount));
  }

  y += 4;
  line(y, 0.5);
  y += 16;
  totalRow('Total Payable', money(ride.price), { bold: true });

  y += 16;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 120, 130);
  doc.text(`Amount in words: Rupees ${amountInWords(ride.price)} Only`, margin, y, { maxWidth: pageWidth - margin * 2 });

  // ---------- Footer ----------
  const footerY = doc.internal.pageSize.getHeight() - 80;
  line(footerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130, 140, 150);
  doc.text('This is a system-generated invoice for cargo transportation services rendered and does not require a physical signature.', margin, footerY + 16, { maxWidth: pageWidth - margin * 2 });
  doc.text(`Tax is payable on reverse charge basis: No   |   Generated on ${new Date().toLocaleString('en-IN')}`, margin, footerY + 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 70, 80);
  doc.text(`For ${company.name}`, pageWidth - margin, footerY + 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Authorised Signatory', pageWidth - margin, footerY + 44, { align: 'right' });

  doc.save(`Invoice_${ride.invoiceNumber ? ride.invoiceNumber.replace(/\//g, '-') : ride._id}.pdf`);
}
