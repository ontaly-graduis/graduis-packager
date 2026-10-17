# CLAUDE.md — Graduis Packager

Conventions pour toute session de code dans ce dépôt. Lis d'abord `docs/spec-graduis-packager-v0.md`, puis la section du backlog de la session en cours (`docs/backlog-v0.md`) et ses « À trancher au démarrage ».

## Ce que c'est

L'outil interne d'Ontaly qui refait des supports d'animation présentielle existants (PPT) : ingestion du deck hérité → PPT d'auteur à grammaire (revu dans PowerPoint) → pivot hashé → trois sorties dérivées : la salle (HTML interactif, fichier unique), le papier (PDF participant) et l'animation (PPT). Premier client : ONET, programme Boost. On vend un résultat, pas l'outil.

## Garde-fous non négociables

1. **Pas de fonction sans appelant nommé dans le même commit.** Aucun export spéculatif, aucun « pour plus tard ».
2. **I-OCKHAM** : aucun champ du pivot sans effet observable dans une sortie ou un diagnostic (I-PKG-1).
3. **Dérivation déterministe, identité sémantique.** Hash = sha256 de `stringify2` (`JSON.stringify(obj, null, 2) + "\n"` ≡ `json.dumps(ensure_ascii=False, indent=2)`), comme le wizard ; entiers seuls dans ce qui se hache. Même PPT d'auteur ⇒ même pivot ; même pivot + même prise ⇒ même salle, à l'octet (I-PKG-2).
4. **L'aller-retour est bloquant** : `lire(émettre(pivot)) ≡ pivot` (I-PKG-3). Toute évolution de la grammaire passe ce test.
5. **L'heuristique ne livre jamais** (I-PKG-4). L'ingestion héritée produit un PPT d'auteur, jamais une sortie.
6. **Verbatim par défaut, écart tracé** (I-PKG-5). Une réécriture est une proposition ✦ dans les notes du PPT d'auteur ; elle n'entre dans aucune sortie tant qu'elle n'est pas portée sur la diapositive.
7. **Un thème, une table** : le thème ONET repris du module NDF (`gabarits/theme-onet/`, avec sa provenance), jamais modifié ici ; 0 hex hors jetons, dans la salle, le papier et le gabarit PPT émis (I-PKG-6).
8. **Rien à installer** : la salle est un fichier unique, sans aucune requête réseau (I-PKG-7).
9. **Tout acte IA passe par le registre**, sort en proposition ✦, et la chaîne tourne intégralement sans clé (I-PKG-8).
10. **Les données du client restent hors dépôt** : decks, captures et sorties ONET vivent dans `docs/sources/` et `out/`, ignorés par git (I-PKG-9).

## Vocabulaire

Celui du wizard (canon-effecteur-v1), sans le redéfinir : `prise` (interprétation figée, hashée), `figure`, `temps` (E · R · R*), `dévoilement` (coordonnée de la prise, jouée par la route), `thème` (`graduis/theme@1`, une table), `region_map`, `zone`, `pastille`. Propres au packager : **deck hérité** (le PPT reçu), **relevé** (ce que l'ingestion héritée en lit), **PPT d'auteur** (la source à grammaire), **pivot** (nom à trancher, proposition `seance-spec`), **salle** · **papier** · **animation** (les trois routes), **charte d'harmonisation** (les seuils H1–H9 validés avec le client). Le mot « transition » désigne la figure d'entrée de séquence ; le mode de transition est celui de la prise.

## Structure attendue

```
graduis-packager/
  docs/        spec, decisions, backlog ; sources/ (decks client, hors dépôt)
  scripts/     relevés de mesure (releve_pptx.py)
  atelier/     relever · qualifier · emettre · lire · diagnostiquer · rapport (pile : A-1)
  effecteur/   salle (fichier unique) · papier (impression) (pile : A-1)
  gabarits/    theme-onet/ (thème DS Onet repris, PROVENANCE.md) ; le gabarit d'auteur PPT se génère de ce thème
  golden/      séquence de référence : pivot + sorties (anonymisé ou hors dépôt)
  tests/
```

## Style

Docs et commentaires en français. Commentaires sobres : une ligne de rôle par fichier. Tests à chaque invariant (déterminisme, aller-retour, 0 hex, zéro requête réseau). Les décisions d'architecture prises en session → une ligne datée dans `docs/decisions.md` (seul document de trace, décisions uniquement, jamais d'état).

## Clôture & reprise

Comme le wizard : trois supports durables, rôles disjoints — **git** (ce qui a changé), **`docs/decisions.md`** (ce qui a été décidé), **`docs/backlog-v0.md`** (ce qui reste, et les « À trancher au démarrage » de chaque session).

- **Clôture** : décisions → lignes datées ; arbitrages soulevés non tranchés → « À trancher au démarrage » de la session concernée ; la « Sortie » de la session vraie (tests verts) ; commit propre ; handoff = récap en chat, jamais un fichier maintenu.
- **Ouverture** : lire la dernière Sortie atteinte, les lignes de `decisions.md` depuis la reprise, la section du backlog et ses « À trancher » ; trancher ; puis coder.
- **Dépôt** : à créer (arbitrage A-4). Une branche par session, merge `--no-ff`.
