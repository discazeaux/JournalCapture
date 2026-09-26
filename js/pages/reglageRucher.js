import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';
import { chargerCausesPertes } from '../utils/causesPertes.js';
import { chargerTraitementsPossibles } from '../utils/traitementsPossibles.js';

let session = null;
let causesPertes = [];
let traitementsPossibles = [];

async function ajouterRucher() {
  const nomInput = document.getElementById('inputNomRucher');
  const nom = nomInput?.value.trim();
  const nombreRuches = parseInt(document.getElementById('inputNombreRuches')?.value, 10);
  const nombreRuchettes = parseInt(document.getElementById('inputNombreRuchettes')?.value, 10);

  if (!nom) {
    toast('Donnez un nom au rucher', true);
    return;
  }

  const { error } = await supabase.from('ruchers').insert({
    user_id: session.user.id,
    nom,
    nombre_ruches: Number.isNaN(nombreRuches) ? 0 : nombreRuches,
    nombre_ruchettes: Number.isNaN(nombreRuchettes) ? 0 : nombreRuchettes
  });

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  nomInput.value = '';
  document.getElementById('inputNombreRuches').value = 0;
  document.getElementById('inputNombreRuchettes').value = 0;
  toast('Rucher ajouté');
}

function toast(message, erreur = false) {
  const element = document.getElementById('toast');
  if (!element) return;

  element.textContent = erreur ? `⚠ ${message}` : `✓ ${message}`;
  element.style.borderColor = erreur ? '#c05a5a' : 'var(--yellow)';
  element.style.color = erreur ? '#c05a5a' : 'var(--yellow)';
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2500);
}

function afficherCauses() {
  const list = document.getElementById('listCausesPerte');
  if (!list) return;

  list.innerHTML = causesPertes.map((cause) => `
    <div class="cause-item">
      <span>${escapeHtml(cause.nom)}</span>
      <button type="button" class="btn-rm" data-id="${cause.id || ''}" title="Supprimer ${escapeHtml(cause.nom)}" aria-label="Supprimer ${escapeHtml(cause.nom)}">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.btn-rm').forEach((button) => {
    button.addEventListener('click', () => supprimerCause(button.dataset.id));
  });
}

function afficherTraitementsPossibles() {
  const list = document.getElementById('listTraitementsPossibles');
  if (!list) return;

  list.innerHTML = traitementsPossibles.map((traitement) => `
    <div class="cause-item">
      <span>${escapeHtml(traitement.nom)}</span>
      <button type="button" class="btn-rm" data-id="${traitement.id || ''}" title="Supprimer ${escapeHtml(traitement.nom)}" aria-label="Supprimer ${escapeHtml(traitement.nom)}">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.btn-rm').forEach((button) => {
    button.addEventListener('click', () => supprimerTraitementPossible(button.dataset.id));
  });
}

async function ajouterCause() {
  const input = document.getElementById('inputCausePerte');
  const nom = input?.value.trim();
  if (!nom) return;

  if (causesPertes.some((cause) => cause.nom.toLowerCase() === nom.toLowerCase())) {
    toast('Cette cause existe déjà', true);
    return;
  }

  const { data, error } = await supabase.from('causes_pertes').insert({
    user_id: session.user.id,
    nom,
    ordre: 1000
  }).select('*').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  causesPertes.push(data);
  input.value = '';
  afficherCauses();
  toast('Cause ajoutée');
}

async function supprimerCause(id) {
  if (!id || !confirm('Supprimer cette cause de la liste ?')) return;

  const { error } = await supabase
    .from('causes_pertes')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  causesPertes = causesPertes.filter((cause) => cause.id !== id);
  afficherCauses();
  toast('Cause supprimée');
}

async function ajouterTraitementPossible() {
  const input = document.getElementById('inputTraitementPossible');
  const nom = input?.value.trim();
  if (!nom) return;

  if (traitementsPossibles.some((traitement) => traitement.nom.toLowerCase() === nom.toLowerCase())) {
    toast('Ce traitement existe déjà', true);
    return;
  }

  const { data, error } = await supabase.from('traitements_possibles').insert({
    user_id: session.user.id,
    nom,
    ordre: 1000
  }).select('*').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  traitementsPossibles.push(data);
  input.value = '';
  afficherTraitementsPossibles();
  toast('Traitement ajouté');
}

async function supprimerTraitementPossible(id) {
  if (!id || !confirm('Supprimer ce traitement de la liste ?')) return;

  const { error } = await supabase
    .from('traitements_possibles')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  traitementsPossibles = traitementsPossibles.filter((traitement) => traitement.id !== id);
  afficherTraitementsPossibles();
  toast('Traitement supprimé');
}

async function initPage() {
  const result = await initUserBar({ elementId: 'userBar' });
  session = result.session;

  if (!session) {
    document.getElementById('reglageRucherAuth').style.display = '';
    document.querySelectorAll('.settings-section').forEach((section) => {
      section.style.display = 'none';
    });
    return;
  }

  causesPertes = await chargerCausesPertes(supabase, session.user.id);
  afficherCauses();
  traitementsPossibles = await chargerTraitementsPossibles(supabase, session.user.id);
  afficherTraitementsPossibles();

  document.getElementById('btnAjouterRucher').addEventListener('click', ajouterRucher);
  document.getElementById('btnAjouterCausePerte').addEventListener('click', ajouterCause);
  document.getElementById('btnAjouterTraitementPossible').addEventListener('click', ajouterTraitementPossible);

  document.getElementById('inputNomRucher').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') ajouterRucher();
  });

  document.getElementById('inputTraitementPossible').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') ajouterTraitementPossible();
  });
}

initPage();
