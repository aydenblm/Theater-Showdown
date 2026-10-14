import * as fct from "./fonctions.js";

/***********************************************************************/
/** CLASSE COMBATTANT
/** Un combattant est un sprite physique (comme le "player" du template)
/** auquel on ajoute ses caractéristiques : points de vie, jauge, état...
/**
/** États possibles (this.etat) :
/**   "libre"    : peut se déplacer, sauter, attaquer
/**   "garde"    : bouton A maintenu, bloque 80% des dégâts (60% d'une attaque puissante)
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
// lourd : préparation visible (le perso s'illumine), arrêt sur image à l'impact, traverse en partie la garde
export const COUPS = {
  // rapide : part tout de suite, petits dégâts, presque pas de recul : idéal pour enchaîner les combos
  legere: { anim: "legere", demarrage: 70, duree: 220, degats: 4, portee: 90, elan: 120, recul: 40, reculY: 0, etourdissement: 260, energie: 8 },
  // puissante : lente et risquée (on peut être interrompu pendant la préparation), mais elle projette l'adversaire
  lourde: { anim: "lourde", demarrage: 320, duree: 700, degats: 15, portee: 125, elan: 260, recul: 650, reculY: 380, etourdissement: 650, energie: 16, lourd: true },
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

    // agrandissement propre à la planche (les persos pixel art sont dessinés en 128x128)
    const sprite = perso.sprite;
    this.setScale(sprite.echelle);
    // hitbox de 44x138 pixels à l'écran, centrée, pieds en bas de la frame
    // (setSize et setOffset s'expriment en pixels de la planche, avant agrandissement)
    const largeurCorps = 44 / sprite.echelle;
    const hauteurCorps = 138 / sprite.echelle;
    this.body.setSize(largeurCorps, hauteurCorps, false);
    this.body.setOffset((sprite.largeur - largeurCorps) / 2, sprite.hauteur - hauteurCorps - 2 / sprite.echelle);
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
    this.echelleTextes = 1; // les textes flottants (combo, "Esquivé !"...) suivent la taille du personnage
    this.plateforme = null; // plateforme sur laquelle il se tient (null au sol ou en l'air)
    this.traverseeJusqua = 0; // pendant la descente d'une plateforme, on la traverse

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

  // la jauge se remplit plus vite en combo
  get bonusCombo() {
    return 1 + 0.25 * Math.max(0, this.combo - 1);
  }

  // petit texte qui s'envole au-dessus du personnage (hauteur et taille suivent echelleTextes)
  annoncer(texte, couleur, hauteur, taille = 26) {
    const e = this.echelleTextes;
    fct.texteFlottant(this.scene, this.x, this.y - hauteur * e, texte, couleur, Math.round(taille * e));
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

    // Boutons en combat :  A = garde (maintenu)   B = attaque puissante   C = esquive
    //                       D = attaque spéciale    E = attaque rapide      F = lancer une note

    // garde (bouton A maintenu, au sol)
    if (this.touches.A.isDown && this.auSol) {
      this.etat = "garde";
      this.setVelocityX(0);
      this.majAnimation();
      return;
    }
    if (this.etat === "garde") this.etat = "libre";

    // joystick bas sur une plateforme : on se laisse tomber à travers
    if (appuis.bas && this.plateforme) this.descendrePlateforme();

    // attaques
    if (appuis.D && this.energie >= ENERGIE_MAX) {
      this.scene.lancerSpecial(this);
      return;
    }
    if (appuis.E) {
      this.attaquer(COUPS.legere);
      return;
    }
    if (appuis.B) {
      this.attaquer(COUPS.lourde);
      return;
    }
    if (appuis.F && temps >= this.prochainTir) {
      this.tirer(temps);
      return;
    }
    if (appuis.C && temps >= this.prochaineEsquive) {
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
    this.clearTint(); // une attaque puissante interrompue ne doit pas rester illuminée
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
    const haut = this.y - this.displayHeight / 2 - 22; // juste au-dessus de la tête
    this.etiquette.setPosition(this.x, haut);
    this.iconeVitesse.setPosition(this.x - 32, haut).setVisible(this.bonusVitesse > 1);
    this.iconeForce.setPosition(this.x + 32, haut).setVisible(this.bonusForce > 1);
  }

  /*********************************************************************/
  /** ACTIONS
  /*********************************************************************/
  attaquer(coup) {
    this.changerEtat("attaque", coup.duree);
    this.anims.play(this.perso.id + "_" + coup.anim);
    if (coup.lourd) {
      // préparation : on s'immobilise et on se charge de lumière dorée
      if (this.auSol) this.setVelocityX(0);
      this.setTint(0xffc060);
    } else {
      if (this.auSol) this.setVelocityX(this.sens * coup.elan);
      fct.jouerSon(this.scene, "esquive", 0.25); // petit "whoosh"
    }
    // le coup ne touche qu'après son temps de démarrage
    this.timerImpact = this.scene.time.delayedCall(coup.demarrage, () => this.verifierImpact(coup));
  }

  verifierImpact(coup) {
    this.timerImpact = null;
    if (coup.lourd) {
      // fin de la préparation : on bondit en avant avec un "whoosh" grave
      this.clearTint();
      if (this.auSol) this.setVelocityX(this.sens * coup.elan);
      this.scene.sound.play("esquive", { volume: 0.5, rate: 0.6 });
    }
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

  // traverse la plateforme sous ses pieds (la scène ignore la collision pendant un court instant)
  descendrePlateforme() {
    this.plateforme = null;
    this.traverseeJusqua = this.scene.time.now + 250;
    this.setVelocityY(120);
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
      this.annoncer("Esquivé !", "#9fe8ff", 100);
      return false;
    }

    let degats = coup.degats * attaquant.perso.force * attaquant.bonusForce;
    const enGarde = this.etat === "garde" && !imparable;

    if (enGarde) {
      // la garde bloque 80 % d'un coup normal, mais seulement 60 % d'une attaque puissante
      degats *= coup.lourd ? 0.4 : 0.2;
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
      if (coup.lourd) {
        // impact puissant : arrêt sur image, grosse gerbe d'étincelles, écran qui tremble fort
        this.scene.arretSurImage(90);
        fct.etincelles(this.scene, this.x - sens * 10, this.y - 30, attaquant.perso.couleur, 10);
        this.scene.cameras.main.shake(220, 0.012);
      } else {
        fct.etincelles(this.scene, this.x - sens * 10, this.y - 30, attaquant.perso.couleur, degats >= 10 ? 7 : 3);
        this.scene.cameras.main.shake(degats >= 10 ? 150 : 60, degats >= 10 ? 0.008 : 0.002);
      }
    }

    degats = Math.max(1, Math.round(degats));
    this.pv = Math.max(0, this.pv - degats);

    // la jauge se remplit plus vite en combo ; on en gagne aussi un peu en encaissant
    attaquant.gagnerEnergie(enGarde ? coup.energie / 3 : coup.energie * attaquant.bonusCombo);
    this.gagnerEnergie(4);

    if (this.pv === 0) this.scene.finDeManche(attaquant);
    return true;
  }

  enregistrerCoup() {
    const maintenant = this.scene.time.now;
    this.combo = maintenant - this.dernierCoupPorte < DELAI_COMBO ? this.combo + 1 : 1;
    this.dernierCoupPorte = maintenant;
    if (this.combo >= 2) {
      this.annoncer(this.combo + " coups !", fct.couleurTexte(this.perso.couleur), 140, 20 + this.combo * 4);
    }
  }

  gagnerEnergie(quantite) {
    if (this.energie >= ENERGIE_MAX) return;
    this.energie = Math.min(ENERGIE_MAX, this.energie + quantite);
    if (this.energie >= ENERGIE_MAX) {
      fct.jouerSon(this.scene, "jauge_pleine", 0.6);
      this.annoncer("Spécial prêt ! (D)", "#ffd65a", 130);
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
    this.annoncer(objet.texte, "#7dff9a", 120);
  }

  appliquerBonus(type, valeur, duree) {
    const cleTimer = type === "vitesse" ? "timerVitesse" : "timerForce";
    const cleBonus = type === "vitesse" ? "bonusVitesse" : "bonusForce";
    this[cleBonus] = valeur;
    if (this[cleTimer]) this[cleTimer].remove();
    this[cleTimer] = this.scene.time.delayedCall(duree, () => (this[cleBonus] = 1));
  }
}
