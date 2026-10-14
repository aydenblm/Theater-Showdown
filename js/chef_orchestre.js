import * as fct from "./fonctions.js";
import { BOSS } from "./reglages.js";

/***********************************************************************/
/** LE BOSS : LE CHEF D'ORCHESTRE
/** Un sprite posé derrière le plancher de la scène : il surgit de la fosse d'orchestre.
/** Il ne se déplace pas, il alterne simplement entre ces états (this.etat) :
/**
/**   "cache"       avant son apparition
/**   "apparition"  il sort de la fosse (animation), on ne peut pas encore le toucher
/**   "attente"     il souffle un peu, puis choisit une attaque au hasard
/**   "attaque"     attaque 1 : la baguette lance des notes de musique
/**                 attaque 2 : la baguette envoie des touches de piano (à renvoyer avec A)
/**   "mort"        il s'effondre (animation), le combat est gagné
/**
/** Le boss décide QUAND attaquer ; c'est la scène (boss.js) qui crée les projectiles
/** (lancerNotes, lancerTouche) et qui lui inflige des dégâts (recevoirDegats).
/** Sa phase passe à 2 sous la moitié de ses PV : il attaque plus vite et plus fort.
/***********************************************************************/

// numéro de la frame (dans la planche de l'attaque) où la baguette lâche son projectile
const FRAME_LANCER = { boss_attaque1: 3, boss_attaque2: 2 };

// bout de la baguette dans la planche (décalage en px par rapport au milieu de la frame
// et à la ligne du plancher) pour chaque attaque
const BAGUETTE = { notes: { x: 179, y: -217 }, touche: { x: -5, y: -30 } };

// les planches du boss et leur animation (vitesse en images par seconde)
export const ANIMATIONS_BOSS = [
  { nom: "boss_idle", frames: 5, vitesse: 6, boucle: true },
  { nom: "boss_apparition", frames: 5, vitesse: 6, boucle: false },
  { nom: "boss_attaque1", frames: 5, vitesse: 9, boucle: false },
  { nom: "boss_attaque2", frames: 5, vitesse: 8, boucle: false },
  { nom: "boss_mort", frames: 5, vitesse: 5, boucle: false }
];

// taille d'une frame des planches du boss (calculée par outils/integrer_boss.py)
export const LARGEUR_FRAME_BOSS = 374;
export const HAUTEUR_FRAME_BOSS = 399;

// crée les animations du boss (appelée une seule fois par la scène de chargement)
export function creerAnimationsBoss(scene) {
  for (const anim of ANIMATIONS_BOSS) {
    scene.anims.create({
      key: anim.nom,
      frames: scene.anims.generateFrameNumbers(anim.nom, { start: 0, end: anim.frames - 1 }),
      frameRate: anim.vitesse,
      repeat: anim.boucle ? -1 : 0
    });
  }
}

export default class ChefOrchestre extends Phaser.GameObjects.Sprite {
  // x : milieu de la scène     solY : hauteur du plancher
  constructor(scene, x, solY) {
    super(scene, x, solY + BOSS.enfoncement * BOSS.echelle, "boss_apparition", 0);
    scene.add.existing(this);
    // l'origine du sprite est la ligne du plancher dessinée dans la planche
    this.setOrigin(0.5, BOSS.sol / HAUTEUR_FRAME_BOSS).setScale(BOSS.echelle);
    this.setDepth(1.5).setVisible(false); // entre les rideaux (calque 1) et le plancher (calque 2)

    this.pv = BOSS.pv;
    this.etat = "cache";
    this.attaque = null; // "notes" ou "touche" pendant une attaque
    this.touchesRestantes = 0;
    this.timerAttaque = null;

    // à chaque nouvelle frame d'animation : est-ce le moment de lâcher le projectile ?
    this.on("animationupdate", (anim, frame) => this.surNouvelleFrame(anim.key, frame.textureFrame));
  }

  get phase() {
    return this.pv > BOSS.pv / 2 ? 1 : 2;
  }

  // rectangle (en pixels de la carte) dans lequel une touche renvoyée blesse le boss
  get zoneDegats() {
    return new Phaser.Geom.Rectangle(this.x - 150, this.y - 400, 300, 420);
  }

  // position (en pixels de la carte) du bout de la baguette pour l'attaque en cours
  pointeBaguette() {
    const decalage = BAGUETTE[this.attaque];
    const sens = this.flipX ? -1 : 1;
    return { x: this.x + decalage.x * sens * BOSS.echelle, y: this.y + decalage.y * BOSS.echelle };
  }

  /*********************************************************************/
  /** LES ÉTATS
  /*********************************************************************/
  apparaitre() {
    this.etat = "apparition";
    this.setVisible(true);
    this.play("boss_apparition");
    fct.jouerSon(this.scene, "gong", 0.7);
    this.scene.cameras.main.shake(900, 0.004);
    this.once("animationcomplete", () => this.attendre());
  }

  attendre() {
    if (this.etat === "mort") return;
    this.etat = "attente";
    this.attaque = null;
    this.play("boss_idle");
    const [mini, maxi] = BOSS.attente["phase" + this.phase];
    this.timerAttaque = this.scene.time.delayedCall(Phaser.Math.Between(mini, maxi), () => this.attaquer());
  }

  // choisit une attaque au hasard
  attaquer() {
    if (this.etat !== "attente") return;
    this.etat = "attaque";
    this.regarderLeJoueur();
    if (Phaser.Math.Between(0, 1) === 0) {
      this.attaque = "notes";
      this.jouerAttaque("boss_attaque1");
    } else {
      this.attaque = "touche";
      this.touchesRestantes = this.phase === 1 ? 1 : 2; // en phase 2 : deux touches d'affilée
      this.envoyerTouche();
    }
  }

  // une touche de piano : animation, puis (à la bonne frame) la scène crée la touche
  envoyerTouche() {
    this.touchesRestantes--;
    this.regarderLeJoueur();
    this.jouerAttaque("boss_attaque2");
  }

  jouerAttaque(cleAnimation) {
    this.lache = false;
    this.play(cleAnimation);
    this.once("animationcomplete", () => {
      if (this.etat !== "attaque") return; // le boss est mort pendant l'attaque
      if (this.attaque === "touche" && this.touchesRestantes > 0) this.envoyerTouche();
      else this.attendre();
    });
  }

  surNouvelleFrame(cleAnimation, numeroFrame) {
    if (this.etat !== "attaque" || this.lache) return;
    if (FRAME_LANCER[cleAnimation] !== numeroFrame) return;
    this.lache = true;
    if (this.attaque === "notes") this.scene.lancerNotes(this);
    else this.scene.lancerTouche(this);
  }

  // le boss se tourne vers le joueur (l'image est retournée quand le joueur est à gauche)
  regarderLeJoueur() {
    this.setFlipX(this.scene.joueur.x < this.x);
  }

  /*********************************************************************/
  /** DÉGÂTS ET MORT
  /*********************************************************************/
  recevoirDegats(degats) {
    if (this.etat === "mort" || this.etat === "apparition" || this.etat === "cache") return;
    this.pv = Math.max(0, this.pv - degats);
    // flash blanc, comme les ennemis
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    this.scene.cameras.main.shake(200, 0.006);
    fct.jouerSon(this.scene, "coup_lourd", 0.8);
    fct.texteFlottant(this.scene, this.x, this.y - 330, "-" + degats, "#ffd65a", 40);
    if (this.pv === 0) this.mourir();
  }

  mourir() {
    this.etat = "mort";
    if (this.timerAttaque) this.timerAttaque.remove();
    this.play("boss_mort");
    this.once("animationcomplete", () => this.scene.victoire());
  }
}
