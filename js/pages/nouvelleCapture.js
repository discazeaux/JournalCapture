import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';

const { session, profil } = await initUserBar({ elementId: 'userBar' });

let lieuDefaut = 'maison';
if (session && profil?.codePostal) {
  lieuDefaut = profil.codePostal;
}

if (!session) {
  window.location.href = 'login.html';
  const form = document.getElementById('captureForm');
  if (form) form.style.display = 'none';
}

let postes = [];
let appats = [];

if (session) {
  const [{ data: p }, { data: a }] = await Promise.all([
    supabase.from('postes_pieges')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('actif', true)
      .order('nom'),
    supabase.from('appats')
      .select('*')
      .eq('user_id', session.user.id)
      .order('nom')
  ]);

  postes = p || [];
  appats = a || [];
}

function remplirSelectPoste() {
  const sel = document.getElementById('selectPoste');
  const hint = document.getElementById('hintPasDePoste');

  if (!sel) return;

  sel.innerHTML = '';

  if (!postes.length) {
    sel.innerHTML = '<option value="">— aucun poste actif —</option>';
    sel.style.display = 'none';
    if (hint) hint.style.display = 'block';
    return;
  }

  if (hint) hint.style.display = 'none';
  sel.style.display = '';

  const optVide = document.createElement('option');
  optVide.value = '';
  optVide.textContent = '— sélectionner un poste —';
  sel.appendChild(optVide);

  postes.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.nom}  (×${p.nombre})`;
    sel.appendChild(opt);
  });

  const posteDefaut = postes.find((p) => p.defaut);
  if (posteDefaut) {
    sel.value = posteDefaut.id;
  }

  mettreAJourFichePoste();
}

function remplirSelectAppat(appat_id_defaut) {
  const sel = document.getElementById('appat');
  if (!sel) return;

  sel.innerHTML = '';

  const sucres = appats.filter((a) => a.type !== 'proteine');
  const proteines = appats.filter((a) => a.type === 'proteine');

  function ajouterGroupe(label, liste) {
    if (!liste.length) return;
    const grp = document.createElement('optgroup');
    grp.label = label;
    liste.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.nom;
      if (a.id === appat_id_defaut) opt.selected = true;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  }

  ajouterGroupe('🍯 Sucrés', sucres);
  ajouterGroupe('🥩 Protéinés', proteines);

  if (!sel.options.length) {
    sel.innerHTML = '<option value="">— aucun appât configuré —</option>';
  } else if (!sel.value) {
    const premierAppat = appats.find((a) => a.id === appat_id_defaut) || appats[0];
    if (premierAppat) sel.value = premierAppat.id;
  }

  mettreAJourFicheRecette();
}

function mettreAJourFichePoste() {
  const posteId = document.getElementById('selectPoste').value;
  const fiche = document.getElementById('fichePoste');
  const poste = postes.find((p) => p.id === posteId);

  if (!poste) {
    fiche.classList.remove('visible');
    document.getElementById('nombrePieges').value = 1;
    return;
  }

  document.getElementById('nombrePieges').value = poste.nombre;
  document.getElementById('fichePosteLigne1').textContent = `🪤 Type : ${poste.type_piege || '—'}`;
  document.getElementById('fichePosteLigne2').textContent = `× ${poste.nombre} piège(s) sur ce poste`;
  document.getElementById('fichePosteLigne3').textContent = '';
  fiche.classList.add('visible');
}

function mettreAJourFicheRecette() {
  const sel = document.getElementById('appat');
  const appId = sel.value;
  const appat = appats.find((a) => a.id === appId);

  const badge = document.getElementById('badgeTypeAppat');
  const fiche = document.getElementById('ficheRecette');
  const texte = document.getElementById('ficheRecetteTexte');

  if (appat) {
    badge.innerHTML = appat.type === 'proteine'
      ? '<span class="badge-appat-type badge-proteine">🥩 Protéiné</span>'
      : '<span class="badge-appat-type badge-sucre">🍯 Sucré</span>';

    if (appat.recette?.trim()) {
      texte.textContent = appat.recette;
      fiche.classList.add('visible');
    } else {
      fiche.classList.remove('visible');
    }
  } else {
    badge.innerHTML = '';
    fiche.classList.remove('visible');
  }
}

remplirSelectPoste();
remplirSelectAppat(appats.find((a) => a.defaut)?.id);

document.getElementById('selectPoste').addEventListener('change', mettreAJourFichePoste);
document.getElementById('appat').addEventListener('change', mettreAJourFicheRecette);

const selectMethode = document.getElementById('methode');
const detailsPiege = document.getElementById('detailsPiege');
const dureeBlock = document.getElementById('dureeBlock');
const chronoDisplay = document.getElementById('chrono');
const dureeInput = document.getElementById('duree_capture');
const startButton = document.getElementById('startChrono');
const stopButton = document.getElementById('stopChrono');
const resetButton = document.getElementById('resetChrono');

let chronoInterval = null;
let secondes = 0;
let chronoEnCours = false;

function mettreAJourAffichagePiege() {
  detailsPiege.style.display = selectMethode.value === 'Piège' ? 'block' : 'none';
}

function mettreAJourAffichageDuree() {
  const estRaquette = selectMethode.value === 'Raquette électrique';
  dureeBlock.style.display = estRaquette ? 'block' : 'none';

  if (!estRaquette) {
    clearInterval(chronoInterval);
    chronoInterval = null;
    chronoEnCours = false;
    secondes = 0;
    afficherChrono();
    startButton.disabled = false;
    stopButton.disabled = true;

    document.getElementById('meteo_temp').value = '';
    document.getElementById('meteo_conditions').value = 'ensoleillé';
    document.getElementById('meteoIcone').textContent = '—';
    document.getElementById('meteoTexte').textContent = '—';
    document.getElementById('meteoEdit').style.display = 'none';
  } else {
    recupererMeteo();
  }
}

selectMethode.addEventListener('change', () => {
  mettreAJourAffichagePiege();
  mettreAJourAffichageDuree();
});

mettreAJourAffichagePiege();
mettreAJourAffichageDuree();

function formatDuree(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function parseDuree(v) {
  const raw = String(v || '').trim();
  if (!raw) return null;
  const parts = raw.split(':').map((p) => p.trim());

  if (parts.length === 2) {
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (Number.isInteger(m) && m >= 0 && Number.isInteger(s) && s >= 0 && s < 60) return m * 60 + s;
  }

  if (parts.length === 1) {
    const s = Number(parts[0]);
    if (Number.isInteger(s) && s >= 0) return s;
  }

  return null;
}

function afficherChrono() {
  chronoDisplay.textContent = formatDuree(secondes);
  dureeInput.value = formatDuree(secondes);
}

startButton.addEventListener('click', () => {
  if (chronoEnCours) return;
  chronoEnCours = true;
  startButton.disabled = true;
  stopButton.disabled = false;
  chronoInterval = setInterval(() => {
    secondes += 1;
    afficherChrono();
  }, 1000);
});

stopButton.addEventListener('click', () => {
  clearInterval(chronoInterval);
  chronoInterval = null;
  chronoEnCours = false;
  startButton.disabled = false;
  stopButton.disabled = true;

  const p = parseDuree(dureeInput.value);
  if (p !== null) {
    secondes = p;
    afficherChrono();
  }
});

resetButton.addEventListener('click', () => {
  clearInterval(chronoInterval);
  chronoInterval = null;
  chronoEnCours = false;
  secondes = 0;
  afficherChrono();
  startButton.disabled = false;
  stopButton.disabled = true;
});

dureeInput.addEventListener('change', () => {
  const p = parseDuree(dureeInput.value);
  if (p !== null) {
    secondes = p;
    afficherChrono();
  } else {
    dureeInput.value = formatDuree(secondes);
  }
});

function initialiserValeursParDefaut() {
  const now = new Date();
  document.getElementById('date_capture').value = now.toISOString().split('T')[0];
  document.getElementById('heure_capture').value = now.toTimeString().substring(0, 5);
  document.getElementById('lieu').value = lieuDefaut;
}

initialiserValeursParDefaut();

document.getElementById('captureForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enregistrement…';

  const methodeChoisie = document.getElementById('methode').value;
  const estPiege = methodeChoisie === 'Piège';
  const estRaquette = methodeChoisie === 'Raquette électrique';
  const posteId = estPiege ? (document.getElementById('selectPoste').value || null) : null;
  const appatId = estPiege ? (document.getElementById('appat').value || null) : null;

  if (!estRaquette) {
    secondes = 0;
  }

  let notes = document.getElementById('notes').value;
  if (estPiege) {
    const notesPiege = document.getElementById('notesPiege').value;
    if (notesPiege) notes = notesPiege + (notes ? '\n' + notes : '');
  }

  const { error: errCapture } = await supabase
    .from('captures')
    .insert({
      date_capture: document.getElementById('date_capture').value,
      heure_capture: document.getElementById('heure_capture').value,
      methode: document.getElementById('methode').value,
      duree: secondes,
      nombre: Number(document.getElementById('nombre').value) || 0,
      nombre_europeen: Number(document.getElementById('nombre_europeen').value) || 0,
      nombre_autres: Number(document.getElementById('nombre_autres').value) || 0,
      nombre_obs_asiatique: Number(document.getElementById('nombre_obs_asiatique').value) || 0,
      nombre_obs_europeen: Number(document.getElementById('nombre_obs_europeen').value) || 0,
      nombre_obs_autres: Number(document.getElementById('nombre_obs_autres').value) || 0,
      user_id: session ? session.user.id : null,
      lieu: document.getElementById('lieu').value,
      notes,
      poste_id: posteId,
      appat_id: appatId,
      meteo_temp: estRaquette && document.getElementById('meteo_temp').value !== '' ? parseFloat(document.getElementById('meteo_temp').value) : null,
      meteo_conditions: estRaquette ? (document.getElementById('meteo_conditions').value || null) : null
    });

  if (errCapture) {
    alert(errCapture.message);
    console.error(errCapture);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enregistrer';
    return;
  }

  alert('Capture enregistrée !');

  document.getElementById('methode').value = 'Raquette électrique';
  document.getElementById('nombre').value = 0;
  document.getElementById('nombre_europeen').value = 0;
  document.getElementById('nombre_autres').value = 0;
  document.getElementById('nombre_obs_asiatique').value = 0;
  document.getElementById('nombre_obs_europeen').value = 0;
  document.getElementById('nombre_obs_autres').value = 0;
  document.getElementById('notes').value = '';
  document.getElementById('notesPiege').value = '';
  document.getElementById('selectPoste').value = '';
  mettreAJourFichePoste();
  mettreAJourAffichagePiege();
  clearInterval(chronoInterval);
  chronoInterval = null;
  chronoEnCours = false;
  secondes = 0;
  afficherChrono();
  startButton.disabled = false;
  stopButton.disabled = true;
  initialiserValeursParDefaut();
  recupererMeteo();

  submitBtn.disabled = false;
  submitBtn.textContent = 'Enregistrer';
});

const WMO = {
  0: ['☀️', 'ensoleillé'], 1: ['🌤', 'ensoleillé'], 2: ['⛅', 'nuageux'], 3: ['☁️', 'couvert'],
  45: ['🌫', 'couvert'], 48: ['🌫', 'couvert'], 51: ['🌦', 'bruine'], 53: ['🌦', 'bruine'], 55: ['🌦', 'bruine'],
  61: ['🌧', 'pluie'], 63: ['🌧', 'pluie'], 65: ['🌧', 'pluie'], 71: ['❄️', 'couvert'], 73: ['❄️', 'couvert'], 75: ['❄️', 'couvert'],
  80: ['🌧', 'pluie'], 81: ['🌧', 'pluie'], 82: ['🌧', 'pluie'], 95: ['⛈', 'orage'], 96: ['⛈', 'orage'], 99: ['⛈', 'orage']
};

async function recupererMeteo() {
  const icone = document.getElementById('meteoIcone');
  const texte = document.getElementById('meteoTexte');
  const status = document.getElementById('meteoStatus');
  const edit = document.getElementById('meteoEdit');

  icone.textContent = '⏳';
  texte.textContent = 'Géolocalisation en cours…';
  status.textContent = '';
  edit.style.display = 'none';

  if (!navigator.geolocation) {
    icone.textContent = '📍';
    texte.textContent = 'Géolocalisation non disponible';
    status.textContent = 'Saisissez manuellement ci-dessous.';
    edit.style.display = 'flex';
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`;
      const res = await fetch(url);
      const json = await res.json();
      const temp = json.current.temperature_2m;
      const code = json.current.weathercode;
      const [emoji, cond] = WMO[code] || ['🌡️', 'inconnu'];

      icone.textContent = emoji;
      texte.innerHTML = `<strong>${temp} °C</strong> · ${cond.charAt(0).toUpperCase() + cond.slice(1)}`;
      status.textContent = 'Modifiable ci-dessous si nécessaire';

      document.getElementById('meteo_temp').value = temp;
      document.getElementById('meteo_conditions').value = cond;
      edit.style.display = 'flex';

      document.getElementById('meteo_temp').addEventListener('input', syncMeteoAffichage, { once: false });
      document.getElementById('meteo_conditions').addEventListener('change', syncMeteoAffichage, { once: false });
    } catch (err) {
      icone.textContent = '⚠️';
      texte.textContent = 'Erreur météo — saisissez manuellement';
      edit.style.display = 'flex';
    }
  }, () => {
    icone.textContent = '📍';
    texte.textContent = 'Position refusée — saisissez manuellement';
    edit.style.display = 'flex';
  });
}

function syncMeteoAffichage() {
  const temp = document.getElementById('meteo_temp').value;
  const cond = document.getElementById('meteo_conditions').value;
  const [emoji] = WMO[Object.keys(WMO).find((k) => WMO[k][1] === cond)] || ['🌡️'];
  document.getElementById('meteoIcone').textContent = emoji || '🌡️';
  document.getElementById('meteoTexte').innerHTML = `<strong>${temp ? temp + ' °C' : '—'}</strong> · ${cond.charAt(0).toUpperCase() + cond.slice(1)}`;
}

recupererMeteo();
