# Provenance — thème ONET

Repris tel quel (copie, jamais modifiée ici) le 2026-10-17, décision David du même jour (`docs/decisions.md`).

- **Origine** : `graduis-agency/ONET/boost/` — module e-learning NDF « saisisseur » (pipeline Graduis Agency, temps 5, `sp-tokens`).
- **Statut à l'origine** : « G-tokens FIGÉE — validée le 2026-06-30 », dérivée du DS Onet live (Claude Design `3ae46495-a853-470d-ae63-de4f76c7e3f9`).
- **Couches** : `tokens.css` (primitives `--c-*`, figées) → `ds-onet.css` (couche sémantique `--color-*`, recréée dans l'effecteur NDF ; seuls hex hors primitives : ses dérivés) ; `design-tokens.json` (les mêmes primitives au format DTCG).
- **Police** : Montserrat (licence OFL), woff2 latin et latin-ext en 400, 600 et 700, repris du build de l'effecteur NDF (suffixe de hash Vite retiré).
- **Logo** : `ONET/boost/DS/logo-onet-bleu.svg`.
- **Mouvement** (ajouté le 17/10, décision du même jour) : le thème ne déclare aucun jeton de mouvement ; ses valeurs vivent dans la feuille de l'effecteur NDF. `mouvement.css` en extrait les durées, courbes, décalages et keyframes **à l'identique**, sous des noms de jetons (`--mvt-*`, `--courbe-*`).

Toute évolution du thème se fait à l'origine (ou se décide dans `docs/decisions.md`), puis se recopie ici avec ses nouveaux hashes.

| Fichier | Source | sha256 |
|---|---|---|
| `tokens.css` | `pipeline-graduis/etape-5/effecteur-ndf/theme/tokens.css` | `sha256:285d1a6cd7c395944f140dac4b19c2d338943bd7bcc9df23e3f0d91c3de4f75b` |
| `ds-onet.css` | `pipeline-graduis/etape-5/effecteur-ndf/theme/ds-onet.css` | `sha256:980753362cfd75090a9caf2a2ea78d71b6e8f95aecc7bd3a7052e7c3b000e31a` |
| `design-tokens.json` | `pipeline-graduis/etape-5/mod-ndf-saisisseur.mfapx/theme/design-tokens.json` | `sha256:c13859df873d14e709a24112a6b8e670d7afaab7671345569f87898f1726bdf3` |
| `logo-onet-bleu.svg` | `DS/logo-onet-bleu.svg` | `sha256:08ea822538c6a340840308404c09ca2aba1b5a69ecd145a43d0ae3dfaba146da` |
| `polices/montserrat-latin-400-normal.woff2` | `pipeline-graduis/etape-5/effecteur-ndf/dist/assets/montserrat-latin-400-normal-<hash>.woff2` | `sha256:e66bcd2761ab6924b25ce70dafe10e57a39193c4fea1516730bd9cb5240af6c8` |
| `polices/montserrat-latin-600-normal.woff2` | `pipeline-graduis/etape-5/effecteur-ndf/dist/assets/montserrat-latin-600-normal-<hash>.woff2` | `sha256:d857325c360f7128b347ca924c1974967aaa886ba47dad22e4042d6c38b26a83` |
| `polices/montserrat-latin-700-normal.woff2` | `pipeline-graduis/etape-5/effecteur-ndf/dist/assets/montserrat-latin-700-normal-<hash>.woff2` | `sha256:f9d9e65b15372cebcafc3acd1e664a564c5c4b23278de4d5760de9a13c530371` |
| `polices/montserrat-latin-ext-400-normal.woff2` | `pipeline-graduis/etape-5/effecteur-ndf/dist/assets/montserrat-latin-ext-400-normal-<hash>.woff2` | `sha256:30f166cea0894715f7b1342798306dd4206bc1d0331440d543f6e7f7fff04539` |
| `polices/montserrat-latin-ext-600-normal.woff2` | `pipeline-graduis/etape-5/effecteur-ndf/dist/assets/montserrat-latin-ext-600-normal-<hash>.woff2` | `sha256:1d8a4af6a50cc4f7561e8484d5bff39acda90016b8e8cbb5cee69c253bb02750` |
| `polices/montserrat-latin-ext-700-normal.woff2` | `pipeline-graduis/etape-5/effecteur-ndf/dist/assets/montserrat-latin-ext-700-normal-<hash>.woff2` | `sha256:a59fcc944a712e213a2f3bd994367129217c75f24a9155a5a3c1a0f5fd2cc9a7` |
| `mouvement.css` | `pipeline-graduis/etape-5/effecteur-ndf/theme/effecteur.css` (extrait, valeurs verbatim) | `sha256:1b55baf7069d607f789cdf62843f091437d49603ffe5da29d2756d8603bd706a` |
