import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';
import { chargerCausesPertes } from '../utils/causesPertes.js';
import { chargerTraitementsPossibles } from '../utils/traitementsPossibles.js';
import { chargerAppellationsMiellerie } from '../utils/appellationsMiellerie.js';

let session = null;
let ruchers = [];
let causesPertes = [];
let traitementsPossibles = [];
const TAILLES_POTS_STANDARD = [250, 500, 1000];
let taillesPotsPersonnalisees = [];
let appellationsMiel = [];

async function chargerAppellationsMiel() {
  const result = await chargerAppellationsMiellerie(supabase, session.user.id);
  appellationsMiel = result.appellations;
  if (result.error) {
    toast('Appellations par défaut affichées. Exécutez le SQL miellerie pour les gérer.', true);
  }
  afficherAppellationsMiel();
}

function afficherAppellationsMiel() {
  const list = document.getElementById('listAppellationsMiel');
  if (!list) return;

  list.replaceChildren();
  if (!appellationsMiel.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Aucune appellation active. Ajoutez-en une pour la proposer sur les récoltes.';
    list.appendChild(empty);
    return;
  }

  appellationsMiel.forEach((appellation) => {
    const item = document.createElement('div');
    item.className = 'cause-item';
    const label = document.createElement('span');
    label.textContent = appellation;
    item.appendChild(label);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn-rm';
    removeButton.textContent = '✕';
    removeButton.title = `Retirer l’appellation ${appellation}`;
    removeButton.setAttribute('aria-label', `Retirer l’appellation ${appellation}`);
    removeButton.addEventListener('click', () => supprimerAppellationMiel(appellation));
    item.appendChild(removeButton);
    list.appendChild(item);
  });
}

async function ajouterAppellationMiel() {
  const input = document.getElementById('inputAppellationMiel');
  const appellation = input.value.trim();
  if (!appellation) {
    toast('Indiquez une appellation.', true);
    input.focus();
    return;
  }
  if (appellationsMiel.some((item) => item.toLocaleLowerCase('fr') === appellation.toLocaleLowerCase('fr'))) {
    toast('Cette appellation est déjà dans la liste.', true);
    return;
  }

  const { error } = await supabase
    .from('miellerie_appellations')
    .upsert({ user_id: session.user.id, appellation, active: true }, { onConflict: 'user_id,appellation' });

  if (error) {
    console.error('Erreur ajout de l’appellation:', error);
    toast('Impossible d’ajouter l’appellation. Vérifiez le SQL miellerie.', true);
    return;
  }

  appellationsMiel.push(appellation);
  appellationsMiel.sort((a, b) => a.localeCompare(b, 'fr'));
  input.value = '';
  afficherAppellationsMiel();
  toast('Appellation ajoutée.');
}

async function supprimerAppellationMiel(appellation) {
  const { error } = await supabase
    .from('miellerie_appellations')
    .update({ active: false })
    .eq('user_id', session.user.id)
    .eq('appellation', appellation);

  if (error) {
    console.error('Erreur retrait de l’appellation:', error);
    toast('Impossible de retirer cette appellation.', true);
    return;
  }

  appellationsMiel = appellationsMiel.filter((item) => item !== appellation);
  afficherAppellationsMiel();
  toast('Appellation retirée de la liste.');
}

function libelleTaillePot(taille) {
  return taille === 1000 ? '1 kg (1000 g)' : `${taille} g`;
}

async function chargerTaillesPots() {
  const { data, error } = await supabase
    .from('miellerie_tailles_pots')
    .select('taille_pot_g')
    .eq('user_id', session.user.id)
    .order('taille_pot_g');

  if (error) {
    console.error('Erreur chargement des formats de pots:', error);
    toast('Impossible de charger les formats personnalisés. Vérifiez le script SQL de la miellerie.', true);
    taillesPotsPersonnalisees = [];
  } else {
    taillesPotsPersonnalisees = (data || [])
      .map((item) => item.taille_pot_g)
      .filter((taille) => !TAILLES_POTS_STANDARD.includes(taille));
  }

  afficherTaillesPots();
}

function afficherTaillesPots() {
  const list = document.getElementById('listTaillesPots');
  if (!list) return;

  list.replaceChildren();
  [...TAILLES_POTS_STANDARD, ...taillesPotsPersonnalisees]
    .sort((a, b) => a - b)
    .forEach((taille) => {
      const item = document.createElement('div');
      item.className = 'cause-item';
      const label = document.createElement('span');
      label.textContent = libelleTaillePot(taille);
      item.appendChild(label);

      if (!TAILLES_POTS_STANDARD.includes(taille)) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn-rm';
        removeButton.textContent = '✕';
        removeButton.title = `Retirer le format ${libelleTaillePot(taille)}`;
        removeButton.setAttribute('aria-label', `Retirer le format ${libelleTaillePot(taille)}`);
        removeButton.addEventListener('click', () => supprimerTaillePot(taille));
        item.appendChild(removeButton);
      }

      list.appendChild(item);
    });
}

async function ajouterTaillePot() {
  const input = document.getElementById('inputTaillePot');
  const taille = Number(input.value);
  if (!Number.isInteger(taille) || taille < 1 || taille > 50000) {
    toast('Indiquez un format entier entre 1 et 50 000 g.', true);
    input.focus();
    return;
  }
  if (TAILLES_POTS_STANDARD.includes(taille) || taillesPotsPersonnalisees.includes(taille)) {
    toast('Ce format est déjà disponible.', true);
    return;
  }

  const { error } = await supabase.from('miellerie_tailles_pots').insert({
    user_id: session.user.id,
    taille_pot_g: taille
  });

  if (error) {
    console.error('Erreur ajout du format de pot:', error);
    toast('Impossible d’ajouter ce format. Vérifiez le script SQL de la miellerie.', true);
    return;
  }

  taillesPotsPersonnalisees.push(taille);
  input.value = '';
  afficherTaillesPots();
  toast('Format de pot ajouté.');
}

async function supprimerTaillePot(taille) {
  const { error } = await supabase
    .from('miellerie_tailles_pots')
    .delete()
    .eq('user_id', session.user.id)
    .eq('taille_pot_g', taille);

  if (error) {
    console.error('Erreur suppression du format de pot:', error);
    toast('Impossible de retirer ce format.', true);
    return;
  }

  taillesPotsPersonnalisees = taillesPotsPersonnalisees.filter((item) => item !== taille);
  afficherTaillesPots();
  toast('Format de pot retiré.');
}

async function chargerRuchers() {
  const { data, error } = await supabase
    .from('ruchers')
    .select('id, nom')
    .eq('user_id', session.user.id)
    .order('nom');

  if (error) {
    toast('Impossible de charger les ruchers.', true);
    console.error('Erreur chargement des ruchers:', error);
    return;
  }

  ruchers = data || [];
  afficherRuchers();
}

function afficherRuchers() {
  const list = document.getElementById('listRuchers');
  if (!list) return;

  list.replaceChildren();
  if (!ruchers.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Aucun rucher enregistré.';
    list.appendChild(empty);
    return;
  }

  ruchers.forEach((rucher) => {
    const row = document.createElement('div');
    row.className = 'cause-item';

    const name = document.createElement('span');
    name.textContent = rucher.nom;
    row.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn-edit';
    editButton.textContent = 'Modifier';
    editButton.setAttribute('aria-label', `Modifier le nom de ${rucher.nom}`);
    editButton.addEventListener('click', () => afficherEditionRucher(row, rucher));
    actions.appendChild(editButton);
    row.appendChild(actions);

    list.appendChild(row);
  });
}

function afficherEditionRucher(row, rucher) {
  row.replaceChildren();

  const input = document.createElement('input');
  input.type = 'text';
  input.value = rucher.nom;
  input.maxLength = 80;
  input.style.flex = '1';
  input.setAttribute('aria-label', `Nom du rucher ${rucher.nom}`);
  row.appendChild(input);

  const actions = document.createElement('div');
  actions.className = 'item-actions';
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'btn-edit';
  saveButton.textContent = 'Enregistrer';
  saveButton.addEventListener('click', () => modifierNomRucher(rucher, input, saveButton));
  actions.appendChild(saveButton);

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn-rm';
  cancelButton.textContent = 'Annuler';
  cancelButton.addEventListener('click', afficherRuchers);
  actions.appendChild(cancelButton);
  row.appendChild(actions);

  input.focus();
  input.select();
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') modifierNomRucher(rucher, input, saveButton);
    if (event.key === 'Escape') afficherRuchers();
  });
}

async function modifierNomRucher(rucher, input, button) {
  const nom = input.value.trim();
  if (!nom) {
    toast('Donnez un nom au rucher.', true);
    input.focus();
    return;
  }
  if (nom === rucher.nom) {
    afficherRuchers();
    return;
  }

  button.disabled = true;
  const { error } = await supabase
    .from('ruchers')
    .update({ nom })
    .eq('id', rucher.id)
    .eq('user_id', session.user.id);

  if (error) {
    button.disabled = false;
    toast('Impossible de modifier le nom du rucher.', true);
    console.error('Erreur modification du nom du rucher:', error);
    return;
  }

  rucher.nom = nom;
  afficherRuchers();
  toast('Nom du rucher modifié.');
}

async function ajouterRucher() {
  const nomInput = document.getElementById('inputNomRucher');
  const nom = nomInput?.value.trim();
  const nombreRuches = parseInt(document.getElementById('inputNombreRuches')?.value, 10);
  const nombreRuchettes = parseInt(document.getElementById('inputNombreRuchettes')?.value, 10);

  if (!nom) {
    toast('Donnez un nom au rucher', true);
    return;
  }

  const { data, error } = await supabase.from('ruchers').insert({
    user_id: session.user.id,
    nom,
    nombre_ruches: Number.isNaN(nombreRuches) ? 0 : nombreRuches,
    nombre_ruchettes: Number.isNaN(nombreRuchettes) ? 0 : nombreRuchettes
  }).select('id, nom').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  nomInput.value = '';
  document.getElementById('inputNombreRuches').value = 0;
  document.getElementById('inputNombreRuchettes').value = 0;
  ruchers.push(data);
  ruchers.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  afficherRuchers();
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
  await chargerRuchers();
  await chargerTaillesPots();
  await chargerAppellationsMiel();
  afficherCauses();
  traitementsPossibles = await chargerTraitementsPossibles(supabase, session.user.id);
  afficherTraitementsPossibles();

  document.getElementById('btnAjouterRucher').addEventListener('click', ajouterRucher);
  document.getElementById('btnAjouterTaillePot').addEventListener('click', ajouterTaillePot);
  document.getElementById('btnAjouterAppellationMiel').addEventListener('click', ajouterAppellationMiel);
  document.getElementById('btnAjouterCausePerte').addEventListener('click', ajouterCause);
  document.getElementById('btnAjouterTraitementPossible').addEventListener('click', ajouterTraitementPossible);

  document.getElementById('inputNomRucher').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') ajouterRucher();
  });

  document.getElementById('inputTaillePot').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') ajouterTaillePot();
  });

  document.getElementById('inputAppellationMiel').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') ajouterAppellationMiel();
  });

  document.getElementById('inputTraitementPossible').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') ajouterTraitementPossible();
  });
}

initPage();
