/***********************************************************************/
/** DONNÉES DU JEU : personnages, arènes et objets
/** On regroupe ici tous les "chiffres" du jeu pour pouvoir les équilibrer
/** facilement sans toucher à la logique des scènes.
/***********************************************************************/

// vitesse : vitesse de déplacement (px/s)      saut : vitesse initiale du saut (px/s)
// force : multiplicateur de dégâts              vitesseNote : vitesse du projectile (px/s)
// stats : notes de 1 à 5 affichées sur l'écran de sélection
export const PERSONNAGES = [
  {
    id: "maestro",
    nom: "Maestro Bâton",
    role: "Chef d'orchestre",
    couleur: 0xf5c542,
    vitesse: 260, saut: 800, force: 1.0, vitesseNote: 560,
    stats: { vitesse: 3, puissance: 3, saut: 3 },
    special: "Symphonie du Destin",
    compositeur: "Beethoven"
  },
  {
    id: "diva",
    nom: "La Diva",
    role: "Cantatrice wagnérienne",
    couleur: 0xe0304e,
    vitesse: 215, saut: 760, force: 1.25, vitesseNote: 480,
    stats: { vitesse: 2, puissance: 5, saut: 2 },
    special: "Chevauchée des Walkyries",
    compositeur: "Wagner"
  },
  {
    id: "violaine",
    nom: "Violaine",
    role: "Violoniste virtuose",
    couleur: 0xa05cf0,
    vitesse: 310, saut: 830, force: 0.85, vitesseNote: 640,
    stats: { vitesse: 5, puissance: 2, saut: 4 },
    special: "Le Printemps",
    compositeur: "Vivaldi"
  },
  {
    id: "timbale",
    nom: "Major Timbale",
    role: "Percussionniste",
    couleur: 0x3cc47a,
    vitesse: 230, saut: 750, force: 1.15, vitesseNote: 440,
    stats: { vitesse: 2, puissance: 4, saut: 1 },
    special: "Galop de Guillaume Tell",
    compositeur: "Rossini"
  },
  {
    id: "fantome",
    nom: "Le Fantôme",
    role: "Organiste masqué",
    couleur: 0xd8e6ff,
    vitesse: 285, saut: 870, force: 0.95, vitesseNote: 600,
    stats: { vitesse: 4, puissance: 3, saut: 5 },
    special: "Toccata en ré mineur",
    compositeur: "Bach"
  }
];

export const ARENES = [
  {
    id: "opera",
    nom: "L'Opéra",
    description: "Balcons dorés et lustre en mouvement",
    vignette: "vignette_opera",
    musique: "musique_opera"
  },
  {
    id: "piano",
    nom: "Le Piano géant",
    description: "Chaque touche foulée joue sa note",
    vignette: "vignette_piano",
    musique: "musique_piano"
  }
];

// objets qui tombent du ciel pendant le combat (poids = probabilité relative d'apparition)
export const OBJETS = [
  { cle: "objet_rose", type: "soin", valeur: 15, poids: 25, texte: "+15 PV" },
  { cle: "objet_partition", type: "energie", valeur: 40, poids: 30, texte: "+2 notes" },
  { cle: "objet_metronome", type: "vitesse", valeur: 1.4, duree: 6000, poids: 25, texte: "Tempo accéléré !" },
  { cle: "objet_baguette", type: "force", valeur: 1.5, duree: 6000, poids: 20, texte: "Force x1,5 !" }
];

export function trouverPerso(id) {
  return PERSONNAGES.find((perso) => perso.id === id);
}

export function trouverArene(id) {
  return ARENES.find((arene) => arene.id === id);
}
