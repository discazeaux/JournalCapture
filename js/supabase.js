/*
 * ============================================================
 *  Client Supabase partagé — JournalCapture
 *  ============================================================
 *  Module unique créant UN SEUL client Supabase, exposé sur
 *  `window.supabase`. Toutes les pages l'importent au lieu de
 *  recréer leur propre client, ce qui évite la duplication et
 *  les doubles vérifications de session.
 *
 *  Prérequis : <script src="js/config.js"> doit être chargé avant
 *  ce module (il lit `window.CONFIG.SUPABASE_*`).
 * ============================================================
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

if (!window.CONFIG) {
  throw new Error('js/config.js doit être chargé avant js/supabase.js');
}

export const supabase = createClient(
  window.CONFIG.SUPABASE_URL,
  window.CONFIG.SUPABASE_ANON_KEY
);

// Expose le client sur le global pour les scripts non-module
// (ex : navigation.js) et pour un accès générique depuis la console.
window.supabase = supabase;