import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { DOM_IDS, UI_MESSAGES } from '../constants.js';
import { escapeHtml } from '../utils/escape.js';

const state = {
  ruchers: [],
  traitements: [],
  pertes: [],
  appats: [],
  postes: [],
  suggDef: [],
  typeSelectionneGlobal: 'sucre'
};

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
    list.innerHTML = '<p class="empty">Aucun rucher. Ajoutez-en un ci-dessous.</p>';
    return;
  }

  state.ruchers.forEach((rucher) => {
    const card = document.createElement('div');
    card.className = 'rucher-card';
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
      <div class="pertes-panel">
        <strong>Pertes de colonies</strong>
        <div class="pertes-list">
          ${pertes.length
            ? pertes.map((perte) => `
              <div class="perte-row">
                <div class="perte-content">
                  <strong>${escapeHtml(perte.colonie)}</strong>
                  <small>Constat : ${afficherDate(perte.date_constat)}</small>
                  <span><b>Cause :</b> ${escapeHtml(perte.cause_probable)}</span>
                  <span><b>État :</b> ${escapeHtml(perte.etat)}</span>
                  <span><b>Mesures :</b> ${escapeHtml(perte.mesures)}</span>
                </div>
                <button class="btn-rm btn-rm-perte" data-id="${perte.id}" title="Supprimer">✕</button>
              </div>
            `).join('')
            : '<span class="pertes-empty">Aucune perte enregistrée</span>'}
        </div>
        <div class="perte-form">
          <input type="date" class="input-date-perte" data-rucher-id="${rucher.id}" title="Date de constat">
          <input type="text" class="input-colonie-perte" data-rucher-id="${rucher.id}" placeholder="Colonie (ex. R003)" maxlength="40">
          <input type="text" class="input-cause-perte" data-rucher-id="${rucher.id}" placeholder="Cause probable" maxlength="160">
          <input type="text" class="input-etat-perte" data-rucher-id="${rucher.id}" placeholder="État de la colonie" maxlength="160">
          <input type="text" class="input-mesures-perte" data-rucher-id="${rucher.id}" placeholder="Mesures prises" maxlength="200">
          <button type="button" class="btn-add btn-ajouter-perte" data-rucher-id="${rucher.id}">＋ Ajouter</button>
        </div>
      </div>
      <div class="traitements-panel">
        <strong>Traitements chimiques</strong>
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
          <input type="text" class="input-intitule-traitement" data-rucher-id="${rucher.id}" placeholder="Intitulé du traitement" maxlength="100">
          <input type="date" class="input-date-traitement" data-rucher-id="${rucher.id}" value="${new Date().toISOString().slice(0, 10)}">
          <button type="button" class="btn-add btn-ajouter-traitement" data-rucher-id="${rucher.id}">＋ Ajouter</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.rucher-header .btn-rm').forEach((btn) => {
    btn.addEventListener('click', () => supprimerRucher(btn.dataset.id));
  });

  list.querySelectorAll('.input-nombre-ruches, .input-nombre-ruchettes').forEach((input) => {
    input.addEventListener('change', () => modifierEffectifRucher(
      input.dataset.rucherId,
      input.classList.contains('input-nombre-ruches') ? 'nombre_ruches' : 'nombre_ruchettes',
      input.value
    ));
  });

  list.querySelectorAll('.sante-option').forEach((button) => {
    button.addEventListener('click', () => modifierEtatSante(
      button.dataset.rucherId,
      button.dataset.etatSante,
      1
    ));
  });

  list.querySelectorAll('.sante-decrement').forEach((button) => {
    button.addEventListener('click', () => modifierEtatSante(
      button.dataset.rucherId,
      button.dataset.etatSante,
      -1
    ));
  });

  list.querySelectorAll('.btn-rm-traitement').forEach((btn) => {
    btn.addEventListener('click', () => supprimerTraitement(btn.dataset.id));
  });

  list.querySelectorAll('.btn-rm-perte').forEach((btn) => {
    btn.addEventListener('click', () => supprimerPerte(btn.dataset.id));
  });

  list.querySelectorAll('.input-changement-lanieres, .input-retrait-lanieres').forEach((input) => {
    input.addEventListener('change', () => modifierDateRappel(
      input.dataset.id,
      input.classList.contains('input-changement-lanieres') ? 'changement' : 'retrait',
      input.value
    ));
  });

  list.querySelectorAll('.check-etape-traitement').forEach((checkbox) => {
    checkbox.addEventListener('change', () => modifierEtapeTraitement(
      checkbox.dataset.id,
      checkbox.dataset.etape,
      checkbox.checked
    ));
  });

  list.querySelectorAll('.btn-ajouter-traitement').forEach((btn) => {
    btn.addEventListener('click', () => ajouterTraitement(btn.dataset.rucherId));
  });

  list.querySelectorAll('.btn-ajouter-perte').forEach((btn) => {
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
  const dateConstat = valeur('.input-date-perte');
  const colonie = valeur('.input-colonie-perte');
  const causeProbable = valeur('.input-cause-perte');
  const etat = valeur('.input-etat-perte');
  const mesures = valeur('.input-mesures-perte');

  if (!dateConstat || !colonie || !causeProbable || !etat || !mesures) {
    toast('Indiquez la date, la colonie, la cause, l’état et les mesures', true);
    return;
  }

  const { data, error } = await supabase.from('pertes_colonies').insert({
    user_id: session.user.id,
    rucher_id: rucherId,
    date_constat: dateConstat,
    colonie,
    cause_probable: causeProbable,
    etat,
    mesures
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

  list.innerHTML = '';

  if (!state.postes.length) {
    list.innerHTML = '<p class="empty">Aucun poste. Ajoutez-en un ci-dessous. Si vous n’avez pas encore d’appât, commencez par créer un appât.</p>';
    return;
  }

  state.postes.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'poste-card' + (p.actif ? '' : ' inactif');

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
      <div class="poste-details">
        <span>🪤 ${escapeHtml(p.type_piege || '—')}</span>
        <span>× ${p.nombre} piège(s)</span>
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
  const typePiege = document.getElementById(DOM_IDS.SETTINGS.INPUT_TYPE_PIEGE)?.value.trim();
  const nombre = parseInt(document.getElementById(DOM_IDS.SETTINGS.INPUT_NOMBRE_POSTES)?.value, 10) || 1;

  if (!nom) {
    toast(UI_MESSAGES.settings.requireName, true);
    return;
  }

  const premierDefaut = state.postes.length === 0;
  const { data, error } = await supabase.from('postes_pieges').insert({
    user_id: session.user.id,
    nom,
    type_piege: typePiege,
    nombre,
    actif: true,
    defaut: premierDefaut
  }).select('*').single();

  if (error) {
    toast('Erreur : ' + error.message, true);
    return;
  }

  state.postes.push(data);
  document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_POSTE).value = '';
  document.getElementById(DOM_IDS.SETTINGS.INPUT_TYPE_PIEGE).value = '';
  document.getElementById(DOM_IDS.SETTINGS.INPUT_NOMBRE_POSTES).value = 1;
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
    if (suiviRucherAuth) suiviRucherAuth.style.display = '';
    if (suiviRucherSection) suiviRucherSection.style.display = 'none';
    return;
  }

  bindStaticEvents();
  selectType('sucre');
  if (document.getElementById(DOM_IDS.SETTINGS.LIST_RUCHERS)) {
    await Promise.all([chargerRuchers(), chargerTraitements(), chargerPertes()]);
  } else {
    await Promise.all([chargerAppats(), chargerSuggestions()]);
    await chargerPostes();
  }
}

initSettingsPage();
