// -----------------------------------------------------------------------------
// Static list of the teams that can be followed, grouped by competition.
//
// `id` is stored in the user configuration and in the scenes (`team` field of
// the trigger and of the action): NEVER rename it. It stays sport-agnostic; a
// club that plays several competitions (ASVEL, Paris) is ONE team with one
// reference per competition, so following it shows all its games.
//
// `refs` maps a competition to the stable id of the team in its source:
//   - nba:           ESPN team id (site.api.espn.com)
//   - euroleague:    club code of api-live.euroleague.net
//   - betclic_elite: `club_external_id` of api-prod.lnb.fr (stable across
//                    seasons, unlike the season-scoped team `external_id`)
//
// After a change, run `npm run sync-manifest` to update the option lists of
// the manifest.
// -----------------------------------------------------------------------------

export const COMPETITIONS = [
  { id: 'nba', name: 'NBA', sport: 'basketball' },
  { id: 'euroleague', name: 'EuroLeague', sport: 'basketball' },
  { id: 'betclic_elite', name: 'Betclic Élite', sport: 'basketball' },
];

const nba = (id, ref, name, shortName) => ({ id, name, shortName, refs: { nba: ref } });

export const TEAMS = [
  // --- Betclic Élite (and EuroLeague for ASVEL and Paris) ---------------------
  {
    id: 'asvel',
    name: 'LDLC ASVEL',
    shortName: 'ASVEL',
    refs: { betclic_elite: '91', euroleague: 'ASV' },
  },
  {
    id: 'paris_basketball',
    name: 'Paris Basketball',
    shortName: 'Paris',
    refs: { betclic_elite: '58', euroleague: 'PRS' },
  },
  {
    id: 'boulazac',
    name: 'Boulazac Basket Dordogne',
    shortName: 'Boulazac',
    refs: { betclic_elite: '10' },
  },
  { id: 'bourg_en_bresse', name: 'JL Bourg', shortName: 'Bourg', refs: { betclic_elite: '13' } },
  { id: 'chalon', name: 'Élan Chalon', shortName: 'Chalon', refs: { betclic_elite: '17' } },
  { id: 'cholet', name: 'Cholet Basket', shortName: 'Cholet', refs: { betclic_elite: '20' } },
  { id: 'dijon', name: 'JDA Dijon', shortName: 'Dijon', refs: { betclic_elite: '27' } },
  {
    id: 'gravelines_dunkerque',
    name: 'BCM Gravelines-Dunkerque',
    shortName: 'Gravelines',
    refs: { betclic_elite: '33' },
  },
  {
    id: 'le_mans',
    name: 'Le Mans Sarthe Basket',
    shortName: 'Le Mans',
    refs: { betclic_elite: '38' },
  },
  { id: 'limoges', name: 'Limoges CSP', shortName: 'Limoges', refs: { betclic_elite: '43' } },
  { id: 'nancy', name: 'SLUC Nancy', shortName: 'Nancy', refs: { betclic_elite: '51' } },
  { id: 'nanterre', name: 'Nanterre 92', shortName: 'Nanterre', refs: { betclic_elite: '55' } },
  {
    id: 'pau',
    name: 'Élan Béarnais Pau-Lacq-Orthez',
    shortName: 'Pau',
    refs: { betclic_elite: '60' },
  },
  { id: 'roanne', name: 'Chorale Roanne', shortName: 'Roanne', refs: { betclic_elite: '65' } },
  {
    id: 'saint_quentin',
    name: 'Saint-Quentin Basket',
    shortName: 'Saint-Quentin',
    refs: { betclic_elite: '74' },
  },
  {
    id: 'strasbourg',
    name: 'SIG Strasbourg',
    shortName: 'Strasbourg',
    refs: { betclic_elite: '75' },
  },

  // --- EuroLeague ---------------------------------------------------------------
  { id: 'fc_barcelona', name: 'FC Barcelona', shortName: 'Barça', refs: { euroleague: 'BAR' } },
  {
    id: 'baskonia',
    name: 'Baskonia Vitoria-Gasteiz',
    shortName: 'Baskonia',
    refs: { euroleague: 'BAS' },
  },
  { id: 'besiktas', name: 'Besiktas Istanbul', shortName: 'Besiktas', refs: { euroleague: 'BES' } },
  { id: 'dubai', name: 'Dubai Basketball', shortName: 'Dubai', refs: { euroleague: 'DUB' } },
  {
    id: 'hapoel_tel_aviv',
    name: 'Hapoel Tel Aviv',
    shortName: 'Hapoel TLV',
    refs: { euroleague: 'HTA' },
  },
  {
    id: 'anadolu_efes',
    name: 'Anadolu Efes Istanbul',
    shortName: 'Efes',
    refs: { euroleague: 'IST' },
  },
  { id: 'real_madrid', name: 'Real Madrid', shortName: 'Real Madrid', refs: { euroleague: 'MAD' } },
  { id: 'olimpia_milano', name: 'Olimpia Milano', shortName: 'Milan', refs: { euroleague: 'MIL' } },
  {
    id: 'bayern_munich',
    name: 'FC Bayern Munich',
    shortName: 'Bayern',
    refs: { euroleague: 'MUN' },
  },
  {
    id: 'olympiacos',
    name: 'Olympiacos Piraeus',
    shortName: 'Olympiacos',
    refs: { euroleague: 'OLY' },
  },
  { id: 'valencia', name: 'Valencia Basket', shortName: 'Valencia', refs: { euroleague: 'PAM' } },
  {
    id: 'panathinaikos',
    name: 'Panathinaikos Athens',
    shortName: 'Panathinaïkos',
    refs: { euroleague: 'PAN' },
  },
  { id: 'partizan', name: 'Partizan Belgrade', shortName: 'Partizan', refs: { euroleague: 'PAR' } },
  {
    id: 'crvena_zvezda',
    name: 'Crvena Zvezda Belgrade',
    shortName: 'Etoile Rouge',
    refs: { euroleague: 'RED' },
  },
  {
    id: 'maccabi_tel_aviv',
    name: 'Maccabi Tel Aviv',
    shortName: 'Maccabi',
    refs: { euroleague: 'TEL' },
  },
  {
    id: 'fenerbahce',
    name: 'Fenerbahçe Istanbul',
    shortName: 'Fenerbahçe',
    refs: { euroleague: 'ULK' },
  },
  {
    id: 'virtus_bologna',
    name: 'Virtus Bologna',
    shortName: 'Virtus',
    refs: { euroleague: 'VIR' },
  },
  { id: 'zalgiris', name: 'Zalgiris Kaunas', shortName: 'Zalgiris', refs: { euroleague: 'ZAL' } },

  // --- NBA --------------------------------------------------------------------
  nba('atlanta_hawks', '1', 'Atlanta Hawks', 'Hawks'),
  nba('boston_celtics', '2', 'Boston Celtics', 'Celtics'),
  nba('brooklyn_nets', '17', 'Brooklyn Nets', 'Nets'),
  nba('charlotte_hornets', '30', 'Charlotte Hornets', 'Hornets'),
  nba('chicago_bulls', '4', 'Chicago Bulls', 'Bulls'),
  nba('cleveland_cavaliers', '5', 'Cleveland Cavaliers', 'Cavaliers'),
  nba('dallas_mavericks', '6', 'Dallas Mavericks', 'Mavericks'),
  nba('denver_nuggets', '7', 'Denver Nuggets', 'Nuggets'),
  nba('detroit_pistons', '8', 'Detroit Pistons', 'Pistons'),
  nba('golden_state_warriors', '9', 'Golden State Warriors', 'Warriors'),
  nba('houston_rockets', '10', 'Houston Rockets', 'Rockets'),
  nba('indiana_pacers', '11', 'Indiana Pacers', 'Pacers'),
  nba('la_clippers', '12', 'LA Clippers', 'Clippers'),
  nba('los_angeles_lakers', '13', 'Los Angeles Lakers', 'Lakers'),
  nba('memphis_grizzlies', '29', 'Memphis Grizzlies', 'Grizzlies'),
  nba('miami_heat', '14', 'Miami Heat', 'Heat'),
  nba('milwaukee_bucks', '15', 'Milwaukee Bucks', 'Bucks'),
  nba('minnesota_timberwolves', '16', 'Minnesota Timberwolves', 'Timberwolves'),
  nba('new_orleans_pelicans', '3', 'New Orleans Pelicans', 'Pelicans'),
  nba('new_york_knicks', '18', 'New York Knicks', 'Knicks'),
  nba('oklahoma_city_thunder', '25', 'Oklahoma City Thunder', 'Thunder'),
  nba('orlando_magic', '19', 'Orlando Magic', 'Magic'),
  nba('philadelphia_76ers', '20', 'Philadelphia 76ers', '76ers'),
  nba('phoenix_suns', '21', 'Phoenix Suns', 'Suns'),
  nba('portland_trail_blazers', '22', 'Portland Trail Blazers', 'Trail Blazers'),
  nba('sacramento_kings', '23', 'Sacramento Kings', 'Kings'),
  nba('san_antonio_spurs', '24', 'San Antonio Spurs', 'Spurs'),
  nba('toronto_raptors', '28', 'Toronto Raptors', 'Raptors'),
  nba('utah_jazz', '26', 'Utah Jazz', 'Jazz'),
  nba('washington_wizards', '27', 'Washington Wizards', 'Wizards'),
];

const TEAMS_BY_ID = new Map(TEAMS.map((team) => [team.id, team]));
const COMPETITIONS_BY_ID = new Map(COMPETITIONS.map((c) => [c.id, c]));

/** @param {string} id */
export function findTeam(id) {
  return TEAMS_BY_ID.get(id);
}

/** @param {string} id */
export function findCompetition(id) {
  return COMPETITIONS_BY_ID.get(id);
}

/**
 * Find a team from the id its source uses in a competition.
 * @param {string} competition
 * @param {string|number} ref
 */
export function findTeamByRef(competition, ref) {
  const value = String(ref);
  return TEAMS.find((team) => team.refs[competition] === value);
}

/** Teams playing a competition. */
export function teamsOf(competition) {
  return TEAMS.filter((team) => competition in team.refs);
}
