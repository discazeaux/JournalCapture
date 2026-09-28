(function (global) {
  'use strict';

  function afficherBandeau(message) {
    if (document.getElementById('cookie-banner')) return;

    var b = document.createElement('div');
    b.className = 'cookie-banner';
    b.id = 'cookie-banner';
    b.setAttribute('role', 'status');

    var texte = document.createElement('p');
    texte.className = 'cookie-banner-texte';
    var lien = document.createElement('a');
    lien.href = 'confidentialite.html';
    lien.textContent = 'En savoir plus';
    texte.appendChild(document.createTextNode(message || ''));
    texte.appendChild(lien);
    b.appendChild(texte);

    var boutons = document.createElement('div');
    boutons.className = 'cookie-banner-buttons';

    var btFermer = document.createElement('button');
    btFermer.type = 'button';
    btFermer.className = 'consent-btn consent-refuse';
    btFermer.textContent = 'Fermer';
    btFermer.addEventListener('click', function () {
      b.remove();
    });

    boutons.appendChild(btFermer);
    b.appendChild(boutons);

    document.body.appendChild(b);
  }

  global.CookieBanner = { afficher: afficherBandeau };
})(window);
