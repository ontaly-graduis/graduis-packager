# Backlog v1 — Graduis Packager

Ce qui reste à faire, session par session (spec v1, § 10). Chaque session a ses « À trancher au démarrage » et sa « Sortie », vraie quand ses témoins sont verts.

**Ordre** : GEN-1 → MV-1 → GEN-0 → ACT-1 → ETB-1 → THM-1 → GEN-2 → GEN-3 → ACT-2 → REI-1 → ETB-2 → ETB-3 → OUV-1. Ce qui sert ONET d'abord : GEN-1 fige le procédé ONET sans rien changer à la production en cours ; MV-1 rend à la salle ses visuels EMF par une première montée de version explicite ; GEN-0 mesure avant de spécifier plus loin ; ACT-1 se joue sur la séquence de démonstration ; ETB-1 accélère la revue des decks ONET restants ; THM-1 rend le thème éditable avant le premier client nouveau. La sensibilité s'ouvre par paliers (minimale en GEN-1, moyenne en ACT-1, élevée en REI-1) ; l'ouverture aux tiers ferme la marche.

**Les indicateurs du chantier** : part des diapositives décidées aux étages 1 et 2 · heures humaines par deck, par sensibilité · coût IA par deck · taux d'acceptation par acte · écart à la source, par sensibilité · temps d'embarquement d'une famille de gabarit · mots inventés dans les activités dérivées (cible : zéro).

**La référence** : celle du procédé ONET, `golden/reference-v0.2.json` (tag `v0.2`, depuis ACT-1 ; `reference-v0.1.json`, `reference-v0.json` et leurs tags restent, comme trace) — les empreintes de la chaîne sur le deck acheteur (le deck reste hors dépôt) ; celle du procédé dupliqué en moyenne, `golden/reference-moyenne-v0.2.json`. Chaque session qui touche à la chaîne rejoue le procédé ONET contre elle (I-PKG-18), ou monte de version : rejeu, diff, décision, `rejouer --nouvelle-reference`, nouveau tag.

---

## GEN-1 · ONET hors du code, procédé ONET — Sortie atteinte le 18/10

**Livré** : le profil de source (`gabarits/profil-onet.json`, `graduis/profil-source@0`, `src/profil/`) — dispositions, formules et titres, motif de processus, habillage d'origine de la mise en pratique, marqueurs H8, projection des couleurs ; l'identité du thème (`gabarits/theme-onet/identite.json`) ; le procédé `onet-boost` (`procedes/onet-boost.json`, `graduis/procede@0`, `src/procede/`) — profil et thème épinglés par empreinte, charte, sensibilité minimale, prise, versions, référence ; l'écart à la source (`src/ecart/`), borné sur la chaîne, compté sur la revue, au manifeste (`graduis/livraison@1`) et dans `ecart.json` ; `packager rejouer <procédé> <deck> [--revue <PPT revu>] [--sequences …]` ; `--procede` sur les commandes, sans défaut. Avant le code : le tag `v0`, `golden/reference-v0.json` (deux cas, deux passes identiques, recalculée au Chromium de Playwright), le PPT revu par David figé dans `docs/sources/`.

**Tranché le 18/10** : les schémas minimaux (les conventions de forme restent dans le code) ; l'écart (le mot, par bloc, la borne sur la chaîne, la revue comptée) ; l'épinglage (tag et verrou ; moteurs notés ; Chromium de Playwright ; référence sans LibreOffice) ; l'exception nommée du lecteur de salle (option A).

**Sortie** (102 témoins Vitest — dont le rejeu du corpus — et 20 Playwright, verts)
- `packager rejouer onet-boost` sur le deck acheteur, quatre cas, conformes à la référence v0 : deck seul (qualification, PPT émis, journée refusée par les 5 marqueurs H8, séquence 30), deck et PPT revu (journée, séquence 30) — pivot, salle, PPT d'animation, couche texte du PDF, rapport, à l'octet.
- Écart mesuré : la chaîne, zéro mot inventé et ordre identique ; la revue de David, 25 mots distincts et une diapositive retirée, acceptés.
- Plus aucune mention d'ONET dans `src/` (témoin), à une exception nommée près : le texte du logo dans le lecteur de la salle (deux lignes), qui garde la salle à l'octet de v0 — le moindre changement du source renomme les variables du lecteur minifié ; elle part à MV-1.
- Non couvert, nommé : les 16 visuels EMF absents de la salle sans LibreOffice (MV-1) ; `rejouer` lit la bibliothèque courante sans pouvoir exécuter celle du tag épinglé (le compagnon, ETB-1) ; la durée, bornée seulement quand le pivot en portera une (ACT-1).

---

## MV-1 · Première montée de version du procédé ONET — Sortie atteinte le 18/10

**Livré** : les conversions EMF → SVG figées en entrée du procédé — les 8 SVG du deck acheteur (LibreOffice, VM du 18/10) dans `docs/sources/medias-converties/` (hors dépôt) avec leur manifeste `graduis/conversions@0`, au contrat du harnais `ingest-visuels` du wizard (source, chemin, empreinte, transformation, banc de serveurs conformes), épinglé au procédé (`conversions`) ; la salle et le papier les lisent avant LibreOffice ; absentes, le rejeu le dit ; changées, refusées (G-4) ; le texte du logo de la salle au nom du thème (fin de l'exception de GEN-1) ; `rejouer --nouvelle-reference` ; `golden/reference-v0.1.json` et le tag `v0.1`.

**Tranché le 18/10** : les SVG de la VM figés, sans installer LibreOffice ; le contrat du harnais du wizard repris dès maintenant, son producteur (la conversion comme capacité du compagnon partagé) à ETB-1 ; le tag `v0.1` et la référence écrite par le rejeu ; le diff accepté d'avance (les salles, les octets des PDF).

**Sortie** (105 témoins Vitest et 20 Playwright, verts)
- Le rejeu sur la nouvelle version contre v0 : trois empreintes de salle changent, et rien d'autre — les EMF embarqués, le lecteur renommé (même programme) ; PDF : couche texte, pages et recette identiques. Accepté (décision du 18/10) ; référence v0.1 écrite par le rejeu ; les quatre cas conformes à v0.1.
- Les 16 visuels EMF présents dans la salle de la journée (8 médias sur 8).
- Le témoin « aucune mention d'ONET dans `src/` » sans exception.
- Non couvert, nommé : la version de LibreOffice qui a produit les SVG n'a pas été notée sur la VM ; reconvertir un EMF nouveau demande encore LibreOffice sur le poste (ou le compagnon, ETB-1).

---

## GEN-0 · Corpus d'épreuve — Sortie atteinte le 19/10

**Livrer** : 8 à 10 decks hors ONET, d'au moins trois gabarits et trois familles (procédural logiciel, comportemental, réglementaire ou métier) ; le relevé étendu (SmartArt, graphiques natifs, ordre des animations, paires question → réponse) ; un tableau comparé.

**Livré** : le corpus, hors dépôt (`docs/sources/corpus/`, manifeste `graduis/corpus@0`, decks et profil épinglés) — dix decks au tableau (473 diapositives), cinq gabarits, six clients ou éditeurs : six supports d'Ontaly (comportemental : « Conduire les transformations » ×4, « Design thinking » J1, « Coopération ») et quatre supports publics (procédural logiciel : deux ateliers de l'ANCT, Zotero à l'École du Louvre ; métier : prévention des infections du CDC), plus deux decks (« Design thinking » J2, J3) pour l'hypothèse des gabarits ; le profil neutre (`gabarits/profil-neutre.json`) ; les lectures étendues (`src/corpus/lectures.ts`, `graduis/lectures@0`, à côté du relevé, qui ne change pas) ; la vérité de terrain, un tableur par deck, préremplie, et sa page de revue (`corpus revoir` : chaque diapositive rendue par PowerPoint, un geste par figure) ; le tableau comparé (`graduis/tableau-corpus@0`, JSON et Markdown) ; `packager corpus preparer|mesurer <corpus.json>`.

**Tranché le 18 et le 19/10** : la provenance et le lieu du corpus ; aucun export Google Slides, Keynote ou Canva ; la vérité de terrain et ce qu'est une diapositive décidée ; la mesure hors chaîne (profil neutre, lectures dans un fichier à part, ni procédé, ni thème, ni charte) ; les supports publics retenus ; la paire de diapositives et la famille de gabarit ; la page de revue ; les graphies d'une figure libre comptées ensemble.

**Sortie** (124 témoins Vitest et 20 Playwright, verts ; la vérité de terrain revue par David sur les 473 diapositives, 227 corrigées)
- **Part décidée par les seules règles génériques** (profil neutre), et ce qu'en dit la vérité : procédural logiciel 64/150 décidées (42,7 %), 46 justes (30,7 % du deck, 71,9 % des décisions) ; comportemental 127/301 (42,2 %), 27 justes (9 %, 21,3 %) ; métier 0/22. Sur tout le corpus, 73 diapositives sur 473 sont décidées et justes (15 %). Le signal « capture sans pastille » fait l'essentiel des décisions et des erreurs : juste à 71 % en procédural logiciel, à 14 % en comportemental (des photos et des illustrations), sans que le format de l'image départage.
- **Figures manquantes, nommées et comptées** : `consigne-atelier` ×59 (dans les trois familles, une fois écrite « autre : consignes d'ateliers »), `graphique` ×11 (des images de graphiques ; aucun graphique natif), « questions d'introspection / métacognitives » ×8 (hors des candidates du § 4.5, quatre graphies), « points clés » ×3, `video` ×3 ; aucune citation, chiffre clé, comparaison, chronologie, quiz ni programme dans ce corpus. Et des figures connues que rien ne décide : 58 transitions (aucune décidée, faute de profil), 13 objectifs (dont 11 laissés au repli).
- **L'hypothèse « peu de gabarits par client », confrontée** : chaque client garde une seule famille de gabarit (« Conduire les transformations » : 4 decks, 3 empreintes ; « Design thinking » : 3 decks, 3 empreintes ; ANCT : 2 decks, 1 empreinte), mais l'empreinte exacte change d'un deck à l'autre. Les decks partis du modèle Office par défaut n'ont pas de gabarit propre.
- **Deux suppositions du § 12, confrontées** : « hors du procédural logiciel, les règles génériques décident assez » — non (9 % de décidées et justes en comportemental, 0 en métier) ; « les decks d'un client se rangent en peu de familles » — oui, sur ce petit corpus.
- **La vérité de terrain elle-même hésite** : « Je ne suis pas entièrement satisfait de ma qualification / contre-proposition […] le problème de beaucoup de supports de formation c'est qu'ils ne sont pas qualifiés sémantiquement » (David). 207 diapositives sur 473 (44 %) restent du `contenu`, sans figure qui les dise.
- Lectures étendues : aucun SmartArt ni graphique natif ; des animations presque seulement dans « Design thinking » J1 (45 diapositives se dévoilent en deux temps ou plus, 41 dans l'ordre de lecture) ; 11 paires question → réponse et 18 dévoilements par duplication dans les ateliers de l'ANCT.
- Non couvert, nommé : les exports Google Slides, Keynote et Canva ; le réglementaire (un seul deck métier) ; SmartArt et graphiques natifs, absents du corpus ; les deux diapositives masquées de J1, absentes du rendu PDF (revues dans PowerPoint).

---

## ACT-1 · Sensibilité moyenne : activités dérivées, modes projeté et papier — Sortie atteinte le 19/10

**Livré** : `graduis/seance-spec@1` — l'activité pointe (`derivation`, `derive_de`, `duree`), le geste se dérive de la dérivation, le repli du geste ; cinq dérivations sans invention (`src/activites/` : rappel, étapes à replacer, qui fait quoi, ordre des pas, où cliquez-vous), au mélange déterministe ; en moyenne, la chaîne propose les dérivations sans choix (étapes clés, schéma partitionné par étapes, processus) ; le PPT d'auteur porte une disposition par geste (dès la moyenne seulement), l'activité telle qu'elle se jouera, son corrigé en notes, sa durée, et la relit — ajoutée à la main après sa source, retouchée (signalée, non reprise), sa source modifiée (elle suit), supprimée (elle disparaît) ; la salle les joue en deux temps, la régie au clavier (1–9, ⌫, Échap) et à la télécommande, le présentateur lit corrigé, touches et état ; le livret porte la fiche de chacune (zone d'écriture, liste à numéroter, tableau à cocher, capture à entourer), recettée ; l'écart borne la moyenne et compte activités et minutes ; le procédé `onet-boost-moyenne` (dupliqué d'`onet-boost`) et sa référence ; `onet-boost` monté en v0.2.

**Tranché le 19/10** : le procédé ONET monte de version, la démonstration se joue sur un procédé dupliqué ; le rôle « cible » est `act` en régime `find` ; les activités de la démonstration et leur repli ; la durée des activités maintenant, celle de la séance avec le déroulé ; la chaîne propose, la main ajoute ; la régie ; `seance-spec@1` ; ce qui reste hors du pivot (I-OCKHAM).

**Sortie** (139 témoins Vitest et 25 Playwright, verts)
- La séquence de démonstration jouée en salle avec quatre activités dérivées : étapes à replacer (diapositive 31, Classement de 9 étapes), qui fait quoi (diapositive 32, Catégorisation sur la colonne Outil — Oracle, DocuSign —, l'Acteur ne départageant pas), rappel des étapes clés (avant la diapositive 58), proposées par la chaîne, et un « où cliquez-vous ? » ajouté à la main après la diapositive 36 ; la régie jouée au clavier et à la télécommande (Chromium : saisies, corrigé juste ou faux, présentateur).
- **Zéro mot inventé** : mesuré sur les huit activités de la journée (43 minutes) et sur ce que la salle affiche (témoin navigateur : aucun mot hors de la source et de l'habillage).
- **Le repli papier de chacune** : la fiche au livret, imprimée par Chromium, recettée (s030 : 26 pages, 310 lignes sur 310).
- L'aller-retour des activités sur les 166 diapositives : `lire(émettre(pivot₀)) ≡ pivot₀`, sans écart (I-PKG-3).
- `onet-boost` en v0.2 : relevé, PPT de validation et d'animation, couche texte du PDF identiques à v0.1 ; le pivot ne change que par le libellé de son schéma, les rapports par l'empreinte du pivot qu'ils citent, la salle par son lecteur (script, et 52 règles de feuille ajoutées, aucune retirée) ; les quatre cas conformes à `reference-v0.2.json`.
- Non couvert, nommé : la séance jouée par un animateur devant une salle (la démonstration chez ONET) ; la durée de la séance et sa borne (ACT-2) ; positionnement et terme ↔ définition (ACT-2) ; les cartons A–D (avec la première Sélection) ; une activité réécrite dans PowerPoint (l'activité fixée, avec `contenu`) ; plus de neuf éléments à saisir au clavier.

---

## ETB-1 · Établi : revue et lots

**Livrer** : le compagnon local, la file de décisions, l'avant / après, la mesure du temps, les lots.

**À trancher au démarrage**
- L'hébergement (Arb-2) : local, servi par le compagnon, ou hébergé d'emblée.
- La pile de l'établi (interface web locale) et sa couture sur la bibliothèque (I-PKG-16).
- Les vignettes des diapositives héritées : par quel moteur (LibreOffice est absent du poste de David), et leur cache.
- Le protocole de comparaison avec la revue dans PowerPoint (Arb-3) : même deck, même relecteur ou non, ce qui se mesure (temps, qualité).
- La conversion des médias que le navigateur n'affiche pas (EMF → SVG) comme capacité déclarée du compagnon partagé — celui du wizard, son banc de serveurs conformes, couture jamais fork — produisant l'artefact `graduis/conversions@0` repris en MV-1 ; ce qui retire du packager l'appel synchrone à LibreOffice. Et la vectorisation vtracer du harnais (verdict de qualité), si la revue doit vectoriser des captures de schémas (MV-1, décision du 18/10).

**Sortie**
- Un deck ONET complet revu dans l'établi ; temps et qualité de revue comparés à ceux de la revue dans PowerPoint (tranche Arb-3).

---

## THM-1 · Éditeur de thème

**Livrer** : `theme.json` (`graduis/theme@1`) et le thème ONET converti ; l'écran Thèmes (chargement, paramètres, aperçu des trois sorties, export) ; les contrôles (schéma, contraste, cartons sans couleur, licences de police, 0 hex hors jetons).

**À trancher au démarrage**
- La source du schéma `graduis/theme@1` (copie avec provenance depuis le wizard, comme A-2) et ce que le packager y ajoute (rôles du dessin, des activités, réglages de salle) sans le forker.
- Les seuils des contrôles : contraste aux distances de projection (au moins AA), corps minimal à distance.
- La vérification des licences d'embarquement des polices.
- Le thème tiré du deck (`sp-tokens`) : dans THM-1, ou après le relais IA (GEN-3), puisque tout acte IA passe par le registre (I-PKG-8) ?

**Sortie**
- Le thème ONET rechargé depuis son `theme.json` ⇒ sorties identiques à l'octet.
- Un thème nouveau créé et validé en moins d'une heure.
- Un `theme.json` du wizard chargé sans conversion.

---

## GEN-2 · Figures en modules

**Livrer** : une figure = un module ; les figures retenues en GEN-0 ; les trois cercles.

**À trancher au démarrage**
- Le catalogue (Arb-6) : trois cercles (référence, client, projet), ou un catalogue fermé.
- Le contrat d'un module de figure (pivot, émission, lecture, salle, papier, diagnostics) et où vivent les figures d'un cercle client (`cas` et `tableau` d'ONET).
- Les médias lourds (Arb-8), si `video` entre au catalogue : embarquer, lier, ou poser à côté.
- **Les lectures étendues au relevé** (révélé par GEN-0) : `graduis/lectures@0` vit à côté du relevé, hors de la chaîne. Quand une règle les lit (ordre des animations → partition d'un contenu ; paire question → réponse → `quiz` ; SmartArt → schéma sans deviner ; graphique natif → `graphique`), entrent-elles au relevé (`releve@1`, montée de version du procédé ONET) ou restent-elles un fichier compagnon épinglé ?
- **Les figures que GEN-0 révèle** : `consigne-atelier` (59, dans les trois familles) en tête ; `graphique` (11, des images de graphiques à redessiner, pas des graphiques natifs) ; « questions d'introspection / métacognitives » (8, hors des candidates) ; « points clés » (3 : une figure, ou des `etapes-cles` sans leur disposition ?) ; `video` (3). Lesquelles entrent au cercle de référence, et celles que ce corpus n'a jamais vues (citation, chiffre clé, comparaison, chronologie, quiz, programme) y restent-elles candidates ?
- **Le dévoilement par duplication** (révélé par GEN-0) : une chaîne de diapositives qui se reprennent en ajoutant chacune un élément (ateliers de l'ANCT) est-elle un seul bloc partitionné, comme une animation, ou autant de blocs ?

**Sortie**
- I-PKG-3 sur tout le corpus d'épreuve.

---

## GEN-3 · Cascade et relais IA

**Livrer** : les cinq étages ; le relais (routage, lots, cache, mémoïsation, coûts) ; l'éval de qualification tirée des décisions ONET.

**À trancher au démarrage**
- Inférence et données du client (Arb-5) : API mondiale sous consentement, ou point d'accès européen (+ 10 %) ; le consentement d'ONET.
- Les seuils de confiance de chaque étage (Arb-7).
- Le format du registre et des mémos (clé : entrée canonique, prompt versionné, modèle), et leur place dans le procédé.
- Le plafond de budget par lot (G-6).
- **Le rattachement d'un deck à son profil** (révélé par GEN-0) : l'empreinte exacte du gabarit (§ 4.3) ne tient pas d'un deck à l'autre d'un même client (4 decks, 3 empreintes ; 3 decks, 3 empreintes). Rattacher par ressemblance (noms de dispositions et images des masques, comme le tableau comparé), et à quel seuil ?
- **Le signal « capture sans pastille »** (révélé par GEN-0) : il décide 156 des 191 diapositives décidées du corpus ; juste à 71 % en procédural logiciel, à 14 % en comportemental, sans que le format de l'image départage. Le réserver au procédural (par la famille du profil), ou en laisser la décision à l'étage 3 ?
- **Des règles génériques que la vérité de GEN-0 suggère** : la disposition d'en-tête de section (noms Office, français et anglais) → `transition` aurait trouvé 32 des 58 transitions, avec 15 erreurs ; « objectif » dans le titre → `objectifs`, 5 justes pour 1 erreur. À l'étage 2, à l'étage 1 d'un profil par défaut, ou à l'étage 3 ? (Mesurées sur le corpus qui les suggère : à revalider sur d'autres decks.)
- **Une vérité de terrain qui hésite** (GEN-0) : un seul relecteur, insatisfait de sa propre qualification, et 44 % de `contenu`. L'éval de qualification se fait-elle à deux relecteurs (accord mesuré), et que vaut une décision contre une vérité incertaine ?
- **La projection des couleurs par défaut** : le profil neutre reprend celle d'ONET ; la confirmer comme défaut Graduis ou la régler sur le corpus d'épreuve.

**Sortie**
- Une famille nouvelle profilée en une demi-journée humaine.
- Coût IA par deck mesuré.
- Rejouer un lot n'appelle aucun modèle.

---

## ACT-2 · Activation, frise, activités générées

**Livrer** : H10 à H13, le budget de séance, la frise, les propositions ✦ d'activités générées.

**À trancher au démarrage**
- Les seuils de départ (Arb-7) : H10 (15 minutes ?), la tolérance de H13.
- La posture par défaut de la prise (`didactic` ou `facilitator`) et son chrome.
- Les deux decks de la mesure.
- **La durée de la séance** (reportée d'ACT-1, décision du 19/10) : elle entre au pivot avec la source qui la porte — le déroulé (§ 4.2), d'où `sources` —, et avec elle la borne de durée de la moyenne (± 10 % proposé) ; ONET ne la dit qu'en texte (« Durée : 2 jours • Horaires : 9h – 17h ») : la lire en proposition, ou attendre le déroulé ? Combien de minutes vaut une journée ?
- **Les dérivations reportées d'ACT-1** : positionnement (les objectifs, en ouverture et en clôture : le comptage 1–4 de la régie, la place de la clôture) ; terme ↔ définition (un glossaire structuré : ONET l'écrit en alternance terme / définition, sans structure lue).
- **Les dérivations d'un pas-à-pas** : H10 choisira lequel activer ; « dans quel ordre ? » ne vaut que pour des pas qui sont des actions — beaucoup de pas ONET décrivent des zones de l'écran (b034 : « Barre de recherche et filtres… ») : une règle, ou le choix humain ?
- **La place du rappel** (H11) : la chaîne le pose avant ses étapes clés, qui redisent ensuite la liste que son corrigé vient de dévoiler ; le garder, ou faire du rappel le dévoilement même des étapes clés ?
- **L'activité fixée** : `contenu` au pivot (activités générées, et activité réécrite dans PowerPoint, que `lire` signale aujourd'hui sans la reprendre).
- **Les cartons A–D** du livret, avec la première Sélection (vrai / faux à distracteurs ✦, ou quiz hérité de GEN-2) ; et la dérogation de mode (projeté / papier) par activité, sans appelant en ACT-1.

**Sortie**
- Taux d'acceptation des activités proposées, mesuré sur deux decks.

---

## REI-1 · Sensibilité élevée

**Livrer** : la réécriture proposée (objectifs, consignes, registre), la réorganisation des séquences, les activités générées, la frise comme surface de conception, les bornes et la revue de l'élevée.

**À trancher au démarrage**
- La séquence du corpus d'épreuve à réingénierer, et son valideur pédagogique désigné.
- Les prompts de l'Agency (`sp-cadrage`, `sp-fragments`) : repris avec provenance, ou appelés.
- La trace d'un retrait (annexe du rapport, P4).

**Sortie**
- Une séquence du corpus d'épreuve réingénierée ; chaque écart tracé ; le temps de revue mesuré, qui fait le prix de l'élevée.

---

## ETB-2 · Établi : projets, procédés, charte, IA

**Livrer** : les écrans Projets, IA et Journal ; la duplication d'un procédé ; le devis tiré du relevé.

**À trancher au démarrage**
- Le calibrage du devis (relevé × temps de revue mesuré) et ce qu'il montre au client.
- Le format du journal d'un projet (§ 7.2) et son lien à `decisions.md`.

**Sortie**
- Un client nouveau embarqué de bout en bout dans l'établi, par duplication d'un procédé, devis compris.

---

## ETB-3 · Retour du client

**Livrer** : la fusion à trois voies.

**À trancher au démarrage**
- Ce qu'est un conflit au grain du bloc (même champ modifié des deux côtés ? bloc déplacé et modifié ?) et son affichage dans la file.

**Sortie**
- Un PPT modifié par le client, relu et fusionné ; les conflits au grain du bloc, dans la file.

---

## OUV-1 · Ouverture aux tiers

**Livrer** : les rôles et le cloisonnement, le journal, les garde-fous G-1 à G-12, les budgets, l'export complet, la documentation du gabarit à grammaire pour les équipes d'un client.

**À trancher au démarrage**
- Le valideur distinct (Arb-11) : dès le palier 2, ou au palier 3 seulement.
- La facturation des tiers (Arb-10) : par deck, par séance, à l'usage, au forfait par procédé.
- L'hébergement du palier 2 (guichet mince) et le cadre juridique (conditions d'utilisation, sous-traitance de données).
- Le client pilote.

**Sortie**
- Un client pilote au palier 2, la porte du § 7.5 franchie et datée au journal.

---

## Nommé, hors v1

- L'entrée depuis un cristal ou un cadrage (Studio, Agency → `seance-spec`) : un pont-fonction.
- Le palier 3 (produit hébergé, multi-clients), s'il est décidé.
- Le mode connecté : écarté (Arb-4).
