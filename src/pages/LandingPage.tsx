import { useState, useEffect, useRef } from 'react'
import { Login } from './Login'

const BRAND = '#1B6C42'
const BRAND_LIGHT = '#e6f4ec'

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, running: boolean, duration = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(ease * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [running, target, duration])
  return value
}

// ── CSS injected once ─────────────────────────────────────────────────────────
const CSS = `
@keyframes wp-fadein { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
@keyframes wp-scaleup { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }
@keyframes wp-float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-10px) } }
@keyframes wp-pulse-ring { 0% { box-shadow:0 0 0 0 #1B6C4260 } 70% { box-shadow:0 0 0 14px transparent } 100% { box-shadow:0 0 0 0 transparent } }
@keyframes wp-shimmer { 0% { background-position:200% center } 100% { background-position:-200% center } }
@keyframes wp-spin-slow { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
.wp-reveal { opacity:0; transform:translateY(32px); transition:opacity .65s ease, transform .65s ease; }
.wp-reveal.visible { opacity:1; transform:translateY(0); }
.wp-reveal-left { opacity:0; transform:translateX(-32px); transition:opacity .65s ease, transform .65s ease; }
.wp-reveal-left.visible { opacity:1; transform:translateX(0); }
.wp-card:hover { transform:translateY(-4px); box-shadow:0 20px 48px rgba(27,108,66,.12); }
.wp-btn-primary:hover { transform:translateY(-2px); box-shadow:0 12px 32px #1B6C4250 !important; }
.wp-btn-white:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(0,0,0,.15) !important; }
`

// ── Icons ─────────────────────────────────────────────────────────────────────
const TrashIcon = ({ size = 24, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
)

const features = [
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    title: 'Gestion des abonnés',
    desc: 'Centralisez tous vos clients, leurs secteurs, numéros et historiques de paiement dans un tableau de bord unique.',
    delay: 0,
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    title: 'Facturation en 1 clic',
    desc: 'Générez toutes les charges mensuelles automatiquement, téléchargez des factures PDF professionnelles.',
    delay: 100,
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    title: 'Suivi des paiements',
    desc: 'Visualisez en temps réel les encaissements, identifiez les impayés et relancez automatiquement par WhatsApp.',
    delay: 200,
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    title: 'Rapports & exports',
    desc: 'Tableaux de bord visuels, statistiques par secteur, exports CSV — toutes vos données toujours disponibles.',
    delay: 300,
  },
]

const steps = [
  { num: '01', title: 'Importez vos clients', desc: 'Chargez votre fichier Excel ou ajoutez des abonnés manuellement.' },
  { num: '02', title: 'Générez la facturation', desc: 'Un clic pour créer toutes les charges mensuelles de vos abonnés actifs.' },
  { num: '03', title: 'Encaissez & tracez', desc: 'Enregistrez les paiements, émettez reçus PDF, suivez les soldes.' },
  { num: '04', title: 'Pilotez & grandissez', desc: 'Analysez vos performances par secteur et optimisez votre collecte.' },
]

const statsData = [
  { label: 'Abonnés gérés', value: 264, suffix: '+' },
  { label: 'Charges traitées', value: 752, suffix: '' },
  { label: 'Secteurs couverts', value: 3, suffix: '' },
  { label: 'Papier requis', value: 0, suffix: '' },
]

// ── Stat counter component ────────────────────────────────────────────────────
function StatCounter({ label, value, suffix, running }: { label: string; value: number; suffix: string; running: boolean }) {
  const count = useCountUp(value, running)
  return (
    <div className="text-center text-white">
      <div className="text-4xl font-black mb-1 tabular-nums">{count}{suffix}</div>
      <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [heroReady, setHeroReady] = useState(false)

  const statsReveal = useReveal(0.3)
  const featuresReveal = useReveal(0.1)
  const stepsReveal = useReveal(0.1)
  const waReveal = useReveal(0.2)
  const ctaReveal = useReveal(0.2)

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 80)
    return () => clearTimeout(t)
  }, [])

  if (showLogin) return <Login />

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{CSS}</style>

      {/* ── Nav ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        transition: 'all .3s ease',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'wp-pulse-ring 2.5s infinite' }}>
              <TrashIcon size={20} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>WastePilot</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="#features" style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', textDecoration: 'none' }} className="hidden sm:block">Fonctionnalités</a>
            <button
              onClick={() => setShowLogin(true)}
              className="wp-btn-primary"
              style={{ padding: '9px 22px', borderRadius: 12, background: BRAND, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', transition: 'all .25s ease' }}
            >
              Se connecter →
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        paddingTop: 140, paddingBottom: 100, paddingLeft: 24, paddingRight: 24,
        textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #f0fdf4 0%, #e8f5ed 40%, #ffffff 100%)',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -80, left: -80, width: 400, height: 400, borderRadius: '50%', background: BRAND, opacity: 0.06, animation: 'wp-spin-slow 20s linear infinite' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: BRAND, opacity: 0.04 }} />
        <div style={{ position: 'absolute', top: '30%', right: '8%', width: 120, height: 120, borderRadius: '50%', background: '#25D366', opacity: 0.07, animation: 'wp-float 4s ease-in-out infinite' }} />

        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 999, marginBottom: 28,
            background: BRAND_LIGHT, color: BRAND, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
            opacity: heroReady ? 1 : 0, transform: heroReady ? 'none' : 'translateY(12px)',
            transition: 'all .6s ease',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: BRAND, animation: 'wp-pulse-ring 2s infinite' }} />
            Conakry, Guinée · Gestion 100 % numérique
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 900, lineHeight: 1.12,
            letterSpacing: '-1.5px', marginBottom: 22, color: '#0f172a',
            opacity: heroReady ? 1 : 0, transform: heroReady ? 'none' : 'translateY(20px)',
            transition: 'all .65s ease .1s',
          }}>
            Gérez votre collecte<br />
            <span style={{
              background: `linear-gradient(135deg, ${BRAND}, #2d9d60, #1B6C42)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              sans effort
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 18, color: '#64748b', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 36px',
            opacity: heroReady ? 1 : 0, transform: heroReady ? 'none' : 'translateY(16px)',
            transition: 'all .65s ease .2s',
          }}>
            La plateforme tout-en-un pour les entreprises de collecte de déchets.
            Abonnements, facturation, paiements et rappels WhatsApp — tout automatisé.
          </p>

          {/* CTAs */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
            opacity: heroReady ? 1 : 0, transform: heroReady ? 'none' : 'translateY(12px)',
            transition: 'all .65s ease .35s',
          }}>
            <button onClick={() => setShowLogin(true)} className="wp-btn-primary" style={{
              padding: '14px 32px', borderRadius: 16, background: BRAND, color: 'white',
              fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
              boxShadow: `0 8px 28px ${BRAND}45`, transition: 'all .25s ease',
            }}>
              Démarrer maintenant →
            </button>
            <a href="#features" style={{
              padding: '14px 32px', borderRadius: 16, border: '2px solid #e2e8f0',
              color: '#374151', fontWeight: 600, fontSize: 15, textDecoration: 'none',
              background: 'white', display: 'inline-block', transition: 'all .25s ease',
            }}>
              Voir les fonctionnalités
            </a>
          </div>
        </div>

        {/* Dashboard preview */}
        <div style={{
          maxWidth: 900, margin: '60px auto 0', borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden', background: 'white',
          opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(32px) scale(.97)',
          transition: 'all .8s ease .45s',
        }}>
          {/* Browser bar */}
          <div style={{ height: 44, background: '#1e293b', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6 }}>
            {['#ff5f57','#ffbd2e','#28c840'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
            <div style={{ flex: 1, marginLeft: 12, height: 26, borderRadius: 6, background: '#334155', display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>wastepilot-chi.vercel.app</span>
            </div>
          </div>
          {/* App preview */}
          <div style={{ display: 'flex', minHeight: 240 }}>
            {/* Sidebar */}
            <div style={{ width: 160, background: '#f0fdf4', padding: '12px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrashIcon size={14} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>WastePilot</span>
              </div>
              {['Tableau de bord','Clients','Facturation','Paiements','Rapports'].map((label, i) => (
                <div key={label} style={{
                  padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: i === 0 ? 700 : 500,
                  background: i === 0 ? BRAND : 'transparent', color: i === 0 ? 'white' : '#64748b',
                }}>
                  {label}
                </div>
              ))}
            </div>
            {/* Main area */}
            <div style={{ flex: 1, padding: '16px 14px', background: '#f8fafc' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Tableau de bord · juin 2026</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                {[['264','Clients actifs','#0f172a'],['8 975 000 FG','Attendu','#0f172a'],['20 000 FG','Encaissé','#16a34a'],['8 955 000 FG','Solde','#dc2626']].map(([v, l, col]) => (
                  <div key={l} style={{ background: 'white', borderRadius: 10, padding: '10px 10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: col }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Mini chart */}
              <div style={{ background: 'white', borderRadius: 10, padding: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {[30, 55, 40, 80, 60, 75, 45].map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: '4px 4px 0 0', transition: 'height .3s', height: `${h}%`, background: i === 3 ? BRAND : '#bbf7d0' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section ref={statsReveal.ref} style={{ background: BRAND, padding: '40px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '32px 16px' }}
          className="sm:grid-cols-4">
          {statsData.map((s, i) => (
            <div key={s.label} style={{
              opacity: statsReveal.visible ? 1 : 0, transform: statsReveal.visible ? 'none' : 'translateY(20px)',
              transition: `all .5s ease ${i * 120}ms`,
            }}>
              <StatCounter label={s.label} value={s.value} suffix={s.suffix} running={statsReveal.visible} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '96px 24px', background: '#fafffe' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div ref={featuresReveal.ref} style={{
            textAlign: 'center', marginBottom: 56,
            opacity: featuresReveal.visible ? 1 : 0, transform: featuresReveal.visible ? 'none' : 'translateY(24px)',
            transition: 'all .6s ease',
          }}>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: BRAND, textTransform: 'uppercase', marginBottom: 12 }}>Fonctionnalités</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.8px', marginBottom: 16 }}>Tout ce qu'il vous faut</h2>
            <p style={{ color: '#64748b', fontSize: 17, maxWidth: 500, margin: '0 auto' }}>Une solution complète pour piloter votre activité de collecte de déchets.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
            {features.map((f) => (
              <div key={f.title} className="wp-card" style={{
                padding: '28px 24px', borderRadius: 20, background: 'white',
                border: '1px solid #e8f4ed', cursor: 'default',
                transition: 'transform .3s ease, box-shadow .3s ease',
                opacity: featuresReveal.visible ? 1 : 0, transform: featuresReveal.visible ? 'translateY(0)' : 'translateY(32px)',
                transitionDelay: `${f.delay}ms`,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: BRAND_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, transition: 'transform .3s ease' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div ref={stepsReveal.ref} style={{
            textAlign: 'center', marginBottom: 56,
            opacity: stepsReveal.visible ? 1 : 0, transform: stepsReveal.visible ? 'none' : 'translateY(24px)',
            transition: 'all .6s ease',
          }}>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: BRAND, textTransform: 'uppercase', marginBottom: 12 }}>Comment ça marche</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.8px' }}>Opérationnel en minutes</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32 }}>
            {steps.map((s, i) => (
              <div key={s.num} style={{
                opacity: stepsReveal.visible ? 1 : 0,
                transform: stepsReveal.visible ? 'none' : 'translateY(28px)',
                transition: `all .55s ease ${i * 120}ms`,
                position: 'relative',
              }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: '#bbf7d0', marginBottom: 12, lineHeight: 1 }}>{s.num}</div>
                <h3 style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WhatsApp highlight ── */}
      <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg, #f0fdf4 0%, #e8f5ed 100%)' }}>
        <div ref={waReveal.ref} style={{
          maxWidth: 700, margin: '0 auto', textAlign: 'center',
          opacity: waReveal.visible ? 1 : 0, transform: waReveal.visible ? 'scale(1)' : 'scale(.95)',
          transition: 'all .6s ease',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22, background: '#25D366', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
            animation: 'wp-float 3s ease-in-out infinite',
            boxShadow: '0 12px 36px #25D36640',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.4rem)', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.6px', marginBottom: 16 }}>
            Relances WhatsApp intégrées
          </h2>
          <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.7, marginBottom: 32, maxWidth: 520, margin: '0 auto 32px' }}>
            Envoyez des rappels personnalisés aux clients impayés, partagez factures et reçus en un clic — directement depuis l'application.
          </p>
          <button onClick={() => setShowLogin(true)} className="wp-btn-white" style={{
            padding: '13px 32px', borderRadius: 14, background: '#25D366', color: 'white',
            fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 28px #25D36645', transition: 'all .25s ease',
          }}>
            Essayer gratuitement
          </button>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '96px 24px', background: BRAND, textAlign: 'center' }}>
        <div ref={ctaReveal.ref} style={{
          maxWidth: 620, margin: '0 auto',
          opacity: ctaReveal.visible ? 1 : 0, transform: ctaReveal.visible ? 'none' : 'translateY(24px)',
          transition: 'all .6s ease',
        }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: 'white', letterSpacing: '-1px', marginBottom: 18, lineHeight: 1.2 }}>
            Prêt à digitaliser<br />votre collecte ?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginBottom: 40, lineHeight: 1.7 }}>
            Rejoignez les entreprises qui font confiance à WastePilot pour gérer leurs abonnés et leurs paiements.
          </p>
          <button onClick={() => setShowLogin(true)} className="wp-btn-white" style={{
            padding: '15px 36px', borderRadius: 16, background: 'white',
            color: BRAND, fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer',
            boxShadow: '0 12px 36px rgba(0,0,0,0.25)', transition: 'all .25s ease',
          }}>
            Créer mon compte gratuitement →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '36px 24px', background: '#0f172a', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrashIcon size={17} />
          </div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>WastePilot</span>
        </div>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 6 }}>Gestion professionnelle des collectes de déchets · Conakry, Guinée</p>
        <p style={{ color: '#334155', fontSize: 12 }}>© {new Date().getFullYear()} WastePilot · Tous droits réservés</p>
      </footer>
    </div>
  )
}
