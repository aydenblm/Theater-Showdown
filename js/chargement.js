import * as fct from "./fonctions.js";
import { PERSONNAGES } from "./donnees.js";

/***********************************************************************/
/** SCÈNE DE CHARGEMENT
/** Charge tous les assets une seule fois et crée les animations,
/** puis lance le menu. Les autres scènes n'ont plus rien à charger.
/***********************************************************************/

// animations d'un personnage : numéros des frames dans la planche (spritesheet)
const ANIMATIONS = [
  { nom: "repos", debut: 0, fin: 1, vitesse: 3, boucle: true },
  { nom: "marche", debut: 2, fin: 5, vitesse: 10, boucle: true },
  { nom: "saut", debut: 6, fin: 6 },
  { nom: "garde", debut: 7, fin: 7 },
  { nom: "legere", debut: 8, fin: 8 },
  { nom: "lourde", debut: 9, fin: 9 },
  { nom: "tir", debut: 10, fin: 10 },
  { nom: "touche", debut: 11, fin: 11 },
  { nom: "ko", debut: 12, fin: 12 },
  { nom: "victoire", debut: 13, fin: 13 }
];

const IMAGES = [
  "fond_opera", "fond_piano", "fond_menu", "vignette_opera", "vignette_piano",
  "balcon", "lustre", "touche_blanche", "touche_noire", "pupitre",
  "note_projectile", "note_hud", "etincelle",
  "objet_rose", "objet_partition", "objet_metronome", "objet_baguette",
  "fleche_retour"
];

const SONS = [
  "coup_leger", "coup_lourd", "garde", "tir", "saut", "esquive", "bonus", "ko", "gong",
  "qte_ok", "qte_rate", "menu_deplacer", "menu_valider", "note_piano", "jauge_pleine", "applaudissements",
  "special_maestro", "special_diva", "special_violaine", "special_timbale", "special_fantome",
  "musique_menu", "musique_opera", "musique_piano"
];

export default class chargement extends Phaser.Scene {
  constructor() {
    super({ key: "chargement" });
  }

  preload() {
    this.load.setBaseURL(this.sys.game.config.baseURL);

    // barre de progression
    const cadre = this.add.rectangle(640, 380, 604, 34).setStrokeStyle(3, 0xf5c542);
    const barre = this.add.rectangle(342, 380, 0, 26, 0xf5c542).setOrigin(0, 0.5);
    this.add.text(640, 320, "Le rideau va se lever...", fct.style(32)).setOrigin(0.5);
    this.load.on("progress", (valeur) => (barre.width = 596 * valeur));
    this.load.on("complete", () => cadre.destroy());

    // chemins relatifs uniquement (consigne de la borne)
    for (const cle of IMAGES) {
      this.load.image(cle, "./assets/images/" + cle + ".png");
    }
    // image plein écran en JPEG pour rester sous 200 Ko
    this.load.image("page_commandes", "./assets/images/page_commandes.jpg");
    for (const perso of PERSONNAGES) {
      this.load.spritesheet(perso.id, "./assets/images/perso_" + perso.id + ".png", {
        frameWidth: 120,
        frameHeight: 180
      });
    }
    for (const cle of SONS) {
      this.load.audio(cle, "./assets/sons/" + cle + ".mp3");
    }
  }

  create() {
    // une animation par état et par personnage : "maestro_repos", "diva_marche", ...
    for (const perso of PERSONNAGES) {
      for (const anim of ANIMATIONS) {
        this.anims.create({
          key: perso.id + "_" + anim.nom,
          frames: this.anims.generateFrameNumbers(perso.id, { start: anim.debut, end: anim.fin }),
          frameRate: anim.vitesse || 1,
          repeat: anim.boucle ? -1 : 0
        });
      }
    }
    this.scene.start("menu");
  }
}
