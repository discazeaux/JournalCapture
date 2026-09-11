export const APP_PATHS = {
  HOME: 'index.html',
  LOGIN: 'login.html',
  BLOG: 'blog.html',
  ARTICLE: 'article.html',
  REDIGER: 'rediger.html',
  STATS: 'stat.html',
  NOUVELLE_CAPTURE: 'nouvelleCapture.html',
  SETTINGS: 'settings.html'
};

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

export const DOM_IDS = {
  USER_BAR: 'userBar',

  LOGIN: {
    FORM_CONNEXION: 'formConnexion',
    FORM_INSCRIPTION: 'formInscription',
    TAB_CONNEXION: 'tabConnexion',
    TAB_INSCRIPTION: 'tabInscription',
    MESSAGE: 'message',
    LOGIN_EMAIL: 'loginEmail',
    LOGIN_PASSWORD: 'loginPassword',
    BTN_CONNEXION: 'btnConnexion',
    LIEN_RESET_PASSWORD: 'lienMotDePasseOublie',
    INSCRIPTION_PSEUDO: 'inscriptionPseudo',
    INSCRIPTION_CODE_POSTAL: 'inscriptionCodePostal',
    INSCRIPTION_EMAIL: 'inscriptionEmail',
    INSCRIPTION_PASSWORD: 'inscriptionPassword',
    BTN_INSCRIPTION: 'btnInscription'
  },

  SETTINGS: {
    LIST_APPATS: 'listAppats',
    SECTION_SUGGESTIONS: 'sectionSuggestions',
    GRID_SUGGESTIONS: 'gridSuggestions',
    INPUT_NOUVEL_APPAT: 'inputNouvelAppat',
    BTN_TYPE_SUCRE: 'btnTypeSucre',
    BTN_TYPE_PROTEINE: 'btnTypeProteine',
    BTN_AJOUTER_APPAT: 'btnAjouterAppat',
    LIST_POSTES: 'listPostes',
    INPUT_NOM_POSTE: 'inputNomPoste',
    INPUT_TYPE_PIEGE: 'inputTypePiege',
    INPUT_NOMBRE_POSTES: 'inputNombrePostes',
    BTN_AJOUTER_POSTE: 'btnAjouterPoste',
    TOAST: 'toast'
  }
};

export const UI_MESSAGES = {
  auth: {
    emailRequired: 'Indiquez d\'abord votre email ci-dessus.',
    emailPasswordRequired: 'Veuillez remplir tous les champs.',
    invalidCredentials: 'Email ou mot de passe incorrect.',
    passwordTooShort: 'Le mot de passe doit faire au moins 6 caractères.',
    resetSent: 'Lien de réinitialisation envoyé à',
    resetSentSuffix: 'Vérifiez votre boîte mail.',
    connectionSuccess: 'Connexion réussie, redirection…',
    accountCreated: 'Compte créé ! Vous pouvez vous connecter.',
    accountPseudoError: 'Compte créé mais erreur sur le pseudo :',
    connectionErrorPrefix: 'Impossible d\'envoyer le lien : ',
    title: 'Connexion — La ruche résiste'
  },

  settings: {
    appatDeleted: 'Appât supprimé',
    appatAdded: 'Appât ajouté ✓',
    appatDefaultUpdated: 'Appât par défaut mis à jour ✓',
    recipeSaved: 'Recette enregistrée ✓',
    posteAdded: 'Poste ajouté ✓',
    posteDeleted: 'Poste supprimé',
    posteDefaultUpdated: 'Poste par défaut mis à jour ✓',
    posteActivated: 'Poste activé ✓',
    posteDeactivated: 'Poste désactivé',
    requireName: 'Donnez un nom au poste',
    deleteAppatConfirm: 'Supprimer cet appât ? Les postes liés perdront leur appât.',
    deletePosteConfirm: 'Supprimer ce poste ?'
  }
};
