import { useState } from 'react'
import { Building2, Phone, MapPin, X, Sparkles } from 'lucide-react'
import { saveCompanyProfile, skipOnboarding } from '../lib/companyProfile'
import type { Org } from '../context/OrgContext'

interface Props {
  org: Org
  onComplete: () => void
}

export function OnboardingModal({ org, onComplete }: Props) {
  const [form, setForm] = useState({
    name: org.name,
    phone: '',
    city: 'Conakry',
    address: '',
    sector_info: '',
  })

  function save() {
    saveCompanyProfile(org.id, form)
    onComplete()
  }

  function skip() {
    skipOnboarding(org.id)
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--color-brand)' }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Configurer votre profil</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ces infos apparaissent sur vos factures et reçus</p>
              </div>
            </div>
            <button onClick={skip} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nom de l'entreprise *</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                className="input pl-9"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="WastePilot Conakry"
              />
            </div>
          </div>

          <div>
            <label className="label">Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                className="input pl-9"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+224 6X X XX XX XX"
                type="tel"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Ville</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  className="input pl-9"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Conakry"
                />
              </div>
            </div>
            <div>
              <label className="label">Commune / Quartier</label>
              <input
                className="input"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Kaloum, Matam..."
              />
            </div>
          </div>

          <div>
            <label className="label">Secteur d'activité <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input
              className="input"
              value={form.sector_info}
              onChange={e => setForm(f => ({ ...f, sector_info: e.target.value }))}
              placeholder="Collecte des ordures ménagères, Recyclage..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1 justify-center" onClick={skip}>
              Passer
            </button>
            <button
              className="btn-primary flex-1 justify-center"
              onClick={save}
              disabled={!form.name.trim()}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
