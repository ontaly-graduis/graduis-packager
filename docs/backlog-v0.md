# Backlog v0 — Graduis Packager

Ce qui reste à faire, session par session. Chaque session a ses « À trancher au démarrage » et sa « Sortie », vraie quand ses témoins sont verts.

**Ordre** : PKG-0 → PKG-A → (PKG-B ∥ PKG-C) → PKG-D → PKG-E. B et C ne dépendent que du pivot ; B passe en premier si l'on manque de bras (la salle est la sortie prioritaire).

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

## PKG-B · La salle (sortie prioritaire)

**Livrer** : l'effecteur de salle en fichier HTML unique, qui dérive la `RegionMap` du wizard des pas du pivot (zone → `Zone{ role: "observe", rect, step, consigne }`) — navigation au clavier et à la télécommande, dévoilement pastille par pastille, zoom sur la zone, minuteur des écrans d'animation et des mises en pratique, infobulles de glossaire, mode présentateur (notes, diapositive suivante, chrono), thème ONET (`gabarits/theme-onet/`, Montserrat embarquée), transitions didactiques.

**À trancher au démarrage**
- Le mode présentateur : seconde fenêtre pilotée par la première, ou vue présentateur sur un seul écran ?
- Le poids cible du fichier et la recompression des captures (22 Mo de médias pour ce seul deck).
- Le zoom sur les captures sous-résolues (36 sur 113) : borné, ou signalé à l'animateur ?
- Les touches : flèches, PageUp/PageDown (télécommandes), écran noir, retour.

**Sortie**
- La séquence 30–58 jouée hors ligne sur Chrome, Edge et Firefox.
- Zéro requête réseau (témoin Playwright).
- 0 hex hors jetons (témoin).
- Même pivot et même prise ⇒ même fichier, à l'octet.

---

## PKG-C · Le PPT d'auteur et l'aller-retour

**Livrer** : le gabarit d'auteur, généré du thème ONET (dispositions `G · …`, pastille, zone, espaces réservés « Consignes ») ; `emettre` (pivot → PPTX) ; `lire` (PPTX → pivot) ; les identifiants en étiquettes OOXML ; les propositions ✦ en notes. Mesuré en PKG-0 : pptxgenjs n'écrit `<a:noFill/>` que par `addText` ; une zone s'émet donc en `addText("")` avec un trait.

**À trancher au démarrage**
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
