export const CAUSES_PERTES_PAR_DEFAUT = [
  'Varroa',
  'Famine ou manque de réserves',
  'Maladie',
  'Intoxication ou pesticides',
  'Problème de reine',
  'Essaimage',
  'Froid ou conditions climatiques',
  'Prédation',
  'Cause non déterminée'
];

export async function chargerCausesPertes(supabase, userId) {
  const { data: causesExistantes, error: erreurChargement } = await supabase
    .from('causes_pertes')
    .select('*')
    .eq('user_id', userId)
    .order('ordre')
    .order('nom');

  if (erreurChargement) {
    console.error(erreurChargement);
    return CAUSES_PERTES_PAR_DEFAUT.map((nom, ordre) => ({ nom, ordre }));
  }

  if (causesExistantes?.length) return causesExistantes;

  const causesParDefaut = CAUSES_PERTES_PAR_DEFAUT.map((nom, ordre) => ({
    user_id: userId,
    nom,
    ordre
  }));
  const { data: causesInserees, error: erreurInsertion } = await supabase
    .from('causes_pertes')
    .insert(causesParDefaut)
    .select('*');

  if (erreurInsertion) {
    console.error(erreurInsertion);
    return CAUSES_PERTES_PAR_DEFAUT.map((nom, ordre) => ({ nom, ordre }));
  }

  return causesInserees || causesParDefaut;
}
