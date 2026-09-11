import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';

const tabCommunaute = document.getElementById('tabCommunaute');
const tabMesStats = document.getElementById('tabMesStats');
const sectionCommunaute = document.getElementById('sectionCommunaute');
const sectionMesStats = document.getElementById('sectionMesStats');
const mesStatsContent = document.getElementById('mesStatsContent');
const myStatsNotConnected = document.getElementById('myStatsNotConnected');

const { session } = await initUserBar({ elementId: 'userBar' });

function showTab(tab) {
  tabCommunaute.classList.toggle('active', tab === 'communaute');
  tabMesStats.classList.toggle('active', tab === 'mesStats');
  sectionCommunaute.style.display = tab === 'communaute' ? '' : 'none';
  sectionMesStats.style.display = tab === 'mesStats' ? '' : 'none';
}

tabCommunaute.addEventListener('click', () => showTab('communaute'));
tabMesStats.addEventListener('click', () => showTab('mesStats'));

function formaterDateSimple(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formaterTemps(secondes) {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  if (h > 0) return `${h}h ${m}min ${s}s`;
  return `${m}min ${s}s`;
}

function formaterDureeMinSec(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}min ${String(s).padStart(2, '0')}s`;
}

function calcEfficacite(nombre, dureeSecondes) {
  if (!dureeSecondes || dureeSecondes <= 0) return null;
  return ((nombre / dureeSecondes) * 60).toFixed(2);
}

function getNumeroSemaine(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const jour = d.getUTCDay() || 7;
  const jeudi = new Date(d);
  jeudi.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil((((jeudi - debutAnnee) / 86400000) + 1) / 7);
  return jeudi.getUTCFullYear() + '-S' + String(semaine).padStart(2, '0');
}

const couleurs = ['#b8860b', '#c05a5a', '#4a9d8f', '#8a7fb8', '#c98a6b', '#7a9d6a', '#c9a86b', '#5a8fb4'];

function regrouperParFenetre(dataTotauxParJour, fenetre) {
  const jours = Object.keys(dataTotauxParJour).sort();
  if (!jours.length) return { labels: [], values: [] };

  const labels = [];
  const values = [];

  for (let i = 0; i < jours.length; i += fenetre) {
    const tranche = jours.slice(i, i + fenetre);
    const total = tranche.reduce((s, j) => s + (dataTotauxParJour[j] || 0), 0);
    const d = new Date(tranche[0]);
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    labels.push(label);
    values.push(total);
  }

  return { labels, values };
}

function tendanceLineaire(values) {
  const n = values.length;
  if (n < 2) return values.map(() => null);

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return values.map(() => sumY / n);

  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  return values.map((_, i) => parseFloat((a * i + b).toFixed(2)));
}

function creerChartTendance(canvasId, labels, values, couleurBarre, couleurTendance) {
  const tendance = tendanceLineaire(values);

  return new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Captures',
          data: values,
          backgroundColor: couleurBarre + 'cc',
          borderColor: couleurBarre,
          borderWidth: 1,
          borderRadius: 4,
          order: 2
        },
        {
          label: 'Tendance',
          data: tendance,
          type: 'line',
          borderColor: couleurTendance,
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#8a8578' }, grid: { color: '#e8e2d4' } },
        x: { ticks: { color: '#8a8578', maxRotation: 45 }, grid: { color: '#f0ece2' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.dataset.label + ' : ' + ctx.parsed.y
          }
        }
      }
    }
  });
}

let dataCommunauteParJour = {};
let chartTendanceCommunaute = null;

async function chargerCommunauteStats() {
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .order('date_capture', { ascending: true });

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  document.getElementById('totalNombre').textContent = data.reduce((t, c) => t + (c.nombre || 0), 0);

  dataCommunauteParJour = {};
  data.forEach((c) => {
    const j = c.date_capture;
    dataCommunauteParJour[j] = (dataCommunauteParJour[j] || 0) + (c.nombre || 0);
  });

  renderTendanceCommunaute();

  const parSemaineMethode = {};
  const toutesMethodes = new Set();

  data.forEach((c) => {
    const semaine = getNumeroSemaine(c.date_capture);
    const methode = c.methode || 'Inconnue';
    toutesMethodes.add(methode);

    if (!parSemaineMethode[semaine]) parSemaineMethode[semaine] = {};
    parSemaineMethode[semaine][methode] = (parSemaineMethode[semaine][methode] || 0) + (c.nombre || 0);
  });

  const semaines = Object.keys(parSemaineMethode).sort();
  const methodes = [...toutesMethodes];

  new Chart(document.getElementById('capturesSemaineMethode'), {
    type: 'bar',
    data: {
      labels: semaines,
      datasets: methodes.map((m, i) => ({
        label: m,
        data: semaines.map((s) => parSemaineMethode[s][m] || 0),
        backgroundColor: couleurs[i % couleurs.length]
      }))
    },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      plugins: { tooltip: { mode: 'index', intersect: false }, legend: { position: 'bottom' } }
    }
  });

  const headerRow = document.getElementById('tableSemaineHeader');
  headerRow.innerHTML = '<th>Semaine</th>';
  methodes.forEach((m) => {
    const th = document.createElement('th');
    th.textContent = m;
    headerRow.appendChild(th);
  });

  const thTotal = document.createElement('th');
  thTotal.textContent = 'Total 🐝';
  thTotal.className = 'table-total';
  headerRow.appendChild(thTotal);

  const tbody = document.querySelector('#tableSemaine tbody');
  tbody.innerHTML = '';

  const totauxMethode = {};
  methodes.forEach((m) => {
    totauxMethode[m] = 0;
  });

  let grandTotal = 0;

  semaines.forEach((s) => {
    const ligneTotal = methodes.reduce((t, m) => t + (parSemaineMethode[s][m] || 0), 0);
    methodes.forEach((m) => {
      totauxMethode[m] += (parSemaineMethode[s][m] || 0);
    });
    grandTotal += ligneTotal;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${escapeHtml(s)}</strong></td>` +
      methodes.map((m) => `<td>${parSemaineMethode[s][m] || 0}</td>`).join('') +
      `<td><strong class="table-total">${ligneTotal}</strong></td>`;
    tbody.appendChild(tr);
  });

  const trFoot = document.createElement('tr');
  trFoot.style.borderTop = '2px solid var(--border)';
  trFoot.innerHTML = `<td><strong class="table-cell-muted">Total</strong></td>` +
    methodes.map((m) => `<td><strong>${totauxMethode[m]}</strong></td>`).join('') +
    `<td><strong class="table-total">${grandTotal}</strong></td>`;
  tbody.appendChild(trFoot);
}

function renderTendanceCommunaute() {
  const fenetre = parseInt(document.getElementById('fenetreCommunaute').value);
  const { labels, values } = regrouperParFenetre(dataCommunauteParJour, fenetre);
  if (chartTendanceCommunaute) chartTendanceCommunaute.destroy();
  chartTendanceCommunaute = creerChartTendance('tendanceCommunaute', labels, values, '#b8860b', '#c05a5a');
}

document.getElementById('fenetreCommunaute').addEventListener('change', renderTendanceCommunaute);

let chartMesStats = null;
let dataPersoParJour = {};
let chartTendancePerso = null;
let capturesData = [];

function exporterExcel() {
  if (!capturesData.length) {
    alert('Aucune capture à exporter.');
    return;
  }

  const headers = [
    'Date', 'Heure', 'Méthode', 'Durée (s)',
    'Frelons asiatiques tués', 'Frelons européens tués', 'Autres tués',
    'Frelons asiatiques observés', 'Frelons européens observés', 'Autres observés',
    'Lieu', 'Notes', 'Température (°C)', 'Conditions météo'
  ];

  const rows = capturesData.map((c) => [
    c.date_capture || '',
    c.heure_capture || '',
    c.methode || '',
    c.duree || 0,
    c.nombre || 0,
    c.nombre_europeen || 0,
    c.nombre_autres || 0,
    c.nombre_obs_asiatique || 0,
    c.nombre_obs_europeen || 0,
    c.nombre_obs_autres || 0,
    c.lieu || '',
    (c.notes || '').replace(/\n/g, ' '),
    c.meteo_temp !== null && c.meteo_temp !== undefined ? c.meteo_temp : '',
    c.meteo_conditions || ''
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => {
      const str = String(cell ?? '');
      return '"' + str.replace(/"/g, '""') + '"';
    }).join(';'))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mes_captures.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function chargerMesStats() {
  if (!session) {
    myStatsNotConnected.style.display = 'block';
    mesStatsContent.style.display = 'none';
    return;
  }

  myStatsNotConnected.style.display = 'none';
  mesStatsContent.style.display = '';

  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date_capture', { ascending: false });

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  capturesData = data || [];

  const totalNombre = data.reduce((t, c) => t + (c.nombre || 0), 0);
  const totalDuree = data.reduce((t, c) => t + (c.duree || 0), 0);
  document.getElementById('totalNombrePerso').textContent = totalNombre;
  document.getElementById('dureeTotale').textContent = formaterTemps(totalDuree);

  const avecDuree = data.filter((c) => c.duree > 0);
  if (avecDuree.length > 0) {
    const totalNombreAvecDuree = avecDuree.reduce((t, c) => t + (c.nombre || 0), 0);
    const totalDureeAvecDuree = avecDuree.reduce((t, c) => t + c.duree, 0);
    document.getElementById('efficaciteMoyenne').textContent = ((totalNombreAvecDuree / totalDureeAvecDuree) * 60).toFixed(2) + ' /min';
  } else {
    document.getElementById('efficaciteMoyenne').textContent = '—';
  }

  dataPersoParJour = {};
  data.forEach((c) => {
    dataPersoParJour[c.date_capture] = (dataPersoParJour[c.date_capture] || 0) + (c.nombre || 0);
  });
  renderTendancePerso();

  const tbody = document.querySelector('#tableMesCaptures tbody');
  tbody.innerHTML = '';

  data.forEach((c) => {
    const eff = calcEfficacite(c.nombre || 0, c.duree || 0);
    const effHTML = eff !== null ? `<span class="efficacite">${eff} /min</span>` : '<span class="efficacite-na">—</span>';

    const tr = document.createElement('tr');
    tr.dataset.id = c.id;
    tr.innerHTML = `
      <td>${formaterDateSimple(c.date_capture)}</td>
      <td>${escapeHtml(c.heure_capture || '')}</td>
      <td>${escapeHtml(c.methode || '')}</td>
      <td>${c.duree > 0 ? formaterDureeMinSec(c.duree) : '—'}</td>
      <td>${c.nombre || 0}</td>
      <td>${effHTML}</td>
      <td>${escapeHtml(c.lieu || '')}</td>
      <td><button class="btn-supprimer" data-id="${c.id}" title="Supprimer">🗑</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-supprimer');
    if (!btn) return;

    const id = btn.dataset.id;
    if (!confirm('Supprimer cette capture ? Cette action est irréversible.')) return;

    btn.disabled = true;
    btn.textContent = '…';

    const { error: errDel } = await supabase
      .from('captures')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (errDel) {
      alert('Erreur : ' + errDel.message);
      btn.disabled = false;
      btn.textContent = '🗑';
    } else {
      const tr = tbody.querySelector(`tr[data-id="${id}"]`);
      if (tr) tr.remove();
      if (chartMesStats) {
        chartMesStats.destroy();
        chartMesStats = null;
      }
      if (chartTendancePerso) {
        chartTendancePerso.destroy();
        chartTendancePerso = null;
      }
      await chargerMesStats();
    }
  });

  const parJourMethode = {};
  const toutesMethodes = new Set();

  data.forEach((c) => {
    const jour = formaterDateSimple(c.date_capture);
    const methode = c.methode || 'Inconnue';
    toutesMethodes.add(methode);

    if (!parJourMethode[jour]) parJourMethode[jour] = {};
    parJourMethode[jour][methode] = (parJourMethode[jour][methode] || 0) + (c.nombre || 0);
  });

  const jours = Object.keys(parJourMethode).sort((a, b) =>
    new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'))
  );
  const methodes = [...toutesMethodes];

  if (chartMesStats) {
    chartMesStats.destroy();
    chartMesStats = null;
  }

  chartMesStats = new Chart(document.getElementById('capturesSemaineMethodeMes'), {
    type: 'bar',
    data: {
      labels: jours,
      datasets: methodes.map((m, i) => ({
        label: m,
        data: jours.map((j) => parJourMethode[j][m] || 0),
        backgroundColor: couleurs[i % couleurs.length]
      }))
    },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      plugins: { tooltip: { mode: 'index', intersect: false }, legend: { position: 'bottom' } }
    }
  });

  const headerRow = document.getElementById('tableSemaineHeaderMes');
  headerRow.innerHTML = '<th>Date</th>';
  methodes.forEach((m) => {
    const th = document.createElement('th');
    th.textContent = m;
    headerRow.appendChild(th);
  });

  const thTotalMes = document.createElement('th');
  thTotalMes.textContent = 'Total 🐝';
  thTotalMes.className = 'table-total';
  headerRow.appendChild(thTotalMes);

  const tbodySemaine = document.querySelector('#tableSemaineMes tbody');
  tbodySemaine.innerHTML = '';

  const totauxMethodeMes = {};
  methodes.forEach((m) => {
    totauxMethodeMes[m] = 0;
  });

  let grandTotalMes = 0;

  jours.forEach((jour) => {
    const ligneTotal = methodes.reduce((t, m) => t + (parJourMethode[jour][m] || 0), 0);
    methodes.forEach((m) => {
      totauxMethodeMes[m] += (parJourMethode[jour][m] || 0);
    });
    grandTotalMes += ligneTotal;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${escapeHtml(jour)}</strong></td>` +
      methodes.map((m) => `<td>${parJourMethode[jour][m] || 0}</td>`).join('') +
      `<td><strong class="table-total">${ligneTotal}</strong></td>`;
    tbodySemaine.appendChild(tr);
  });

  const trFootMes = document.createElement('tr');
  trFootMes.style.borderTop = '2px solid var(--border)';
  trFootMes.innerHTML = `<td><strong class="table-cell-muted">Total</strong></td>` +
    methodes.map((m) => `<td><strong>${totauxMethodeMes[m]}</strong></td>`).join('') +
    `<td><strong class="table-total">${grandTotalMes}</strong></td>`;
  tbodySemaine.appendChild(trFootMes);
}

function renderTendancePerso() {
  const fenetre = parseInt(document.getElementById('fenetrePerso').value);
  const { labels, values } = regrouperParFenetre(dataPersoParJour, fenetre);
  if (chartTendancePerso) chartTendancePerso.destroy();
  chartTendancePerso = creerChartTendance('tendancePerso', labels, values, '#4a9d8f', '#8a7fb8');
}

document.getElementById('fenetrePerso').addEventListener('change', renderTendancePerso);
document.getElementById('btnExportExcel').addEventListener('click', exporterExcel);

async function setup() {
  const params = new URLSearchParams(window.location.search);
  const ongletMesStats = params.get('onglet') === 'mesStats';

  if (!session) {
    myStatsNotConnected.style.display = 'block';
    mesStatsContent.style.display = 'none';
  } else {
    await chargerMesStats();
  }

  // Ouvre l'onglet demandé via l'URL (?onglet=mesStats), sinon communauté.
  showTab(ongletMesStats ? 'mesStats' : 'communaute');
  await chargerCommunauteStats();
}

await setup();
