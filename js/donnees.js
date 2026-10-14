/***********************************************************************/
/** SAUVEGARDE DES DONNÉES (comptes, ELO...) : deux fonctions seulement
/**
/**   const donnees = await lireDonneesJSON();   // lit la sauvegarde (null si rien)
/**   await ecrireDonneesJSON(donnees);          // sauvegarde (remplace tout)
/**
/** Sur la borne, la page charge sa propre version de ce fichier (la base de données
/** de la borne) et celle-ci est ignorée. Sur un ordinateur, on enregistre dans le
/** localStorage du navigateur, sous la clé "arcade_donnees_<nom du dossier du jeu>".
/** (cf. notice_sauvegarde_donnees.pdf : ne pas renommer le dossier du jeu !)
/***********************************************************************/

if (!window.lireDonneesJSON) {
  // nom du dossier du jeu, lu dans l'adresse de la page : /games/2026/theater_showdown/ -> theater_showdown
  const dossiers = window.location.pathname.split("/").filter((morceau) => morceau !== "" && !morceau.includes("."));
  const CLE = "arcade_donnees_" + (dossiers.pop() || "theater_showdown");

  window.lireDonneesJSON = async function () {
    const texte = localStorage.getItem(CLE);
    return texte === null ? null : JSON.parse(texte);
  };

  window.ecrireDonneesJSON = async function (donnees) {
    localStorage.setItem(CLE, JSON.stringify(donnees));
  };
}
