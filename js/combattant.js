import * as fct from "./fonctions.js";

/***********************************************************************/
/** CLASSE COMBATTANT
/** Un combattant est un sprite physique (comme le "player" du template)
/** auquel on ajoute ses caractéristiques : points de vie, jauge, état...
/**
/** États possibles (this.etat) :
/**   "libre"    : peut se déplacer, sauter, attaquer
/**   "garde"    : accroupi, bloque 80% des dégâts
/**   "attaque"  : en train de frapper / tirer (ne peut rien faire d'autre)
/**   "touche"   : vient d'être frappé, étourdi un court instant
/**   "esquive"  : dash rapide, invincible
/**   "ko", "victoire" : fin de manche
/***********************************************************************/

export const PV_MAX = 100;
export const ENERGIE_MAX = 100; // la jauge contient 5 notes de 20 points

// caractéristiques des coups (durées en millisecondes)
// demarrage : délai avant que le coup ne touche     duree : temps total pendant lequel on est bloqué
// portee : longueur de la zone de frappe devant le personnage     elan : petit pas en avant en frappant
// recul / reculY : vitesse donnée à l'adversaire touché   etourdissement : durée de l'état "touche"
export const COUPS = {
  legere: { anim: "legere", demarrage: 90, duree: 260, degats: 5, portee: 95, elan: 140, recul: 60, reculY: 0, etourdissement: 300, energie: 9 },
  lourde: { anim: "lourde", demarrage: 230, duree: 560, degats: 11, portee: 115, elan: 180, recul: 480, reculY: 280, etourdissement: 480, energie: 14 },
  note: { degats: 6, recul: 220, reculY: 80, etourdissement: 300, energie: 7 }
};

const DELAI_TIR = 900;
const DELAI_ESQUIVE = 900;
const DELAI_COMBO = 1000; // temps max entre deux coups pour que le combo continue

export default class Combattant extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, perso, numero, touches) {
    super(scene, x, y, perso.id, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // hitbox plus fine que l'image (120x180)
    this.body.setSize(44, 138).setOffset(38, 40);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    this.perso = perso;
    this.numero = numero;
    this.touches = touches;
    this.adversaire = null; // défini par la scène de combat

    this.pv = PV_MAX;
    this.pvAffiches = PV_MAX; // pour l'animation de la barre de vie
    this.energie = 0;
    this.etat = "libre";
    this.timerEtat = null;
    this.timerImpact = null;
    this.prochainTir = 0;
    this.prochaineEsquive = 0;
    this.combo = 0;
    this.dernierCoupPorte = 0;
    this.bonusVitesse = 1;
    this.bonusForce = 1;

    // étiquette "J1"/"J2" au-dessus de la tête + icônes des bonus actifs
    const couleur = numero === 1 ? "#6cb8ff" : "#ff6c6c";
    this.etiquette = scene.add.text(x, y, "J" + numero, fct.style(20, couleur)).setOrigin(0.5).setDepth(11);
    this.iconeVitesse = scene.add.image(x, y, "objet_metronome").setScale(2 / 3).setDepth(11).setVisible(false);
    this.iconeForce = scene.add.image(x, y, "objet_baguette").setScale(2 / 3).setDepth(11).setVisible(false);
  }

  get sens() {
    return this.flipX ? -1 : 1; // 1 = regarde à droite, -1 = regarde à gauche
  }

  get auSol() {
    return this.body.blocked.down || this.body.touching.down;
  }

  /*********************************************************************/
  /** Appelée à chaque frame par la scène de combat
  /*********************************************************************/
  gerer(temps) {
    const appuis = fct.lireAppuis(this.touches);
    this.majEtiquettes();
    this.setAlpha(this.etat === "esquive" ? 0.45 : 1);
    if (!this.auSol) this.derniereTouchePiano = null;

    if (this.etat === "ko" || this.etat === "victoire" || this.scene.combatFige) {
      if (this.auSol) this.setVelocityX(this.body.velocity.x * 0.85);
      this.majAnimation();
      return;
    }

    // on se tourne toujours vers l'adversaire (comme dans les jeux de combat classiques)
    if (this.etat === "libre" || this.etat === "garde") {
      this.setFlipX(this.adversaire.x < this.x);
    }

    // états "bloquants" : on ne lit pas les commandes
    if (this.etat === "touche") {
      if (this.auSol) this.setVelocityX(this.body.velocity.x * 0.88);
      this.majAnimation();
      return;
    }
    if (this.etat === "attaque") {
      if (this.auSol) this.setVelocityX(this.body.velocity.x * 0.85); // l'élan s'amortit
      return;
    }
    if (this.etat === "esquive") return;

    // garde (joystick bas, au sol)
    if (this.touches.bas.isDown && this.auSol) {
      this.etat = "garde";
      this.setVelocityX(0);
      this.majAnimation();
      return;
    }
    if (this.etat === "garde") this.etat = "libre";

    // attaques
    if (appuis.D && this.energie >= ENERGIE_MAX) {
      this.scene.lancerSpecial(this);
      return;
    }
    if (appuis.A) {
      this.attaquer(COUPS.legere);
      return;
    }
    if (appuis.B) {
      this.attaquer(COUPS.lourde);
      return;
    }
    if (appuis.C && temps >= this.prochainTir) {
      this.tirer(temps);
      return;
    }
    if (appuis.E && temps >= this.prochaineEsquive) {
      this.esquiver(temps);
      return;
    }

    // déplacements
    const vitesse = this.perso.vitesse * this.bonusVitesse;
    if (this.touches.gauche.isDown) this.setVelocityX(-vitesse);
    else if (this.touches.droite.isDown) this.setVelocityX(vitesse);
    else this.setVelocityX(0);

    if (appuis.haut && this.auSol) {
      this.setVelocityY(-this.perso.saut);
      fct.jouerSon(this.scene, "saut", 0.3);
    }
    this.majAnimation();
  }

  // Change d'état. Si une durée est donnée, on revient à "libre" à la fin (timer).
  // Tout timer en cours est annulé : un coup reçu interrompt donc une attaque.
  changerEtat(etat, duree = 0) {
    this.etat = etat;
    if (this.timerEtat) this.timerEtat.remove();
    if (this.timerImpact) this.timerImpact.remove();
    this.timerEtat = null;
    this.timerImpact = null;
    if (duree > 0) {
      this.timerEtat = this.scene.time.delayedCall(duree, () => {
        this.timerEtat = null;
        this.etat = "libre";
      });
    }
  }

  majAnimation() {
    let anim;
    if (this.etat === "attaque") return; // l'animation a été lancée par l'attaque
    if (this.etat === "ko" || this.etat === "victoire" || this.etat === "touche" || this.etat === "garde") {
      anim = this.etat;
    } else if (!this.auSol) {
      anim = "saut";
    } else if (Math.abs(this.body.velocity.x) > 10) {
      anim = "marche";
    } else {
      anim = "repos";
    }
    this.anims.play(this.perso.id + "_" + anim, true);
  }

  majEtiquettes() {
    this.etiquette.setPosition(this.x, this.y - 112);
    this.iconeVitesse.setPosition(this.x - 32, this.y - 112).setVisible(this.bonusVitesse > 1);
    this.iconeForce.setPosition(this.x + 32, this.y - 112).setVisible(this.bonusForce > 1);
  }

  /*********************************************************************/
  /** ACTIONS
  /*********************************************************************/
  attaquer(coup) {
    this.changerEtat("attaque", coup.duree);
    if (this.auSol) this.setVelocityX(this.sens * coup.elan);
    this.anims.play(this.perso.id + "_" + coup.anim);
    fct.jouerSon(this.scene, "esquive", 0.25); // petit "whoosh"
    // le coup ne touche qu'après son temps de démarrage
    this.timerImpact = this.scene.time.delayedCall(coup.demarrage, () => this.verifierImpact(coup));
  }

  verifierImpact(coup) {
    this.timerImpact = null;
    const cible = this.adversaire;
    // zone de frappe : un rectangle devant le personnage, à hauteur du buste
    const zone = new Phaser.Geom.Rectangle(this.sens > 0 ? this.x : this.x - coup.portee, this.y - 75, coup.portee, 105);
    const corps = new Phaser.Geom.Rectangle(cible.body.x, cible.body.y, cible.body.width, cible.body.height);
    if (Phaser.Geom.Intersects.RectangleToRectangle(zone, corps)) {
      cible.recevoirCoup(this, coup, this.sens);
    }
  }

  tirer(temps) {
    this.prochainTir = temps + DELAI_TIR;
    this.changerEtat("attaque", 320);
    if (this.auSol) this.setVelocityX(0);
    this.anims.play(this.perso.id + "_tir");
    this.timerImpact = this.scene.time.delayedCall(110, () => {
      this.timerImpact = null;
      this.scene.creerNote(this);
    });
  }

  esquiver(temps) {
    this.prochaineEsquive = temps + DELAI_ESQUIVE;
    this.changerEtat("esquive", 260);
    // on esquive dans la direction du joystick, sinon vers l'arrière
    let direction = -this.sens;
    if (this.touches.gauche.isDown) direction = -1;
    if (this.touches.droite.isDown) direction = 1;
    this.setVelocityX(direction * 620);
    this.anims.play(this.perso.id + "_marche", true);
    fct.jouerSon(this.scene, "esquive", 0.5);
  }

  /*********************************************************************/
  /** DÉGÂTS, JAUGE, BONUS
  /*********************************************************************/

  // renvoie true si le coup a porté
  recevoirCoup(attaquant, coup, sens, imparable = false) {
    if (this.etat === "ko" || this.scene.mancheTerminee) return false;
    if (this.etat === "esquive") {
      fct.texteFlottant(this.scene, this.x, this.y - 100, "Esquivé !", "#9fe8ff");
      return false;
    }

    let degats = coup.degats * attaquant.perso.force * attaquant.bonusForce;
    const enGarde = this.etat === "garde" && !imparable;

    if (enGarde) {
      degats *= 0.2;
      this.setVelocityX(sens * coup.recul * 0.4);
      fct.jouerSon(this.scene, "garde", 0.5);
      fct.etincelles(this.scene, this.x - sens * 20, this.y - 20, 0x9fd8ff, 3);
    } else {
      attaquant.enregistrerCoup();
      this.changerEtat("touche", coup.etourdissement);
      this.setVelocity(sens * coup.recul, -coup.reculY);
      this.anims.play(this.perso.id + "_touche", true);
      // flash blanc
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(70, () => this.clearTint());
      fct.jouerSon(this.scene, degats >= 10 ? "coup_lourd" : "coup_leger", 0.7);
      fct.etincelles(this.scene, this.x - sens * 10, this.y - 30, attaquant.perso.couleur, degats >= 10 ? 7 : 4);
      this.scene.cameras.main.shake(degats >= 10 ? 150 : 70, degats >= 10 ? 0.008 : 0.003);
    }

    degats = Math.max(1, Math.round(degats));
    this.pv = Math.max(0, this.pv - degats);

    // la jauge se remplit plus vite en combo ; on en gagne aussi un peu en encaissant
    const bonusCombo = 1 + 0.25 * Math.max(0, attaquant.combo - 1);
    attaquant.gagnerEnergie(enGarde ? coup.energie / 3 : coup.energie * bonusCombo);
    this.gagnerEnergie(4);

    if (this.pv === 0) this.scene.finDeManche(attaquant);
    return true;
  }

  enregistrerCoup() {
    const maintenant = this.scene.time.now;
    this.combo = maintenant - this.dernierCoupPorte < DELAI_COMBO ? this.combo + 1 : 1;
    this.dernierCoupPorte = maintenant;
    if (this.combo >= 2) {
      fct.texteFlottant(this.scene, this.x, this.y - 140, this.combo + " coups !", fct.couleurTexte(this.perso.couleur), 20 + this.combo * 4);
    }
  }

  gagnerEnergie(quantite) {
    if (this.energie >= ENERGIE_MAX) return;
    this.energie = Math.min(ENERGIE_MAX, this.energie + quantite);
    if (this.energie >= ENERGIE_MAX) {
      fct.jouerSon(this.scene, "jauge_pleine", 0.6);
      fct.texteFlottant(this.scene, this.x, this.y - 130, "Spécial prêt ! (D)", "#ffd65a");
    }
  }

  ramasserObjet(objet) {
    switch (objet.type) {
      case "soin":
        this.pv = Math.min(PV_MAX, this.pv + objet.valeur);
        break;
      case "energie":
        this.gagnerEnergie(objet.valeur);
        break;
      case "vitesse":
      case "force":
        this.appliquerBonus(objet.type, objet.valeur, objet.duree);
        break;
    }
    fct.jouerSon(this.scene, "bonus", 0.6);
    fct.texteFlottant(this.scene, this.x, this.y - 120, objet.texte, "#7dff9a");
  }

  appliquerBonus(type, valeur, duree) {
    const cleTimer = type === "vitesse" ? "timerVitesse" : "timerForce";
    const cleBonus = type === "vitesse" ? "bonusVitesse" : "bonusForce";
    this[cleBonus] = valeur;
    if (this[cleTimer]) this[cleTimer].remove();
    this[cleTimer] = this.scene.time.delayedCall(duree, () => (this[cleBonus] = 1));
  }
}
