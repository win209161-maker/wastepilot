import { useState } from 'react'
import { Download } from 'lucide-react'
import { recordPayment } from '../hooks/usePayments'
import { useOrg } from '../context/OrgContext'
import { formatMoney, formatBillingPeriod } from '../lib/utils'
import { generateReceipt, downloadPdf, shareOnWhatsApp, type ReceiptData } from '../lib/pdf'
import type { BillingCharge } from '../types/database'

interface Props {
  customerId: string
  customerName: string
  outstandingCharges: BillingCharge[]
  onSuccess: () => void
  onCancel: () => void
  phone?: string | null
  subscriberId?: string | null
}

interface DoneState {
  paymentId: string
  amount: number
  method: string
  date: string
  reference: string
  coveredPeriods: string[]
}

export function PaymentForm({ customerId, customerName, outstandingCharges, onSuccess, onCancel, phone, subscriberId }: Props) {
  const { org } = useOrg()
  const totalOutstanding = outstandingCharges.reduce((s, c) => s + c.balance, 0)
  const [amount, setAmount] = useState(String(totalOutstanding || ''))
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<DoneState | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseInt(amount)
    if (isNaN(amt) || amt < 1000) {
      setError('Montant invalide — minimum 1 000 FG')
      return
    }
    if (amt > 10000000) {
      setError('Montant trop élevé — maximum 10 000 000 FG (10 millions)')
      return
    }
    setSaving(true)
    setError(null)

    const result = await recordPayment({
      orgId: org!.id,
      customerId,
      amount: amt,
      paymentMethod: method,
      paymentDate: date,
      reference: reference || undefined,
      notes: notes || undefined,
    })

    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setDone({
        paymentId: result.paymentId ?? crypto.randomUUID(),
        amount: amt,
        method,
        date,
        reference,
        coveredPeriods: result.coveredPeriods ?? [],
      })
    }
  }

  function buildReceiptData(): ReceiptData {
    return {
      paymentId: done!.paymentId,
      customerName,
      subscriberId: subscriberId ?? null,
      phone: phone ?? null,
      amount: done!.amount,
      paymentDate: done!.date,
      paymentMethod: done!.method,
      reference: done!.reference || null,
      periods: done!.coveredPeriods,
    }
  }

  function handleDownloadReceipt() {
    if (!done) return
    const doc = generateReceipt(buildReceiptData())
    downloadPdf(doc, `Recu-WP-${done.date}-${customerName.replace(/ /g, '_')}.pdf`)
  }

  async function handleWhatsAppReceipt() {
    if (!done) return
    const receiptNum = `WP-R-${done.paymentId.slice(-8).toUpperCase()}`
    const doc = generateReceipt(buildReceiptData())
    const filename = `Recu-WP-${done.date}-${customerName.replace(/ /g, '_')}.pdf`
    const text =
      `Bonjour ${customerName.split(' ')[0]},\n\n` +
      `Votre paiement a ete confirme.\n` +
      `Recu N: ${receiptNum}\n` +
      `Montant: ${done.amount.toLocaleString('fr-FR')} FG\n` +
      `Date: ${new Date(done.date).toLocaleDateString('fr-FR')}\n\n` +
      `Merci pour votre confiance.\n- WastePilot`
    await shareOnWhatsApp(doc, filename, { phone, text })
  }

  if (done) {
    const receiptNum = `WP-R-${done.paymentId.slice(-8).toUpperCase()}`
    const periodText = done.coveredPeriods.length > 0
      ? done.coveredPeriods.map(p => {
          const [, m] = p.split('-')
          const months = ['janv.','fevr.','mars','avr.','mai','juin','juil.','aout','sept.','oct.','nov.','dec.']
          return months[parseInt(m) - 1]
        }).join(', ')
      : ''
    const waPhone = (phone ?? '').replace(/\D/g, '')

    return (
      <div className="p-6 space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f0fdf4' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="font-bold text-gray-900 text-base">Paiement enregistre !</p>
          <p className="text-sm text-gray-500 mt-1">{formatMoney(done.amount)}</p>
          <p className="text-xs text-gray-400">{customerName} · Recu {receiptNum}</p>
        </div>

        <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          {done.coveredPeriods.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Periode couverte</span>
              <span className="font-medium text-gray-700">{periodText}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Methode</span>
            <span className="font-medium text-gray-700">
              {done.method === 'cash' ? 'Especes' : done.method === 'mobile_money' ? 'Mobile Money' : done.method === 'bank_transfer' ? 'Virement' : 'Autre'}
            </span>
          </div>
          {done.reference && (
            <div className="flex justify-between">
              <span className="text-gray-500">Reference</span>
              <span className="font-medium text-gray-700">{done.reference}</span>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <button
            onClick={handleDownloadReceipt}
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl font-semibold text-sm border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Telecharger le recu PDF
          </button>

          {waPhone ? (
            <button
              onClick={handleWhatsAppReceipt}
              className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
              style={{ background: '#25D366', boxShadow: '0 4px 14px rgba(37,211,102,0.4)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Envoyer le recu sur WhatsApp
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs text-gray-400 border border-dashed border-gray-200">
              Aucun numero de telephone enregistre
            </div>
          )}

          <button className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors" onClick={onSuccess}>
            Fermer
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">Client</p>
        <p className="text-sm font-semibold text-gray-900">{customerName}</p>
        {totalOutstanding > 0 && (
          <p className="text-xs text-red-600 mt-0.5">Solde restant: {formatMoney(totalOutstanding)}</p>
        )}
      </div>

      {outstandingCharges.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Charges impayées</p>
          <div className="space-y-1">
            {outstandingCharges.map(c => (
              <div key={c.id} className="flex justify-between text-xs py-1 border-b border-gray-100">
                <span className="text-gray-600">{formatBillingPeriod(c.billing_period)}</span>
                <span className="font-medium text-red-600">{formatMoney(c.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="label">Montant (FG) *</label>
        <input
          className="input text-lg font-semibold"
          type="number"
          min="1000"
          max="10000000"
          step="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
        <p className="text-xs text-gray-400 mt-1">
          Plage autorisée: 1 000 – 10 000 000 FG
          {amount && !isNaN(parseInt(amount)) && parseInt(amount) >= 1000 && (
            <span className="ml-2 font-medium" style={{ color: 'var(--color-brand)' }}>= {formatMoney(parseInt(amount))}</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Mode de paiement</label>
          <select className="select" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Virement bancaire</option>
            <option value="other">Autre</option>
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="label">Référence (optionnel)</label>
        <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Numéro de reçu, référence..." />
      </div>

      <div>
        <label className="label">Notes (optionnel)</label>
        <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={saving}>
          {saving ? 'Enregistrement...' : 'Valider le paiement'}
        </button>
      </div>
    </form>
  )
}
