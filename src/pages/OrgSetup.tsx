import { useState } from 'react'
import { Building2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'

type Tab = 'create' | 'join'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function OrgSetup() {
  const { refresh } = useOrg()
  const [tab, setTab] = useState<Tab>('join')

  // Create tab
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Join tab
  const [joinSlug, setJoinSlug] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // Refresh
  const [refreshing, setRefreshing] = useState(false)

  function handleNameChange(val: string) {
    setName(val)
    if (!slugEdited) setSlug(toSlug(val))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setCreating(true)
    setCreateError(null)

    const { error } = await supabase.rpc('create_org', {
      p_name: name.trim(),
      p_slug: slug.trim(),
    })

    setCreating(false)
    if (error) {
      setCreateError(
        error.message.includes('unique') || error.message.includes('duplicate')
          ? 'Ce slug est déjà pris. Essayez un autre identifiant.'
          : error.message
      )
      return
    }
    await refresh()
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinSlug.trim()) return
    setJoining(true)
    setJoinError(null)

    const { data, error } = await (supabase as any).rpc('join_org_by_slug', {
      p_slug: joinSlug.trim().toLowerCase(),
    })

    setJoining(false)
    if (error) {
      setJoinError('Erreur: ' + error.message)
      return
    }
    if (data === 'error:not_found') {
      setJoinError('Identifiant introuvable. Vérifiez le slug avec l\'administrateur.')
      return
    }
    await refresh()
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-sage)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-brand)' }}
          >
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="page-title mb-1">WastePilot</h1>
          <p className="text-sm text-gray-500">Configurez votre accès</p>
        </div>

        <div className="card p-6">
          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
            <button
              type="button"
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${tab === 'join' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              onClick={() => { setTab('join'); setJoinError(null) }}
            >
              Rejoindre
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${tab === 'create' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              onClick={() => { setTab('create'); setCreateError(null) }}
            >
              Créer
            </button>
          </div>

          {tab === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <p className="text-sm text-gray-500">
                Entrez l'identifiant (slug) de votre organisation. Demandez-le à l'administrateur.
              </p>
              {joinError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {joinError}
                </div>
              )}
              <div>
                <label className="label">Identifiant de l'organisation</label>
                <input
                  className="input font-mono"
                  value={joinSlug}
                  onChange={e => setJoinSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="collecte-conakry"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full justify-center py-2.5"
                disabled={joining || !joinSlug.trim()}
              >
                {joining ? 'Connexion…' : 'Rejoindre l\'organisation'}
              </button>
            </form>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {createError}
                </div>
              )}
              <div>
                <label className="label">Nom de l'organisation *</label>
                <input
                  className="input"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ex: Collecte Conakry…"
                  required
                />
              </div>
              <div>
                <label className="label">Identifiant unique (slug) *</label>
                <input
                  className="input font-mono"
                  value={slug}
                  onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugEdited(true) }}
                  placeholder="collecte-conakry"
                  pattern="[a-z0-9-]+"
                  minLength={3}
                  required
                />
                <p className="text-xs text-gray-400 mt-0.5">
                  Partagez ce slug avec vos collègues pour qu'ils puissent rejoindre
                </p>
              </div>
              <button
                type="submit"
                className="btn-primary w-full justify-center py-2.5"
                disabled={creating || !name.trim() || slug.length < 3}
              >
                {creating ? 'Création…' : 'Créer l\'organisation'}
              </button>
            </form>
          )}
        </div>

        {/* Refresh — for accounts that were already added by admin */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 mt-4 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Vérification…' : 'Déjà ajouté par un admin ? Cliquez ici'}
        </button>

        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2 transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
