/***********************************************************************/
/** FONCTIONS UTILITAIRES partagées par toutes les scènes
/***********************************************************************/

// style de texte commun au jeu (police à empattement, contour sombre)
export function style(taille, couleur = "#ffffff") {
  return {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: taille + "px",
    fontStyle: "bold",
    color: couleur,
    stroke: "#1a0008",
    strokeThickness: Math.max(3, Math.round(taille / 7)),
    align: "center"
  };
}

// convertit une couleur 0xRRGGBB en chaîne "#rrggbb" (pour les textes)
export function couleurTexte(couleur) {
  return "#" + couleur.toString(16).padStart(6, "0");
}

// Lit, UNE seule fois par frame, les touches qui viennent d'être enfoncées.
// (JustDown "consomme" l'appui : il ne faut l'appeler qu'une fois par touche et par frame)
export function lireAppuis(touches) {
  const appuis = {};
  for (const nom in touches) {
    appuis[nom] = Phaser.Input.Keyboard.JustDown(touches[nom]);
  }
  return appuis;
}

// ramène un index dans [0, nombre - 1] en bouclant : -1 devient nombre - 1, nombre devient 0
// (Phaser.Math.Wrap de Phaser 3.60 inclut la borne max, d'où cette fonction)
export function boucler(index, nombre) {
  return ((index % nombre) + nombre) % nombre;
}

// choisit un élément au hasard en tenant compte de son "poids" (probabilité relative)
export function tirageAuSort(liste) {
  const total = liste.reduce((somme, element) => somme + element.poids, 0);
  let tirage = Math.random() * total;
  for (const element of liste) {
    tirage -= element.poids;
    if (tirage < 0) return element;
  }
  return liste[liste.length - 1];
}

/***********************************************************************/
/** SONS ET MUSIQUE
/***********************************************************************/

export function jouerSon(scene, cle, volume = 0.6) {
  scene.sound.play(cle, { volume: volume });
}

// La musique est partagée entre les scènes : on la garde dans le registre du jeu
// pour ne pas la relancer à chaque changement de scène.
export function jouerMusique(scene, cle, volume = 0.45) {
  const actuelle = scene.registry.get("musique");
  if (actuelle && actuelle.key === cle && actuelle.isPlaying) return;
  arreterMusique(scene);
  const musique = scene.sound.add(cle, { loop: true, volume: volume });
  musique.play();
  scene.registry.set("musique", musique);
}

export function arreterMusique(scene) {
  const actuelle = scene.registry.get("musique");
  if (actuelle) actuelle.destroy();
  scene.registry.set("musique", null);
}

/***********************************************************************/
/** EFFETS VISUELS
/***********************************************************************/

// petit texte qui monte puis disparaît (dégâts, bonus, combos...)
export function texteFlottant(scene, x, y, texte, couleur = "#ffffff", taille = 26) {
  const t = scene.add.text(x, y, texte, style(taille, couleur)).setOrigin(0.5).setDepth(150);
  scene.tweens.add({
    targets: t,
    y: y - 60,
    alpha: 0,
    duration: 1000,
    ease: "Cubic.easeOut",
    onComplete: () => t.destroy()
  });
}

// étincelles d'impact
export function etincelles(scene, x, y, teinte = 0xffffff, nombre = 4) {
  for (let i = 0; i < nombre; i++) {
    const e = scene.add.image(x, y, "etincelle").setTint(teinte).setDepth(40);
    scene.tweens.add({
      targets: e,
      x: x + Phaser.Math.Between(-40, 40),
      y: y + Phaser.Math.Between(-40, 30),
      scale: { from: 1.4, to: 0.2 },
      angle: Phaser.Math.Between(-180, 180),
      alpha: 0,
      duration: 350,
      onComplete: () => e.destroy()
    });
  }
}

// fondu au noir puis lancement d'une autre scène
export function changerScene(scene, cle, donnees) {
  if (scene.enTransition) return;
  scene.enTransition = true;
  scene.cameras.main.fadeOut(300, 0, 0, 0);
  scene.cameras.main.once("camerafadeoutcomplete", () => scene.scene.start(cle, donnees));
}

/***********************************************************************/
/** MENU VERTICAL piloté au joystick (menu principal, écran de victoire)
/***********************************************************************/

// options : [{ texte: "...", actif: true/false, ... }]
export function creerMenu(scene, options, x, y, ecart) {
  const menu = { index: 0, options: options, textes: [] };
  options.forEach((option, i) => {
    const couleur = option.actif === false ? "#8a7f86" : "#ffffff";
    menu.textes.push(scene.add.text(x, y + i * ecart, option.texte, style(40, couleur)).setOrigin(0.5).setDepth(20));
  });
  menu.curseurGauche = scene.add.image(0, 0, "note_hud").setTint(0xf5c542).setScale(1.3).setDepth(20);
  menu.curseurDroit = scene.add.image(0, 0, "note_hud").setTint(0xf5c542).setScale(1.3).setDepth(20).setFlipX(true);
  // petite oscillation des curseurs
  scene.tweens.add({ targets: [menu.curseurGauche, menu.curseurDroit], angle: { from: -12, to: 12 }, duration: 500, yoyo: true, repeat: -1 });
  majMenu(menu);
  return menu;
}

function majMenu(menu) {
  menu.textes.forEach((texte, i) => {
    const choisi = i === menu.index;
    texte.setScale(choisi ? 1.12 : 1);
    if (menu.options[i].actif !== false) texte.setColor(choisi ? "#ffd65a" : "#ffffff");
  });
  const t = menu.textes[menu.index];
  menu.curseurGauche.setPosition(t.x - t.displayWidth / 2 - 30, t.y);
  menu.curseurDroit.setPosition(t.x + t.displayWidth / 2 + 30, t.y);
}

// À appeler dans update() : gère haut/bas des deux joysticks.
// Renvoie l'option validée avec le bouton A, "retour" si B est pressé, sinon null.
export function lireMenu(scene, menu, listeTouches) {
  for (const touches of listeTouches) {
    const appuis = lireAppuis(touches);
    if (appuis.haut || appuis.bas) {
      menu.index = boucler(menu.index + (appuis.haut ? -1 : 1), menu.options.length);
      jouerSon(scene, "menu_deplacer", 0.5);
      majMenu(menu);
    }
    if (appuis.A) return menu.options[menu.index];
    if (appuis.B) return "retour";
  }
  return null;
}
