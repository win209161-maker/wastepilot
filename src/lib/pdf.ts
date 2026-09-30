import jsPDF from 'jspdf'
import { formatBillingPeriod } from './utils'

const BRAND = '#1B6C42'
const BRAND_LIGHT = '#E9EFED'
const GRAY = '#6b7280'
const DARK = '#111827'

function pdfMoney(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FG'
}

function drawHeader(doc: jsPDF, docWidth: number) {
  // Green header bar
  doc.setFillColor(BRAND)
  doc.rect(0, 0, docWidth, 28, 'F')

  // WastePilot title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('WastePilot', 14, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 230, 215)
  doc.text('Gestion des collectes de déchets · Conakry, Guinée', 14, 19)

  // Trash can icon (simple drawn)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.5)
  const ix = docWidth - 22
  doc.roundedRect(ix - 4, 5, 10, 12, 1.5, 1.5, 'S')
  doc.line(ix - 6, 7, ix + 8, 7)
  doc.line(ix, 5, ix, 3)
  doc.line(ix + 2, 5, ix + 2, 3)
  doc.line(ix - 2, 9, ix - 2, 16)
  doc.line(ix + 2, 9, ix + 2, 16)

  doc.setTextColor(DARK)
  doc.setDrawColor('#e5e7eb')
}

function drawFooter(doc: jsPDF, docWidth: number, pageHeight: number) {
  doc.setFillColor(BRAND_LIGHT)
  doc.rect(0, pageHeight - 18, docWidth, 18, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(GRAY)
  doc.text('WastePilot · Conakry, Guinée · Gestion professionnelle des collectes', docWidth / 2, pageHeight - 9, { align: 'center' })
  doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, docWidth / 2, pageHeight - 4.5, { align: 'center' })
}

function drawDivider(doc: jsPDF, y: number, docWidth: number) {
  doc.setDrawColor('#e5e7eb')
  doc.setLineWidth(0.3)
  doc.line(14, y, docWidth - 14, y)
}

function row(doc: jsPDF, label: string, value: string, y: number, docWidth: number, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(9)
  doc.setTextColor(GRAY)
  doc.text(label, 14, y)
  doc.setTextColor(bold ? BRAND : DARK)
  doc.text(value, docWidth - 14, y, { align: 'right' })
}

export interface InvoiceData {
  chargeId: string
  customerName: string
  subscriberId: string | null
  sectorName: string | null
  phone: string | null
  billingPeriod: string
  monthlyPrice: number
  monthsBilled: number
  amountDue: number
  amountPaid: number
  balance: number
  status: string
}

export interface ReceiptData {
  paymentId: string
  customerName: string
  subscriberId: string | null
  phone: string | null
  amount: number
  paymentDate: string
  paymentMethod: string
  reference: string | null
  periods: string[]
}

const METHOD_FR: Record<string, string> = {
  cash: 'Especes',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
  other: 'Autre',
}

const PDF_MONTHS = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre']

function pdfBillingPeriod(period: string): string {
  const [year, month] = period.split('-')
  return `${PDF_MONTHS[parseInt(month) - 1]} ${year}`
}

function pdfDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${PDF_MONTHS[d.getMonth()].slice(0, 4)}. ${d.getFullYear()}`
}

export function generateInvoice(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  drawHeader(doc, W)

  // Invoice title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(DARK)
  doc.text('FACTURE', 14, 41)

  // Invoice number + date (left side, stacked)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  const invoiceNum = `WP-${data.billingPeriod.replace('-', '')}-${data.chargeId.slice(-6).toUpperCase()}`
  doc.text(`N° ${invoiceNum}`, 14, 49)
  doc.text(`Emis le ${new Date().toLocaleDateString('fr-FR')}`, 14, 56)

  // Status badge — right side, clearly separated from date
  const statusLabel = data.status === 'paid' ? 'PAYE' : data.status === 'overdue' ? 'EN RETARD' : data.status === 'partial' ? 'PARTIEL' : 'IMPAYE'
  const statusBg = data.status === 'paid' ? '#16a34a' : data.status === 'overdue' ? '#dc2626' : '#d97706'
  const badgeW = 36
  const badgeH = 10
  doc.setFillColor(statusBg)
  doc.roundedRect(W - 14 - badgeW, 36, badgeW, badgeH, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text(statusLabel, W - 14 - badgeW / 2, 42.6, { align: 'center' })
  doc.setTextColor(DARK)

  drawDivider(doc, 61, W)

  // Client info box
  const boxTop = 65
  const boxH = 36
  doc.setFillColor(BRAND_LIGHT)
  doc.roundedRect(14, boxTop, (W - 28) / 2 - 4, boxH, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND)
  doc.text('CLIENT', 18, boxTop + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(DARK)
  doc.text(data.customerName, 18, boxTop + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  if (data.subscriberId) doc.text(`N ${data.subscriberId}`, 18, boxTop + 21)
  if (data.sectorName) doc.text(`Secteur: ${data.sectorName}`, 18, boxTop + 27)
  if (data.phone) doc.text(`Tel: ${data.phone}`, 18, boxTop + 33)

  // Period box
  const bx = 14 + (W - 28) / 2 + 4
  const bw = (W - 28) / 2 - 4
  doc.setFillColor(BRAND_LIGHT)
  doc.roundedRect(bx, boxTop, bw, boxH, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND)
  doc.text('PERIODE', bx + 4, boxTop + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(DARK)
  doc.text(formatBillingPeriod(data.billingPeriod), bx + 4, boxTop + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  doc.text(`${data.monthsBilled} mois facture(s)`, bx + 4, boxTop + 21)

  drawDivider(doc, boxTop + boxH + 6, W)

  // Line items
  const liTop = boxTop + boxH + 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(GRAY)
  doc.text('DESIGNATION', 14, liTop)
  doc.text('MONTANT', W - 14, liTop, { align: 'right' })
  drawDivider(doc, liTop + 3, W)

  let y = liTop + 11
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(DARK)
  doc.text(`Service de collecte des dechets - ${formatBillingPeriod(data.billingPeriod)}`, 14, y)
  doc.text(pdfMoney(data.amountDue), W - 14, y, { align: 'right' })

  if (data.monthsBilled > 1) {
    y += 7
    doc.setFontSize(8)
    doc.setTextColor(GRAY)
    doc.text(`  ${data.monthsBilled} mois x ${pdfMoney(data.monthlyPrice)}/mois`, 14, y)
  }

  y += 8
  drawDivider(doc, y, W)
  y += 8

  if (data.amountPaid > 0) {
    row(doc, 'Montant du', pdfMoney(data.amountDue), y, W)
    y += 7
    row(doc, 'Deja regle', `- ${pdfMoney(data.amountPaid)}`, y, W)
    y += 7
    drawDivider(doc, y, W)
    y += 8
  }

  // Total box
  doc.setFillColor(data.balance > 0 ? '#fef2f2' : '#f0fdf4')
  doc.roundedRect(14, y, W - 28, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(data.balance > 0 ? '#dc2626' : BRAND)
  doc.text('SOLDE A PAYER', 20, y + 10)
  doc.setFontSize(14)
  doc.text(pdfMoney(data.balance), W - 20, y + 10, { align: 'right' })

  y += 22

  // Payment note
  doc.setFillColor(BRAND_LIGHT)
  doc.roundedRect(14, y, W - 28, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(BRAND)
  doc.text('Modalités de paiement', 20, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(GRAY)
  doc.text('Espèces · Mobile Money · Virement bancaire', 20, y + 14)
  doc.text('Merci de régler ce montant pour maintenir votre service de collecte.', 20, y + 20)

  drawFooter(doc, W, H)

  return doc
}

export function generateReceipt(data: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  drawHeader(doc, W)

  // Receipt title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(DARK)
  doc.text('RECU DE PAIEMENT', 14, 40)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  const receiptNum = `WP-R-${data.paymentId.slice(-8).toUpperCase()}`
  doc.text(`N ${receiptNum}`, 14, 47)
  doc.text(pdfDate(data.paymentDate), W - 14, 47, { align: 'right' })

  drawDivider(doc, 52, W)

  // Client info
  doc.setFillColor(BRAND_LIGHT)
  doc.roundedRect(14, 56, W - 28, 28, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND)
  doc.text('RECU DE', 18, 63)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(DARK)
  doc.text(data.customerName, 18, 71)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  const subInfo = [data.subscriberId ? `N ${data.subscriberId}` : null, data.phone ? `Tel: ${data.phone}` : null].filter(Boolean).join('   -   ')
  if (subInfo) doc.text(subInfo, 18, 78)

  let y = 94

  // Amount box
  doc.setFillColor('#f0fdf4')
  doc.roundedRect(14, y, W - 28, 20, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(BRAND)
  doc.text('MONTANT RECU', 20, y + 8)
  doc.setFontSize(18)
  doc.text(pdfMoney(data.amount), W - 20, y + 12, { align: 'right' })

  y += 28

  // Details table
  drawDivider(doc, y, W)
  y += 8

  const details = [
    ['Date de paiement', pdfDate(data.paymentDate)],
    ['Mode de paiement', METHOD_FR[data.paymentMethod] ?? data.paymentMethod],
    ...(data.reference ? [['Reference', data.reference]] : []),
    ...(data.periods.length > 0 ? [['Periode(s) couverte(s)', data.periods.map(pdfBillingPeriod).join(', ')]] : []),
  ]

  for (const [label, value] of details) {
    row(doc, label, value, y, W)
    y += 8
  }

  drawDivider(doc, y, W)
  y += 12

  // Confirmation stamp — green rounded rect + circle checkmark (no unicode)
  const stampW = 72
  const stampX = W / 2 - stampW / 2
  doc.setFillColor(BRAND)
  doc.roundedRect(stampX, y, stampW, 16, 3, 3, 'F')

  // Draw circle checkmark using lines (ASCII-safe alternative to ✓)
  const cx = stampX + 9
  const cy = y + 8
  const r = 4
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.6)
  doc.circle(cx, cy, r, 'S')
  doc.setLineWidth(1.2)
  doc.line(cx - 1.8, cy, cx - 0.3, cy + 1.8)
  doc.line(cx - 0.3, cy + 1.8, cx + 2.2, cy - 1.8)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('PAIEMENT CONFIRME', W / 2 + 3, y + 10, { align: 'center' })

  y += 24
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  doc.text('Merci pour votre paiement. Ce document certifie la reception du montant indique.', W / 2, y, { align: 'center' })
  doc.text('Conservez ce recu comme preuve de paiement.', W / 2, y + 6, { align: 'center' })

  drawFooter(doc, W, H)

  return doc
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename)
}

export function openPdfInNewTab(doc: jsPDF) {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
