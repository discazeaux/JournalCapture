import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';

const { session } = await initUserBar({ elementId: 'userBar', montrerConnexion: false });

if (!session) {
  document.querySelectorAll('.hub-protege').forEach((entry) => {
    entry.style.display = 'none';
  });
} else {
  const lienMesStats = document.getElementById('lienMesStats');
  if (lienMesStats) lienMesStats.style.display = '';

  ['lienConnexion', 'lienInscription'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const authWrap = document.querySelector('.auth-buttons');
  if (authWrap) authWrap.style.display = 'none';
}

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

  let totalSemaine = 0;
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
    }

    if (d.startsWith(prefixeSaison)) totalSaison += n;
  });

  document.getElementById('statSemaine').textContent = totalSemaine;
  document.getElementById('statSaison').textContent = totalSaison;
  document.getElementById('statSaisonLibelle').textContent = `Saison ${annee}`;

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
