# Theater Showdown - SAE 301

Jeu de combat musical (Phaser 3.90), jouable sur la borne d'arcade.
Thème : **Musique & opéra**. Deux modes : un duel classé à deux, et un mode solo (niveau de plateformes + boss).

## Lancer le jeu

Les modules JavaScript imposent de passer par un serveur local, par exemple :

```bash
python -m http.server 8080
```

puis ouvrir http://localhost:8080.

## Commandes (borne)

| Bouton | Action |
| --- | --- |
| Joystick | se déplacer, ↑ sauter, ↓ descendre d'une plateforme |
| A (maintenu) | se protéger |
| A (appui bref) | **parade** : renvoie une touche de piano du boss (mode solo) |
| B | attaque puissante (lente, gros dégâts, projette l'adversaire) |
| C | esquive |
| D | attaque spéciale (jauge de 5 notes pleine) |
| E | attaque rapide (petits dégâts, enchaînable en combo) |
| F | lancer une note de musique |
| Start (ou Échap) | pause (duel), classement (écran de connexion), menu (mode solo) |

Clavier : J1 = flèches + `I O P K L M` + Start `X`, J2 = `Z Q S D` + `R T Y F G H` + Start `N`.

## Mode duel classé (ELO)

1. **Connexion** : avant de choisir les personnages, chaque joueur se connecte avec *son* joystick :
   il choisit son compte dans la liste et tape son code secret (4 chiffres), ou crée un compte
   (pseudo de 2 à 8 caractères, puis code), ou joue en **invité** (le duel n'est alors pas classé).
2. **Combat** : 2 manches gagnantes, 60 s par manche (au chrono : le plus de PV gagne).
3. **Fin du duel** : si les deux joueurs sont connectés, leur ELO est mis à jour (K = 32, 1000 points au départ)
   et affiché sur l'écran de victoire. Le **classement** (8 meilleurs) est dans l'écran de victoire
   et dans l'écran de connexion (Start).

Rangs : Figurant (< 1000), Musicien (1000), Soliste (1150), Chef d'orchestre (1300).

### La base de données

Elle suit la notice de la borne (`notice_sauvegarde_donnees.pdf`) : **une seule valeur JSON**, lue et écrite avec
`lireDonneesJSON()` / `ecrireDonneesJSON()` (`js/donnees.js`). Sur la borne, c'est la base de la borne ;
sur un ordinateur, c'est le `localStorage` (clé `arcade_donnees_<nom du dossier>`, visible avec F12 > Application).

```json
{ "comptes": [
    { "pseudo": "LEA", "code": "k3f9a2", "elo": 1012, "victoires": 3, "defaites": 1, "nuls": 0 }
] }
```

Attention : ne pas renommer le dossier du jeu après avoir enregistré des données (sinon elles ne sont plus retrouvées).
Le code secret est brouillé avant d'être enregistré, mais ce n'est pas une vraie protection.

## Mode solo

- **Niveau 1** (`map_solo1`) : niveau de plateformes. Sauter sur un ennemi l'élimine. Quatre types d'ennemis :
  cymbalier et trompettiste (qui lance des notes), **tambour** (bondit vers le joueur) et **croche folle**
  (vole vers le joueur). Le rideau rouge, à droite, mène au boss.
- **Boss : le Chef d'orchestre** (`map_solo2`) :
  - **attaque 1** : sa baguette lance un éventail de notes de musique (3 notes, 5 en phase 2) ;
  - **attaque 2** : sa baguette envoie une touche de piano vers le joueur. En appuyant sur **A** quand la touche est
    proche (parade), elle repart vers le boss et lui fait des dégâts. C'est le **seul** moyen de le blesser (10 PV sur 100).
    Une touche non parée fait mal ; les touches renvoyées éliminent aussi les ennemis sur leur passage ;
  - sous la moitié de ses PV (phase 2) : il attaque plus vite, et envoie deux touches d'affilée ;
  - de petits ennemis tombent au hasard dans l'arène (3 au maximum en même temps).

Tous les chiffres du boss (PV, vitesses, fenêtre de parade, délais...) sont dans `js/reglages.js` (`BOSS`, `ARENE_BOSS`).

## Organisation des fichiers

```
index.html / index.js     point d'entrée, configuration Phaser
game.json                 fiche du jeu pour la borne
presentation.png          jaquette 800x450
js/
  donnees.js              sauvegarde (lireDonneesJSON / ecrireDonneesJSON), fourni par la borne
  reglages.js             personnages, arènes, objets, ennemis, boss : tous les "chiffres" du jeu
  comptes.js              comptes, code secret, calcul de l'ELO, classement (la "base de données")
  chargement.js           chargement des assets + animations
  menu.js                 menu principal
  commandes.js            écran des commandes et des règles
  connexion.js            connexion des deux joueurs avant le duel
  classement.js           classement ELO (affiché par-dessus un autre écran)
  selection.js            choix des personnages
  selection_arene.js      choix de l'arène
  combat.js               combat, manches, objets, QTE de l'attaque spéciale, HUD
  combattant.js           classe Combattant (déplacements, coups, dégâts, jauge)
  victoire.js             écran de fin, mise à jour de l'ELO
  pause.js                menu pause (lancé par-dessus le combat)
  solo_commun.js          base des scènes du mode solo (carte, joueur, ennemis, notes, dégâts)
  solo.js                 niveau 1 (hérite de solo_commun.js)
  boss.js                 combat contre le boss : notes, touches de piano, parade (hérite de solo_commun.js)
  chef_orchestre.js       le boss lui-même : états et animations
  joueur_solo.js          le joueur en mode solo (hérite de Combattant)
  ennemi.js               les ennemis du mode solo (marche, saute, vole)
  hud_solo.js             vie, jauge, barre du boss, écran de victoire
  controles.js            touches de la borne
  fonctions.js            fonctions utilitaires partagées (dont la lecture de la musique)
assets/images, assets/sons, assets/maps (Tiled), assets/videos
outils/                   scripts de préparation des assets (non nécessaires pour jouer)
```

## Assets

- **Visuels de l'équipe** (menus, décors, plateformes, HUD, textes, Doremi, Symphanie, clés de fa/sol,
  vidéos de rideau, musiciens, boss) : convertis par `outils/integrer_visuels.py`, `integrer_ennemis.py`
  et `integrer_boss.py` (noms en minuscules, recadrage, réduction pour le Raspberry Pi).
- **Musiques** (`assets/sons/musique_*.mp3`) : menu, Opéra, Piano géant, Coulisses, mode solo, boss. Ré-encodées en
  96 kbit/s (de 54 Mo à 17 Mo). Elles sont lues **en flux** (balise audio) et non chargées par Phaser : une piste de
  8 minutes décompressée en mémoire pèse plus de 100 Mo, trop pour la borne.
- **Générés par programme** : les objets bonus et les notes (`outils/generer_images.py`), les bruitages
  (`outils/generer_sons.js`), la croche, le tambour et la touche de piano (`outils/generer_images_solo.py`,
  dessins provisoires que l'équipe peut remplacer par de vrais sprites de même format).

```bash
python outils/integrer_visuels.py "../visuel/SAE 301"
python outils/integrer_ennemis.py
python outils/integrer_boss.py "chemin/vers/Boss"
python outils/generer_images.py
python outils/generer_images_solo.py
cd outils && npm install && node generer_sons.js
```

### Ajouter un ennemi

Dans `js/reglages.js`, ajouter une entrée à `ENNEMIS_SOLO` (planche de 8 frames de 128 x 132 px, comportement
`"marche"`, `"saute"` ou `"vole"`), ranger la planche dans `assets/images/`, puis placer dans Tiled un objet nommé
`Ennemy_<nom>` dans le calque `ennemy` (l'objet `Ennemy_tambour` donne l'ennemi `ennemi_tambour`).

### Ajouter un personnage pixel art

Dans `js/reglages.js`, ajouter une entrée avec `sprite: SPRITE_PIXEL_ART` (frames de 128x128) et,
si besoin, `projectile: "nom_de_la_planche"`. La planche doit suivre l'ordre des 14 frames
(repos x2, marche x4, saut, garde, légère, lourde, tir, touché, K.O., victoire) ;
`integrer_visuels.py` montre comment la fabriquer.

## Reste à faire

- Animations complètes de Doremi et Symphanie (marche, saut, touché, K.O.) : pour l'instant
  ces frames sont fabriquées à partir des 4 dessins d'attaque
- `game.json` à compléter par l'équipe (description, auteurs), `demo.mp4` (10 s de jeu) à enregistrer
- Quitter un duel classé par le menu pause ne fait pas perdre d'ELO
