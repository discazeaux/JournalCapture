import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';

let ruchers = [];
let traitements = [];
let pertes = [];
let annee = new Date().getFullYear();
let policeUnicode = null;

async function chargerPoliceUnicode() {
  if (policeUnicode) return policeUnicode;

  const response = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf');
  if (!response.ok) throw new Error('La police Unicode du PDF est indisponible.');

  const buffer = await response.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  policeUnicode = btoa(binary);
  return policeUnicode;
}

function afficherDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${date}T00:00:00`));
}

function dansAnnee(date) {
  return date && date.startsWith(`${annee}-`);
}

function rendreSelectAnnee() {
  const select = document.getElementById('registreAnnee');
  const anneeActuelle = new Date().getFullYear();
  for (let valeur = anneeActuelle + 1; valeur >= anneeActuelle - 5; valeur -= 1) {
    const option = document.createElement('option');
    option.value = valeur;
    option.textContent = valeur;
    option.selected = valeur === annee;
    select.appendChild(option);
  }
}

function rendreRegistre() {
  document.getElementById('registreTitreAnnee').textContent = `Année ${annee}`;
  document.querySelectorAll('.registre-annee-inline').forEach((element) => {
    element.textContent = annee;
  });

  const ruchersElement = document.getElementById('registreRuchers');
  ruchersElement.innerHTML = ruchers.length
    ? `<table class="registre-table"><thead><tr><th>Rucher</th><th>Ruches</th><th>Ruchettes</th><th>État de santé</th></tr></thead><tbody>${ruchers.map((rucher) => `
        <tr><td>${escapeHtml(rucher.nom)}</td><td>${rucher.nombre_ruches || 0}</td><td>${rucher.nombre_ruchettes || 0}</td><td>${escapeHtml(rucher.etat_sante || '—')}</td></tr>
      `).join('')}</tbody></table>`
    : '<p class="registre-empty">Aucun rucher enregistré.</p>';

  const detailsElement = document.getElementById('registreRuchersDetails');
  detailsElement.innerHTML = ruchers.length
    ? ruchers.map((rucher, index) => {
      const traitementsRucher = traitements.filter((traitement) => traitement.rucher_id === rucher.id && dansAnnee(traitement.date_traitement));
      const pertesRucher = pertes.filter((perte) => perte.rucher_id === rucher.id && dansAnnee(perte.date_constat));
      return `
        <div class="registre-rucher-detail">
          <h3>${index + 3}. Suivi du rucher ${escapeHtml(rucher.nom)}</h3>
          <h4>État de santé</h4>
          <p>${escapeHtml(rucher.etat_sante || 'Non renseigné')} · ${rucher.nombre_ruches || 0} ruche(s) · ${rucher.nombre_ruchettes || 0} ruchette(s)</p>
          <h4>Traitements</h4>
          ${traitementsRucher.length
            ? `<table class="registre-table"><thead><tr><th>Date</th><th>Traitement</th><th>Suivi</th></tr></thead><tbody>${traitementsRucher.map((traitement) => `
              <tr><td>${afficherDate(traitement.date_traitement)}</td><td>${escapeHtml(traitement.intitule)}</td><td>${traitement.changement_lanieres_fait ? 'Changement effectué' : 'Changement à suivre'}${traitement.retrait_lanieres_fait ? ' · Retrait effectué' : ''}</td></tr>
            `).join('')}</tbody></table>`
            : '<p class="registre-empty">Aucun traitement enregistré pour cette année.</p>'}
          <h4>Pertes de colonies</h4>
          ${pertesRucher.length
            ? `<table class="registre-table"><thead><tr><th>Date</th><th>Colonie</th><th>Cause(s)</th><th>Observation et mesure</th></tr></thead><tbody>${pertesRucher.map((perte) => `
              <tr><td>${afficherDate(perte.date_constat)}</td><td>${escapeHtml(perte.colonie)}</td><td>${escapeHtml((perte.causes_probables?.length ? perte.causes_probables : [perte.cause_probable]).join(', '))}</td><td>${escapeHtml(perte.observation_mesure || '—')}</td></tr>
            `).join('')}</tbody></table>`
            : '<p class="registre-empty">Aucune perte enregistrée pour cette année.</p>'}
        </div>`;
    }).join('')
    : '<p class="registre-empty">Aucun rucher enregistré.</p>';
}

function ajouterTitrePdf(doc, titre, y) {
  doc.setFontSize(14);
  doc.setTextColor(95, 75, 24);
  doc.text(titre, 14, y);
  doc.setDrawColor(184, 134, 11);
  doc.line(14, y + 2, 196, y + 2);
  return y + 10;
}

function ajouterTablePdf(doc, head, body, y, widths) {
  doc.autoTable({
    startY: y,
    head: [head],
    body,
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',
    theme: 'grid',
    styles: { font: 'NotoSans', fontSize: 8, cellPadding: 2.5, textColor: [37, 35, 31] },
    headStyles: { font: 'NotoSans', fillColor: [241, 234, 220], textColor: [76, 64, 31], fontStyle: 'bold' },
    columnStyles: Object.fromEntries(widths.map((width, index) => [index, { cellWidth: width }]))
  });
  return doc.lastAutoTable.finalY + 10;
}

async function telechargerPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;

  try {
    const police = await chargerPoliceUnicode();
    doc.addFileToVFS('NotoSans-Regular.ttf', police);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.setFont('NotoSans');
  } catch (error) {
    alert(error.message);
    return;
  }

  doc.setTextColor(48, 43, 34);
  doc.setFontSize(22);
  doc.text('Registre d’élevage', 105, y, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(102, 95, 82);
  doc.text(`Année ${annee}`, 105, y + 8, { align: 'center' });
  y += 20;

  y = ajouterTitrePdf(doc, '1. Informations de l’apiculteur', y);
  doc.setFontSize(9);
  doc.setTextColor(80, 75, 68);
  [
    'Nom et prénom : ______________________________________________________________',
    'Numéro d’apiculteur (NAPI) : _________________________________________________',
    'Adresse : ____________________________________________________________________',
    'Commune et code postal : ______________________________________________________',
    'Téléphone : ____________________________  E-mail : ______________________________'
  ].forEach((ligne) => {
    doc.text(ligne, 14, y);
    y += 7;
  });
  y += 4;

  y = ajouterTitrePdf(doc, '2. Ruchers déclarés', y);
  y = ajouterTablePdf(doc, ['Rucher', 'Ruches', 'Ruchettes', 'État de santé'], ruchers.map((rucher) => [
    rucher.nom || '',
    String(rucher.nombre_ruches || 0),
    String(rucher.nombre_ruchettes || 0),
    rucher.etat_sante || '—'
  ]), y, [75, 25, 25, 55]);

  ruchers.forEach((rucher, index) => {
    if (y > 255) {
      doc.addPage();
      y = 18;
    }

    const traitementsRucher = traitements.filter((traitement) => traitement.rucher_id === rucher.id && dansAnnee(traitement.date_traitement));
    const pertesRucher = pertes.filter((perte) => perte.rucher_id === rucher.id && dansAnnee(perte.date_constat));

    y = ajouterTitrePdf(doc, `${index + 3}. Suivi du rucher ${rucher.nom || 'Rucher'}`, y);

    doc.setFontSize(9);
    doc.setTextColor(80, 75, 68);
    doc.text(`État de santé : ${rucher.etat_sante || 'Non renseigné'} - ${rucher.nombre_ruches || 0} ruche(s) - ${rucher.nombre_ruchettes || 0} ruchette(s)`, 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(95, 75, 24);
    doc.text('Traitements', 14, y);
    y += 5;
    if (traitementsRucher.length) {
      y = ajouterTablePdf(doc, ['Date', 'Traitement', 'Suivi'], traitementsRucher.map((traitement) => [
        afficherDate(traitement.date_traitement),
        traitement.intitule || '',
        `${traitement.changement_lanieres_fait ? 'Changement effectué' : 'Changement à suivre'}${traitement.retrait_lanieres_fait ? ' - Retrait effectué' : ''}`
      ]), y, [35, 70, 77]);
    } else {
      doc.setFontSize(8);
      doc.setTextColor(100, 95, 85);
      doc.text('Aucun traitement enregistré pour cette année.', 14, y);
      y += 8;
    }

    if (y > 255) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(10);
    doc.setTextColor(95, 75, 24);
    doc.text('Pertes de colonies', 14, y);
    y += 5;
    if (pertesRucher.length) {
      y = ajouterTablePdf(doc, ['Date', 'Colonie', 'Cause(s)', 'Observation et mesure'], pertesRucher.map((perte) => [
        afficherDate(perte.date_constat),
        perte.colonie || '',
        (perte.causes_probables?.length ? perte.causes_probables : [perte.cause_probable]).join(', '),
        perte.observation_mesure || '—'
      ]), y, [28, 35, 55, 64]);
    } else {
      doc.setFontSize(8);
      doc.setTextColor(100, 95, 85);
      doc.text('Aucune perte enregistrée pour cette année.', 14, y);
      y += 10;
    }
    y += 5;
  });

  doc.save(`registre-elevage-${annee}.pdf`);
}

async function chargerDonnees(session) {
  const [ruchersResult, traitementsResult, pertesResult] = await Promise.all([
    supabase.from('ruchers').select('*').eq('user_id', session.user.id).order('created_at'),
    supabase.from('traitements_ruchers').select('*').eq('user_id', session.user.id).order('date_traitement'),
    supabase.from('pertes_colonies').select('*').eq('user_id', session.user.id).order('date_constat')
  ]);

  if (ruchersResult.error || traitementsResult.error || pertesResult.error) {
    throw new Error('Impossible de charger les données du registre.');
  }

  ruchers = ruchersResult.data || [];
  traitements = traitementsResult.data || [];
  pertes = pertesResult.data || [];
  rendreRegistre();
}

async function initPage() {
  rendreSelectAnnee();
  document.getElementById('registreDateEdition').textContent = afficherDate(new Date().toISOString().slice(0, 10));
  document.getElementById('registreAnnee').addEventListener('change', (event) => {
    annee = Number(event.target.value);
    rendreRegistre();
  });
  document.getElementById('btnTelechargerRegistre').addEventListener('click', telechargerPdf);

  const { session } = await initUserBar({ elementId: 'userBar' });
  if (!session) {
    document.getElementById('registreAuth').style.display = '';
    document.getElementById('registreDocument').style.display = 'none';
    return;
  }

  try {
    await chargerDonnees(session);
  } catch (error) {
    document.getElementById('registreRuchers').innerHTML = `<p class="registre-empty">${escapeHtml(error.message)}</p>`;
  }
}

initPage();
