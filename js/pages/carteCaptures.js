import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';

const mapElement = document.getElementById('carteLieux');
const statusElement = document.getElementById('carteStatut');
const listElement = document.getElementById('listeLieux');
const missingElement = document.getElementById('lieuxSansCoordonnees');
const radiusInput = document.getElementById('rayonMetres');
const radiusOutput = document.getElementById('rayonValeur');
const countElement = document.getElementById('nombreLieux');
const postalSelect = document.getElementById('zoomCodePostal');
const { session } = await initUserBar({ elementId: 'userBar' });

let map;
let markerLayers = [];
let posts = [];

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('is-error', isError);
}

function coordinates(post) {
  const latitude = Number(post.latitude);
  const longitude = Number(post.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return [latitude, longitude];
}

function codePostal(post) {
  if (post.code_postal) return String(post.code_postal);
  return post.adresse?.match(/\b\d{5}\b/)?.[0] || '';
}

function initialiserCarte() {
  map = L.map(mapElement, { scrollWheelZoom: false }).setView([46.6, 2.4], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
}

function markerIcon() {
  return L.divIcon({
    className: 'poste-map-icon-wrap',
    html: '<span class="poste-map-icon" aria-hidden="true"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function afficherPostes() {
  markerLayers.forEach((layer) => layer.remove());
  markerLayers = [];
  listElement.replaceChildren();

  const postesGeolocalises = posts.filter((post) => coordinates(post));
  const postesSansCoordonnees = posts.filter((post) => !coordinates(post));
  const rayon = Number(radiusInput.value);
  radiusOutput.value = String(rayon);
  radiusOutput.textContent = String(rayon);
  countElement.textContent = `${postesGeolocalises.length} géolocalisé${postesGeolocalises.length === 1 ? '' : 's'} / ${posts.length} poste${posts.length === 1 ? '' : 's'}`;

  postesGeolocalises.forEach((post) => {
    const position = coordinates(post);
    const circle = L.circle(position, {
      radius: rayon,
      color: '#338b58',
      weight: 2,
      opacity: 0.9,
      fillColor: '#62bd7b',
      fillOpacity: 0.18
    }).addTo(map);
    const marker = L.marker(position, { icon: markerIcon() }).addTo(map);
    const etat = post.actif ? 'Poste actif' : 'Poste inactif';
    marker.bindPopup(`<strong>${escapeHtml(post.nom)}</strong><br>${escapeHtml(post.adresse || 'Adresse non renseignée')}<br><small>${etat} · rayon ${rayon} m</small>`);
    markerLayers.push(circle, marker);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'lieu-item';
    item.innerHTML = `
      <span class="lieu-item-marker" aria-hidden="true"></span>
      <span class="lieu-item-copy">
        <strong>${escapeHtml(post.nom)}</strong>
        <span>${escapeHtml(post.adresse || 'Adresse non renseignée')}</span>
      </span>
      <span class="lieu-item-status ${post.actif ? 'is-active' : ''}">${post.actif ? 'Actif' : 'Inactif'}</span>
    `;
    item.addEventListener('click', () => {
      map.setView(position, Math.max(map.getZoom(), 14), { animate: true });
      marker.openPopup();
    });
    listElement.appendChild(item);
  });

  postesSansCoordonnees.forEach((post) => {
    const item = document.createElement('div');
    item.className = 'lieu-item lieu-item--missing';
    item.innerHTML = `
      <span class="lieu-item-marker lieu-item-marker--missing" aria-hidden="true"></span>
      <span class="lieu-item-copy">
        <strong>${escapeHtml(post.nom)}</strong>
        <span>${post.adresse ? `${escapeHtml(post.adresse)} · coordonnées manquantes` : 'Adresse à ajouter dans les réglages'}</span>
      </span>
      <a class="lieu-item-edit" href="settings.html">Réglages</a>
    `;
    listElement.appendChild(item);
  });

  if (posts.length === 0) {
    setStatus('Aucun poste enregistré. Créez vos postes dans les réglages pour les afficher sur la carte.');
    listElement.innerHTML = '<p class="lieux-empty">Aucun poste à afficher.</p>';
  } else if (postesGeolocalises.length === 0) {
    setStatus('Aucun poste ne possède encore de coordonnées. Ajoutez une adresse dans les réglages pour le placer sur la carte.');
  } else {
    setStatus(`${postesGeolocalises.length} poste${postesGeolocalises.length === 1 ? '' : 's'} affiché${postesGeolocalises.length === 1 ? '' : 's'} sur la carte.`);
  }

  if (postesSansCoordonnees.length) {
    missingElement.textContent = `${postesSansCoordonnees.length} poste${postesSansCoordonnees.length === 1 ? '' : 's'} sans coordonnées ne peuvent pas encore être placés sur la carte. Complétez leur adresse depuis les réglages.`;
    missingElement.hidden = false;
  } else {
    missingElement.hidden = true;
  }
}

function centrerCodePostal(code) {
  const lieux = posts.filter((post) => codePostal(post) === code && coordinates(post));
  if (!lieux.length) return;

  if (lieux.length === 1) {
    map.setView(coordinates(lieux[0]), 12, { animate: true });
    return;
  }

  map.fitBounds(L.latLngBounds(lieux.map(coordinates)), { padding: [44, 44], maxZoom: 13, animate: true });
}

function remplirSelectCodesPostaux() {
  const codes = [...new Set(posts
    .filter((post) => coordinates(post) && codePostal(post))
    .map(codePostal))]
    .sort((a, b) => a.localeCompare(b, 'fr'));

  postalSelect.replaceChildren();
  if (!codes.length) {
    postalSelect.add(new Option('Aucun code postal géolocalisé', ''));
    postalSelect.disabled = true;
    return;
  }

  codes.forEach((code) => postalSelect.add(new Option(code, code)));
  postalSelect.disabled = false;

  const posteDefaut = posts.find((post) => post.defaut && coordinates(post));
  const codeDefaut = posteDefaut ? codePostal(posteDefaut) : '';
  postalSelect.value = codes.includes(codeDefaut) ? codeDefaut : codes[0];
  centrerCodePostal(postalSelect.value);
}

function afficherEtatSelectCodePostal(message) {
  postalSelect.replaceChildren(new Option(message, ''));
  postalSelect.disabled = true;
}

radiusInput.addEventListener('input', afficherPostes);
postalSelect.addEventListener('change', () => centrerCodePostal(postalSelect.value));

initialiserCarte();

if (!session) {
  setStatus('Connectez-vous pour afficher vos postes de piégeage.');
  afficherEtatSelectCodePostal('Connectez-vous pour voir les codes postaux');
  listElement.innerHTML = '<p class="lieux-empty"><a href="login.html">Se connecter</a></p>';
} else {
  const { data, error } = await supabase
    .from('postes_pieges')
    .select('id, nom, adresse, latitude, longitude, actif, defaut')
    .eq('user_id', session.user.id)
    .order('nom');

  if (error) {
    console.error('Erreur de chargement des postes pour la carte:', error);
    afficherEtatSelectCodePostal('Codes postaux indisponibles');
    if (error.code === '42703' || error.message?.includes('adresse')) {
      setStatus('La base doit être mise à jour pour afficher les adresses. Exécutez sql/postes_pieges_adresse.sql dans Supabase.', true);
    } else {
      setStatus('Impossible de charger les postes. Vérifiez la connexion puis réessayez.', true);
    }
  } else {
    posts = data || [];
    afficherPostes();
    remplirSelectCodesPostaux();
    if (postalSelect.disabled && posts.length) {
      setStatus('Aucun poste géolocalisé avec un code postal. Vérifiez les adresses dans les réglages.');
    }
  }
}

window.addEventListener('resize', () => map.invalidateSize());
