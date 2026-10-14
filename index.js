// sauvegarde des données (comptes, ELO) : doit être importé avant le reste
import "./js/donnees.js";
// chargement des scènes du jeu
import chargement from "./js/chargement.js";
import menu from "./js/menu.js";
import commandes from "./js/commandes.js";
import selection from "./js/selection.js";
import selection_arene from "./js/selection_arene.js";
import combat from "./js/combat.js";
import victoire from "./js/victoire.js";
import pause from "./js/pause.js";
import connexion from "./js/connexion.js";
import classement from "./js/classement.js";
import solo from "./js/solo.js";
import boss from "./js/boss.js";
import hud_solo from "./js/hud_solo.js";

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
  // réglages pour le GPU modeste du Raspberry Pi 3 de la borne
  render: {
    antialiasGL: false, // pas d'anticrénelage MSAA : très coûteux sur ce GPU
    powerPreference: "high-performance",
    roundPixels: true // positions entières : moins de scintillement sur le pixel art
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
  scene: [chargement, menu, commandes, connexion, classement, selection, selection_arene, combat, victoire, pause, solo, boss, hud_solo],
  baseURL: window.location.pathname.replace(/\/[^/]*$/, "")
};

// création et lancement du jeu (exporté : la borne importe "game" depuis index.js)
export var game = new Phaser.Game(config);

// La musique est lue en dehors de Phaser (voir fonctions.js) : on la coupe quand la borne ferme le jeu
function couperMusique() {
  const musique = game.registry.get("musique");
  if (musique) musique.audio.pause();
}
game.events.once("destroy", couperMusique);
window.addEventListener("pagehide", couperMusique);
