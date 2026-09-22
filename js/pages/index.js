import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';

const { session } = await initUserBar({ elementId: 'userBar', montrerConnexion: false });

if (!session) {
  document.querySelectorAll('.hub-protege').forEach((entry) => {
    entry.style.display = 'none';
  });
} else {
  const lienMesStats = document.getElementById('lienMesStats');
  if (lienMesStats) lienMesStats.style.display = '';

  // Connecté : masquer la section d'explication "Comment ça marche"
  const sectionCcm = document.querySelector('.ccm');
  if (sectionCcm) sectionCcm.style.display = 'none';

  ['lienConnexion', 'lienInscription'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const authWrap = document.querySelector('.auth-buttons');
  if (authWrap) authWrap.style.display = 'none';
}

function afficherDateRappel(date) {
  if (!date) return 'Date non précisée';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(`${date}T00:00:00`));
}

async function chargerRappels() {
  if (!session) return;

  const section = document.getElementById('homeReminders');
  const list = document.getElementById('homeRemindersList');
  const count = document.getElementById('homeRemindersCount');
  if (!section || !list) return;

  const { data: rappels, error } = await supabase
    .from('traitements_ruchers')
    .select('id, intitule, date_traitement, date_changement_lanieres, date_retrait_lanieres, changement_lanieres_fait, retrait_lanieres_fait, ruchers(nom)')
    .eq('user_id', session.user.id)
    .order('date_traitement', { ascending: false });

  if (error || !rappels?.length) return;

  const elements = rappels.flatMap((rappel) => [
    { ...rappel, etape: 'Changer les lanières', etapeCle: 'changement', date: rappel.date_changement_lanieres, fait: rappel.changement_lanieres_fait },
    { ...rappel, etape: 'Enlever les lanières', etapeCle: 'retrait', date: rappel.date_retrait_lanieres, fait: rappel.retrait_lanieres_fait }
  ]).filter((rappel) => rappel.date && !rappel.fait);

  if (!elements.length) return;

  list.innerHTML = elements.map((rappel) => `
    <label class="home-reminder-row">
      <input type="checkbox" class="home-reminder-check" data-id="${rappel.id}" data-etape="${rappel.etapeCle}"
        aria-label="Valider : ${escapeHtml(rappel.etape)}">
      <span class="home-reminder-content">
        <strong>${escapeHtml(rappel.etape)} — ${escapeHtml(rappel.intitule)}</strong>
        <small>${escapeHtml(rappel.ruchers?.nom || 'Rucher')} · ${afficherDateRappel(rappel.date)}</small>
      </span>
    </label>
  `).join('');
  count.textContent = `${elements.length} rappel${elements.length > 1 ? 's' : ''}`;
  section.style.display = '';

  list.querySelectorAll('.home-reminder-check').forEach((checkbox) => {
    checkbox.addEventListener('change', () => validerRappel(checkbox));
  });
}

async function validerRappel(checkbox) {
  const colonne = checkbox.dataset.etape === 'changement'
    ? 'changement_lanieres_fait'
    : 'retrait_lanieres_fait';
  checkbox.disabled = true;

  const { error } = await supabase.from('traitements_ruchers')
    .update({ [colonne]: true })
    .eq('id', checkbox.dataset.id)
    .eq('user_id', session.user.id);

  if (error) {
    checkbox.checked = false;
    checkbox.disabled = false;
    return;
  }

  const row = checkbox.closest('.home-reminder-row');
  row?.classList.add('is-done');
  setTimeout(() => {
    row?.remove();
    const remaining = document.querySelectorAll('.home-reminder-row').length;
    const count = document.getElementById('homeRemindersCount');
    if (count) count.textContent = `${remaining} rappel${remaining > 1 ? 's' : ''}`;
    if (!remaining) document.getElementById('homeReminders')?.remove();
  }, 250);
}

chargerRappels();

function extraireExtrait(contenu, max = 180) {
  if (!contenu) return '';
  return (contenu
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  ).slice(0, max);
}

const featured = document.getElementById('featuredArticle');
if (featured) {
  const { data: dernier } = await supabase
    .from('articles')
    .select('slug, titre, created_at, contenu')
    .eq('publie', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (dernier && dernier.length > 0) {
    const a = dernier[0];
    const date = new Date(a.created_at).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    document.getElementById('featuredLien').href = `article.html?slug=${encodeURIComponent(a.slug)}`;
    document.getElementById('featuredTitre').textContent = a.titre || 'Sans titre';
    document.getElementById('featuredDate').textContent = date;

    const extrait = extraireExtrait(a.contenu);
    document.getElementById('featuredExtrait').textContent = extrait ? `${extrait}…` : '';
    featured.style.display = 'block';
  }
}

const [{ data: captures }, { data: appats }] = await Promise.all([
  supabase.from('captures').select('date_capture, methode, nombre, appat_id'),
  supabase.from('appats').select('id, nom')
]);

const nomsAppats = {};
(appats || []).forEach((a) => {
  if (a.id) nomsAppats[a.id] = a.nom || 'Appât';
});

if (captures && captures.length) {
  const annee = new Date().getFullYear();
  const prefixeSaison = annee + '-';

  const aujourdhui = new Date();
  const jourSemaine = aujourdhui.getDay();
  const decalageLundi = jourSemaine === 0 ? 6 : jourSemaine - 1;
  const lundi = new Date(aujourdhui);
  lundi.setDate(aujourdhui.getDate() - decalageLundi);
  const lundiStr = lundi.toISOString().split('T')[0];
  const prevLundi = new Date(lundi.getTime() - 7 * 86400000);
  const prevLundiStr = prevLundi.toISOString().split('T')[0];

  let totalSemaine = 0;
  let totalSemainePrecedente = 0;
  let totalSaison = 0;
  const parMethode = {};
  const parAppat = {};

  captures.forEach((c) => {
    const n = c.nombre || 0;
    const d = c.date_capture || '';

    if (d >= lundiStr) {
      totalSemaine += n;
      const m = c.methode || 'Inconnue';
      parMethode[m] = (parMethode[m] || 0) + n;

      if (c.methode === 'Piège' && c.appat_id) {
        const nomAppat = nomsAppats[c.appat_id] || 'Appât';
        parAppat[nomAppat] = (parAppat[nomAppat] || 0) + n;
      }
    } else if (d >= prevLundiStr) {
      totalSemainePrecedente += n;
    }

    if (d.startsWith(prefixeSaison)) totalSaison += n;
  });

  document.getElementById('statSemaine').textContent = totalSemaine;
  document.getElementById('statSaison').textContent = totalSaison;
  document.getElementById('statSaisonLibelle').textContent = `Saison ${annee}`;

  const compareEl = document.getElementById('statSemaineCompare');
  if (compareEl) {
    const diff = totalSemaine - totalSemainePrecedente;
    if (diff > 0) {
      compareEl.innerHTML = `<span class="cmp-up">▲ ${diff} de plus</span> que la semaine dernière`;
    } else if (diff < 0) {
      compareEl.innerHTML = `<span class="cmp-down">▼ ${Math.abs(diff)} de moins</span> que la semaine dernière`;
    } else {
      compareEl.textContent = '≈ autant que la semaine dernière';
    }
  }

  let meilleureMethode = null;
  let meilleurTotal = 0;

  for (const [m, t] of Object.entries(parMethode)) {
    if (t > meilleurTotal) {
      meilleureMethode = m;
      meilleurTotal = t;
    }
  }

  if (meilleureMethode) {
    document.getElementById('statMethode').textContent = meilleureMethode;
    document.getElementById('statMethodeDetail').textContent = `${meilleurTotal} frelons cette semaine`;
  }

  let meilleurAppat = null;
  let meilleurAppatTotal = 0;

  for (const [a, t] of Object.entries(parAppat)) {
    if (t > meilleurAppatTotal) {
      meilleurAppat = a;
      meilleurAppatTotal = t;
    }
  }

  if (meilleurAppat) {
    document.getElementById('statAppat').textContent = meilleurAppat;
    document.getElementById('statAppatDetail').textContent = `${meilleurAppatTotal} frelons cette semaine · pièges`;
  }
}
