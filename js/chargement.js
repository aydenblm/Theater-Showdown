import * as fct from "./fonctions.js";
import { PERSONNAGES, ENNEMIS_SOLO } from "./reglages.js";
import { creerAnimationsBoss, ANIMATIONS_BOSS, LARGEUR_FRAME_BOSS, HAUTEUR_FRAME_BOSS } from "./chef_orchestre.js";

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

// images (nom de fichier dans assets/images, la clé est le nom sans extension)
const IMAGES = [
  // menus
  "fond_menu.jpg", "fond_scene.jpg", "logo.png", "page_commandes.jpg", "fleche_retour.png",
  "bouton_solo.png", "bouton_solo_sombre.png", "bouton_multi.png", "bouton_multi_sombre.png",
  "bouton_commandes.png", "bouton_commandes_sombre.png", "carte_joueur1.png", "carte_joueur2.png",
  // arènes
  "fond_opera.jpg", "fond_piano.jpg", "fond_coulisses.jpg",
  "vignette_opera.jpg", "vignette_piano.jpg", "vignette_coulisses.jpg",
  "balcon.png", "plateforme_bois.png", "lustre.png", "touche_noire.png",
  "caisse_bois.png", "flight_case.png", "pont_lumiere.png", "poutre_suspendue.png",
  // HUD et textes
  "barre_vie_vide.png", "barre_vie_pleine.png", "barre_vie_vide_j2.png", "barre_vie_pleine_j2.png", "note_ult.png", "note_ult_vide.png",
  "titre_artiste.png", "titre_scene.png", "titre_entracte.png", "gagnant_joueur_1.png", "gagnant_joueur_2.png",
  "texte_joueur_1.png", "texte_joueur_2.png", "texte_round_1.png", "texte_round_2.png", "texte_round_3.png", "texte_ko.png",
  // effets et objets
  "note_projectile.png", "note_hud.png", "etincelle.png",
  "objet_rose.png", "objet_partition.png", "objet_metronome.png", "objet_baguette.png",
  // mode solo
  "tileset_theatre.png", "touche_piano.png"
];

// textures en pixel art : filtre "plus proche voisin" pour garder des pixels nets
const PIXEL_ART = [
  "objet_rose", "objet_partition", "objet_metronome", "objet_baguette",
  "note_ult", "note_ult_vide", "texte_ko", "cle_de_fa", "cle_de_sol", "tileset_theatre"
];

// cartes Tiled du mode solo (format JSON, tileset intégré) : le niveau 1 et l'arène du boss
const CARTES = ["map_solo1", "map_solo2"];

// projectiles animés : 8 frames de 64x64 (0-2 en vol, 3-7 dissipation)
const PROJECTILES = ["cle_de_fa", "cle_de_sol"];

// Les musiques (musique_*.mp3) ne sont pas dans cette liste : elles sont trop longues pour être
// chargées en mémoire, on les lit en flux (voir jouerMusique dans fonctions.js).
const SONS = [
  "coup_leger", "coup_lourd", "garde", "tir", "saut", "esquive", "bonus", "ko", "gong",
  "qte_ok", "qte_rate", "menu_deplacer", "menu_valider", "note_piano", "jauge_pleine", "applaudissements"
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
    for (const fichier of IMAGES) {
      this.load.image(fichier.split(".")[0], "./assets/images/" + fichier);
    }
    for (const perso of PERSONNAGES) {
      this.load.spritesheet(perso.id, "./assets/images/perso_" + perso.id + ".png", {
        frameWidth: perso.sprite.largeur,
        frameHeight: perso.sprite.hauteur
      });
      this.load.audio("special_" + perso.id, "./assets/sons/special_" + perso.id + ".mp3");
    }
    for (const cle of PROJECTILES) {
      this.load.spritesheet(cle, "./assets/images/" + cle + ".png", { frameWidth: 64, frameHeight: 64 });
    }
    for (const ennemi of ENNEMIS_SOLO) {
      this.load.spritesheet(ennemi.id, "./assets/images/" + ennemi.id + ".png", {
        frameWidth: ennemi.largeur,
        frameHeight: ennemi.hauteur
      });
    }
    // planches du boss : 5 frames chacune (outils/integrer_boss.py)
    for (const animation of ANIMATIONS_BOSS) {
      this.load.spritesheet(animation.nom, "./assets/images/" + animation.nom + ".png", {
        frameWidth: LARGEUR_FRAME_BOSS,
        frameHeight: HAUTEUR_FRAME_BOSS
      });
    }
    for (const cle of CARTES) {
      this.load.tilemapTiledJSON(cle, "./assets/maps/" + cle + ".tmj");
    }
    for (const cle of SONS) {
      this.load.audio(cle, "./assets/sons/" + cle + ".mp3");
    }
    // animations du rideau (sans son)
    this.load.video("rideau_ouverture", "./assets/videos/rideau_ouverture.mp4", true);
    this.load.video("rideau_fermeture", "./assets/videos/rideau_fermeture.mp4", true);
  }

  create() {
    const texturesPixel = PIXEL_ART.concat(PERSONNAGES.filter((p) => p.sprite.pixelArt).map((p) => p.id));
    for (const cle of texturesPixel) {
      this.textures.get(cle).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // une animation par état et par personnage : "doremi_repos", "symphanie_marche", ...
    for (const perso of PERSONNAGES) {
      const remplacements = perso.sprite.animations || {};
      for (const anim of ANIMATIONS) {
        const frames = remplacements[anim.nom]
          ? remplacements[anim.nom].map((numero) => ({ key: perso.id, frame: numero }))
          : this.anims.generateFrameNumbers(perso.id, { start: anim.debut, end: anim.fin });
        this.anims.create({
          key: perso.id + "_" + anim.nom,
          frames: frames,
          frameRate: remplacements[anim.nom] ? 12 : anim.vitesse || 1,
          repeat: anim.boucle ? -1 : 0
        });
      }
    }

    // projectiles : en vol (boucle) puis dissipation à l'impact
    for (const cle of PROJECTILES) {
      this.anims.create({ key: cle + "_vol", frames: this.anims.generateFrameNumbers(cle, { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: cle + "_impact", frames: this.anims.generateFrameNumbers(cle, { start: 3, end: 7 }), frameRate: 20 });
    }

    // ennemis du mode solo : marche en boucle sur les 8 frames
    for (const ennemi of ENNEMIS_SOLO) {
      this.anims.create({ key: ennemi.id + "_marche", frames: this.anims.generateFrameNumbers(ennemi.id), frameRate: 10, repeat: -1 });
    }
    creerAnimationsBoss(this);
    this.scene.start("menu");
  }
}
