# gladys-matchs — Intégration externe Gladys Assistant

Calendrier des matchs des équipes suivies dans Gladys Assistant. La v1 couvre
le basket : NBA, Euroleague et Betclic Elite. Le nom et les clés sont génériques
pour pouvoir ajouter d'autres sports d'équipe plus tard (hand, foot, rugby).

## Références

- Template officiel : https://github.com/GladysAssistant/integration-template-js
- SDK : https://github.com/GladysAssistant/integration-sdk-js (`@gladysassistant/integration-sdk`)
- Modèle à suivre (même structure, même outillage) : https://github.com/prohand/gladys-programmetele

## Règles non négociables

- **Clés figées** : le sélecteur, ainsi que les clés de widget, de déclencheur,
  d'action, de champs, de variables et de sorties, sont enregistrés dans les
  scènes des utilisateurs. On ne les renomme jamais. Ces clés restent
  génériques et ne doivent jamais contenir `basket_` ni `nba_`.
- **Fuseau** : tous les calculs et affichages se font en `Europe/Paris`, quel
  que soit le fuseau du conteneur.
- **poll_frequency** : fixé à 1 min. C'est le maximum accepté par Gladys
  (`DEVICE_POLL_FREQUENCIES`).
- **Résilience** : si une source échoue, on garde l'ancien calendrier en cache
  et on refait un essai 15 min plus tard. Un provider en panne ne doit jamais
  casser les autres.
- **Outillage** : Prettier, ESLint, tests avec `node --test`, Dockerfile Node 24
  Alpine avec rootfs en lecture seule. Valider avec
  `npx github:GladysAssistant/integration-store .`

## Modèle de données commun

Chaque provider renvoie des objets `Match` normalisés :

```js
{
  id: "nba:0022600123",        // préfixe provider + id source
  sport: "basketball",
  competition: "nba",          // nba | euroleague | betclic_elite
  homeTeam: { id, name, shortName },
  awayTeam: { id, name, shortName },
  start: "2026-10-21T00:00:00Z", // toujours en UTC, conversion Paris à l'affichage
  status: "scheduled",         // scheduled | live | finished | postponed
  score: { home: null, away: null },
  broadcaster: null            // ex. "DAZN", "La Chaîne L'Équipe", "Skweek"
}
```

## Providers (`src/providers/`)

Chaque provider expose `async fetchSchedule({ season })` et renvoie `Match[]`.

| Fichier         | Source                                                                   | Clé API        | Statut               |
| --------------- | ------------------------------------------------------------------------ | -------------- | -------------------- |
| `nba.js`        | JSON statique cdn.nba.com (calendrier saison) ou API ESPN non officielle | non            | à vérifier           |
| `euroleague.js` | `api-live.euroleague.net` (Swagger public)                               | non            | à vérifier           |
| `lnb.js`        | TheSportsDB ou API-Basketball (api-sports.io)                            | oui (gratuite) | **source à choisir** |

Le cache du calendrier dure 6 h. Les jours de match, on peut rafraîchir plus
souvent pour avoir les scores (option v2).

**Point ouvert** : la LNB n'a pas d'API publique documentée connue. Avant de
coder `lnb.js`, il faut valider la couverture et la fraîcheur des horaires
Betclic Elite, qui sont souvent fixés tardivement. Si API-Basketball couvre bien
les trois ligues, on peut envisager un provider unique.

## Appareils

On crée un appareil Gladys par équipe suivie, avec des capteurs texte en
lecture seule :

- `next_match` : « ASVEL – Paris (Betclic Elite) »
- `next_match_start` : date et heure du prochain match (heure de Paris)
- `last_result` : « ASVEL 85 – 78 Paris »

## Configuration (manifest)

| Clé                   | Type           | Rôle                                                                                                          |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| `teams_<competition>` | multi_select   | une liste par compétition (`teams_betclic_elite`, `teams_euroleague`, `teams_nba`), équipes de `src/teams.js` |
| `watch_start`         | select / heure | début de la plage de visionnage (défaut 18:00)                                                                |
| `watch_end`           | select / heure | fin de la plage (défaut 23:30)                                                                                |
| `include_night_games` | booléen        | inclure les matchs hors plage (NBA de nuit)                                                                   |

La plage horaire filtre le widget et le déclencheur, pas les capteurs.

## Widget et scènes

- **Widget `upcoming_matches`** : card-list des prochains matchs des équipes
  suivies, 8 au maximum. `ttl_seconds` correspond au début du prochain match.
  `requestWidgetRefresh` est appelé au coup d'envoi.
- **Déclencheur `match_starting`** : une vérification par minute.
  - Filtres : `team` (multi_select), `competition` (multi_select),
    `minutes_before` (0, 15, 30, 60).
  - Variables : `competition`, `home_team`, `away_team`, `start`, `broadcaster`.
  - Rattrapage limité à 5 min après une coupure.
- **Action `get_next_match`** : champ `team`.
  - Sorties : `next_match`, `next_start`, `opponent`, `is_home`, `competition`,
    `broadcaster`, `last_result`.

## Structure cible

```
.
├─ index.js
├─ src/
│  ├─ config.js          # défauts + nettoyage config
│  ├─ teams.js           # liste statique des équipes par compétition
│  ├─ schedule.js        # agrégation providers + cache + filtres plage horaire
│  ├─ time.js            # helpers Europe/Paris
│  ├─ providers/{nba,euroleague,lnb}.js
│  ├─ widget.js
│  ├─ scenes.js
│  └─ devices/{index,team}.js
├─ test/                 # fixtures JSON par provider + tests node --test
├─ docs/fr.md, docs/en.md
├─ gladys-assistant-integration.json
└─ Dockerfile
```

## Plan de développement

1. Initialiser le projet depuis le template et reprendre l'outillage de
   gladys-programmetele.
2. Écrire `provider euroleague` avec des fixtures et des tests. C'est la source
   la plus propre, donc on valide le modèle `Match` avec elle.
3. Écrire `provider nba`, avec des fixtures et des tests.
4. Valider la source LNB, puis écrire `provider lnb`.
5. Écrire `schedule.js` (agrégation, cache, filtre plage horaire) et `time.js`.
6. Créer les appareils équipe et leurs capteurs.
7. Ajouter le widget `upcoming_matches`.
8. Ajouter le déclencheur `match_starting` et l'action `get_next_match`.
9. Rédiger la doc fr/en, la cover 800×534 px (150 Ko max), le topic GitHub et
   le workflow de release.
