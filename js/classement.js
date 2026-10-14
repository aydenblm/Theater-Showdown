import * as fct from "./fonctions.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";
import { meilleursJoueurs, trouverRang } from "./comptes.js";

/***********************************************************************/
/** CLASSEMENT ELO : les 8 meilleurs joueurs
/** Écran lancé PAR-DESSUS une autre scène (scene.launch), qui attend en pause :
/** à la fermeture, on la relance (scene.resume).
/** Donnée reçue : { retour: "connexion" }  (clé de la scène à reprendre)
/***********************************************************************/

export default class classement extends Phaser.Scene {
  constructor() {
    super({ key: "classement" });
  }

  init(donnees) {
    this.retour = donnees.retour;
  }

  create() {
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.85);
    this.add.rectangle(640, 380, 900, 560, 0x12040a, 0.95).setStrokeStyle(4, 0xf5c542);
    this.add.text(640, 130, "Classement des artistes", fct.style(44, "#ffd65a")).setOrigin(0.5);
    this.add.text(640, 668, "A / B / Start : fermer", fct.style(20, "#e8d8c0")).setOrigin(0.5);
    this.liste = this.add.text(640, 400, "Chargement...", fct.style(26, "#e8d8c0")).setOrigin(0.5);

    this.touches = creerTouchesDeuxJoueurs(this);
    this.toucheEchap = this.input.keyboard.addKey("ESC");
    this.remplirTableau();
  }

  // lit la sauvegarde puis écrit une ligne par joueur
  async remplirTableau() {
    const joueurs = await meilleursJoueurs(8);
    if (!this.scene.isActive()) return; // écran déjà fermé
    this.liste.destroy();
    if (joueurs.length === 0) {
      this.add.text(640, 400, "Aucun compte pour le moment.\nCrée le tien pour ouvrir le bal !", fct.style(28, "#e8d8c0")).setOrigin(0.5);
      return;
    }
    this.add.text(250, 195, "N°", fct.style(20, "#b8a8b0")).setOrigin(0, 0.5);
    this.add.text(330, 195, "ARTISTE", fct.style(20, "#b8a8b0")).setOrigin(0, 0.5);
    this.add.text(640, 195, "RANG", fct.style(20, "#b8a8b0")).setOrigin(0, 0.5);
    this.add.text(1030, 195, "ELO", fct.style(20, "#b8a8b0")).setOrigin(1, 0.5);
    joueurs.forEach((compte, i) => {
      const y = 245 + i * 46;
      const rang = trouverRang(compte.elo);
      this.add.text(250, y, (i + 1) + ".", fct.style(28, i === 0 ? "#ffd65a" : "#ffffff")).setOrigin(0, 0.5);
      this.add.text(330, y, compte.pseudo, fct.style(28, i === 0 ? "#ffd65a" : "#ffffff")).setOrigin(0, 0.5);
      this.add.text(640, y, rang.nom, fct.style(22, rang.couleur)).setOrigin(0, 0.5);
      this.add.text(1030, y, String(compte.elo), fct.style(28, "#ffffff")).setOrigin(1, 0.5);
    });
  }

  update() {
    let fermer = Phaser.Input.Keyboard.JustDown(this.toucheEchap);
    for (const touches of this.touches) {
      const appuis = fct.lireAppuis(touches);
      if (appuis.A || appuis.B || appuis.start) fermer = true;
    }
    if (!fermer) return;
    fct.jouerSon(this, "menu_valider");
    this.scene.resume(this.retour);
    this.scene.stop();
  }
}
