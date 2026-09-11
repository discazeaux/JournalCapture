import { supabase } from '../supabase.js';
import { initUserBar } from '../auth.js';

const editorContainer = document.getElementById('editorContainer');
const { session, profil } = await initUserBar({ elementId: 'userBar' });
const estAdmin = profil?.role === 'admin';

if (!session) {
  editorContainer.innerHTML = `
    <div class="access-denied">
      <span class="bee">🐝</span>
      Vous devez être connecté pour rédiger un article.
      <br><br>
      <a href="login.html">Se connecter</a>
    </div>
  `;
} else if (!estAdmin) {
  editorContainer.innerHTML = `
    <div class="access-denied">
      <span class="bee">🐝</span>
      Accès réservé à l'administrateur du site.
      <br><br>
      <a href="blog.html">← Retour au blog</a>
    </div>
  `;
} else {
  const params = new URLSearchParams(window.location.search);
  const slugExistant = params.get('slug');

  let articleExistant = null;
  if (slugExistant) {
    const { data: article } = await supabase
      .from('articles')
      .select('id, titre, slug, contenu, publie')
      .eq('slug', slugExistant)
      .single();

    articleExistant = article;
  }

  editorContainer.innerHTML = `
    <div class="editor">
      <div class="form-group">
        <label for="titre">Titre</label>
        <input type="text" id="titre" placeholder="Titre de l'article" required>
      </div>

      <div class="form-group">
        <label for="slug">Slug (URL)</label>
        <input type="text" id="slug" placeholder="mon-premier-article" required>
        <p class="hint">Identifiant unique utilisé dans l'URL : article.html?slug=...</p>
      </div>

      <div class="form-group">
        <label for="contenu">Contenu (Markdown)</label>
        <textarea id="contenu" placeholder="Écrivez votre article en Markdown..."></textarea>
        <p class="hint">Markdown supporté : titres, gras, listes, citations, code, images...</p>
      </div>

      <div class="actions">
        <button class="btn btn-primary" id="btnPublier">Publier</button>
        <button class="btn" id="btnBrouillon">Enregistrer en brouillon</button>
      </div>

      <div class="message" id="message"></div>
    </div>
  `;

  const titreInput = document.getElementById('titre');
  const slugInput = document.getElementById('slug');
  const btnPublier = document.getElementById('btnPublier');
  const btnBrouillon = document.getElementById('btnBrouillon');
  const message = document.getElementById('message');

  if (articleExistant) {
    document.querySelector('.header h1').innerHTML = '<span class="bee">🐝</span>Modifier un article';
    document.title = 'Modifier un article — Suivi de la pression du frelon';
    titreInput.value = articleExistant.titre || '';
    slugInput.value = articleExistant.slug || '';
    slugInput.dataset.manual = 'true';
  }

  const easyMDE = new EasyMDE({
    element: document.getElementById('contenu'),
    spellChecker: false,
    autofocus: false,
    placeholder: 'Écrivez votre article en Markdown...',
    status: ['lines', 'words', 'cursor'],
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'code', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
    minHeight: '300px',
    renderingConfig: {
      singleLineBreaks: true,
      codeSyntaxHighlighting: true
    }
  });

  titreInput.addEventListener('input', () => {
    if (!slugInput.dataset.manual) {
      slugInput.value = titreInput.value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  });

  slugInput.addEventListener('input', () => {
    slugInput.dataset.manual = 'true';
  });

  if (articleExistant) {
    easyMDE.value(articleExistant.contenu || '');
  }

  async function sauvegarder(publie) {
    const titre = titreInput.value.trim();
    const slug = slugInput.value.trim();
    const contenu = easyMDE.value().trim();

    if (!titre || !slug || !contenu) {
      message.className = 'message error';
      message.textContent = 'Veuillez remplir tous les champs.';
      return;
    }

    btnPublier.disabled = true;
    btnBrouillon.disabled = true;

    let data, error;
    if (articleExistant) {
      ({ data, error } = await supabase
        .from('articles')
        .update({
          titre,
          slug,
          contenu,
          publie
        })
        .eq('id', articleExistant.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('articles')
        .insert({
          auteur_id: session.user.id,
          titre,
          slug,
          contenu,
          publie
        })
        .select()
        .single());
    }

    if (error) {
      console.error('Erreur enregistrement:', error);
      message.className = 'message error';
      message.textContent = error.message.includes('duplicate')
        ? 'Ce slug existe déjà. Choisissez-en un autre.'
        : 'Erreur lors de l\'enregistrement : ' + error.message;
    } else {
      message.className = 'message success';
      message.textContent = publie
        ? (articleExistant ? 'Article modifié et publié avec succès !' : 'Article publié avec succès !')
        : (articleExistant ? 'Brouillon mis à jour avec succès !' : 'Brouillon enregistré avec succès !');

      if (publie) {
        setTimeout(() => {
          window.location.href = `article.html?slug=${encodeURIComponent(slug)}`;
        }, 1200);
      }
    }

    btnPublier.disabled = false;
    btnBrouillon.disabled = false;
  }

  btnPublier.addEventListener('click', () => sauvegarder(true));
  btnBrouillon.addEventListener('click', () => sauvegarder(false));
}
