import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';
import { chargerAppellationsMiellerie } from '../utils/appellationsMiellerie.js';

const TAILLES_POTS_STANDARD = [250, 500, 1000];
const state = { session: null, ruchers: [], recoltes: [], taillesPots: [...TAILLES_POTS_STANDARD] };
const form = document.getElementById('miellerieForm');
const list = document.getElementById('harvestList');
const toastElement = document.getElementById('toast');

function toast(message, error = false) {
  toastElement.textContent = error ? `⚠ ${message}` : `✓ ${message}`;
  toastElement.style.borderColor = error ? 'var(--danger)' : 'var(--yellow)';
  toastElement.style.color = error ? 'var(--danger)' : 'var(--yellow)';
  toastElement.classList.add('show');
  setTimeout(() => toastElement.classList.remove('show'), 3000);
}

function formaterNombre(nombre) {
  return new Intl.NumberFormat('fr-FR').format(nombre);
}

function formaterDate(date) {
  if (!date) return '—';
  const [annee, mois, jour] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR').format(new Date(annee, mois - 1, jour));
}

function libelleTaillePot(taille) {
  return taille === 1000 ? '1 kg (1000 g)' : `${formaterNombre(taille)} g`;
}

async function chargerTaillesPots() {
  const select = document.getElementById('jarSize');
  const { data, error } = await supabase
    .from('miellerie_tailles_pots')
    .select('taille_pot_g')
    .eq('user_id', state.session.user.id)
    .order('taille_pot_g');

  if (error) {
    console.error('Erreur chargement des formats de pots:', error);
    toast('Formats standards affichés. Les formats personnalisés nécessitent le script SQL miellerie à jour.', true);
  } else {
    const personnalisées = (data || []).map((item) => item.taille_pot_g);
    state.taillesPots = [...new Set([...TAILLES_POTS_STANDARD, ...personnalisées])].sort((a, b) => a - b);
  }

  select.replaceChildren();
  state.taillesPots.forEach((taille) => {
    const option = document.createElement('option');
    option.value = taille;
    option.textContent = libelleTaillePot(taille);
    option.defaultSelected = taille === 500;
    select.appendChild(option);
  });
}

async function chargerAppellations() {
  const select = document.getElementById('harvestAppellation');
  const { appellations, error } = await chargerAppellationsMiellerie(supabase, state.session.user.id);
  if (error) toast('Appellations par défaut affichées. Exécutez le SQL miellerie pour les gérer.', true);

  select.replaceChildren(new Option('Sans appellation', ''));
  appellations.forEach((appellation) => select.add(new Option(appellation, appellation)));
}

async function chargerRuchers() {
  const { data, error } = await supabase
    .from('ruchers')
    .select('id, nom')
    .eq('user_id', state.session.user.id)
    .order('nom');

  if (error) {
    console.error('Erreur chargement des ruchers pour la miellerie:', error);
    document.getElementById('miellerieApiaries').textContent = 'Impossible de charger les ruchers.';
    return;
  }

  state.ruchers = data || [];
  const options = document.getElementById('miellerieApiaries');
  options.replaceChildren();

  if (!state.ruchers.length) {
    const empty = document.createElement('span');
    empty.className = 'miellerie-no-apiaries';
    empty.textContent = 'Aucun rucher. Vous pouvez ajouter une récolte sans le lier à un rucher.';
    options.appendChild(empty);
    return;
  }

  state.ruchers.forEach((rucher) => {
    const label = document.createElement('label');
    label.className = 'miellerie-apiary-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'harvestApiary';
    checkbox.value = rucher.id;
    label.append(checkbox, document.createTextNode(rucher.nom));
    options.appendChild(label);
  });
}

async function chargerRecoltes() {
  const { data, error } = await supabase
    .from('miellerie_recoltes')
    .select('*')
    .eq('user_id', state.session.user.id)
    .order('annee')
    .order('date_recolte');

  if (error) {
    console.error('Erreur chargement des récoltes:', error);
    list.innerHTML = '<p class="miellerie-empty">Impossible de charger les récoltes. Vérifiez que le script SQL de la miellerie a été exécuté dans Supabase.</p>';
    return;
  }

  state.recoltes = data || [];
  if (state.recoltes.length) {
    const { data: associations, error: erreurAssociations } = await supabase
      .from('miellerie_recoltes_ruchers')
      .select('recolte_id, rucher_id')
      .in('recolte_id', state.recoltes.map((recolte) => recolte.id));

    if (erreurAssociations) {
      console.error('Erreur chargement des ruchers associés aux récoltes:', erreurAssociations);
      toast('Les ruchers associés n’ont pas pu être chargés.', true);
    } else {
      const associationsParRecolte = new Map();
      (associations || []).forEach(({ recolte_id, rucher_id }) => {
        if (!associationsParRecolte.has(recolte_id)) associationsParRecolte.set(recolte_id, []);
        associationsParRecolte.get(recolte_id).push(rucher_id);
      });
      state.recoltes.forEach((recolte) => {
        recolte.rucherIds = associationsParRecolte.get(recolte.id) || [];
      });
    }
  }

  afficherRecoltes();
}

function afficherRecoltes() {
  list.replaceChildren();
  if (!state.recoltes.length) {
    const empty = document.createElement('p');
    empty.className = 'miellerie-empty';
    empty.textContent = 'Aucune récolte enregistrée pour le moment.';
    list.appendChild(empty);
    return;
  }

  const recoltesParAnnee = new Map();
  state.recoltes.forEach((recolte) => {
    if (!recoltesParAnnee.has(recolte.annee)) recoltesParAnnee.set(recolte.annee, []);
    recoltesParAnnee.get(recolte.annee).push(recolte);
  });

  [...recoltesParAnnee.keys()].sort((a, b) => a - b).forEach((annee) => {
    const section = document.createElement('section');
    section.className = 'miellerie-year';
    const heading = document.createElement('h4');
    heading.textContent = String(annee);
    section.appendChild(heading);

    const scroller = document.createElement('div');
    scroller.className = 'miellerie-table-scroll';
    const table = document.createElement('table');
    table.className = 'miellerie-table';
    table.innerHTML = `
      <thead><tr>
        <th scope="col">Date de récolte</th>
        <th scope="col">Date de mise en pot</th>
        <th scope="col">Goût</th>
        <th scope="col">Appellation</th>
        <th scope="col">Rucher(s)</th>
        <th scope="col">Nom ruche</th>
        <th scope="col">Taille pot</th>
        <th scope="col">Quantité</th>
        <th scope="col">Total (kg)</th>
        <th scope="col">Reste (pots)</th>
        <th scope="col"><span class="visually-hidden">Actions</span></th>
      </tr></thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    let totalAnnee = 0;
    recoltesParAnnee.get(annee).forEach((recolte) => {
      const total = recolte.taille_pot_g * recolte.quantite;
      totalAnnee += total;
      const nomsRuchers = state.ruchers
        .filter((rucher) => (recolte.rucherIds || []).includes(rucher.id))
        .map((rucher) => rucher.nom);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formaterDate(recolte.date_recolte)}${!recolte.date_recolte && recolte.periode ? `<small class="miellerie-legacy-period">Ancienne période : ${escapeHtml(recolte.periode)}</small>` : ''}</td>
        <td>${formaterDate(recolte.date_mise_en_pot)}</td>
        <td>${(recolte.gout || recolte.commentaire) ? escapeHtml(recolte.gout || recolte.commentaire) : '<span class="miellerie-muted">—</span>'}</td>
        <td>${recolte.appellation ? escapeHtml(recolte.appellation) : '<span class="miellerie-muted">—</span>'}</td>
        <td>${nomsRuchers.length ? nomsRuchers.map(escapeHtml).join(', ') : '<span class="miellerie-muted">—</span>'}</td>
        <td>${recolte.nom_ruche ? escapeHtml(recolte.nom_ruche) : '<span class="miellerie-muted">—</span>'}</td>
        <td>${formaterNombre(recolte.taille_pot_g)} g</td>
        <td>${formaterNombre(recolte.quantite)}</td>
        <td class="miellerie-total-cell">${(total / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg</td>
        <td><input class="miellerie-remaining" type="number" min="0" max="${recolte.quantite}" step="1" value="${recolte.reste}" data-id="${recolte.id}" aria-label="Pots restants pour la récolte du ${formaterDate(recolte.date_recolte)}"></td>
        <td><button type="button" class="btn-rm miellerie-delete" data-id="${recolte.id}" aria-label="Supprimer la récolte du ${formaterDate(recolte.date_recolte)}" title="Supprimer">✕</button></td>
      `;
      tbody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    totalRow.className = 'miellerie-year-total';
    totalRow.innerHTML = `<th scope="row" colspan="8">Total ${annee}</th><td>${(totalAnnee / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg</td><td colspan="2"></td>`;
    tbody.appendChild(totalRow);
    scroller.appendChild(table);
    section.appendChild(scroller);
    list.appendChild(section);
  });

  list.querySelectorAll('.miellerie-remaining').forEach((input) => {
    input.addEventListener('change', () => modifierReste(input));
  });
  list.querySelectorAll('.miellerie-delete').forEach((button) => {
    button.addEventListener('click', () => supprimerRecolte(button.dataset.id));
  });
}

async function ajouterRecolte(event) {
  event.preventDefault();
  const dateRecolte = document.getElementById('harvestDate').value;
  const dateMiseEnPot = document.getElementById('pottingDate').value;
  const annee = dateRecolte ? Number(dateRecolte.slice(0, 4)) : NaN;
  const nomRuche = document.getElementById('harvestHive').value.trim();
  const gout = document.getElementById('harvestTaste').value.trim();
  const appellation = document.getElementById('harvestAppellation').value;
  const taillePot = Number(document.getElementById('jarSize').value);
  const quantite = Number(document.getElementById('jarQuantity').value);
  const reste = quantite;
  const rucherIds = [...document.querySelectorAll('input[name="harvestApiary"]:checked')].map((input) => input.value);

  if (!dateRecolte || !Number.isInteger(annee) || annee < 1900 || annee > 2100
      || !dateMiseEnPot || dateMiseEnPot < dateRecolte
      || !Number.isInteger(taillePot) || taillePot < 1
      || !Number.isInteger(quantite) || quantite < 1
      || !Number.isInteger(reste) || reste < 0 || reste > quantite) {
    toast('Vérifiez les champs et les dates. La mise en pot ne peut pas précéder la récolte.', true);
    return;
  }

  const submitButton = document.getElementById('addHarvest');
  submitButton.disabled = true;
  const { data: recolte, error } = await supabase
    .from('miellerie_recoltes')
    .insert({
      user_id: state.session.user.id,
      annee,
      date_recolte: dateRecolte,
      date_mise_en_pot: dateMiseEnPot,
      nom_ruche: nomRuche,
      gout,
      appellation,
      taille_pot_g: taillePot,
      quantite,
      reste
    })
    .select('*')
    .single();

  if (error) {
    submitButton.disabled = false;
    console.error('Erreur enregistrement de la récolte:', error);
    toast('Impossible d’enregistrer la récolte.', true);
    return;
  }

  if (rucherIds.length) {
    const { error: erreurAssociations } = await supabase
      .from('miellerie_recoltes_ruchers')
      .insert(rucherIds.map((rucher_id) => ({ recolte_id: recolte.id, rucher_id })));

    if (erreurAssociations) {
      await supabase.from('miellerie_recoltes').delete().eq('id', recolte.id).eq('user_id', state.session.user.id);
      submitButton.disabled = false;
      console.error('Erreur association des ruchers à la récolte:', erreurAssociations);
      toast('La récolte n’a pas pu être liée aux ruchers sélectionnés.', true);
      return;
    }
    recolte.rucherIds = rucherIds;
  } else {
    recolte.rucherIds = [];
  }

  state.recoltes.push(recolte);
  state.recoltes.sort((a, b) => a.date_recolte.localeCompare(b.date_recolte));
  form.reset();
  document.getElementById('jarQuantity').value = 1;
  afficherRecoltes();
  submitButton.disabled = false;
  toast('Ligne de récolte ajoutée.');
}

async function modifierReste(input) {
  const recolte = state.recoltes.find((item) => item.id === input.dataset.id);
  const reste = Number(input.value);
  if (!recolte || !Number.isInteger(reste) || reste < 0 || reste > recolte.quantite) {
    toast('Le stock restant doit être compris entre 0 et la quantité récoltée.', true);
    input.value = recolte?.reste ?? 0;
    return;
  }

  input.disabled = true;
  const { error } = await supabase
    .from('miellerie_recoltes')
    .update({ reste })
    .eq('id', recolte.id)
    .eq('user_id', state.session.user.id);

  input.disabled = false;
  if (error) {
    console.error('Erreur mise à jour du stock restant:', error);
    input.value = recolte.reste;
    toast('Impossible de mettre à jour le stock restant.', true);
    return;
  }

  recolte.reste = reste;
  toast('Stock restant mis à jour.');
}

async function supprimerRecolte(id) {
  if (!confirm('Supprimer cette ligne de récolte ?')) return;
  const { error } = await supabase
    .from('miellerie_recoltes')
    .delete()
    .eq('id', id)
    .eq('user_id', state.session.user.id);

  if (error) {
    console.error('Erreur suppression de la récolte:', error);
    toast('Impossible de supprimer cette ligne.', true);
    return;
  }

  state.recoltes = state.recoltes.filter((recolte) => recolte.id !== id);
  afficherRecoltes();
  toast('Ligne de récolte supprimée.');
}

async function initPage() {
  const { session } = await initUserBar({ elementId: 'userBar' });
  state.session = session;
  if (!session) {
    document.getElementById('miellerieAuth').style.display = '';
    document.getElementById('miellerieEntrySection').style.display = 'none';
    document.getElementById('harvestList').style.display = 'none';
    return;
  }

  form.addEventListener('submit', ajouterRecolte);
  await Promise.all([chargerRuchers(), chargerRecoltes(), chargerTaillesPots(), chargerAppellations()]);
}

initPage();