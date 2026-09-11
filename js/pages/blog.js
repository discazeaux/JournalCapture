import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';

const articlesEl = document.getElementById('articles');
const { session, profil } = await initUserBar({ elementId: 'userBar' });
const estAdmin = profil?.role === 'admin';

if (estAdmin) {
  const { data: brouillons } = await supabase
    .from('articles')
    .select('id, titre, slug, created_at')
    .eq('publie', false)
    .order('created_at', { ascending: false });

  if (brouillons && brouillons.length > 0) {
    const brouillonsHtml = brouillons.map((b) => {
      const date = new Date(b.created_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return `
        <a class="brouillon-card" href="rediger.html?slug=${encodeURIComponent(b.slug)}">
          <div>
            <h3>${escapeHtml(b.titre || 'Sans titre')}</h3>
            <div class="date">${date} — brouillon</div>
          </div>
          <span class="edit-link">✏️ Reprendre</span>
        </a>
      `;
    }).join('');

    articlesEl.insertAdjacentHTML('afterbegin', `
      <div class="section-title">📝 Brouillons <span class="count">${brouillons.length}</span></div>
      <div class="brouillons-list">${brouillonsHtml}</div>
    `);
  }
}

const { data: articles, error } = await supabase
  .from('articles')
  .select('id, titre, slug, created_at, contenu')
  .eq('publie', true)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Erreur chargement articles:', error);
  articlesEl.insertAdjacentHTML('beforeend', '<div class="empty">Erreur lors du chargement des articles.</div>');
} else if (!articles || articles.length === 0) {
  articlesEl.insertAdjacentHTML('beforeend', `
    <div class="empty">
      <span class="bee"><img class="bee-svg" src="img/rucher2.png" alt="Ruche" aria-label="Ruche"></span>
      Aucun article publié pour le moment.
    </div>
  `);
} else {
  articlesEl.insertAdjacentHTML('beforeend', articles.map((a) => {
    const date = new Date(a.created_at).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const excerpt = marked.parse(a.contenu || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);

    return `
      <a class="article-card" href="article.html?slug=${encodeURIComponent(a.slug)}">
        ${estAdmin ? `<span class="article-actions" data-slug="${encodeURIComponent(a.slug)}">✏️ Modifier</span>` : ''}
        <h2>${escapeHtml(a.titre)}</h2>
        <div class="date">${date}</div>
        <p class="excerpt">${excerpt}...</p>
      </a>
    `;
  }).join(''));

  document.querySelectorAll('.article-actions').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `rediger.html?slug=${btn.dataset.slug}`;
    });
  });
}
