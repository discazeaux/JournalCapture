export const TRAITEMENTS_PAR_DEFAUT = [
  'Acide oxalique',
  'Acide formique',
  'Thymol',
  'Lanières anti-varroa',
  'Traitement contre la nosémose'
];

export async function chargerTraitementsPossibles(supabase, userId) {
  const { data: traitementsExistants, error: erreurChargement } = await supabase
    .from('traitements_possibles')
    .select('*')
    .eq('user_id', userId)
    .order('ordre')
    .order('nom');

  if (erreurChargement) {
    console.error(erreurChargement);
    return TRAITEMENTS_PAR_DEFAUT.map((nom, ordre) => ({ nom, ordre }));
  }

  if (traitementsExistants?.length) return traitementsExistants;

  const traitementsParDefaut = TRAITEMENTS_PAR_DEFAUT.map((nom, ordre) => ({
    user_id: userId,
    nom,
    ordre
  }));
  const { data: traitementsInserees, error: erreurInsertion } = await supabase
    .from('traitements_possibles')
    .insert(traitementsParDefaut)
    .select('*');

  if (erreurInsertion) {
    console.error(erreurInsertion);
    return TRAITEMENTS_PAR_DEFAUT.map((nom, ordre) => ({ nom, ordre }));
  }

  return traitementsInserees || traitementsParDefaut;
}
