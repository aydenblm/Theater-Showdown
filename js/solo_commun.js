import * as fct from "./fonctions.js";
import { PERSONNAGES, ECHELLE_SOLO } from "./reglages.js";
import { creerTouches } from "./controles.js";
import { COUPS } from "./combattant.js";
import JoueurSolo from "./joueur_solo.js";
import Ennemi from "./ennemi.js";

/***********************************************************************/
/** BASE DES SCÈNES DU MODE SOLO
/** Le niveau de plateformes (solo.js) et le combat contre le boss (boss.js) partagent
/** tout ce qui est écrit ici : la carte Tiled, le joueur, les ennemis, les notes de
/** musique et les dégâts. Chaque scène "hérite" de cette classe (extends) et ne contient
/** plus que ce qui la distingue.
/**
/**   - le joueur a les attaques du mode duel ; sauter sur un ennemi l'élimine
/**   - les trompettistes lancent des notes ; le contact d'un ennemi fait mal
/**   - plus de points de vie : K.O., puis la scène recommence
/**   - bouton Start ou Échap : retour au menu
/** La vie et la jauge sont affichées par la scène "hud_solo", lancée par-dessus.
/***********************************************************************/

const MARGE_ECRASEMENT = 4; // px de tolérance sur la position des pieds à la frame précédente
const DUREE_SPECIALE = 700; // ms pendant lesquelles le joueur joue sa musique
const DELAI_RECOMMENCER = 2200; // ms entre le K.O. et le redémarrage

// contact avec un ennemi (les notes des trompettes utilisent COUPS.note, comme en duel)
const COUP_CONTACT = { degats: 10, recul: 260, reculY: 320, etourdissement: 350 };
// notes des trompettistes : vitesse (px/s), taille, couleur, durée de vie (ms)
const NOTE_ENNEMI = { vitesse: 220, echelle: 0.4, couleur: 0xffd65a, duree: 3000 };

export default class SceneSolo extends Phaser.Scene {
  /*********************************************************************/
  /** MISE EN PLACE (appelée au début de create() par chaque scène)
  /*********************************************************************/
  // Prépare la carte, la musique, les groupes d'ennemis et de notes, et renvoie la carte Tiled.
  preparerSolo(cleCarte, cleMusique) {
    this.enTransition = false;
    this.partieFinie = false;
    this.cameras.main.fadeIn(400);
    fct.jouerMusique(this, cleMusique);

    // carte Tiled : tous les calques de tuiles sont affichés dans l'ordre de Tiled
    // (le "depth" d'un calque est son numéro : un objet de depth 1,5 passe devant le 2e calque et derrière le 3e)
    const carte = this.make.tilemap({ key: cleCarte });
    const tileset = carte.addTilesetImage(carte.tilesets[0].name, "tileset_theatre");
    carte.layers.forEach((donnees, numero) => {
      const calque = carte.createLayer(donnees.name, tileset).setDepth(numero);
      // le calque de collision s'appelle "Calque_de_tuiles_1" (ou "calque_de_tuiles_1") dans Tiled
      if (donnees.name.toLowerCase() === "calque_de_tuiles_1") this.calqueSol = calque;
    });
    this.calqueSol.setCollisionByProperty({ estSolide: true });
    this.physics.world.setBounds(0, 0, carte.widthInPixels, carte.heightInPixels);

    // ennemis et notes de musique : celles du joueur et celles des ennemis
    this.ennemis = this.add.group({ runChildUpdate: true });
    this.notesJoueur = this.physics.add.group({ allowGravity: false });
    this.notesEnnemis = this.physics.add.group({ allowGravity: false });
    // les ennemis volants (la croche) passent à travers le décor
    this.physics.add.collider(this.ennemis, this.calqueSol, null, (ennemi) => !ennemi.volant);
    this.physics.add.collider([this.notesJoueur, this.notesEnnemis], this.calqueSol, (note) => this.dissiper(note));
    this.physics.add.overlap(this.notesJoueur, this.ennemis, this.noteSurEnnemi, null, this);
    this.physics.add.overlap(this.notesJoueur, this.notesEnnemis, this.chocDeNotes, null, this);
    // une note qui sort de la carte disparaît
    this.physics.world.on("worldbounds", (corps) => {
      const objet = corps.gameObject;
      if (this.notesJoueur.contains(objet) || this.notesEnnemis.contains(objet)) this.detruire(objet);
    });

    this.toucheEchap = this.input.keyboard.addKey("ESC");
    return carte;
  }

  // le joueur 1 joue Doremi ; (x, y) = position des pieds
  creerJoueur(x, y) {
    this.joueur = new JoueurSolo(this, x, y, PERSONNAGES[0], creerTouches(this, 1));
    this.physics.add.collider(this.joueur, this.calqueSol);
    this.physics.add.overlap(this.joueur, this.ennemis, this.contact, null, this);
    this.physics.add.overlap(this.joueur, this.notesEnnemis, this.noteSurJoueur, null, this);
  }

  // ajoute un ennemi à la scène ; donnees = une entrée de ENNEMIS_SOLO, (x, y) = ses pieds
  creerEnnemi(donnees, x, y) {
    const ennemi = new Ennemi(this, x, y, donnees, this.calqueSol);
    this.ennemis.add(ennemi);
    return ennemi;
  }

  // interface (sans zoom) dans une scène à part, arrêtée en même temps que celle-ci
  lancerHUD(donnees) {
    this.scene.launch("hud_solo", donnees);
    this.events.once("shutdown", () => this.scene.stop("hud_solo"));
  }

  update() {
    if (this.enTransition) return;
    // à lire AVANT joueur.gerer(), qui "consomme" les appuis de toutes les touches
    if (Phaser.Input.Keyboard.JustDown(this.toucheEchap) || Phaser.Input.Keyboard.JustDown(this.joueur.touches.start)) {
      fct.jouerSon(this, "menu_valider");
      fct.changerScene(this, "menu");
      return;
    }
    this.joueur.gerer(this.time.now); // même horloge que les délais (tir, esquive, étourdissement)
  }

  /*********************************************************************/
  /** CONTACTS
  /*********************************************************************/
  // joueur contre ennemi : par-dessus en tombant, on l'écrase ; sinon on est touché
  contact(joueur, ennemi) {
    if (!ennemi.actif || joueur.invincible || joueur.etat === "ko" || joueur.etat === "esquive") return;
    // on regarde où étaient les pieds à la frame précédente : la vitesse de chute ne compte pas
    const piedsAvant = joueur.body.prev.y + joueur.body.height;
    if (joueur.body.velocity.y > 0 && piedsAvant <= ennemi.body.top + MARGE_ECRASEMENT) {
      ennemi.eliminer();
      joueur.rebondir();
    } else {
      joueur.subirAttaque(COUP_CONTACT, joueur.x < ennemi.x ? -1 : 1);
    }
  }

  noteSurEnnemi(a, b) {
    // Phaser inverse l'ordre des arguments entre un groupe physique et un groupe simple :
    // on retrouve donc la note d'après son groupe
    const [note, ennemi] = this.notesJoueur.contains(a) ? [a, b] : [b, a];
    if (!ennemi.actif) return;
    this.dissiper(note);
    note.tireur.toucherEnnemi(ennemi, COUPS.note);
  }

  noteSurJoueur(joueur, note) {
    if (joueur.invincible || joueur.etat === "ko") return;
    const sens = note.body.velocity.x > 0 ? 1 : -1;
    this.dissiper(note);
    joueur.subirAttaque(note.coup || COUPS.note, sens);
  }

  // une note du joueur et une note ennemie qui se rencontrent s'annulent
  chocDeNotes(noteJoueur, noteEnnemi) {
    fct.etincelles(this, noteJoueur.x, noteJoueur.y, 0xffffff, 4);
    this.dissiper(noteJoueur);
    this.dissiper(noteEnnemi);
  }

  /*********************************************************************/
  /** PROJECTILES
  /*********************************************************************/
  // note du joueur (appelée par Combattant.tirer) : même projectile qu'en duel, réduit
  creerNote(tireur) {
    const cle = tireur.perso.projectile || "note_projectile";
    const note = this.notesJoueur.create(tireur.x + tireur.sens * 55 * ECHELLE_SOLO, tireur.y - 30 * ECHELLE_SOLO, cle);
    note.tireur = tireur;
    note.setScale(ECHELLE_SOLO).setFlipX(tireur.sens < 0).setDepth(12);
    if (tireur.perso.projectile) {
      note.play(cle + "_vol");
      note.body.setSize(36, 46);
    } else {
      note.setTint(tireur.perso.couleur);
    }
    note.setVelocityX(tireur.sens * tireur.perso.vitesseNote);
    this.preparerNote(note);
    fct.jouerSon(this, "tir", 0.5);
  }

  // note d'un trompettiste (appelée par Ennemi.tirer), lancée depuis le pavillon de la trompette
  creerNoteEnnemi(ennemi) {
    const x = ennemi.x + ennemi.sens * ennemi.displayWidth * 0.4;
    const y = ennemi.y - ennemi.displayHeight * 0.25;
    this.lancerNoteEnnemi(x, y, ennemi.sens * NOTE_ENNEMI.vitesse, 0, NOTE_ENNEMI.echelle, NOTE_ENNEMI.duree);
    fct.jouerSon(this, "tir", 0.3);
  }

  // Une note ennemie qui part de (x, y) à la vitesse (vx, vy). Le boss s'en sert aussi.
  // coup : dégâts infligés au joueur (par défaut COUPS.note)
  lancerNoteEnnemi(x, y, vx, vy, echelle, duree, coup) {
    const note = this.notesEnnemis.create(x, y, "note_projectile");
    note.setScale(echelle).setTint(NOTE_ENNEMI.couleur).setFlipX(vx < 0).setDepth(12);
    note.setVelocity(vx, vy);
    note.coup = coup;
    this.tweens.add({ targets: note, angle: { from: -15, to: 15 }, duration: 140, yoyo: true, repeat: -1 });
    this.preparerNote(note);
    this.time.delayedCall(duree, () => {
      if (note.active) this.detruire(note);
    });
    return note;
  }

  preparerNote(note) {
    note.setCollideWorldBounds(true);
    note.body.onWorldBounds = true;
  }

  // détruit un projectile ; celui du joueur joue sa dissipation à sa place
  dissiper(note) {
    if (!note.active) return;
    const cle = note.tireur && note.tireur.perso.projectile;
    if (cle) {
      const effet = this.add.sprite(note.x, note.y, cle).setScale(note.scaleX).setFlipX(note.flipX).setDepth(12).play(cle + "_impact");
      effet.once("animationcomplete", () => effet.destroy());
    }
    this.detruire(note);
  }

  // détruit un objet en arrêtant ses tweens (sinon ils tourneraient à vide)
  detruire(objet) {
    this.tweens.killTweensOf(objet);
    objet.destroy();
  }

  /*********************************************************************/
  /** ATTAQUE SPÉCIALE ET FIN DE PARTIE
  /*********************************************************************/
  // Spéciale (appelée par le joueur quand sa jauge est pleine) : en solo, pas d'adversaire
  // pour le QTE du duel ; la musique du personnage envoie une salve de notes qui élimine
  // tous les ennemis visibles à l'écran.
  lancerSpecial(joueur) {
    joueur.energie = 0;
    joueur.changerEtat("attaque", DUREE_SPECIALE);
    joueur.anims.play(joueur.perso.id + "_tir");
    joueur.annoncer(joueur.perso.special, fct.couleurTexte(joueur.perso.couleur), 140, 30);
    this.sound.play("special_" + joueur.perso.id, { volume: 0.8 });
    this.cameras.main.flash(200, 255, 240, 200);

    const vue = this.cameras.main.worldView;
    const cibles = this.ennemis.getChildren().filter((ennemi) => ennemi.actif && vue.contains(ennemi.x, ennemi.y));
    const cle = joueur.perso.projectile;
    cibles.forEach((ennemi, i) => {
      const note = cle
        ? this.add.sprite(joueur.x, joueur.y, cle).play(cle + "_vol")
        : this.add.image(joueur.x, joueur.y, "note_projectile").setTint(joueur.perso.couleur);
      note.setScale(ECHELLE_SOLO * 1.6).setDepth(13);
      this.tweens.add({
        targets: note,
        x: ennemi.x,
        y: ennemi.y,
        angle: 360,
        delay: i * 90,
        duration: 450,
        ease: "Cubic.easeIn",
        onComplete: () => {
          note.destroy();
          if (ennemi.actif) ennemi.eliminer();
        }
      });
    });
    this.apresSpecial();
  }

  // appelée quand le joueur appuie sur A (début d'une parade) ; le boss s'en sert pour l'effet visuel
  surParade() {}

  // à redéfinir dans une scène fille si la spéciale doit faire autre chose (le boss efface ses projectiles)
  apresSpecial() {}

  // le joueur n'a plus de points de vie : K.O., puis la scène recommence
  defaite() {
    if (this.partieFinie) return;
    this.partieFinie = true;
    this.joueur.changerEtat("ko");
    this.joueur.setAccelerationX(0);
    fct.jouerSon(this, "ko");
    this.scene.get("hud_solo").afficherKO();
    this.time.delayedCall(DELAI_RECOMMENCER, () => this.scene.restart());
  }
}
