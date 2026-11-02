/*
 * ============================================================
 *  Navigation commune — JournalCapture
 *  Génère le bandeau commun de navigation du site.
 *
 *  Usage :
 *    <script src="navigation.js"></script>
 *    <script>
 *      initNavigation({
 *        univers: 'frelon' | 'blog' | 'rucher',
 *        sectionActive: section courante
 *      });
 *    </script>
 *
 *  Le bandeau indique l'univers courant avec une pastille miel pleine.
 * ============================================================
 */

(function (global) {
  'use strict';

  const LIENS_PRINCIPAUX = [
    { id: 'pressure', label: 'Pression du frelon', href: 'stat.html' },
    { id: 'rucher', label: 'Suivi du rucher', href: 'suiviRucher.html' },
    { id: 'blog', label: 'Blog', href: 'blog.html' }
  ];

  const SOUS_MENUS = {
    pressure: [
      { label: 'Stat communauté', href: 'stat.html', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></svg>' },
      { label: 'Mes stats', href: 'stat.html?onglet=mesStats', authRequired: true, icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></svg>' },
      { label: 'Nouvelle capture', href: 'nouvelleCapture.html', authRequired: true, icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' },
      { label: 'Réglages', href: 'settings.html', authRequired: true, icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/></svg>' }
    ],
    rucher: [
      { label: 'Ruchers', href: 'suiviRucher.html', authRequired: true, icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>' },
      { label: 'Miellerie', href: 'suiviMiellerie.html', authRequired: true, icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5S6.5 10 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 10 12 3.5 12 3.5Z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/></svg>' },
      { label: 'Réglages', href: 'reglageRucher.html', authRequired: true, icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/></svg>' }
    ]
  };

  const SECTIONS_ACTIVES = {
    stat: 'pressure',
    nouvelleCapture: 'pressure',
    settings: 'pressure',
    profil: 'pressure',
    blog: 'blog',
    article: 'blog',
    rediger: 'blog',
    suiviRucher: 'rucher',
    suiviMiellerie: 'rucher',
    reglageRucher: 'rucher',
    registreElevage: 'rucher'
  };

  const ROUTES_ACTIVES = {
    'stat.html': 'pressure',
    'nouvelleCapture.html': 'pressure',
    'settings.html': 'pressure',
    'profil.html': 'pressure',
    'login.html': 'pressure',
    'reset-password.html': 'pressure',
    'suiviRucher.html': 'rucher',
    'suiviMiellerie.html': 'rucher',
    'reglageRucher.html': 'rucher',
    'registreElevage.html': 'rucher',
    'blog.html': 'blog',
    'article.html': 'blog',
    'rediger.html': 'blog'
  };

  const PAGES_SANS_RUBRIQUE_ACTIVE = new Set([
    'index.html',
    'login.html',
    'reset-password.html',
    'confidentialite.html',
    'mentions-legales.html'
  ]);

  const PAGES_SANS_SOUS_MENU = new Set([
    'login.html',
    'reset-password.html'
  ]);

  // Vérifie si l'utilisateur est connecté via Supabase et son rôle
  async function verifierSession() {
    try {
      let supabase = window.supabase;

      if (!supabase) {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        supabase = createClient(
          window.CONFIG.SUPABASE_URL,
          window.CONFIG.SUPABASE_ANON_KEY
        );
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { estConnecte: false, estAdmin: false };

      let estAdmin = false;
      try {
        const { data: profil } = await supabase
          .from("profils")
          .select("role")
          .eq("id", session.user.id)
          .single();
        estAdmin = profil?.role === window.CONFIG.ROLE_ADMIN;
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
    document.documentElement.dataset.sharedNavigation = 'true';

    const config = Object.assign({
      univers: 'frelon',
      sectionActive: ''
    }, options || {});

    // Vérifier l'état de connexion et le rôle admin
    const { estConnecte } = await verifierSession();
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const currentUrl = new URL(window.location.href);
    const sectionParUnivers = { frelon: 'pressure', blog: 'blog', rucher: 'rucher' };
    const sectionCourante = PAGES_SANS_RUBRIQUE_ACTIVE.has(page)
      ? ''
      : SECTIONS_ACTIVES[config.sectionActive]
        || ROUTES_ACTIVES[page]
        || sectionParUnivers[config.univers]
        || '';

    // Construction de la navigation
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    if (estConnecte) nav.classList.add('site-nav--connected');
    nav.setAttribute('aria-label', 'Navigation principale');
    const liens = LIENS_PRINCIPAUX.map((lien) => {
      const active = sectionCourante === lien.id;
      const pageExacte = page === lien.href;
      const ariaCourante = active ? ` aria-current="${pageExacte ? 'page' : 'location'}"` : '';
      return `<a class="site-nav-link${active ? ' active' : ''}" href="${lien.href}"${ariaCourante}>${lien.label}</a>`;
    }).join('');
    const liensSousMenu = (PAGES_SANS_SOUS_MENU.has(page) ? [] : SOUS_MENUS[sectionCourante] || [])
      .filter((lien) => estConnecte || !lien.authRequired);
    const sousMenu = liensSousMenu.length
      ? `<nav class="site-nav-subnav site-nav-subnav--${sectionCourante}" aria-label="Navigation ${sectionCourante === 'pressure' ? 'pression du frelon' : 'du rucher'}">${liensSousMenu.map((lien) => {
        const [href, query] = lien.href.split('?');
        const queryParams = new URLSearchParams(query || '');
        const tabDemande = queryParams.get('onglet');
        const active = page === href
          && (tabDemande ? currentUrl.searchParams.get('onglet') === tabDemande : !currentUrl.searchParams.has('onglet'));
        const ariaCourante = active ? ' aria-current="page"' : '';
        return `<a class="site-nav-sublink${active ? ' active' : ''}" href="${lien.href}"${ariaCourante}>${lien.icon}${lien.label}</a>`;
      }).join('')}</nav>`
      : '';

    nav.innerHTML = `
      <div class="site-nav-inner">
        <a class="site-nav-brand" href="index.html">
          <img src="img/ruche4.png" alt="">
          <span>La ruche résiste</span>
        </a>
        <div class="site-nav-links">${liens}</div>
        <div class="site-nav-actions">
          ${estConnecte ? '' : '<a class="site-nav-login" id="lienConnexion" href="login.html">Se connecter</a>'}
        </div>
      </div>
      ${sousMenu ? `<div class="site-nav-divider site-nav-divider--${sectionCourante}" aria-hidden="true"></div>` : ''}
      ${sousMenu}
    `;

    document.body.insertBefore(nav, document.body.firstChild);
    const userBar = document.getElementById('userBar');
    if (userBar) {
      nav.querySelector('.site-nav-actions').appendChild(userBar);
      if (!estConnecte) userBar.style.display = 'none';
    }

    // Retourner la ref de la nav (utile pour d'éventuels ajustements)
    return nav;
  };
})(window);