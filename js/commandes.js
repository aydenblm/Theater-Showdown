import * as fct from "./fonctions.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** ÉCRAN DES COMMANDES
/** Une seule image plein écran (1280x720) récapitule les contrôles,
/** identiques pour les deux joueurs. Flèche en bas à gauche : retour au menu.
/***********************************************************************/

export default class commandes extends Phaser.Scene {
  constructor() {
    super({ key: "commandes" });
  }

  // depuisPause : écran ouvert depuis le menu pause (on y retourne au lieu du menu principal)
  init(donnees) {
    this.depuisPause = donnees !== undefined && donnees.depuisPause === true;
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(300);

    this.add.image(640, 360, "page_commandes");

    // flèche de retour : bouton B (ou A) sur la borne, clic à la souris sur PC
    const fleche = this.add.image(58, 666, "fleche_retour").setScale(0.75).setInteractive({ useHandCursor: true });
    fleche.on("pointerdown", () => this.retourMenu());

    // légère pulsation pour signaler l'action (cf. tuto tweens)
    this.tweens.add({ targets: fleche, scale: 0.82, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.touches = creerTouchesDeuxJoueurs(this);
  }

  retourMenu() {
    if (this.enTransition) return;
    fct.jouerSon(this, "menu_valider");
    if (this.depuisPause) {
      this.scene.resume("pause");
      this.scene.stop();
    } else {
      fct.changerScene(this, "menu");
    }
  }

  update() {
    for (const touches of this.touches) {
      const appuis = fct.lireAppuis(touches);
      if (appuis.A || appuis.B) this.retourMenu();
    }
  }
}
