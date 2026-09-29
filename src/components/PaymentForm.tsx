import { useState } from 'react'
import { recordPayment } from '../hooks/usePayments'
import { formatMoney, formatBillingPeriod } from '../lib/utils'
import type { BillingCharge } from '../types/database'

interface Props {
  customerId: string
  customerName: string
  outstandingCharges: BillingCharge[]
  onSuccess: () => void
  onCancel: () => void
}

export function PaymentForm({ customerId, customerName, outstandingCharges, onSuccess, onCancel }: Props) {
  const totalOutstanding = outstandingCharges.reduce((s, c) => s + c.balance, 0)
  const [amount, setAmount] = useState(String(totalOutstanding || ''))
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseInt(amount)
    if (isNaN(amt) || amt <= 0) {
      setError('Montant invalide')
      return
    }
    setSaving(true)
    setError(null)

    const result = await recordPayment({
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
      onSuccess()
    }
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
          min="1"
          step="1000"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
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
