export function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: '#1B6C42' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">WastePilot</h1>
            <p className="text-xs text-gray-500">Politique de Confidentialité</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6 text-gray-700 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Politique de Confidentialité</h2>
            <p className="text-gray-500 text-xs">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">1. Données collectées</h3>
            <p>
              WastePilot collecte uniquement les informations nécessaires à la gestion de votre compte et de vos abonnés :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Adresse e-mail et nom de compte (via connexion Google ou inscription directe)</li>
              <li>Données de vos clients : noms, numéros de téléphone, adresses, secteurs, montants d'abonnements</li>
              <li>Historique de paiements et de collectes</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">2. Utilisation des données</h3>
            <p>Vos données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Vous permettre de gérer vos abonnés et leurs paiements</li>
              <li>Générer des factures et reçus PDF</li>
              <li>Afficher des statistiques de collecte et de revenus</li>
            </ul>
            <p className="mt-2">Nous ne vendons ni ne partageons vos données avec des tiers.</p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">3. Connexion Google</h3>
            <p>
              Si vous vous connectez via Google, WastePilot accède uniquement à votre adresse e-mail et votre nom de profil Google. Aucune autre information Google (contacts, calendrier, Drive, etc.) n'est accessible.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">4. Stockage et sécurité</h3>
            <p>
              Toutes les données sont stockées sur <strong>Supabase</strong> (infrastructure PostgreSQL sécurisée). Les connexions sont chiffrées via HTTPS. Chaque compte accède uniquement à ses propres données.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">5. Suppression des données</h3>
            <p>
              Vous pouvez demander la suppression de votre compte et de toutes vos données à tout moment en contactant le support.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-2">6. Contact</h3>
            <p>
              Pour toute question concernant cette politique, contactez-nous via l'application WastePilot.
            </p>
          </section>

          <div className="border-t border-gray-100 pt-4">
            <a href="/" className="text-sm font-medium" style={{ color: '#1B6C42' }}>
              ← Retour à WastePilot
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
