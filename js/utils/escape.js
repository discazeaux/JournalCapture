/*
 * ============================================================
 *  Utilitaires d'échappement HTML — JournalCapture
 *  ============================================================
 *  `escapeHtml` protège le rendu `innerHTML` contre les
 *  injections XSS : tout contenu fourni par l'utilisateur
 *  (pseudo, titre, commentaire, lieu, nom d'appât…) doit passer
 *  par cette fonction avant d'être injecté dans un gabarit HTML.
 *
 *  Usage :
 *    import { escapeHtml } from '../utils/escape.js';
 *    bar.innerHTML = `<span class="pseudo">${escapeHtml(pseudo)}</span>`;
 * ============================================================
 */

// Échappe les caractères HTML réservés pour une insertion sûre
// dans `innerHTML` (évite les injections côté rendu).
export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}