import * as fct from "./fonctions.js";
import { PERSONNAGES } from "./reglages.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";

/***********************************************************************/
/** SÉLECTION DES PERSONNAGES (mode duel)
/** Chaque joueur choisit avec son joystick et valide avec A (B = annuler).
/** Les vignettes sont rangées sur deux lignes au centre de l'écran.
/***********************************************************************/

const COULEURS_JOUEURS = [0x6cb8ff, 0xff6c6c];
const PAR_LIGNE = 4; // nombre de vignettes sur la première ligne
// vignettes agrandies quand tous les personnages tiennent sur une seule ligne
const ZOOM_CARTES = PERSONNAGES.length > PAR_LIGNE ? 1 : 1.5;
const ECART_CARTES = 112 * ZOOM_CARTES;
const ECHELLE_CARTE_JOUEUR = 0.9;

export default class selection extends Phaser.Scene {
  constructor() {
    super({ key: "selection" });
  }

  create() {
    this.enTransition = false;
    this.cameras.main.fadeIn(300);
    fct.jouerMusique(this, "musique_menu");

    this.add.image(640, 360, "fond_scene");
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.35);
    this.add.image(640, 46, "titre_artiste");

    // vignettes des personnages
    this.positions = PERSONNAGES.map((perso, i) => this.positionCarte(i));
    PERSONNAGES.forEach((perso, i) => {
      const { x, y } = this.positions[i];
      this.add.rectangle(x, y, 100 * ZOOM_CARTES, 150 * ZOOM_CARTES, 0x2a0a14, 0.9).setStrokeStyle(3, 0xb08030);
      this.add.sprite(x, y + 70 * ZOOM_CARTES, perso.id, 0).setOrigin(0.5, 1).setScale(0.72 * ZOOM_CARTES * perso.sprite.echelle);
    });

    this.choix = [0, 1];
    this.pret = [false, false];
    this.panneaux = [this.creerPanneau(1, 190), this.creerPanneau(2, 1090)];

    this.add.text(640, 694, "Joystick : choisir     A : valider     B : annuler", fct.style(20, "#e8d8c0")).setOrigin(0.5);

    this.touches = creerTouchesDeuxJoueurs(this);
    this.majPanneau(0);
    this.majPanneau(1);
  }

  // position de la vignette n°i : 4 sur la première ligne, le reste centré en dessous
  // (s'il n'y a qu'une ligne, elle est centrée verticalement)
  positionCarte(i) {
    const ligne = i < PAR_LIGNE ? 0 : 1;
    const nbSurLigne = ligne === 0 ? Math.min(PAR_LIGNE, PERSONNAGES.length) : PERSONNAGES.length - PAR_LIGNE;
    const rang = ligne === 0 ? i : i - PAR_LIGNE;
    const yPremiereLigne = PERSONNAGES.length > PAR_LIGNE ? 255 : 340;
    return { x: 640 + (rang - (nbSurLigne - 1) / 2) * ECART_CARTES, y: yPremiereLigne + ligne * 180, ligne: ligne };
  }

  // joystick haut/bas : vignette la plus proche sur l'autre ligne
  changerLigne(index) {
    const actuelle = this.positions[index];
    let meilleur = index;
    let distance = Infinity;
    this.positions.forEach((pos, i) => {
      if (pos.ligne !== actuelle.ligne && Math.abs(pos.x - actuelle.x) < distance) {
        distance = Math.abs(pos.x - actuelle.x);
        meilleur = i;
      }
    });
    return meilleur;
  }

  // panneau d'un joueur : carte "JOUEUR n" avec l'aperçu animé, le nom et le rôle
  creerPanneau(numero, x) {
    const couleur = COULEURS_JOUEURS[numero - 1];
    const k = ECHELLE_CARTE_JOUEUR;
    const p = { x: x };
    this.add.image(x, 300, "carte_joueur" + numero).setScale(k);
    p.apercu = this.add.sprite(x, 300 + 64 * k, PERSONNAGES[0].id).setOrigin(0.5, 1);
    if (numero === 2) p.apercu.setFlipX(true);
    const joueur = (this.registry.get("joueurs") || [null, null])[numero - 1];
    this.add.text(x, 98, joueur ? joueur.pseudo + "  (" + joueur.elo + ")" : "Invité", fct.style(26, fct.couleurTexte(couleur))).setOrigin(0.5);
    p.nom = this.add.text(x, 300 + 111 * k, "", fct.style(26)).setOrigin(0.5);
    p.role = this.add.text(x, 500, "", fct.style(18, "#e8d8c0")).setOrigin(0.5);
    p.pret = this.add.text(x, 250, "PRÊT !", fct.style(52, "#7dff9a")).setOrigin(0.5).setAngle(-12).setVisible(false).setDepth(5);

    // curseur autour de la vignette choisie
    p.cadre = this.add.rectangle(0, 0, 108 * ZOOM_CARTES, 158 * ZOOM_CARTES).setStrokeStyle(5, couleur);
    p.etiquette = this.add.text(0, 0, "J" + numero, fct.style(22, fct.couleurTexte(couleur))).setOrigin(0.5);
    return p;
  }

  majPanneau(j) {
    const p = this.panneaux[j];
    const perso = PERSONNAGES[this.choix[j]];
    const pos = this.positions[this.choix[j]];
    // si les deux joueurs sont sur la même vignette, on agrandit le 2e cadre pour voir les deux
    const memeCarte = this.choix[0] === this.choix[1];
    p.cadre.setPosition(pos.x, pos.y).setScale(memeCarte && j === 1 ? 1.08 : 1);
    const ecartEtiquette = 92 * ZOOM_CARTES;
    p.etiquette.setPosition(pos.x, j === 0 ? pos.y - ecartEtiquette : pos.y + ecartEtiquette);

    p.apercu.setScale(0.95 * perso.sprite.echelle).play(perso.id + (this.pret[j] ? "_victoire" : "_repos"));
    p.nom.setText(perso.nom);
    p.role.setText(perso.role);
    p.pret.setVisible(this.pret[j]);
  }

  update() {
    if (this.enTransition) return;
    this.touches.forEach((touches, j) => {
      const appuis = fct.lireAppuis(touches);
      if (!this.pret[j]) {
        let nouveau = this.choix[j];
        if (appuis.gauche || appuis.droite) nouveau = fct.boucler(nouveau + (appuis.gauche ? -1 : 1), PERSONNAGES.length);
        if (appuis.haut || appuis.bas) nouveau = this.changerLigne(nouveau);
        if (nouveau !== this.choix[j]) {
          this.choix[j] = nouveau;
          fct.jouerSon(this, "menu_deplacer", 0.5);
          this.majPanneau(0);
          this.majPanneau(1);
        }
        if (appuis.A) {
          this.pret[j] = true;
          fct.jouerSon(this, "menu_valider");
          this.majPanneau(j);
        } else if (appuis.B && !this.pret[0] && !this.pret[1]) {
          // retour au menu : le rideau se referme
          fct.transitionRideau(this, "rideau_fermeture", () => this.scene.start("menu"));
        }
      } else if (appuis.B) {
        this.pret[j] = false;
        this.majPanneau(j);
      }
    });

    if (this.pret[0] && this.pret[1]) {
      fct.changerScene(this, "selection_arene", {
        j1: PERSONNAGES[this.choix[0]].id,
        j2: PERSONNAGES[this.choix[1]].id
      });
    }
  }
}
