import { supabase } from '../supabase.js';
import { APP_PATHS, DOM_IDS, ROLES, UI_MESSAGES } from '../constants.js';

function afficherMessage(texte, type) {
  const el = document.getElementById(DOM_IDS.LOGIN.MESSAGE);
  if (!el) return;
  el.textContent = texte;
  el.className = 'message ' + type;
}

export function afficherOnglet(onglet) {
  const formConnexion = document.getElementById(DOM_IDS.LOGIN.FORM_CONNEXION);
  const formInscription = document.getElementById(DOM_IDS.LOGIN.FORM_INSCRIPTION);
  const tabConnexion = document.getElementById(DOM_IDS.LOGIN.TAB_CONNEXION);
  const tabInscription = document.getElementById(DOM_IDS.LOGIN.TAB_INSCRIPTION);
  const message = document.getElementById(DOM_IDS.LOGIN.MESSAGE);

  if (!formConnexion || !formInscription || !tabConnexion || !tabInscription) return;

  formConnexion.style.display = onglet === 'connexion' ? 'block' : 'none';
  formInscription.style.display = onglet === 'inscription' ? 'block' : 'none';
  tabConnexion.classList.toggle('active', onglet === 'connexion');
  tabInscription.classList.toggle('active', onglet === 'inscription');
  if (message) message.className = 'message';
}

export async function envoyerResetPassword(e) {
  if (e) e.preventDefault();
  const email = document.getElementById(DOM_IDS.LOGIN.LOGIN_EMAIL)?.value.trim();

  if (!email) {
    afficherMessage(UI_MESSAGES.auth.emailRequired, 'error');
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    afficherMessage(`${UI_MESSAGES.auth.connectionErrorPrefix}${error.message}`, 'error');
  } else {
    afficherMessage(`${UI_MESSAGES.auth.resetSent} ${email}. ${UI_MESSAGES.auth.resetSentSuffix}`, 'success');
  }
}

export async function seConnecter() {
  const email = document.getElementById(DOM_IDS.LOGIN.LOGIN_EMAIL)?.value.trim();
  const password = document.getElementById(DOM_IDS.LOGIN.LOGIN_PASSWORD)?.value;
  const btn = document.getElementById(DOM_IDS.LOGIN.BTN_CONNEXION);

  if (!email || !password) {
    afficherMessage(UI_MESSAGES.auth.emailPasswordRequired, 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Connexion…';
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    afficherMessage(UI_MESSAGES.auth.invalidCredentials, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  } else {
    afficherMessage(UI_MESSAGES.auth.connectionSuccess, 'success');
    setTimeout(() => {
      window.location.href = APP_PATHS.HOME;
    }, 1000);
  }
}

export async function sInscrire() {
  const pseudo = document.getElementById(DOM_IDS.LOGIN.INSCRIPTION_PSEUDO)?.value.trim();
  const codePostal = document.getElementById(DOM_IDS.LOGIN.INSCRIPTION_CODE_POSTAL)?.value.trim();
  const email = document.getElementById(DOM_IDS.LOGIN.INSCRIPTION_EMAIL)?.value.trim();
  const password = document.getElementById(DOM_IDS.LOGIN.INSCRIPTION_PASSWORD)?.value;
  const btn = document.getElementById(DOM_IDS.LOGIN.BTN_INSCRIPTION);

  if (!pseudo || !email || !password) {
    afficherMessage(UI_MESSAGES.auth.emailPasswordRequired, 'error');
    return;
  }

  if (password.length < 6) {
    afficherMessage(UI_MESSAGES.auth.passwordTooShort, 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Création…';
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    afficherMessage(error.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
    }
    return;
  }

  const { error: errorProfil } = await supabase
    .from('profils')
    .insert({ id: data.user.id, pseudo, codePostal, role: ROLES.USER });

  if (errorProfil) {
    afficherMessage(`${UI_MESSAGES.auth.accountPseudoError} ${errorProfil.message}`, 'error');
  } else {
    afficherMessage(UI_MESSAGES.auth.accountCreated, 'success');
    setTimeout(() => afficherOnglet('connexion'), 2000);
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  }
}

export async function initLoginPage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('onglet') === 'inscription') {
    afficherOnglet('inscription');
  } else {
    afficherOnglet('connexion');
  }

  document.getElementById(DOM_IDS.LOGIN.TAB_CONNEXION)?.addEventListener('click', () => afficherOnglet('connexion'));
  document.getElementById(DOM_IDS.LOGIN.TAB_INSCRIPTION)?.addEventListener('click', () => afficherOnglet('inscription'));
  document.getElementById(DOM_IDS.LOGIN.LIEN_RESET_PASSWORD)?.addEventListener('click', envoyerResetPassword);
  document.getElementById(DOM_IDS.LOGIN.BTN_CONNEXION)?.addEventListener('click', seConnecter);
  document.getElementById(DOM_IDS.LOGIN.BTN_INSCRIPTION)?.addEventListener('click', sInscrire);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const formConnexion = document.getElementById(DOM_IDS.LOGIN.FORM_CONNEXION);
    const ongletActif = formConnexion?.style.display !== 'none';
    if (ongletActif) {
      seConnecter();
    } else {
      sInscrire();
    }
  });

  let dejaRedirige = false;
  const { data: { session } } = await supabase.auth.getSession();

  if (session && !dejaRedirige) {
    dejaRedirige = true;
    window.location.href = APP_PATHS.HOME;
  }

  supabase.auth.onAuthStateChange((event, sessionState) => {
    if (event === 'SIGNED_IN' && sessionState && !dejaRedirige) {
      dejaRedirige = true;
      window.location.href = APP_PATHS.HOME;
    }
  });
}
