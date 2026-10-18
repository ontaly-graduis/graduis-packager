# Spécification Graduis Packager — v0

**Statut** : cadrage ; P2 et le thème tranchés le 17/10 (`decisions.md`) ; prêt pour la session PKG-0 · **Date** : 2026-10-17 · **Amont** : go ONET Boost (David, 17/10) ; relevé du deck « boost acheteur » (`scripts/releve_pptx.py`) ; architecture du wizard (spec v0, notes thème, transitions, explainer, effecteur par défaut).

**Phase** : émergence. D'où une spec, des invariants et un backlog ; l'exécution revient ensuite à la maïeutique.

---

## 0. Le contexte et ce que le corpus montre

### 0.1 L'opportunité (David, 17/10)

- **Client** : ONET, programme Boost (déploiement d'Oracle Fusion). Une cinquantaine de supports d'animation présentielle, orientés processus et modes opératoires, jugés peu attractifs, visuellement incohérents et pénibles à faire évoluer.
- **Acheteur** : Directeur développement Groupe. **Budget** : 50 à 70 k€ selon la qualité des livrables.
- **Corpus** : template unique. Le deck « boost acheteur » sert de preuve de démonstration.
- **Sorties** : un support de présentation interactif autonome (priorité), un guide d'animation PPT (repli), un support participant PDF.
- **Autonome** = sans installation sur le poste. Les animateurs sont des consultants externes, sur des PC variés.
- **Latitude** : harmonisation et équilibrage, pas un verbatim.
- **Après livraison** : les équipes de déploiement ONET modifient (optimum) ; Ontaly en repli.
- **Calendrier** : livraisons sur toute la fin du Q4 2026.
- **Ce qu'on vend** : un résultat, pas une solution. L'outil reste à Ontaly ; lui seul s'en sert en v0.

### 0.2 Le relevé du deck acheteur (mesuré le 17/10)

| Mesure | Valeur |
|---|---|
| Diapositives | 166 (16:9), 2 masques, 37 dispositions |
| Médias | 190 fichiers, 22 Mo (164 PNG, 14 EMF, 6 SVG, 4 JPEG, 2 WDP) ; 3 objets OLE ; 21 images rognées. Les diapositives n'en utilisent que 118, dont un seul EMF (une icône, diapo 54) et aucun OLE : le reste vit dans les masques, qui ne sont pas repris |
| Texte | 8 329 mots ; médiane 38 par diapositive, maximum 419 ; 27 diapositives au-delà de 90 mots |
| Notes de l'animateur | 16 diapositives sur 166 |
| Pas-à-pas (capture + pastilles numérotées) | 61 diapositives |
| Captures sans pastille | 39 diapositives |
| Pastilles posées sur une capture | 94, dont **93 accolées à un cadre sans remplissage** (la zone) |
| Pastilles hors capture (légende) | 137, dont 99 (72 %) à moins de 1,6 po d'un texte |
| Résolution des captures | médiane 1,24 px source par px affiché à 1920 ; **36 sur 113 sous 1,0** |
| Animations / transitions | 2 diapositives animées / aucune transition |
| Couleurs codées en dur | trois marines voisins : `002060` ×783, `003871` ×107, `003771` ×83 |
| Polices | Calibri, Arial, Poppins Black, Asap Condensed Medium |
| Écart au DS Onet | le thème validé pour l'e-learning Boost NDF porte le navy `003058` et Montserrat ; les decks portent le bleu foncé standard d'Office (`002060`), Poppins et Asap |

### 0.3 Quatre trouvailles

**1. Le triplet est déjà là, au grain de la séquence.** Les six séquences opératoires suivent la même forme : pas-à-pas commentés, « À vous de jouer » dans Oracle, « Les étapes clé ». C'est Exposition → Réalisation → Régulation : le MFAP en surface est une lecture, pas une imposition.

| Diapo | Diapos | Démo | Pas-à-pas | Captures | À vous de jouer | Règles du jeu | Étapes clés | Mots | Séquence |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 30 | 29 | 3 | 18 | 0 | 1 | 0 | 1 | 1 770 | Commande à partir d'une DA hors catalogue |
| 59 | 9 | 0 | 1 | 4 | 1 | 1 | 1 | 415 | Commande à partir d'une DA sur catalogue |
| 68 | 31 | 0 | 21 | 4 | 1 | 1 | 1 | 1 244 | Commande directe sans DA |
| 99 | 13 | 0 | 5 | 4 | 0 | 1 | 1 | 601 | Finalisation de la commande |
| 112 | 26 | 0 | 6 | 15 | 0 | 1 | 1 | 768 | Modification et avenant |
| 138 | 23 | 0 | 7 | 9 | 0 | 1 | 1 | 1 305 | Statuts et visualisation |

En amont : une ouverture et cinq séquences d'exposé — présentation, projet Boost, processus S2P (1 323 mots en 11 diapositives), fondamentaux de navigation (un simple renvoi vers un autre deck), navigation dans la gestion des commandes. En aval : deux synthèses.

**2. Le nom de la disposition est un signal faible.** Certaines dispositions sont tenues : Slide transition 13/13, Règles du jeu 5/5, Que retenez-vous 6/6. D'autres sont détournées : sur 11 diapositives « Objectifs », une seule porte des objectifs ; « Carnet de route » 0/5 ; « Quiz » 0/1 ; « Debrief » 0/1. La classification lit donc disposition × contenu, et le format d'auteur fait de la disposition un contrat (§ 4.3).

**3. Le pas-à-pas se récupère.** 93 pastilles sur 94 posées sur une capture sont accolées à un cadre : la zone se lit, en rectangle relatif à la capture. Côté consigne, la proximité seule n'apparie que 72 % des légendes ; la voie est l'appariement par numéro (pastille n sur l'image ↔ pastille n en légende ↔ texte voisin). La cible est exactement la `region_map` du moteur zones du wizard (`Zone{rect, step, consigne}`). **Le relevé de PKG-0 le confirme** : 130 pas, dont 101 paires repère-légende appariées par numéro et 110 complets (zone et consigne). Les 20 autres, sur 14 diapositives, sont surtout des légendes sans repère sur l'image : c'est la revue dans le PPT d'auteur qui les ancre.

**4. La qualité de la source est un livrable.**
- Inachèvement : « A supprimer » (diapo 2), « Insérer lien vers PPT » (24), « INT-XXX » (16), « Avenant xx … XXX » (146), cas pratique 6 « A rédiger » (159).
- Erreurs : notes d'un cours de comptabilité sur la diapo 7 ; le titre du cas 2 repris sur l'écran « À vous de jouer » du cas 3 (95) ; séquences numérotées 1 à 6, puis 3, 3, 4, 5, 6, 7, 5.
- Déséquilibres : seule la séquence 30 a des démonstrations ; la séquence 112 aligne 15 captures sans pastille ; 36 captures sont trop pauvres pour un zoom.

Le rapport d'anomalies et d'équilibrage est un sous-produit de la chaîne, et il se vend.

---

## 1. Les principes fondateurs

| # | Principe | Conséquence |
|---|---|---|
| **P1** | **On vend un résultat.** L'outil est interne en v0. | Une CLI et des rapports, pas d'UI de production. PowerPoint sert de surface de revue (P2). |
| **P2** | **La source est un PPT d'auteur, à grammaire.** | Deux lectures. L'**ingestion héritée**, heuristique, sert une fois par deck : elle produit le PPT d'auteur. La **lecture grammaticale**, déterministe, sert à chaque modification : elle produit le pivot. La revue humaine, puis les équipes ONET, travaillent dans PowerPoint. |
| **P3** | **Un pivot, trois sorties.** | Le pivot dérive la salle, le papier et le PPT d'animation. Identité = hash sémantique canonique (filiation I-WIZ-2). Une modification se lit en diff. |
| **P4** | **Rien ne se supprime, tout se redistribue.** | Équilibrer, c'est déplacer : ce qui encombre l'écran projeté descend aux notes de l'animateur ou au papier du participant. L'écart se mesure par sortie, pas sur le deck. |
| **P5** | **Le MFAP en surface est une grille de lecture et de diagnostic.** | Temps E · R · R*, figures, règles d'équilibrage. Ni cristal, ni empreinte, ni `.mfapx` en v0. Le vocabulaire est celui du wizard : un pont futur sera une fonction, pas une réécriture. |
| **P6** | **Un thème, une table.** | Le thème ONET déjà validé pour l'e-learning Boost NDF (DS Onet, figé le 30/06), repris tel quel dans `gabarits/theme-onet/`. La salle et le papier lisent sa couche sémantique ; le gabarit PPT en dérive ses couleurs et ses polices. Le masque des decks hérités n'est pas repris. 0 hex hors jetons. |
| **P7** | **Rien à installer.** | La salle est un fichier HTML unique, sans requête réseau, ouvert par double-clic, hors ligne. |
| **P8** | **L'écart est tracé.** | Verbatim par défaut. Toute réécriture (harmonisation, découpe, IA) est d'abord une proposition visible dans le PPT d'auteur. |

---

## 2. Périmètre v0

**Le chemin court** : deck hérité → relevé → pivot₀ → PPT d'auteur (revu dans PowerPoint) → pivot → salle, papier, PPT d'animation, rapport.

**Le démonstrateur** (PKG-E) :
- la séquence « Commande à partir d'une DA hors catalogue » (diapos 30 à 58) au niveau cible, dans les trois sorties ;
- le rapport d'anomalies et d'équilibrage sur les 166 diapositives ;
- une capture Oracle remplacée dans le PPT d'auteur, la chaîne rejouée, le diff et les trois sorties à jour.

**Anti-scope v0** : UI de production (au-delà des rapports), libre-service ONET (horizon : l'outil vendu), génération de schémas nouveaux (les schémas existants sont redessinés au thème, PKG-B2), animations PowerPoint générées (option), `.mfapx`, autoformation, SCORM, LMS, multi-utilisateurs.

---

## 3. La chaîne

```
deck hérité (.pptx)
   │ relever ........ ingestion héritée : heuristique, lecture seule
   ▼
relevé (releve.json + médias hashés)
   │ qualifier ...... disposition × contenu → figures ; pastilles → region_map ; séquences
   ▼
pivot₀ ── émettre ──► PPT d'auteur (gabarit à grammaire, thème ONET)  ◄── revue humaine, puis équipes ONET
                            │ lire ........ lecture grammaticale : déterministe
                            ▼
                         pivot (hashé) ── diagnostiquer ──► rapport d'anomalies et d'équilibrage
                            │ dériver (prise de salle : thème · transitions · dévoilement)
            ┌───────────────┼────────────────────┐
            ▼               ▼                    ▼
       salle.html     participant.pdf      animation.pptx = émettre(pivot)
```

- **L'heuristique ne livre jamais.** Seule la lecture grammaticale alimente les sorties (I-PKG-4).
- **L'aller-retour par PowerPoint ne perd rien** : `lire(émettre(pivot)) ≡ pivot` (I-PKG-3). C'est le test bloquant de la grammaire.
- **Le PPT d'animation et la source ne font qu'un.** `animation.pptx` est le PPT d'auteur émis du pivot, propositions tranchées. C'est lui que les équipes ONET modifieront.

---

## 4. Les objets

| Objet | Contenu | Statut |
|---|---|---|
| **relevé** | par diapositive : disposition, formes aplaties (boîtes absolues), textes, notes, médias (hash), pastilles, zones ; métriques du § 0.2 | sortie de `relever`, jamais édité |
| **pivot** | § 4.1 | hashé ; seule source des sorties |
| **PPT d'auteur** | § 4.3 | source éditable |
| **prise de salle** | `theme { hash, nom }` · `transitions` (didactique en v0) · `devoilement` (`pastille` ou `ecran`) | figée et hashée, comme la prise du wizard |
| **rapport** | anomalies de la source, diagnostics H1–H9, écarts relevé ↔ pivot, propositions ouvertes | HTML statique dérivé |
| **livraison** | les sorties + un manifeste : hashes du PPT d'auteur, du pivot, de la prise et de chaque sortie | la seule trace de ce qui a été livré |

### 4.1 Le pivot `graduis/seance-spec@0` (tranché le 17/10)

```json
{
  "schema": "graduis/seance-spec@0",
  "source": { "nom": "boost acheteur areprendre v1.pptx", "empreinte": "sha256:…" },
  "sequences": [
    { "id": "s030",
      "blocs": [
        { "id": "b034", "figure": "pas-a-pas", "source": { "diapo": 34 },
          "titre": "Liste des DA en attente de commande",
          "textes": ["les demandes d’achat apparaissent dans une liste en attente…"],
          "visuels": [ { "media": "sha256:…", "capture": true } ],
          "tableaux": [],
          "pas": [ { "numero": 3, "capture": "sha256:…", "zone": [61.2, 8.4, 20.5, 6.1], "ancrage": "repere",
                     "consigne": "Possibilité de changer d’agence" } ],
          "notes": "" } ] } ]
}
```

- **Un bloc par diapositive**, identifiants dérivés de la diapositive source ; une séquence s'ouvre à chaque transition (la première commence à la couverture).
- **Rien ne se stocke qui se dérive** : le temps se lit de la figure (`TEMPS_DE_FIGURE`), la numérotation de l'ordre (H4), la `RegionMap` de la salle des pas.
- `textes` : le texte porteur, verbatim, dans l'ordre de lecture, hors titre, pastilles, espaces de service (numéro, date, pied) et consignes des pas.
- `pas` : zone en pourcentage de la capture (contrat `RegionMap`, arrondi au centième) ; `ancrage` ∈ `repere` · `legende` · `proposee` (zone attribuée par ordre de lecture, à valider dans le PPT de validation) ; `null` si aucune zone.
- `notes` : verbatim. Leur grammaire (`Durée :`, `Consigne :`, `Vigilance :`, `Corrigé :`) arrive avec le PPT de validation (PKG-C).
- Le glossaire structuré et les renvois résolus viendront avec leurs consommateurs (H7, modules partagés), pas avant.
- `dessin` (figure `schema` seulement, PKG-B2) : le schéma redessiné — `cadre` et `elements` dans l'ordre d'empilement, en points : des **formes** (géométrie du catalogue DrawingML et ses ajustements, ou chemins libres ; rotation, retournement ; `fond` et `trait` par **rôle** ; texte mis en forme : paragraphes, fragments, corps, graisse, rôle, police d'origine), des **images** (par hash) et des **tableaux** (colonnes, lignes, cellules). Aucune couleur : un rôle (`marine-fort` … `gris-pale`, `papier`, `encre`) que le thème résout. `textes` et `visuels` restent l'inventaire verbatim du bloc.
- `dessin.partition` (PKG-B3) : comment le schéma se dévoile — par `colonnes` ou par `etapes` numérotées ; chaque élément porte son `pas` (absent : le décor) et son `ordre` dans le pas (le numéro de sa pastille).
- `composition` (figure `schema`, PKG-B4) : le schéma recomposé par un gabarit du wizard, qui prime sur `dessin` en salle. Aujourd'hui le `cas` : des phases (`numero`, `titre`, `couleur` de bandeau) faites d'étapes (`numero`, `texte`, `detail`, manière : `fond` par rôle, `bord` plein, en tirets ou sans), et la `legende` qui nomme ces manières. Le `tableau` (PKG-B5) : des `colonnes` (les phases, `titre`, `couleur`), des `lignes` (les couloirs, `titre`, `signe` : une vignette, éléments du dessin repris tels quels), des `etapes` placées par `ligne` et `colonne` (`numero` dans la phase, `texte`, manière, `signal` : la couleur de rôle du triangle d'alerte), l'`illustration` (le persona) et la `legende` (cases et triangles) ; manières et signaux y sont harmonisés sur la légende. `dessin` reste au pivot : c'est d'après lui que la composition se relit.
- `visuels[]` (PKG-B6) : outre `media`, `capture` et `rognage`, le `role` d'un visuel qui n'est pas une capture (`pictogramme`, `section`, `duree`), sa `legende` (le libellé posé sous lui sur un écran), son `fond` (l'aplat d'origine d'un pictogramme, en rôle de couleur). Les visuels viennent de la diapositive et de sa disposition d'origine.
- `structure` (figures de texte et étapes clés, PKG-B3) : des `rangees` de haut en bas, des `colonnes` de gauche à droite (une colonne peut porter le `visuel` qui l'illustre), des `noeuds` — `titre`, `paragraphe`, `liste` (numérotée ou non, items et leurs `details`), `definitions` (terme, texte, détails). Les textes gardent leur graisse en `**…**`. Le dévoilement s'en dérive, par niveau de hiérarchie 1.
- La trace de classification (le signal qui a décidé la figure) vit au rapport, jamais au pivot ; la projection des couleurs d'origine sur les rôles aussi (règle DESSIN).

### 4.2 Les figures de salle

| Figure | Temps | Signal dans le deck hérité | Salle | Papier | Animation (PPT) |
|---|---|---|---|---|---|
| `couverture` | — | 1ʳᵉ diapositive | titre, public, durée | page de garde | idem |
| `ecran-animation` | animation | « Ecran Votre promotion », Pause, Déjeuner, Météo, et leur texte : émargement, tour de table, météo, questions, remerciement | écran plein, minuteur si une durée est notée | absent (horaires en tête) | idem, consigne en notes |
| `transition` | — | « Slide transition » (13/13) | carte de séquence, au mode de transition de la prise | intercalaire de chapitre | idem |
| `objectifs` | E | titre « Objectifs… » | liste dévoilée | encadré | idem |
| `contenu` | E | texte, avec ou sans visuel | organisé (fiches, sections, listes, définitions), dévoilé par niveau 1 | texte intégral, organisé | idem |
| `processus` | E | tableau d'étapes (ex. PTP-040-010) | tableau, ligne active | tableau | idem |
| `schema` | E | groupe dense de formes (fiches personae, architecture S2P) | recomposé par un gabarit du wizard quand il en relève (PKG-B4), sinon redessiné en SVG à la manière du thème ; dévoilé pas à pas (colonnes, étapes numérotées), chaque pas se trace | le même SVG, état final | formes natives réémises du dessin, ou sa composition en formes éditables et le dessin d'origine en annexe « pour contrôle » (PKG-C3) |
| `demonstration` | E | écran « Démonstration » | écran signal : ce qui va être montré dans Oracle | renvoi au pas-à-pas | idem |
| `pas-a-pas` | E (aide en R) | capture + pastilles (61) | **dévoilement pastille par pastille**, zoom sur la zone | capture, toutes pastilles, consignes numérotées | capture + pastilles, consignes en liste |
| `capture` | E | capture sans pastille (39) | image, zoom | image | idem ; diagnostic « capture muette » (H5) |
| `mise-en-pratique` | R | « À vous de jouer » + « Règles du jeu » | énoncé, données, minuteur, aide repliée (renvoi au pas-à-pas) | énoncé et données | énoncé ; corrigé en notes |
| `etapes-cles` | R* | « Que retenez-vous » (6/6) | liste dévoilée | encadré récapitulatif | idem |
| `synthese` | R* | « Synthèse contenu » | liste | annexe | idem |
| `glossaire` | — | glossaire Oracle ↔ Onet | infobulle sur chaque terme, dans toute la salle | annexe + index | idem |
| `renvoi` | — | lien vers un autre deck (Boost FA, navigation Fusion) | carte de renvoi (module partagé) | référence | idem |

`pas-a-pas` reprend l'identifiant et le contrat de `figure-pas-a-pas`. La route de salle le joue en mode `reveal` (dévoiler, sans gate, l'animateur avance), la route papier en état final.

### 4.3 Le PPT d'auteur (« PPT de validation ») : la grammaire

*PKG-C3 (18/10) : un schéma en formes natives — le dessin en groupe « G·schéma » (repère enfant au point près, dévoilement dans les noms : « pas n · ordre k · pastille »), ou, recomposé, sa composition en formes éditables (« G·cas n », « G·étape n », « G·phase n », « G·couloir n », « G·signal », « G·légende n ») et le dessin d'origine sur une diapositive annexe masquée, « Pour contrôle uniquement » ; l'inventaire d'un schéma se dérive de ce qui le montre. Plus aucune lecture en étiquette JSON.*

*PKG-C2 (18/10) : la structure d'un texte en cadres « G·colonne r.c » et en paragraphes (• liste, numéros, ▸ définition, – détail, intertitre en gras 18 pt), `textes` dérivé de la structure ; l'ingestion complémentaire lit ce qu'ONET ajoute hors grammaire par l'heuristique de l'ingestion initiale et le signale. Pas d'animations (18/10).* 

*Mise en œuvre en PKG-C1 (17/10) : `src/emission/grammaire.ts` la tient en un seul endroit ; `emettre` l'écrit, `lire` la lit ; `lire(émettre(pivot₀)) ≡ pivot₀` sur les 166 diapositives du deck acheteur. Les identifiants sont des étiquettes OOXML (`GRADUIS.BLOC`, `GRADUIS.SOURCE`), le deck hérité une propriété du document ; la structure des textes (C2), le dessin, la partition et les recompositions (C3) voyageaient provisoirement en étiquette JSON, sorties depuis en grammaire.*

- **Un gabarit d'auteur généré du thème ONET**, sans reprendre le masque des decks hérités : une disposition par figure, nommée par elle (`G · Pas-à-pas`, `G · Mise en pratique`…). La disposition est le contrat : `lire` ne devine rien.
- **Les pastilles et les zones** : une forme de pastille unique au gabarit, numérotée par son texte ; une zone est un cadre sans remplissage, au style « zone ». `lire` apparie pastille n, zone voisine et ligne n des consignes.
- **Les consignes** : une liste numérotée dans l'espace réservé « Consignes ». L'appariement se fait par rang, jamais par proximité.
- **Les notes structurées** : `Durée :`, `Consigne :`, `Vigilance :`, `Corrigé :`. Le reste est le texte libre de l'animateur.
- **Les identifiants** : chaque diapositive porte son id de bloc et sa source dans une étiquette OOXML invisible. Dupliquer une diapositive duplique l'étiquette : `lire` le détecte et renumérote.
- **Le thème** : couleurs et polices du gabarit dérivées du thème ONET (P6). Aucune couleur en dur dans les diapositives émises. Montserrat n'est pas installée sur tous les postes : PowerPoint la remplace sans dommage, le PPT de validation étant un support de relecture (tranché le 18/10). Le texte d'un schéma garde sa police d'origine.
- **Les propositions** (P8) : une réécriture non acceptée vit dans les notes, marquée ✦, à côté de l'original qui reste sur la diapositive. L'accepter, c'est la porter sur la diapositive dans PowerPoint. `lire` lit toujours la diapositive, donc ce qui est accepté ; le rapport liste les propositions ouvertes.

---

## 5. Les règles d'harmonisation et d'équilibrage

Chaque règle produit un diagnostic au rapport et, quand elle agit, une proposition au PPT d'auteur ou un effet de dérivation. Aucune n'invente de contenu.

| Règle | Ce qu'elle dit | Effet |
|---|---|---|
| **H1** | Une séquence opératoire a ses trois temps : E (pas-à-pas ou démonstration), R (mise en pratique), R* (étapes clés). | diagnostic : temps manquant |
| **H2** | L'écran projeté porte au plus N mots hors captures (proposition : 60). | proposition de découpe ou de descente aux notes et au papier (P4) |
| **H3** | Un pas = une pastille dévoilée ; au plus 9 pastilles par capture. | effet de salle ; au-delà, proposition de découpe |
| **H4** | La numérotation se dérive : séquences, sections, pas. | les numéros saisis sont ignorés et signalés s'ils divergent |
| **H5** | Une capture est lisible à 1920 px (résolution ≥ 1,0) ; une capture sans pastille est muette. | diagnostic : « à recapturer », « à commenter » |
| **H6** | Une mise en pratique a son énoncé, ses données et ses étapes clés ; son titre est le sien. | diagnostic |
| **H7** | Les termes du glossaire Oracle ↔ Onet sont reconnus partout. | effet : infobulle (salle), index (papier) |
| **H8** | Aucun marqueur d'inachèvement ne sort (« A rédiger », « XXX », « Insérer… »). | **bloquant à la livraison** |
| **H9** | Les séquences restent comparables en durée et en densité. | diagnostic au-delà d'un seuil |

Les seuils (N, 9, celui de H9) se valident une fois avec ONET, sur le démonstrateur : c'est la **charte d'harmonisation**. Les decks suivants se recettent contre elle, pas contre des goûts.

---

## 6. La filiation avec le wizard

| Du wizard | Au packager | Mode |
|---|---|---|
| Dérivation déterministe, identité par hash sémantique (`stringify2` ≡ `json.dumps(ensure_ascii=False, indent=2)+\n`), I-WIZ-2 | relevé, pivot, sorties, manifeste | repris tel quel (copie avec provenance, `src/lib/json.ts`) |
| `RegionMap` (`Zone{rect %, step, consigne, dit}`), `figure-pas-a-pas`, mode `reveal` | figure `pas-a-pas` | contrat repris tel quel |
| Un thème, une table (PE1) ; `graduis/theme@1` | le thème ONET | principe repris ; le thème est celui du module NDF (primitives + couche sémantique), tel quel ; sa conversion en `theme@1` n'est pas requise en v0 |
| Transitions à la prise (didactique · motion · narratif ; T1–T4) | prise de salle | repris ; didactique seul en v0 |
| La prise : interprétation figée, hashée, hors signifié | prise de salle | transposé (thème, transitions, dévoilement) |
| Route papier (`imprimer.html`, impression Chromium, recette pdf.js) | `participant.pdf` | transposé |
| Compagnon (worker Python local ; couture, jamais fork) | le relevé | transposé : l'ingestion héritée, en lecture seule, en Python (proposition, A-1) |
| Registre des actes IA (I-WIZ-8) ; ✦ = acte IA | propositions IA | repris : optionnel, gâté, tracé |
| `decisions.md` seul document de trace ; clôture et reprise | idem | repris |
| Cristal, empreinte, `.mfapx`, scène d'autorat, effecteur apprenant | — | non repris en v0 (P5) |

---

## 7. Invariants (I-PKG)

- **I-PKG-1 · Ockham** — Aucun champ du pivot sans effet dans une sortie ou un diagnostic.
- **I-PKG-2 · Déterminisme** — Même PPT d'auteur ⇒ même pivot (hash) ; même pivot et même prise ⇒ même salle, à l'octet. Le PDF se recette sur sa couche texte (horodatage exclu).
- **I-PKG-3 · Aller-retour** — `lire(émettre(pivot)) ≡ pivot`. Bloquant.
- **I-PKG-4 · L'heuristique ne livre jamais** — Seule la lecture grammaticale alimente les sorties.
- **I-PKG-5 · Écart tracé** — Verbatim par défaut. Tout écart relevé ↔ pivot figure au rapport. Une réécriture non acceptée n'entre dans aucune sortie.
- **I-PKG-6 · Un thème** — 0 hex hors jetons, dans la salle, le papier et le PPT émis.
- **I-PKG-7 · Rien à installer** — La salle est un fichier unique, sans aucune requête réseau.
- **I-PKG-8 · IA optionnelle** — Tout acte IA passe par le registre et sort en proposition ✦. La chaîne tourne intégralement sans clé.
- **I-PKG-9 · Données du client** — Les decks et captures ONET restent hors dépôt et sur nos postes. Ils n'en sortent que par un acte IA du registre, et seulement si ONET y a consenti.
- **I-PKG-10 · Trace** — Chaque livraison écrit son manifeste ; l'historique des livraisons s'en dérive. Seul `decisions.md` est rédigé.

---

## 8. Arbitrages ouverts

Rangés au backlog, sous la session qui doit les trancher (`docs/backlog-v0.md`, « À trancher au démarrage »). Tranchés le 17/10 (`decisions.md`) : P2, le thème, la pile (TypeScript), le lien au wizard (copie avec provenance), le nom du pivot (`seance-spec`), le dépôt (`ontaly-graduis`), l'ancrage des pas incomplets (zones proposées par ordre de lecture). Tranchés le 18/10 : les deux ingestions, le repli de police du PPT (PowerPoint remplace Montserrat sans dommage), les animations (on s'en passe), ce que montre un schéma recomposé (sa composition, le dessin d'origine en annexe « pour contrôle uniquement »).

---

## 9. Ce que la spec suppose vrai sans l'avoir mesuré

- Les 49 autres decks ressemblent à celui-ci. Le template unique est dit, pas mesuré : `releve_pptx.py` se rejoue sur chaque deck reçu.
- Les consultants ouvrent un `.html` local dans un navigateur récent, sans blocage, et le SharePoint Boost les laisse le télécharger.
- Un mode présentateur à deux fenêtres fonctionne en `file://`, sans serveur.
- PowerPoint conserve les étiquettes OOXML à l'édition et au copier-coller.
- Les équipes ONET acceptent un gabarit contraint pour modifier leurs supports.
- Le thème de l'e-learning NDF convient à la projection : contrastes et tailles lisibles à distance, à vérifier en salle. Montserrat (OFL) s'embarque dans la salle et le papier.
- Le deck acheteur ne couvrirait que le jour 2 : la diapo 7 annonce un jour 1 « Prise en main d'Oracle Fusion, Catalogue/BPA » qu'on n'y trouve pas, hors un renvoi. À vérifier avec ONET.
