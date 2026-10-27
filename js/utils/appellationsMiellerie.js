export const APPELLATIONS_MIEL_DEFAUT = [
  'Acacia',
  'Châtaignier',
  'Colza',
  'Forêt',
  'Lavande',
  'Montagne',
  'Toutes fleurs',
  'Tilleul'
];

export async function chargerAppellationsMiellerie(supabase, userId) {
  const { data: existantes, error: erreurChargement } = await supabase
    .from('miellerie_appellations')
    .select('appellation, active')
    .eq('user_id', userId);

  if (erreurChargement) {
    console.error('Erreur chargement des appellations de miel:', erreurChargement);
    return { appellations: APPELLATIONS_MIEL_DEFAUT, error: erreurChargement };
  }

  if (!existantes?.length) {
    const { error: erreurInitialisation } = await supabase
      .from('miellerie_appellations')
      .upsert(
        APPELLATIONS_MIEL_DEFAUT.map((appellation) => ({ user_id: userId, appellation, active: true })),
        { onConflict: 'user_id,appellation', ignoreDuplicates: true }
      );

    if (erreurInitialisation) {
      console.error('Erreur initialisation des appellations de miel:', erreurInitialisation);
      return { appellations: APPELLATIONS_MIEL_DEFAUT, error: erreurInitialisation };
    }

    return { appellations: APPELLATIONS_MIEL_DEFAUT, error: null };
  }

  return {
    appellations: existantes.filter((item) => item.active).map((item) => item.appellation),
    error: null
  };
}