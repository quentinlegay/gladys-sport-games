# Gladys — Sport Games

Intégration externe pour [Gladys Assistant](https://gladysassistant.com) :
calendrier et résultats des équipes suivies. La v1 couvre le basket (NBA,
EuroLeague, Betclic Élite). Les clés restent génériques pour accueillir
d'autres sports d'équipe plus tard.

Basée sur le template officiel
[`integration-template-js`](https://github.com/GladysAssistant/integration-template-js),
le SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
et l'outillage de [`gladys-programmetele`](https://github.com/prohand/gladys-programmetele).

## Sources

| Provider                  | Source                                                                      | Clé | Requêtes                                        |
| ------------------------- | --------------------------------------------------------------------------- | --- | ----------------------------------------------- |
| `providers/nba.js`        | API ESPN non officielle (`site.api.espn.com/.../teams/{id}/schedule`)       | non | 3 par équipe NBA suivie (présaison, saison, PO) |
| `providers/euroleague.js` | `api-live.euroleague.net/v2/competitions/E/seasons/E{année}/games`          | non | 1 pour toute la saison                          |
| `providers/lnb.js`        | API du site lnb.fr (`api-prod.lnb.fr`, jeton anonyme de `lnb.fr/api/token`) | non | 1 par club suivi (+ contexte de saison partagé) |

Choix des sources (validés le 3 octobre 2026) :

- `cdn.nba.com` répond 403 aux clients qui ne sont pas des navigateurs, d'où
  ESPN. ESPN ne donne que les diffuseurs américains, donc `broadcaster` reste
  `null` en NBA.
- LNB : l'offre gratuite de TheSportsDB ne renvoie que 1 à 5 matchs par
  requête, et sa liste d'équipes est erronée. API-Basketball impose une clé et
  un quota. L'API du site officiel lnb.fr donne les horaires UTC, les scores et
  les diffuseurs français, sans clé. Elle n'est pas documentée : en cas de
  changement, seul `lnb.js` est à adapter. Le champ `api_key` du plan initial
  n'est donc pas nécessaire.
- Les identifiants d'équipe LNB (`external_id`) changent à chaque saison.
  `src/teams.js` stocke le `club_external_id`, qui est stable, et `lnb.js`
  retrouve l'identifiant de la saison.

Tous les providers renvoient le modèle `Match` commun (voir `src/schedule.js`).

## Fonctionnement

- Un appareil Gladys par équipe suivie, avec trois capteurs texte en lecture
  seule : `next_match`, `next_match_start` et `last_result`.
- `poll_frequency` est fixé à 1 min. Les calendriers sont mis en cache :
  6 h par source, 15 min quand un match est en cours ou attend son score.
  Après un échec, l'ancien calendrier est conservé et un nouvel essai a lieu
  15 min plus tard. Une source en panne ne bloque jamais les autres.
- Seuls les états qui ont changé sont publiés (limite de 300 états/min).
- Calculs et affichage se font en `Europe/Paris`, quel que soit le fuseau du
  conteneur.
- La plage de visionnage filtre le widget et le déclencheur, pas les capteurs.

## Widget et scènes (Gladys ≥ 5.1.0)

- **Widget `upcoming_matches`** : card-list des 8 prochains matchs dans la
  plage. `ttl_seconds` correspond au prochain coup d'envoi.
  `requestWidgetRefresh` est appelé à chaque coup d'envoi d'une équipe suivie.
  Réglage : `teams` (vide = équipes de la configuration).
- **Déclencheur `match_starting`** : une vérification par minute, rattrapage
  limité à 5 min. Filtres : `team` (appareil), `competition`, `minutes_before` (`0`, `15`,
  `30` ou `60`, obligatoire). Variables : `competition`, `home_team`,
  `away_team`, `start` et `broadcaster`. Un match entre deux équipes suivies
  produit un événement par équipe.
- **Action `get_next_match`** : champ `team` (appareil). Sorties : `next_match`,
  `next_start`, `opponent`, `is_home`, `competition`, `broadcaster` et
  `last_result`.
- **Action de configuration `test_sources`** : télécharge tout de suite et
  résume chaque compétition.

Les clés (sélecteur, widget, déclencheur, actions, champs, variables, sorties,
features et identifiants d'équipe) sont enregistrées chez les utilisateurs :
ne jamais les renommer.

## Configuration (manifest)

| Clé                   | Type           | Défaut                  |
| --------------------- | -------------- | ----------------------- |
| `teams_betclic_elite` | `multi_select` | asvel, paris_basketball |
| `teams_euroleague`    | `multi_select` | asvel, paris_basketball |
| `teams_nba`           | `multi_select` | (aucune)                |
| `watch_start`         | `select`       | 18:00                   |
| `watch_end`           | `select`       | 23:30                   |
| `include_night_games` | `boolean`      | false                   |

Une liste de cases à cocher par compétition (Gladys n'a pas de sélecteur avec
recherche) : une équipe n'est suivie que dans les compétitions où elle est
cochée. `normalizeConfig` en déduit `follows` (équipe → compétitions), `teams`
et `competitions`. Une configuration de la première version (`teams` +
`competitions`) est migrée automatiquement.

Les sélecteurs d'équipe du widget (`teams`), du déclencheur et de l'action
(`team`) utilisent `source: "devices"` : ils ne listent que les appareils créés,
et leur valeur est l'`external_id` de l'appareil de l'équipe.

Les listes d'options (équipes par compétition, compétitions, horaires) sont
générées depuis le code :

```bash
npm run sync-manifest
```

`test/manifest.test.js` échoue si le manifest n'est plus synchronisé.

## Structure

```
.
├─ index.js                     # démarrage SDK + branchement des événements
├─ src/
│  ├─ config.js                 # valeurs par défaut + nettoyage de la config
│  ├─ teams.js                  # équipes et compétitions (ids figés)
│  ├─ schedule.js               # agrégation, cache, plage horaire, formats
│  ├─ time.js                   # helpers Europe/Paris
│  ├─ providers/{nba,euroleague,lnb,http}.js
│  ├─ widget.js                 # widget "upcoming_matches"
│  ├─ scenes.js                 # déclencheur + action de scène
│  └─ devices/{index,team}.js   # 1 appareil par équipe (3 capteurs texte)
├─ scripts/sync-manifest.js     # options du manifest générées depuis le code
├─ test/                        # node --test, fixtures réelles par provider
├─ docs/fr.md, docs/en.md
├─ gladys-assistant-integration.json
└─ Dockerfile                   # Node 24 Alpine, rootfs en lecture seule
```

## Lancer en local

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="sport-games" \
LOG_LEVEL=debug \
npm start
```

## Vérifications

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # tests unitaires (node --test)
npx github:GladysAssistant/integration-store .   # validation du store
```

## Publier

1. Ajouter le topic GitHub `gladys-assistant-integration` au dépôt.
2. `cover.png` : 800×534 px, 150 Ko maximum (limite du store).
3. **Actions → Release → Run workflow** (`patch` / `minor` / `major`) : bump
   de version, tag et image multi-arch sur `ghcr.io/prohand/gladys-sport-games`.
   Rendre le package GHCR public.

## Licence

Apache-2.0

# gladys-sport-games
