import * as fct from "./fonctions.js";
import { creerTouchesDeuxJoueurs } from "./controles.js";
import { chargerComptes, creerCompte, verifierCode, trouverRang, PSEUDO_MIN, PSEUDO_MAX, LONGUEUR_CODE } from "./comptes.js";

/***********************************************************************/
/** CONNEXION AU COMPTE (avant le duel)
/** Chaque joueur se connecte avec SON joystick, chacun de son côté de l'écran :
/**   - il choisit son compte dans la liste, puis tape son code secret (4 chiffres)
/**   - ou il crée un compte (pseudo, puis code)
/**   - ou il joue en "invité" : le duel n'est alors pas classé
/** Quand les deux joueurs sont prêts, on passe au choix des personnages.
/** Les joueurs connectés sont gardés dans le registre du jeu : this.registry.get("joueurs")
/**   -> [ { pseudo: "LEA", elo: 1012 }, null ]   (null = invité)
/***********************************************************************/

const COULEURS = ["#6cb8ff", "#ff6c6c"];
const CENTRES_X = [330, 950];
const LETTRES = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // le premier caractère est un espace (case vide)
const CHIFFRES = "0123456789";
const LIGNES_VISIBLES = 5; // nombre de comptes visibles dans la liste

// Les étapes d'un joueur (panneau.etape) :
//   "liste" -> "code"                       (compte existant)
//   "liste" -> "pseudo" -> "nouveau_code"   (nouveau compte)
//   "liste" -> "pret"                       (invité)
// B revient en arrière, et dans l'étape "pret" B permet de changer de compte.

export default class connexion extends Phaser.Scene {
  constructor() {
    super({ key: "connexion" });
  }

  create() {
    this.enTransition = false;
    this.comptes = [];
    this.cameras.main.fadeIn(300);
    fct.jouerMusique(this, "musique_menu");
    this.registry.set("joueurs", [null, null]);

    this.add.image(640, 360, "fond_scene");
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.55);
    this.add.text(640, 54, "Connexion des artistes", fct.style(44, "#ffd65a")).setOrigin(0.5);
    this.add.text(640, 100, "Connecte-toi pour gagner (ou perdre) des points ELO", fct.style(22, "#e8d8c0")).setOrigin(0.5);
    this.add.text(640, 694, "Joystick : choisir     A : valider     B : retour     Start : classement", fct.style(20, "#e8d8c0")).setOrigin(0.5);

    this.touches = creerTouchesDeuxJoueurs(this);
    this.panneaux = [this.nouveauPanneau(0), this.nouveauPanneau(1)];

    // le bouton Start ouvre le classement par-dessus cet écran
    this.toucheEchap = this.input.keyboard.addKey("ESC");
    const relacherTouches = () => this.input.keyboard.resetKeys();
    this.events.on("resume", relacherTouches);
    this.events.once("shutdown", () => this.events.off("resume", relacherTouches));

    this.actualiserComptes();
  }

  // lit la liste des comptes dans la sauvegarde (fonction asynchrone : on attend la réponse)
  async actualiserComptes() {
    this.comptes = await chargerComptes();
    this.panneaux.forEach((panneau) => this.afficher(panneau));
  }

  // un panneau = tout ce qui concerne un joueur
  nouveauPanneau(j) {
    const panneau = {
      j: j,
      x: CENTRES_X[j],
      etape: "liste",
      index: 0, // ligne choisie dans la liste
      valeurs: [], // case par case : numéros de lettres (pseudo) ou chiffres (code)
      curseur: 0, // case en cours de saisie
      pseudo: "", // pseudo choisi (compte existant ou en création)
      message: "",
      occupe: false, // true pendant qu'on attend la sauvegarde
      objets: [] // textes et formes affichés (détruits à chaque changement)
    };
    this.add.rectangle(panneau.x, 400, 580, 520, 0x12040a, 0.9).setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(COULEURS[j]).color);
    this.add.text(panneau.x, 170, "JOUEUR " + (j + 1), fct.style(34, COULEURS[j])).setOrigin(0.5);
    this.afficher(panneau);
    return panneau;
  }

  /*********************************************************************/
  /** AFFICHAGE : on efface et on redessine le panneau à chaque changement
  /*********************************************************************/
  afficher(panneau) {
    panneau.objets.forEach((objet) => objet.destroy());
    panneau.objets = [];
    const x = panneau.x;
    const ajouter = (objet) => {
      panneau.objets.push(objet);
      return objet;
    };
    const texte = (y, contenu, taille, couleur = "#ffffff") => ajouter(this.add.text(x, y, contenu, fct.style(taille, couleur)).setOrigin(0.5));

    switch (panneau.etape) {
      case "liste":
        texte(225, "Qui es-tu ?", 24, "#e8d8c0");
        this.afficherListe(panneau, texte);
        break;
      case "code":
        texte(260, "Code secret de " + panneau.pseudo, 26);
        this.afficherCases(panneau, ajouter, CHIFFRES, 380);
        break;
      case "pseudo":
        texte(260, "Choisis ton pseudo", 26);
        this.afficherCases(panneau, ajouter, LETTRES, 380);
        texte(470, "↑ ↓ change la lettre     ← → change de case", 17, "#b8a8b0");
        break;
      case "nouveau_code":
        texte(260, "Choisis un code secret (4 chiffres)", 24);
        this.afficherCases(panneau, ajouter, CHIFFRES, 380);
        texte(470, "Retiens-le : il te protégera des intrus !", 17, "#b8a8b0");
        break;
      case "pret": {
        const compte = this.comptes.find((c) => c.pseudo === panneau.pseudo);
        texte(280, "PRÊT !", 56, "#7dff9a");
        if (compte) {
          texte(360, compte.pseudo, 40);
          const rang = trouverRang(compte.elo);
          texte(410, "ELO " + compte.elo + " : " + rang.nom, 26, rang.couleur);
          texte(450, compte.victoires + " victoires, " + compte.defaites + " défaites", 20, "#e8d8c0");
        } else {
          texte(370, "Invité", 40);
          texte(420, "Duel non classé", 24, "#e8d8c0");
        }
        texte(540, "B : changer de compte", 18, "#b8a8b0");
        break;
      }
    }
    if (panneau.message) texte(590, panneau.message, 22, "#ff8a8a");
  }

  // liste de comptes : on voit LIGNES_VISIBLES lignes à la fois, la ligne choisie reste visible
  afficherListe(panneau, texte) {
    const lignes = this.comptes.map((c) => ({ texte: c.pseudo + "  " + c.elo, couleur: trouverRang(c.elo).couleur, pseudo: c.pseudo }));
    lignes.push({ texte: "+ Nouveau compte", couleur: "#7dff9a", nouveau: true });
    lignes.push({ texte: "Invité (sans classement)", couleur: "#b8a8b0", invite: true });
    panneau.lignes = lignes;

    const premiere = Phaser.Math.Clamp(panneau.index - Math.floor(LIGNES_VISIBLES / 2), 0, Math.max(0, lignes.length - LIGNES_VISIBLES));
    lignes.slice(premiere, premiere + LIGNES_VISIBLES).forEach((ligne, i) => {
      const choisie = premiere + i === panneau.index;
      const t = texte(290 + i * 62, (choisie ? "▶ " : "") + ligne.texte + (choisie ? " ◀" : ""), choisie ? 34 : 28, choisie ? "#ffd65a" : ligne.couleur);
      if (!choisie) t.setAlpha(0.8);
    });
    if (premiere > 0) texte(250, "▲", 18, "#b8a8b0");
    if (premiere + LIGNES_VISIBLES < lignes.length) texte(610, "▼", 18, "#b8a8b0");
  }

  // cases de saisie (pseudo ou code) : la case en cours est entourée en doré
  afficherCases(panneau, ajouter, caracteres, y) {
    const nombre = panneau.valeurs.length;
    const largeur = nombre > 4 ? 56 : 80;
    panneau.valeurs.forEach((valeur, i) => {
      const cx = panneau.x + (i - (nombre - 1) / 2) * (largeur + 6);
      const courante = i === panneau.curseur;
      ajouter(this.add.rectangle(cx, y, largeur, 80, 0x2a0a14).setStrokeStyle(courante ? 5 : 2, courante ? 0xffd65a : 0x806070));
      // un code s'affiche avec des étoiles, pour que l'autre joueur ne le lise pas
      const lettre = panneau.etape === "pseudo" ? caracteres[valeur] : courante ? caracteres[valeur] : "*";
      ajouter(this.add.text(cx, y, lettre, fct.style(46, courante ? "#ffd65a" : "#ffffff")).setOrigin(0.5));
    });
  }

  /*********************************************************************/
  /** COMMANDES
  /*********************************************************************/
  update() {
    if (this.enTransition) return;
    // Start (ou Échap) : classement. À lire avant lireAppuis, qui "consomme" les appuis.
    const demandeClassement = Phaser.Input.Keyboard.JustDown(this.toucheEchap) || this.touches.some((t) => Phaser.Input.Keyboard.JustDown(t.start));
    if (demandeClassement) {
      fct.jouerSon(this, "menu_valider");
      this.scene.launch("classement", { retour: "connexion" });
      this.scene.bringToTop("classement");
      this.scene.pause();
      return;
    }

    this.touches.forEach((touches, j) => {
      const panneau = this.panneaux[j];
      const appuis = fct.lireAppuis(touches);
      if (!panneau.occupe && !this.enTransition) this.gererJoueur(panneau, appuis);
    });
  }

  gererJoueur(panneau, appuis) {
    const etape = panneau.etape;
    let changement = false;

    if (appuis.B) {
      changement = this.retourArriere(panneau);
    } else if (etape === "liste") {
      if (appuis.haut || appuis.bas) {
        panneau.index = fct.boucler(panneau.index + (appuis.haut ? -1 : 1), panneau.lignes.length);
        changement = true;
        fct.jouerSon(this, "menu_deplacer", 0.5);
      }
      if (appuis.A) this.validerLigne(panneau);
    } else if (etape === "code" || etape === "pseudo" || etape === "nouveau_code") {
      changement = this.saisir(panneau, appuis);
      if (appuis.A) this.validerSaisie(panneau);
    }

    if (changement) {
      panneau.message = "";
      this.afficher(panneau);
    }
  }

  // renvoie true si l'affichage doit être mis à jour
  retourArriere(panneau) {
    fct.jouerSon(this, "menu_deplacer", 0.5);
    switch (panneau.etape) {
      case "liste":
        // retour au menu principal (le rideau se referme)
        fct.transitionRideau(this, "rideau_fermeture", () => this.scene.start("menu"));
        return false;
      case "nouveau_code":
        this.commencerSaisie(panneau, "pseudo", PSEUDO_MAX);
        break;
      default:
        panneau.etape = "liste"; // "code", "pseudo" ou "pret"
        this.enregistrerJoueur(panneau.j, null);
    }
    return true;
  }

  // le joueur a validé une ligne de la liste (un compte, "Nouveau compte" ou "Invité")
  validerLigne(panneau) {
    const ligne = panneau.lignes[panneau.index];
    fct.jouerSon(this, "menu_valider");
    if (ligne.nouveau) {
      this.commencerSaisie(panneau, "pseudo", PSEUDO_MAX);
    } else if (ligne.invite) {
      panneau.pseudo = "";
      this.passerPret(panneau, null);
    } else if (this.pseudoDejaPris(panneau, ligne.pseudo)) {
      panneau.message = "Déjà connecté de l'autre côté !";
    } else {
      panneau.pseudo = ligne.pseudo;
      this.commencerSaisie(panneau, "code", LONGUEUR_CODE);
    }
    this.afficher(panneau);
  }

  // prépare les cases de saisie : un pseudo commence par "A", un code par des "0"
  commencerSaisie(panneau, etape, nombreDeCases) {
    panneau.etape = etape;
    panneau.valeurs = new Array(nombreDeCases).fill(0);
    if (etape === "pseudo") panneau.valeurs[0] = 1; // "A"
    panneau.curseur = 0;
  }

  // joystick : ← → changent de case, ↑ ↓ changent le chiffre ou la lettre. Renvoie true si ça a changé.
  saisir(panneau, appuis) {
    const nbChoix = panneau.etape === "pseudo" ? LETTRES.length : CHIFFRES.length;
    let changement = false;
    if (appuis.gauche || appuis.droite) {
      panneau.curseur = fct.boucler(panneau.curseur + (appuis.gauche ? -1 : 1), panneau.valeurs.length);
      changement = true;
    }
    if (appuis.haut || appuis.bas) {
      const i = panneau.curseur;
      panneau.valeurs[i] = fct.boucler(panneau.valeurs[i] + (appuis.haut ? 1 : -1), nbChoix);
      changement = true;
    }
    if (changement) fct.jouerSon(this, "menu_deplacer", 0.4);
    return changement;
  }

  // le joueur a appuyé sur A pendant une saisie
  async validerSaisie(panneau) {
    const caracteres = panneau.etape === "pseudo" ? LETTRES : CHIFFRES;
    const saisie = panneau.valeurs.map((numero) => caracteres[numero]).join("").replaceAll(" ", "");

    if (panneau.etape === "pseudo") {
      if (saisie.length < PSEUDO_MIN) {
        panneau.message = "Au moins " + PSEUDO_MIN + " lettres";
      } else if (this.comptes.some((c) => c.pseudo === saisie)) {
        panneau.message = "Ce pseudo existe déjà";
      } else if (this.pseudoDejaPris(panneau, saisie)) {
        panneau.message = "Pseudo pris par l'autre joueur";
      } else {
        panneau.pseudo = saisie;
        this.commencerSaisie(panneau, "nouveau_code", LONGUEUR_CODE);
        fct.jouerSon(this, "menu_valider");
      }
    } else {
      panneau.occupe = true; // on attend la base de données : pas de nouvel appui pendant ce temps
      if (panneau.etape === "code") {
        if (await verifierCode(panneau.pseudo, saisie)) {
          this.passerPret(panneau, panneau.pseudo);
        } else {
          panneau.message = "Code incorrect";
          fct.jouerSon(this, "qte_rate", 0.5);
          this.commencerSaisie(panneau, "code", LONGUEUR_CODE);
        }
      } else {
        const resultat = await creerCompte(panneau.pseudo, saisie);
        if (resultat.ok) {
          await this.actualiserComptes();
          this.passerPret(panneau, panneau.pseudo);
        } else {
          panneau.message = resultat.message;
        }
      }
      panneau.occupe = false;
    }
    this.afficher(panneau);
  }

  // true si l'autre joueur est déjà connecté avec ce pseudo
  pseudoDejaPris(panneau, pseudo) {
    const autre = this.registry.get("joueurs")[1 - panneau.j];
    return autre !== null && autre.pseudo === pseudo;
  }

  enregistrerJoueur(j, pseudo) {
    const joueurs = this.registry.get("joueurs");
    const compte = this.comptes.find((c) => c.pseudo === pseudo);
    joueurs[j] = compte ? { pseudo: compte.pseudo, elo: compte.elo } : null; // null = invité
    this.registry.set("joueurs", joueurs);
  }

  passerPret(panneau, pseudo) {
    panneau.etape = "pret";
    this.enregistrerJoueur(panneau.j, pseudo);
    fct.jouerSon(this, "qte_ok", 0.6);
    this.afficher(panneau);

    // les deux joueurs sont prêts : on passe au choix des personnages
    if (this.panneaux.every((p) => p.etape === "pret")) {
      this.time.delayedCall(900, () => {
        if (this.panneaux.every((p) => p.etape === "pret")) fct.changerScene(this, "selection");
      });
    }
  }
}
