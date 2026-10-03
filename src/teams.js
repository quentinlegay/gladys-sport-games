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
//   - nationale_1:   `idOrganisme` (club id) of api.ffbb.app (stable across
//                    seasons, unlike the season-scoped `idEngagement`)
//
// After a change, run `npm run sync-manifest` to update the option lists of
// the manifest.
// -----------------------------------------------------------------------------

export const COMPETITIONS = [
  { id: 'nba', name: 'NBA', sport: 'basketball' },
  { id: 'euroleague', name: 'EuroLeague', sport: 'basketball' },
  { id: 'betclic_elite', name: 'Betclic Élite', sport: 'basketball' },
  { id: 'nationale_1', name: 'Nationale 1', sport: 'basketball' },
];

const nba = (id, ref, name, shortName) => ({ id, name, shortName, refs: { nba: ref } });
const nm1 = (id, ref, name, shortName) => ({ id, name, shortName, refs: { nationale_1: ref } });

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

  // --- Nationale 1 (season 2026-27, pools A and B) -----------------------------
  nm1('angers', '200000002676840', 'Étoile Angers Basket', 'Angers'),
  nm1('berck', '10463', 'Berck Rang-du-Fliers', 'Berck'),
  nm1('besancon', '10492', 'Besançon Avenir Comtois', 'Besançon'),
  nm1('bordeaux', '8309', 'JSA Bordeaux Métropole', 'Bordeaux'),
  nm1('boulogne_sur_mer', '10475', 'SOM Boulogne', 'Boulogne-sur-Mer'),
  nm1('centre_federal', '11521', 'Centre Fédéral', 'Centre Fédéral'),
  nm1('challans', '9092', 'Vendée Challans Basket', 'Challans'),
  nm1('charleville_mezieres', '10046', 'Étoile de Charleville-Mézières', 'Charleville'),
  nm1('chartres', '9847', "C'Chartres Métropole Basket", 'Chartres'),
  nm1('fougeres', '9634', 'Pays de Fougères Basket', 'Fougères'),
  nm1('laval', '8970', 'US Laval Basket', 'Laval'),
  nm1('les_sables', '9096', 'Les Sables Vendée Basket', 'Les Sables'),
  nm1('loon_plage', '10266', 'AS Loon-Plage', 'Loon-Plage'),
  nm1('lorient', '9747', 'CEP Lorient', 'Lorient'),
  nm1('lyon_so', '11160', 'Lyon SO', 'Lyon SO'),
  nm1('mulhouse', '8223', 'Mulhouse Basket Agglomération', 'Mulhouse'),
  nm1('orchies', '10362', 'BC Orchies', 'Orchies'),
  nm1('rennes', '200000000056416', 'Union Rennes Basket 35', 'Rennes'),
  nm1('saint_etienne', '200000002678778', 'SCABB Saint-Étienne', 'Saint-Étienne'),
  nm1('saint_vallier', '7870', 'Saint-Vallier Basket Drôme', 'Saint-Vallier'),
  nm1('salon_de_provence', '12184', 'Pays Salonais Basket 13', 'Salon'),
  nm1('tarbes_lourdes', '200000002673031', 'Union Tarbes-Lourdes Pyrénées', 'Tarbes-Lourdes'),
  nm1('toulouse', '408001009352', 'Toulouse Basketball Club', 'Toulouse'),
  nm1('tours', '9889', 'Tours Métropole Basket', 'Tours'),
  nm1('val_de_seine', '11757', 'Val de Seine Basket', 'Val de Seine'),
  nm1('vitre', '9687', 'Aurore Vitré Basket Bretagne', 'Vitré'),

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
