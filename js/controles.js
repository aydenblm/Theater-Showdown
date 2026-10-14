/***********************************************************************/
/** CONTRÔLES DE LA BORNE D'ARCADE
/** Chaque joueur a un joystick et 6 boutons, nommés A à F pour le joueur.
/** Côté développeur, la borne envoie les touches clavier ci-dessous.
/**
/**   Joueur 1 :  joystick = flèches     A B C = I O P    D E F = K L M    Start = X
/**   Joueur 2 :  joystick = Z Q S D     A B C = R T Y    D E F = F G H    Start = N
/** (le bouton Select du joueur 1 envoie W : la borne l'utilise pour quitter le jeu)
/***********************************************************************/

export const TOUCHES = {
  1: { gauche: "LEFT", droite: "RIGHT", haut: "UP", bas: "DOWN", A: "I", B: "O", C: "P", D: "K", E: "L", F: "M", start: "X" },
  2: { gauche: "Q", droite: "D", haut: "Z", bas: "S", A: "R", B: "T", C: "Y", D: "F", E: "G", F: "H", start: "N" }
};

// crée les objets Key de Phaser pour un joueur : touches.gauche.isDown, touches.A ...
export function creerTouches(scene, numero) {
  return scene.input.keyboard.addKeys(TOUCHES[numero]);
}

// renvoie les touches des deux joueurs : [touchesJ1, touchesJ2]
export function creerTouchesDeuxJoueurs(scene) {
  return [creerTouches(scene, 1), creerTouches(scene, 2)];
}
