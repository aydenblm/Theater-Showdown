"""
Dessine par programme les images du mode solo qui n'existent pas dans les visuels de l'équipe :
  - ennemi_croche  : une croche folle qui vole vers le joueur (planche de 8 frames, pixel art)
  - ennemi_tambour : un tambour qui rebondit vers le joueur (planche de 8 frames, pixel art)
  - touche_piano   : la touche de piano que le boss envoie et que le joueur lui renvoie

Même format que les musiciens (outils/integrer_ennemis.py) : 8 frames de 128 x 132 px sur une ligne.
On dessine en petit (32 x 33 pixels) puis on agrandit x4 sans lissage, et on ajoute un contour sombre.
Ce sont des dessins provisoires : l'équipe peut les remplacer par de vrais sprites de même format.

Utilisation (depuis le dossier du jeu) :
    python outils/generer_images_solo.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "assets", "images")

PETIT = (32, 33)  # taille d'une frame dessinée
ZOOM = 4  # 32 x 4 = 128 px de large
CONTOUR = (26, 0, 8, 255)

NOIR = (43, 27, 58, 255)
NOIR_CLAIR = (90, 58, 122, 255)
OR = (242, 182, 50, 255)
OR_CLAIR = (255, 224, 138, 255)
BLANC = (255, 255, 255, 255)
ROUGE = (192, 42, 58, 255)
ROUGE_SOMBRE = (130, 24, 40, 255)
CREME = (245, 236, 208, 255)
BOIS = (120, 78, 40, 255)


def nouvelle_frame():
    image = Image.new("RGBA", PETIT, (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def yeux(dessin, x, y, ecart=4):
    """Deux yeux en colère : un blanc avec une pupille, et un sourcil qui descend vers le centre."""
    for cote in (-1, 1):
        cx = x + cote * ecart // 2
        dessin.rectangle((cx - 1, y, cx, y + 2), fill=BLANC)
        dessin.point((cx if cote < 0 else cx - 1, y + 1), fill=(0, 0, 0, 255))
        dessin.line((cx - 1, y - 1 - (cote > 0), cx, y - 1 - (cote < 0)), fill=(0, 0, 0, 255))


def avec_contour(image):
    """Ajoute un contour sombre d'un pixel autour du dessin."""
    alpha = image.getchannel("A")
    bord = alpha.filter(ImageFilter.MaxFilter(3))
    contour = Image.new("RGBA", image.size, CONTOUR)
    contour.putalpha(bord)
    contour.alpha_composite(image)
    return contour


def croche(frame):
    """Croche volante : la tête noire et la hampe restent en place, les ailes battent."""
    image, d = nouvelle_frame()
    hauteur_aile = [-6, -2, 3, -2][frame % 4]  # haut, milieu, bas, milieu
    # ailes dorées de chaque côté de la tête
    for cote in (-1, 1):
        bout_x = 16 + cote * 13
        d.polygon([(16 + cote * 4, 19), (bout_x, 19 + hauteur_aile), (16 + cote * 9, 22 + hauteur_aile // 2), (16 + cote * 4, 23)], fill=OR)
        d.line((16 + cote * 4, 20, bout_x, 19 + hauteur_aile), fill=OR_CLAIR)
    # hampe et crochet de la croche
    d.rectangle((20, 6, 21, 21), fill=NOIR)
    d.polygon([(21, 6), (27, 10), (27, 15), (21, 11)], fill=NOIR)
    # tête
    d.ellipse((10, 17, 21, 26), fill=NOIR)
    d.ellipse((12, 18, 15, 20), fill=NOIR_CLAIR)
    yeux(d, 15, 21)
    return avec_contour(image)


def tambour(frame):
    """Tambour qui s'écrase (0), s'étire en l'air (1, 2) puis retombe (3)."""
    image, d = nouvelle_frame()
    # (largeur, hauteur, hauteur au-dessus du sol) selon la frame
    largeur, hauteur, saut = [(18, 11, 0), (13, 17, 4), (13, 17, 8), (16, 13, 2)][frame % 4]
    bas = 31 - saut
    haut = bas - hauteur
    x0 = 16 - largeur // 2
    x1 = x0 + largeur - 1
    # pattes (écartées en l'air)
    ecart = 1 if saut == 0 else 3
    d.rectangle((x0 + 1 - ecart // 3, bas, x0 + 3, min(bas + 2, 31)), fill=BOIS)
    d.rectangle((x1 - 3, bas, x1 - 1 + ecart // 3, min(bas + 2, 31)), fill=BOIS)
    # fût rouge, tirants en zigzag, peau et cerclages dorés
    d.rectangle((x0, haut + 2, x1, bas), fill=ROUGE)
    d.line((x0, haut + 2, x0, bas), fill=ROUGE_SOMBRE)
    for x in range(x0 + 2, x1 - 1, 4):
        d.line((x, haut + 3, x + 2, bas - 1), fill=CREME)
    d.rectangle((x0, haut + 2, x1, haut + 3), fill=OR)
    d.rectangle((x0, bas - 1, x1, bas), fill=OR)
    d.ellipse((x0, haut - 1, x1, haut + 5), fill=CREME, outline=OR)
    yeux(d, 16, haut + 7, 6)
    # baguettes dans les "mains" qui s'agitent
    pos = [(-1, 1), (-2, -2), (-3, -4), (-2, 0)][frame % 4]
    d.line((x0 - 1, haut + 7, x0 - 4, haut + 7 + pos[0] * 2), fill=BOIS)
    d.line((x1 + 1, haut + 7, x1 + 4, haut + 7 + pos[1] * 2), fill=BOIS)
    return avec_contour(image)


def planche(nom, dessiner):
    """8 frames : les 4 dessins, deux fois de suite (les ennemis ont une animation de 8 frames)."""
    frames = [dessiner(i) for i in range(4)] * 2
    resultat = Image.new("RGBA", (PETIT[0] * ZOOM * 8, PETIT[1] * ZOOM), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        agrandie = frame.resize((PETIT[0] * ZOOM, PETIT[1] * ZOOM), Image.NEAREST)
        resultat.alpha_composite(agrandie, (i * PETIT[0] * ZOOM, 0))
    chemin = os.path.join(SORTIE, nom + ".png")
    resultat.save(chemin, optimize=True)
    print(nom, resultat.size, os.path.getsize(chemin) // 1024, "Ko")


def touche_piano():
    """Une touche blanche avec sa touche noire, dessinée à la verticale (le jeu la fait pivoter)."""
    image = Image.new("RGBA", (30, 76), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((1, 1, 28, 74), radius=4, fill=CONTOUR)
    d.rounded_rectangle((3, 3, 26, 72), radius=3, fill=CREME)
    d.rectangle((3, 60, 26, 72), fill=(214, 200, 168, 255))  # ombre du bas de la touche
    d.rectangle((5, 4, 6, 58), fill=BLANC)  # reflet
    d.rounded_rectangle((7, 3, 22, 42), radius=3, fill=CONTOUR)  # touche noire
    d.rounded_rectangle((8, 4, 21, 38), radius=2, fill=NOIR)
    d.rectangle((10, 6, 11, 32), fill=NOIR_CLAIR)
    chemin = os.path.join(SORTIE, "touche_piano.png")
    image.save(chemin, optimize=True)
    print("touche_piano", image.size, os.path.getsize(chemin), "octets")


if __name__ == "__main__":
    planche("ennemi_croche", croche)
    planche("ennemi_tambour", tambour)
    touche_piano()
