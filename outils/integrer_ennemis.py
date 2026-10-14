"""
Prépare les planches des ennemis du mode solo pour la borne.

Les images d'origine (Ennemy_*.png, 1672 x 941 px, environ 1 Mo) contiennent une grille
de 4 x 2 frames de marche. On découpe chaque frame, on les recadre toutes avec le même cadre
(les pieds restent alignés d'une frame à l'autre), on les réduit à la taille du jeu et on les
range sur une seule ligne. Les noms de sortie sont en minuscules (consigne de la borne).

Utilisation (depuis le dossier theater_showdown) :
    python outils/integrer_ennemis.py [dossier_des_images_sources]
Par défaut, les images sources sont lues dans assets/images.
"""
import os
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(RACINE, "assets", "images")
SOURCE = sys.argv[1] if len(sys.argv) > 1 else IMAGES

COLONNES, LIGNES = 4, 2  # grille des images d'origine
HAUTEUR = 132  # hauteur d'une frame en jeu (le joueur mesure environ 138 px)
LARGEUR = 128  # largeur d'une frame : le personnage est centré dedans

FICHIERS = {
    "Ennemy_cymables.png": "ennemi_cymbales.png",
    "Ennemy_trompette.png": "ennemi_trompette.png",
}


def preparer(source, sortie):
    img = Image.open(os.path.join(SOURCE, source)).convert("RGBA")
    lc, lh = img.width / COLONNES, img.height / LIGNES
    cases = [img.crop((round(c * lc), round(l * lh), round((c + 1) * lc), round((l + 1) * lh)))
             for l in range(LIGNES) for c in range(COLONNES)]

    # même cadrage horizontal pour toutes les frames (le personnage ne glisse pas d'une frame à l'autre)
    # et pieds posés en bas de chaque frame (les deux lignes de l'original ne sont pas à la même hauteur)
    # cadre calculé sur les pixels bien opaques : l'original contient des pixels presque invisibles
    boites = [case.getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox() for case in cases]
    gauche, droite = min(b[0] for b in boites), max(b[2] for b in boites)
    echelle = HAUTEUR / max(b[3] - b[1] for b in boites)
    largeur = round((droite - gauche) * echelle)
    if largeur > LARGEUR:
        raise ValueError(f"{source} : personnage trop large ({largeur} px) pour une frame de {LARGEUR} px")

    planche = Image.new("RGBA", (LARGEUR * len(cases), HAUTEUR), (0, 0, 0, 0))
    for i, (case, boite) in enumerate(zip(cases, boites)):
        hauteur = round((boite[3] - boite[1]) * echelle)
        frame = case.crop((gauche, boite[1], droite, boite[3])).resize((largeur, hauteur), Image.LANCZOS)
        planche.paste(frame, (i * LARGEUR + (LARGEUR - largeur) // 2, HAUTEUR - hauteur))
    chemin = os.path.join(IMAGES, sortie)
    planche.save(chemin, optimize=True)
    print(f"{sortie:24s} {len(cases)} frames de {LARGEUR}x{HAUTEUR}  {os.path.getsize(chemin) / 1024:.1f} Ko")


if __name__ == "__main__":
    for source, sortie in FICHIERS.items():
        preparer(source, sortie)
