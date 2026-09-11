/*
 * ============================================================
 *  Authentification & barre utilisateur — JournalCapture
 *  ============================================================
 *  Factorise la gestion de la session et de la barre utilisateur
 *  (pseudo + bouton déconnexion / bouton connexion) qui était
 *  dupliquée sur toutes les pages.
 *
 *  API publique (modules) :
 *    initUserBar({ elementId, montrerConnexion }) -> Promise<{ session, profil }>
 *    chargerProfil()                                -> Promise<{ session, profil }>
 *    getPseudo(session, profil)                     -> string
 * ============================================================
 */
import { supabase } from './supabase.js';
import { escapeHtml } from './utils/escape.js';

export { escapeHtml };

// Charge la session courante et le profil (pseudo + rôle) si connecté.
export async function chargerProfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, profil: null };

  const { data: profil } = await supabase
    .from('profils')
    .select('pseudo, role, codePostal')
    .eq('id', session.user.id)
    .single();

  return { session, profil };
}

// Pseudo préféré (celui du profil, sinon l'email du compte).
export function getPseudo(session, profil) {
  return profil?.pseudo || session?.user?.email || '—';
}

// Déconnexion puis redirection, centralisée.
async function deconnecter() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// Rendu de la barre quand l'utilisateur est connecté.
function afficherDeconnexion(bar, pseudo) {
  bar.innerHTML = `
    <span class="bee-small">🐝</span>
    <span class="pseudo">${escapeHtml(pseudo)}</span>
    <button id="btnUserDeco">Se déconnecter</button>
  `;
  bar.style.display = '';
  document.getElementById('btnUserDeco').addEventListener('click', deconnecter);
}

// Rendu de la barre quand l'utilisateur n'est pas connecté.
function afficherConnexion(bar) {
  bar.innerHTML = `<button id="btnUserConnexion">Se connecter</button>`;
  bar.style.display = '';
  document.getElementById('btnUserConnexion').addEventListener('click', () => {
    window.location.href = 'login.html';
  });
}

/*
 * Initialise la barre utilisateur.
 *   elementId         : id de l'élément hôte (par défaut "userBar").
 *   montrerConnexion  : false si la barre doit rester vide/masquée
 *                       quand l'utilisateur n'est pas connecté
 *                       (ex : page d'accueil "hub").
 * Renvoie toujours { session, profil } pour que les pages puissent
 * gérer leur logique spécifique (liens protégés, rôle admin…).
 */
export async function initUserBar({ elementId = 'userBar', montrerConnexion = true } = {}) {
  const bar = document.getElementById(elementId);
  const { session, profil } = await chargerProfil();

  if (!bar) return { session, profil };

  if (session) {
    afficherDeconnexion(bar, getPseudo(session, profil));
  } else if (montrerConnexion) {
    afficherConnexion(bar);
  }

  return { session, profil };
}

export default supabase;