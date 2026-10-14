"""
Prépare les planches du boss « Chef d'orchestre » pour la borne.

Les images d'origine (2172 x 724 px, environ 1,2 Mo chacune) contiennent 5 frames côte à côte.
Deux problèmes pour la borne (Raspberry Pi 3) :
  - la largeur dépasse 2048 px, la taille maximale d'une texture sur ce GPU ;
  - 2172 n'est pas divisible par 5 : on ne peut pas donner une taille de frame fixe à Phaser.

Ce script isole chaque frame (la baguette ou la cape d'une frame dépasse sur la case voisine,
on ne peut donc pas couper en colonnes), la replace dans une case de taille fixe à son emplacement
d'origine (le boss ne "glisse" pas d'une frame à l'autre), réduit le tout et range les 5 cases
sur une seule ligne.

Utilisation (depuis le dossier du jeu) :
    python outils/integrer_boss.py "chemin/vers/dossier/Boss"
Sources attendues : Tileset_boss_idle.png, tileset_boss_apparition.png, tileset_boss_attaque1.png,
tileset_boss_attaque2.png, tileset_boss_mort.png.  Sorties : assets/images/boss_<nom>.png
"""
import os
import sys

from PIL import Image, ImageChops, ImageFilter

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "assets", "images")
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, "..", "Boss")

NB_FRAMES = 5
MARGE = 50  # px d'origine ajoutés de chaque côté d'une case (cape, bras et baguette dépassent)
HAUT, BAS = 95, 665  # lignes d'origine conservées (le reste est transparent)
ECHELLE = 0.7  # réduction : 5 cases de ~374 px font une planche de ~1870 px (< 2048)
SEUIL_ALPHA = 120  # un pixel plus opaque que ça fait partie du boss (le reste est du liseré)

FICHIERS = {
    "Tileset_boss_idle.png": "boss_idle.png",
    "tileset_boss_apparition.png": "boss_apparition.png",
    "tileset_boss_attaque1.png": "boss_attaque1.png",
    "tileset_boss_attaque2.png": "boss_attaque2.png",
    "tileset_boss_mort.png": "boss_mort.png",
}


def trouver_taches(alpha):
    """Repère les "taches" de pixels opaques (une par frame, plus parfois de la fumée).
    Renvoie une liste de (pixels, colonne_centrale) ; on ne peut pas simplement couper l'image
    en 5 colonnes : la baguette ou la cape d'une frame dépasse sur la case voisine."""
    largeur, hauteur = alpha.size
    donnees = alpha.tobytes()
    vus = bytearray(largeur * hauteur)
    taches = []
    for depart in range(largeur * hauteur):
        if vus[depart] or donnees[depart] <= SEUIL_ALPHA:
            continue
        a_voir = [depart]  # parcours en profondeur : on visite tous les voisins opaques
        vus[depart] = 1
        pixels = []
        while a_voir:
            p = a_voir.pop()
            pixels.append(p)
            x, y = p % largeur, p // largeur
            for voisin_x in (x - 1, x, x + 1):
                for voisin_y in (y - 1, y, y + 1):
                    if 0 <= voisin_x < largeur and 0 <= voisin_y < hauteur:
                        q = voisin_y * largeur + voisin_x
                        if not vus[q] and donnees[q] > SEUIL_ALPHA:
                            vus[q] = 1
                            a_voir.append(q)
        if len(pixels) > 150:  # on ignore les poussières (la fumée de la mort fait quelques centaines de pixels)
            colonnes = [p % largeur for p in pixels]
            taches.append((pixels, (min(colonnes) + max(colonnes)) / 2))
    return taches


def masque_de_frame(taches, numero, largeur, hauteur, case):
    """Image en noir et blanc : blanc sur les pixels de la frame n°numero."""
    masque = bytearray(largeur * hauteur)
    for pixels, centre in taches:
        if int(centre // case) == numero:
            for p in pixels:
                masque[p] = 255
    image = Image.frombytes("L", (largeur, hauteur), bytes(masque))
    return image.filter(ImageFilter.MaxFilter(5))  # on reprend le liseré semi-transparent autour


def preparer(nom_source, nom_sortie):
    image = Image.open(os.path.join(SOURCE, nom_source)).convert("RGBA")
    largeur, hauteur = image.size
    case = largeur / NB_FRAMES  # largeur d'une case de la grille d'origine
    taches = trouver_taches(image.getchannel("A"))

    largeur_case = round(case) + 2 * MARGE
    planche = Image.new("RGBA", (largeur_case * NB_FRAMES, BAS - HAUT), (0, 0, 0, 0))
    for i in range(NB_FRAMES):
        # on ne garde que les pixels de cette frame, à leur position d'origine dans la case
        frame = image.copy()
        frame.putalpha(ImageChops.darker(frame.getchannel("A"), masque_de_frame(taches, i, largeur, hauteur, case)))
        gauche = round(i * case) - MARGE
        morceau = frame.crop((gauche, HAUT, gauche + largeur_case, BAS))
        planche.alpha_composite(morceau, (i * largeur_case, 0))

    # largeur de frame entière après réduction (Phaser en a besoin pour découper la planche)
    largeur_finale = round(largeur_case * ECHELLE)
    planche = planche.resize((largeur_finale * NB_FRAMES, round(planche.height * ECHELLE)), Image.LANCZOS)
    chemin = os.path.join(SORTIE, nom_sortie)
    planche.save(chemin, optimize=True)
    print(nom_sortie, planche.size, "frame", planche.width // NB_FRAMES, "x", planche.height, os.path.getsize(chemin) // 1024, "Ko")


if __name__ == "__main__":
    for source, sortie in FICHIERS.items():
        preparer(source, sortie)
