import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';
import { chargerAppellationsMiellerie } from '../utils/appellationsMiellerie.js';

const TAILLES_POTS_STANDARD = [250, 500, 1000];
const state = {
  session: null,
  ruchers: [],
  recoltes: [],
  taillesPots: [...TAILLES_POTS_STANDARD],
  appellations: [],
  recolteEnEditionId: null,
  recoltesEnEditionIds: []
};
const form = document.getElementById('miellerieForm');
const toggleFormButton = document.getElementById('toggleHarvestForm');
const list = document.getElementById('harvestList');
const toastElement = document.getElementById('toast');
let harvestYearChart = null;

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

function trierRecoltesRecentes(a, b) {
  if (a.annee !== b.annee) return b.annee - a.annee;
  if (!a.date_recolte) return b.date_recolte ? 1 : 0;
  if (!b.date_recolte) return -1;
  return b.date_recolte.localeCompare(a.date_recolte);
}

function cleGroupeRecolte(recolte) {
  return recolte.groupe_id || recolte.id;
}

function afficherGraphiqueRecoltes() {
  const poidsParAnnee = new Map();
  state.recoltes.forEach((recolte) => {
    const poidsKg = (Number(recolte.taille_pot_g) * Number(recolte.quantite)) / 1000;
    poidsParAnnee.set(recolte.annee, (poidsParAnnee.get(recolte.annee) || 0) + poidsKg);
  });

  const annees = [...poidsParAnnee.keys()].sort((a, b) => a - b);
  const canvas = document.getElementById('harvestYearChart');
  if (harvestYearChart) harvestYearChart.destroy();
  harvestYearChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: annees.map(String),
      datasets: [{
        label: 'Miel récolté (kg)',
        data: annees.map((annee) => Number(poidsParAnnee.get(annee).toFixed(3))),
        backgroundColor: 'rgba(74, 157, 143, 0.72)',
        borderColor: '#397f74',
        borderWidth: 1,
        borderRadius: 3,
        maxBarThickness: 42
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Année' },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Poids récolté (kg)' },
          ticks: { callback: (value) => `${value} kg` }
        }
      }
    }
  });
}

function definirFormulaireOuvert(ouvert) {
  form.hidden = !ouvert;
  toggleFormButton.setAttribute('aria-expanded', String(ouvert));
  toggleFormButton.innerHTML = ouvert
    ? '<span aria-hidden="true">−</span> Fermer'
    : '<span aria-hidden="true">＋</span> Nouvelle récolte';

  if (ouvert) {
    document.getElementById('harvestDate').focus();
  }
}

function libelleTaillePot(taille) {
  return taille === 1000 ? '1 kg (1000 g)' : `${formaterNombre(taille)} g`;
}

function ajouterLigneConditionnement(taille = 500, quantite = 1, recolteId = '') {
  const rows = document.getElementById('packagingRows');
  const row = document.createElement('div');
  row.className = 'miellerie-packaging-row';
  if (recolteId) row.dataset.recolteId = recolteId;

  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = 'Taille du pot';
  const sizeSelect = document.createElement('select');
  sizeSelect.className = 'miellerie-jar-size';
  sizeSelect.required = true;
  state.taillesPots.forEach((value) => {
    sizeSelect.add(new Option(libelleTaillePot(value), String(value), false, value === Number(taille)));
  });
  if (!state.taillesPots.includes(Number(taille))) {
    sizeSelect.add(new Option(libelleTaillePot(Number(taille)), String(taille), false, true));
  }
  sizeLabel.appendChild(sizeSelect);

  const quantityLabel = document.createElement('label');
  quantityLabel.textContent = 'Quantité de pots';
  const quantityInput = document.createElement('input');
  quantityInput.className = 'miellerie-jar-quantity';
  quantityInput.type = 'number';
  quantityInput.min = '1';
  quantityInput.max = '100000';
  quantityInput.step = '1';
  quantityInput.required = true;
  quantityInput.value = String(quantite);
  quantityLabel.appendChild(quantityInput);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'miellerie-remove-size';
  removeButton.textContent = '×';
  removeButton.title = 'Retirer cette contenance';
  removeButton.setAttribute('aria-label', 'Retirer cette contenance');
  removeButton.addEventListener('click', () => {
    row.remove();
    actualiserLignesConditionnement();
  });

  row.append(sizeLabel, quantityLabel, removeButton);
  rows.appendChild(row);
  actualiserLignesConditionnement();
}

function actualiserLignesConditionnement() {
  const rows = [...document.querySelectorAll('.miellerie-packaging-row')];
  rows.forEach((row) => {
    row.querySelector('.miellerie-remove-size').hidden = rows.length <= 1
      || state.recoltesEnEditionIds.includes(row.dataset.recolteId);
  });
  document.getElementById('addPackagingRow').hidden = false;
}

function reinitialiserConditionnements() {
  document.getElementById('packagingRows').replaceChildren();
  ajouterLigneConditionnement(500, 1);
}

function lireConditionnements() {
  return [...document.querySelectorAll('.miellerie-packaging-row')].map((row) => ({
    taillePot: Number(row.querySelector('.miellerie-jar-size').value),
    quantite: Number(row.querySelector('.miellerie-jar-quantity').value)
  }));
}

async function chargerTaillesPots() {
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

  const lignesActuelles = lireConditionnements();
  document.getElementById('packagingRows').replaceChildren();
  (lignesActuelles.length ? lignesActuelles : [{ taillePot: 500, quantite: 1 }])
    .forEach(({ taillePot, quantite }) => ajouterLigneConditionnement(taillePot, quantite));
}

async function chargerAppellations() {
  const select = document.getElementById('harvestAppellation');
  const { appellations, error } = await chargerAppellationsMiellerie(supabase, state.session.user.id);
  if (error) toast('Appellations par défaut affichées. Exécutez le SQL miellerie pour les gérer.', true);

  state.appellations = appellations;
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
    .order('annee', { ascending: false })
    .order('date_recolte', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Erreur chargement des récoltes:', error);
    list.innerHTML = '<p class="miellerie-empty">Impossible de charger les récoltes. Vérifiez que le script SQL de la miellerie a été exécuté dans Supabase.</p>';
    return;
  }

  state.recoltes = (data || []).sort(trierRecoltesRecentes);
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
  afficherGraphiqueRecoltes();
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
    if (!recoltesParAnnee.has(recolte.annee)) recoltesParAnnee.set(recolte.annee, new Map());
    const groupesAnnee = recoltesParAnnee.get(recolte.annee);
    const groupeId = cleGroupeRecolte(recolte);
    if (!groupesAnnee.has(groupeId)) groupesAnnee.set(groupeId, []);
    groupesAnnee.get(groupeId).push(recolte);
  });

  [...recoltesParAnnee.keys()].sort((a, b) => b - a).forEach((annee) => {
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
        <th scope="col">Actions</th>
      </tr></thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    let totalAnnee = 0;
    recoltesParAnnee.get(annee).forEach((lignes, groupeId) => {
      const recolte = lignes[0];
      const rucherIds = [...new Set(lignes.flatMap((ligne) => ligne.rucherIds || []))];
      const nomsRuchers = state.ruchers
        .filter((rucher) => rucherIds.includes(rucher.id))
        .map((rucher) => rucher.nom);

      lignes.forEach((ligne, index) => {
        const total = ligne.taille_pot_g * ligne.quantite;
        totalAnnee += total;
        const row = document.createElement('tr');
        const rowspan = lignes.length > 1 ? ` rowspan="${lignes.length}"` : '';
        row.innerHTML = `${index === 0 ? `
          <td${rowspan}>${formaterDate(recolte.date_recolte)}${!recolte.date_recolte && recolte.periode ? `<small class="miellerie-legacy-period">Ancienne période : ${escapeHtml(recolte.periode)}</small>` : ''}</td>
          <td${rowspan}>${formaterDate(recolte.date_mise_en_pot)}</td>
          <td${rowspan}>${(recolte.gout || recolte.commentaire) ? escapeHtml(recolte.gout || recolte.commentaire) : '<span class="miellerie-muted">—</span>'}</td>
          <td${rowspan}>${recolte.appellation ? escapeHtml(recolte.appellation) : '<span class="miellerie-muted">—</span>'}</td>
          <td${rowspan}>${nomsRuchers.length ? nomsRuchers.map(escapeHtml).join(', ') : '<span class="miellerie-muted">—</span>'}</td>
          <td${rowspan}>${recolte.nom_ruche ? escapeHtml(recolte.nom_ruche) : '<span class="miellerie-muted">—</span>'}</td>
        ` : ''}
          <td>${formaterNombre(ligne.taille_pot_g)} g</td>
          <td>${formaterNombre(ligne.quantite)}</td>
          <td class="miellerie-total-cell">${(total / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg</td>
          <td><input class="miellerie-remaining" type="number" min="0" max="${ligne.quantite}" step="1" value="${ligne.reste}" data-id="${ligne.id}" aria-label="Pots restants pour la récolte du ${formaterDate(recolte.date_recolte)} en pots de ${ligne.taille_pot_g} g"></td>
          ${index === 0 ? `<td rowspan="${lignes.length}"><div class="miellerie-row-actions">
            <button type="button" class="miellerie-edit" data-id="${groupeId}" aria-label="Modifier la récolte du ${formaterDate(recolte.date_recolte)}" title="Modifier">Modifier</button>
            <button type="button" class="btn-rm miellerie-delete" data-id="${groupeId}" aria-label="Supprimer la récolte du ${formaterDate(recolte.date_recolte)}" title="Supprimer">✕</button>
          </div></td>` : ''}
        `;
        tbody.appendChild(row);
      });
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
  list.querySelectorAll('.miellerie-edit').forEach((button) => {
    button.addEventListener('click', () => commencerEdition(button.dataset.id));
  });
}

function commencerEdition(id) {
  const lignesRecolte = state.recoltes.filter((item) => cleGroupeRecolte(item) === id);
  const recolte = lignesRecolte[0];
  if (!recolte) return;

  state.recolteEnEditionId = id;
  state.recoltesEnEditionIds = lignesRecolte.map((ligne) => ligne.id);
  document.getElementById('harvestFormTitle').textContent = 'Modifier la récolte';
  document.getElementById('harvestDate').value = recolte.date_recolte || '';
  document.getElementById('pottingDate').value = recolte.date_mise_en_pot || '';
  document.getElementById('harvestHive').value = recolte.nom_ruche || '';
  document.getElementById('harvestTaste').value = recolte.gout || recolte.commentaire || '';

  const appellationSelect = document.getElementById('harvestAppellation');
  if (recolte.appellation && !state.appellations.includes(recolte.appellation)) {
    appellationSelect.add(new Option(`${recolte.appellation} (ancienne valeur)`, recolte.appellation));
  }
  appellationSelect.value = recolte.appellation || '';

  document.getElementById('packagingRows').replaceChildren();
  lignesRecolte.forEach((ligne) => {
    ajouterLigneConditionnement(ligne.taille_pot_g, ligne.quantite, ligne.id);
  });

  document.querySelectorAll('input[name="harvestApiary"]').forEach((checkbox) => {
    checkbox.checked = (recolte.rucherIds || []).includes(checkbox.value);
  });
  document.getElementById('addHarvest').textContent = 'Enregistrer les modifications';
  document.getElementById('cancelHarvestEdit').hidden = false;
  definirFormulaireOuvert(true);
}

function annulerEdition() {
  state.recolteEnEditionId = null;
  state.recoltesEnEditionIds = [];
  document.getElementById('harvestFormTitle').textContent = 'Ajouter une récolte';
  form.reset();
  reinitialiserConditionnements();
  document.getElementById('addHarvest').textContent = '＋ Ajouter la ligne';
  document.getElementById('cancelHarvestEdit').hidden = true;
  definirFormulaireOuvert(false);
}

async function modifierRecolte(event) {
  event.preventDefault();
  const groupeId = state.recolteEnEditionId;
  const lignesExistantes = state.recoltes.filter((item) => cleGroupeRecolte(item) === groupeId);
  const recolte = lignesExistantes[0];
  if (!recolte) return;

  const dateRecolte = document.getElementById('harvestDate').value;
  const dateMiseEnPot = document.getElementById('pottingDate').value;
  const annee = dateRecolte ? Number(dateRecolte.slice(0, 4)) : NaN;
  const nomRuche = document.getElementById('harvestHive').value.trim();
  const gout = document.getElementById('harvestTaste').value.trim();
  const appellation = document.getElementById('harvestAppellation').value;
  const lignesConditionnement = [...document.querySelectorAll('.miellerie-packaging-row')].map((row) => ({
    id: row.dataset.recolteId || null,
    taillePot: Number(row.querySelector('.miellerie-jar-size').value),
    quantite: Number(row.querySelector('.miellerie-jar-quantity').value)
  }));
  const rucherIds = [...document.querySelectorAll('input[name="harvestApiary"]:checked')].map((input) => input.value);
  const lignesExistantesMap = new Map(lignesExistantes.map((ligne) => [ligne.id, ligne]));
  const lignesAConserver = lignesConditionnement.filter((ligne) => ligne.id && lignesExistantesMap.has(ligne.id));
  const nouvellesLignes = lignesConditionnement.filter((ligne) => !ligne.id);

  if (!dateRecolte || !Number.isInteger(annee) || annee < 1900 || annee > 2100
      || !dateMiseEnPot || dateMiseEnPot < dateRecolte
      || lignesConditionnement.some(({ taillePot, quantite }) =>
        !Number.isInteger(taillePot) || taillePot < 1
        || !Number.isInteger(quantite) || quantite < 1)
      || lignesAConserver.some((ligne) => lignesExistantesMap.get(ligne.id).reste > ligne.quantite)
      || !lignesAConserver.length) {
    toast('Vérifiez les dates et chaque contenance. Gardez au moins une ligne et ne réduisez pas la quantité sous le stock restant.', true);
    return;
  }

  const saveButton = document.getElementById('addHarvest');
  saveButton.disabled = true;

  let nouvellesRecoltes = [];
  if (nouvellesLignes.length) {
    const { data, error: erreurAjoutLignes } = await supabase
      .from('miellerie_recoltes')
      .insert(nouvellesLignes.map(({ taillePot, quantite }) => ({
        groupe_id: groupeId,
        user_id: state.session.user.id,
        annee,
        date_recolte: dateRecolte,
        date_mise_en_pot: dateMiseEnPot,
        nom_ruche: nomRuche,
        gout,
        appellation,
        taille_pot_g: taillePot,
        quantite,
        reste: quantite
      })))
      .select('*');

    if (erreurAjoutLignes) {
      saveButton.disabled = false;
      console.error('Erreur ajout des contenances:', erreurAjoutLignes);
      toast('Impossible d’ajouter les contenances supplémentaires.', true);
      return;
    }
    nouvellesRecoltes = data || [];
  }

  const resultatsMiseAJour = await Promise.all(lignesAConserver.map((ligne) => {
    const ancienneLigne = lignesExistantesMap.get(ligne.id);
    return supabase
      .from('miellerie_recoltes')
      .update({
        annee,
        date_recolte: dateRecolte,
        date_mise_en_pot: dateMiseEnPot,
        nom_ruche: nomRuche,
        gout,
        appellation,
        taille_pot_g: ligne.taillePot,
        quantite: ligne.quantite
      })
      .eq('id', ligne.id)
      .eq('user_id', state.session.user.id)
      .then(({ error }) => ({ ligne, ancienneLigne, error }));
  }));

  const erreurMiseAJour = resultatsMiseAJour.find((resultat) => resultat.error);
  if (erreurMiseAJour) {
    if (nouvellesRecoltes.length) {
      await supabase.from('miellerie_recoltes').delete()
        .in('id', nouvellesRecoltes.map((ligne) => ligne.id))
        .eq('user_id', state.session.user.id);
    }
    saveButton.disabled = false;
    console.error('Erreur modification de la récolte:', erreurMiseAJour.error);
    toast('Impossible d’enregistrer toutes les contenances. Rechargez la page pour vérifier les lignes.', true);
    return;
  }

  const lignesRetirees = lignesExistantes.filter((ligne) =>
    !lignesAConserver.some((conservee) => conservee.id === ligne.id)
  );
  if (lignesRetirees.length) {
    const { error: erreurSuppression } = await supabase
      .from('miellerie_recoltes')
      .delete()
      .in('id', lignesRetirees.map((ligne) => ligne.id))
      .eq('user_id', state.session.user.id);
    if (erreurSuppression) {
      console.error('Erreur suppression de contenances retirées:', erreurSuppression);
      toast('Les données sont enregistrées, mais une contenance retirée n’a pas pu être supprimée.', true);
    }
  }

  const idsLignesConservees = lignesAConserver.map((ligne) => ligne.id);
  const associationsARetirer = lignesAConserver.flatMap((ligne) => {
    const ancienneLigne = lignesExistantesMap.get(ligne.id);
    return (ancienneLigne.rucherIds || [])
      .filter((rucherId) => !rucherIds.includes(rucherId))
      .map((rucher_id) => ({ recolte_id: ligne.id, rucher_id }));
  });
  if (associationsARetirer.length) {
    const { error: erreurSuppressionAssociations } = await supabase
      .from('miellerie_recoltes_ruchers')
      .delete()
      .or(associationsARetirer.map(({ recolte_id, rucher_id }) =>
        `and(recolte_id.eq.${recolte_id},rucher_id.eq.${rucher_id})`
      ).join(','));
    if (erreurSuppressionAssociations) {
      console.error('Erreur synchronisation des ruchers liés:', erreurSuppressionAssociations);
    }
  }

  const associationsAAjouter = [
    ...lignesAConserver.flatMap((ligne) => {
      const ancienneLigne = lignesExistantesMap.get(ligne.id);
      return rucherIds
        .filter((rucherId) => !(ancienneLigne.rucherIds || []).includes(rucherId))
        .map((rucher_id) => ({ recolte_id: ligne.id, rucher_id }));
    }),
    ...nouvellesRecoltes.flatMap((ligne) => rucherIds.map((rucher_id) => ({ recolte_id: ligne.id, rucher_id })))
  ];
  if (associationsAAjouter.length) {
    const { error: erreurAjoutAssociations } = await supabase
      .from('miellerie_recoltes_ruchers')
      .insert(associationsAAjouter);
    if (erreurAjoutAssociations) {
      console.error('Erreur ajout des ruchers aux contenances:', erreurAjoutAssociations);
      toast('Contenances enregistrées, mais les ruchers associés n’ont pas tous été actualisés.', true);
    }
  }

  lignesAConserver.forEach((ligne) => {
    const ancienneLigne = lignesExistantesMap.get(ligne.id);
    Object.assign(ancienneLigne, {
      annee,
      date_recolte: dateRecolte,
      date_mise_en_pot: dateMiseEnPot,
      nom_ruche: nomRuche,
      gout,
      appellation,
      taille_pot_g: ligne.taillePot,
      quantite: ligne.quantite,
      rucherIds
    });
  });
  nouvellesRecoltes.forEach((ligne) => {
    ligne.groupe_id = groupeId;
    ligne.rucherIds = rucherIds;
  });
  state.recoltes = state.recoltes.filter((ligne) => !lignesRetirees.some((retiree) => retiree.id === ligne.id));
  state.recoltes.push(...nouvellesRecoltes);
  state.recoltes.sort(trierRecoltesRecentes);
  saveButton.disabled = false;
  annulerEdition();
  afficherRecoltes();
  toast(nouvellesRecoltes.length
    ? `Récolte modifiée avec ${nouvellesRecoltes.length} contenance${nouvellesRecoltes.length > 1 ? 's' : ''} ajoutée${nouvellesRecoltes.length > 1 ? 's' : ''}.`
    : 'Récolte modifiée.');
}

async function ajouterRecolte(event) {
  event.preventDefault();
  const dateRecolte = document.getElementById('harvestDate').value;
  const dateMiseEnPot = document.getElementById('pottingDate').value;
  const annee = dateRecolte ? Number(dateRecolte.slice(0, 4)) : NaN;
  const nomRuche = document.getElementById('harvestHive').value.trim();
  const gout = document.getElementById('harvestTaste').value.trim();
  const appellation = document.getElementById('harvestAppellation').value;
  const conditionnements = lireConditionnements();
  const groupeId = crypto.randomUUID();
  const rucherIds = [...document.querySelectorAll('input[name="harvestApiary"]:checked')].map((input) => input.value);

  if (!dateRecolte || !Number.isInteger(annee) || annee < 1900 || annee > 2100
      || !dateMiseEnPot || dateMiseEnPot < dateRecolte
      || !conditionnements.length
      || conditionnements.some(({ taillePot, quantite }) =>
        !Number.isInteger(taillePot) || taillePot < 1
        || !Number.isInteger(quantite) || quantite < 1)) {
    toast('Vérifiez les dates et chaque contenance: format et quantité doivent être renseignés.', true);
    return;
  }

  const submitButton = document.getElementById('addHarvest');
  submitButton.disabled = true;
  const { data: recolte, error } = await supabase
    .from('miellerie_recoltes')
    .insert(conditionnements.map(({ taillePot, quantite }) => ({
      groupe_id: groupeId,
      user_id: state.session.user.id,
      annee,
      date_recolte: dateRecolte,
      date_mise_en_pot: dateMiseEnPot,
      nom_ruche: nomRuche,
      gout,
      appellation,
      taille_pot_g: taillePot,
      quantite,
      reste: quantite
    })))
    .select('*');

  if (error) {
    submitButton.disabled = false;
    console.error('Erreur enregistrement de la récolte:', error);
    toast('Impossible d’enregistrer la récolte.', true);
    return;
  }

  if (rucherIds.length) {
    const { error: erreurAssociations } = await supabase
      .from('miellerie_recoltes_ruchers')
      .insert(recolte.flatMap((ligne) => rucherIds.map((rucher_id) => ({ recolte_id: ligne.id, rucher_id }))));

    if (erreurAssociations) {
      await supabase.from('miellerie_recoltes').delete().in('id', recolte.map((ligne) => ligne.id)).eq('user_id', state.session.user.id);
      submitButton.disabled = false;
      console.error('Erreur association des ruchers à la récolte:', erreurAssociations);
      toast('La récolte n’a pas pu être liée aux ruchers sélectionnés.', true);
      return;
    }
  }

  recolte.forEach((ligne) => {
    ligne.rucherIds = rucherIds;
  });
  state.recoltes.push(...recolte);
  state.recoltes.sort(trierRecoltesRecentes);
  form.reset();
  reinitialiserConditionnements();
  afficherRecoltes();
  definirFormulaireOuvert(false);
  submitButton.disabled = false;
  toast(`Récolte ajoutée (${recolte.length} contenance${recolte.length > 1 ? 's' : ''}).`);
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
  const lignesDuGroupe = state.recoltes.filter((recolte) => cleGroupeRecolte(recolte) === id);
  const ids = lignesDuGroupe.map((recolte) => recolte.id);
  if (!ids.length || !confirm(`Supprimer cette récolte et ses ${ids.length} contenance${ids.length > 1 ? 's' : ''} ?`)) return;
  const { error } = await supabase
    .from('miellerie_recoltes')
    .delete()
    .in('id', ids)
    .eq('user_id', state.session.user.id);

  if (error) {
    console.error('Erreur suppression de la récolte:', error);
    toast('Impossible de supprimer cette ligne.', true);
    return;
  }

  state.recoltes = state.recoltes.filter((recolte) => cleGroupeRecolte(recolte) !== id);
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

  form.addEventListener('submit', (event) => {
    if (state.recolteEnEditionId) modifierRecolte(event);
    else ajouterRecolte(event);
  });
  document.getElementById('cancelHarvestEdit').addEventListener('click', annulerEdition);
  toggleFormButton.addEventListener('click', () => {
    if (!form.hidden && state.recolteEnEditionId) {
      annulerEdition();
      return;
    }
    definirFormulaireOuvert(form.hidden);
  });
  document.getElementById('addPackagingRow').addEventListener('click', () => {
    ajouterLigneConditionnement();
    document.querySelector('#packagingRows .miellerie-packaging-row:last-child .miellerie-jar-size')?.focus();
  });
  reinitialiserConditionnements();
  await Promise.all([chargerRuchers(), chargerRecoltes(), chargerTaillesPots(), chargerAppellations()]);
}

initPage();