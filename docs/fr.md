# Sport Games

Cette intégration affiche dans Gladys le calendrier et les résultats des
équipes de basket que vous suivez, en **NBA**, en **EuroLeague** et en
**Betclic Élite**. Elle prévient vos scènes avant le coup d'envoi.

Pas de compte et pas de clé d'API. Tous les horaires sont donnés à l'heure de
Paris.

## Ce que vous obtenez

Un appareil par équipe suivie (par exemple « Matchs LDLC ASVEL »), avec trois
capteurs texte :

- **Prochain match** : `ASVEL – Paris (EuroLeague)`
- **Coup d'envoi** : `mer. 7 oct. 20:45`
- **Dernier résultat** : `Cholet 85 – 97 ASVEL`

Un club engagé dans deux compétitions, comme l'ASVEL ou Paris, n'a qu'un seul
appareil, qui regroupe tous ses matchs.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Cochez les **compétitions** à afficher.
3. Cochez les **équipes** à suivre. La liste contient les 64 clubs de NBA,
   d'EuroLeague et de Betclic Élite.
4. Réglez la **plage de visionnage**, de 18:00 à 23:30 par défaut. Le widget et
   le déclencheur de scène ne retiennent que les matchs qui commencent dans
   cette plage. Si la fin est avant le début, la plage passe minuit (par
   exemple de 20:00 à 02:00).
5. Cochez **Inclure les matchs hors plage** pour voir aussi les matchs NBA de
   la nuit ou ceux du week-end après-midi.
6. Enregistrez. Les appareils apparaissent dans l'onglet **Découverte**, prêts
   à être ajoutés.

La plage de visionnage ne change rien aux capteurs : ils montrent toujours le
vrai prochain match.

Le bouton **Tester les sources** télécharge tout de suite les calendriers et
indique le nombre de matchs trouvés par compétition.

## Widget du tableau de bord

Ajoutez le widget **Prochains matchs** à un tableau de bord (Gladys 5.1 ou
plus récent). Il affiche jusqu'à 8 matchs, avec la date ou la mention « En
direct ». Touchez une ligne pour afficher le détail : noms complets, date et
diffuseur. Le réglage **Équipes** permet de choisir d'autres équipes que celles
de la configuration.

## Scènes

**Déclencheur « Un match va commencer »**

- **Quand** : au coup d'envoi, ou 15 min, 30 min ou 1 h avant.
- **Équipes** et **Compétitions** : laissez vides pour garder tous les matchs.
- Variables disponibles : équipe à domicile, équipe à l'extérieur, heure de
  début, diffuseur et compétition (clé : `nba`, `euroleague` ou
  `betclic_elite`).

Exemple : « 15 min avant un match de l'ASVEL, allumer la télé et envoyer
_{{home_team}} – {{away_team}} à {{start}} sur {{broadcaster}}_ ».

Un match entre deux équipes suivies (ASVEL – Paris) déclenche un événement
pour chacune des deux équipes. Une scène sans filtre d'équipe s'exécute donc
deux fois pour ce match ; filtrez sur une seule équipe pour l'éviter.

**Action « Lire le prochain match d'une équipe »**

Choisissez une équipe, suivie ou non. L'action renvoie le prochain match,
son début, l'adversaire, si l'équipe joue à domicile, la compétition, le
diffuseur et le dernier résultat. Vous pouvez les utiliser dans les actions
suivantes de la scène.

## Sources et mises à jour

- NBA : données publiques d'ESPN.
- EuroLeague : API publique de l'EuroLeague.
- Betclic Élite : données du site officiel de la LNB, avec les diffuseurs
  (DAZN, La Chaîne L'Équipe).

Chaque calendrier est téléchargé au plus toutes les 6 heures, et toutes les
15 minutes quand un match est en cours ou attend son score. Si une source ne
répond pas, l'ancien calendrier est conservé et un nouvel essai a lieu 15
minutes plus tard. Une source en panne ne bloque jamais les autres.

Les horaires de Betclic Élite sont souvent fixés tard : un match apparaît dès
que la LNB le publie.
