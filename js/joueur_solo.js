import * as fct from "./fonctions.js";
import { ECHELLE_SOLO, BOSS } from "./reglages.js";
import Combattant, { COUPS, ENERGIE_MAX } from "./combattant.js";

/***********************************************************************/
/** JOUEUR DU MODE SOLO
/** Il hérite de Combattant : mêmes attaques, même jauge, mêmes états que
/** dans le mode duel. Seuls les déplacements changent (jeu de plateformes)
/** et ses coups visent tous les ennemis proches au lieu d'un adversaire.
/**
/**   joystick ← →  : courir (accélération et freinage progressifs)
/**   joystick ↑    : sauter (relâcher tôt = saut plus court)
/**   mêmes boutons qu'en duel (voir Combattant.gerer) :
/**   A (maintenu) : garde    B : attaque puissante    C : esquive
/**   D : attaque spéciale (jauge pleine)    E : attaque rapide    F : lancer une note
/***********************************************************************/

const ACCELERATION = 2000; // px/s² au sol
const CONTROLE_AIR = 0.65; // part de l'accélération disponible en l'air
const FREINAGE = 2400; // décélération quand on lâche le joystick, au sol (px/s²)
const FREINAGE_AIR = 600; // en l'air, on garde davantage son élan
const VITESSE_CHUTE_MAX = 1100; // px/s : on ne tombe pas plus vite que ça
const TOLERANCE_BORD = 100; // ms : on peut encore sauter juste après avoir quitté un bord
const MEMOIRE_SAUT = 120; // ms : un appui juste avant d'atterrir déclenche quand même le saut
const COUPE_SAUT = 0.45; // part de la vitesse gardée si on relâche le saut pendant la montée
const DUREE_INVINCIBLE = 1300; // ms d'invincibilité après un coup (le joueur clignote)
const DUREE_PROTECTION_GARDE = 400; // ms sans nouveau dégât après un coup bloqué (sinon un ennemi collé frapperait à chaque frame)
const ECHELLE_TEXTES = 0.5; // textes flottants ("2 coups !"...) adaptés à la petite taille

export default class JoueurSolo extends Combattant {
  // x, y : position des pieds (point "Spawn_Joueur" de Tiled)
  constructor(scene, x, y, perso, touches) {
    super(scene, x, y, perso, 1, touches);
    // même hitbox que dans le mode duel, réduite avec le sprite
    // (setSize et setOffset s'expriment en pixels de la planche : l'échelle s'applique aux deux)
    this.setScale(perso.sprite.echelle * ECHELLE_SOLO);
    this.y = y - this.displayHeight / 2; // les pieds sur le point de départ
    this.body.setMaxVelocity(10000, VITESSE_CHUTE_MAX);
    this.etiquette.setVisible(false); // pas d'étiquette "J1" en solo
    this.echelleTextes = ECHELLE_TEXTES;

    this.debutParade = -Infinity; // moment du dernier appui "parade" (bouton A)
    this.prochaineParade = 0;
    this.dernierAppuiSaut = -Infinity;
    this.dernierContactSol = -Infinity;
    this.sautCoupe = true;
    this.invincible = false;
  }

  // appelée à chaque frame par la scène (même découpage que Combattant.gerer)
  gerer(temps) {
    const appuis = fct.lireAppuis(this.touches);
    if (appuis.haut) this.dernierAppuiSaut = temps;
    // Un appui sur A (en plus de la garde) ouvre une courte fenêtre de "parade" : contre le boss,
    // une touche de piano qui arrive dans cette fenêtre est renvoyée. Appuyer sans arrêt ne sert
    // à rien : il faut attendre DELAI_PARADE avant que l'appui suivant compte.
    if (appuis.A && temps >= this.prochaineParade) {
      this.debutParade = temps;
      this.prochaineParade = temps + BOSS.touches.delaiParade;
      this.scene.surParade(this);
    }
    if (this.auSol) this.dernierContactSol = temps;
    if (!this.invincible) this.setAlpha(this.etat === "esquive" ? 0.45 : 1);

    // états "bloquants" : on ne lit pas les commandes
    if (this.etat === "ko" || this.etat === "touche" || this.etat === "attaque") {
      this.setAccelerationX(0);
      this.setDragX(this.auSol ? FREINAGE : FREINAGE_AIR);
      this.majAnimation();
      return;
    }
    if (this.etat === "esquive") {
      this.setAcceleration(0, 0);
      this.setDragX(0);
      return;
    }

    // garde (bouton A maintenu, au sol)
    if (this.touches.A.isDown && this.auSol) {
      this.etat = "garde";
      this.setAccelerationX(0);
      this.setVelocityX(0);
      this.majAnimation();
      return;
    }
    if (this.etat === "garde") this.etat = "libre";

    // attaques : mêmes boutons que dans le mode duel
    if (this.lireAttaques(appuis, temps)) return;

    this.courir();
    this.sauter(temps);
    this.majAnimation();
  }

  // true pendant la fenêtre de parade qui suit un appui sur A
  enParade(temps) {
    return temps - this.debutParade <= BOSS.touches.fenetreParade;
  }

  // renvoie true si une action a été lancée
  lireAttaques(appuis, temps) {
    let action = null;
    if (appuis.D && this.energie >= ENERGIE_MAX) action = () => this.scene.lancerSpecial(this);
    else if (appuis.E) action = () => this.attaquer(COUPS.legere);
    else if (appuis.B) action = () => this.attaquer(COUPS.lourde);
    else if (appuis.F && temps >= this.prochainTir) action = () => this.tirer(temps);
    else if (appuis.C && temps >= this.prochaineEsquive) action = () => this.esquiver(temps);
    if (!action) return false;
    this.setAccelerationX(0); // on arrête de courir pour frapper
    action();
    return true;
  }

  courir() {
    const direction = (this.touches.droite.isDown ? 1 : 0) - (this.touches.gauche.isDown ? 1 : 0);
    const vitesseMax = this.perso.vitesse * this.bonusVitesse;
    if (direction === 0) {
      this.setAccelerationX(0);
      this.setDragX(this.auSol ? FREINAGE : FREINAGE_AIR);
      return;
    }
    this.setDragX(0);
    this.setFlipX(direction < 0);
    if (direction * this.body.velocity.x >= vitesseMax) {
      // vitesse de course atteinte (après une esquive, on revient à cette vitesse)
      this.setAccelerationX(0);
      this.setVelocityX(direction * vitesseMax);
      return;
    }
    // demi-tour plus vif : on freine et on accélère en même temps
    const demiTour = direction * this.body.velocity.x < 0 ? 2 : 1;
    this.setAccelerationX(direction * ACCELERATION * demiTour * (this.auSol ? 1 : CONTROLE_AIR));
  }

  sauter(temps) {
    const appuiRecent = temps - this.dernierAppuiSaut <= MEMOIRE_SAUT;
    const peutSauter = temps - this.dernierContactSol <= TOLERANCE_BORD;
    if (appuiRecent && peutSauter) {
      this.setVelocityY(-this.perso.saut);
      this.dernierAppuiSaut = -Infinity;
      this.dernierContactSol = -Infinity;
      this.sautCoupe = false;
      fct.jouerSon(this.scene, "saut", 0.3);
    }
    // saut à hauteur variable : relâcher la touche pendant la montée raccourcit le saut
    if (!this.sautCoupe && this.body.velocity.y < 0 && !this.touches.haut.isDown) {
      this.setVelocityY(this.body.velocity.y * COUPE_SAUT);
      this.sautCoupe = true;
    }
  }

  /*********************************************************************/
  /** ATTAQUES : on remplace la cible unique du duel par tous les ennemis
  /*********************************************************************/
  // zone de frappe du mode duel, réduite comme le personnage
  verifierImpact(coup) {
    this.timerImpact = null;
    const portee = coup.portee * ECHELLE_SOLO;
    const zone = new Phaser.Geom.Rectangle(this.sens > 0 ? this.x : this.x - portee, this.y - 75 * ECHELLE_SOLO, portee, 105 * ECHELLE_SOLO);
    for (const ennemi of this.scene.ennemis.getChildren()) {
      if (!ennemi.actif) continue;
      const corps = new Phaser.Geom.Rectangle(ennemi.body.x, ennemi.body.y, ennemi.body.width, ennemi.body.height);
      if (Phaser.Geom.Intersects.RectangleToRectangle(zone, corps)) this.toucherEnnemi(ennemi, coup);
    }
  }

  // un coup (ou une note) du joueur atteint un ennemi : dégâts, combo et jauge comme en duel
  toucherEnnemi(ennemi, coup) {
    ennemi.recevoirDegats(coup.degats * this.perso.force * this.bonusForce);
    this.enregistrerCoup();
    this.gagnerEnergie(coup.energie * this.bonusCombo);
    fct.etincelles(this.scene, ennemi.x, ennemi.y, this.perso.couleur, 3);
  }

  /*********************************************************************/
  /** DÉGÂTS REÇUS (contact d'un ennemi ou note de trompette)
  /** Esquive et garde protègent comme dans le mode duel.
  /*********************************************************************/
  // renvoie true si le joueur a été atteint
  subirAttaque(coup, sens) {
    if (this.etat === "ko" || this.invincible) return false;
    if (this.etat === "esquive") {
      this.annoncer("Esquivé !", "#9fe8ff", 100);
      return false;
    }

    let degats = coup.degats;
    if (this.etat === "garde") {
      degats *= 0.2;
      this.setVelocityX(sens * coup.recul * 0.4);
      fct.jouerSon(this.scene, "garde", 0.5);
      this.rendreInvincible(DUREE_PROTECTION_GARDE, false);
    } else {
      this.changerEtat("touche", coup.etourdissement);
      this.setAcceleration(0, 0);
      this.setVelocity(sens * coup.recul, -coup.reculY);
      this.anims.play(this.perso.id + "_touche", true);
      fct.jouerSon(this.scene, "coup_lourd", 0.5);
      this.scene.cameras.main.shake(150, 0.006);
      this.rendreInvincible();
    }

    this.pv = Math.max(0, this.pv - Math.max(1, Math.round(degats)));
    this.gagnerEnergie(4); // comme en duel, on gagne un peu de jauge en encaissant
    if (this.pv === 0) this.scene.defaite();
    return true;
  }

  rendreInvincible(duree = DUREE_INVINCIBLE, clignoter = true) {
    this.invincible = true;
    if (clignoter) this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 100, yoyo: true, repeat: Math.floor(duree / 200) - 1 });
    this.scene.time.delayedCall(duree, () => {
      this.invincible = false;
      this.setAlpha(1);
    });
  }

  // rebond après avoir écrasé un ennemi (plus haut si on garde le saut enfoncé)
  rebondir() {
    this.setVelocityY(-this.perso.saut * (this.touches.haut.isDown ? 0.8 : 0.55));
    this.sautCoupe = !this.touches.haut.isDown;
  }
}
