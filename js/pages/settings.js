import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { DOM_IDS, UI_MESSAGES } from '../constants.js';
import { escapeHtml } from '../utils/escape.js';
import { chargerCausesPertes as chargerCausesPertesDepuisModule } from '../utils/causesPertes.js';
import { chargerTraitementsPossibles } from '../utils/traitementsPossibles.js';

const state = {
  ruchers: [],
  traitements: [],
  pertes: [],
  appats: [],
  postes: [],
  causesPertes: [],
  traitementsPossibles: [],
  rucherActifId: null,
  suggDef: [],
  typeSelectionneGlobal: 'sucre'
};

const cartesAdressesPostes = new Map();

let session = null;

const ETATS_SANTE_RUCHER = [
  { id: 'tres_populeuse', emoji: '🐝🐝', label: 'Très populeuse', classe: 'sante-excellente' },
  { id: 'populeuse', emoji: '🐝', label: 'Populeuse', classe: 'sante-bonne' },
  { id: 'equilibree', emoji: '⚖️', label: 'Équilibrée', classe: 'sante-equilibree' },
  { id: 'faible', emoji: '🌱', label: 'Faible', classe: 'sante-faible' },
  { id: 'a_surveiller', emoji: '👀', label: 'À surveiller', classe: 'sante-surveiller' },
  { id: 'critique', emoji: '⚠️', label: 'Critique', classe: 'sante-critique' }
];

function toast(msg, erreur = false) {
  const el = document.getElementById(DOM_IDS.SETTINGS.TOAST);
  if (!el) return;

  el.textContent = erreur ? `⚠ ${msg}` : `✓ ${msg}`;
  el.style.borderColor = erreur ? '#c05a5a' : 'var(--yellow)';
  el.style.color = erreur ? '#c05a5a' : 'var(--yellow)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function selectType(type) {
  state.typeSelectionneGlobal = type;
  const sucreBtn = document.getElementById(DOM_IDS.SETTINGS.BTN_TYPE_SUCRE);
  const proteineBtn = document.getElementById(DOM_IDS.SETTINGS.BTN_TYPE_PROTEINE);

  if (sucreBtn) sucreBtn.classList.toggle('selected', type === 'sucre');
  if (proteineBtn) proteineBtn.classList.toggle('selected', type === 'proteine');
}

async function chargerAppats() {
  const { data, error } = await supabase
    .from('appats')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at');

  if (error) {
    console.error(error);
    state.appats = [];
    renderAppats();
    return;
  }

  state.appats = Array.isArray(data) ? data : [];
  renderAppats();
}

async function chargerRuchers() {
  const { data, error } = await supabase
    .from('ruchers')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at');

  if (error) {
    console.error(error);
    state.ruchers = [];
    renderRuchers();
    return;
  }

  state.ruchers = data || [];
  renderRuchers();
}

async function chargerTraitements() {
  const { data, error } = await supabase
    .from('traitements_ruchers')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date_traitement', { ascending: false });

  if (error) {
    console.error(error);
    state.traitements = [];
    renderRuchers();
    return;
  }

  state.traitements = data || [];
  renderRuchers();
}

async function chargerPertes() {
  const { data, error } = await supabase
    .from('pertes_colonies')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date_constat', { ascending: false });

  if (error) {
    console.error(error);
    state.pertes = [];
    renderRuchers();
    return;
  }

  state.pertes = data || [];
  renderRuchers();
}

function afficherDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${date}T00:00:00`));
}

function ajouterJours(date, jours) {
  const resultat = new Date(`${date}T00:00:00`);
  resultat.setDate(resultat.getDate() + jours);
  return resultat.toISOString().slice(0, 10);
}

function obtenirEtatSante(id) {
  return ETATS_SANTE_RUCHER.find((etat) => etat.id === id) || ETATS_SANTE_RUCHER[2];
}

function obtenirRepartitionSante(rucher) {
  try {
    const repartition = typeof rucher.sante_ruches === 'string'
      ? JSON.parse(rucher.sante_ruches)
      : rucher.sante_ruches;
    if (!repartition || typeof repartition !== 'object' || Array.isArray(repartition)) return {};
    return Object.fromEntries(ETATS_SANTE_RUCHER
      .filter((etat) => Number.isInteger(repartition[etat.id]) && repartition[etat.id] > 0)
      .map((etat) => [etat.id, repartition[etat.id]]));
  } catch {
    return {};
  }
}

function renderRuchers() {
  const list = document.getElementById(DOM_IDS.SETTINGS.LIST_RUCHERS);
  if (!list) return;

  list.innerHTML = '';

  if (!state.ruchers.length) {
    list.innerHTML = document.getElementById('suiviRucherAuth')
      ? '<p class="empty">Aucun rucher. <a href="reglageRucher.html">Accéder aux réglages pour en ajouter un.</a></p>'
      : '<p class="empty">Aucun rucher. Ajoutez-en un ci-dessous.</p>';
    return;
  }

  if (!state.ruchers.some((rucher) => rucher.id === state.rucherActifId)) {
    state.rucherActifId = state.ruchers[0].id;
  }

  const tabs = document.createElement('div');
  tabs.className = 'rucher-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Sélectionner un rucher');

  state.ruchers.forEach((rucher) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `rucher-tab${rucher.id === state.rucherActifId ? ' active' : ''}`;
    tab.dataset.rucherId = rucher.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', rucher.id === state.rucherActifId ? 'true' : 'false');
    tab.textContent = rucher.nom;
    tabs.appendChild(tab);
  });
  list.appendChild(tabs);

  const cards = document.createElement('div');
  cards.className = 'rucher-panels';
  list.appendChild(cards);

  state.ruchers.forEach((rucher) => {
    const card = document.createElement('div');
    card.className = `rucher-card${rucher.id === state.rucherActifId ? ' active' : ''}`;
    card.dataset.rucherId = rucher.id;
    const traitements = state.traitements.filter((traitement) => traitement.rucher_id === rucher.id);
    const pertes = state.pertes.filter((perte) => perte.rucher_id === rucher.id);
    const repartitionSante = obtenirRepartitionSante(rucher);
    const totalRuchesSante = Object.values(repartitionSante).reduce((total, nombre) => total + nombre, 0);
    const nombreUnites = (Number(rucher.nombre_ruches) || 0) + (Number(rucher.nombre_ruchettes) || 0);
    card.innerHTML = `
      <div class="rucher-header">
        <span class="rucher-nom">${escapeHtml(rucher.nom)}</span>
        <div class="item-actions">
          <button class="btn-rm" data-id="${rucher.id}" title="Supprimer">✕</button>
        </div>
      </div>
      <div class="rucher-details">
        <label>🐝 Ruches
          <input type="number" class="input-nombre-ruches" data-rucher-id="${rucher.id}" min="0" max="9999" value="${rucher.nombre_ruches}">
        </label>
        <label>▣ Ruchettes
          <input type="number" class="input-nombre-ruchettes" data-rucher-id="${rucher.id}" min="0" max="9999" value="${rucher.nombre_ruchettes}">
        </label>
      </div>
      <div class="sante-rucher">
        <strong>État de santé <span class="sante-total">${totalRuchesSante}/${nombreUnites}</span></strong>
        <div class="sante-options" aria-label="Répartition de l’état de santé des ruches et ruchettes">
          ${ETATS_SANTE_RUCHER.map((etat) => `
            <div class="sante-compteur ${etat.classe}">
              <button type="button" class="sante-option" data-rucher-id="${rucher.id}" data-etat-sante="${etat.id}" title="Ajouter une ruche : ${etat.label}">
                <span class="sante-emoji" aria-hidden="true">${etat.emoji}</span>
                <span>${etat.label}</span>
                <strong class="sante-nombre">${repartitionSante[etat.id] || 0}</strong>
              </button>
              <button type="button" class="sante-decrement" data-rucher-id="${rucher.id}" data-etat-sante="${etat.id}" title="Retirer une ruche : ${etat.label}" aria-label="Retirer une ruche ${etat.label}">−</button>
            </div>
          `).join('')}
        </div>
        <span class="sante-aide">Cliquez sur un état pour ajouter une ruche à ce compteur.</span>
      </div>
      <div class="traitements-panel">
        <strong>Traitements</strong>
        <div class="traitements-list">
          ${traitements.length
            ? traitements.map((traitement) => `
              <div class="traitement-row">
                <span>
                  ${escapeHtml(traitement.intitule)} <small>(${afficherDate(traitement.date_traitement)})</small>
                </span>
                <div class="traitement-rappels-edit">
                  <label class="traitement-etape ${traitement.changement_lanieres_fait ? 'etape-faite' : ''}">
                    <span><input type="checkbox" class="check-etape-traitement" data-id="${traitement.id}" data-etape="changement" ${traitement.changement_lanieres_fait ? 'checked' : ''}> Changer les lanières</span>
                    ${traitement.changement_lanieres_fait ? `<em>Fait le ${afficherDate(traitement.date_changement_lanieres)}</em>` : `<input type="date" class="input-changement-lanieres" data-id="${traitement.id}" value="${traitement.date_changement_lanieres || ''}">`}
                  </label>
                  <label class="traitement-etape ${traitement.retrait_lanieres_fait ? 'etape-faite' : ''}">
                    <span><input type="checkbox" class="check-etape-traitement" data-id="${traitement.id}" data-etape="retrait" ${traitement.retrait_lanieres_fait ? 'checked' : ''}> Enlever les lanières</span>
                    ${traitement.retrait_lanieres_fait ? `<em>Fait le ${afficherDate(traitement.date_retrait_lanieres)}</em>` : `<input type="date" class="input-retrait-lanieres" data-id="${traitement.id}" value="${traitement.date_retrait_lanieres || ''}">`}
                  </label>
                </div>
                <button class="btn-rm btn-rm-traitement" data-id="${traitement.id}" title="Supprimer">✕</button>
              </div>
            `).join('')
            : '<span class="traitements-empty">Aucun traitement enregistré</span>'}
        </div>
        <div class="traitement-form">
          <select class="input-intitule-traitement" data-rucher-id="${rucher.id}" aria-label="Traitement">
            <option value="">Choisir un traitement</option>
            ${state.traitementsPossibles.map((traitement) => `<option value="${escapeHtml(traitement.nom)}">${escapeHtml(traitement.nom)}</option>`).join('')}
          </select>
          <input type="date" class="input-date-traitement" data-rucher-id="${rucher.id}" value="${new Date().toISOString().slice(0, 10)}">
          <button type="button" class="btn-add btn-ajouter-traitement" data-rucher-id="${rucher.id}">＋ Ajouter</button>
        </div>
      </div>
      <div class="pertes-panel">
        <strong>Pertes de colonies</strong>
        <div class="pertes-list">
          ${pertes.length
            ? pertes.map((perte) => `
              <div class="perte-row">
                <div class="perte-content">
                  <strong>${escapeHtml(perte.colonie)}</strong>
                  <small>Constat : ${afficherDate(perte.date_constat)}</small>
                  <span><b>Cause${perte.causes_probables?.length > 1 ? 's' : ''} :</b> ${escapeHtml((perte.causes_probables?.length ? perte.causes_probables : [perte.cause_probable]).join(', '))}</span>
                  <span><b>Observation effectuée et mesure prise :</b> ${escapeHtml(perte.observation_mesure)}</span>
                </div>
                <button class="btn-rm btn-rm-perte" data-id="${perte.id}" title="Supprimer">✕</button>
              </div>
            `).join('')
            : '<span class="pertes-empty">Aucune perte enregistrée</span>'}
        </div>
        <div class="perte-form">
          <input type="date" class="input-date-perte" data-rucher-id="${rucher.id}" value="${new Date().toISOString().slice(0, 10)}" title="Date de constat">
          <input type="text" class="input-colonie-perte" data-rucher-id="${rucher.id}" placeholder="Nom de la colonie (ex. R003)" maxlength="40">
          <select class="input-cause-perte" data-rucher-id="${rucher.id}" multiple size="3" aria-label="Causes probables">
            <option value="">Cause probable</option>
            ${state.causesPertes.map((cause) => `<option value="${escapeHtml(cause.nom)}">${escapeHtml(cause.nom)}</option>`).join('')}
          </select>
          <textarea class="input-observation-perte" data-rucher-id="${rucher.id}" placeholder="Observation effectuée et mesure prise" maxlength="500" rows="3"></textarea>
          <button type="button" class="btn-add btn-ajouter-perte" data-rucher-id="${rucher.id}">＋ Ajouter</button>
        </div>
      </div>
    `;
    cards.appendChild(card);
  });

  tabs.querySelectorAll('.rucher-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.rucherActifId = tab.dataset.rucherId;
      renderRuchers();
    });
  });

  cards.querySelectorAll('.rucher-header .btn-rm').forEach((btn) => {
    btn.addEventListener('click', () => supprimerRucher(btn.dataset.id));
  });

  cards.querySelectorAll('.input-nombre-ruches, .input-nombre-ruchettes').forEach((input) => {
    input.addEventListener('change', () => modifierEffectifRucher(
      input.dataset.rucherId,
      input.classList.contains('input-nombre-ruches') ? 'nombre_ruches' : 'nombre_ruchettes',
      input.value
    ));
  });

  cards.querySelectorAll('.sante-option').forEach((button) => {
    button.addEventListener('click', () => modifierEtatSante(
      button.dataset.rucherId,
      button.dataset.etatSante,
      1
    ));
  });

  cards.querySelectorAll('.sante-decrement').forEach((button) => {
    button.addEventListener('click', () => modifierEtatSante(
      button.dataset.rucherId,
      button.dataset.etatSante,
      -1
    ));
  });

  cards.querySelectorAll('.btn-rm-traitement').forEach((btn) => {
    btn.addEventListener('click', () => supprimerTraitement(btn.dataset.id));
  });

  cards.querySelectorAll('.btn-rm-perte').forEach((btn) => {
    btn.addEventListener('click', () => supprimerPerte(btn.dataset.id));
  });

  cards.querySelectorAll('.input-changement-lanieres, .input-retrait-lanieres').forEach((input) => {
    input.addEventListener('change', () => modifierDateRappel(
      input.dataset.id,
      input.classList.contains('input-changement-lanieres') ? 'changement' : 'retrait',
      input.value
    ));
  });

  cards.querySelectorAll('.check-etape-traitement').forEach((checkbox) => {
    checkbox.addEventListener('change', () => modifierEtapeTraitement(
      checkbox.dataset.id,
      checkbox.dataset.etape,
      checkbox.checked
    ));
  });

  cards.querySelectorAll('.btn-ajouter-traitement').forEach((btn) => {
    btn.addEventListener('click', () => ajouterTraitement(btn.dataset.rucherId));
  });

  cards.querySelectorAll('.btn-ajouter-perte').forEach((btn) => {
    btn.addEventListener('click', () => ajouterPerte(btn.dataset.rucherId));
  });
}

async function modifierEtatSante(rucherId, etatSante, variation) {
  const etat = obtenirEtatSante(etatSante);
  const rucher = state.ruchers.find((item) => item.id === rucherId);
  if (!rucher) return;

  const repartition = obtenirRepartitionSante(rucher);
  const total = Object.values(repartition).reduce((somme, nombre) => somme + nombre, 0);
  const nouveauNombre = (repartition[etat.id] || 0) + variation;

  if (nouveauNombre < 0) return;
  const nombreUnites = (Number(rucher.nombre_ruches) || 0) + (Number(rucher.nombre_ruchettes) || 0);
  if (variation > 0 && nombreUnites > 0 && total >= nombreUnites) {
    toast('Toutes les ruches et ruchettes sont déjà comptées', true);
    return;
  }

  if (nouveauNombre === 0) delete repartition[etat.id];
  else repartition[etat.id] = nouveauNombre;

  const { error } = await supabase.from('ruchers').update({
    sante_ruches: repartition,
    etat_sante: etat.id
  })
    .eq('id', rucherId).eq('user_id', session.user.id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  rucher.sante_ruches = repartition;
  rucher.etat_sante = etat.id;
  renderRuchers();
  toast('État de santé mis à jour ✓');
}

async function ajouterPerte(rucherId) {
  const valeur = (classe) => document.querySelector(`${classe}[data-rucher-id="${rucherId}"]`)?.value.trim();
  const selectCauses = document.querySelector(`.input-cause-perte[data-rucher-id="${rucherId}"]`);
  const dateConstat = valeur('.input-date-perte');
  const colonie = valeur('.input-colonie-perte');
  const causesProbables = Array.from(selectCauses?.selectedOptions || []).map((option) => option.value.trim()).filter(Boolean);
  const causeProbable = causesProbables.join(', ');
  const observationMesure = valeur('.input-observation-perte');

  if (!dateConstat || !colonie || !causesProbables.length || !observationMesure) {
    toast('Indiquez la date, la colonie, au moins une cause et une observation', true);
    return;
  }

  const { data, error } = await supabase.from('pertes_colonies').insert({
    user_id: session.user.id,
    rucher_id: rucherId,
    date_constat: dateConstat,
    colonie,
    cause_probable: causeProbable,
    causes_probables: causesProbables,
    observation_mesure: observationMesure
  }).select('*').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.pertes.push(data);
  renderRuchers();
  toast('Perte de colonie enregistrée ✓');
}

async function supprimerPerte(id) {
  if (!confirm('Supprimer cette perte de colonie ?')) return;

  const { error } = await supabase.from('pertes_colonies').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.pertes = state.pertes.filter((perte) => perte.id !== id);
  renderRuchers();
  toast('Perte supprimée');
}

async function modifierEtapeTraitement(id, etape, faite) {
  const colonne = etape === 'changement' ? 'changement_lanieres_fait' : 'retrait_lanieres_fait';
  const { error } = await supabase.from('traitements_ruchers').update({
    [colonne]: faite
  })
    .eq('id', id).eq('user_id', session.user.id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    renderRuchers();
    return;
  }

  const traitement = state.traitements.find((item) => item.id === id);
  if (traitement) {
    traitement[colonne] = faite;
  }
  renderRuchers();
  toast(UI_MESSAGES.settings.traitementRemindersUpdated || 'Rappels du traitement mis à jour ✓');
}

async function modifierDateRappel(id, etape, date) {
  const traitement = state.traitements.find((item) => item.id === id);

  if (!date) {
    toast('Indiquez une date de rappel du traitement', true);
    return;
  }

  const colonne = etape === 'changement' ? 'date_changement_lanieres' : 'date_retrait_lanieres';
  const valeurs = { [colonne]: date };
  if (etape === 'changement') valeurs.date_rappel = date;

  const { error } = await supabase.from('traitements_ruchers').update({
    ...valeurs
  }).eq('id', id).eq('user_id', session.user.id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  if (traitement) {
    traitement[colonne] = date;
    if (etape === 'changement') traitement.date_rappel = date;
  }

  toast(UI_MESSAGES.settings.traitementRemindersUpdated || 'Rappels du traitement mis à jour ✓');
}

async function modifierEffectifRucher(rucherId, colonne, valeur) {
  const nombre = Number(valeur);

  if (!Number.isInteger(nombre) || nombre < 0) {
    toast(UI_MESSAGES.settings.invalidRucherCounts, true);
    return;
  }

  const { error } = await supabase.from('ruchers').update({ [colonne]: nombre })
    .eq('id', rucherId).eq('user_id', session.user.id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  const rucher = state.ruchers.find((item) => item.id === rucherId);
  if (rucher) rucher[colonne] = nombre;

  renderRuchers();
  toast(UI_MESSAGES.settings.rucherUpdated);
}

async function ajouterTraitement(rucherId) {
  const intituleInput = document.querySelector(`.input-intitule-traitement[data-rucher-id="${rucherId}"]`);
  const dateInput = document.querySelector(`.input-date-traitement[data-rucher-id="${rucherId}"]`);
  const intitule = intituleInput?.value.trim();
  const dateTraitement = dateInput?.value;

  if (!intitule || !dateTraitement) {
    toast(UI_MESSAGES.settings.requireTraitementFields, true);
    return;
  }

  const { data, error } = await supabase.from('traitements_ruchers').insert({
    user_id: session.user.id,
    rucher_id: rucherId,
    intitule,
    date_traitement: dateTraitement,
    rappel_necessaire: true,
    date_rappel: ajouterJours(dateTraitement, 21),
    date_changement_lanieres: ajouterJours(dateTraitement, 21),
    date_retrait_lanieres: ajouterJours(dateTraitement, 42),
    changement_lanieres_fait: false,
    retrait_lanieres_fait: false
  }).select('*').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.traitements.push(data);
  renderRuchers();
  toast(UI_MESSAGES.settings.traitementAdded);
}

async function supprimerTraitement(id) {
  if (!confirm(UI_MESSAGES.settings.deleteTraitementConfirm)) return;

  const { error } = await supabase.from('traitements_ruchers').delete().eq('id', id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.traitements = state.traitements.filter((traitement) => traitement.id !== id);
  renderRuchers();
  toast(UI_MESSAGES.settings.traitementDeleted);
}

async function ajouterRucher() {
  const nom = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_RUCHER)?.value.trim();
  const nombreRuches = parseInt(document.getElementById(DOM_IDS.SETTINGS.INPUT_NOMBRE_RUCHES)?.value, 10);
  const nombreRuchettes = parseInt(document.getElementById(DOM_IDS.SETTINGS.INPUT_NOMBRE_RUCHETTES)?.value, 10);

  if (!nom) {
    toast(UI_MESSAGES.settings.requireRucherName, true);
    return;
  }

  const { data, error } = await supabase.from('ruchers').insert({
    user_id: session.user.id,
    nom,
    nombre_ruches: Number.isNaN(nombreRuches) ? 0 : nombreRuches,
    nombre_ruchettes: Number.isNaN(nombreRuchettes) ? 0 : nombreRuchettes
  }).select('*').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.ruchers.push(data);
  state.rucherActifId = data.id;
  document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_RUCHER).value = '';
  document.getElementById(DOM_IDS.SETTINGS.INPUT_NOMBRE_RUCHES).value = 0;
  document.getElementById(DOM_IDS.SETTINGS.INPUT_NOMBRE_RUCHETTES).value = 0;
  renderRuchers();
  toast(UI_MESSAGES.settings.rucherAdded);
}

async function supprimerRucher(id) {
  if (!confirm(UI_MESSAGES.settings.deleteRucherConfirm)) return;

  const { error } = await supabase.from('ruchers').delete().eq('id', id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.ruchers = state.ruchers.filter((rucher) => rucher.id !== id);
  if (state.rucherActifId === id) state.rucherActifId = state.ruchers[0]?.id || null;
  renderRuchers();
  toast(UI_MESSAGES.settings.rucherDeleted);
}

async function chargerSuggestions() {
  const { data } = await supabase.from('appats_defaut').select('*').order('nom');
  state.suggDef = data || [];
  renderSuggestions();
}

async function chargerPostes() {
  const { data, error } = await supabase
    .from('postes_pieges')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at');

  if (error) {
    console.error(error);
    return;
  }

  state.postes = data || [];
  renderPostes();
}

async function chargerCausesPertes() {
  state.causesPertes = await chargerCausesPertesDepuisModule(supabase, session.user.id);
}

async function chargerListeTraitements() {
  state.traitementsPossibles = await chargerTraitementsPossibles(supabase, session.user.id);
}

function renderAppats() {
  const list = document.getElementById(DOM_IDS.SETTINGS.LIST_APPATS);
  if (!list) return;

  list.innerHTML = '';

  if (!state.appats.length) {
    list.innerHTML = '<p class="empty">Aucun appât. Ajoutez-en un ci-dessous ou importez une suggestion.</p>';
    return;
  }

  state.appats.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'appat-card' + (a.defaut ? ' is-default' : '');

    const typeBadge = a.type === 'proteine'
      ? '<span class="badge-type badge-proteine">🥩 Protéiné</span>'
      : '<span class="badge-type badge-sucre">🍯 Sucré</span>';

    const defBadge = a.defaut ? '<span class="badge-default">★ défaut</span>' : '';

    card.innerHTML = `
      <div class="appat-header">
        <span class="appat-nom">${escapeHtml(a.nom)}</span>
        ${typeBadge} ${defBadge}
        <div class="item-actions">
          <button class="btn-defaut ${a.defaut ? 'active' : ''}" data-id="${a.id}" title="Définir comme défaut">★</button>
          <button class="btn-recette" data-id="${a.id}" title="Recette">📖</button>
          <button class="btn-rm" data-id="${a.id}" title="Supprimer">✕</button>
        </div>
      </div>
      <div class="appat-recette-panel" id="rp-${a.id}">
        <label>Recette / composition</label>
        <textarea placeholder="Ingrédients, proportions…" data-id="${a.id}">${escapeHtml(a.recette || '')}</textarea>
        <button type="button" class="btn-save-recipe" data-id="${a.id}">💾 Enregistrer la recette</button>
      </div>
    `;

    list.appendChild(card);
  });

  list.querySelectorAll('.btn-defaut').forEach((btn) => {
    btn.addEventListener('click', () => setDefaut(btn.dataset.id));
  });

  list.querySelectorAll('.btn-recette').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`rp-${btn.dataset.id}`);
      panel?.classList.toggle('open');
    });
  });

  list.querySelectorAll('.btn-rm').forEach((btn) => {
    btn.addEventListener('click', () => supprimerAppat(btn.dataset.id));
  });

  list.querySelectorAll('.btn-save-recipe').forEach((btn) => {
    btn.addEventListener('click', () => sauvegarderRecette(btn.dataset.id));
  });
}

function renderSuggestions() {
  const section = document.getElementById(DOM_IDS.SETTINGS.SECTION_SUGGESTIONS);
  const grid = document.getElementById(DOM_IDS.SETTINGS.GRID_SUGGESTIONS);

  if (!section || !grid) return;

  if (!state.suggDef.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  grid.innerHTML = '';

  state.suggDef.forEach((s) => {
    const dejaImporte = state.appats.some((a) => a.nom.toLowerCase() === s.nom.toLowerCase());
    const chip = document.createElement('span');
    chip.className = 'suggestion-chip' + (dejaImporte ? ' imported' : '');
    chip.innerHTML = `${s.type === 'proteine' ? '🥩' : '🍯'} ${escapeHtml(s.nom)}`;

    if (!dejaImporte) {
      chip.addEventListener('click', () => importerSuggestion(s));
    }

    grid.appendChild(chip);
  });
}

function renderPostes() {
  const list = document.getElementById(DOM_IDS.SETTINGS.LIST_POSTES);
  if (!list) return;

  cartesAdressesPostes.forEach(({ map }) => map.remove());
  cartesAdressesPostes.clear();

  list.innerHTML = '';

  if (!state.postes.length) {
    list.innerHTML = '<p class="empty">Aucun poste. Ajoutez-en un ci-dessous.</p>';
    return;
  }

  state.postes.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'poste-card' + (p.actif ? '' : ' inactif');
    card.dataset.posteId = p.id;

    const methodes = normaliserMethodesPoste(p.methodes_piegeage);

    const defautBadge = p.defaut ? '<span class="badge-default">★ défaut</span>' : '';
    const actifBadge = p.actif
      ? '<span class="badge-actif">● Actif</span>'
      : '<span class="badge-inactif">○ Inactif</span>';

    card.innerHTML = `
      <div class="poste-header">
        <span class="poste-nom">${escapeHtml(p.nom)}</span>
        ${defautBadge}
        ${actifBadge}
        <div class="item-actions">
          <button class="btn-defaut ${p.defaut ? 'active' : ''}" data-id="${p.id}" title="Définir comme poste par défaut">★</button>
          <button class="btn-toggle" data-id="${p.id}" data-actif="${p.actif}" title="${p.actif ? 'Désactiver' : 'Activer'}">${p.actif ? '⏸' : '▶'}</button>
          <button class="btn-rm" data-id="${p.id}" title="Supprimer">✕</button>
        </div>
      </div>
      <div class="poste-adresse">
        <label for="adressePoste-${p.id}">Adresse complète <span>(facultative)</span></label>
        <div class="adresse-lookup">
          <input
            id="adressePoste-${p.id}"
            class="adresse-poste-input"
            type="search"
            value="${escapeHtml(p.adresse || '')}"
            placeholder="Commencez à saisir une adresse…"
            autocomplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="false"
            aria-controls="suggestionsAdressePoste-${p.id}"
            data-poste-id="${p.id}"
            data-adresse-initiale="${escapeHtml(p.adresse || '')}"
            data-latitude-initiale="${p.latitude ?? ''}"
            data-longitude-initiale="${p.longitude ?? ''}"
            data-code-postal-initial="${escapeHtml(p.code_postal || '')}"
          >
          <div class="adresse-suggestions" id="suggestionsAdressePoste-${p.id}" role="listbox" aria-live="polite" hidden></div>
        </div>
        <div class="poste-adresse-actions">
          <small>Votre saisie est transmise à la Base Adresse Nationale. Si la suggestion est approximative, corrigez le point sur la carte.</small>
          <button type="button" class="btn-add btn-save-adresse-poste" data-poste-id="${p.id}">Enregistrer l’adresse</button>
        </div>
        <button type="button" class="btn-positionner-adresse" data-poste-id="${p.id}" aria-expanded="false" aria-controls="carteAdressePoste-${p.id}">Positionner le point sur la carte</button>
        <div class="adresse-map-panel" id="carteAdressePoste-${p.id}" hidden>
          <label for="rechercheCartePoste-${p.id}">Centrer la carte sur une adresse ou une commune</label>
          <div class="adresse-lookup">
            <input id="rechercheCartePoste-${p.id}" class="recherche-carte-poste" type="search" placeholder="Ex. 33400 Talence" autocomplete="off" data-poste-id="${p.id}" aria-label="Rechercher une adresse pour centrer la carte">
            <div class="adresse-suggestions recherche-carte-suggestions" role="listbox" aria-live="polite" hidden></div>
          </div>
          <p class="adresse-map-aide">Cliquez sur la carte pour placer le point. Vous pouvez aussi déplacer le marqueur.</p>
          <div class="adresse-map" id="mapAdressePoste-${p.id}" role="application" aria-label="Position du poste ${escapeHtml(p.nom)}"></div>
          <output class="adresse-coordonnees" aria-live="polite">Point non modifié</output>
        </div>
      </div>
      <div class="poste-methodes">
        <strong>Méthodes de piégeage</strong>
        ${methodes.length ? methodes.map((methode, index) => `
          <div class="poste-methode-ligne">
            <span>${escapeHtml(methode.nom)}${methode.defaut ? ' <span class="badge-default">★ par défaut</span>' : ''}</span>
            <div class="item-actions">
              <button type="button" class="btn-methode-defaut ${methode.defaut ? 'active' : ''}" data-index="${index}" title="Définir comme méthode par défaut" aria-label="Définir ${escapeHtml(methode.nom)} comme méthode par défaut">★</button>
              <button type="button" class="btn-methode-rm" data-index="${index}" title="Supprimer cette méthode" aria-label="Supprimer ${escapeHtml(methode.nom)}">✕</button>
            </div>
          </div>
        `).join('') : '<p class="poste-methodes-vide">Aucune méthode configurée.</p>'}
        <div class="poste-methode-ajout">
          <select class="select-methode-poste" aria-label="Choisir une méthode pour ${escapeHtml(p.nom)}">
            <option value="">Ajouter une méthode standard…</option>
            ${(window.CONFIG?.METHODES || []).map((methode) => `
              <option value="${escapeHtml(methode.valeur)}" ${methodes.some((existante) => existante.nom === methode.valeur) ? 'disabled' : ''}>${escapeHtml(methode.label)}</option>
            `).join('')}
          </select>
          <button type="button" class="btn-add btn-ajouter-methode">＋ Ajouter</button>
        </div>
      </div>
    `;

    list.appendChild(card);
  });

  list.querySelectorAll('.btn-defaut').forEach((btn) => {
    btn.addEventListener('click', () => setDefautPoste(btn.dataset.id));
  });

  list.querySelectorAll('.btn-toggle').forEach((btn) => {
    btn.addEventListener('click', () => togglePoste(btn.dataset.id, btn.dataset.actif === 'true'));
  });

  list.querySelectorAll('.btn-rm').forEach((btn) => {
    btn.addEventListener('click', () => supprimerPoste(btn.dataset.id));
  });

  list.querySelectorAll('.poste-card').forEach((card) => {
    const posteId = card.dataset.posteId;
    card.querySelector('.btn-ajouter-methode')?.addEventListener('click', () => {
      ajouterMethodePoste(posteId, card.querySelector('.select-methode-poste'));
    });
    card.querySelectorAll('.btn-methode-defaut').forEach((button) => {
      button.addEventListener('click', () => definirMethodeDefaut(posteId, Number(button.dataset.index)));
    });
    card.querySelectorAll('.btn-methode-rm').forEach((button) => {
      button.addEventListener('click', () => supprimerMethodePoste(posteId, Number(button.dataset.index)));
    });
  });

  list.querySelectorAll('.adresse-poste-input').forEach(initialiserAutocompletionAdressePoste);
  list.querySelectorAll('.btn-save-adresse-poste').forEach((button) => {
    button.addEventListener('click', () => enregistrerAdressePoste(button.dataset.posteId, button));
  });
  list.querySelectorAll('.btn-positionner-adresse').forEach((button) => {
    button.addEventListener('click', () => basculerCarteAdressePoste(button.dataset.posteId, button));
  });
  list.querySelectorAll('.recherche-carte-poste').forEach(initialiserRechercheCentrageCarte);
}

function initialiserAutocompletionAdressePoste(input) {
  const resultats = document.getElementById(input.getAttribute('aria-controls'));
  let minuteur = null;
  let requete = null;

  input.addEventListener('input', () => {
    clearTimeout(minuteur);
    requete?.abort();
    input.dataset.selectionValide = 'false';
    input.dataset.positionManuelle = 'false';
    resultats.replaceChildren();

    const recherche = input.value.trim();
    if (recherche.length < 3) {
      resultats.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    resultats.hidden = false;
    resultats.textContent = 'Recherche d’adresses…';
    input.setAttribute('aria-expanded', 'true');

    minuteur = setTimeout(async () => {
      requete = new AbortController();
      try {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(recherche)}&limit=5`;
        const response = await fetch(url, { signal: requete.signal });
        if (!response.ok) throw new Error('Recherche d’adresse indisponible.');
        const { features = [] } = await response.json();
        resultats.replaceChildren();

        if (!features.length) {
          resultats.textContent = 'Aucune adresse trouvée.';
          return;
        }

        features.forEach((feature) => {
          const label = feature.properties?.label;
          const coordinates = feature.geometry?.coordinates;
          if (!label || !Array.isArray(coordinates) || coordinates.length < 2) return;

          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'adresse-suggestion';
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          option.textContent = label;
          option.addEventListener('click', () => {
            input.dataset.latitude = String(coordinates[1]);
            input.dataset.longitude = String(coordinates[0]);
            input.dataset.codePostal = feature.properties?.postcode || input.value.match(/\d{5}/)?.[0] || '';
            input.dataset.selectionValide = 'true';
            resultats.replaceChildren();
            resultats.hidden = true;
            input.setAttribute('aria-expanded', 'false');
          });
          resultats.appendChild(option);
        });
      } catch (error) {
        if (error.name === 'AbortError') return;
        resultats.textContent = 'Impossible de rechercher cette adresse pour le moment.';
      }
    }, 300);
  });
}

function basculerCarteAdressePoste(posteId, button) {
  const panel = document.getElementById(`carteAdressePoste-${posteId}`);
  const ouverte = panel.hidden;
  panel.hidden = !ouverte;
  button.setAttribute('aria-expanded', String(ouverte));
  button.textContent = ouverte ? 'Masquer la carte de positionnement' : 'Positionner le point sur la carte';
  if (ouverte) initialiserCarteAdressePoste(posteId);
}

function initialiserCarteAdressePoste(posteId) {
  const existante = cartesAdressesPostes.get(posteId);
  if (existante) {
    setTimeout(() => existante.map.invalidateSize(), 0);
    return;
  }

  const poste = state.postes.find((element) => element.id === posteId);
  const latitude = Number(poste?.latitude);
  const longitude = Number(poste?.longitude);
  const coordonneesExistantes = poste?.latitude !== null && poste?.latitude !== undefined
    && poste?.longitude !== null && poste?.longitude !== undefined;
  const positionExistante = coordonneesExistantes
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    ? [latitude, longitude]
    : null;
  const map = L.map(`mapAdressePoste-${posteId}`).setView(positionExistante || [46.6, 2.4], positionExistante ? 16 : 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const entry = { map, marker: null };
  if (positionExistante) {
    entry.marker = L.marker(positionExistante, { draggable: true }).addTo(map);
  }

  const panel = document.getElementById(`carteAdressePoste-${posteId}`);
  const coordonnees = panel.querySelector('.adresse-coordonnees');

  function enregistrerPoint(latlng) {
    const inputAdresse = document.getElementById(`adressePoste-${posteId}`);
    inputAdresse.dataset.latitude = String(latlng.lat);
    inputAdresse.dataset.longitude = String(latlng.lng);
    inputAdresse.dataset.positionManuelle = 'true';
    coordonnees.value = `Point choisi : ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    coordonnees.textContent = coordonnees.value;
  }

  if (entry.marker) entry.marker.on('dragend', () => enregistrerPoint(entry.marker.getLatLng()));
  map.on('click', (event) => {
    if (entry.marker) {
      entry.marker.setLatLng(event.latlng);
    } else {
      entry.marker = L.marker(event.latlng, { draggable: true }).addTo(map);
      entry.marker.on('dragend', () => enregistrerPoint(entry.marker.getLatLng()));
    }
    enregistrerPoint(event.latlng);
  });

  cartesAdressesPostes.set(posteId, entry);
  if (positionExistante) {
    coordonnees.value = `Position actuelle : ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    coordonnees.textContent = coordonnees.value;
  }
  setTimeout(() => map.invalidateSize(), 0);
}

function initialiserRechercheCentrageCarte(input) {
  const resultats = input.nextElementSibling;
  let minuteur = null;
  let requete = null;

  input.addEventListener('input', () => {
    clearTimeout(minuteur);
    requete?.abort();
    const recherche = input.value.trim();
    resultats.replaceChildren();
    if (recherche.length < 3) {
      resultats.hidden = true;
      return;
    }

    resultats.hidden = false;
    resultats.textContent = 'Recherche…';
    minuteur = setTimeout(async () => {
      requete = new AbortController();
      try {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(recherche)}&limit=5`;
        const response = await fetch(url, { signal: requete.signal });
        if (!response.ok) throw new Error('Recherche indisponible');
        const { features = [] } = await response.json();
        resultats.replaceChildren();
        if (!features.length) {
          resultats.textContent = 'Aucun résultat trouvé.';
          return;
        }

        features.forEach((feature) => {
          const label = feature.properties?.label;
          const coordinates = feature.geometry?.coordinates;
          if (!label || !Array.isArray(coordinates) || coordinates.length < 2) return;
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'adresse-suggestion';
          option.setAttribute('role', 'option');
          option.textContent = label;
          option.addEventListener('click', () => {
            const entry = cartesAdressesPostes.get(input.dataset.posteId);
            const position = [coordinates[1], coordinates[0]];
            entry.map.setView(position, feature.properties?.type === 'municipality' ? 13 : 16, { animate: true });
            resultats.replaceChildren();
            resultats.hidden = true;
          });
          resultats.appendChild(option);
        });
      } catch (error) {
        if (error.name === 'AbortError') return;
        resultats.textContent = 'Impossible de rechercher cette adresse pour le moment.';
      }
    }, 300);
  });
}

async function enregistrerAdressePoste(posteId, button) {
  const poste = state.postes.find((element) => element.id === posteId);
  const input = document.getElementById(`adressePoste-${posteId}`);
  const adresse = input?.value.trim() || '';
  if (!poste || !input) return;

  let latitude = null;
  let longitude = null;
  let codePostal = null;
  if (adresse) {
    const adresseInchangee = adresse === input.dataset.adresseInitiale;
    const selectionValide = input.dataset.selectionValide === 'true';
    const positionManuelle = input.dataset.positionManuelle === 'true';
    if (!selectionValide && !adresseInchangee && !positionManuelle) {
      toast('Choisissez une suggestion ou positionnez le point sur la carte.', true);
      input.focus();
      return;
    }

    latitude = Number(positionManuelle || selectionValide ? input.dataset.latitude : input.dataset.latitudeInitiale);
    longitude = Number(positionManuelle || selectionValide ? input.dataset.longitude : input.dataset.longitudeInitiale);
    codePostal = selectionValide
      ? input.dataset.codePostal
      : input.dataset.codePostalInitial || adresse.match(/\d{5}/)?.[0] || null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast('Sélectionnez à nouveau cette adresse dans les suggestions.', true);
      input.focus();
      return;
    }
  }

  button.disabled = true;
  const { error } = await supabase.from('postes_pieges').update({
    adresse: adresse || null,
    latitude,
    longitude,
    code_postal: codePostal || null
  }).eq('id', posteId).eq('user_id', session.user.id);

  button.disabled = false;
  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  poste.adresse = adresse || null;
  poste.latitude = latitude;
  poste.longitude = longitude;
  poste.code_postal = codePostal || null;
  renderPostes();
  toast(adresse ? 'Adresse du poste enregistrée ✓' : 'Adresse du poste supprimée');
}

function normaliserMethodesPoste(methodes) {
  if (!Array.isArray(methodes)) return [];
  const normalisees = methodes
    .filter((methode) => methode && typeof methode.nom === 'string' && methode.nom.trim())
    .map((methode) => ({ nom: methode.nom.trim(), defaut: methode.defaut === true }));
  const indexDefaut = normalisees.findIndex((methode) => methode.defaut);
  if (normalisees.length && indexDefaut === -1) normalisees[0].defaut = true;
  return normalisees.map((methode, index) => ({ ...methode, defaut: index === (indexDefaut === -1 ? 0 : indexDefaut) }));
}

async function enregistrerMethodesPoste(id, methodes) {
  const { error } = await supabase.from('postes_pieges')
    .update({ methodes_piegeage: methodes })
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return false;
  }

  const poste = state.postes.find((element) => element.id === id);
  if (poste) poste.methodes_piegeage = methodes;
  renderPostes();
  return true;
}

async function ajouterMethodePoste(id, input) {
  const nom = input?.value;
  const methodeStandard = (window.CONFIG?.METHODES || []).find((methode) => methode.valeur === nom);
  if (!methodeStandard) {
    toast('Choisissez une méthode dans la liste.', true);
    return;
  }

  const poste = state.postes.find((element) => element.id === id);
  const methodes = normaliserMethodesPoste(poste?.methodes_piegeage);
  if (methodes.some((methode) => methode.nom === methodeStandard.valeur)) {
    toast('Cette méthode existe déjà pour ce poste.', true);
    return;
  }

  methodes.push({ nom: methodeStandard.valeur, defaut: methodes.length === 0 });
  if (await enregistrerMethodesPoste(id, methodes)) toast('Méthode ajoutée ✓');
}

async function definirMethodeDefaut(id, indexDefaut) {
  const poste = state.postes.find((element) => element.id === id);
  const methodes = normaliserMethodesPoste(poste?.methodes_piegeage)
    .map((methode, index) => ({ ...methode, defaut: index === indexDefaut }));
  if (await enregistrerMethodesPoste(id, methodes)) toast('Méthode par défaut mise à jour ✓');
}

async function supprimerMethodePoste(id, indexSuppression) {
  const poste = state.postes.find((element) => element.id === id);
  const methodes = normaliserMethodesPoste(poste?.methodes_piegeage);
  const etaitDefaut = methodes[indexSuppression]?.defaut;
  methodes.splice(indexSuppression, 1);
  if (etaitDefaut && methodes.length) methodes[0].defaut = true;
  if (await enregistrerMethodesPoste(id, methodes)) toast('Méthode supprimée');
}

async function setDefautPoste(id) {
  await supabase.from('postes_pieges').update({ defaut: false }).eq('user_id', session.user.id);
  await supabase.from('postes_pieges').update({ defaut: true }).eq('id', id);

  state.postes.forEach((p) => {
    p.defaut = p.id === id;
  });

  renderPostes();
  toast(UI_MESSAGES.settings.posteDefaultUpdated);
}

function remplirSelectAppat() {
  const sel = document.getElementById('selectAppat');
  if (!sel) return;

  const val = sel.value;
  sel.innerHTML = '<option value="">— choisir —</option>';

  if (!state.appats.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Aucun appât disponible';
    opt.disabled = true;
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }

  sel.disabled = false;

  state.appats.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.type === 'proteine' ? '🥩' : '🍯'} ${a.nom}`;
    if (a.id === val) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function setDefaut(id) {
  await supabase.from('appats').update({ defaut: false }).eq('user_id', session.user.id);
  await supabase.from('appats').update({ defaut: true }).eq('id', id);

  state.appats.forEach((a) => {
    a.defaut = a.id === id;
  });

  renderAppats();
  toast(UI_MESSAGES.settings.appatDefaultUpdated);
}

async function sauvegarderRecette(id) {
  const ta = document.querySelector(`textarea[data-id="${id}"]`);
  if (!ta) return;

  const { error } = await supabase.from('appats').update({ recette: ta.value }).eq('id', id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  const a = state.appats.find((x) => x.id === id);
  if (a) a.recette = ta.value;

  toast(UI_MESSAGES.settings.recipeSaved);
}

async function supprimerAppat(id) {
  if (!confirm(UI_MESSAGES.settings.deleteAppatConfirm)) return;

  const { error } = await supabase.from('appats').delete().eq('id', id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.appats = state.appats.filter((a) => a.id !== id);
  renderAppats();
  renderSuggestions();
  remplirSelectAppat();
  toast(UI_MESSAGES.settings.appatDeleted);
}

async function importerSuggestion(s) {
  const { data, error } = await supabase.from('appats').insert({
    user_id: session.user.id,
    nom: s.nom,
    type: s.type,
    recette: s.recette || '',
    defaut: state.appats.length === 0
  }).select().single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.appats.push(data);
  renderAppats();
  renderSuggestions();
  remplirSelectAppat();
  toast(`"${s.nom}" importé ✓`);
}

async function ajouterAppat() {
  const nom = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOUVEL_APPAT)?.value.trim();
  if (!nom) return;

  const premierDefaut = state.appats.length === 0;
  const { data, error } = await supabase.from('appats').insert({
    user_id: session.user.id,
    nom,
    type: state.typeSelectionneGlobal,
    recette: '',
    defaut: premierDefaut
  }).select().single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.appats.push(data);
  document.getElementById(DOM_IDS.SETTINGS.INPUT_NOUVEL_APPAT).value = '';
  renderAppats();
  renderSuggestions();
  remplirSelectAppat();
  toast(UI_MESSAGES.settings.appatAdded);
}

async function ajouterPoste() {
  const nom = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_POSTE)?.value.trim();

  if (!nom) {
    toast(UI_MESSAGES.settings.requireName, true);
    return;
  }

  const premierDefaut = state.postes.length === 0;
  const { data, error } = await supabase.from('postes_pieges').insert({
    user_id: session.user.id,
    nom,
    type_piege: '',
    nombre: 1,
    methodes_piegeage: [],
    actif: true,
    defaut: premierDefaut
  }).select('*').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.postes.push(data);
  document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_POSTE).value = '';
  renderPostes();
  toast(UI_MESSAGES.settings.posteAdded);
}

async function togglePoste(id, estActif) {
  const { error } = await supabase.from('postes_pieges').update({ actif: !estActif }).eq('id', id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  const p = state.postes.find((x) => x.id === id);
  if (p) p.actif = !estActif;

  renderPostes();
  toast(estActif ? UI_MESSAGES.settings.posteDeactivated : UI_MESSAGES.settings.posteActivated);
}

async function supprimerPoste(id) {
  if (!confirm(UI_MESSAGES.settings.deletePosteConfirm)) return;

  const { error } = await supabase.from('postes_pieges').delete().eq('id', id);

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.postes = state.postes.filter((p) => p.id !== id);
  renderPostes();
  toast(UI_MESSAGES.settings.posteDeleted);
}

function bindStaticEvents() {
  const inputNomRucher = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_RUCHER);
  const inputNouvelAppat = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOUVEL_APPAT);
  const inputNomPoste = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_POSTE);
  const selectAnneeRegistre = document.getElementById('registreGlobalAnnee');
  const boutonTelechargerRegistre = document.getElementById('btnTelechargerRegistreGlobal');

  if (selectAnneeRegistre) {
    const anneeActuelle = new Date().getFullYear();
    for (let annee = anneeActuelle + 1; annee >= anneeActuelle - 5; annee -= 1) {
      selectAnneeRegistre.add(new Option(String(annee), String(annee), false, annee === anneeActuelle));
    }
  }

  boutonTelechargerRegistre?.addEventListener('click', async () => {
    if (!state.ruchers.length) {
      toast('Ajoutez un rucher avant de télécharger le registre.', true);
      return;
    }

    boutonTelechargerRegistre.disabled = true;
    boutonTelechargerRegistre.setAttribute('aria-busy', 'true');
    boutonTelechargerRegistre.querySelector('.registre-download-label').textContent = 'Préparation du PDF…';
    try {
      const { telechargerRegistreComplet } = await import('./registreElevage.js');
      await telechargerRegistreComplet(
        state.ruchers,
        state.traitements,
        state.pertes,
        Number(selectAnneeRegistre.value)
      );
    } catch (error) {
      console.error('Erreur téléchargement du registre:', error);
      toast('Impossible de télécharger le registre.', true);
    } finally {
      boutonTelechargerRegistre.disabled = false;
      boutonTelechargerRegistre.removeAttribute('aria-busy');
      boutonTelechargerRegistre.querySelector('.registre-download-label').textContent = 'Télécharger le PDF';
    }
  });

  document.getElementById(DOM_IDS.SETTINGS.BTN_TYPE_SUCRE)?.addEventListener('click', () => selectType('sucre'));
  document.getElementById(DOM_IDS.SETTINGS.BTN_TYPE_PROTEINE)?.addEventListener('click', () => selectType('proteine'));
  document.getElementById(DOM_IDS.SETTINGS.BTN_AJOUTER_APPAT)?.addEventListener('click', ajouterAppat);
  document.getElementById(DOM_IDS.SETTINGS.BTN_AJOUTER_POSTE)?.addEventListener('click', ajouterPoste);
  document.getElementById(DOM_IDS.SETTINGS.BTN_AJOUTER_RUCHER)?.addEventListener('click', ajouterRucher);

  inputNomRucher?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ajouterRucher();
  });

  inputNouvelAppat?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ajouterAppat();
  });

  inputNomPoste?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ajouterPoste();
  });
}


async function initSettingsPage() {
  const { session: currentSession } = await initUserBar({ elementId: DOM_IDS.USER_BAR });
  session = currentSession;

  if (!session) {
    const suiviRucherAuth = document.getElementById('suiviRucherAuth');
    const suiviRucherSection = document.getElementById(DOM_IDS.SETTINGS.LIST_RUCHERS)?.closest('.settings-section');
    const registreGlobalSection = document.querySelector('.registre-global-section');
    if (suiviRucherAuth) suiviRucherAuth.style.display = '';
    if (suiviRucherSection) suiviRucherSection.style.display = 'none';
    if (registreGlobalSection) registreGlobalSection.style.display = 'none';
    return;
  }

  bindStaticEvents();
  selectType('sucre');
  await chargerCausesPertes();
  await chargerListeTraitements();
  if (document.getElementById(DOM_IDS.SETTINGS.LIST_RUCHERS)) {
    await Promise.all([chargerRuchers(), chargerTraitements(), chargerPertes()]);
  } else {
    await Promise.all([chargerAppats(), chargerSuggestions()]);
    await chargerPostes();
  }
}

initSettingsPage();
