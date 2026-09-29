import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Sector } from '../types/database'

interface Props {
  sectors: Sector[]
  onSuccess: () => void
  onCancel: () => void
  defaultValues?: Record<string, string>
}

export function CustomerForm({ sectors, onSuccess, onCancel, defaultValues = {} }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    last_name: defaultValues.last_name ?? '',
    first_name: defaultValues.first_name ?? '',
    phone: defaultValues.phone ?? '',
    subscriber_id: defaultValues.subscriber_id ?? '',
    neighborhood: defaultValues.neighborhood ?? '',
    sector_id: defaultValues.sector_id ?? '',
    concession: defaultValues.concession ?? '',
    reference: defaultValues.reference ?? '',
    address: defaultValues.address ?? '',
    request_date: defaultValues.request_date ?? '',
    monthly_price: defaultValues.monthly_price ?? '20000',
    status: 'active' as const,
  })

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.last_name.trim() || !form.first_name.trim()) {
      setError('Le nom et le prénom sont obligatoires')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .insert({
          last_name: form.last_name.trim().toUpperCase(),
          first_name: form.first_name.trim(),
          phone: form.phone || null,
          subscriber_id: form.subscriber_id || null,
          neighborhood: form.neighborhood || null,
          sector_id: form.sector_id || null,
          concession: form.concession || null,
          reference: form.reference || null,
          address: form.address || null,
          request_date: form.request_date || null,
          status: form.status,
        })
        .select()
        .single()

      if (custErr) throw custErr

      const price = parseInt(form.monthly_price)
      if (!isNaN(price) && price > 0) {
        const { error: subErr } = await supabase.from('subscriptions').insert({
          customer_id: customer.id,
          monthly_price: price,
          start_date: form.request_date || new Date().toISOString().split('T')[0],
          status: 'active',
          service_frequency: 'monthly',
        })
        if (subErr) throw subErr
      }

      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nom *</label>
          <input className="input uppercase" value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Prénom *</label>
          <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Téléphone</label>
          <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="6XXXXXXXX" />
        </div>
        <div>
          <label className="label">N° Abonné</label>
          <input className="input font-mono text-sm" value={form.subscriber_id} onChange={e => set('subscriber_id', e.target.value)} placeholder="FC25/AY/01/0001" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Quartier</label>
          <input className="input" value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} />
        </div>
        <div>
          <label className="label">Secteur</label>
          <select className="select" value={form.sector_id} onChange={e => set('sector_id', e.target.value)}>
            <option value="">— Choisir —</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Concession</label>
          <input className="input" value={form.concession} onChange={e => set('concession', e.target.value)} />
        </div>
        <div>
          <label className="label">Référence / Adresse</label>
          <input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date de demande</label>
          <input className="input" type="date" value={form.request_date} onChange={e => set('request_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Prix mensuel (FG) *</label>
          <input
            className="input"
            type="number"
            min="1"
            step="1000"
            value={form.monthly_price}
            onChange={e => set('monthly_price', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={saving}>
          {saving ? 'Enregistrement...' : 'Créer le client'}
        </button>
      </div>
    </form>
  )
}
