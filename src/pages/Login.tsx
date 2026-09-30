import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Tab = 'login' | 'signup'

export function Login() {
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupDone, setSignupDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (tab === 'signup') {
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères')
        return
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas')
        return
      }
      setLoading(true)
      const { error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message === 'User already registered' ? 'Cet email est déjà utilisé' : error.message)
      } else {
        setSignupDone(true)
      }
    } else {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message)
      }
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError(null)
    const redirectTo = `${window.location.protocol}//${window.location.host}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      setError(`Google: ${error.message}`)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-sage)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-brand)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </div>
          <h1 className="page-title mb-1">WastePilot</h1>
          <p className="text-sm text-gray-500">Gestion des abonnements collecte</p>
        </div>

        <div className="card p-6">
          {signupDone ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Compte créé !</p>
                <p className="text-sm text-gray-500 mt-1">Vérifiez votre email <strong>{email}</strong> pour confirmer votre compte.</p>
              </div>
              <button className="btn-secondary w-full justify-center" onClick={() => { setTab('login'); setSignupDone(false); setPassword(''); setConfirmPassword('') }}>
                Retour à la connexion
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
                <button
                  type="button"
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${tab === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                  onClick={() => { setTab('login'); setError(null) }}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${tab === 'signup' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                  onClick={() => { setTab('signup'); setError(null) }}
                >
                  Inscription
                </button>
              </div>

              {/* Google button */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700 mb-4 disabled:opacity-50"
              >
                {googleLoading ? (
                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#4285F4' }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#4285F4" d="M47.53 24.56c0-1.56-.14-3.06-.4-4.5H24v8.51h13.21c-.57 3.06-2.3 5.66-4.9 7.4v6.15h7.93c4.64-4.28 7.3-10.59 7.3-17.56z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.15 15.9-5.82l-7.93-6.15c-2.17 1.46-4.95 2.32-7.97 2.32-6.13 0-11.32-4.14-13.18-9.7H2.58v6.35C6.54 42.65 14.72 48 24 48z"/>
                    <path fill="#FBBC05" d="M10.82 28.65A14.84 14.84 0 0 1 10 24c0-1.62.28-3.2.82-4.65v-6.35H2.58A24.01 24.01 0 0 0 0 24c0 3.87.93 7.52 2.58 10.97l8.24-6.32z"/>
                    <path fill="#EA4335" d="M24 9.5c3.45 0 6.55 1.19 8.99 3.51l6.74-6.74C35.9 2.38 30.45 0 24 0 14.72 0 6.54 5.35 2.58 13.03l8.24 6.32C12.68 13.64 17.87 9.5 24 9.5z"/>
                  </svg>
                )}
                {tab === 'login' ? 'Continuer avec Google' : "S'inscrire avec Google"}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ou par email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Adresse e-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    placeholder="vous@exemple.com"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                {tab === 'signup' && (
                  <div>
                    <label className="label">Confirmer le mot de passe</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary w-full justify-center py-2.5"
                  disabled={loading}
                >
                  {loading
                    ? (tab === 'login' ? 'Connexion...' : 'Création...')
                    : (tab === 'login' ? 'Se connecter' : 'Créer mon compte')}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Conakry · Guinée · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
