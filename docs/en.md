# Sport Games

This integration shows the schedule and the results of the basketball teams
you follow, in the **NBA**, the **EuroLeague** and the French **Betclic
Élite**. It also notifies your scenes before kick-off.

No account and no API key are needed. All times are in the Paris time zone.

## What you get

One device per followed team (for example "Matchs LDLC ASVEL"), with three
text sensors:

- **Next game**: `ASVEL – Paris (EuroLeague)`
- **Kick-off**: `mer. 7 oct. 20:45`
- **Last result**: `Cholet 85 – 97 ASVEL`

A club playing two competitions, such as ASVEL or Paris, has a single device
that covers all its games.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Tick the **competitions** to show.
3. Tick the **teams** to follow. The list holds the 64 clubs of the NBA, the
   EuroLeague and the Betclic Élite.
4. Set the **watching window**, 18:00 to 23:30 by default. The widget and the
   scene trigger only keep the games starting in this window. When the end is
   before the start, the window crosses midnight (for example 20:00 to 02:00).
5. Tick **Include games outside the window** to also get the NBA night games
   or the weekend afternoon games.
6. Save. The devices appear in the **Discover** tab, ready to be added.

The watching window does not affect the sensors: they always show the real
next game.

The **Test the sources** button downloads the schedules right away and shows
how many games each competition returned.

## Dashboard widget

Add the **Upcoming games** widget to a dashboard (Gladys 5.1 or later). It
shows up to 8 games, with their date or a "Live" badge. Tap a row to see the
details: full team names, date and broadcaster. The **Teams** setting lets
you pick teams other than the ones of the configuration.

## Scenes

**Trigger "A game is about to start"**

- **When**: at kick-off, or 15 min, 30 min or 1 hour before.
- **Teams** and **Competitions**: leave them empty to keep every game.
- Variables: home team, away team, start time, broadcaster and competition
  (key: `nba`, `euroleague` or `betclic_elite`).

Example: "15 min before an ASVEL game, turn the TV on and send
_{{home_team}} – {{away_team}} at {{start}} on {{broadcaster}}_".

A game between two followed teams (ASVEL – Paris) fires one event per team.
A scene without a team filter therefore runs twice for that game; filter on a
single team to avoid it.

**Action "Get the next game of a team"**

Pick a team, followed or not. The action returns the next game, its start,
the opponent, whether the team plays at home, the competition, the
broadcaster and the last result, for the following actions of the scene.

## Sources and updates

- NBA: public data from ESPN.
- EuroLeague: public API of the EuroLeague.
- Betclic Élite: data of the official LNB website, with the broadcasters
  (DAZN, La Chaîne L'Équipe).

Each schedule is downloaded at most every 6 hours, and every 15 minutes while
a game is being played or waits for its score. When a source does not answer,
the previous schedule is kept and the source is tried again 15 minutes later.
A failing source never blocks the others.

Betclic Élite times are often set late: a game shows up as soon as the LNB
publishes it.
