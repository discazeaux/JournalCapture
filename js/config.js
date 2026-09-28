/*
 * ============================================================
 *  Configuration centrale — La ruche resiste
 *  ============================================================
 *  Fichier chargé en PREMIER sur toutes les pages (script classique,
 *  exécuté de façon synchrone avant les modules).
 *
 *  Il expose un unique objet global `window.CONFIG`.
 *  Toute constante d'environnement (URL/clé Supabase, méthodes de
 *  capture, codes météo…) doit vivre ici pour éviter la duplication
 *  entre les pages.
 * ============================================================
 */
(function (global) {
  'use strict';

  global.CONFIG = {
    // ---- Backend Supabase ----
    SUPABASE_URL: 'https://pvqfwozqfndlpfzypbza.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_PVbd_09mi39UIQ-9QGS3ug_ftskAI9t',

    // ---- Domaine métier ----
    // Méthodes de capture proposées dans le formulaire.
    METHODES: [
      { valeur: 'DPR', label: 'DPR' },
      { valeur: 'Piège', label: 'Piège' },
      { valeur: 'Raquette électrique', label: 'Raquette électrique' },
      { valeur: 'Harpe', label: 'Harpe' }
    ],

    ROLE_ADMIN: 'admin'
  };
})(window);