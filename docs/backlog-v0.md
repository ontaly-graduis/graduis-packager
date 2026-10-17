# Backlog v0 — Graduis Packager

Ce qui reste à faire, session par session. Chaque session a ses « À trancher au démarrage » et sa « Sortie », vraie quand ses témoins sont verts.

**Ordre** : PKG-0 → PKG-A → PKG-B → PKG-B2 → PKG-C → PKG-D → PKG-E. B, B2 et C ne dépendent que du pivot.

---

## PKG-0 · Le relevé (ingestion héritée, lecture seule) — Sortie atteinte le 17/10

**Livré** : `npm run packager -- relever <deck.pptx> [--sortie <dossier>]` → `releve.json` (schéma `graduis/releve@0` : par diapositive, la disposition, les formes aplaties en boîtes absolues — groupes et espaces réservés hérités résolus —, les textes, les notes, les liens et le pas-à-pas apparié) + les médias hashés (`medias/<sha256>.<ext>`) + les mesures. Le lecteur OOXML (`src/ooxml/`) est celui que réutilisera `lire` (PKG-C).

**Sortie** (témoins verts : 7 sur la fixture synthétique, 4 sur le corpus)
- Deux relevés du deck acheteur ⇒ même empreinte.
- Parité avec `scripts/releve_pptx.py` : toutes les mesures du § 0.2 et la table des séquences du § 0.3, à l'unité près.
- Appariement par numéro : 130 pas, dont 101 paires repère-légende ; 126 avec consigne (97 %) ; 110 complets, zone et consigne (85 %). Les 20 incomplets (diapos 40, 54, 55, 64, 79, 82, 83, 85 à 88, 100, 148, 152) sont des légendes sans repère sur l'image, ou des repères sans légende ni texte voisin.
- Médias à convertir pour la salle : un seul EMF (une icône, diapo 54). Aucun objet OLE dans les diapositives : les 13 autres EMF et les 3 OLE vivent dans les masques, qui ne sont pas repris.

---

## PKG-A · Qualification, pivot et diagnostics — Sortie atteinte le 17/10

**Livré** : `npm run packager -- qualifier <deck.pptx>` → `releve.json`, `seance-spec.json` (pivot₀, validé par son schéma Zod), `rapport.json` et `rapport.html` (au thème ONET, autonome). Le schéma `graduis/seance-spec@0` (`src/pivot/`) ; la qualification par règles (`src/qualification/`) ; les règles H1–H9 et l'état des pas (`src/diagnostic/`).

**Sortie** (20 témoins verts : 12 sur le dépôt, 8 sur le corpus)
- Les 166 diapositives qualifiées, chacune avec sa figure, son temps et le signal qui l'a décidée (au rapport) : couverture 1, écrans d'animation 10, transitions 13, objectifs 1, contenus 15, processus 2, schémas 6, démonstrations 3, pas-à-pas 61, captures 37, mises en pratique 8, étapes clés 6, synthèse 1, glossaire 1, renvoi 1.
- Les six séquences opératoires portent leurs trois temps ; la séquence « Navigation dans la gestion des commandes » n'a ni mise en pratique ni étapes clés (H1).
- Pas : 130, dont 108 ancrés par repère, 6 par légende, 13 par zone proposée ; 3 sans zone, 4 sans consigne.
- Le rapport retrouve les anomalies du § 0.3 : les 5 marqueurs (H8, bloquants), la numérotation des transitions (H4), le cas 3 qui reprend l'énoncé du cas 2 (H6, malgré la coquille « Tra,sformer »), les démonstrations absentes (H1), les séquences déséquilibrées (H9), 34 écrans denses (H2), 35 captures sous-résolues et 37 captures muettes (H5).
- Le pivot est stable au hash, et le rapport ne contient aucun hex hors jetons.

---

## PKG-B · La salle (sortie prioritaire) — Sortie atteinte le 17/10

**Livré** : `npm run packager -- salle <deck.pptx> [--sequences s030,…] [--devoilement pastille|ecran]` → `salle.html`, un fichier unique (thème, polices, données, médias et lecteur inline). Le lecteur (`src/salle/lecteur/`, TypeScript sans framework, regroupé par esbuild) : scène 1920 × 1080 à l'échelle, une composition par figure, dévoilement pastille par pastille avec projecteur sur la zone courante, zoom sur la zone (Z), minuteur (T), écran noir (B), notes en surimpression (N), plein écran (F), présentateur dans une seconde fenêtre (P), ancre de reprise (`#b034.2`). La salle dérive la `RegionMap` du wizard des pas du pivot. Tests navigateur : `npm run test:navigateur` (Playwright ; `PW_CHROMIUM` désigne un Chromium déjà installé).

**Sortie** (25 témoins Vitest, dont 8 sur le corpus ; 3 témoins Playwright en `file://`)
- La séquence 30–58 jouée hors ligne dans Chromium : aucune requête réseau, aucune erreur ; le présentateur s'ouvre et pilote la salle.
- Même pivot et même prise ⇒ même fichier, à l'octet (5,8 Mo pour la séquence 30 ; 25,6 Mo pour le deck entier).
- Aucun hex hors jetons ; aucune ressource distante.
- Les captures rognées sont rejouées rognées ; le seul média non affichable est l'icône EMF de la diapo 54.
- Revue visuelle : la diapo 31, un logigramme dessiné avec un petit tableau de légende, passe de « processus » à « schéma » (la règle du dessin précède celle du tableau : processus 1, schémas 7) ; une mise en pratique « À vous de jouer » prend son énoncé pour titre.
- Non couvert, nommé : Edge et Firefox (seul Chromium est joué) ; les schémas dessinés n'ont pas encore de rendu (PKG-B2, depuis livré) ; les infobulles de glossaire attendent H7.
- **Polish permanent (David, 17/10)**, livré le même jour : le mouvement du thème ONET (entrées en cascade, dévoilement de l'item courant, apparition des zones et des encadrés, volet de séquence) ; le défilement des contenus qui débordent (la pile suit l'item courant d'un dévoilement ; un contenu statique se lit page par page, avec fondus et indice de suite ; le présentateur s'aligne). 28 témoins Vitest, 5 Playwright.

---

## PKG-B2 · Les schémas au thème — Sortie atteinte le 17/10

**Livré** : les schémas dessinés en formes sont **redessinés au pivot** (`bloc.dessin` : formes du catalogue DrawingML et leurs ajustements, chemins libres, traits fléchés et tiretés, textes mis en forme, images, tableaux ; en points ; couleurs en **rôles** du thème) et rendus en SVG par la salle. Le relevé lit les styles (`src/ooxml/styles.ts`, `couleurs.ts` : propriétés directes, références `p:style` au thème du deck, défauts du masque, `clrMap`, modificateurs) ; la qualification projette les couleurs (`src/qualification/roles.ts`, `dessin.ts`) ; le rendu est un module pur (`src/dessin/` : géométries, SVG) ; le thème ONET gagne sa palette de schéma (`dessin.css`) et sa table de chasse (`chasse.json`). Avec ce lot : l'aide de la salle (bouton « ? », touche ?), demandée par David.

**Sortie** (40 témoins Vitest — 31 sur le dépôt, 9 sur le corpus — et 7 Playwright, verts)
- Les 7 schémas du deck acheteur (diapositives 15 à 20, 31) redessinés : 24 à 144 éléments chacun, toutes leurs géométries prises en charge, aucun texte hors de sa forme à 1920 px, aucune requête réseau.
- Aucune couleur au pivot ni hex hors jetons dans la salle ; deux constructions identiques à l'octet.
- Les couleurs d'origine se fondent ou se distinguent selon la règle du 17/10 ; le rapport le dit schéma par schéma (règle DESSIN : 7 constats d'information, aucune confusion restante sur le deck acheteur).
- Non couvert, nommé : les styles de tableau nommés, les ombres, la rotation et le retournement d'un groupe (absents du corpus), les chemins libres à formules (absents du corpus : dessinés en rectangle et signalés), les puces des textes de formes. La relecture visuelle des 7 schémas par ONET se fera dans le PPT de validation (PKG-C), qui réémettra le dessin en formes natives.

---

## PKG-B3 · L'organisation des textes et les schémas joués — Sortie atteinte le 17/10

**Livré** : demandé par David avant PKG-C, prototypé, puis arrêté sur ses cinq réponses (`decisions.md`, 17/10).
- **Les textes** (`src/qualification/structure.ts`, `bloc.structure`) : rangées et colonnes de cadres ; fiches (cadres empilés) et fiches illustrées (une icône ou un portrait qui touche un cadre) ; intertitres, paragraphes, listes et leurs détails, définitions ; liste numérotée dans l'ordre des pastilles quand l'auteur a numéroté (étapes clés). Lus sur la graisse, le corps, les puces, les niveaux, les deux-points, les numéros ; la graisse en ligne gardée. En salle : fiches au thème, définitions en deux colonnes, dévoilement par niveau 1, resserrement jusqu'à 76 % avant de défiler.
- **Les schémas** : la manière du thème (`maniere.json` : coins droits, deux traits, trois corps, badges d'étape) ; la partition (`src/qualification/partition.ts`) par colonnes rangées par leurs numéros, ou par étapes numérotées (traits qui suivent le flux, décisions et leurs « Oui / Non ») ; en salle, chaque pas se trace (les traits courent, puis aplats et textes), les pas joués restent pleins.

**Sortie** (45 témoins Vitest — 34 sur le dépôt, 11 sur le corpus — et 8 Playwright, verts)
- Les 7 schémas : 5 partitionnés (17 à 20 en 4 colonnes, 31 en 9 étapes), 2 d'un bloc (15, 16 : architectures sans colonnes) ; le décor (couloirs, légende) visible dès l'entrée.
- Les étapes clés dans l'ordre de leurs numéros ; les statuts en définitions ; les rôles S2P en quatre fiches illustrées.
- Non couvert, nommé : la structure et la partition ne passent pas encore par le PPT de validation (PKG-C) ; le papier ne les rend pas encore (PKG-D).

---

## PKG-B4 · Les schémas recomposés par les gabarits du wizard

**Livrer** (décision de David, 17/10 : « préférable » à la fidélité au dessin) : quand un schéma relève d'un gabarit du wizard (`parcours`, `cas`, `tableau`, `trame`, `ensembles`), il est **recomposé** : sa structure est lue au pivot, sa mise en page est calculée au thème, son dévoilement suit le phrasé du gabarit. Les autres restent redessinés (PKG-B2, B3).

**Candidats mesurés** : le processus S2P (17, 18) est un `cas` à quatre colonnes numérotées, chacune une suite d'étapes numérotées, chaque étape d'une nature (tâche Oracle, action automatique, action manuelle : la légende) et, en 18, d'une description ; les fiches personae (19, 20) sont une grille couloirs × phases ; le logigramme (31) et les architectures (15, 16) n'ont pas de gabarit et restent redessinés.

**À trancher au démarrage**
- Le rendu : SVG calculé comme au wizard (le texte se coupe sur des métriques de police), ou composition HTML au thème (le navigateur coupe le texte avec la vraie police) — même structure et même phrasé dans les deux cas.
- Ce qui s'ajoute aux structures du wizard : la nature d'une étape (et sa légende), la description d'une étape, l'en-tête numéroté d'une colonne.

---

## PKG-C · Le PPT d'auteur et l'aller-retour

**Livrer** : le gabarit d'auteur, généré du thème ONET (dispositions `G · …`, pastille, zone, espaces réservés « Consignes ») ; `emettre` (pivot → PPTX) ; `lire` (PPTX → pivot) ; les identifiants en étiquettes OOXML ; les propositions ✦ en notes. Mesuré en PKG-0 : pptxgenjs n'écrit `<a:noFill/>` que par `addText` ; une zone s'émet donc en `addText("")` avec un trait.

**À trancher au démarrage**
- Le nom de l'objet : « PPT d'auteur » (spec) ou « PPT de validation » (le mot de David, 17/10).
- Le dessin des schémas réémis en formes natives : aux couleurs des rôles (valeurs du thème) et en Montserrat, corps compensés ; ce que `lire` en relit doit redonner le même dessin (I-PKG-3).
- La grammaire des lectures heuristiques (I-PKG-4) : la structure d'un texte (intertitres, listes, définitions, fiches) et la partition d'un schéma (pas et ordre de chaque élément) se montrent et se corrigent dans le PPT de validation.
- Le support des identifiants : étiquettes OOXML ou nom de diapositive ; le comportement au copier-coller.
- Le thème dans le PPT : comment la couche sémantique ONET se projette sur les 12 emplacements de couleur et les polices du thème Office.
- Le repli de police : Montserrat manque sur une partie des postes, et PowerPoint ne l'embarque pas toujours. Police embarquée, police système de repli, ou installation demandée à ONET ?
- Les animations de dévoilement dans le PPT d'animation (XML de minutage brut) : en v0 ou en option ?

**Sortie**
- `lire(émettre(pivot₀)) ≡ pivot₀` sur les 166 diapositives.
- Une diapositive dupliquée dans PowerPoint est relue sans collision d'identifiant.
- Une consigne modifiée à la main dans PowerPoint ⇒ un diff d'un seul bloc.

---

## PKG-D · Le papier

**Livrer** : `participant.pdf`, imprimé par Chromium depuis la même source que la salle — tout déplié, glossaire en annexe, recette de la couche texte (pdf.js).

**À trancher au démarrage**
- Le contenu : pas-à-pas, mises en pratique, étapes clés, synthèse, glossaire ; sans les écrans d'animation ni les démonstrations ?
- Le format : A4 portrait ; une ou deux captures par page.
- Le texte descendu de l'écran (P4) : en encadré « Pour aller plus loin », ou dans le fil ?

**Sortie**
- Le PDF de la séquence 30–58.
- Sa couche texte égale le texte du pivot (recette).
- Les captures sous-résolues signalées, pas masquées.

---

## PKG-E · Le démonstrateur

**Livrer** : la séquence 30–58 au niveau cible dans les trois sorties, propositions tranchées ; le rapport sur les 166 diapositives ; le scénario de modification (une capture remplacée dans le PPT d'auteur → chaîne rejouée → diff et trois sorties à jour) ; une répétition à blanc devant Karim et Mehdi.

**À trancher au démarrage**
- La date de la démonstration chez ONET : elle cadre tout le calendrier.
- Le niveau d'harmonisation montré : la séquence seule, ou une seconde séquence brute pour le contraste avant/après ?
- Qui joue l'animateur pendant la démonstration.

**Sortie**
- La démonstration jouée à blanc.
- Le temps humain résiduel mesuré sur la séquence, extrapolé par deck pour le chiffrage (cible : au plus un jour par deck, toutes sorties et recette comprises).

---

## Nommé, hors v0

- La production des 50 decks, par lots, contre la charte d'harmonisation validée.
- Le libre-service ONET : les équipes rejouent la chaîne elles-mêmes (l'outil vendu).
- Les modules partagés : un renvoi devient une inclusion (modifier une fois, propager).
- L'IA d'harmonisation : propositions de découpe et de reformulation, au registre.
- Les schémas régénérés (fiches personae, architecture S2P) plutôt que figés.
- Les modes de transition motion et narratif.
