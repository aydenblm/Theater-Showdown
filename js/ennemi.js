import * as fct from "./fonctions.js";
import { ECHELLE_SOLO } from "./reglages.js";

/***********************************************************************/
/** ENNEMI DU MODE SOLO
/** Tous les ennemis partagent cette classe ; leur "comportement" (reglages.js) change
/** la façon de se déplacer :
/**   "marche" : va et vient, fait demi-tour devant un mur ou au bord du vide (il ne tombe jamais)
/**              les trompettistes (donnees.tir) lancent en plus une note devant eux,
/**              à intervalle aléatoire (au plus toutes les DELAI_TIR_MAX ms)
/**   "saute"  : le tambour reste sur place puis bondit vers le joueur quand il est assez près
/**   "vole"   : la croche fonce vers le joueur en ondulant, sans tenir compte du décor
/** Dans tous les cas, les attaques du joueur lui retirent des points de vie.
/***********************************************************************/

const DELAI_TIR_MIN = 1200; // ms
const DELAI_TIR_MAX = 4000; // ms : un trompettiste tire au moins toutes les 4 s
const PAUSE_TIR = 350; // ms d'arrêt pour souffler dans la trompette
const DUREE_SONNE = 250; // ms d'arrêt après avoir reçu un coup

const DISTANCE_SAUT = 520; // px : le tambour ne bondit que si le joueur est plus près que ça
const DELAI_SAUT_MIN = 900; // ms entre deux bonds
const DELAI_SAUT_MAX = 1700;
const FORCE_SAUT = 430; // px/s vers le haut

export default class Ennemi extends Phaser.Physics.Arcade.Sprite {
  // donnees : une entrée de ENNEMIS_SOLO (reglages.js)
  // calqueSol : calque de tuiles avec lequel il entre en collision
  constructor(scene, x, y, donnees, calqueSol) {
    super(scene, x, y, donnees.id, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // hitbox en pixels de la planche : l'échelle du sprite s'y applique aussi
    this.setScale(donnees.echelle * ECHELLE_SOLO);
    const corps = donnees.corps;
    this.body.setSize(corps.largeur, corps.hauteur, false);
    this.body.setOffset(corps.x, corps.y);
    // le point placé dans Tiled correspond aux pieds de l'ennemi
    this.y = y - (corps.y + corps.hauteur) * this.scaleY + this.displayHeight / 2;
    this.setCollideWorldBounds(true);
    this.setDepth(9);

    this.calqueSol = calqueSol;
    this.comportement = donnees.comportement || "marche";
    this.volant = this.comportement === "vole"; // un volant ignore le décor (voir solo_commun.js)
    if (this.volant) this.body.setAllowGravity(false);
    this.vitesse = donnees.vitesse;
    this.pv = donnees.pv;
    this.sens = Phaser.Math.RND.pick([-1, 1]); // part au hasard à gauche ou à droite
    this.arretJusqua = 0; // immobile jusqu'à ce moment (tir, coup reçu)
    this.prochainSaut = scene.time.now + Phaser.Math.Between(DELAI_SAUT_MIN, DELAI_SAUT_MAX);
    this.actif = true;
    this.play(donnees.id + "_marche");
    if (donnees.tir) this.programmerTir();
  }

  // appelée à chaque frame par le groupe (runChildUpdate)
  update() {
    if (!this.actif) return;
    if (this.comportement === "vole") this.voler();
    else if (this.comportement === "saute") this.sauter();
    else this.marcher();
  }

  /*********************************************************************/
  /** LES TROIS COMPORTEMENTS
  /*********************************************************************/
  marcher() {
    const corps = this.body;
    if (!corps.blocked.down || this.scene.time.now < this.arretJusqua) {
      this.setVelocityX(0); // en l'air (au tout début), en train de tirer ou sonné
      return;
    }

    // demi-tour contre un mur...
    if (corps.blocked.right) this.sens = -1;
    else if (corps.blocked.left) this.sens = 1;
    // ...ou quand il n'y a plus de sol solide sous le pied avant
    else if (!this.solDevant()) this.sens = -this.sens;

    this.setVelocityX(this.sens * this.vitesse);
    this.setFlipX(this.sens < 0); // les planches regardent vers la droite
  }

  sauter() {
    const joueur = this.scene.joueur;
    const maintenant = this.scene.time.now;
    if (!this.body.blocked.down) return; // en plein bond : on garde l'élan
    this.setVelocityX(0);
    if (maintenant < this.arretJusqua || maintenant < this.prochainSaut) return;
    if (Math.abs(joueur.x - this.x) > DISTANCE_SAUT) return; // trop loin : il attend

    // un bond vers le joueur
    this.sens = joueur.x < this.x ? -1 : 1;
    this.setFlipX(this.sens < 0);
    this.setVelocity(this.sens * this.vitesse, -FORCE_SAUT);
    this.prochainSaut = maintenant + Phaser.Math.Between(DELAI_SAUT_MIN, DELAI_SAUT_MAX);
  }

  voler() {
    if (this.scene.time.now < this.arretJusqua) {
      this.setVelocity(0, 0);
      return;
    }
    const joueur = this.scene.joueur;
    this.sens = joueur.x < this.x ? -1 : 1;
    this.setFlipX(this.sens < 0);
    // elle avance vers le joueur et ondule de haut en bas
    const ondulation = Math.sin(this.scene.time.now / 260 + this.x) * 50;
    const versLeJoueur = Phaser.Math.Clamp((joueur.y - 20 - this.y) * 1.5, -this.vitesse, this.vitesse);
    this.setVelocity(this.sens * this.vitesse, versLeJoueur + ondulation);
  }

  solDevant() {
    const xPied = this.sens > 0 ? this.body.right + 2 : this.body.left - 2;
    const tuile = this.calqueSol.getTileAtWorldXY(xPied, this.body.bottom + 2);
    return tuile !== null && tuile.collides;
  }

  /*********************************************************************/
  /** TIR DES TROMPETTISTES
  /*********************************************************************/
  // prochain tir dans un délai aléatoire, puis on reprogramme le suivant
  programmerTir() {
    this.timerTir = this.scene.time.delayedCall(Phaser.Math.Between(DELAI_TIR_MIN, DELAI_TIR_MAX), () => {
      // on ne tire que si l'on est à l'écran : inutile d'envoyer des notes que personne ne voit
      if (this.scene.cameras.main.worldView.contains(this.x, this.y)) this.tirer();
      this.programmerTir();
    });
  }

  tirer() {
    this.arretJusqua = this.scene.time.now + PAUSE_TIR;
    this.setFlipX(this.sens < 0);
    this.scene.creerNoteEnnemi(this);
  }

  /*********************************************************************/
  /** COUPS REÇUS ET ÉLIMINATION
  /*********************************************************************/
  // coup du joueur : flash blanc, arrêt bref, et élimination si plus de points de vie
  recevoirDegats(degats) {
    if (!this.actif) return;
    this.pv -= degats;
    if (this.pv <= 0) {
      this.eliminer();
      return;
    }
    this.arretJusqua = this.scene.time.now + DUREE_SONNE;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.clearTint());
    fct.jouerSon(this.scene, "coup_leger", 0.6);
  }

  // écrasé ou plus de points de vie : il s'aplatit puis disparaît
  eliminer() {
    this.actif = false;
    this.body.enable = false;
    if (this.timerTir) this.timerTir.remove();
    this.anims.stop();
    this.clearTint();
    fct.jouerSon(this.scene, "coup_lourd", 0.6);
    fct.etincelles(this.scene, this.x, this.body.top, 0xffd65a, 6);
    this.scene.tweens.add({
      targets: this,
      scaleY: this.scaleY * 0.2,
      alpha: 0,
      y: this.y + this.displayHeight * 0.3,
      duration: 250,
      onComplete: () => this.destroy()
    });
  }
}
