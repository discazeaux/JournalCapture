import { supabase } from '../supabase.js';

export function initResetPasswordPage() {
  const form = document.getElementById('formReset');
  const message = document.getElementById('message');
  const attente = document.getElementById('attente');
  const button = document.getElementById('btnReset');
  let recoveryReady = false;

  const afficherMessage = (texte, type) => {
    message.textContent = texte;
    message.className = `message ${type}`;
  };

  const timeout = window.setTimeout(() => {
    if (!recoveryReady) {
      attente.textContent = 'Lien invalide ou expiré. Refaites une demande depuis la page de connexion.';
    }
  }, 10000);

  supabase.auth.onAuthStateChange((event) => {
    if (event !== 'PASSWORD_RECOVERY') return;
    recoveryReady = true;
    window.clearTimeout(timeout);
    attente.hidden = true;
    form.style.display = 'block';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('pwd1').value;
    const confirmation = document.getElementById('pwd2').value;

    if (password.length < 6) {
      afficherMessage('Le mot de passe doit faire au moins 6 caractères.', 'error');
      return;
    }
    if (password !== confirmation) {
      afficherMessage('Les mots de passe ne correspondent pas.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Enregistrement…';
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      afficherMessage(error.message, 'error');
      button.disabled = false;
      button.textContent = 'Enregistrer';
      return;
    }

    afficherMessage('Mot de passe modifié. Redirection vers la connexion…', 'success');
    await supabase.auth.signOut();
    window.setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  });
}