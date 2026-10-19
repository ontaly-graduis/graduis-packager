# Le démonstrateur ONET Boost — déroulé (PKG-E)

La démonstration montre la chaîne sur la séquence « Commande à partir d'une DA hors catalogue » (diapositives 30 à 58,
séquence `s030`), la même séquence avant et après (tranché le 18/10). David anime. La date chez ONET n'est pas fixée :
tout est jouable dès maintenant ; une répétition à blanc devant Karim et Mehdi la précède.

Les sorties vivent dans `out/boost-acheteur/` (hors dépôt, I-PKG-9). Les commandes se lancent à la racine du dépôt
(`npx tsx src/cli/packager.ts …`) et prennent le procédé ONET : `--procede onet-boost` (depuis GEN-1, le code ne nomme plus
le client) ; imprimer demande le Chromium de Playwright (`npx playwright install chromium`, à défaut Google Chrome ou
`PW_CHROMIUM`), la planche LibreOffice. `packager rejouer onet-boost "docs/sources/<deck>.pptx"` refait toute la chaîne et
la compare à la référence du procédé (v0.2) ; les pictogrammes EMF viennent des conversions figées
(`docs/sources/medias-converties/`).

## Préparer (la veille)

1. **Trancher la revue, chronométrée.** `packager revue out/boost-acheteur/validation.pptx --sequences s030` écrit
   `revue-s030.html` : la relecture de la séquence, puis chaque point à trancher dans l'ordre du PPT, avec son geste.
   Ouvrir la fiche à côté de PowerPoint ; « Commencer » / « Fait » sur chaque point ; renseigner la relecture d'ensemble ;
   « Exporter la mesure ». Le temps mesuré, rapporté aux constats de la journée, donne le temps humain résiduel d'un deck
   (cible : au plus un jour) — il se reporte dans `decisions.md`.
2. **Livrer.** `packager livrer out/boost-acheteur/validation.pptx --sequences s030` écrit `livraison-s030/` : la salle,
   le papier imprimé et recetté, le PPT d'animation, le rapport de la journée et le manifeste (les empreintes de tout ce qui
   est livré). Un constat bloquant dans la séquence arrête la livraison.
3. **La planche.** `packager planche "docs/sources/<deck>.pptx" out/boost-acheteur/livraison-s030` écrit `avant-apres.html` :
   chaque diapositive d'origine face à la même en salle.
4. **Le scénario.** Préparer une vraie capture Oracle récente pour un pas-à-pas (par défaut : diapositive 40 du PPT de
   validation, « Réaffecter une DA en attente de commande »). Le scénario joué à l'avance est dans `scenario/` (une capture
   bandeautée, sa livraison, son `diff.html`) : c'est le plan B.

## Jouer (≈ 30 min)

| Temps | Moment | Ce qu'on montre | Ce qu'on dit |
|---|---|---|---|
| 2 min | Le point de départ | `avant-apres.html`, colonne de gauche | 166 diapositives hétérogènes, 61 pas-à-pas, 50 decks comme celui-ci. |
| 3 min | Le rapport | `livraison-s030/rapport.html` | Ce qui bloque (5 marqueurs d'inachèvement), ce qui se discute (écrans denses, séquences hors norme) : la charte d'harmonisation se valide une fois avec ONET, sur ces seuils. |
| 5 min | Le PPT de validation | `validation.pptx` dans PowerPoint | Une disposition par figure ; les pastilles, leurs zones (une zone ✦ est à valider), les consignes par rang ; les schémas en formes modifiables, le dessin d'origine en annexe « pour contrôle uniquement ». C'est là qu'ONET relit et modifie. |
| 8 min | La salle | `salle-s030.html`, plein écran | Dévoilement pastille par pastille, zoom (Z), présentateur (P), notes (N), minuteur (T), aide (?). Un fichier, aucune installation, aucun réseau. |
| 3 min | Le papier | `participant-s030.pdf` | Garde, sommaire, les pas-à-pas pleine largeur, une page de notes par séquence, le glossaire ; sa couche texte est recettée ligne à ligne. |
| 5 min | La modification | PowerPoint, puis le terminal | Sur la diapositive 40 : clic droit sur la capture, « Changer l'image », enregistrer. `packager livrer scenario/validation.pptx --sequences s030` (≈ 10 s), puis `packager diff out/boost-acheteur/livraison-s030 out/boost-acheteur/scenario/livraison-s030` : un bloc change, l'image avant et après, les trois sorties à jour. |
| 2 min | Avant / après | `avant-apres.html` | La même séquence, la même matière, au thème ONET. |
| 2 min | Le chiffrage | la mesure de revue | Le temps humain résiduel par deck, et ce qui le fait baisser (la charte, les recaptures). |

## L'option « vivante » : faire jouer la séquence (ACT-1, ≈ 8 min)

Le procédé `onet-boost-moyenne` est ONET Boost en sensibilité moyenne : même profil, même thème, même charte ; la chaîne
y propose les activités qui se dérivent sans rien inventer. Elle se montre à ONET comme une option.

1. **Préparer.** `packager emettre "docs/sources/<deck>.pptx" --procede onet-boost-moyenne --sortie out/boost-acheteur-moyenne`
   écrit un PPT de validation où la chaîne a proposé ses activités (huit sur la journée, trois dans `s030`) : « Dans quel
   ordre ? » après le schéma de la diapositive 31, « Où ranger chaque étape ? » après le processus de la 32, « Qu'avez-vous
   retenu ? » avant les étapes clés. Dans PowerPoint, ajouter un « où cliquez-vous ? » : sélectionner la diapositive
   « Réaffecter une DA en attente de commande », Accueil › Nouvelle diapositive › « G · Sélection sur image », enregistrer.
   Puis `packager livrer out/boost-acheteur-moyenne/validation.pptx --procede onet-boost-moyenne --sequences s030`.
2. **Jouer.** Dans `salle-s030.html` : → donne la consigne, puis le corrigé. Au clavier, la salle répond, l'animateur
   saisit — Classement : les numéros dans l'ordre dicté ; Catégorisation : le numéro d'une carte, puis celui de sa colonne ;
   Rappel : le numéro de ce qui sort ; ⌫ annule ; T lance le minuteur à la durée de l'activité. Le présentateur (P) a le
   corrigé et les touches. Le livret porte la fiche de chaque activité.
3. **Ce qu'on dit.** Rien n'est inventé : chaque mot vient de la diapositive source (l'écart le mesure : zéro) ; l'activité
   pointe vers sa source — changer l'étape d'un schéma change l'activité ; on garde une proposition, ou on supprime sa
   diapositive ; le minutage (43 minutes sur la journée) se règle dans le PPT.

## Ce qui peut casser, et le plan B

- Pas de Chrome sur le poste : le papier reste en HTML (`packager imprimer` ailleurs) ; montrer le PDF déjà livré.
- PowerPoint « répare » le fichier ou la modification échoue : jouer `scenario/` (déjà livré, son `diff.html` prêt).
- Vidéoprojecteur : la salle se met à l'échelle de la fenêtre ; la tester sur le projecteur de la salle avant.
