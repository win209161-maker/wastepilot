import jsPDF from 'jspdf'
import { formatBillingPeriod } from './utils'

const BRAND = '#1B6C42'
const BRAND_LIGHT = '#E9EFED'
const GRAY = '#6b7280'
const DARK = '#111827'

function pdfMoney(amount: number): string {
  const s = String(Math.round(amount))
  const parts: string[] = []
  for (let i = s.length; i > 0; i -= 3) {
    parts.unshift(s.slice(Math.max(0, i - 3), i))
  }
  return parts.join(' ') + ' FG'
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
  const parts = dateStr.split('T')[0].split('-').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return dateStr
  const [yr, mo, day] = parts
  return `${day} ${PDF_MONTHS[mo - 1].slice(0, 4)}. ${yr}`
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

  // Title — same size and position as "FACTURE"
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(DARK)
  doc.text('RECU DE PAIEMENT', 14, 41)

  // N° + date stacked on left (same as invoice N° + Emis le)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  const receiptNum = `WP-R-${data.paymentId.slice(-8).toUpperCase()}`
  doc.text(`N ${receiptNum}`, 14, 49)
  doc.text(`Date: ${pdfDate(data.paymentDate)}`, 14, 56)

  // "CONFIRME" green badge — right side, same as invoice status badge
  const badgeW = 36
  doc.setFillColor(BRAND)
  doc.roundedRect(W - 14 - badgeW, 36, badgeW, 10, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('CONFIRME', W - 14 - badgeW / 2, 42.6, { align: 'center' })
  doc.setTextColor(DARK)

  drawDivider(doc, 61, W)

  // ── Two-column cards (same layout as invoice CLIENT | PERIODE) ──
  const boxTop = 65
  const boxH = 36
  const halfW = (W - 28) / 2 - 4

  // LEFT: CLIENT
  doc.setFillColor(BRAND_LIGHT)
  doc.roundedRect(14, boxTop, halfW, boxH, 3, 3, 'F')
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
  if (data.phone) doc.text(`Tel: ${data.phone}`, 18, boxTop + (data.subscriberId ? 27 : 21))

  // RIGHT: PAIEMENT (method + date + ref)
  const bx = 14 + halfW + 8
  const bw = halfW
  doc.setFillColor(BRAND_LIGHT)
  doc.roundedRect(bx, boxTop, bw, boxH, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND)
  doc.text('MODE DE PAIEMENT', bx + 4, boxTop + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(DARK)
  doc.text(METHOD_FR[data.paymentMethod] ?? data.paymentMethod, bx + 4, boxTop + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(GRAY)
  doc.text(pdfDate(data.paymentDate), bx + 4, boxTop + 21)
  if (data.reference) doc.text(`Ref: ${data.reference}`, bx + 4, boxTop + 27)

  drawDivider(doc, boxTop + boxH + 6, W)

  // ── Line items: periods covered (same table structure as invoice) ──
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

  if (data.periods.length === 0) {
    doc.setTextColor(DARK)
    doc.text('Paiement - service de collecte des dechets', 14, y)
    doc.setTextColor(DARK)
    doc.text(pdfMoney(data.amount), W - 14, y, { align: 'right' })
    y += 8
  } else {
    for (const period of data.periods) {
      doc.setTextColor(DARK)
      doc.text(`Service de collecte - ${pdfBillingPeriod(period)}`, 14, y)
      doc.setTextColor(GRAY)
      doc.text('-', W - 14, y, { align: 'right' })
      y += 7
    }
    y += 1
  }

  drawDivider(doc, y, W)
  y += 8

  // ── MONTANT RECU box — mirrors SOLDE A PAYER ──
  doc.setFillColor('#f0fdf4')
  doc.roundedRect(14, y, W - 28, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(BRAND)
  doc.text('MONTANT RECU', 20, y + 10)
  doc.setFontSize(14)
  doc.text(pdfMoney(data.amount), W - 20, y + 10, { align: 'right' })

  y += 22

  // ── Confirmation note box — mirrors invoice payment note ──
  doc.setFillColor(BRAND_LIGHT)
  doc.roundedRect(14, y, W - 28, 26, 3, 3, 'F')

  // Green filled circle checkmark (circle center + title on the same row)
  const ck = { x: 22, y: y + 10 }
  doc.setFillColor(BRAND)
  doc.circle(ck.x, ck.y, 4.5, 'F')
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1.2)
  doc.line(ck.x - 2, ck.y, ck.x - 0.3, ck.y + 2)
  doc.line(ck.x - 0.3, ck.y + 2, ck.x + 2.5, ck.y - 2)
  doc.setDrawColor('#e5e7eb')
  doc.setLineWidth(0.3)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(BRAND)
  doc.text('PAIEMENT CONFIRME', 30, y + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(GRAY)
  doc.text('Ce document certifie la reception du montant indique.', 18, y + 19)
  doc.text('Conservez ce recu comme preuve de paiement.', 18, y + 24)

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

// Share PDF via Web Share API (attaches file on mobile), falls back to download + WhatsApp text link
export async function shareOnWhatsApp(
  doc: jsPDF,
  filename: string,
  options: { phone?: string | null; text?: string } = {}
): Promise<void> {
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace('.pdf', '').replace(/-/g, ' '),
        text: options.text ?? '',
      })
      return
    } catch {
      // AbortError = user cancelled — fall through to download
    }
  }

  // Desktop / unsupported: download PDF then open WhatsApp with pre-filled text
  doc.save(filename)
  const digits = (options.phone ?? '').replace(/\D/g, '')
  if (digits && options.text) {
    const num = digits.startsWith('224') ? digits : `224${digits}`
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(options.text)}`, '_blank')
  }
}
