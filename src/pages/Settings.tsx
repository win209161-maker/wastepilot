import { useEffect, useState } from 'react'
import { Plus, Users, Building2, ChevronDown, Trash2, UserPlus, AlertTriangle } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'
import { useOrg } from '../context/OrgContext'
import type { Sector } from '../types/database'

interface OrgMemberRow {
  user_id: string
  email: string
  role: string
  joined_at: string
}

export function Settings() {
  const { org, orgs, switchOrg, refresh: refreshOrg } = useOrg()
  const [sectors, setSectors] = useState<Sector[]>([])
  const [newSector, setNewSector] = useState({ name: '', code: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgSaveResult, setOrgSaveResult] = useState<string | null>(null)

  // Members
  const [members, setMembers] = useState<OrgMemberRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!org) return
    supabase.from('sectors').select('*').eq('org_id', org.id).order('name')
      .then(({ data }) => setSectors(data ?? []))
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
    setOrgName(org.name)
    loadMembers()
  }, [org?.id])

  async function loadMembers() {
    if (!org) return
    const { data } = await (supabase as any).rpc('get_org_members', { p_org_id: org.id })
    setMembers((data ?? []) as OrgMemberRow[])
  }

  async function addSector() {
    if (!newSector.name || !newSector.code || !org) return
    setSaving(true)
    const { data } = await supabase.from('sectors').insert({
      org_id: org.id,
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

  async function saveOrgName() {
    if (!org || !orgName.trim()) return
    setSavingOrg(true)
    setOrgSaveResult(null)
    const { error } = await supabase.from('organizations').update({ name: orgName.trim() }).eq('id', org.id)
    setSavingOrg(false)
    if (error) {
      setOrgSaveResult('Erreur: ' + error.message)
    } else {
      setOrgSaveResult('✓ Nom mis à jour')
      await refreshOrg()
      setTimeout(() => setOrgSaveResult(null), 3000)
    }
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!org || !inviteEmail.trim()) return
    setInviting(true)
    setInviteResult(null)

    const { data, error } = await (supabase as any).rpc('add_org_member', {
      p_org_id: org.id,
      p_email: inviteEmail.trim().toLowerCase(),
      p_role: inviteRole,
    })

    setInviting(false)

    if (error) {
      setInviteResult({ ok: false, msg: 'Erreur: ' + error.message })
      return
    }

    const result = data as string
    if (result === 'ok') {
      setInviteResult({ ok: true, msg: `✓ ${inviteEmail} ajouté(e) avec le rôle ${inviteRole}` })
      setInviteEmail('')
      await loadMembers()
    } else if (result === 'error:user_not_found') {
      setInviteResult({ ok: false, msg: `Aucun compte trouvé pour ${inviteEmail}. Cette personne doit d'abord se connecter une fois sur l'application.` })
    } else if (result === 'error:not_authorized') {
      setInviteResult({ ok: false, msg: 'Vous n\'avez pas les droits pour ajouter des membres.' })
    } else {
      setInviteResult({ ok: false, msg: result })
    }
  }

  async function removeMember(userId: string) {
    if (!org) return
    const { data } = await (supabase as any).rpc('remove_org_member', {
      p_org_id: org.id,
      p_user_id: userId,
    })
    if (data === 'ok') await loadMembers()
  }

  async function deleteEverything() {
    if (!org) return
    setDeleting(true)
    setDeleteError(null)
    const { data, error } = await (supabase as any).rpc('delete_org', { p_org_id: org.id })
    if (error) {
      setDeleteError('Erreur: ' + error.message)
      setDeleting(false)
      return
    }
    if (data !== 'ok') {
      setDeleteError(data === 'error:not_owner'
        ? 'Seul le propriétaire de l\'organisation peut supprimer toutes les données.'
        : data)
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
  }

  const canManageMembers = org?.role === 'owner' || org?.role === 'admin'

  return (
    <div>
      <PageHeader title="Paramètres" description="Configuration de l'application" />

      <div className="space-y-6">
        {/* Organisation */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Organisation</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Slug</span>
              <span className="font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs">{org?.slug}</span>
            </div>
            <div>
              <label className="label">Nom de l'organisation</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  disabled={org?.role === 'member'}
                />
                {org?.role !== 'member' && (
                  <button className="btn-primary" onClick={saveOrgName} disabled={savingOrg || orgName === org?.name}>
                    {savingOrg ? '…' : 'OK'}
                  </button>
                )}
              </div>
              {orgSaveResult && (
                <p className={`mt-1 text-xs ${orgSaveResult.startsWith('Erreur') ? 'text-red-600' : 'text-green-700'}`}>
                  {orgSaveResult}
                </p>
              )}
            </div>

            {orgs.length > 1 && (
              <div>
                <label className="label">Changer d'organisation</label>
                <div className="relative">
                  <select
                    className="select pr-8 appearance-none"
                    value={org?.id}
                    onChange={e => switchOrg(e.target.value)}
                  >
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.name} ({o.role})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Membres de l'organisation</h2>
          </div>

          {/* Member list */}
          <div className="divide-y divide-gray-100">
            {members.length === 0 && (
              <p className="px-5 py-3 text-sm text-gray-400">
                Chargement… (assurez-vous d'avoir exécuté supabase_member_management.sql)
              </p>
            )}
            {members.map(m => (
              <div key={m.user_id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{m.role}</p>
                </div>
                {canManageMembers && m.role !== 'owner' && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    title="Retirer ce membre"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add member */}
          {canManageMembers && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Ajouter un membre</p>
              </div>
              <form onSubmit={inviteMember} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    type="email"
                    placeholder="email@exemple.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                  <select
                    className="select w-28 text-sm"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
                  >
                    <option value="member">Membre</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="submit" className="btn-primary text-sm" disabled={inviting}>
                    {inviting ? '…' : <Plus className="w-4 h-4" />}
                  </button>
                </div>
                {inviteResult && (
                  <p className={`text-xs ${inviteResult.ok ? 'text-green-700' : 'text-red-600'}`}>
                    {inviteResult.msg}
                  </p>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Mon compte</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">{userEmail ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Rôle</span>
              <span className="font-medium text-gray-900 capitalize">{org?.role ?? '—'}</span>
            </div>
          </div>
        </div>

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
              <span className="font-mono">3.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Base de données</span>
              <span className="text-green-600">Supabase PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span>Devise</span>
              <span>Franc Guinéen (FG)</span>
            </div>
            <div className="flex justify-between">
              <span>Mode</span>
              <span className="text-green-600">Multi-organisations</span>
            </div>
          </div>
        </div>
        {/* Danger Zone — owner only */}
        {org?.role === 'owner' && (
          <div className="card overflow-hidden border border-red-200">
            <div className="px-5 py-4 border-b border-red-100 flex items-center gap-2 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-semibold text-red-700">Zone dangereuse</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Supprime <strong>toutes les données</strong> de l'organisation (clients, paiements, factures, secteurs) et vous déconnecte. Cette action est <strong>irréversible</strong>.
              </p>
              <button
                onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(null) }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Supprimer toutes les données et se déconnecter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Supprimer toutes les données</h3>
                <p className="text-xs text-gray-500">Action irréversible</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Ceci supprimera définitivement tous les clients, paiements, factures et secteurs de <strong>{org?.name}</strong>. Impossible d'annuler.
            </p>

            <div className="mb-4">
              <label className="label">Tapez <span className="font-mono text-red-600">{org?.slug}</span> pour confirmer</label>
              <input
                className="input"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={org?.slug}
                autoFocus
              />
            </div>

            {deleteError && (
              <p className="text-xs text-red-600 mb-3">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary flex-1 justify-center"
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                onClick={deleteEverything}
                disabled={deleteConfirmText !== org?.slug || deleting}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Suppression…' : 'Tout supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
