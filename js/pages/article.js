import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';
import { escapeHtml } from '../utils/escape.js';

const container = document.getElementById('articleContainer');
const { session, profil } = await initUserBar({ elementId: 'userBar' });
const estAdmin = profil?.role === 'admin';

// Sanitise le HTML produit par le rendu Markdown (`marked.parse`).
// Le contenu des articles peut contenir du HTML brut : on neutralise
// les éventuelles balises <script> / attributs on* pour éviter le XSS.
function sanitiserMarkdown(html) {
  return String(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+href\s*=\s*("?javascript:.*?"?)/gi, ' ');
}

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

if (!slug) {
  container.innerHTML = `
    <div class="not-found">
      <span class="bee">🐝</span>
      Aucun article spécifié.
    </div>
  `;
} else {
  const { data: article, error } = await supabase
    .from('articles')
    .select('id, titre, contenu, created_at, auteur_id')
    .eq('slug', slug)
    .eq('publie', true)
    .single();

  if (error || !article) {
    console.error('Erreur chargement article:', error);
    container.innerHTML = `
      <div class="not-found">
        <span class="bee">🐝</span>
        Article introuvable ou non publié.
      </div>
    `;
  } else {
    const date = new Date(article.created_at).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    document.title = `${article.titre} — Suivi de la pression du frelon`;
    const htmlContenu = sanitiserMarkdown(marked.parse(article.contenu || ''));

    container.innerHTML = `
      <article class="article">
        <h1>${escapeHtml(article.titre)}</h1>
        <div class="meta">
          <span>🐝</span>
          <span>${date}</span>
        </div>
        <div class="content">${htmlContenu}</div>
        ${estAdmin ? `
          <div class="article-edit-bar">
            <a class="edit-btn" href="rediger.html?slug=${encodeURIComponent(slug)}">✏️ Modifier cet article</a>
          </div>
        ` : ''}
      </article>
      <section class="comments-section" id="commentsSection">
        <h2 class="comments-title">💬 Commentaires <span class="count" id="commentsCount">0</span></h2>
        <div id="commentFormArea"></div>
        <div id="commentsListArea"></div>
      </section>
    `;

    const commentFormArea = document.getElementById('commentFormArea');
    const commentsListArea = document.getElementById('commentsListArea');
    const commentsCount = document.getElementById('commentsCount');

    async function chargerCommentaires() {
      let requeteCommentaires = supabase
        .from('commentaires')
        .select('id, contenu, created_at, auteur_id, statut, profils(pseudo)')
        .eq('article_id', article.id);

      if (!estAdmin) {
        requeteCommentaires = requeteCommentaires.eq('statut', 'publie');
      }

      const { data: commentaires, error } = await requeteCommentaires
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement commentaires:', error);
        commentsListArea.innerHTML = `
          <div class="comments-empty">
            <span class="bee">🐝</span>
            Erreur lors du chargement des commentaires.
          </div>
        `;
        return;
      }

      const listeCommentaires = commentaires || [];
      commentsCount.textContent = listeCommentaires.length;

      if (listeCommentaires.length === 0) {
        commentsListArea.innerHTML = `
          <div class="comments-empty">
            <span class="bee">🐝</span>
            Aucun commentaire pour le moment. Soyez le premier à commenter !
          </div>
        `;
        return;
      }

      commentsListArea.innerHTML = `
        <div class="comments-list">
          ${listeCommentaires.map((c) => {
            const dateC = new Date(c.created_at).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const pseudo = c.auteur_id ? (c.profils?.pseudo || 'Utilisateur') : 'Anonyme';
            return `
              <div class="comment-item" data-id="${c.id}">
                <div class="comment-header">
                  <span class="comment-author">
                    <span class="bee-small">🐝</span>
                    ${escapeHtml(pseudo)}
                    ${estAdmin && c.statut === 'en_attente' ? '<span class="comment-pending">À modérer</span>' : ''}
                  </span>
                  <div class="comment-actions">
                    <span class="comment-date">${dateC}</span>
                    ${estAdmin && c.statut === 'en_attente' ? `<button class="approve-btn" data-id="${c.id}">Valider</button>` : ''}
                    ${estAdmin ? `<button class="delete-btn" data-id="${c.id}">🗑️ Supprimer</button>` : ''}
                  </div>
                </div>
                <div class="comment-body">${escapeHtml(c.contenu)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      if (estAdmin) {
        document.querySelectorAll('.approve-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            const { error: errValidation } = await supabase
              .from('commentaires')
              .update({ statut: 'publie' })
              .eq('id', btn.dataset.id);

            if (errValidation) {
              alert('Erreur lors de la validation : ' + errValidation.message);
              btn.disabled = false;
            } else {
              chargerCommentaires();
            }
          });
        });

        document.querySelectorAll('.delete-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (!confirm('Supprimer ce commentaire ?')) return;

            const { error: errDel } = await supabase
              .from('commentaires')
              .delete()
              .eq('id', id);

            if (errDel) {
              alert('Erreur lors de la suppression : ' + errDel.message);
            } else {
              chargerCommentaires();
            }
          });
        });
      }
    }

    commentFormArea.innerHTML = `
      <div class="comment-form">
        <textarea id="commentTextarea" placeholder="Écrivez votre commentaire…" maxlength="1000"></textarea>
        <div class="form-footer">
          <span class="hint">${session ? 'Maximum 1000 caractères' : 'Votre pseudo sera affiché comme Anonyme. Publication après modération.'}</span>
          <button class="submit-btn" id="btnCommenter">${session ? 'Publier' : 'Envoyer'}</button>
        </div>
        <div class="form-message" id="commentMessage" aria-live="polite"></div>
      </div>
    `;

    document.getElementById('btnCommenter').addEventListener('click', async () => {
        const textarea = document.getElementById('commentTextarea');
        const message = document.getElementById('commentMessage');
        const btn = document.getElementById('btnCommenter');
        const contenu = textarea.value.trim();

        if (!contenu) {
          message.textContent = 'Veuillez écrire un commentaire.';
          message.className = 'form-message error';
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Envoi…';

        const { error: errInsert } = await supabase
          .from('commentaires')
          .insert({
            article_id: article.id,
            auteur_id: session?.user?.id || null,
            contenu,
            statut: session ? 'publie' : 'en_attente'
          });

        if (errInsert) {
          message.textContent = 'Erreur : ' + errInsert.message;
          message.className = 'form-message error';
          btn.disabled = false;
          btn.textContent = session ? 'Publier' : 'Envoyer';
        } else {
          message.textContent = session
            ? 'Commentaire publié !'
            : 'Merci, votre commentaire sera affiché après validation par un administrateur.';
          message.className = 'form-message success';
          textarea.value = '';
          btn.disabled = false;
          btn.textContent = session ? 'Publier' : 'Envoyer';
          chargerCommentaires();
        }
    });

    chargerCommentaires();
  }
}
