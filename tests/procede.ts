// Le procédé ONET, chargé pour les témoins : la fixture synthétique imite son gabarit, le corpus est son deck.
import { chargerProcede } from "../src/procede/procede";

export const ONET = chargerProcede("procedes/onet-boost.json");
export const PROFIL = ONET.profil;
/** Ce que le diagnostic tient du procédé. */
export const CADRE = { charte: ONET.procede.charte, profil: ONET.profil };
