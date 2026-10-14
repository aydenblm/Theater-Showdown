import * as fct from "./fonctions.js";
import { ENNEMIS_SOLO } from "./reglages.js";
import SceneSolo from "./solo_commun.js";

/***********************************************************************/
/** MODE SOLO, NIVEAU 1 : niveau de plateformes construit dans Tiled (map_solo1.tmj)
/**   - le joueur apparaît sur le point "Spawn_Joueur" du calque "calque_objets"
/**   - un ennemi apparaît sur chaque point du calque d'objets "ennemy" ; le nom du point
/**     donne le type : "Ennemy_cymbales", "Ennemy_trompette", "Ennemy_tambour", "Ennemy_croche"
/**   - le rectangle "TP_Map2" (le rideau rouge, à droite) mène au combat contre le boss
/** Tout le reste (contacts, notes, dégâts, K.O.) est dans solo_commun.js.
/***********************************************************************/

const ZOOM_CAMERA = 2; // zoom entier : les gros pixels du tileset restent tous de la même taille

export default class solo extends SceneSolo {
  constructor() {
    super({ key: "solo" });
  }

  create() {
    const carte = this.preparerSolo("map_solo1", "musique_solo");

    const depart = carte.findObject("calque_objets", (objet) => objet.name === "Spawn_Joueur");
    this.creerJoueur(depart.x, depart.y);

    carte.getObjectLayer("ennemy").objects.forEach((point, i) => {
      this.creerEnnemi(this.trouverEnnemi(point.name, i), point.x, point.y);
    });

    // porte du boss : un rectangle dessiné dans Tiled
    const porte = carte.findObject("calque_objets", (objet) => objet.name === "TP_Map2");
    this.zonePorte = new Phaser.Geom.Rectangle(porte.x, porte.y, porte.width, porte.height);

    // la caméra, zoomée, suit le joueur sans sortir de la carte
    this.cameras.main.setZoom(ZOOM_CAMERA);
    this.cameras.main.setBounds(0, 0, carte.widthInPixels, carte.heightInPixels);
    this.cameras.main.startFollow(this.joueur, true, 0.12, 0.12);

    this.lancerHUD({ joueur: this.joueur, ennemis: this.ennemis });
  }

  update() {
    super.update();
    if (this.enTransition || this.partieFinie) return;
    if (this.zonePorte.contains(this.joueur.x, this.joueur.y)) {
      this.enTransition = true;
      fct.jouerSon(this, "gong", 0.6);
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("boss"));
    }
  }

  // nom d'un objet Tiled -> type d'ennemi : "Ennemy_tambour" -> "ennemi_tambour"
  // (si le nom est inconnu, on alterne entre les types dans l'ordre de la liste)
  trouverEnnemi(nom, numero) {
    const id = "ennemi_" + nom.replace("Ennemy_", "").toLowerCase();
    return ENNEMIS_SOLO.find((ennemi) => ennemi.id === id) || ENNEMIS_SOLO[numero % ENNEMIS_SOLO.length];
  }
}
