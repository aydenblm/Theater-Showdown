import * as fct from "./fonctions.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** MENU PRINCIPAL : choix du mode de jeu
/** Trois boutons côte à côte : le bouton choisi est en couleur,
/** les autres en version "sombre".
/***********************************************************************/

// rideau : la scène suivante s'ouvre avec l'animation du rideau de théâtre
const BOUTONS = [
  { cle: "bouton_solo", actif: true, scene: "solo", rideau: true },
  { cle: "bouton_multi", actif: true, scene: "connexion", rideau: true },
  { cle: "bouton_commandes", actif: true, scene: "commandes" }
];

export default class menu extends Phaser.Scene {
  constructor() {
    super({ key: "menu" });
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(400);
    fct.jouerMusique(this, "musique_menu");

    this.add.image(640, 360, "fond_menu");
    const logo = this.add.image(640, 230, "logo").setScale(0.85);
    this.tweens.add({ targets: logo, scale: 0.88, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.boutons = BOUTONS.map((bouton, i) => this.add.image(330 + i * 310, 520, bouton.cle + "_sombre"));
    this.index = 1; // "Multi-joueur" présélectionné
    this.majBoutons();

    this.message = this.add.text(640, 630, "", fct.style(24, "#ffd65a")).setOrigin(0.5);
    this.add.text(640, 690, "Joystick : choisir      Bouton A : valider", fct.style(20, "#e8d8c0")).setOrigin(0.5);

    this.touches = creerTouchesDeuxJoueurs(this);
  }

  majBoutons() {
    this.boutons.forEach((image, i) => {
      const choisi = i === this.index;
      image.setTexture(BOUTONS[i].cle + (choisi ? "" : "_sombre"));
      this.tweens.killTweensOf(image);
      image.setScale(choisi ? 1.05 : 0.92).setTint(choisi ? 0xffffff : 0xb0a0a0);
      if (choisi) this.tweens.add({ targets: image, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
  }

  update() {
    if (this.enTransition) return;
    for (const touches of this.touches) {
      const appuis = fct.lireAppuis(touches);
      // joystick gauche/droite (ou haut/bas) pour changer de bouton
      const deplacement = (appuis.droite || appuis.bas ? 1 : 0) - (appuis.gauche || appuis.haut ? 1 : 0);
      if (deplacement !== 0) {
        this.index = fct.boucler(this.index + deplacement, BOUTONS.length);
        this.message.setText("");
        fct.jouerSon(this, "menu_deplacer", 0.5);
        this.majBoutons();
      }
      if (appuis.A) {
        this.valider(BOUTONS[this.index]);
        return;
      }
    }
  }

  valider(bouton) {
    if (!bouton.actif) {
      fct.jouerSon(this, "qte_rate", 0.5);
      this.message.setText("Mode solo bientôt disponible : répétitions en cours !");
      this.cameras.main.shake(120, 0.004);
      return;
    }
    fct.jouerSon(this, "menu_valider");
    if (bouton.rideau) {
      // le rideau s'ouvre sur la scène du théâtre
      fct.transitionRideau(this, "rideau_ouverture", () => this.scene.start(bouton.scene));
    } else {
      fct.changerScene(this, bouton.scene);
    }
  }
}
