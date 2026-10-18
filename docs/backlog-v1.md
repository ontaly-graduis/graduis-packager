# Backlog v1 — Graduis Packager

Ce qui reste à faire, session par session (spec v1, § 10). Chaque session a ses « À trancher au démarrage » et sa « Sortie », vraie quand ses témoins sont verts.

**Ordre** : GEN-1 → GEN-0 → ACT-1 → ETB-1 → THM-1 → GEN-2 → GEN-3 → ACT-2 → REI-1 → ETB-2 → ETB-3 → OUV-1. Ce qui sert ONET d'abord : GEN-1 fige le procédé ONET sans rien changer à la production en cours ; GEN-0 mesure avant de spécifier plus loin ; ACT-1 se joue sur la séquence de démonstration ; ETB-1 accélère la revue des decks ONET restants ; THM-1 rend le thème éditable avant le premier client nouveau. La sensibilité s'ouvre par paliers (minimale en GEN-1, moyenne en ACT-1, élevée en REI-1) ; l'ouverture aux tiers ferme la marche.

**Les indicateurs du chantier** : part des diapositives décidées aux étages 1 et 2 · heures humaines par deck, par sensibilité · coût IA par deck · taux d'acceptation par acte · écart à la source, par sensibilité · temps d'embarquement d'une famille de gabarit · mots inventés dans les activités dérivées (cible : zéro).

**La référence v0** : le tag `v0` (5656a26) et `golden/reference-v0.json`, les empreintes de la chaîne v0 sur le deck acheteur (le deck reste hors dépôt). Chaque session qui touche à la chaîne rejoue le procédé ONET contre elle (I-PKG-18), ou dit pourquoi elle monte de version.

---

## GEN-1 · ONET hors du code, procédé ONET

**Livrer** : `graduis/profil-source@0`, le thème et la charte en données ; le procédé `onet-boost` (`graduis/procede@0`, sensibilité minimale) et `packager rejouer` ; la mesure de l'écart à la source et les bornes de la minimale ; le code ne nomme plus ONET.

**À trancher au démarrage**
- **Le schéma minimal de `profil-source@0` et de `procede@0`** : seulement ce que le code ONET utilise (I-PKG-1) — dispositions et formules signal, marqueurs d'inachèvement, projection des couleurs, conventions de forme ; thème, charte, sensibilité, prise, versions. Où vivent les fichiers (`gabarits/`, `procedes/`).
- **La définition opérationnelle de l'écart à la source** : ce qu'est un mot inventé (unité, normalisation, comparaison par bloc ou par deck), l'habillage exclu, l'ordre, la durée ; ce qui borne (la chaîne) et ce qui se compte (la revue) ; où l'écart s'écrit sans changer le rapport de la référence.
- **L'épinglage des versions** : le commit (ou le tag) et le fichier de verrouillage ; les moteurs dont dépend l'octet (Chromium, LibreOffice, Node) ; ce que fait `rejouer` quand la version courante n'est pas celle du procédé.

**Sortie**
- `packager rejouer onet-boost` sur le deck acheteur ⇒ empreintes identiques à la référence v0 : pivot, salle, PPT d'animation, couche texte du PDF, rapport.
- Écart mesuré : zéro mot inventé, ordre identique.
- Plus aucune mention d'ONET dans le code, hors `gabarits/` et procédés (témoin).

---

## GEN-0 · Corpus d'épreuve

**Livrer** : 8 à 10 decks hors ONET, d'au moins trois gabarits et trois familles (procédural logiciel, comportemental, réglementaire ou métier) ; le relevé étendu (SmartArt, graphiques natifs, ordre des animations, paires question → réponse) ; un tableau comparé.

**À trancher au démarrage**
- La provenance des decks (Ontaly, clients passés avec leur accord, supports publics) et l'accord écrit qu'il faut ; leur lieu (hors dépôt, I-PKG-9).
- Les exports Google Slides, Keynote et Canva à inclure, et sur quels decks.
- La vérité de terrain : qui dit la figure juste d'une diapositive, pour mesurer la part décidée par les seules règles génériques.
- Les figures candidates au cercle de référence (§ 4.5) que le tableau doit compter.

**Sortie**
- Part des diapositives décidées par les seules règles génériques, par famille.
- Figures manquantes nommées et comptées.
- L'hypothèse « peu de gabarits par client » confrontée.

---

## ACT-1 · Sensibilité moyenne : activités dérivées, modes projeté et papier

**Livrer** : les dérivations sans invention (§ 5.3), la régie, les fiches et cartons du livret, les dispositions `G · geste` ; `graduis/seance-spec@1` (sources, durée, blocs `activite`) ; les bornes de la moyenne.

**À trancher au démarrage**
- Le passage de `seance-spec@0` à `@1` sans casser le procédé ONET : le procédé reste-t-il épinglé sur `@0` (rejeu à l'octet), ou monte-t-il de version avec un diff accepté ?
- Le rôle « cible » de la Sélection sur image : présent dans le contrat `RegionMap`, ou à y ajouter (le pas-à-pas emploie `observe`) ?
- Les trois activités dérivées de la séquence de démonstration, et leur repli papier.
- La tolérance de durée de la moyenne (Arb-7 : ± 10 % ?).
- La régie : touches de comptage (1 à 4), minuteur, dévoilement du corrigé ; ce que voit le présentateur.
- Le nom du pivot v1 (Arb-9).

**Sortie**
- La séquence de démonstration jouée en salle avec au moins trois activités dérivées ; zéro mot inventé ; le repli papier de chacune.

---

## ETB-1 · Établi : revue et lots

**Livrer** : le compagnon local, la file de décisions, l'avant / après, la mesure du temps, les lots.

**À trancher au démarrage**
- L'hébergement (Arb-2) : local, servi par le compagnon, ou hébergé d'emblée.
- La pile de l'établi (interface web locale) et sa couture sur la bibliothèque (I-PKG-16).
- Les vignettes des diapositives héritées : par quel moteur (LibreOffice est absent du poste de David), et leur cache.
- Le protocole de comparaison avec la revue dans PowerPoint (Arb-3) : même deck, même relecteur ou non, ce qui se mesure (temps, qualité).

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
