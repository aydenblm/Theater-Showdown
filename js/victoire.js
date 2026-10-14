import * as fct from "./fonctions.js";
import { trouverPerso, PERSONNAGES } from "./reglages.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";
import { enregistrerMatch, trouverRang } from "./comptes.js";

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
    this.add.image(640, 360, "fond_scene");
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.3);
    fct.jouerSon(this, "applaudissements", 0.7);

    const gagnant = this.donnees.gagnant;
    if (gagnant) {
      const perso = trouverPerso(gagnant === 1 ? this.donnees.j1 : this.donnees.j2);
      this.add.image(640, 60, "gagnant_joueur_" + gagnant);
      this.add.text(640, 122, perso.nom + " fait salle comble", fct.style(30, "#ffd65a")).setOrigin(0.5);
      const star = this.add.sprite(640, 330, perso.id).setScale(1.6 * perso.sprite.echelle).play(perso.id + "_victoire");
      this.tweens.add({ targets: star, y: 315, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.couleurs = [perso.couleur, 0xffd65a, 0xffffff];
    } else {
      this.add.text(640, 90, "Match nul !", fct.style(64, "#ffd65a")).setOrigin(0.5);
      this.add.text(640, 150, "Le public réclame une revanche", fct.style(28)).setOrigin(0.5);
      this.couleurs = PERSONNAGES.map((p) => p.couleur);
    }
    const [v1, v2] = this.donnees.victoires;
    this.add.text(640, 475, v1 + "  -  " + v2, fct.style(40)).setOrigin(0.5);
    this.afficherElo();

    // pluie de notes : un timer qui se répète (cf. tuto timers)
    this.time.addEvent({ delay: 120, loop: true, callback: this.faireTomberNote, callbackScope: this });

    this.menu = fct.creerMenu(this, [
      { texte: "Revanche", scene: "combat" },
      { texte: "Changer d'artistes", scene: "selection" },
      { texte: "Classement", scene: "classement" },
      { texte: "Menu principal", scene: "menu" }
    ], 640, 540, 46, 30);
    this.touches = creerTouchesDeuxJoueurs(this);
    // au retour du classement, on vide les appuis faits là-bas
    const relacherTouches = () => this.input.keyboard.resetKeys();
    this.events.on("resume", relacherTouches);
    this.events.once("shutdown", () => this.events.off("resume", relacherTouches));
  }

  // Si les deux joueurs sont connectés, le duel est classé : on met à jour leur ELO
  // dans la sauvegarde, puis on affiche le résultat de chaque côté de l'écran.
  async afficherElo() {
    const joueurs = this.registry.get("joueurs") || [null, null];
    if (!joueurs[0] || !joueurs[1]) {
      this.add.text(640, 508, "Duel non classé (invité)", fct.style(18, "#b8a8b0")).setOrigin(0.5);
      return;
    }
    const resultat = await enregistrerMatch(joueurs[0].pseudo, joueurs[1].pseudo, this.donnees.gagnant);
    if (!resultat || !this.scene.isActive()) return;

    joueurs.forEach((joueur, i) => {
      const x = i === 0 ? 215 : 1065;
      const gain = resultat.apres[i] - resultat.avant[i];
      const rang = trouverRang(resultat.apres[i]);
      joueur.elo = resultat.apres[i]; // pour que la revanche parte du bon ELO
      this.add.text(x, 300, joueur.pseudo, fct.style(34, i === 0 ? "#6cb8ff" : "#ff6c6c")).setOrigin(0.5);
      this.add.text(x, 350, "ELO " + resultat.avant[i] + " → " + resultat.apres[i], fct.style(26)).setOrigin(0.5);
      const texteGain = this.add.text(x, 400, (gain >= 0 ? "+" : "") + gain, fct.style(48, gain > 0 ? "#7dff9a" : gain < 0 ? "#ff8a8a" : "#e8d8c0")).setOrigin(0.5);
      this.add.text(x, 445, rang.nom, fct.style(22, rang.couleur)).setOrigin(0.5);
      this.tweens.add({ targets: texteGain, scale: { from: 0.2, to: 1 }, duration: 500, ease: "Back.easeOut" });
    });
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
    if (choix.scene === "classement") {
      // le classement s'affiche au-dessus, cet écran attend en dessous (comme le menu pause)
      this.scene.launch("classement", { retour: "victoire" });
      this.scene.bringToTop("classement");
      this.scene.pause();
      return;
    }
    if (choix.scene === "menu") {
      // retour au menu : le rideau se referme
      fct.transitionRideau(this, "rideau_fermeture", () => this.scene.start("menu"));
      return;
    }
    // revanche : mêmes personnages, même arène, scores remis à zéro
    const donnees = choix.scene === "combat" ? { j1: this.donnees.j1, j2: this.donnees.j2, arene: this.donnees.arene, victoires: [0, 0], manche: 1 } : undefined;
    fct.changerScene(this, choix.scene, donnees);
  }
}
