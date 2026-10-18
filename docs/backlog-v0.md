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

## PKG-B4 · Les schémas recomposés par les gabarits du wizard — Sortie atteinte le 17/10

**Livré** (décision de David, 17/10 : « préférable » à la fidélité au dessin) : un schéma qui relève d'un gabarit du wizard est **recomposé** — sa structure est lue au pivot (`bloc.composition`), sa mise en page est calculée au thème, son dévoilement suit le phrasé du gabarit ; les autres restent redessinés (PKG-B2, B3).
- **Le gabarit `cas`** (`src/qualification/gabarits.ts`) : lu sur un dessin partitionné en colonnes dont chaque colonne a son bandeau numéroté et au moins deux étapes numérotées ; chaque étape garde sa manière (fond, bord plein, en tirets ou sans) et sa description (un texte nu à sa hauteur) ; la légende se lit dans le décor (échantillon et libellé, ou libellé encadré), dans l'ordre de lecture.
- **En salle** : composition HTML au thème (colonnes en regard, chevrons d'accent, badges d'étape, angles droits) ; une colonne par pas, ses étapes en cascade ; le cas occupe sa page (de 130 % à 70 % de ses corps).
- **Au rapport** : chaque dévoilement proposé et chaque recomposition est un constat à valider (règle DESSIN).

**Sortie** (49 témoins Vitest — 37 sur le dépôt, 12 sur le corpus — et 9 Playwright, verts ; fumée sur les 164 blocs : 0 erreur, 0 requête)
- Le processus S2P (17, 18) recomposé en quatre phases de 6, 6, 5 et 6 étapes ; en 18, chaque étape avec sa description ; légendes de 3 et 4 entrées.
- Les personae (19, 20), le logigramme (31) et les architectures (15, 16) restent redessinés.
- Non couvert, nommé : les fiches personae (grille couloirs × phases) → PKG-B5 ; la recomposition ne passe pas encore par le PPT de validation (PKG-C) ni par le papier (PKG-D).

---

## PKG-B5 · Les fiches personae recomposées au gabarit `tableau` — Sortie atteinte le 17/10

**Livré** (demandé par David avant PKG-C, prototypé, arrêté sur ses quatre réponses, `decisions.md`, 17/10) : le `tableau` du wizard — des lignes nommées et leur signe sous des colonnes nommées, un triangle d'alerte —, étendu aux couloirs des processus ONET.
- **La lecture** (`composerTableau`, `src/qualification/gabarits.ts`) : les phases (hautes colonnes titrées, à la couleur de leur cadre), les couloirs (bandes nommées qui les traversent, l'icône dessinée à leur gauche), les étapes placées par le point qu'elles désignent — la pastille qui les numérote, sinon la pointe de leur bulle —, leur manière, leur signal (le triangle posé dessus, le plus haut s'ils s'empilent), le portrait du persona, la légende (cases puis signaux).
- **L'harmonisation** (`harmoniser`) : une manière ou un signal que la légende ne nomme pas est ramené au plus proche qu'elle nomme — le bord d'abord (il dit qui agit), puis le fond ; chaque changement est un constat « à valider ».
- **En salle** : grille HTML au thème, phase par phase (4 pas), les étapes en cascade dans l'ordre de leurs numéros ; un lien se trace d'une étape numérotée à la suivante, mesuré après la mise en page ; la grille occupe sa page.

**Sortie** (54 témoins Vitest — 41 sur le dépôt, 13 sur le corpus — et 10 Playwright, verts ; fumée sur les 164 blocs : 0 erreur, 0 requête)
- 19 : 4 phases × 8 couloirs, 12 étapes (3 par phase), toutes à une manière de la légende.
- 20 : 13 étapes dont une sans numéro ; 12 manières et 2 signaux harmonisés (les tirets → tâche d'un tiers, les bords pleins → tâche du persona).
- Non couvert, nommé : la recomposition ne passe pas encore par le PPT de validation (PKG-C) ni par le papier (PKG-D) ; un signal noir sans équivalent en légende va au plus proche (« impact fort ») — à confirmer à la validation.

---

## PKG-B6 · Les visuels d'origine dans la salle — Sortie atteinte le 18/10

**Livré** (demande de David, 18/10) : les pictogrammes, minuteurs, icônes météo, icônes de section et photos du diaporama d'origine, dans la salle et dans le PPT de validation. Le relevé lit les SVG et ce que dessinent les dispositions ; la qualification donne à chaque visuel son rôle, sa légende, son aplat ; la salle les compose au thème ; les EMF se convertissent par LibreOffice (`src/medias/convertir.ts`).

**Sortie** (67 témoins Vitest — 52 sur le dépôt, 15 sur le corpus — et 11 Playwright, verts ; fumée : 164 blocs, 0 erreur, 0 requête ; « tous les médias sont affichables »)
- Les 12 écrans (animation, démonstration) ont leur pictogramme, sauf la météo, qui a sa galerie de quatre icônes légendées ; les minuteurs des diapositives 3, 5 et 42 ; 15 icônes de section ; les pictogrammes des mises en pratique, étapes clés, synthèse, glossaire, objectifs ; la photo de couverture.
- L'aller-retour par le PPT de validation reste exact (166 diapositives) ; la salle construite depuis le PPT est identique à l'octet à celle construite depuis le deck ; le PPT valide contre les schémas (875 parties).
- Non couvert, nommé : le décor d'origine des écrans (bandeaux, disques, ornements) n'est pas repris, le thème s'en charge ; « Votre \npromotion » garde sa coupure de ligne d'origine.

---

## PKG-C · Le PPT de validation et l'aller-retour

Découpé en trois sessions, faites : C1, la grammaire des figures et l'aller-retour ; C2, la structure des textes en
grammaire ; C3, les schémas, leur partition et leurs recompositions en grammaire.

### PKG-C1 · La grammaire des figures et l'aller-retour — Sortie atteinte le 17/10

**Livré** : le gabarit de validation généré du thème ONET (`src/emission/gabarit.ts` : un thème Office aux douze emplacements tirés des jetons du DS, Montserrat ; un masque ; une disposition `G · <Figure>` par figure, avec ses espaces Titre, Contenu, Consignes) ; `emettre` (`src/emission/emettre.ts`, écrivain OOXML propre, paquet déterministe) ; `lire` (`src/lecture/lire.ts`, sur le lecteur OOXML du relevé) ; la grammaire en un seul endroit (`src/emission/grammaire.ts`) ; les commandes `packager emettre` et `packager lire` ; `packager salle` lit un PPT de validation quand on le lui donne.
- **Sur la diapositive** : le titre ; un paragraphe par texte (ses retours à la ligne en sauts de ligne) ; captures et visuels rognés comme à l'origine (`G·capture`, `G·visuel`) ; une pastille par pas (`G·pastille`, numérotée par son texte), la zone dont elle touche le coin (`G·zone`, son ancrage dans son nom : « · légende », « · proposée ✦ » en tirets ambre), la consigne de son rang dans la liste des Consignes ; les tableaux natifs ; la diapositive masquée en masquée ; les notes.
- **Hors de la vue** : l'identifiant du bloc et sa diapositive source en étiquettes OOXML (`GRADUIS.BLOC`, `GRADUIS.SOURCE`), dupliquées avec la diapositive ; le deck hérité dans les propriétés du document ; provisoirement, les lectures heuristiques sans grammaire encore (dessin, structure, composition) en JSON dans une étiquette (`GRADUIS.LECTURES`, → C2, C3).

**Sortie** (61 témoins Vitest — 47 sur le dépôt, 14 sur le corpus — et 10 Playwright, verts)
- `lire(émettre(pivot₀)) ≡ pivot₀` sur les 166 diapositives, à l'octet : même hash de pivot (`sha256:0a33b0…`), et la salle construite depuis le PPT est identique à l'octet à celle construite depuis le deck.
- Une diapositive dupliquée est relue sans collision : la copie reçoit un identifiant neuf (au-delà du plus grand), garde sa source, et l'écart est dit.
- Une consigne retouchée ⇒ un seul bloc change, et seulement cette consigne.
- Le paquet valide contre les schémas ISO/IEC 29500 (875 parties, 0 erreur ; `scripts/valider_pptx.py`), s'ouvre dans python-pptx et se rend dans LibreOffice ; aucune couleur hors du thème (I-PKG-6).
- Non couvert, nommé : l'ouverture dans PowerPoint lui-même (à faire sur un poste) ; les notes structurées (`Durée :`, `Consigne :`…) et les propositions ✦, faute de consommateur encore.

### Les deux ingestions (David, 18/10)

L'**initiale** lit le deck hérité et produit le PPT de validation ; la **complémentaire** relit le PPT revu et modifié par ONET, à chaque itération. La complémentaire doit tolérer ce qu'ONET ajoute librement (un cadre de texte, une image, une diapositive sans disposition `G ·`) : le lire par l'heuristique de l'initiale et le signaler, plutôt que le perdre (→ C2, C3).

### PKG-C2 · La structure des textes en grammaire, et l'ingestion complémentaire — Sortie atteinte le 18/10

**Livré** : la structure d'un texte écrite en PowerPoint natif (`src/emission/structure.ts`) et relue (`src/lecture/structure.ts`) — un cadre « G·colonne r.c » par colonne, l'illustration à sa gauche, un paragraphe par nœud dans la grammaire des puces (• liste, numéros, ▸ définition, – détail au niveau 2) et des corps (intertitre 18 pt) ; l'inventaire `textes` dérivé de la structure ; l'ingestion complémentaire qui lit, plutôt que de perdre, ce qu'ONET ajoute hors grammaire.

**Sortie** (72 témoins Vitest — 57 sur le dépôt, 15 sur le corpus — et 11 Playwright, verts)
- `lire(émettre(pivot₀)) ≡ pivot₀` sur les 166 diapositives (23 blocs organisés, 7 colonnes illustrées), même hash de pivot ; le PPT valide contre les schémas (875 parties) et se rend dans LibreOffice.
- Une retouche dans une fiche ne change que son bloc (sa structure, son inventaire).
- Une zone de texte ajoutée à un texte organisé devient une rangée ; ailleurs, un texte de plus ; une image ajoutée, un visuel ; une diapositive d'un autre deck est lue par l'ingestion initiale ; chaque fois un écart est dit.
- Non couvert, nommé : le dessin des schémas, leur partition et leurs recompositions voyagent encore en étiquette (→ C3).

### PKG-C3 · Les schémas, leur partition et leurs recompositions en grammaire — Sortie atteinte le 18/10

**Livré** : le dessin réémis en formes natives (`src/emission/dessin.ts`) et relu au centième de point (`src/lecture/dessin.ts`) ; la composition `cas` ou `tableau` en formes éditables (`src/emission/composition.ts`, `src/lecture/composition.ts`) ; le dessin d'origine d'un schéma recomposé sur une diapositive annexe masquée, étiquetée « Pour contrôle uniquement » (tranché par David le 18/10) ; le dévoilement dans les noms des formes ; l'inventaire d'un schéma dérivé de ce qui le montre ; l'étiquette `GRADUIS.LECTURES` retirée.

**Sortie** (77 témoins Vitest — 62 sur le dépôt, 15 sur le corpus — et 11 Playwright, verts ; fumée : 164 blocs, 0 erreur, 0 requête)
- `lire(émettre(pivot₀)) ≡ pivot₀` sur les 166 blocs, sans aucune étiquette de lectures : 7 schémas en formes natives, dont 4 recomposés (2 `cas`, 2 `tableau`) et leurs 4 annexes ; même hash de pivot (`sha256:6ec5d3…`) ; la salle construite depuis le PPT est identique à l'octet à celle construite depuis le deck. Le PPT (170 diapositives) valide contre les schémas (887 parties, 0 erreur) et se rend dans LibreOffice ; PowerPoint l'ouvre sans erreur (par automatisation).
- Une composition retouchée se relit comme telle : une étape réécrite, une étape déplacée d'une case avec son signal, une étape recolorée d'une couleur hors grammaire (au rôle le plus proche) ; rien d'autre ne change.
- Une forme ajoutée sur un dessin y entre, dans son repère, et l'écart est dit ; une annexe supprimée laisse la composition et l'écart est dit.
- Non couvert, nommé : le rendu dans PowerPoint lui-même, à regarder sur un poste ; les numéros des bandeaux et des étapes vivent dans les noms des formes, pas à l'écran (l'ordre se lit de haut en bas) ; les arcs de chemins libres (aucun au corpus) passent par la conversion SVG ↔ `arcTo` sans témoin corpus ; l'annexe se relit (le dessin reste la source et le repli du pivot), mais n'est pas faite pour être retouchée.

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
