import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { APP_PATHS, DOM_IDS, UI_MESSAGES } from '../constants.js';
import { escapeHtml } from '../utils/escape.js';

const state = {
  appats: [],
  postes: [],
  suggDef: [],
  typeSelectionneGlobal: 'sucre'
};

let session = null;

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
  const inputNouvelAppat = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOUVEL_APPAT);
  const inputNomPoste = document.getElementById(DOM_IDS.SETTINGS.INPUT_NOM_POSTE);

  document.getElementById(DOM_IDS.SETTINGS.BTN_TYPE_SUCRE)?.addEventListener('click', () => selectType('sucre'));
  document.getElementById(DOM_IDS.SETTINGS.BTN_TYPE_PROTEINE)?.addEventListener('click', () => selectType('proteine'));
  document.querySelector('.btn-add')?.addEventListener('click', ajouterAppat);
  document.querySelector('.btn-add.ml-auto')?.addEventListener('click', ajouterPoste);

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
    window.location.href = APP_PATHS.LOGIN;
    return;
  }

  bindStaticEvents();
  selectType('sucre');
  await Promise.all([chargerAppats(), chargerSuggestions()]);
  await chargerPostes();
}

initSettingsPage();
