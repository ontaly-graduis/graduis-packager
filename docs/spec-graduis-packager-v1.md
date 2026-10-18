# Spécification Graduis Packager — v1

**Statut** : cadrage, à trancher ; Arb-1 et Arb-3 orientés, Arb-4 tranché le 18/10 · **Date** : 2026-10-18 · **Amont** : spec v0 et démonstrateur PKG-E (18/10) ; profil d'effectuation MFAP (route × posture × accessibilité, matrice de dégradation `print-kit`) ; dictionnaire des gestes (`mls-noumene` v1.2) ; tarifs de l'API Claude relevés le 18/10.

**Révision du 18/10 (soir)** : retours de David — la sensibilité de réingénierie (§ 2.2), l'éditeur de thème (§ 4.7), le procédé et le rejeu à l'identique du workflow ONET (§ 4.9), l'ouverture à des tiers : arbitrage, exploitation, garde-fous (§ 7) ; Arb-3 orienté ; Arb-4 tranché : interaction directe seulement, pas de mode connecté (§ 5.6, § 11).

**Phase** : émergence, de nouveau. Trois chantiers s'ouvrent : généraliser, activer la salle, outiller la production. D'où une spec, des invariants et un backlog ; l'exécution revient ensuite à la maïeutique, session par session, comme en v0.

---

## 0. Ce que le démonstrateur établit, et ce qu'il ne dit pas

### 0.1 Établi

- La chaîne tient de bout en bout : relevé → pivot₀ → PPT de validation → pivot → salle, papier, PPT d'animation, rapport, livraison.
- L'aller-retour par PowerPoint ne perd rien (I-PKG-3), sur les 166 diapositives.
- L'heuristique sert une fois, la grammaire toujours : c'est ce qui rend la production rejouable.
- Le rapport d'anomalies et le temps humain par deck se mesurent : la chaîne chiffre son propre coût.

### 0.2 Non dit

Un deck, un gabarit, une famille de formation (le procédural logiciel), un thème déjà validé, une salle sans interaction, et un outil qui se pilote en ligne de commande et par sessions de développement.

### 0.3 Ce qui est propre à ONET, aujourd'hui dans le code

| Spécificité | Où elle vit | En v1 |
|---|---|---|
| Dispositions signal (« Slide transition », « Règles du jeu », « Que retenez-vous ») et titres signal (« À vous de jouer », « Démonstration ») | règles de qualification | profil de source (§ 4.3) |
| Conventions de pastille, de zone et de légende | relevé, appariement | profil de source |
| Projection des couleurs d'origine sur les rôles (règle DESSIN) | dessin des schémas | profil de source |
| Marqueurs d'inachèvement propres (« INT-XXX ») | H8 | profil de source |
| Recompositions `cas` et `tableau` (personae, couloirs) | PKG-B4, B5 | figures du cercle client (§ 4.5) |
| Thème DS Onet, Montserrat | `gabarits/theme-onet/` | un `theme.json` parmi d'autres, éditable (§ 4.7) |
| Seuils de H2, H3, H9 | charte | charte du client, sur défaut Graduis (§ 4.8) |

**Généraliser commence par sortir ONET du code** : tout ce qui précède devient donnée, réunie dans un procédé (§ 4.9), et le workflow ONET doit se rejouer à l'identique, à l'octet (GEN-1).

---

## 1. Trois chantiers, trois thèses

**Généraliser.** Le coût d'un deck nouveau se paie par gabarit, pas par diapositive. Un client a peu de gabarits et beaucoup de decks (ONET : un gabarit, une cinquantaine de decks). On profile le gabarit une fois, avec un modèle et une revue humaine ; les decks de la famille se qualifient ensuite sans appel de modèle sur leurs dispositions connues.

**Activer la salle.** Les activités sont déjà dans les decks, à l'état dormant, comme le triplet y était (trouvaille 1 de la v0) : une liste « Que retenez-vous » est un rappel qu'on lit au lieu de le faire jouer ; un pas-à-pas contient son propre exercice de mise en ordre ; un glossaire, son appariement. L'activité se dérive avant de s'inventer. La salle reste un fichier autonome, et l'interaction y est directe : la salle répond, l'animateur pilote. Le vote depuis les téléphones est le métier d'autres outils ; on ne le refait pas.

**Outiller.** L'application est une couture sur la chaîne, pas une seconde implémentation : chaque geste de l'interface est une commande de la bibliothèque. Les modèles se choisissent à l'éval et en coût total. Les jetons d'un deck coûtent quelques dollars ; une heure de revue coûte plus que tous les jetons d'un lot. On optimise d'abord le temps humain.

---

## 2. Principes

P1 à P8 tiennent. Deux s'amendent, P7 se confirme, sept s'ajoutent.

| # | Principe | Conséquence |
|---|---|---|
| **P1** *(amendé)* | **On vend un résultat ; l'outil devient l'application de production d'Ontaly.** | Interne d'abord. L'ouverture à des tiers est un palier, qui s'ouvre sur critères (§ 6.6, § 7), pas un point de départ. |
| **P5** *(amendé)* | **MFAP en surface, latitude élevée.** | § 2.1. Une lecture et un vocabulaire, jamais une validation. Un écart au modèle est une observation au rapport ; seuls H8, H12 et les bornes d'écart de la sensibilité bloquent. |
| **P7** *(confirmé)* | **Rien à installer, rien en ligne.** | La salle reste un fichier unique, sans requête réseau. L'interactivité est directe : à voix haute, à main levée, aux cartons, sur papier (§ 5.1, § 5.6). |
| **P9** | **On profile le gabarit, pas la diapositive.** | `graduis/profil-source@0` (§ 4.3). L'IA et la revue humaine se concentrent sur ce qui est nouveau. |
| **P10** | **L'activité se dérive avant de s'inventer.** | Une activité dérivée pointe vers ses blocs sources et n'ajoute aucun mot ; une activité générée est une proposition ✦ (§ 5.3). |
| **P11** | **La salle est une route.** | La prise de salle est un profil d'effectuation : route `salle` × posture × accessibilité, plus thème, transitions, dévoilement et interactivité (§ 3). |
| **P12** | **Déterministe d'abord, puis le modèle le moins cher qui tient l'éval, en coût total.** | Coût total = jetons + minutes de revue. Le routage se décide sur mesure, jamais par principe (§ 8). |
| **P13** | **L'application est une couture.** | Une bibliothèque ; la CLI et l'établi en sont deux coutures. Aucune règle métier dans l'interface. |
| **P14** | **La sensibilité de réingénierie est un réglage du contrat, borné par l'écart à la source.** | Minimale, moyenne, élevée (§ 2.2). Elle fixe ce que la chaîne a le droit de changer ; l'écart se mesure à chaque livraison. |
| **P15** | **Une production se rejoue à l'identique.** | Le procédé fige profil, thème, charte, sensibilité, prise et versions (§ 4.9). Le procédé ONET en est la première instance et la fixture de non-régression. |

### 2.1 La latitude MFAP, explicitement

| On prend | Pour | Statut |
|---|---|---|
| Le triplet E · R · R* | lire les séquences, dessiner la frise de séance (§ 5.4), H1, H10 | lecture |
| Les gestes du dictionnaire : Rappel, Sélection, Classement, Catégorisation | typer les activités | vocabulaire |
| Les composants et leur dégradation `print-kit` (ChoiceInput, SortInput, OrganizeInput, FramedInput, Reflection, Mirror, Signal, Explanation) | incarner les activités en salle et sur papier | contrat |
| Les postures (`didactic`, `facilitator`, `academic`) | le chrome de la salle : formulation des consignes, verdict ou miroir | choix de prise |
| Les inducteurs de grain | une séance se lit comme un module linéaire, une séquence comme une activité | lecture |

On laisse : les marqueurs par étape, les faisceaux, les profils d'altération, R1–R6, les diagnostics D-R*, le cristal, l'empreinte, les gates. Le présentiel a son régulateur, l'animateur : ce que MFAP confie au dispositif, la salle le confie à une personne. D'où la latitude.

### 2.2 La sensibilité de réingénierie

Elle dit jusqu'où la chaîne peut s'éloigner du support initial. Trois niveaux, fixés au procédé (§ 4.9), avec dérogation tracée par deck ou par séquence.

| | **Minimale** | **Moyenne** | **Élevée** |
|---|---|---|---|
| **Intention** | refondre la forme, garder le fond | faire jouer ce qui est déjà là | repenser la séance |
| **Contenu** | verbatim ; une réécriture n'existe qu'en proposition | verbatim, plus les activités dérivées | réécriture proposée (✦) : objectifs, consignes, registre |
| **Structure** | ordre intact ; découpe H2, descente aux notes et au papier | + blocs d'activité insérés ; ordre des séquences intact | séquences réordonnées, fusionnées, scindées ; séquences d'ancrage ajoutées |
| **Activités** | celles déjà écrites (quiz hérités) se jouent | + dérivées (§ 5.3) ; H10 à H13 en propositions | + générées : cas, débats, mises en situation |
| **MFAP mobilisé** | lecture et diagnostic, au rapport | + gestes, frise, règles d'activation | + grille de conception : équilibre E · R · R* par séquence et par séance, posture choisie, objectifs reformulés |
| **Actes IA** | qualification, équilibrage | + distracteurs, consignes d'animation, captures muettes | + réécriture et scénarisation ; prompts de l'Agency au registre (`sp-cadrage` pour reconstituer les objectifs, `sp-fragments` pour le contenu manquant) |
| **Écart borné** | 0 mot inventé (hors chrome : numéros, intertitres de suite) ; ordre des blocs identique ; durée identique | 0 mot inventé hors distracteurs et consignes ✦ acceptés ; ordre des séquences identique ; durée dans la tolérance de la charte | aucune borne a priori : tout écart tracé et accepté ; un retrait passe en annexe du rapport, rien ne se perd (P4) |
| **Revue** | légère | moyenne | forte : arbitrages pédagogiques, valideur pédagogique désigné |
| **Exemple** | ONET Boost | une refonte « vivante » | une réingénierie pédagogique |

**La sensibilité règle la part de MFAP mobilisée, pas la latitude.** Même en élevée, MFAP reste une grille d'interprétation, jamais un validateur : seuls H8, H12 et les bornes d'écart bloquent.

**L'écart à la source se mesure** à chaque livraison, en comparant le relevé et le pivot : part du texte source conservée (à l'écran, en notes ou sur papier), mots inventés acceptés, blocs ajoutés, déplacés, scindés ou fusionnés, durée. Le rapport le montre ; la livraison s'arrête si une borne de la sensibilité est franchie (I-PKG-19). C'est aussi une ligne de devis : la sensibilité fixe la charge de revue, donc le prix.

---

## 3. La filiation, étendue

Les reprises de la v0 tiennent : dérivation déterministe et hash sémantique, `RegionMap` et `figure-pas-a-pas`, thème unique, transitions et prise, route papier, compagnon, registre des actes IA, `decisions.md`. La v1 en ajoute, et en déplace une : **la salle cesse d'être un produit à part ; elle devient la route présentielle de Graduis.**

Le profil d'effectuation MFAP a déjà une grappe print, avec la route `print-kit` (fiche animateur, fiche apprenant, supports visuels) et sa matrice de dégradation des composants : un ChoiceInput y devient des cases à cocher, un SortInput des post-its à ordonner, un OrganizeInput des cartes à relier, un Mirror une projection de l'animateur. Le packager en est l'effectuation concrète. Il y ajoute la route qui manque, `salle` : le support projeté, piloté par l'animateur. La posture `facilitator` y trouve son affinité naturelle : le présentiel est le medium originel de la facilitation.

| Du wizard, du studio, de l'Agency | Au packager v1 | Mode |
|---|---|---|
| Profil d'effectuation route × posture × accessibilité | la prise de salle | transposé : `salle` est une route ; posture et accessibilité entrent dans la prise |
| Route `print-kit` et sa matrice de dégradation | papier, PPT d'animation, incarnation papier des activités | contrat repris |
| Composants (ChoiceInput, SortInput, OrganizeInput, Reflection, Mirror, Signal…) | les activités en salle | contrats repris ; incarnation `salle` nouvelle |
| Moteur zones (`RegionMap`, rôle de zone) | Sélection sur image : « où cliquez-vous ? » | repris ; un rôle « cible » est à vérifier dans le contrat, ou à y ajouter (le pas-à-pas emploie `observe`) |
| Dictionnaire des gestes et ses trois cercles (référence, institutionnel, personnel) | le typage des activités ; le modèle du catalogue de figures (§ 4.5) | vocabulaire et structure repris |
| Thème `graduis/theme@1` d'un module Studio ou Agency du même client | le thème de salle | repris tel quel : même charte en e-learning et en salle |
| `sp-tokens` (Agency, temps 2) | formaliser un thème absent | prompt repris, acte IA au registre |
| `sp-recette` (Agency, temps 6) | la recette d'une livraison | transposé |
| Compagnon (worker local ; couture, jamais fork) | le compagnon du packager : il exécute la bibliothèque là où sont les données | transposé (§ 6.2) |
| Registre des actes IA (I-WIZ-8) | le relais IA : routage, mémoïsation, lots, coûts, évals | étendu (§ 8) |
| Cristalliser (Studio) | — | horizon : une séance relue au pivot est un pré-cristal ; le pont sera une fonction |

---

## 4. Généraliser

### 4.1 Trois entrées

| Entrée | Chemin | Version |
|---|---|---|
| **Héritée** | deck existant → relevé → profil → pivot₀ → PPT de validation | v1 : le cas ONET, généralisé |
| **Gabarit vierge** | un concepteur écrit directement dans le gabarit d'auteur (`G · …`), dans PowerPoint → `lire` → pivot | v1 : gratuit, la grammaire existe |
| **Depuis un cristal ou un cadrage** | Studio ou Agency → `seance-spec` | horizon : un pont-fonction (P5) |

La deuxième entrée fait du packager un outil de création sans une ligne de plus : la grammaire qui relit un PPT de validation relit aussi une séance écrite de zéro.

### 4.2 Les sources

| Source | Lecture | Fidélité |
|---|---|---|
| PPTX | relevé natif | pleine |
| Google Slides, Keynote, Canva | export PPTX, puis relevé natif | pleine en principe ; à vérifier par famille (GEN-0) |
| PDF d'un deck | texte et images par page ; structure lue par la vision | dégradée : ni formes, ni pastilles appariées, ni notes |
| Déroulé pédagogique, guide d'animation (docx, xlsx) | source compagne, alignée sur le deck par numéro de diapositive ou par titre | enrichit durées, consignes, méthodes, activités ; ne crée pas de bloc |

Le déroulé mérite sa place : en présentiel, il porte souvent ce que le deck tait (horaires, méthodes, sous-groupes). Ses durées alimentent le budget de la séance (H13). Le pivot passe d'une source à une liste de sources.

### 4.3 Le profil de source `graduis/profil-source@0`

Un profil décrit une famille de gabarit, une fois pour toutes :

- **l'empreinte** : hash des masques et des dispositions (noms, géométries), des couleurs et des polices du thème Office ; un deck entrant se rattache à son profil par elle ;
- **les dispositions** : disposition → figure, avec la tenue mesurée (« Slide transition » 13/13 → `transition` ; « Objectifs » 1/11 → aucun signal) ;
- **les formules signal** : « À vous de jouer », « Que retenez-vous » et leurs variantes ;
- **les conventions de forme** : la pastille (géométrie, taille, remplissage), la zone (cadre sans remplissage), la légende ;
- **la projection des couleurs** d'origine sur les rôles du thème (règle DESSIN, généralisée) ;
- **les marqueurs d'inachèvement** propres au client ;
- **le lexique** du domaine (Oracle ↔ Onet en v0), consommé par H7.

Cycle de vie : relevé de quelques decks de la famille → statistiques déterministes (usage des dispositions, formules récurrentes, conventions) → proposition d'un modèle sur les dispositions ambiguës (un acte, au registre) → validation humaine dans l'établi → profil figé et hashé. Il ne change ensuite que par décision humaine datée : une correction qui revient en revue devient une proposition de modification du profil, jamais une modification silencieuse.

Le profil ONET est le premier : les règles de la v0, sorties du code (GEN-1).

### 4.4 La cascade de qualification

Chaque diapositive descend la cascade jusqu'au premier étage qui décide avec une confiance suffisante.

| Étage | Moyen | Coût | Ce qu'il décide |
|---|---|---|---|
| 1 | profil de source | nul | dispositions et formules connues |
| 2 | règles génériques | nul | capture + pastilles → `pas-a-pas` ; tableau d'étapes → `processus` ; SmartArt → `schema` ; question puis réponse → `quiz` |
| 3 | modèle léger, sur le texte et une géométrie résumée, sans image | négligeable | le reste, avec une confiance |
| 4 | modèle intermédiaire, avec la vignette | faible | les indécis de l'étage 3, les schémas |
| 5 | revue humaine | le vrai coût | ce qui reste, en tête de file |

La trace (étage, signal, confiance) vit au rapport, comme en v0, jamais au pivot. La part décidée aux étages 1 et 2 est l'indicateur de maturité d'une famille.

### 4.5 Le catalogue des figures

**Une figure, un module.** Chaque figure déclare au même endroit son contrat au pivot, son émission et sa lecture dans le PPT d'auteur (sa disposition `G · …`), son rendu de salle, son rendu papier et ses diagnostics. Le test d'aller-retour se génère par figure. Ajouter une figure, c'est ajouter un module.

**Trois cercles**, sur le modèle du dictionnaire des gestes :
- **référence** (Graduis) : les quinze figures de la v0, généralisées, et celles que GEN-0 révélera ;
- **client** : les figures d'un domaine (le pas-à-pas Oracle, les recompositions `cas` et `tableau` d'ONET) ;
- **projet** : l'exception d'un seul deck, assumée et documentée.

**Candidates au cercle de référence**, à confirmer par la mesure : `citation`, `chiffre-cle`, `comparaison` (deux colonnes, avant / après), `chronologie`, `graphique` (redessiné au thème depuis les données du graphique natif), `video`, `consigne-atelier` (travail en sous-groupes : consigne, durée, livrable, restitution), `quiz` (question et réponse héritées), `programme` (l'ordre du jour).

### 4.6 Les signaux qu'on ne lit pas encore

- **SmartArt** : son modèle de données porte le texte et la hiérarchie ; le schéma s'en dérive sans deviner.
- **Graphiques natifs** : leurs données sont dans le fichier ; on les redessine au thème plutôt que d'en garder l'image.
- **Animations** : la v0 les écarte en sortie, à raison. En entrée, leur ordre est un signal de dévoilement : la partition d'un schéma ou d'un contenu se lit dans l'ordre d'apparition voulu par l'auteur.
- **Paires question → réponse** : deux diapositives consécutives, la seconde révélant la première. C'est une Sélection déjà écrite, corrigé compris.
- **Notes rédigées comme un script** : leur grammaire (`Durée :`, `Consigne :`…) se propose depuis leur forme.

### 4.7 Le thème : trois provenances, un éditeur

1. **Un thème Graduis existe pour ce client** (un module Studio, un e-learning Agency) : on le reprend tel quel. Une même charte en e-learning et en salle est un argument, pas un détail.
2. **Aucun thème** : on le tire du deck. Les couleurs et polices du thème Office, pondérées par leur usage (le relevé ONET comptait `002060` ×783), donnent les primitives ; `sp-tokens` propose la couche sémantique (acte IA au registre) ; un humain valide.
3. **Le thème neutre Graduis**, par défaut.

S'y ajoutent les exigences de la salle : contraste et tailles lisibles à distance, et aucun repère porté par la seule couleur (un carton de vote porte sa lettre, sa forme et sa couleur).

**L'éditeur de thème.** Un format et un écran.
- **Le format** : `theme.json`, au schéma `graduis/theme@1`, celui du wizard. Un thème édité ici sert au wizard, et réciproquement. Le thème ONET, que la v0 n'avait pas besoin de convertir, y passe (THM-1).
- **Charger** un `theme.json` : validation au schéma, puis aperçu immédiat. **Exporter** : le même fichier, hashé.
- **Paramètres** : primitives (palette, polices et leurs fichiers, échelle typographique, espacements, rayons) ; couche sémantique (les rôles du dessin, de `marine-fort` à `gris-pale`, `papier`, `encre`, et ceux des activités : cartons A à D, juste, faux, distribution) ; réglages de salle (corps minimal à distance, contraste renforcé).
- **Aperçu** vivant sur des échantillons des trois sorties : une diapositive de salle par figure, une page de livret, une diapositive du PPT d'animation.
- **Contrôles** à chaque modification : schéma valide ; contraste des paires texte / fond aux seuils de projection (au moins le niveau AA du WCAG) ; cartons distincts sans la couleur ; licence d'embarquement de chaque police ; 0 hex hors jetons. Un thème qui échoue ne livre pas (G-10).
- Un thème enregistré est figé et hashé ; le procédé pointe son hash.

### 4.8 La charte d'harmonisation

Une charte Graduis par défaut (les seuils de H2, H3, H9, des règles H10 à H13, et la tolérance de durée de la sensibilité moyenne), puis les écarts propres à un client, validés une fois sur son démonstrateur. Les decks suivants se recettent contre elle, comme en v0.

### 4.9 Le procédé : rejouer une production à l'identique

Le procédé (`graduis/procede@0`) fige, pour un client ou un programme, tout ce qui fait une production : l'entrée (héritée ou gabarit vierge), le profil de source, le thème, la charte, la sensibilité, la prise de salle, les sorties attendues, les portes humaines, et les versions de la bibliothèque, des prompts, des modèles et du moteur de rendu (Chromium, dont dépend le papier). Chacun par son hash.

- **Rejouer** : même procédé, mêmes entrées ⇒ mêmes sorties, à l'octet (I-PKG-18). Les décisions humaines sont dans le PPT de validation et au journal : rejouer, c'est repartir de ces décisions, pas les reprendre. Les actes IA se rejouent depuis leurs mémos (I-PKG-15) : aucun modèle n'est rappelé, même si son prix ou sa version a changé.
- **Le procédé ONET** est le premier : entrée héritée, profil ONET, thème DS Onet, charte ONET, sensibilité minimale, prise didactique (dévoilement pastille par pastille), revue dans le PPT de validation avec ingestion complémentaire, trois sorties, le rapport et le manifeste. `packager rejouer onet-boost <deck>` refait exactement ce que la v0 a fait, et l'établi le propose en un geste. Il est la fixture de non-régression de chaque version de la bibliothèque.
- **Monter de version** est un acte explicite : on rejoue le procédé sur la nouvelle version, on lit le diff des sorties, on accepte ou non. Un procédé ne change jamais de version en silence ; la bibliothèque est publiée par versions, et le compagnon sait faire tourner celle qu'un procédé épingle.
- **Dupliquer** : un procédé sert de modèle à un autre. « Comme ONET, avec notre thème » est le procédé ONET dupliqué, dont on change le thème.

---

## 5. Activer la salle

### 5.1 Deux modes d'interactivité, directs

| Mode | Ce que fait la salle | Ce qu'il faut | Statut |
|---|---|---|---|
| **Projeté** | répond à voix haute, à main levée, aux cartons ; l'animateur compte, saisit ou dévoile depuis la régie | rien de plus qu'en v0 | v1, par défaut |
| **Papier** | répond dans le livret (fiche d'activité, zone d'écriture, cartes à découper) et corrige au tableau | rien | v1 |

Le mode est un choix de prise, par séance, avec dérogation par activité. Toute activité projetée a son repli papier.

### 5.2 Les gestes en salle

| Geste | Temps | Composant MFAP | En salle (projeté) | Papier | PPT d'animation |
|---|---|---|---|---|---|
| **Rappel** | R, R* | FramedInput, OpenInput | la salle restitue de mémoire ; l'animateur coche ce qui sort, puis dévoile le reste | zone d'écriture | la question ; la réponse en notes |
| **Sélection** | R | ChoiceInput, Signal | vote aux cartons A à D, comptage à la régie, verdict dévoilé | cases à cocher ; cartons à découper en fin de livret | question et options ; la réponse en notes |
| **Sélection sur image** | R | moteur zones | « où cliquez-vous ? » : la salle désigne, la zone se révèle | la capture, une zone à entourer | la capture ; la zone en notes |
| **Classement** | R | SortInput | éléments mélangés ; la salle dicte l'ordre, l'animateur déplace ; l'ordre juste se dévoile | liste à numéroter | liste mélangée ; l'ordre en notes |
| **Catégorisation**, appariement | R | OrganizeInput | cartes à ranger en colonnes, ou à relier deux à deux | cartes à relier, tableau à remplir | tableau vide ; le corrigé en notes |
| **Positionnement** | E, R* | Reflection | échelle de 1 à 4 aux doigts levés, en ouverture puis en clôture | grille d'auto-positionnement | l'échelle |
| **Collecte** | R, R* | Mirror, Distiller | l'animateur saisit les idées et les regroupe à l'écran | page « Mes notes » | la consigne |

Rappel, Sélection, Classement et Catégorisation sont les gestes du dictionnaire ; la Sélection sur image et l'appariement en sont des variantes, au titre de la latitude ; Positionnement et Collecte relèvent de la régulation, sans noumène dédié à ce jour.

La posture de la prise règle le chrome : en `didactic`, un verdict et une explication suivent le vote ; en `facilitator`, la distribution s'affiche d'abord (Mirror) et l'animateur questionne avant de trancher.

### 5.3 Les dérivations

| Figure source | Activité dérivée | Geste | Corrigé | Ce qui s'invente | Dès la sensibilité |
|---|---|---|---|---|---|
| `etapes-cles` (« Que retenez-vous ») | rappel avant dévoilement | Rappel | la liste | rien | moyenne |
| `pas-a-pas` | « dans quel ordre ? » | Classement | l'ordre des pas | rien | moyenne |
| `pas-a-pas`, ses zones | « où cliquez-vous ? » | Sélection sur image | la zone du pas | rien | moyenne |
| `processus` (étapes × rôles) | « qui fait quoi ? » | Catégorisation | le tableau | rien | moyenne |
| `glossaire` ; `contenu` à définitions | terme ↔ définition | appariement | le glossaire, les définitions | rien | moyenne |
| `schema` partitionné par étapes | étapes à replacer | Classement | la partition | rien | moyenne |
| `objectifs` | positionnement en ouverture et en clôture | Positionnement | — | rien | moyenne |
| `quiz` hérité (question puis réponse) | vote | Sélection | la diapositive réponse | rien | minimale |
| `contenu` à affirmations | vrai / faux, choix multiple | Sélection | l'affirmation source | les distracteurs ✦ | moyenne |
| une séquence entière | cas, débat, question ouverte | Rappel, Collecte | ✦ | l'énoncé ✦ | élevée |

Une activité dérivée **pointe** vers ses blocs sources et ne copie rien : remplacer une capture met à jour le « où cliquez-vous ? » qui en dépend. Une activité générée, une fois acceptée, porte son contenu au pivot, faute de source.

### 5.4 Quand activer

Les règles d'activation proposent ; elles n'imposent rien. Elles s'appliquent dès la sensibilité moyenne (§ 2.2) ; en minimale, seul H12 vaut, pour les quiz hérités.

| Règle | Ce qu'elle dit | Effet |
|---|---|---|
| **H10** · Respiration | Pas plus de N minutes d'exposition sans réalisation (seuil de charte ; départ proposé : 15). | proposition : l'activité dérivable la plus proche |
| **H11** · Ouvrir et fermer | Une séquence qui en suit une autre s'ouvre sur son rappel ; les étapes clés se jouent en rappel avant d'être dévoilées. | proposition |
| **H12** · Corrigé | Une activité a son corrigé, dérivé ou accepté, ou le statut « sans corrigé » (positionnement, collecte). | **bloquant à la livraison** |
| **H13** · Budget | Chaque activité a sa durée ; la séance ne s'allonge pas sans compensation visible (descente au papier, P4). | diagnostic et proposition de compensation |

**La frise de séance** rend tout cela visible d'un coup d'œil : la séance en bandes E, R, R*, à l'échelle du temps, avec ses activités, ses respirations manquantes (H10) et son budget (H13). C'est la lecture MFAP la plus utile au concepteur, et elle ne coûte rien : tout s'y dérive du pivot.

### 5.5 La régie

Le mode présentateur de la v0 devient la régie : lancer une activité, minuteur, comptage au clavier (touches 1 à 4 pour un vote à main levée), dévoiler le corrigé, afficher la distribution, revenir au fil. Le tout hors ligne. Règle d'ergonomie : une activité se pilote sans lâcher le clavier ni la télécommande.

### 5.6 Pas de mode connecté

*Tranché le 18/10 (Arb-4).* L'interaction reste directe : la salle répond à voix haute, à main levée, aux cartons ou sur papier, et l'animateur compte et dévoile depuis la régie. Le vote depuis les téléphones (QR code, résultats en direct, nuage de mots) est le métier d'outils comme Klaxoon ou Wooclap ; le packager ne se place pas en concurrence avec eux.

Ce choix garde la salle telle que la v0 l'a voulue : un fichier, aucun réseau, aucune donnée de participant, rien qui tombe en panne le jour de la séance. Un client qui utilise déjà un de ces outils s'en sert à côté, sans que le packager s'y branche.

### 5.7 Au pivot et dans la grammaire

- **`graduis/seance-spec@1`** : une liste de `sources` ; la `duree` de la séance (le contrat de H13) ; des blocs de figure `activite` qui portent `geste`, `duree`, `repli`, et soit `derive_de` (identifiants de blocs) avec `derivation` (son nom, ex. `ordre-des-pas`), soit, pour une activité générée, son `contenu` (énoncé, options, corrigé).
- **Le PPT d'auteur** gagne une disposition par geste (`G · Rappel`, `G · Sélection`…). Une activité dérivée s'y montre telle qu'elle se jouera. Si le client en réécrit le contenu, `lire` le détecte, la convertit en activité fixée (contenu au pivot) et le signale au rapport.
- **La prise de salle** gagne `posture`, `accessibilite` et `interactivite` (projeté ou papier, par défaut).

---

## 6. L'application

*Nom de travail : l'établi.*

### 6.1 Ce qu'elle fait, ce qu'elle ne fait pas

Elle fait : embarquer un client (procédé : profil, thème, charte, sensibilité, prise ; lexique, consentement IA), éditer les thèmes, produire en lot, rejouer et dupliquer un procédé, faire revoir vite, montrer la frise, livrer et comparer les livraisons, piloter les coûts IA, tenir le journal des décisions.

Elle ne fait pas : éditer les diapositives (PowerPoint reste la surface d'auteur et celle du client, P2), jouer la salle (le fichier est autonome), réimplémenter une règle de la chaîne (P13).

### 6.2 Architecture

```
            ┌──────────────────── établi (interface web locale) ───────────────────┐
            │  projets · lots · revue · frise · thèmes · livraisons · IA · journal │
            └───────────────────────────────┬──────────────────────────────────────┘
                                            │ commandes (≡ CLI)
  PPT, déroulés ──►  compagnon (local) : bibliothèque packager · Chromium · vignettes
                          │                                        │
                          │ actes IA (seule sortie)                 │ fichiers
                          ▼                                        ▼
               relais IA : registre · routage ·         salle.html · participant.pdf ·
               lots · cache · mémoïsation · coûts       animation.pptx · rapport · manifeste
                          │
                          ▼
               API Claude (sous consentement du client)
```

- **La bibliothèque** : la chaîne de la v0, inchangée dans ses contrats (relever, qualifier, émettre, lire, diagnostiquer, dériver, livrer, comparer), augmentée des profils, de la cascade et des activités.
- **La CLI et l'établi** : deux coutures sur elle.
- **Le compagnon** : un processus local qui exécute la bibliothèque là où sont les fichiers du client (I-PKG-9), avec Chromium (papier, vignettes de salle) et un rendu des diapositives héritées en vignettes (revue avant / après, étage 4 de la cascade). Il sert l'établi en local : rien n'est hébergé au palier 1.
- **Le relais IA** : la seule porte vers un modèle. Il porte le registre, le routage par acte, les lots, le cache, la mémoïsation et les coûts (§ 8).

### 6.3 Les écrans

1. **Projets** : par client, ses procédés (profil, thème, charte, sensibilité, prise), le lexique, le consentement IA ; rejouer, dupliquer, monter de version.
2. **Lots** : les decks déposés, leur état dans la chaîne (relevé, qualifié, en revue, émis, livré), le temps humain consommé.
3. **Revue**, le cœur : une file de décisions triée par impact (H8 et H12 en tête, puis les figures indécises, les propositions ✦, les activités proposées). Pour chaque décision : la vignette source, le rendu de salle et le rendu papier, la proposition ; accepter, refuser, corriger, au clavier. Chaque décision est horodatée : le temps de revue se mesure sans qu'on le demande.
4. **Frise** : la séance en E, R, R*, ses activités, son budget.
5. **Livraisons** : les manifestes, le diff entre deux livraisons, le rapport.
6. **IA** : le registre, le coût par acte et par modèle, les taux d'acceptation, les évals.
7. **Thèmes** : l'éditeur (§ 4.7) — charger un `theme.json`, régler, voir les trois sorties, contrôler, exporter.
8. **Journal** : les décisions humaines du projet, datées et attribuées (§ 7.2).

### 6.4 La production en lot

`packager lot <dossier>` : idempotent, reprenable, et qui ne s'arrête qu'aux portes humaines.

- Le soir, les actes IA du lot partent en traitement par lots (à moitié prix ; la plupart finis en moins d'une heure, au plus en vingt-quatre) ; le matin, la file de revue est prête.
- Un deck déjà traité dont seule une capture a changé ne rappelle aucun modèle : ses actes sont mémoïsés (I-PKG-15).
- **Le relevé est un devis.** Le nombre de pas-à-pas, de diapositives denses, de captures muettes et de schémas, croisé avec le temps de revue mesuré sur les projets passés, chiffre un deck avant qu'on le traite. Pour un client nouveau : trois decks reçus, un devis argumenté le lendemain.

### 6.5 Le retour du client

Quand le client renvoie un PPT modifié, `lire` en tire un pivot ; l'établi le fusionne à trois voies avec le dernier pivot émis (la base) et le pivot courant d'Ontaly, au grain du bloc. Les conflits arrivent dans la file de revue. L'aller-retour (I-PKG-3) rend cette fusion possible : sans lui, rien de stable à comparer.

### 6.6 Les paliers

| Palier | Qui | Où | Quand |
|---|---|---|---|
| 1 · Production interne | Ontaly | en local, sur nos postes | v1 |
| 2 · Guichet client | les équipes du client déposent leur PPT, reçoivent rapport et sorties | hébergé, mince | quand un client modifie seul (l'optimum ONET) |
| 3 · Produit | des clients produisent eux-mêmes | hébergé, multi-clients | si l'on décide de vendre l'outil |

Le palier 1 n'empêche rien des suivants : la bibliothèque ignore si elle tourne sur un poste ou sur un serveur. On passe d'un palier au suivant par les portes du § 7.5, pas à une date.

---

## 7. Ouvrir à des tiers : arbitrage, exploitation, garde-fous

L'application reste interne tant que ce qui suit n'est pas tenu. Ouvrir, c'est confier à d'autres des décisions qu'Ontaly prend seule aujourd'hui, sans relâcher un seul invariant.

### 7.1 Les tiers et leurs rôles

| Tiers | Ce qu'il fait | Palier |
|---|---|---|
| Équipes du client (ex. déploiement ONET) | modifient leurs supports dans PowerPoint, les déposent, reçoivent rapport et sorties | 2 |
| Concepteurs d'un client ou d'un partenaire (organisme de formation, agence) | produisent eux-mêmes, dans l'établi, sur leurs procédés | 3 |
| Animateurs | jouent la salle ; n'entrent jamais dans l'application | tous |

Quatre rôles dans l'application : **opérateur** (Ontaly : exploitation, versions, catalogue de référence), **administrateur** (chez le tiers : procédés, thème, charte, consentements, budget), **concepteur** (produit et revoit), **valideur** (signe une livraison).

### 7.2 Le processus d'arbitrage

Qui propose, qui décide, où la décision se trace.

| Décision | Propose | Décide | Trace |
|---|---|---|---|
| Sensibilité d'un procédé | administrateur | le contrat, entre Ontaly et le client | procédé |
| Profil d'une famille (création, modification) | concepteur, cascade | opérateur (paliers 1 et 2) ; administrateur après revue de l'opérateur (palier 3) | profil hashé, journal |
| Thème | concepteur, éditeur de thème | administrateur | `theme.json` hashé |
| Charte (seuils) | opérateur (défaut Graduis) | administrateur, sur démonstrateur | charte hashée |
| Proposition ✦, activité proposée | relais IA, règles d'activation | concepteur | registre, journal |
| Livraison | concepteur | valideur nommé | manifeste |
| Consentement IA, résidence des données | opérateur (options) | administrateur | procédé |
| Montée de version (bibliothèque, prompts, modèles) | opérateur | administrateur, après rejeu et diff | procédé |
| Figure ou geste nouveaux | tiers | cercles projet et client : administrateur ; cercle de référence : opérateur | catalogue |

- **L'escalade** : un désaccord entre concepteur et valideur remonte à l'administrateur ; un désaccord entre le client et Ontaly sur une règle se règle dans la charte, jamais par dérogation au moment de livrer.
- **Le journal** transpose `decisions.md` au projet : chaque décision humaine y est datée, attribuée, liée à ce qu'elle a changé. Il ne se réécrit pas.
- **Le catalogue s'enrichit par le bas** : une figure née dans un cercle client monte au cercle de référence quand l'opérateur l'a vue tenir chez plusieurs clients, comme le corpus institutionnel du dictionnaire des gestes.

### 7.3 L'exploitation

- **Comptes et rôles** : par tiers, cloisonnés ; les quatre rôles du § 7.1.
- **Versions** : bibliothèque, prompts, modèles et moteur de rendu sont publiés par versions ; un procédé épingle les siennes ; une montée de version passe par rejeu et diff (§ 4.9). Un changement de modèle est une montée de version.
- **Budgets IA** : par tiers et par lot, plafonnés ; l'écran IA (§ 6.3) devient le tableau de bord de l'administrateur.
- **Support** : un premier niveau chez le tiers (l'administrateur), un second chez Ontaly. Un deck qui échoue passe en quarantaine avec son rapport, sans bloquer le lot.
- **Incidents** : une livraison peut être retirée ; le manifeste dit ce qui a été livré, à qui, quand.
- **Sauvegarde et réversibilité** : tout s'exporte à tout moment (PPT d'auteur, pivots, procédés, thèmes, rapports, journal). Un tiers qui part emporte tout.
- **Mesure** : heures de revue, taux d'acceptation, coût IA, écart à la source, par tiers. C'est la matière du pilotage et de la facturation (Arb-10).

### 7.4 Les garde-fous

| # | Garde-fou | Tenu par |
|---|---|---|
| **G-1** | Les bloquants ne se contournent pas : H8, H12, l'aller-retour, les bornes d'écart. Il n'existe pas d'option « livrer quand même » ; on corrige la source. | le code (I-PKG-20) |
| **G-2** | Une livraison a un valideur nommé, distinct du concepteur, sauf dérogation tracée. | les rôles, le manifeste |
| **G-3** | La sensibilité est contractuelle : un tiers ne la relève pas seul. | le procédé verrouillé |
| **G-4** | Profil et charte sont verrouillés : les modifier, c'est proposer, rejouer les decks de la famille, lire le diff. | le procédé, le journal |
| **G-5** | Le contenu d'un deck est une donnée, jamais une instruction : il n'entre dans un prompt qu'en zone balisée, et toute sortie de modèle est validée par schéma avant d'exister. | le relais IA |
| **G-6** | Le budget IA est plafonné ; au plafond, les actes s'arrêtent et la chaîne continue sans IA (I-PKG-8). | le relais IA |
| **G-7** | Pas d'acceptation en masse de ce qui est inventé : « tout accepter » ne vaut que pour les décisions sans invention (figures, découpes). | l'établi |
| **G-8** | Les données d'un tiers ne servent qu'à lui : prompts, mémos, évals. Mutualiser des évals demande son accord écrit. | le cloisonnement |
| **G-9** | Une police ne s'embarque que si sa licence le permet ; un média garde son origine au manifeste. | l'éditeur de thème, le manifeste |
| **G-10** | Un thème qui échoue aux contrôles de lisibilité ne livre pas. | l'éditeur de thème |
| **G-11** | Toute décision humaine est datée et attribuée ; le journal ne se réécrit pas. | le journal |
| **G-12** | Le tiers part avec tout, à tout moment. | l'export |

### 7.5 Les portes d'ouverture

- **Palier 2, guichet client**, quand : le procédé se rejoue (GEN-1) ; l'établi tient la revue (ETB-1) ; l'éditeur de thème existe (THM-1) ; le retour du client se fusionne (ETB-3) ; G-1 à G-12 sont tenus (OUV-1) ; un client pilote est volontaire (l'optimum ONET) et ses équipes ont la documentation du gabarit à grammaire.
- **Palier 3, produit**, quand : le cloisonnement et les budgets sont éprouvés ; la facturation à l'usage existe ; deux clients au moins vivent au palier 2 depuis un trimestre, avec des heures de revue et des taux d'acceptation stables ; le cadre juridique est posé (conditions d'utilisation, sous-traitance de données personnelles).

Chaque porte se franchit par une décision datée au journal d'Ontaly, prise sur ces critères.

---

## 8. Le calibrage des modèles

### 8.1 Ordre de priorité

1. **Déterministe d'abord.** Relevé, grammaire, diagnostics, dérivation, activités dérivées : aucun modèle. C'est l'essentiel du volume.
2. **Un modèle là seulement où le déterministe s'arrête**, et le moins cher qui tient l'éval.
3. **Le coût total décide** : jetons + minutes de revue. Une proposition rejetée coûte une décision humaine ; un modèle plus cher dont les propositions passent mieux peut revenir moins cher.

### 8.2 Les tarifs

API Claude, relevés le 18/10, en dollars par million de jetons.

| Modèle | Entrée | Sortie | Lecture de cache | Par lots (entrée / sortie) |
|---|---|---|---|---|
| Haiku 5.5 (requête ≤ 100 k jetons) | 0,10 | 0,50 | 0,01 | 0,05 / 0,25 |
| Sonnet 5.5 | 2 | 10 | 0,10 | 1 / 5 |
| Opus 5.5 | 4 | 20 | 0,20 | 2 / 10 |

Au-delà de 100 k jetons de requête, Haiku 5.5 quintuple ses prix : on reste en deçà, ce qui va de soi au grain de la diapositive. Les remises des lots et du cache se cumulent. La réflexion se paie au tarif de sortie : l'effort se règle par acte. Fable 5.1 (10 / 50) n'a pas d'usage ici.

### 8.3 Les actes IA et leur modèle par défaut

Estimations pour un deck à l'échelle du deck acheteur (166 diapositives, onze séquences, 8 300 mots, soit environ deux jetons par mot), à confirmer par la mesure (GEN-3).

| Acte | Volume | Modèle par défaut | Mode | Escalade | Estimation |
|---|---|---|---|---|---|
| Profil d'une famille (dispositions ambiguës) | une fois par gabarit | Opus 5.5, effort élevé | direct | humain | ≈ 1 $ par famille |
| Qualification résiduelle (étage 3) | ≈ 40 diapositives par deck | Haiku 5.5, effort bas | lots ; préfixe en cache (profil, catalogue) | Sonnet 5.5 avec vignette (étage 4) | < 0,10 $ |
| Captures muettes : consignes et zones proposées | ≈ 40 captures par deck | Sonnet 5.5, vision | lots | humain | ≈ 0,25 $ |
| Équilibrage H2 : découpe, descente aux notes et au papier | ≈ 30 diapositives par deck | Sonnet 5.5 | lots | Opus 5.5 si l'éval l'exige | ≈ 0,45 $ |
| Activités générées : distracteurs, cas, consignes d'animation | ≈ 11 séquences par deck | Sonnet 5.5 | lots | Opus 5.5 si l'éval l'exige | ≈ 0,50 $ |
| Thème tiré du deck (`sp-tokens`) | une fois par client | Sonnet 5.5 | direct | humain | ≈ 0,20 $ par client |
| Contrôle sur échantillon, par un juge qui n'a pas produit | une passe par deck | Opus 5.5 | direct | humain | ≈ 0,80 $ |

**Ordre de grandeur : 2 à 3 $ de jetons par deck, juge compris.** Pour cinquante decks, entre 100 et 150 $. Rapporté au budget ONET (50 à 70 k€ pour une cinquantaine de decks, soit 1 000 à 1 400 € par deck), c'est de l'ordre de 0,2 %. Le calibrage ne cherche donc pas d'abord à économiser des jetons : il cherche à économiser des minutes de revue.

La sensibilité règle ce volume. En minimale, seuls la qualification résiduelle, l'équilibrage et le juge tournent (≈ 1,30 $ par deck) ; le tableau décrit la moyenne ; l'élevée ajoute réécriture et scénarisation, quelques dollars de plus par deck, sans changer l'ordre de grandeur.

### 8.4 Les leviers

- **Lots** : tout ce qui n'est pas interactif part par lots, à moitié prix.
- **Cache** : le préfixe stable (consignes, profil, catalogue, charte, lexique) se met en cache, à une heure pour les lots ; sa relecture coûte 5 à 10 % de l'entrée.
- **Effort** : bas pour classer, moyen pour proposer, élevé pour profiler et juger.
- **Sorties structurées** : un schéma JSON par acte, validé à réception ; aucune reprise pour un format.
- **Vignettes, pas pleine résolution** : la vision voit ce qu'il faut pour décider, pas davantage.
- **Mémoïsation** : clé = hash de l'entrée canonique, du prompt versionné et du modèle. Un acte ne se paie qu'une fois (I-PKG-15).
- **Prompts versionnés comme du code** : un prompt modifié invalide ses mémos, et rien d'autre.

### 8.5 Mesurer pour choisir

Les décisions de revue du démonstrateur et des decks ONET suivants sont des étiquettes gratuites : figure corrigée, proposition acceptée ou refusée, temps de décision. Elles forment, acte par acte, une éval rejouable. Pour chaque acte : taux d'acceptation, minutes de revue induites, jetons. On route vers le modèle qui minimise le coût total au seuil de qualité fixé, et on rejoue l'éval à chaque nouvelle version de modèle. Aucun choix de modèle sans éval (I-PKG-17).

### 8.6 Les données du client

- Aucun acte IA sans le consentement du client (I-PKG-9). La chaîne tourne sans clé (I-PKG-8), au prix d'une revue plus longue, chiffrable.
- Le traitement par lots conserve requêtes et réponses vingt-neuf jours ; on supprime chaque lot dès ses résultats récupérés.
- L'API Claude n'offre que l'inférence mondiale ou restreinte aux États-Unis. Une inférence restreinte à l'Europe passe par Amazon Bedrock ou Google Cloud, sur leurs points d'accès régionaux ou multirégionaux, avec un surcoût de 10 % ; leur disponibilité pour les modèles 5.5 se vérifie le jour où un client l'exige.

---

## 9. Invariants (I-PKG)

I-PKG-1 à 10 tiennent ; I-PKG-7 se confirme.

- **I-PKG-7 · Rien à installer** *(confirmé, Arb-4)* — La salle est un fichier unique, sans aucune requête réseau, activités comprises.
- **I-PKG-11 · Un gabarit, un profil** — Un deck d'une famille profilée se qualifie sans appel de modèle sur ses dispositions connues. Le profil ne change que par décision humaine datée.
- **I-PKG-12 · L'activité pointe** — Une activité dérivée ne copie rien : elle pointe vers ses blocs sources et suit leurs modifications. Seule une activité générée et acceptée porte son contenu.
- **I-PKG-13 · Corrigé et repli** — Toute activité a son corrigé, ou le statut « sans corrigé », et son repli papier.
- **I-PKG-14 · Le temps est un contrat** — Toute activité porte sa durée ; la durée de la séance ne croît pas sans proposition visible.
- **I-PKG-15 · L'acte IA se rejoue, il ne se recalcule pas** — Toute sortie de modèle est mémoïsée au registre par hash de l'entrée, du prompt et du modèle ; rejouer la chaîne n'appelle aucun modèle. Le déterminisme (I-PKG-2) tient avec l'IA.
- **I-PKG-16 · L'application est une couture** — Toute action de l'établi est une commande de la bibliothèque, rejouable en ligne de commande. Aucune règle métier dans l'interface.
- **I-PKG-17 · Le coût se mesure** — Chaque acte IA enregistre modèle, jetons, coût et décision humaine. Aucun choix de modèle sans éval.
- **I-PKG-18 · Procédé rejouable** — Même procédé, versions épinglées, mêmes entrées ⇒ mêmes sorties, à l'octet (le PDF sur sa couche texte). Le procédé ONET en est la fixture de non-régression, à chaque version.
- **I-PKG-19 · L'écart est borné** — L'écart à la source se mesure à chaque livraison et ne franchit pas les bornes de la sensibilité du procédé.
- **I-PKG-20 · Aucun contournement** — Les règles bloquantes n'ont pas d'option « livrer quand même » : on corrige la source.

---

## 10. Backlog v1

### 10.1 Les indicateurs du chantier

Part des diapositives décidées aux étages 1 et 2 · heures humaines par deck, par sensibilité · coût IA par deck · taux d'acceptation par acte · écart à la source, par sensibilité · temps d'embarquement d'une famille de gabarit · mots inventés dans les activités dérivées (cible : zéro).

### 10.2 Les sessions

Ordre : **GEN-1 → GEN-0 → ACT-1 → ETB-1 → THM-1 → GEN-2 → GEN-3 → ACT-2 → REI-1 → ETB-2 → ETB-3 → OUV-1**. Ce qui sert ONET d'abord : GEN-1 fige le procédé ONET et ne change rien à la production en cours (non-régression à l'octet) ; GEN-0 mesure avant de spécifier plus loin ; ACT-1 se joue sur la séquence de démonstration et se propose à ONET en option, une activité dérivée n'inventant rien et relevant de l'équilibrage ; ETB-1 accélère la revue des decks ONET restants ; THM-1 rend le thème éditable avant le premier client nouveau. La généralisation proprement dite vient ensuite ; la sensibilité s'ouvre par paliers (minimale en GEN-1, moyenne en ACT-1, élevée en REI-1) ; l'ouverture aux tiers ferme la marche.

**GEN-1 · ONET hors du code, procédé ONET**
- Livrer : `profil-source@0`, le thème et la charte en données ; le procédé `onet-boost` (`graduis/procede@0`, sensibilité minimale) ; la mesure de l'écart à la source et les bornes de la minimale ; le code ne nomme plus ONET.
- Sortie : `packager rejouer onet-boost` sur le deck acheteur ⇒ même pivot, même salle, même PPT, même papier qu'en v0, à l'octet (le PDF sur sa couche texte) ; écart mesuré : zéro mot inventé, ordre identique.

**GEN-0 · Corpus d'épreuve**
- Livrer : 8 à 10 decks hors ONET, d'au moins trois gabarits et trois familles (procédural logiciel, comportemental, réglementaire ou métier) ; le relevé étendu (SmartArt, graphiques natifs, ordre des animations, paires question → réponse) ; un tableau comparé.
- Sortie : part des diapositives décidées par les seules règles génériques, par famille ; figures manquantes nommées et comptées ; l'hypothèse « peu de gabarits par client » confrontée.

**ACT-1 · Sensibilité moyenne : activités dérivées, modes projeté et papier**
- Livrer : les dérivations sans invention (§ 5.3), la régie, les fiches et cartons du livret, les dispositions `G · geste`.
- Sortie : la séquence de démonstration jouée en salle avec au moins trois activités dérivées ; zéro mot inventé ; le repli papier de chacune.

**ETB-1 · Établi : revue et lots**
- Livrer : le compagnon local, la file de décisions, l'avant / après, la mesure du temps, les lots.
- Sortie : un deck ONET complet revu dans l'établi ; temps et qualité de revue comparés à ceux de la revue dans PowerPoint (tranche Arb-3).

**THM-1 · Éditeur de thème**
- Livrer : `theme.json` (`graduis/theme@1`) et le thème ONET converti ; l'écran Thèmes (chargement, paramètres, aperçu des trois sorties, export) ; les contrôles (schéma, contraste, cartons sans couleur, licences de police, 0 hex hors jetons).
- Sortie : le thème ONET rechargé depuis son `theme.json` ⇒ sorties identiques à l'octet ; un thème nouveau créé et validé en moins d'une heure ; un `theme.json` du wizard chargé sans conversion.

**GEN-2 · Figures en modules**
- Livrer : une figure = un module ; les figures retenues en GEN-0 ; les trois cercles.
- Sortie : I-PKG-3 sur tout le corpus d'épreuve.

**GEN-3 · Cascade et relais IA**
- Livrer : les cinq étages ; le relais (routage, lots, cache, mémoïsation, coûts) ; l'éval de qualification tirée des décisions ONET.
- Sortie : une famille nouvelle profilée en une demi-journée humaine ; coût IA par deck mesuré ; rejouer un lot n'appelle aucun modèle.

**ACT-2 · Activation, frise, activités générées**
- Livrer : H10 à H13, le budget de séance, la frise, les propositions ✦ d'activités générées.
- Sortie : taux d'acceptation des activités proposées, mesuré sur deux decks.

**REI-1 · Sensibilité élevée**
- Livrer : la réécriture proposée (objectifs, consignes, registre), la réorganisation des séquences, les activités générées, la frise comme surface de conception, les bornes et la revue de l'élevée.
- Sortie : une séquence du corpus d'épreuve réingénierée ; chaque écart tracé ; le temps de revue mesuré, qui fait le prix de l'élevée.

**ETB-2 · Établi : projets, procédés, charte, IA**
- Sortie : un client nouveau embarqué de bout en bout dans l'établi, par duplication d'un procédé, devis compris.

**ETB-3 · Retour du client**
- Livrer : la fusion à trois voies.
- Sortie : un PPT modifié par le client, relu et fusionné ; les conflits au grain du bloc, dans la file.

**OUV-1 · Ouverture aux tiers**
- Livrer : les rôles et le cloisonnement, le journal, les garde-fous G-1 à G-12, les budgets, l'export complet, la documentation du gabarit à grammaire pour les équipes d'un client.
- Sortie : un client pilote au palier 2, la porte du § 7.5 franchie et datée au journal.

---

## 11. Arbitrages ouverts

- **Arb-1 · Statut de l'application** — *orienté le 18/10* : interne d'abord ; l'utilisation par des tiers se prépare par un processus d'arbitrage, une exploitation et des garde-fous (§ 7), et s'ouvre palier par palier, sur critères (§ 7.5).
- **Arb-2 · Hébergement** — proposition : local, servi par le compagnon. Alternative : hébergé d'emblée, au prix d'une infrastructure et d'un autre traitement des données du client.
- **Arb-3 · Surface de revue d'Ontaly** — *orienté le 18/10* : l'établi, idéalement ; tranché en situation, à la sortie d'ETB-1 (temps et qualité de revue comparés à ceux de PowerPoint sur un même deck ONET). PowerPoint reste la surface du client.
- **Arb-4 · Faire répondre les participants depuis leur téléphone ?** — *tranché le 18/10* : non. L'interaction reste directe (projeté, papier), pour ne pas se placer en concurrence de Klaxoon ou de Wooclap (§ 5.6).
- **Arb-5 · Inférence et données du client** — API mondiale sous consentement, ou point d'accès européen (+10 %) ; à trancher client par client.
- **Arb-6 · Catalogue des figures** — proposition : trois cercles (référence, client, projet). Alternative : un catalogue fermé.
- **Arb-7 · Seuils de départ** — H10 (15 minutes ?), la tolérance de H13 et de la sensibilité moyenne (± 10 % ?), le seuil de confiance de chaque étage de la cascade.
- **Arb-8 · Médias lourds** — une vidéo embarquée alourdit le fichier unique : l'embarquer, la lier (réseau requis), ou la poser à côté (deux fichiers) ?
- **Arb-9 · Les noms** — l'application (« l'établi » est un nom de travail), `seance-spec@1`, `profil-source@0`, `procede@0`.
- **Arb-10 · Facturer les tiers** — par deck, par séance, à l'usage (jetons et revue), ou au forfait par procédé ; la sensibilité y entre dans tous les cas.
- **Arb-11 · Valideur distinct (G-2)** — dès le palier 2, ou seulement au palier 3, quand les équipes du client sont petites ?

---

## 12. Ce que la spec suppose vrai sans l'avoir mesuré

- Chez un même client, les decks se rangent en peu de familles de gabarits. P9 en dépend ; GEN-0 le mesure.
- Hors du procédural logiciel (comportemental, réglementaire, métier), les règles génériques décident assez de diapositives pour que la cascade reste bon marché.
- Les exports Google Slides, Keynote et Canva gardent assez de structure pour un relevé natif.
- Un animateur pilote une activité depuis la régie sans perdre le fil, et une salle joue le jeu des cartons.
- Les décisions de revue ONET suffisent à une première éval par acte.
- Le gabarit d'auteur vierge suffit à un concepteur pour écrire une séance sans ingestion.
- Les clients consentent aux actes IA sur leurs supports, ou acceptent le coût d'une revue sans IA.
- Le corpus d'épreuve se constitue : decks d'Ontaly, de clients passés avec leur accord, supports publics.
- Les tarifs et les modèles du 18/10 tiennent sur la durée du chantier ; l'éval se rejoue à chaque sortie de modèle.
- Les versions anciennes de la bibliothèque et de son moteur de rendu restent exécutables pendant la vie d'un procédé ; sinon, le rejeu à l'octet ne tient plus.
- Les trois niveaux de sensibilité se négocient avec le client en amont, et leurs bornes lui sont lisibles.
- Un tiers accepte un gabarit contraint et des garde-fous qui l'empêchent de livrer quand il le veut.
