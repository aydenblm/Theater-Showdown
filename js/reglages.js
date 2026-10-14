/***********************************************************************/
/** DONNÉES DU JEU : personnages, arènes et objets
/** On regroupe ici tous les "chiffres" du jeu pour pouvoir les équilibrer
/** facilement sans toucher à la logique des scènes.
/***********************************************************************/

// Planches de sprites : 14 frames (repos, marche, saut, garde, attaques, touché, K.O., victoire)
//   largeur / hauteur : taille d'une frame      echelle : agrandissement en jeu
//   pixelArt : affichage sans lissage            animations : frames remplaçant celles par défaut
const SPRITE_PIXEL_ART = {
  largeur: 128,
  hauteur: 128,
  echelle: 1.45,
  pixelArt: true,
  // les frames 14 à 16 contiennent la vraie séquence d'attaque
  animations: { lourde: [14, 15, 16], tir: [14, 15, 16] }
};

// vitesse : vitesse de déplacement (px/s)      saut : vitesse initiale du saut (px/s)
// force : multiplicateur de dégâts              vitesseNote : vitesse du projectile (px/s)
// projectile : planche animée du projectile (sinon une note de musique à la couleur du perso)
export const PERSONNAGES = [
  {
    id: "doremi",
    nom: "Doremi",
    role: "Prodige du solfège",
    couleur: 0xf2b632,
    vitesse: 250, saut: 800, force: 1.1, vitesseNote: 540,
    special: "Ah ! vous dirai-je, maman",
    compositeur: "Mozart",
    sprite: SPRITE_PIXEL_ART,
    projectile: "cle_de_fa"
  },
  {
    id: "symphanie",
    nom: "Symphanie",
    role: "Étoile de l'orchestre",
    couleur: 0xe05ab4,
    vitesse: 300, saut: 850, force: 0.9, vitesseNote: 640,
    special: "Danse de la Fée Dragée",
    compositeur: "Tchaïkovski",
    sprite: SPRITE_PIXEL_ART,
    projectile: "cle_de_sol"
  }
];

// sol : hauteur (y) où les pieds des combattants touchent le sol du décor
export const ARENES = [
  {
    id: "opera",
    nom: "L'Opéra",
    description: "Balcons dorés et lustre en mouvement",
    musique: "musique_opera",
    sol: 640
  },
  {
    id: "piano",
    nom: "Le Piano géant",
    description: "Chaque touche foulée joue sa note",
    musique: "musique_piano",
    sol: 620
  },
  {
    id: "coulisses",
    nom: "Les Coulisses",
    description: "Caisses, flight cases et projecteurs",
    musique: "musique_coulisses",
    sol: 600
  }
];

// objets qui tombent du ciel pendant le combat (poids = probabilité relative d'apparition)
export const OBJETS = [
  { cle: "objet_rose", type: "soin", valeur: 15, poids: 25, texte: "+15 PV" },
  { cle: "objet_partition", type: "energie", valeur: 40, poids: 30, texte: "+2 notes" },
  { cle: "objet_metronome", type: "vitesse", valeur: 1.4, duree: 6000, poids: 25, texte: "Tempo accéléré !" },
  { cle: "objet_baguette", type: "force", valeur: 1.5, duree: 6000, poids: 20, texte: "Force x1,5 !" }
];

// taille des personnages du mode solo par rapport au mode duel (1/4 : à l'échelle des tuiles de 32 px)
export const ECHELLE_SOLO = 1 / 4;

// ennemis du mode solo : planches de 8 frames (musiciens : outils/integrer_ennemis.py,
// croche et tambour : outils/generer_images_solo.py)
//   id           : nom de la planche. Dans Tiled, l'objet "Ennemy_tambour" donne l'ennemi "ennemi_tambour"
//   comportement : "marche" (va et vient), "saute" (bondit vers le joueur), "vole" (fonce vers le joueur)
//   echelle      : agrandissement (avant ECHELLE_SOLO) pour avoir la taille du joueur à l'écran
//                  (musicien de 131 px dans sa planche, Doremi de 122 px agrandie 1,45 fois : 1,45 x 122 / 131)
//   corps        : hitbox en pixels de la frame (x, y = coin haut gauche)
//   pv           : points de vie (attaque rapide : 5 dégâts, puissante : 11, note : 6)
//   tir          : lance des notes de musique à intervalle aléatoire
export const ENNEMIS_SOLO = [
  { id: "ennemi_cymbales", comportement: "marche", largeur: 128, hauteur: 132, echelle: 1.35, vitesse: 70, pv: 12, tir: false, corps: { x: 44, y: 22, largeur: 40, hauteur: 110 } },
  { id: "ennemi_trompette", comportement: "marche", largeur: 128, hauteur: 132, echelle: 1.35, vitesse: 90, pv: 10, tir: true, corps: { x: 44, y: 22, largeur: 40, hauteur: 110 } },
  { id: "ennemi_tambour", comportement: "saute", largeur: 128, hauteur: 132, echelle: 1.15, vitesse: 150, pv: 14, tir: false, corps: { x: 36, y: 56, largeur: 56, hauteur: 74 } },
  { id: "ennemi_croche", comportement: "vole", largeur: 128, hauteur: 132, echelle: 1.15, vitesse: 85, pv: 8, tir: false, corps: { x: 38, y: 34, largeur: 54, hauteur: 70 } }
];

// Combat contre le boss (mode solo) : tout ce qui s'équilibre est ici.
// L'arène est la carte Tiled "map_solo2" ; les limites sont en pixels de la carte.
export const ARENE_BOSS = {
  carte: "map_solo2",
  gauche: 1152, // pilier de gauche
  droite: 2688, // pilier de droite
  haut: 288, // haut du rideau
  sol: 1120, // dessus du plancher (le plancher fait 6 tuiles d'épaisseur, soit 192 px)
  departJoueur: 1300, // abscisse du joueur au début du combat
  musique: "musique_boss"
};

export const BOSS = {
  nom: "Le Chef d'orchestre",
  pv: 100,
  degatsRenvoi: 10, // PV perdus par le boss chaque fois qu'on lui renvoie une touche de piano
  echelle: 1.45, // agrandissement de la planche du boss
  sol: 350, // ligne du plancher dans la planche (px) : le bas de ses mains, posé sur le plancher
  enfoncement: 0, // px de planche cachés en plus derrière le plancher de la scène
  // pause entre deux attaques [mini, maxi] en ms (plus courte en phase 2, sous la moitié des PV)
  attente: { phase1: [2200, 3400], phase2: [1400, 2300] },
  // attaque 1 : la baguette lance des notes de musique
  notes: { vitesse: 250, echelle: 1.3, duree: 6000, coup: { degats: 8, recul: 220, reculY: 200, etourdissement: 300 } },
  // attaque 2 : la baguette envoie des touches de piano ; on les renvoie avec A au bon moment
  touches: {
    vitesse: 330,
    vitesseRenvoi: 760,
    rayonParade: 85, // distance (px) à laquelle la touche peut être renvoyée
    fenetreParade: 190, // ms pendant lesquelles un appui sur A est une "parade"
    delaiParade: 450, // ms avant de pouvoir parer à nouveau (on ne gagne pas en martelant A)
    coup: { degats: 15, recul: 320, reculY: 300, etourdissement: 450 }
  },
  // petits ennemis qui tombent au hasard dans l'arène
  ennemis: { delai: { phase1: [6000, 9000], phase2: [3500, 6000] }, maximum: 3, distanceMiniJoueur: 300 }
};

export function trouverPerso(id) {
  return PERSONNAGES.find((perso) => perso.id === id);
}

export function trouverArene(id) {
  return ARENES.find((arene) => arene.id === id);
}
