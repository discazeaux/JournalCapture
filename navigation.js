/*
 * ============================================================
 *  Navigation commune — JournalCapture
 *  Génère la barre de navigation (univers frelon + univers blog)
 *  Utilisée par toutes les pages du site.
 *
 *  Usage :
 *    <script src="navigation.js"></script>
 *    <script>
 *      initNavigation({
 *        univers: 'frelon' | 'blog',
 *        : 'accueil' | 'nouvelleCapture' | 'stat' | 'settings' | 'blog' | 'article'
 *      });
 *    </script>
 *
 *  Remarque : la user-bar (connexion / pseudo) reste en position
 *  fixe en haut à droite, comme avant — elle n'est pas déplacée
 *  dans la navigation.
 *
 *  Sécurité : les sections "Nouvelle capture" et "Paramètres"
 *  (univers frelon) ne sont affichées que si l'utilisateur est
 *  connecté. "Statistiques" reste accessible sans connexion.
 * ============================================================
 */

(function (global) {
  'use strict';

  // Sections par univers
  const SECTIONS = {
    frelon: [
      { id: 'nouvelleCapture', label: '📋 Nouvelle capture', href: 'nouvelleCapture.html' },
      { id: 'stat', label: '📊 Statistiques', href: 'stat.html' },
      { id: 'settings', label: '⚙️ Paramètres', href: 'settings.html' }
    ],
    blog: [
      { id: 'blog', label: '📖 Le blog', href: 'blog.html' }
    ]
  };

  // Libellés des univers
  const UNIVERS_LABELS = {
    frelon: { label: 'Suivi de la pression du frelon', emoji: '<img class="universe-img" src="ruche3.png" alt="Frelon" aria-label="Frelon">', href: 'index.html' },
    blog: { label: 'La ruche résiste', emoji: '<img class="universe-img" src="ruche3.png" alt="Frelon" aria-label="Frelon">', href: 'index.html' }
  };

  // Vérifie si l'utilisateur est connecté via Supabase et son rôle
  async function verifierSession() {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        "https://pvqfwozqfndlpfzypbza.supabase.co",
        "sb_publishable_PVbd_09mi39UIQ-9QGS3ug_ftskAI9t"
      );
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { estConnecte: false, estAdmin: false };

      // Vérifier le rôle admin
      let estAdmin = false;
      try {
        const { data: profil } = await supabase
          .from("profils")
          .select("role")
          .eq("id", session.user.id)
          .single();
        estAdmin = profil?.role === 'admin';
      } catch (e) {
        estAdmin = false;
      }

      return { estConnecte: true, estAdmin };
    } catch (e) {
      console.error("Erreur vérification session:", e);
      return { estConnecte: false, estAdmin: false };
    }
  }

  global.initNavigation = async function (options) {
    const config = Object.assign({
      univers: 'frelon',
      sectionActive: ''
    }, options || {});

    const meta = UNIVERS_LABELS[config.univers] || UNIVERS_LABELS.frelon;

    // Vérifier l'état de connexion et le rôle admin
    const { estConnecte, estAdmin } = await verifierSession();

    // Sections protégées (univers frelon) : uniquement visibles si connecté.
    // "Statistiques" reste accessible sans connexion (stats communauté publiques).
    const sectionsProtegees = ['nouvelleCapture', 'settings'];
    const sections = (SECTIONS[config.univers] || []).filter(s => {
      if (config.univers === 'frelon' && !estConnecte && sectionsProtegees.includes(s.id)) {
        return false; // masquer les sections protégées si non connecté
      }
      return true;
    });

    // Lien "Rédiger un article" visible uniquement pour les administrateurs,
    // et uniquement dans l'univers blog (pas dans l'univers frelon).
    const lienRediger = (estAdmin && config.univers === 'blog')
      ? `<a href="rediger.html" class="${config.sectionActive === 'rediger' ? 'active' : ''}">✏️ Rédiger un article</a>`
      : '';

    // Construction de la navigation
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.innerHTML = `
      <div class="site-nav-inner">
        <div class="site-nav-top">
          <a class="site-nav-brand" href="index.html">
            <span class="site-nav-brand-emoji">${meta.emoji}</span>
            ${meta.label}
          </a>

          <div class="site-nav-univers">
            <a class="site-nav-tab ${config.univers === 'frelon' ? 'active' : ''}" href="stat.html"><img class="universe-img" src="mordre3.png" alt="Frelon" aria-label="Frelon"> Frelons</a>
            <a class="site-nav-tab ${config.univers === 'blog' ? 'active' : ''}" href="blog.html">📖 Blog</a>
          </div>
        </div>

        <div class="site-nav-sections">
          
          ${sections.map(s =>
            `<a href="${s.href}" class="${config.sectionActive === s.id ? 'active' : ''}">${s.label}</a>`
          ).join('')}
          ${lienRediger}
        </div>
      </div>
    `;

    document.body.insertBefore(nav, document.body.firstChild);

    // Retourner la ref de la nav (utile pour d'éventuels ajustements)
    return nav;
  };
})(window);