import * as fct from "./fonctions.js";
import { PERSONNAGES } from "./donnees.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** SÉLECTION DES PERSONNAGES (mode duel)
/** Chaque joueur choisit avec son joystick et valide avec A (B = annuler).
/***********************************************************************/

const COULEURS_JOUEURS = [0x6cb8ff, 0xff6c6c];
const ECART_CARTES = 112;

export default class selection extends Phaser.Scene {
  constructor() {
    super({ key: "selection" });
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(300);
    fct.jouerMusique(this, "musique_menu");

    this.add.image(640, 360, "fond_menu");
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.45);
    this.add.text(640, 48, "Choisissez votre artiste", fct.style(48, "#ffd65a")).setOrigin(0.5);

    // cartes des personnages au centre
    PERSONNAGES.forEach((perso, i) => {
      const x = this.xCarte(i);
      this.add.rectangle(x, 360, 100, 156, 0x2a0a14).setStrokeStyle(3, 0xb08030);
      this.add.sprite(x, 360, perso.id, 0).setScale(0.78);
    });

    this.choix = [0, PERSONNAGES.length - 1];
    this.pret = [false, false];
    this.panneaux = [this.creerPanneau(1, 200), this.creerPanneau(2, 1080)];

    this.add.text(640, 690, "Joystick ← → : choisir     A : valider     B : annuler", fct.style(22, "#e8d8c0")).setOrigin(0.5);

    this.touches = creerTouchesDeuxJoueurs(this);
    this.majPanneau(0);
    this.majPanneau(1);
  }

  xCarte(i) {
    return 640 + (i - (PERSONNAGES.length - 1) / 2) * ECART_CARTES;
  }

  // panneau d'un joueur : aperçu animé, nom, statistiques, attaque spéciale
  creerPanneau(numero, x) {
    const couleur = COULEURS_JOUEURS[numero - 1];
    const p = {};
    this.add.text(x, 110, "JOUEUR " + numero, fct.style(30, fct.couleurTexte(couleur))).setOrigin(0.5);
    p.apercu = this.add.sprite(x, 290, "maestro").setScale(1.3);
    if (numero === 2) p.apercu.setFlipX(true);
    p.nom = this.add.text(x, 425, "", fct.style(32)).setOrigin(0.5);
    p.role = this.add.text(x, 460, "", fct.style(20, "#e8d8c0")).setOrigin(0.5);
    p.stats = this.add.graphics();
    ["Vitesse", "Puissance", "Saut"].forEach((nom, i) => {
      this.add.text(x - 150, 498 + i * 30, nom, fct.style(18)).setOrigin(0, 0.5);
    });
    p.special = this.add.text(x, 600, "", { ...fct.style(18, "#ffd65a"), wordWrap: { width: 330 } }).setOrigin(0.5, 0);
    p.pret = this.add.text(x, 290, "PRÊT !", fct.style(52, "#7dff9a")).setOrigin(0.5).setAngle(-12).setVisible(false);
    p.x = x;

    // curseur autour de la carte choisie
    p.cadre = this.add.rectangle(0, 360, 108, 164).setStrokeStyle(5, couleur);
    p.etiquette = this.add.text(0, numero === 1 ? 262 : 458, "J" + numero, fct.style(24, fct.couleurTexte(couleur))).setOrigin(0.5);
    return p;
  }

  majPanneau(j) {
    const p = this.panneaux[j];
    const perso = PERSONNAGES[this.choix[j]];
    const x = this.xCarte(this.choix[j]);
    // si les deux joueurs sont sur la même carte, on décale les cadres pour voir les deux
    const memeCarte = this.choix[0] === this.choix[1];
    p.cadre.setPosition(x, 360).setScale(memeCarte && j === 1 ? 1.08 : 1);
    p.etiquette.setX(x);

    p.apercu.play(perso.id + (this.pret[j] ? "_victoire" : "_repos"));
    p.nom.setText(perso.nom);
    p.role.setText(perso.role);
    p.special.setText("Spécial : " + perso.special + " (" + perso.compositeur + ")");
    p.pret.setVisible(this.pret[j]);

    // barres de statistiques sur 5
    p.stats.clear();
    [perso.stats.vitesse, perso.stats.puissance, perso.stats.saut].forEach((valeur, i) => {
      for (let k = 0; k < 5; k++) {
        p.stats.fillStyle(k < valeur ? perso.couleur : 0x3a2a30, 1);
        p.stats.fillRect(p.x - 20 + k * 34, 488 + i * 30, 30, 18);
      }
    });
  }

  update() {
    this.touches.forEach((touches, j) => {
      const appuis = fct.lireAppuis(touches);
      if (!this.pret[j]) {
        if (appuis.gauche || appuis.droite) {
          this.choix[j] = fct.boucler(this.choix[j] + (appuis.gauche ? -1 : 1), PERSONNAGES.length);
          fct.jouerSon(this, "menu_deplacer", 0.5);
          this.majPanneau(0);
          this.majPanneau(1);
        }
        if (appuis.A) {
          this.pret[j] = true;
          fct.jouerSon(this, "menu_valider");
          this.majPanneau(j);
        } else if (appuis.B && !this.pret[0] && !this.pret[1]) {
          fct.changerScene(this, "menu");
        }
      } else if (appuis.B) {
        this.pret[j] = false;
        this.majPanneau(j);
      }
    });

    if (this.pret[0] && this.pret[1]) {
      fct.changerScene(this, "selection_arene", {
        j1: PERSONNAGES[this.choix[0]].id,
        j2: PERSONNAGES[this.choix[1]].id
      });
    }
  }
}
