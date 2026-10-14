/***********************************************************************/
/** COMPTES JOUEURS ET CLASSEMENT ELO (mode duel classé)
/**
/** Toute la "base de données" du jeu tient dans UNE valeur JSON, lue et écrite avec
/** lireDonneesJSON() / ecrireDonneesJSON() (voir donnees.js). Sa forme :
/**
/**   { "comptes": [
/**       { "pseudo": "LEA", "code": "k3f9a2", "elo": 1012, "victoires": 3, "defaites": 1, "nuls": 0 },
/**       { "pseudo": "HUGO", "code": "p0z8w1", "elo": 988, "victoires": 1, "defaites": 3, "nuls": 0 }
/**   ] }
/**
/** Règle de la notice : ecrireDonneesJSON remplace tout. On suit donc toujours
/** les trois étapes  LIRE -> MODIFIER -> RÉÉCRIRE  (voir sauvegarderComptes).
/***********************************************************************/

export const ELO_DEPART = 1000;
export const COEFFICIENT_K = 32; // plus il est grand, plus l'ELO bouge vite après un match
export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 8;
export const LONGUEUR_CODE = 4; // code secret à 4 chiffres (la borne n'a pas de clavier)

// Rangs : le premier dont le minimum est atteint (en partant du haut) est celui du joueur
const RANGS = [
  { elo: 1300, nom: "Chef d'orchestre", couleur: "#ffd65a" },
  { elo: 1150, nom: "Soliste", couleur: "#e05ab4" },
  { elo: 1000, nom: "Musicien", couleur: "#6cb8ff" },
  { elo: 0, nom: "Figurant", couleur: "#b8a8b0" }
];

export function trouverRang(elo) {
  return RANGS.find((rang) => elo >= rang.elo);
}

/*********************************************************************/
/** LECTURE ET ÉCRITURE
/*********************************************************************/

// renvoie la liste des comptes (liste vide au tout premier lancement)
export async function chargerComptes() {
  const donnees = await lireDonneesJSON(); // null si rien n'a encore été sauvegardé
  if (donnees === null || !Array.isArray(donnees.comptes)) return [];
  return donnees.comptes;
}

async function sauvegarderComptes(comptes) {
  await ecrireDonneesJSON({ comptes: comptes });
}

// Les fonctions qui MODIFIENT la sauvegarde passent par cette "file d'attente" : si deux joueurs
// valident en même temps, la deuxième attend la fin de la première (sinon elle lirait l'ancienne
// liste, et la sauvegarde de l'un effacerait celle de l'autre).
let tacheEnCours = Promise.resolve();
function enFile(tache) {
  const resultat = tacheEnCours.then(tache);
  tacheEnCours = resultat.catch(() => {}); // une erreur ne doit pas bloquer les suivantes
  return resultat;
}

export function trouverCompte(comptes, pseudo) {
  return comptes.find((compte) => compte.pseudo === pseudo);
}

/*********************************************************************/
/** CONNEXION ET CRÉATION DE COMPTE
/*********************************************************************/

// Transforme le code secret en texte illisible. Ce n'est pas une vraie protection
// (les données sont dans le navigateur), mais le code n'apparaît pas en clair.
function brouillerCode(pseudo, code) {
  const texte = pseudo + "#" + code;
  let nombre = 7;
  for (const lettre of texte) {
    nombre = (nombre * 31 + lettre.charCodeAt(0)) % 1000000007;
  }
  return nombre.toString(36);
}

// renvoie { ok: true } ou { ok: false, message: "..." }
export function creerCompte(pseudo, code) {
  return enFile(async () => {
    if (pseudo.length < PSEUDO_MIN) return { ok: false, message: "Pseudo trop court" };
    const comptes = await chargerComptes();
    if (trouverCompte(comptes, pseudo)) return { ok: false, message: "Ce pseudo existe déjà" };

    comptes.push({ pseudo: pseudo, code: brouillerCode(pseudo, code), elo: ELO_DEPART, victoires: 0, defaites: 0, nuls: 0 });
    await sauvegarderComptes(comptes);
    return { ok: true };
  });
}

// renvoie true si le code correspond au compte
export async function verifierCode(pseudo, code) {
  const compte = trouverCompte(await chargerComptes(), pseudo);
  return compte !== undefined && compte.code === brouillerCode(pseudo, code);
}

/*********************************************************************/
/** ELO
/*********************************************************************/

// Probabilité de victoire du joueur A contre B selon l'écart d'ELO (formule officielle)
export function probabiliteVictoire(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// scoreA : 1 = A gagne, 0.5 = match nul, 0 = A perd. Renvoie le nouvel ELO de A.
// Battre un joueur plus fort rapporte plus de points que battre un joueur plus faible.
export function nouvelElo(eloA, eloB, scoreA) {
  return Math.round(eloA + COEFFICIENT_K * (scoreA - probabiliteVictoire(eloA, eloB)));
}

// Enregistre le résultat d'un match classé entre deux comptes.
// gagnant : 1, 2 ou 0 (match nul). Renvoie les ELO avant / après de chaque joueur.
export function enregistrerMatch(pseudo1, pseudo2, gagnant) {
  return enFile(async () => {
    const comptes = await chargerComptes(); // 1. LIRE
    const c1 = trouverCompte(comptes, pseudo1);
    const c2 = trouverCompte(comptes, pseudo2);
    if (!c1 || !c2) return null;

    const score1 = gagnant === 1 ? 1 : gagnant === 2 ? 0 : 0.5;
    const resultat = { avant: [c1.elo, c2.elo], apres: [0, 0] };

    // 2. MODIFIER
    resultat.apres = [nouvelElo(c1.elo, c2.elo, score1), nouvelElo(c2.elo, c1.elo, 1 - score1)];
    c1.elo = resultat.apres[0];
    c2.elo = resultat.apres[1];
    if (gagnant === 0) {
      c1.nuls++;
      c2.nuls++;
    } else {
      (gagnant === 1 ? c1 : c2).victoires++;
      (gagnant === 1 ? c2 : c1).defaites++;
    }

    await sauvegarderComptes(comptes); // 3. RÉÉCRIRE
    return resultat;
  });
}

// les meilleurs joueurs d'abord (à égalité d'ELO : celui qui a le plus de victoires)
export async function meilleursJoueurs(nombre = 8) {
  const comptes = await chargerComptes();
  comptes.sort((a, b) => b.elo - a.elo || b.victoires - a.victoires);
  return comptes.slice(0, nombre);
}
