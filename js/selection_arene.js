import * as fct from "./fonctions.js";
import { ARENES } from "./donnees.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** CHOIX DE L'ARÈNE : n'importe quel joueur peut choisir
/***********************************************************************/

export default class selection_arene extends Phaser.Scene {
  constructor() {
    super({ key: "selection_arene" });
  }

  init(donnees) {
    this.donnees = donnees; // { j1, j2 } : identifiants des personnages choisis
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(300);
    this.add.image(640, 360, "fond_menu");
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.45);
    this.add.text(640, 70, "Choisissez la scène", fct.style(52, "#ffd65a")).setOrigin(0.5);

    // les arènes + une option "au hasard"
    this.options = [...ARENES, { id: "hasard", nom: "Au hasard", description: "Laissez faire le destin" }];
    this.cartes = this.options.map((option, i) => {
      const x = 640 + (i - 1) * 400;
      const carte = this.add.container(x, 340);
      carte.add(this.add.rectangle(0, 0, 340, 200, 0x2a0a14).setStrokeStyle(4, 0xb08030));
      if (option.vignette) {
        carte.add(this.add.image(0, 0, option.vignette).setDisplaySize(328, 188));
      } else {
        carte.add(this.add.text(0, 0, "?", fct.style(120, "#ffd65a")).setOrigin(0.5));
      }
      carte.add(this.add.text(0, 135, option.nom, fct.style(32)).setOrigin(0.5));
      carte.add(this.add.text(0, 172, option.description, fct.style(18, "#e8d8c0")).setOrigin(0.5));
      return carte;
    });

    this.index = 0;
    this.cadre = this.add.rectangle(0, 340, 356, 216).setStrokeStyle(6, 0xffd65a);
    this.add.text(640, 690, "Joystick ← → : choisir     A : valider     B : retour", fct.style(22, "#e8d8c0")).setOrigin(0.5);
    this.touches = creerTouchesDeuxJoueurs(this);
    this.majSelection();
  }

  majSelection() {
    this.cartes.forEach((carte, i) => carte.setScale(i === this.index ? 1.06 : 0.94));
    this.cadre.setX(this.cartes[this.index].x).setScale(1.06);
  }

  update() {
    for (const touches of this.touches) {
      const appuis = fct.lireAppuis(touches);
      if (appuis.gauche || appuis.droite) {
        this.index = fct.boucler(this.index + (appuis.gauche ? -1 : 1), this.options.length);
        fct.jouerSon(this, "menu_deplacer", 0.5);
        this.majSelection();
      }
      if (appuis.A) {
        let arene = this.options[this.index].id;
        if (arene === "hasard") arene = Phaser.Utils.Array.GetRandom(ARENES).id;
        fct.jouerSon(this, "menu_valider");
        fct.changerScene(this, "combat", { ...this.donnees, arene: arene, victoires: [0, 0], manche: 1 });
        return;
      }
      if (appuis.B) {
        fct.changerScene(this, "selection");
        return;
      }
    }
  }
}
