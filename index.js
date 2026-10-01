// chargement des scènes du jeu
import chargement from "./js/chargement.js";
import menu from "./js/menu.js";
import commandes from "./js/commandes.js";
import selection from "./js/selection.js";
import selection_arene from "./js/selection_arene.js";
import combat from "./js/combat.js";
import victoire from "./js/victoire.js";
import pause from "./js/pause.js";

// configuration générale du jeu
var config = {
  width: 1280, // largeur en pixels (résolution de la borne)
  height: 720, // hauteur en pixels
  type: Phaser.AUTO,
  backgroundColor: "#12040a",
  scale: {
    mode: Phaser.Scale.FIT,
    parent: "game-container",
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "arcade", // mode arcade : des rectangles pour gérer les collisions
    arcade: {
      gravity: {
        y: 1400 // gravité forte : sauts vifs, adaptés à un jeu de combat
      },
      debug: false // mettre à true pour voir les hitbox
    }
  },
  // la première scène de la liste (chargement) est lancée automatiquement
  scene: [chargement, menu, commandes, selection, selection_arene, combat, victoire, pause],
  baseURL: window.location.pathname.replace(/\/[^/]*$/, "")
};

// création et lancement du jeu
var game = new Phaser.Game(config);
