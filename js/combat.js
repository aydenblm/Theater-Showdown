import * as fct from "./fonctions.js";
import { trouverPerso, trouverArene, OBJETS } from "./donnees.js";
import { creerTouches } from "./controles.js";
import Combattant, { PV_MAX, ENERGIE_MAX, COUPS } from "./combattant.js";

/***********************************************************************/
/** SCÈNE DE COMBAT (1 contre 1)
/** Données reçues : { j1, j2, arene, victoires: [v1, v2], manche }
/** Une manche se termine par K.O. ou à la fin du chrono ;
/** on relance alors la scène (scene.restart) pour la manche suivante.
/***********************************************************************/

const SOL_Y = 620; // hauteur du sol
const DUREE_MANCHE = 60; // secondes
const MANCHES_GAGNANTES = 2;
const MANCHES_MAX = 5; // sécurité en cas d'égalités à répétition

// QTE de l'attaque spéciale
const SYMBOLES_QTE = [
  { touche: "gauche", texte: "←" },
  { touche: "droite", texte: "→" },
  { touche: "haut", texte: "↑" },
  { touche: "bas", texte: "↓" },
  { touche: "A", texte: "A" },
  { touche: "B", texte: "B" },
  { touche: "C", texte: "C" }
];
const LONGUEUR_QTE = 4;
const DUREE_QTE = 3500;

// notes jouées par les touches du piano géant (gamme de do majeur)
const GAMME = [0, 2, 4, 5, 7, 9, 11];

export default class combat extends Phaser.Scene {
  constructor() {
    super({ key: "combat" });
  }

  init(donnees) {
    this.donnees = donnees;
    this.combatFige = true; // commandes bloquées (intro, spéciale, fin de manche)
    this.mancheTerminee = false;
    this.tempsRestant = DUREE_MANCHE;
    this.qte = null;
    this.enTransition = false;
  }

  create() {
    this.cameras.main.fadeIn(300);
    this.physics.world.setBounds(0, 0, 1280, 720);
    const arene = trouverArene(this.donnees.arene);
    fct.jouerMusique(this, arene.musique, 0.4);

    // groupes communs aux deux arènes
    this.solides = []; // sol : on ne peut pas le traverser
    this.groupe_plateformes = this.physics.add.group({ allowGravity: false, immovable: true });
    if (arene.id === "piano") this.construirePiano();
    else this.construireOpera();

    // les deux combattants
    this.j1 = new Combattant(this, 320, 460, trouverPerso(this.donnees.j1), 1, creerTouches(this, 1));
    this.j2 = new Combattant(this, 960, 460, trouverPerso(this.donnees.j2), 2, creerTouches(this, 2));
    this.j1.adversaire = this.j2;
    this.j2.adversaire = this.j1;
    this.j2.setFlipX(true);
    this.combattants = [this.j1, this.j2];

    this.physics.add.collider(this.combattants, this.solides, this.surLeSol, null, this);
    // plateformes traversables par le dessous
    this.physics.add.collider(this.combattants, this.groupe_plateformes, null, this.traverserParDessous, this);

    // notes de musique lancées (projectiles)
    this.groupe_notes = this.physics.add.group({ allowGravity: false });
    this.combattants.forEach((c) => this.physics.add.overlap(c, this.groupe_notes, this.toucherParNote, null, this));
    this.physics.add.overlap(this.groupe_notes, this.groupe_notes, this.chocDeNotes, null, this);
    // une note qui touche le bord de l'écran disparaît
    this.physics.world.on("worldbounds", (corps) => {
      if (this.groupe_notes.contains(corps.gameObject)) this.detruire(corps.gameObject);
    });

    // objets bonus qui tombent du ciel
    this.groupe_objets = this.physics.add.group();
    this.physics.add.collider(this.groupe_objets, this.solides);
    this.physics.add.collider(this.groupe_objets, this.groupe_plateformes);
    this.combattants.forEach((c) => this.physics.add.overlap(c, this.groupe_objets, this.ramasser, null, this));

    this.creerHUD();
    this.lancerIntro();

    // pause : Échap au clavier, ou bouton F d'un des deux joueurs sur la borne
    this.toucheEchap = this.input.keyboard.addKey("ESC");
    // pendant la pause, la scène ne reçoit plus le clavier : au retour on "relâche" toutes
    // les touches, sinon une touche lâchée pendant la pause resterait enfoncée
    // (on retire l'écouteur à la fermeture, car la scène est relancée à chaque manche)
    const relacherTouches = () => this.input.keyboard.resetKeys();
    this.events.on("resume", relacherTouches);
    this.events.once("shutdown", () => this.events.off("resume", relacherTouches));
  }

  update(temps) {
    if (this.demandePause()) {
      this.ouvrirPause();
      return;
    }
    if (this.qte) {
      this.gererQTE();
    } else {
      this.j1.gerer(temps);
      this.j2.gerer(temps);
      this.separerCombattants();
    }
    this.dessinerHUD(temps);
  }

  // à lire AVANT combattant.gerer(), qui "consomme" les appuis du bouton F
  demandePause() {
    if (this.enTransition) return false;
    return Phaser.Input.Keyboard.JustDown(this.toucheEchap) ||
      Phaser.Input.Keyboard.JustDown(this.j1.touches.F) ||
      Phaser.Input.Keyboard.JustDown(this.j2.touches.F);
  }

  ouvrirPause() {
    this.sound.pauseAll(); // musique et attaque spéciale en cours
    fct.jouerSon(this, "menu_valider");
    this.scene.launch("pause", this.donnees);
    this.scene.pause();
  }

  // les combattants ne peuvent pas se traverser (sauf en sautant par-dessus)
  separerCombattants() {
    const ecartMin = 46;
    const dx = this.j2.x - this.j1.x;
    if (Math.abs(dx) >= ecartMin || Math.abs(this.j1.y - this.j2.y) > 100) return;
    const sens = dx !== 0 ? Math.sign(dx) : this.j1.sens;
    const poussee = (ecartMin - Math.abs(dx)) / 2;
    this.j1.x -= sens * poussee;
    this.j2.x += sens * poussee;
  }

  /*********************************************************************/
  /** ARÈNES
  /*********************************************************************/
  construireOpera() {
    this.add.image(640, 360, "fond_opera");
    // sol invisible (la scène en bois est dessinée dans le décor)
    const sol = this.add.zone(640, SOL_Y + 50, 1280, 100);
    this.physics.add.existing(sol, true);
    this.solides.push(sol);

    // deux balcons fixes
    [200, 1080].forEach((x) => this.creerPlateforme(x, 470, "balcon", 14));

    // le lustre monte et descend grâce à un tween
    const lustre = this.creerPlateforme(640, 250, "lustre", 14);
    this.tweens.add({ targets: lustre, y: 330, duration: 2600, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
  }

  construirePiano() {
    this.add.image(640, 360, "fond_piano");
    // le sol est fait de 16 touches blanches : chacune joue sa note quand on marche dessus
    this.touches_piano = this.physics.add.staticGroup();
    for (let i = 0; i < 16; i++) {
      const touche = this.touches_piano.create(40 + i * 80, SOL_Y + 50, "touche_blanche");
      touche.numero = i;
    }
    this.solides.push(this.touches_piano);

    // deux touches noires flottantes qui montent et descendent en alternance
    const noire1 = this.creerPlateforme(260, 470, "touche_noire", 16);
    const noire2 = this.creerPlateforme(1020, 390, "touche_noire", 16);
    this.tweens.add({ targets: noire1, y: 390, duration: 2200, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
    this.tweens.add({ targets: noire2, y: 470, duration: 2200, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
    this.creerPlateforme(640, 290, "pupitre", 16);
  }

  // plateforme dont seule la bande du haut (épaisseur "hauteurCorps") est solide
  creerPlateforme(x, y, cle, hauteurCorps) {
    const plateforme = this.groupe_plateformes.create(x, y, cle);
    plateforme.body.setSize(plateforme.width, hauteurCorps, false).setOffset(0, 0);
    plateforme.setDepth(5);
    return plateforme;
  }

  // processCallback : on ne collisionne que si le combattant arrive par le dessus
  traverserParDessous(combattant, plateforme) {
    return combattant.body.velocity.y >= 0 && combattant.body.bottom <= plateforme.body.top + 16;
  }

  // appelée à chaque collision avec le sol : sur le piano, la touche foulée joue sa note
  surLeSol(combattant, touche) {
    if (touche.numero === undefined) return;
    if (Math.abs(combattant.x - touche.x) > 40) return; // seulement la touche sous les pieds
    if (combattant.derniereTouchePiano === touche) return;
    combattant.derniereTouchePiano = touche;
    const demiTons = GAMME[touche.numero % 7] + 12 * Math.floor(touche.numero / 7);
    this.sound.play("note_piano", { volume: 0.35, rate: Math.pow(2, demiTons / 12) });
    // la touche s'enfonce (seulement l'image, le corps physique statique ne bouge pas)
    this.tweens.killTweensOf(touche);
    touche.y = SOL_Y + 50;
    this.tweens.add({ targets: touche, y: SOL_Y + 57, duration: 70, yoyo: true });
  }

  /*********************************************************************/
  /** PROJECTILES ET OBJETS
  /*********************************************************************/
  creerNote(tireur) {
    const note = this.groupe_notes.create(tireur.x + tireur.sens * 55, tireur.y - 30, "note_projectile");
    note.tireur = tireur;
    note.setTint(tireur.perso.couleur).setFlipX(tireur.sens < 0).setDepth(12);
    note.setVelocityX(tireur.sens * tireur.perso.vitesseNote);
    note.setCollideWorldBounds(true);
    note.body.onWorldBounds = true;
    this.tweens.add({ targets: note, angle: { from: -15, to: 15 }, duration: 140, yoyo: true, repeat: -1 });
    fct.jouerSon(this, "tir", 0.5);
  }

  toucherParNote(combattant, note) {
    if (note.tireur === combattant) return;
    const sens = note.body.velocity.x > 0 ? 1 : -1;
    this.detruire(note);
    combattant.recevoirCoup(note.tireur, COUPS.note, sens);
  }

  // deux notes adverses qui se rencontrent s'annulent
  chocDeNotes(note1, note2) {
    if (note1.tireur === note2.tireur) return;
    fct.etincelles(this, (note1.x + note2.x) / 2, note1.y, 0xffffff, 5);
    this.detruire(note1);
    this.detruire(note2);
  }

  // détruit un objet en arrêtant ses tweens (sinon ils tourneraient à vide)
  detruire(objet) {
    this.tweens.killTweensOf(objet);
    objet.destroy();
  }

  // un objet apparaît à un endroit et après un délai aléatoires
  planifierObjet() {
    this.time.delayedCall(Phaser.Math.Between(6000, 11000), () => {
      if (this.mancheTerminee) return;
      if (!this.combatFige) this.faireApparaitreObjet();
      this.planifierObjet();
    });
  }

  faireApparaitreObjet() {
    const definition = fct.tirageAuSort(OBJETS);
    const objet = this.groupe_objets.create(Phaser.Math.Between(120, 1160), -30, definition.cle);
    objet.definition = definition;
    objet.setBounce(0.3).setDepth(8);
    this.tweens.add({ targets: objet, scale: { from: 0.9, to: 1.15 }, duration: 400, yoyo: true, repeat: -1 });
    // clignote puis disparaît s'il n'est pas ramassé
    this.tweens.add({ targets: objet, alpha: 0.2, duration: 150, yoyo: true, repeat: -1, delay: 7000 });
    this.time.delayedCall(10000, () => {
      if (objet.active) this.detruire(objet);
    });
  }

  ramasser(combattant, objet) {
    if (this.combatFige) return;
    combattant.ramasserObjet(objet.definition);
    this.detruire(objet);
  }

  /*********************************************************************/
  /** DÉROULEMENT D'UNE MANCHE
  /*********************************************************************/
  lancerIntro() {
    const texte = this.add.text(640, 300, "Manche " + this.donnees.manche, fct.style(80, "#ffd65a")).setOrigin(0.5).setDepth(200).setScale(0);
    fct.jouerSon(this, "gong", 0.6);
    this.tweens.add({ targets: texte, scale: 1, duration: 400, ease: "Back.easeOut" });

    this.time.delayedCall(1300, () => {
      texte.setText("En scène !");
      this.combatFige = false;
      // chrono de la manche : un événement par seconde
      this.timerManche = this.time.addEvent({ delay: 1000, loop: true, callback: this.tic, callbackScope: this });
      this.planifierObjet();
    });
    this.time.delayedCall(2100, () => {
      this.tweens.add({ targets: texte, alpha: 0, scale: 1.5, duration: 300, onComplete: () => texte.destroy() });
    });
  }

  tic() {
    this.tempsRestant--;
    this.texteChrono.setText(this.tempsRestant);
    if (this.tempsRestant <= 10) {
      this.texteChrono.setColor("#ff6c6c");
      this.tweens.add({ targets: this.texteChrono, scale: { from: 1.3, to: 1 }, duration: 250 });
    }
    if (this.tempsRestant <= 0) {
      const ecart = this.j1.pv - this.j2.pv;
      this.finDeManche(ecart > 0 ? this.j1 : ecart < 0 ? this.j2 : null);
    }
  }

  // vainqueur = null en cas d'égalité au chrono
  finDeManche(vainqueur) {
    if (this.mancheTerminee) return;
    this.mancheTerminee = true;
    this.combatFige = true;
    if (this.timerManche) this.timerManche.remove();

    const perdant = vainqueur ? vainqueur.adversaire : null;
    let annonce = "Rideau !";
    if (perdant && perdant.pv === 0) {
      annonce = "K.O. !";
      perdant.changerEtat("ko");
      fct.jouerSon(this, "ko", 0.8);
      this.cameras.main.flash(200, 255, 255, 255);
    } else {
      fct.jouerSon(this, "gong", 0.6);
    }
    if (vainqueur) this.donnees.victoires[vainqueur.numero - 1]++;

    const texte = this.add.text(640, 280, annonce, fct.style(110, "#ffd65a")).setOrigin(0.5).setDepth(200).setScale(3).setAlpha(0);
    this.tweens.add({ targets: texte, scale: 1, alpha: 1, duration: 350, ease: "Cubic.easeOut" });

    this.time.delayedCall(1400, () => {
      if (vainqueur) {
        vainqueur.changerEtat("victoire");
        texte.setText(vainqueur.perso.nom + "\nremporte la manche !").setFontSize(56);
      } else {
        texte.setText("Égalité !");
      }
    });

    this.time.delayedCall(3600, () => {
      const [v1, v2] = this.donnees.victoires;
      if (v1 >= MANCHES_GAGNANTES || v2 >= MANCHES_GAGNANTES || this.donnees.manche >= MANCHES_MAX) {
        fct.arreterMusique(this);
        const gagnant = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
        fct.changerScene(this, "victoire", { ...this.donnees, gagnant: gagnant });
      } else {
        this.scene.restart({ ...this.donnees, manche: this.donnees.manche + 1 });
      }
    });
  }

  /*********************************************************************/
  /** ATTAQUE SPÉCIALE + QTE
  /** L'attaquant ET le défenseur reçoivent chacun une séquence de 4 touches.
  /** Chaque réussite de l'attaquant augmente les dégâts,
  /** chaque réussite du défenseur les diminue.
  /*********************************************************************/
  lancerSpecial(attaquant) {
    if (this.combatFige) return;
    this.combatFige = true;
    this.physics.pause();
    this.timerManche.paused = true;
    attaquant.energie = 0;
    const defenseur = attaquant.adversaire;
    const perso = attaquant.perso;

    const elements = []; // tout ce qu'il faudra détruire à la fin
    elements.push(this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setDepth(50));
    elements.push(this.add.text(640, 140, perso.special, fct.style(54, fct.couleurTexte(perso.couleur))).setOrigin(0.5).setDepth(61));
    elements.push(this.add.text(640, 195, "d'après " + perso.compositeur, fct.style(24, "#e8d8c0")).setOrigin(0.5).setDepth(61));
    attaquant.setDepth(60);
    defenseur.setDepth(60);
    attaquant.anims.play(perso.id + "_tir");
    defenseur.anims.play(defenseur.perso.id + "_garde");
    this.sound.play("special_" + perso.id, { volume: 0.8 });

    const barreTemps = this.add.rectangle(640, 250, 600, 10, 0xffd65a).setDepth(61);
    elements.push(barreTemps);

    this.qte = {
      attaquant: attaquant,
      defenseur: defenseur,
      elements: elements,
      barreTemps: barreTemps,
      debut: this.time.now,
      resolu: false,
      sequences: [this.creerSequence(attaquant, "ATTAQUE", elements), this.creerSequence(defenseur, "DÉFENSE", elements)]
    };
    this.qte.timer = this.time.delayedCall(DUREE_QTE, () => this.resoudreSpecial());
  }

  // séquence de touches aléatoires affichée du côté de l'écran du joueur
  creerSequence(combattant, role, elements) {
    const x = combattant.numero === 1 ? 320 : 960;
    const couleurRole = role === "ATTAQUE" ? "#ffd65a" : "#9fd8ff";
    elements.push(this.add.text(x, 300, "J" + combattant.numero + " : " + role, fct.style(30, couleurRole)).setOrigin(0.5).setDepth(61));

    const sequence = { combattant: combattant, symboles: [], boites: [], index: 0, reussites: 0 };
    for (let i = 0; i < LONGUEUR_QTE; i++) {
      const symbole = Phaser.Utils.Array.GetRandom(SYMBOLES_QTE);
      const bx = x + (i - (LONGUEUR_QTE - 1) / 2) * 80;
      const boite = this.add.rectangle(bx, 370, 64, 64, 0x2a0a14).setStrokeStyle(3, 0x806070).setDepth(61);
      elements.push(boite, this.add.text(bx, 370, symbole.texte, fct.style(36)).setOrigin(0.5).setDepth(62));
      sequence.symboles.push(symbole);
      sequence.boites.push(boite);
    }
    sequence.boites[0].setStrokeStyle(4, 0xffd65a);
    return sequence;
  }

  gererQTE() {
    const qte = this.qte;
    if (qte.resolu) return;
    qte.barreTemps.width = 600 * Math.max(0, 1 - (this.time.now - qte.debut) / DUREE_QTE);

    for (const seq of qte.sequences) {
      if (seq.index >= LONGUEUR_QTE) continue;
      const appuis = fct.lireAppuis(seq.combattant.touches);
      const presse = SYMBOLES_QTE.find((s) => appuis[s.touche]);
      if (!presse) continue;

      const bon = presse.touche === seq.symboles[seq.index].touche;
      seq.boites[seq.index].setFillStyle(bon ? 0x2e9e4f : 0xa3223a).setStrokeStyle(3, 0xffffff);
      fct.jouerSon(this, bon ? "qte_ok" : "qte_rate", 0.6);
      if (bon) seq.reussites++;
      seq.index++;
      if (seq.index < LONGUEUR_QTE) seq.boites[seq.index].setStrokeStyle(4, 0xffd65a);
    }

    if (qte.sequences.every((seq) => seq.index >= LONGUEUR_QTE)) this.resoudreSpecial();
  }

  resoudreSpecial() {
    const qte = this.qte;
    if (qte.resolu) return;
    qte.resolu = true;
    qte.timer.remove();

    const [att, def] = qte.sequences;
    const degats = Math.max(6, 12 + 7 * att.reussites - 4 * def.reussites);
    const bilan = att.reussites === LONGUEUR_QTE && def.reussites < 2 ? "Bravo, maestro !" : att.reussites + "/4 contre " + def.reussites + "/4";
    qte.elements.push(this.add.text(640, 470, bilan, fct.style(40, "#ffffff")).setOrigin(0.5).setDepth(62));

    // salve de notes de l'attaquant vers le défenseur (tweens)
    for (let i = 0; i < 8; i++) {
      const note = this.add.image(qte.attaquant.x, qte.attaquant.y - 30, "note_projectile").setTint(qte.attaquant.perso.couleur).setDepth(63);
      qte.elements.push(note);
      this.tweens.add({
        targets: note,
        x: qte.defenseur.x + Phaser.Math.Between(-20, 20),
        y: qte.defenseur.y - 30 + Phaser.Math.Between(-40, 40),
        angle: 360,
        scale: 1.6,
        delay: i * 70,
        duration: 380,
        ease: "Cubic.easeIn"
      });
    }
    this.time.delayedCall(1000, () => this.terminerSpecial(degats));
  }

  terminerSpecial(degats) {
    const qte = this.qte;
    qte.elements.forEach((element) => this.detruire(element));
    qte.attaquant.setDepth(10);
    qte.defenseur.setDepth(10);
    this.qte = null;

    // on vide les appuis faits pendant le QTE pour qu'ils ne déclenchent pas d'action
    this.combattants.forEach((c) => fct.lireAppuis(c.touches));
    this.physics.resume();
    this.timerManche.paused = false;
    this.combatFige = false;

    const sens = qte.defenseur.x >= qte.attaquant.x ? 1 : -1;
    const coupSpecial = { degats: degats, recul: 650, reculY: 380, etourdissement: 700, energie: 0 };
    qte.defenseur.recevoirCoup(qte.attaquant, coupSpecial, sens, true);
    this.cameras.main.flash(150, 255, 240, 200);
  }

  /*********************************************************************/
  /** INTERFACE (barres de vie, chrono, jauges de notes, manches)
  /*********************************************************************/
  creerHUD() {
    this.hud = this.add.graphics().setDepth(100);
    this.add.text(40, 14, this.j1.perso.nom, fct.style(24, "#6cb8ff")).setDepth(101);
    this.add.text(1240, 14, this.j2.perso.nom, fct.style(24, "#ff6c6c")).setOrigin(1, 0).setDepth(101);
    this.texteChrono = this.add.text(640, 46, DUREE_MANCHE, fct.style(48, "#ffffff")).setOrigin(0.5).setDepth(101);
    this.add.text(640, 88, "Manche " + this.donnees.manche, fct.style(18, "#e8d8c0")).setOrigin(0.5).setDepth(101);
    this.add.text(640, 706, "F / Échap : pause", fct.style(16, "#e8d8c0")).setOrigin(0.5).setAlpha(0.7).setDepth(101);

    // 5 notes de musique par joueur = jauge d'attaque spéciale
    this.notesHUD = this.combattants.map((c) => {
      const notes = [];
      for (let i = 0; i < 5; i++) {
        const x = c.numero === 1 ? 54 + i * 34 : 1226 - i * 34;
        notes.push(this.add.image(x, 102, "note_hud").setDepth(101));
      }
      return notes;
    });
  }

  dessinerHUD(temps) {
    const g = this.hud;
    g.clear();
    this.combattants.forEach((c, j) => {
      // la barre "fantôme" blanche rattrape doucement la vraie vie
      c.pvAffiches = Phaser.Math.Linear(c.pvAffiches, c.pv, 0.06);
      const x = j === 0 ? 40 : 720;
      const largeur = 520;
      const ratio = c.pv / PV_MAX;
      const ratioFantome = c.pvAffiches / PV_MAX;
      g.fillStyle(0x1a0008, 0.85).fillRect(x - 4, 44, largeur + 8, 34);
      g.fillStyle(0x5a1020, 1).fillRect(x, 48, largeur, 26);
      // les barres se vident vers l'extérieur (ancrées côté chrono)
      g.fillStyle(0xffffff, 0.8);
      if (j === 0) g.fillRect(x + largeur * (1 - ratioFantome), 48, largeur * ratioFantome, 26);
      else g.fillRect(x, 48, largeur * ratioFantome, 26);
      g.fillStyle(ratio > 0.3 ? 0xf5c542 : 0xe0304e, 1);
      if (j === 0) g.fillRect(x + largeur * (1 - ratio), 48, largeur * ratio, 26);
      else g.fillRect(x, 48, largeur * ratio, 26);

      // manches gagnées
      for (let k = 0; k < MANCHES_GAGNANTES; k++) {
        const px = j === 0 ? 540 - k * 28 : 740 + k * 28;
        g.fillStyle(k < this.donnees.victoires[j] ? 0xffd65a : 0x3a2a30, 1).fillCircle(px, 98, 9);
        g.lineStyle(2, 0x1a0008).strokeCircle(px, 98, 9);
      }

      // notes de la jauge : pleines, en cours de remplissage ou vides
      const pleine = c.energie >= ENERGIE_MAX;
      this.notesHUD[j].forEach((note, k) => {
        const remplissage = Phaser.Math.Clamp(c.energie / 20 - k, 0, 1);
        note.setTint(remplissage >= 1 ? c.perso.couleur : 0xffffff);
        note.setAlpha(0.2 + 0.8 * remplissage);
        note.setScale(pleine ? 1 + 0.18 * Math.sin(temps / 90 + k) : 1);
      });
    });
  }
}
