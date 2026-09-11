/*
 * ============================================================
 *  Consentement cookies - La ruche resiste
 *  ============================================================
 *  Mise en conformite RGPD (UE 2016/679), directive ePrivacy
 *  (2002/58/CE) et recommandation "cookies" de la CNIL.
 *
 *  Principe simple : Google Analytics n'est charge QUE si le
 *  visiteur a explicitement clique sur "Accepter" du bandeau.
 *  Aucun cookie de mesure d'audience n'est depose avant le
 *  consentement. Le choix est memorise (localStorage) et expire
 *  au bout de 6 mois (duree maximale recommandee par la CNIL),
 *  apres quoi le bandeau reapparait.
 *
 *  A charger sur toutes les pages apres js/config.js.
 *  Expose global.CookiesConsent :
 *    - getEtat()       -> 'accepted' | 'refused' | 'unknown'
 *    - modifierChoix() -> efface le choix et re-affiche le bandeau
 * ============================================================
 */
(function (global) {
  'use strict';

  var CONFIG = global.CONFIG || {};
  var GA_ID = CONFIG.GA_ID || 'G-6E1WMD3WXD';
  var STORAGE_KEY = CONFIG.CONSENT_STORAGE_KEY || 'cookies_consent';
  var DUREE_MOIS = CONFIG.CONSENT_DUREE_MOIS || 6;
  var DUREE_MS = DUREE_MOIS * 30 * 24 * 60 * 60 * 1000;

  function lire() {
    try {
      var brut = global.localStorage.getItem(STORAGE_KEY);
      return brut ? JSON.parse(brut) : null;
    } catch (e) {
      return null;
    }
  }

  function enregistrer(etat) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        etat: etat,
        date: new Date().toISOString()
      }));
    } catch (e) {
      /* localStorage indisponible : on ignore */
    }
  }

  function effacer() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function estExpire(consent) {
    if (!consent || !consent.date) return true;
    var t = Date.parse(consent.date);
    if (isNaN(t)) return true;
    return (Date.now() - t) > DUREE_MS;
  }

  function chargerAnalytics() {
    if (global.gtagCharged) return;
    global.gtagCharged = true;

    global.dataLayer = global.dataLayer || [];
    function gtag() { global.dataLayer.push(arguments); }
    global.gtag = gtag;
    gtag('js', new Date());

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    gtag('config', GA_ID);
  }

  function cacherBandeau() {
    var b = document.getElementById('cookie-banner');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function accepter() {
    enregistrer('accepted');
    cacherBandeau();
    chargerAnalytics();
  }

  function refuser() {
    enregistrer('refused');
    cacherBandeau();
  }

  function afficherBandeau() {
    if (document.getElementById('cookie-banner')) return;

    var b = document.createElement('div');
    b.className = 'cookie-banner';
    b.id = 'cookie-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Gestion des cookies');

    var texte = document.createElement('p');
    texte.className = 'cookie-banner-texte';
    var lien = document.createElement('a');
    lien.href = 'confidentialite.html';
    lien.textContent = 'En savoir plus';
    texte.appendChild(document.createTextNode(
      'Ce site utilise Google Analytics pour mesurer son audience (statistiques anonymes). ' +
      'En cliquant sur \u00ab Accepter \u00bb, vous consentez \u00e0 la d\u00e9pose de cookies de mesure. '
    ));
    texte.appendChild(lien);
    texte.appendChild(document.createTextNode('.'));
    b.appendChild(texte);

    var boutons = document.createElement('div');
    boutons.className = 'cookie-banner-buttons';

    var btAccept = document.createElement('button');
    btAccept.type = 'button';
    btAccept.className = 'consent-btn consent-accept';
    btAccept.id = 'cookie-accept';
    btAccept.textContent = 'Accepter';
    btAccept.addEventListener('click', accepter);

    var btRefuse = document.createElement('button');
    btRefuse.type = 'button';
    btRefuse.className = 'consent-btn consent-refuse';
    btRefuse.id = 'cookie-refuse';
    btRefuse.textContent = 'Refuser';
    btRefuse.addEventListener('click', refuser);

    boutons.appendChild(btAccept);
    boutons.appendChild(btRefuse);
    b.appendChild(boutons);

    document.body.appendChild(b);
  }

  function init() {
    var consent = lire();
    if (consent && consent.etat === 'accepted' && !estExpire(consent)) {
      chargerAnalytics();
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', afficherBandeau);
    } else {
      afficherBandeau();
    }
  }

  global.CookiesConsent = {
    getEtat: function () {
      var c = lire();
      if (!c) return 'unknown';
      if (estExpire(c)) return 'unknown';
      return c.etat;
    },
    modifierChoix: function () {
      effacer();
      afficherBandeau();
    }
  };

  init();
})(window);
