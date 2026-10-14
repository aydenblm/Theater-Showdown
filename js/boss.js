import * as fct from "./fonctions.js";
import { ARENE_BOSS, BOSS, ENNEMIS_SOLO } from "./reglages.js";
import SceneSolo from "./solo_commun.js";
import ChefOrchestre from "./chef_orchestre.js";

/***********************************************************************/
/** MODE SOLO, COMBAT CONTRE LE BOSS : le Chef d'orchestre
/** Arène : la carte Tiled "map_solo2" (scène de théâtre, cinq plateformes).
/** Toute l'arène tient à l'écran : la caméra est fixe et dézoomée.
/**
/** Comment on fait des dégâts au boss ?  Uniquement avec SES touches de piano :
/**   1. le boss envoie une touche de piano vers le joueur (attaque 2)
/**   2. le joueur appuie sur A au bon moment, quand la touche est proche : PARADE !
/**   3. la touche repart vers le boss et lui fait des dégâts
/** Si on rate la parade, la touche fait mal. Les notes de l'attaque 1 se dodgent, se bloquent
/** (garde) ou se détruisent avec une note du joueur. De petits ennemis tombent au hasard dans l'arène.
/**
/** Le niveau, les contacts, les notes et les dégâts sont dans solo_commun.js.
/***********************************************************************/

const HAUTEUR_ECRAN = 720;
const LARGEUR_ECRAN = 1280;
const MARGE_SOL = 60; // px de plancher visibles en bas de l'écran
const GAMME = [0, 2, 4, 5, 7, 9, 11]; // demi-tons d'une gamme de do majeur (la touche joue sa note)
const RAYON_TOUCHE = 30; // px : distance à laquelle une touche atteint le joueur ou un ennemi

export default class boss extends SceneSolo {
  constructor() {
    super({ key: "boss" });
  }

  create() {
    const arene = ARENE_BOSS;
    const carte = this.preparerSolo(arene.carte, arene.musique);
    this.combatTermine = false;
    this.touchesPiano = []; // les touches de piano en vol (celles du boss et celles qu'on lui renvoie)

    // les murs invisibles de l'arène : de pilier à pilier (le plancher fait 6 tuiles d'épaisseur)
    this.physics.world.setBounds(arene.gauche, arene.haut, arene.droite - arene.gauche, arene.sol + 192 - arene.haut);

    this.creerJoueur(arene.departJoueur, arene.sol);
    this.chef = new ChefOrchestre(this, (arene.gauche + arene.droite) / 2, arene.sol);

    // caméra fixe : on dézoome pour voir toute la largeur de l'arène
    const zoom = LARGEUR_ECRAN / (arene.droite - arene.gauche);
    const hauteurVue = HAUTEUR_ECRAN / zoom;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn((arene.gauche + arene.droite) / 2, arene.sol - hauteurVue / 2 + MARGE_SOL);

    this.lancerHUD({ joueur: this.joueur, ennemis: this.ennemis, boss: this.chef });

    // déroulement : un instant de silence, le boss surgit, puis le combat commence
    this.time.delayedCall(900, () => {
      this.scene.get("hud_solo").annoncer(BOSS.nom);
      this.chef.apparaitre();
      this.chef.once("animationcomplete", () => this.programmerEnnemi());
    });
  }

  update(temps, delta) {
    super.update();
    this.majTouches(delta / 1000);
  }

  /*********************************************************************/
  /** ATTAQUE 1 : LES NOTES DE MUSIQUE
  /** Appelée par le boss quand sa baguette lâche les notes : un éventail de notes
  /** dirigé vers le joueur (3 notes, ou 5 en phase 2).
  /*********************************************************************/
  lancerNotes(chef) {
    const depart = chef.pointeBaguette();
    const nombre = chef.phase === 1 ? 3 : 5;
    const ecart = 0.24; // radians entre deux notes
    const versLeJoueur = Phaser.Math.Angle.Between(depart.x, depart.y, this.joueur.x, this.joueur.y - 20);
    for (let i = 0; i < nombre; i++) {
      const angle = versLeJoueur + (i - (nombre - 1) / 2) * ecart;
      const vitesse = BOSS.notes.vitesse;
      this.lancerNoteEnnemi(depart.x, depart.y, Math.cos(angle) * vitesse, Math.sin(angle) * vitesse, BOSS.notes.echelle, BOSS.notes.duree, BOSS.notes.coup);
    }
    fct.jouerSon(this, "tir", 0.6);
  }

  /*********************************************************************/
  /** ATTAQUE 2 : LES TOUCHES DE PIANO
  /*********************************************************************/
  // Appelée par le boss : une touche part du clavier vers le joueur
  lancerTouche(chef) {
    const depart = chef.pointeBaguette();
    const touche = this.add.image(depart.x, depart.y, "touche_piano").setDepth(12);
    touche.renvoyee = false; // passe à true quand le joueur la renvoie vers le boss
    const angle = Phaser.Math.Angle.Between(depart.x, depart.y, this.joueur.x, this.joueur.y - 20);
    this.donnerVitesse(touche, angle, BOSS.touches.vitesse);
    this.touchesPiano.push(touche);
    // la touche joue une note de la gamme
    this.sound.play("note_piano", { volume: 0.6, rate: Math.pow(2, Phaser.Utils.Array.GetRandom(GAMME) / 12) });
  }

  // règle la direction et la vitesse d'une touche (l'image est dessinée à la verticale)
  donnerVitesse(touche, angle, vitesse) {
    touche.vx = Math.cos(angle) * vitesse;
    touche.vy = Math.sin(angle) * vitesse;
    touche.rotation = angle + Math.PI / 2;
  }

  // À chaque frame : on avance chaque touche et on regarde ce qu'elle touche.
  // (Pas de physique ici : de simples calculs de distance, plus faciles à suivre.)
  majTouches(secondes) {
    const maintenant = this.time.now;
    for (const touche of this.touchesPiano) {
      touche.x += touche.vx * secondes;
      touche.y += touche.vy * secondes;

      if (touche.renvoyee) this.majToucheRenvoyee(touche);
      else this.majToucheDuBoss(touche, maintenant);

      if (this.touchesPiano.includes(touche) && !this.dansLArene(touche)) this.retirerTouche(touche);
    }
  }

  // une touche du boss : parade, coup au joueur, ou arrêt contre le décor
  majToucheDuBoss(touche, maintenant) {
    const joueur = this.joueur;
    const distance = Phaser.Math.Distance.Between(touche.x, touche.y, joueur.x, joueur.y - 20);
    const parable = distance <= BOSS.touches.rayonParade;
    touche.setTint(parable ? 0xfff0a0 : 0xffffff); // elle s'éclaire quand on peut la renvoyer

    if (parable && joueur.enParade(maintenant) && joueur.etat !== "ko") {
      this.renvoyerTouche(touche);
      return;
    }
    const tuile = this.calqueSol.getTileAtWorldXY(touche.x, touche.y);
    if (tuile && tuile.collides) {
      fct.etincelles(this, touche.x, touche.y, 0xffffff, 4);
      this.retirerTouche(touche);
    } else if (distance <= RAYON_TOUCHE && !joueur.invincible && joueur.etat !== "ko") {
      // subirAttaque renvoie false si le joueur a esquivé : la touche continue alors son chemin
      if (joueur.subirAttaque(BOSS.touches.coup, touche.vx > 0 ? 1 : -1)) this.retirerTouche(touche);
    }
  }

  // PARADE RÉUSSIE : la touche repart en sens inverse, droit vers le boss
  renvoyerTouche(touche) {
    touche.renvoyee = true;
    const cible = this.chef.zoneDegats;
    const angle = Phaser.Math.Angle.Between(touche.x, touche.y, cible.centerX, cible.centerY);
    this.donnerVitesse(touche, angle, BOSS.touches.vitesseRenvoi);
    touche.setTint(0xffd65a);
    fct.jouerSon(this, "qte_ok", 0.7);
    fct.texteFlottant(this, this.joueur.x, this.joueur.y - 70, "Parade !", "#9fe8ff", 30);
    this.cameras.main.flash(120, 255, 255, 220);
  }

  // une touche renvoyée : elle élimine les ennemis sur son passage, puis blesse le boss
  majToucheRenvoyee(touche) {
    for (const ennemi of this.ennemis.getChildren()) {
      if (ennemi.actif && Phaser.Math.Distance.Between(touche.x, touche.y, ennemi.x, ennemi.y) < RAYON_TOUCHE + 10) ennemi.eliminer();
    }
    if (this.chef.zoneDegats.contains(touche.x, touche.y)) {
      this.chef.recevoirDegats(BOSS.degatsRenvoi);
      fct.etincelles(this, touche.x, touche.y, 0xffd65a, 8);
      this.retirerTouche(touche);
    }
  }

  retirerTouche(touche) {
    this.touchesPiano.splice(this.touchesPiano.indexOf(touche), 1);
    touche.destroy();
  }

  dansLArene(objet) {
    return objet.x > ARENE_BOSS.gauche - 60 && objet.x < ARENE_BOSS.droite + 60 && objet.y > ARENE_BOSS.haut - 60 && objet.y < ARENE_BOSS.sol + 200;
  }

  // petit anneau qui montre la portée de la parade quand le joueur appuie sur A
  surParade(joueur) {
    const anneau = this.add.circle(joueur.x, joueur.y - 20, 18).setStrokeStyle(4, 0x9fe8ff).setDepth(14);
    this.tweens.add({
      targets: anneau,
      scale: BOSS.touches.rayonParade / 18,
      alpha: 0,
      duration: BOSS.touches.fenetreParade + 80,
      onComplete: () => anneau.destroy()
    });
  }

  /*********************************************************************/
  /** LES PETITS ENNEMIS : un nouveau tombe dans l'arène à intervalle aléatoire
  /*********************************************************************/
  programmerEnnemi() {
    const [mini, maxi] = BOSS.ennemis.delai["phase" + this.chef.phase];
    this.time.delayedCall(Phaser.Math.Between(mini, maxi), () => {
      if (this.combatTermine || this.partieFinie) return;
      this.faireApparaitreEnnemi();
      this.programmerEnnemi();
    });
  }

  faireApparaitreEnnemi() {
    const vivants = this.ennemis.getChildren().filter((ennemi) => ennemi.actif).length;
    if (vivants >= BOSS.ennemis.maximum) return;

    // un endroit au hasard, pas trop près du joueur (on essaie dix fois)
    let x = Phaser.Math.Between(ARENE_BOSS.gauche + 80, ARENE_BOSS.droite - 80);
    for (let essai = 0; essai < 10 && Math.abs(x - this.joueur.x) < BOSS.ennemis.distanceMiniJoueur; essai++) {
      x = Phaser.Math.Between(ARENE_BOSS.gauche + 80, ARENE_BOSS.droite - 80);
    }
    const donnees = Phaser.Utils.Array.GetRandom(ENNEMIS_SOLO);
    // il tombe du haut de l'arène (la croche, elle, apparaît à hauteur du joueur)
    const y = donnees.comportement === "vole" ? this.joueur.y - 60 : ARENE_BOSS.haut + 250;
    const ennemi = this.creerEnnemi(donnees, x, y);
    ennemi.setAlpha(0);
    this.tweens.add({ targets: ennemi, alpha: 1, duration: 350 });
    fct.etincelles(this, x, y - 30, 0xffd65a, 6);
    fct.jouerSon(this, "bonus", 0.4);
  }

  /*********************************************************************/
  /** FIN DU COMBAT
  /*********************************************************************/
  // les spéciales du joueur effacent aussi les notes du boss
  apresSpecial() {
    this.notesEnnemis.getChildren().slice().forEach((note) => this.dissiper(note));
  }

  // appelée par le boss à la fin de son animation de mort
  victoire() {
    this.combatTermine = true;
    this.enTransition = true; // le joueur ne bouge plus
    this.joueur.setVelocityX(0);
    this.joueur.setAccelerationX(0);
    this.touchesPiano.slice().forEach((touche) => this.retirerTouche(touche));
    this.notesEnnemis.getChildren().slice().forEach((note) => this.detruire(note));
    this.ennemis.getChildren().forEach((ennemi) => ennemi.actif && ennemi.eliminer());
    fct.jouerSon(this, "applaudissements", 0.8);
    this.cameras.main.flash(300, 255, 240, 200);
    this.scene.get("hud_solo").afficherVictoire();
  }

  // appelés par l'écran de victoire (hud_solo) : fondu puis nouvelle scène
  rejouer() {
    this.enTransition = false;
    fct.changerScene(this, "boss");
  }

  retourMenu() {
    this.enTransition = false;
    fct.changerScene(this, "menu");
  }
}
