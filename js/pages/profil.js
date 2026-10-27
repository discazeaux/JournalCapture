import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';

const form = document.getElementById('profileForm');
const emailInput = document.getElementById('profileEmail');
const nameInput = document.getElementById('profileName');
const postalCodeInput = document.getElementById('profilePostalCode');
const saveButton = document.getElementById('saveProfile');
const message = document.getElementById('profileMessage');

function afficherMessage(texte, type) {
  message.textContent = texte;
  message.className = `message ${type}`;
}

const { session, profil } = await initUserBar({ elementId: 'userBar' });

if (!session) {
  window.location.href = 'login.html';
} else if (!profil) {
  afficherMessage('Impossible de charger votre profil.', 'error');
  form.hidden = true;
} else {
  emailInput.value = session.user.email || '';
  nameInput.value = profil.pseudo || '';
  postalCodeInput.value = profil.codePostal || '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pseudo = nameInput.value.trim();
    const codePostal = postalCodeInput.value.trim();

    if (!pseudo || !codePostal) {
      afficherMessage('Veuillez renseigner tous les champs.', 'error');
      (pseudo ? postalCodeInput : nameInput).focus();
      return;
    }

    saveButton.disabled = true;
    afficherMessage('Enregistrement…', '');

    const { error } = await supabase
      .from('profils')
      .update({ pseudo, codePostal })
      .eq('id', session.user.id);

    saveButton.disabled = false;
    if (error) {
      afficherMessage('Impossible d’enregistrer les modifications.', 'error');
      console.error('Erreur mise à jour du profil:', error);
      return;
    }

    afficherMessage('Profil mis à jour.', 'success');
  });
}