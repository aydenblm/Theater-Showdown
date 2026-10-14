import * as fct from "./fonctions.js";
import { trouverPerso, trouverArene, OBJETS } from "./reglages.js";
import { creerTouches } from "./controles.js";
import Combattant, { PV_MAX, ENERGIE_MAX, COUPS } from "./combattant.js";

/***********************************************************************/
/** SCÈNE DE COMBAT (1 contre 1)
/** Données reçues : { j1, j2, arene, victoires: [v1, v2], manche }
/** Une manche se termine par K.O. ou à la fin du chrono ;
/** on relance alors la scène (scene.restart) pour la manche suivante.
/***********************************************************************/

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

// barre de vie (image 462x116) : zone rouge entre ces deux abscisses de l'image
// (exportées : le HUD du mode solo utilise la même image)
export const BARRE_DEBUT = 113;
export const BARRE_FIN = 421;

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
    this.solY = arene.sol; // hauteur du sol, propre à chaque décor

    // groupes communs à toutes les arènes
    this.solides = []; // sol, caisses : on ne peut pas les traverser
    this.groupe_plateformes = this.physics.add.group({ allowGravity: false, immovable: true });
    this.plateformesMobiles = []; // lustre, touches noires, pont de projecteurs
    this.tempsPlateformes = 0;
    switch (arene.id) {
      case "piano":
        this.construirePiano();
        break;
      case "coulisses":
        this.construireCoulisses();
        break;
      default:
        this.construireOpera();
    }

    // les deux combattants
    this.j1 = new Combattant(this, 320, this.solY - 160, trouverPerso(this.donnees.j1), 1, creerTouches(this, 1));
    this.j2 = new Combattant(this, 960, this.solY - 160, trouverPerso(this.donnees.j2), 2, creerTouches(this, 2));
    this.j1.adversaire = this.j2;
    this.j2.adversaire = this.j1;
    this.j2.setFlipX(true);
    this.combattants = [this.j1, this.j2];

    this.physics.add.collider(this.combattants, this.solides, this.surLeSol, null, this);
    // plateformes traversables par le dessous (et par le dessus avec joystick bas)
    this.physics.add.collider(this.combattants, this.groupe_plateformes, this.poserSurPlateforme, this.traverserParDessous, this);
    // à chaque pas de la physique : on déplace les plateformes mobiles et ce qui est posé dessus
    this.physics.world.on("worldstep", this.pasDePhysique, this);

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
    this.physics.add.collider(this.groupe_objets, this.groupe_plateformes, this.poserSurPlateforme, null, this);
    this.combattants.forEach((c) => this.physics.add.overlap(c, this.groupe_objets, this.ramasser, null, this));

    this.creerHUD();
    this.lancerIntro();

    // pause : bouton Start d'un des deux joueurs sur la borne, ou Échap au clavier
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

  // à lire AVANT combattant.gerer(), qui "consomme" les appuis de toutes les touches
  demandePause() {
    if (this.enTransition) return false;
    return Phaser.Input.Keyboard.JustDown(this.toucheEchap) ||
      Phaser.Input.Keyboard.JustDown(this.j1.touches.start) ||
      Phaser.Input.Keyboard.JustDown(this.j2.touches.start);
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
  // sol invisible : le plancher est dessiné dans le décor
  creerSol() {
    const sol = this.add.zone(640, this.solY + 50, 1280, 100);
    this.physics.add.existing(sol, true);
    this.solides.push(sol);
  }

  construireOpera() {
    this.add.image(640, 360, "fond_opera");
    this.creerSol();
    // deux balcons et une estrade en bois fixes
    [190, 1090].forEach((x) => this.creerPlateforme(x, 480, "balcon", 12));
    this.creerPlateforme(640, 530, "plateforme_bois", 14);
    // le lustre monte et descend
    this.creerPlateformeMobile(640, 280, 340, 2600, "lustre", 14);
  }

  construirePiano() {
    this.add.image(640, 360, "fond_piano");
    // le sol est fait des 16 touches blanches du décor (80 px chacune) : des zones invisibles
    // qui jouent leur note quand on marche dessus
    for (let i = 0; i < 16; i++) {
      const touche = this.add.zone(40 + i * 80, this.solY + 50, 80, 100);
      this.physics.add.existing(touche, true);
      touche.numero = i;
      // ombre affichée quand la touche est enfoncée
      touche.ombre = this.add.rectangle(touche.x, this.solY + 50, 76, 100, 0x2a1840).setAlpha(0).setDepth(1);
      this.solides.push(touche);
    }

    // deux touches noires flottantes qui montent et descendent en alternance
    this.creerPlateformeMobile(150, 470, 390, 2200, "touche_noire", 16);
    this.creerPlateformeMobile(1130, 390, 470, 2200, "touche_noire", 16);
    // le rebord du pupitre dessiné dans le décor sert de plateforme (zone invisible)
    const rebord = this.add.zone(640, 463, 780, 14);
    this.groupe_plateformes.add(rebord);
  }

  construireCoulisses() {
    this.add.image(640, 360, "fond_coulisses");
    this.creerSol();
    // deux caisses posées au sol : pleines, on peut monter dessus mais pas les traverser
    [420, 860].forEach((x) => this.solides.push(this.physics.add.staticImage(x, this.solY - 40, "caisse_bois").setDepth(5)));
    // flight cases de chaque côté et poutre suspendue au centre
    [170, 1110].forEach((x) => this.creerPlateforme(x, 430, "flight_case", 16));
    this.creerPlateforme(640, 450, "poutre_suspendue", 14, 28);
    // le pont de projecteurs monte et descend
    this.creerPlateformeMobile(640, 250, 310, 2400, "pont_lumiere", 14);
  }

  // plateforme dont seule une bande (épaisseur "hauteurCorps", à "decalage" px du haut
  // de l'image) est solide
  creerPlateforme(x, y, cle, hauteurCorps, decalage = 0) {
    const plateforme = this.groupe_plateformes.create(x, y, cle);
    plateforme.body.setSize(plateforme.width, hauteurCorps, false).setOffset(0, decalage);
    plateforme.setDepth(5);
    return plateforme;
  }

  // Plateforme qui fait l'aller-retour entre yDepart et yArrivee (durée d'un trajet en ms).
  // Elle n'est pas animée par un tween mais déplacée à chaque pas de la physique (pasDePhysique) :
  // avec un tween, la plateforme et les combattants posés dessus n'avançaient pas au même
  // rythme, et les combattants tremblaient.
  creerPlateformeMobile(x, yDepart, yArrivee, duree, cle, hauteurCorps) {
    const plateforme = this.creerPlateforme(x, yDepart, cle, hauteurCorps);
    plateforme.body.moves = false; // c'est nous qui la déplaçons, pas la physique
    plateforme.trajet = { depart: yDepart, arrivee: yArrivee, duree: duree };
    this.plateformesMobiles.push(plateforme);
    return plateforme;
  }

  // processCallback : on ne collisionne que si le combattant arrive par le dessus,
  // et pas s'il est en train de descendre volontairement (joystick bas)
  traverserParDessous(combattant, plateforme) {
    if (this.time.now < combattant.traverseeJusqua) return false;
    return combattant.body.velocity.y >= 0 && combattant.body.bottom <= plateforme.body.top + 16;
  }

  // callback de collision : on retient la plateforme sur laquelle l'objet (ou le combattant) est posé
  poserSurPlateforme(objet, plateforme) {
    if (objet.body.touching.down) objet.plateforme = plateforme;
  }

  // Appelée par la physique après chaque pas (événement "worldstep"), delta en secondes
  pasDePhysique(delta) {
    // 1. les plateformes mobiles avancent (aller-retour "en douceur", comme Sine.easeInOut)
    this.tempsPlateformes += delta * 1000;
    for (const plateforme of this.plateformesMobiles) {
      const trajet = plateforme.trajet;
      const avancement = (1 - Math.cos((Math.PI * this.tempsPlateformes) / trajet.duree)) / 2;
      const y = trajet.depart + (trajet.arrivee - trajet.depart) * avancement;
      plateforme.body.y += y - plateforme.y;
      plateforme.y = y;
    }
    // 2. ce qui est posé dessus suit le mouvement
    this.combattants.forEach((combattant) => this.suivrePlateforme(combattant));
    this.groupe_objets.getChildren().forEach((objet) => this.suivrePlateforme(objet));
  }

  // garde l'objet collé sur sa plateforme tant qu'il ne saute pas et ne la quitte pas
  suivrePlateforme(objet) {
    const plateforme = objet.plateforme;
    if (!plateforme) return;
    const corps = objet.body;
    const dessus = plateforme.body.top;
    const toujoursDessus = corps.right > plateforme.body.left && corps.left < plateforme.body.right &&
      corps.velocity.y >= 0 && Math.abs(corps.bottom - dessus) <= 12;
    if (!toujoursDessus) {
      objet.plateforme = null;
      return;
    }
    corps.y = dessus - corps.height;
    corps.velocity.y = 0;
    corps.blocked.down = true; // considéré "au sol" jusqu'au prochain pas
  }

  // appelée à chaque collision avec le sol : sur le piano, la touche foulée joue sa note
  surLeSol(combattant, touche) {
    if (touche.numero === undefined) return;
    if (Math.abs(combattant.x - touche.x) > 40) return; // seulement la touche sous les pieds
    if (combattant.derniereTouchePiano === touche) return;
    combattant.derniereTouchePiano = touche;
    const demiTons = GAMME[touche.numero % 7] + 12 * Math.floor(touche.numero / 7);
    this.sound.play("note_piano", { volume: 0.35, rate: Math.pow(2, demiTons / 12) });
    // la touche s'assombrit brièvement, comme si elle s'enfonçait
    this.tweens.killTweensOf(touche.ombre);
    touche.ombre.setAlpha(0.45);
    this.tweens.add({ targets: touche.ombre, alpha: 0, duration: 250 });
  }

  /*********************************************************************/
  /** PROJECTILES ET OBJETS
  /*********************************************************************/
  // projectile : planche animée du personnage (clé de fa, clé de sol...)
  // ou, à défaut, une note de musique à sa couleur
  creerNote(tireur) {
    const cle = tireur.perso.projectile || "note_projectile";
    const note = this.groupe_notes.create(tireur.x + tireur.sens * 55, tireur.y - 30, cle);
    note.tireur = tireur;
    note.setFlipX(tireur.sens < 0).setDepth(12);
    if (tireur.perso.projectile) {
      note.play(cle + "_vol");
      note.body.setSize(36, 46);
    } else {
      note.setTint(tireur.perso.couleur);
      this.tweens.add({ targets: note, angle: { from: -15, to: 15 }, duration: 140, yoyo: true, repeat: -1 });
    }
    note.setVelocityX(tireur.sens * tireur.perso.vitesseNote);
    note.setCollideWorldBounds(true);
    note.body.onWorldBounds = true;
    fct.jouerSon(this, "tir", 0.5);
  }

  toucherParNote(combattant, note) {
    if (note.tireur === combattant) return;
    const sens = note.body.velocity.x > 0 ? 1 : -1;
    this.dissiper(note);
    combattant.recevoirCoup(note.tireur, COUPS.note, sens);
  }

  // deux notes adverses qui se rencontrent s'annulent
  chocDeNotes(note1, note2) {
    if (note1.tireur === note2.tireur) return;
    fct.etincelles(this, (note1.x + note2.x) / 2, note1.y, 0xffffff, 5);
    this.dissiper(note1);
    this.dissiper(note2);
  }

  // détruit un projectile ; s'il est animé, on joue sa dissipation à sa place
  dissiper(note) {
    const cle = note.tireur.perso.projectile;
    if (cle) {
      const effet = this.add.sprite(note.x, note.y, cle).setFlipX(note.flipX).setDepth(12).play(cle + "_impact");
      effet.once("animationcomplete", () => effet.destroy());
    }
    this.detruire(note);
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

  // "arrêt sur image" : la physique se fige un court instant pour donner du poids à un coup
  // (pas pendant l'attaque spéciale, qui gère elle-même la pause de la physique)
  arretSurImage(duree) {
    if (this.qte) return;
    this.physics.pause();
    this.time.delayedCall(duree, () => {
      if (!this.qte) this.physics.resume();
    });
  }

  /*********************************************************************/
  /** DÉROULEMENT D'UNE MANCHE
  /*********************************************************************/
  // affiche une image de texte du jeu si elle existe ("texte_round_1"...), sinon un texte Phaser
  annonce(cleImage, texteSecours, y = 300) {
    const objet = this.textures.exists(cleImage)
      ? this.add.image(640, y, cleImage)
      : this.add.text(640, y, texteSecours, fct.style(80, "#ffd65a")).setOrigin(0.5);
    return objet.setDepth(200);
  }

  lancerIntro() {
    const titre = this.annonce("texte_round_" + this.donnees.manche, "Manche " + this.donnees.manche).setScale(0);
    fct.jouerSon(this, "gong", 0.6);
    this.tweens.add({ targets: titre, scale: 1, duration: 400, ease: "Back.easeOut" });
    const texte = this.add.text(640, 300, "En scène !", fct.style(80, "#ffd65a")).setOrigin(0.5).setDepth(200).setVisible(false);

    this.time.delayedCall(1300, () => {
      titre.destroy();
      texte.setVisible(true);
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
    const ko = perdant !== null && perdant.pv === 0;
    if (ko) {
      perdant.changerEtat("ko");
      fct.jouerSon(this, "ko", 0.8);
      this.cameras.main.flash(200, 255, 255, 255);
    } else {
      fct.jouerSon(this, "gong", 0.6);
    }
    if (vainqueur) this.donnees.victoires[vainqueur.numero - 1]++;

    // "K.O." (image pixel art agrandie) ou "Rideau !" quand le chrono est écoulé
    const titre = ko ? this.annonce("texte_ko", "K.O. !", 280) : this.annonce("", "Rideau !", 280);
    const echelle = ko ? 1.5 : 1;
    titre.setScale(echelle * 3).setAlpha(0);
    this.tweens.add({ targets: titre, scale: echelle, alpha: 1, duration: 350, ease: "Cubic.easeOut" });

    this.time.delayedCall(1400, () => {
      titre.destroy();
      if (vainqueur) {
        vainqueur.changerEtat("victoire");
        this.annonce("texte_joueur_" + vainqueur.numero, "Joueur " + vainqueur.numero, 260);
        this.add.text(640, 330, vainqueur.perso.nom + " remporte la manche !", fct.style(40)).setOrigin(0.5).setDepth(200);
      } else {
        this.annonce("", "Égalité !", 280);
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
      const projectile = qte.attaquant.perso.projectile;
      const note = projectile
        ? this.add.image(qte.attaquant.x, qte.attaquant.y - 30, projectile, 0).setDepth(63)
        : this.add.image(qte.attaquant.x, qte.attaquant.y - 30, "note_projectile").setTint(qte.attaquant.perso.couleur).setDepth(63);
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
    // manches gagnées, de part et d'autre du chrono : elles ne changent pas pendant
    // une manche, on les dessine donc une seule fois (et pas à chaque frame)
    const hud = this.add.graphics().setDepth(100);
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < MANCHES_GAGNANTES; k++) {
        const px = j === 0 ? 588 - k * 26 : 692 + k * 26;
        hud.fillStyle(k < this.donnees.victoires[j] ? 0xffd65a : 0x3a2a30, 1).fillCircle(px, 46, 9);
        hud.lineStyle(2, 0x1a0008).strokeCircle(px, 46, 9);
      }
    }
    this.texteChrono = this.add.text(640, 46, DUREE_MANCHE, fct.style(48, "#ffffff")).setOrigin(0.5).setDepth(101);
    this.add.text(640, 88, "Manche " + this.donnees.manche, fct.style(18, "#e8d8c0")).setOrigin(0.5).setDepth(101);
    this.add.text(640, 706, "Start : pause", fct.style(16, "#e8d8c0")).setOrigin(0.5).setAlpha(0.7).setDepth(101);

    this.barres = this.combattants.map((c) => {
      // J1 en haut à gauche ; J2 en haut à droite, avec l'image en miroir
      const j1 = c.numero === 1;
      const x = j1 ? 14 : 1266;
      const suffixe = j1 ? "" : "_j2";
      const couleur = j1 ? "#6cb8ff" : "#ff6c6c";
      const barre = {
        vide: this.add.image(x, 4, "barre_vie_vide" + suffixe).setOrigin(j1 ? 0 : 1, 0).setDepth(100),
        // la barre "fantôme" claire rattrape doucement la vraie vie
        fantome: this.add.image(x, 4, "barre_vie_pleine" + suffixe).setOrigin(j1 ? 0 : 1, 0).setTintFill(0xfff0d0).setAlpha(0.7).setDepth(100),
        pleine: this.add.image(x, 4, "barre_vie_pleine" + suffixe).setOrigin(j1 ? 0 : 1, 0).setDepth(101)
      };
      // "J1"/"J2" dans le losange, nom du personnage sous la barre
      const losangeX = j1 ? x + 58 : x - 58;
      this.add.text(losangeX, 62, "J" + c.numero, fct.style(26, couleur)).setOrigin(0.5).setDepth(102);
      const joueur = (this.registry.get("joueurs") || [null, null])[c.numero - 1]; // compte connecté (null = invité)
      const nom = joueur ? c.perso.nom + " (" + joueur.pseudo + ")" : c.perso.nom;
      this.add.text(j1 ? x + 120 : x - 120, 100, nom, fct.style(20, couleur)).setOrigin(j1 ? 0 : 1, 0.5).setDepth(102);
      return barre;
    });

    // 5 notes de musique par joueur = jauge d'attaque spéciale
    this.notesHUD = this.combattants.map((c) => {
      const notes = [];
      for (let i = 0; i < 5; i++) {
        const x = c.numero === 1 ? 140 + i * 44 : 1140 - i * 44;
        notes.push({
          vide: this.add.image(x, 142, "note_ult_vide").setDepth(101),
          pleine: this.add.image(x, 142, "note_ult").setDepth(102)
        });
      }
      return notes;
    });
  }

  // rogne l'image de la barre pleine selon le ratio de vie (0 à 1) ; la barre du J2
  // est en miroir, on garde donc sa partie droite
  rognerBarre(image, ratio, miroir) {
    const largeur = BARRE_DEBUT + ratio * (BARRE_FIN - BARRE_DEBUT);
    image.setCrop(miroir ? image.width - largeur : 0, 0, largeur, image.height);
  }

  // Appelée à chaque frame : pour ménager le processeur de la borne, on ne touche
  // aux images que lorsque la valeur affichée a changé depuis la frame précédente.
  dessinerHUD(temps) {
    this.combattants.forEach((c, j) => {
      const barre = this.barres[j];
      // la barre "fantôme" rattrape la vraie vie, puis s'arrête dessus
      c.pvAffiches = Math.abs(c.pvAffiches - c.pv) < 0.1 ? c.pv : Phaser.Math.Linear(c.pvAffiches, c.pv, 0.06);
      if (barre.pv !== c.pv) {
        barre.pv = c.pv;
        this.rognerBarre(barre.pleine, c.pv / PV_MAX, j === 1);
      }
      if (barre.pvAffiches !== c.pvAffiches) {
        barre.pvAffiches = c.pvAffiches;
        this.rognerBarre(barre.fantome, c.pvAffiches / PV_MAX, j === 1);
      }

      // notes de la jauge : pleines, en cours de remplissage ou vides
      const pleine = c.energie >= ENERGIE_MAX;
      if (barre.energie !== c.energie) {
        barre.energie = c.energie;
        this.notesHUD[j].forEach((note, k) => {
          const remplissage = Phaser.Math.Clamp(c.energie / 20 - k, 0, 1);
          note.pleine.setAlpha(remplissage >= 1 ? 1 : remplissage * 0.6).setScale(1);
          note.vide.setScale(1);
        });
      }
      // jauge pleine : les notes pulsent
      if (pleine) {
        this.notesHUD[j].forEach((note, k) => {
          const echelle = 1 + 0.15 * Math.sin(temps / 90 + k);
          note.pleine.setScale(echelle);
          note.vide.setScale(echelle);
        });
      }
    });
  }
}
