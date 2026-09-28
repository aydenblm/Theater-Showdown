import * as fct from "./fonctions.js";
import { trouverPerso, PERSONNAGES } from "./donnees.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** ÉCRAN DE VICTOIRE : salut final, applaudissements et pluie de notes
/***********************************************************************/

export default class victoire extends Phaser.Scene {
  constructor() {
    super({ key: "victoire" });
  }

  init(donnees) {
    this.donnees = donnees; // { j1, j2, arene, victoires, gagnant (0 = égalité) }
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(400);
    this.add.image(640, 360, "fond_menu");
    fct.jouerSon(this, "applaudissements", 0.7);

    const gagnant = this.donnees.gagnant;
    if (gagnant) {
      const perso = trouverPerso(gagnant === 1 ? this.donnees.j1 : this.donnees.j2);
      const couleurJoueur = gagnant === 1 ? "#6cb8ff" : "#ff6c6c";
      this.add.text(640, 60, "Joueur " + gagnant + " triomphe !", fct.style(56, couleurJoueur)).setOrigin(0.5);
      this.add.text(640, 120, perso.nom + " fait salle comble", fct.style(30, "#ffd65a")).setOrigin(0.5);
      const star = this.add.sprite(640, 330, perso.id).setScale(1.6).play(perso.id + "_victoire");
      this.tweens.add({ targets: star, y: 315, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.couleurs = [perso.couleur, 0xffd65a, 0xffffff];
    } else {
      this.add.text(640, 90, "Match nul !", fct.style(64, "#ffd65a")).setOrigin(0.5);
      this.add.text(640, 150, "Le public réclame une revanche", fct.style(28)).setOrigin(0.5);
      this.couleurs = PERSONNAGES.map((p) => p.couleur);
    }
    const [v1, v2] = this.donnees.victoires;
    this.add.text(640, 500, v1 + "  -  " + v2, fct.style(40)).setOrigin(0.5);

    // pluie de notes : un timer qui se répète (cf. tuto timers)
    this.time.addEvent({ delay: 120, loop: true, callback: this.faireTomberNote, callbackScope: this });

    this.menu = fct.creerMenu(this, [
      { texte: "Revanche", scene: "combat" },
      { texte: "Changer d'artistes", scene: "selection" },
      { texte: "Menu principal", scene: "menu" }
    ], 640, 565, 52);
    this.menu.textes.forEach((t) => t.setFontSize(32));
    this.touches = creerTouchesDeuxJoueurs(this);
  }

  faireTomberNote() {
    const note = this.add.image(Phaser.Math.Between(20, 1260), -30, "note_hud").setTint(Phaser.Utils.Array.GetRandom(this.couleurs));
    this.tweens.add({
      targets: note,
      y: 760,
      angle: Phaser.Math.Between(-180, 180),
      duration: Phaser.Math.Between(2500, 4000),
      onComplete: () => note.destroy()
    });
  }

  update() {
    const choix = fct.lireMenu(this, this.menu, this.touches);
    if (!choix || choix === "retour") return;
    fct.jouerSon(this, "menu_valider");
    // revanche : mêmes personnages, même arène, scores remis à zéro
    const donnees = choix.scene === "combat" ? { j1: this.donnees.j1, j2: this.donnees.j2, arene: this.donnees.arene, victoires: [0, 0], manche: 1 } : undefined;
    fct.changerScene(this, choix.scene, donnees);
  }
}
