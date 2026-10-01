import * as fct from "./fonctions.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** ÉCRAN DES COMMANDES ET DES RÈGLES
/***********************************************************************/

const LIGNES = [
  ["Joystick", "Se déplacer   ↑ Sauter   ↓ Garde"],
  ["A", "Attaque rapide"],
  ["B", "Attaque puissante (coup de pied)"],
  ["C", "Lancer une note de musique"],
  ["D", "Attaque spéciale (jauge pleine)"],
  ["E", "Esquive (invincible un court instant)"],
  ["F", "Pause (Échap au clavier)"]
];

export default class commandes extends Phaser.Scene {
  constructor() {
    super({ key: "commandes" });
  }

  // depuisPause : écran ouvert depuis le menu pause (on y retourne au lieu du menu principal)
  init(donnees) {
    this.depuisPause = donnees && donnees.depuisPause === true;
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(300);
    this.add.image(640, 360, "fond_menu");
    this.add.rectangle(640, 375, 1180, 640, 0x12040a, 0.82).setStrokeStyle(3, 0xf5c542);

    this.add.text(640, 50, "Commandes", fct.style(56, "#ffd65a")).setOrigin(0.5);

    // tableau des boutons (identique pour les deux joueurs)
    LIGNES.forEach(([bouton, action], i) => {
      const y = 120 + i * 42;
      this.add.circle(190, y, 18, bouton === "Joystick" ? 0x444444 : 0xb0283c).setStrokeStyle(2, 0xffffff);
      this.add.text(190, y, bouton === "Joystick" ? "✥" : bouton, fct.style(20)).setOrigin(0.5);
      this.add.text(230, y, action, fct.style(24)).setOrigin(0, 0.5);
    });
    this.add.text(870, 125, "Joueur 1 : joystick + boutons noirs", fct.style(20, "#6cb8ff")).setOrigin(0.5);
    this.add.text(870, 160, "Joueur 2 : joystick + boutons rouges", fct.style(20, "#ff6c6c")).setOrigin(0.5);
    this.add.text(870, 200, "(clavier J1 : flèches + I O P K L M)\n(clavier J2 : Z Q S D + R T Y F G H)", fct.style(16, "#a89a90")).setOrigin(0.5);

    // règles
    const regles = [
      "• Videz la barre de vie adverse : 2 manches gagnantes remportent le duel.",
      "• Chaque coup porté remplit votre jauge de 5 notes. Enchaînez vite pour des combos !",
      "• Jauge pleine : bouton D. Un duel de rythme s'engage : l'attaquant tape la",
      "  séquence pour frapper fort, le défenseur tape la sienne pour se protéger."
    ];
    this.add.text(110, 420, regles.join("\n"), { ...fct.style(21), align: "left", lineSpacing: 6 });

    // objets
    const objets = [
      ["objet_rose", "Rose : +15 PV"],
      ["objet_partition", "Partition : +2 notes"],
      ["objet_metronome", "Métronome : vitesse"],
      ["objet_baguette", "Baguette : force"]
    ];
    objets.forEach(([cle, texte], i) => {
      const x = 170 + i * 270;
      this.add.image(x, 600, cle);
      this.add.text(x + 32, 600, texte, fct.style(19)).setOrigin(0, 0.5);
    });

    const retour = this.depuisPause ? "retour à la pause" : "retour au menu";
    this.add.text(640, 668, "Bouton A ou B : " + retour, fct.style(22, "#e8d8c0")).setOrigin(0.5);
    this.touches = creerTouchesDeuxJoueurs(this);
  }

  update() {
    for (const touches of this.touches) {
      const appuis = fct.lireAppuis(touches);
      if (appuis.A || appuis.B) {
        fct.jouerSon(this, "menu_valider");
        if (this.depuisPause) {
          this.scene.resume("pause");
          this.scene.stop();
        } else {
          fct.changerScene(this, "menu");
        }
        return;
      }
    }
  }
}
