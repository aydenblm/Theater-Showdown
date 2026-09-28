import * as fct from "./fonctions.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** MENU PRINCIPAL : choix du mode de jeu
/***********************************************************************/

export default class menu extends Phaser.Scene {
  constructor() {
    super({ key: "menu" });
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(400);
    fct.jouerMusique(this, "musique_menu");

    this.add.image(640, 360, "fond_menu");

    // titre qui "respire"
    const titre1 = this.add.text(640, 130, "THEATER", fct.style(96, "#ffd65a")).setOrigin(0.5);
    const titre2 = this.add.text(640, 225, "SHOWDOWN", fct.style(96, "#ffd65a")).setOrigin(0.5);
    this.tweens.add({ targets: [titre1, titre2], scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add.text(640, 300, "Le grand duel musical", fct.style(28)).setOrigin(0.5);

    this.menu = fct.creerMenu(this, [
      { texte: "Duel 1 contre 1", actif: true, scene: "selection" },
      { texte: "Mode Histoire", actif: false },
      { texte: "Commandes", actif: true, scene: "commandes" }
    ], 640, 420, 75);

    this.message = this.add.text(640, 610, "", fct.style(24, "#ff9aa8")).setOrigin(0.5);
    this.add.text(640, 680, "Joystick : choisir      Bouton A : valider", fct.style(22, "#e8d8c0")).setOrigin(0.5);

    this.touches = creerTouchesDeuxJoueurs(this);
  }

  update() {
    const choix = fct.lireMenu(this, this.menu, this.touches);
    if (!choix || choix === "retour") return;

    if (choix.actif === false) {
      fct.jouerSon(this, "qte_rate", 0.5);
      this.message.setText("Bientôt disponible : répétitions en cours !");
      this.cameras.main.shake(120, 0.004);
      return;
    }
    fct.jouerSon(this, "menu_valider");
    fct.changerScene(this, choix.scene);
  }
}
