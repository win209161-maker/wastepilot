import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'
import type { Sector } from '../types/database'

export function Settings() {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [newSector, setNewSector] = useState({ name: '', code: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('sectors').select('*').order('name').then(({ data }) => setSectors(data ?? []))
  }, [])

  async function addSector() {
    if (!newSector.name || !newSector.code) return
    setSaving(true)
    const { data } = await supabase.from('sectors').insert({
      name: newSector.name.trim(),
      code: newSector.code.trim().toUpperCase(),
      description: newSector.description || null,
      active: true,
    } as any).select().single()
    if (data) setSectors(prev => [...prev, data as any])
    setNewSector({ name: '', code: '', description: '' })
    setSaving(false)
  }

  async function toggleSector(id: string, active: boolean) {
    await supabase.from('sectors').update({ active } as any).eq('id', id)
    setSectors(prev => prev.map(s => s.id === id ? { ...s, active } : s))
  }

  return (
    <div>
      <PageHeader title="Paramètres" description="Configuration de l'application" />

      <div className="max-w-2xl space-y-6">
        {/* Sectors */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Secteurs / Zones</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {sectors.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  <span className="ml-2 text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.code}</span>
                  {s.description && <span className="ml-2 text-xs text-gray-400">{s.description}</span>}
                </div>
                <button
                  onClick={() => toggleSector(s.id, !s.active)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    s.active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {s.active ? 'Actif' : 'Inactif'}
                </button>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Nom du secteur"
                value={newSector.name}
                onChange={e => setNewSector(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input w-24"
                placeholder="Code"
                value={newSector.code}
                onChange={e => setNewSector(f => ({ ...f, code: e.target.value }))}
              />
              <button className="btn-primary" onClick={addSector} disabled={saving || !newSector.name || !newSector.code}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">À propos de WastePilot</h2>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Base de données</span>
              <span className="text-green-600">Supabase PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span>Devise</span>
              <span>Franc Guinéen (FG)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
