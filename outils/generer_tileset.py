"""
Génère le tileset du mode solo (cartes Tiled) dans le style pixel art du jeu :
mêmes couleurs que les plateformes existantes (bois, dorures, velours rouge, métal),
même taille de "gros pixel" (2 px), contour sombre.

Tuiles de 32x32 px = 16x16 gros pixels. Produit :
  assets/images/tileset_theatre.png   l'image du tileset
  assets/maps/tileset_theatre.tsx     le tileset pour Tiled (propriétés estSolide, unSens, echelle)
  assets/maps/exemple_solo.tmj        une carte d'exemple qui utilise toutes les familles de tuiles

Utilisation (depuis le dossier theater_showdown) :
    python outils/generer_tileset.py
"""
import json
import os
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(RACINE, "assets", "images")
MAPS = os.path.join(RACINE, "assets", "maps")
os.makedirs(MAPS, exist_ok=True)

T = 16  # tuile en gros pixels
ECHELLE = 2  # 1 gros pixel = 2 px (comme les plateformes du jeu)
COLONNES = 8

# --- palette relevée sur balcon.png, plateforme_bois.png, caisse_bois.png, poutre_suspendue.png ---
O = (26, 5, 8)  # contour
G0, G1, G2, G3, G4 = (255, 242, 178), (246, 213, 106), (224, 168, 42), (176, 110, 24), (122, 60, 14)  # or
W0, W1, W2, W3, W4 = (244, 186, 120), (218, 144, 80), (184, 108, 52), (140, 74, 32), (92, 42, 18)  # bois clair
P0, P1, P2, P3 = (160, 98, 50), (128, 72, 34), (98, 52, 24), (64, 30, 14)  # bois foncé (planches)
R0, R1, R2, R3 = (190, 52, 56), (140, 26, 36), (84, 12, 20), (60, 10, 18)  # velours rouge
M0, M1, M2, M3 = (212, 218, 232), (156, 164, 184), (104, 112, 132), (60, 64, 80)  # métal
K0, K1, K2 = (78, 72, 92), (42, 38, 52), (22, 18, 28)  # laque noire du piano
I0, I1 = (250, 244, 230), (214, 204, 186)  # ivoire
B0, B1, B2 = (74, 24, 32), (54, 16, 24), (38, 10, 16)  # mur sombre du théâtre
L0, L1 = (255, 236, 160), (255, 196, 80)  # lumière


class Tuile:
    def __init__(self):
        self.img = Image.new("RGBA", (T, T), (0, 0, 0, 0))

    def px(self, x, y, c):
        if 0 <= x < T and 0 <= y < T:
            self.img.putpixel((x, y), c + (255,))

    def rect(self, x0, y0, x1, y1, c):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                self.px(x, y, c)

    def hligne(self, y, c, x0=0, x1=T - 1):
        self.rect(x0, y, x1, y, c)

    def vligne(self, x, c, y0=0, y1=T - 1):
        self.rect(x, y0, x, y1, c)

    def efface(self, x, y):
        self.img.putpixel((x, y), (0, 0, 0, 0))

    def miroir(self):
        t = Tuile()
        t.img = self.img.transpose(Image.FLIP_LEFT_RIGHT)
        return t


# ---------------------------------------------------------------------------
# Plancher de la scène (bloc plein, 9 morceaux)
# ---------------------------------------------------------------------------
def planches(t, y_debut=0):
    """Planches horizontales de 4 gros pixels, joints décalés d'une rangée à l'autre."""
    for y0 in range(y_debut, T, 4):
        rangee = y0 // 4
        t.rect(0, y0, T - 1, min(y0 + 3, T - 1), W2)
        t.hligne(y0, W1)
        if y0 + 3 < T:
            t.hligne(y0 + 3, W3)
        joint = (rangee * 6 + 3) % T
        t.vligne(joint, W4, y0, min(y0 + 3, T - 1))
        t.px((joint + 3) % T, y0 + 1, W3)  # tête de clou


def bordure_doree(t):
    t.hligne(0, O)
    t.hligne(1, G0)
    t.hligne(2, G1)
    t.hligne(3, G3)


def plancher(haut, bas, gauche, droite):
    t = Tuile()
    planches(t)
    if haut:
        bordure_doree(t)
    if bas:
        t.hligne(T - 2, W4)
        t.hligne(T - 1, O)
    if gauche:
        t.vligne(1, W4, 4 if haut else 0)
        t.vligne(0, O)
        if haut:
            t.px(1, 1, G1)
    if droite:
        t.vligne(T - 2, W4, 4 if haut else 0)
        t.vligne(T - 1, O)
        if haut:
            t.px(T - 2, 1, G2)
    # coins arrondis d'un gros pixel
    for (cx, cy, ok) in [(0, 0, haut and gauche), (T - 1, 0, haut and droite), (0, T - 1, bas and gauche), (T - 1, T - 1, bas and droite)]:
        if ok:
            t.efface(cx, cy)
    return t


# ---------------------------------------------------------------------------
# Plateforme fine en bois à bordure dorée (traversable par dessous)
# ---------------------------------------------------------------------------
def plateforme_fine(cote):
    t = Tuile()
    bordure_doree(t)
    t.rect(0, 4, T - 1, 8, P1)
    t.hligne(4, P0)
    t.hligne(8, P2)
    t.hligne(9, O)
    for x in (5, 13):
        t.vligne(x, P3, 4, 8)
        t.px(x - 2, 6, P3)
    if cote == "milieu":
        # petite draperie rouge sous la plateforme, comme plateforme_bois.png
        t.hligne(10, R1, 2, 13)
        for x in range(2, 14):
            t.px(x, 11, R0 if x % 4 in (1, 2) else R2)
        for x in range(3, 14, 4):
            t.px(x, 12, G2)
            t.px(x, 11, G1)
        t.hligne(10, O, 0, 1)
        t.hligne(10, O, 14, 15)
    if cote in ("gauche", "droite"):
        t.vligne(0, O, 0, 9)
        t.vligne(1, P3, 4, 8)
        t.efface(0, 0)
        t.efface(0, 9)
        # console en bois sous l'extrémité
        t.rect(3, 10, 5, 14, P1)
        t.vligne(3, P0, 10, 14)
        t.vligne(2, O, 10, 15)
        t.vligne(6, O, 10, 15)
        t.hligne(15, O, 2, 6)
        t.px(4, 14, G2)
        if cote == "droite":
            return t.miroir()
    return t


# ---------------------------------------------------------------------------
# Caisse en bois (comme caisse_bois.png)
# ---------------------------------------------------------------------------
def caisse(variante):
    t = Tuile()
    t.rect(0, 0, T - 1, T - 1, W2)
    t.rect(2, 2, T - 3, T - 3, W3)
    for y in (5, 9):
        t.hligne(y, W4, 2, T - 3)
    if variante == "x":
        for i in range(2, T - 2):
            for d in (0, 1):
                t.px(i, min(T - 3, i + d), W1)
                t.px(T - 1 - i, min(T - 3, i + d), W1)
    else:
        for i in range(2, T - 2):
            t.px(i, min(T - 3, i), W1)
            t.px(i, min(T - 3, i + 1), W1)
    t.hligne(1, W0, 1, T - 2)
    t.vligne(1, W1, 1, T - 2)
    t.hligne(T - 2, W4, 1, T - 2)
    t.vligne(T - 2, W4, 1, T - 2)
    t.rect(0, 0, T - 1, 0, O)
    t.rect(0, T - 1, T - 1, T - 1, O)
    t.vligne(0, O)
    t.vligne(T - 1, O)
    for cx, cy in [(2, 2), (T - 3, 2), (2, T - 3), (T - 3, T - 3)]:
        t.px(cx, cy, M1)
    return t


# ---------------------------------------------------------------------------
# Balcon de l'opéra : rambarde dorée, balustres, draperie rouge
# ---------------------------------------------------------------------------
def balcon(cote):
    t = Tuile()
    # main courante dorée
    t.hligne(0, O)
    t.hligne(1, G0)
    t.hligne(2, G1)
    t.hligne(3, G3)
    t.hligne(4, O)
    # balustres en bois tourné
    for bx in (2, 10):
        t.rect(bx + 1, 5, bx + 3, 5, W3)
        t.rect(bx, 6, bx + 4, 8, W2)
        t.vligne(bx + 1, W0, 6, 8)
        t.rect(bx + 1, 9, bx + 3, 10, W3)
        t.vligne(bx + 2, W1, 9, 10)
        t.vligne(bx - 1, O, 6, 8)
        t.vligne(bx + 5, O, 6, 8)
        t.px(bx, 9, O)
        t.px(bx + 4, 9, O)
    # base dorée + draperie rouge
    t.hligne(11, O)
    t.hligne(12, G1)
    t.hligne(13, R0)
    t.hligne(14, R1)
    t.hligne(15, O)
    for x in range(1, T, 5):
        t.px(x, 13, G2)
        t.px(x, 14, G1)
    if cote in ("gauche", "droite"):
        t.vligne(0, O, 0, 15)
        t.rect(1, 5, 2, 10, G3)
        t.vligne(1, G1, 5, 10)
        t.efface(0, 0)
        t.efface(0, 15)
        if cote == "droite":
            return t.miroir()
    return t


# ---------------------------------------------------------------------------
# Poutre métallique (pont de projecteurs)
# ---------------------------------------------------------------------------
def poutre(cote):
    t = Tuile()
    for y0 in (2, 11):
        t.hligne(y0, O)
        t.hligne(y0 + 1, M0)
        t.hligne(y0 + 2, M2)
        t.hligne(y0 + 3, O)
    # treillis en zigzag entre les deux longerons
    for i in range(6):
        y = 6 + i
        for x0 in (0, 8):
            t.px((x0 + i) % T, y, M1)
            t.px((x0 + 7 - i) % T, y, M2)
    if cote in ("gauche", "droite"):
        t.rect(0, 1, 3, 15, M1)
        t.vligne(1, M0, 2, 14)
        t.vligne(0, O, 1, 15)
        t.vligne(4, O, 1, 15)
        t.hligne(1, O, 0, 4)
        t.hligne(15, O, 0, 4)
        t.px(2, 4, M3)
        t.px(2, 12, M3)
        if cote == "droite":
            return t.miroir()
    return t


def echelle():
    t = Tuile()
    for x in (2, 12):
        t.vligne(x - 1, O)
        t.vligne(x, W1)
        t.vligne(x + 1, W3)
        t.vligne(x + 2, O)
    for y in (3, 11):
        t.hligne(y - 1, O, 4, 11)
        t.hligne(y, W0, 4, 11)
        t.hligne(y + 1, W3, 4, 11)
        t.hligne(y + 2, O, 4, 11)
    return t


# ---------------------------------------------------------------------------
# Rideau de velours rouge (fond, non solide)
# ---------------------------------------------------------------------------
PLIS = [R2, R1, R0, R0, R1, R1, R2, R3]  # un pli = 8 gros pixels


def rideau_plis(t, decal=0, y0=0, y1=T - 1):
    for x in range(T):
        c = PLIS[(x + decal) % 8]
        t.vligne(x, c, y0, y1)
        if c == R0 and (x + decal) % 8 == 2:
            t.vligne(x, (212, 84, 84), y0, y1)  # reflet du velours


def rideau(type_):
    t = Tuile()
    rideau_plis(t, 0 if type_ != "plis_b" else 4)
    if type_ == "haut":  # lambrequin festonné avec frange dorée
        t.rect(0, 0, T - 1, 5, R1)
        t.hligne(0, G3)
        t.hligne(1, G1)
        for x in range(T):
            bas = 6 + (2 if 4 <= x % 8 <= 5 else 1 if x % 8 in (3, 6) else 0)
            t.rect(x, 2, x, bas, R0 if x % 8 in (2, 3) else R1)
            t.px(x, bas + 1, O)
            t.px(x, bas + 2, G2 if x % 2 == 0 else G3)
            if x % 2 == 0:
                t.px(x, bas + 3, G1)
    elif type_ == "bas":  # bas du rideau avec frange dorée
        t.hligne(11, R3)
        t.hligne(12, G3)
        t.hligne(13, G1)
        for x in range(0, T, 2):
            t.px(x, 14, G2)
            t.px(x, 15, G1)
    elif type_ == "embrasse":  # cordelière dorée et pompon
        for x in range(T):
            y = 6 + (x - 8) * (x - 8) // 20
            t.px(x, y - 1, O)
            t.px(x, y, G1)
            t.px(x, y + 1, G3)
        t.rect(6, 8, 9, 10, G2)
        t.hligne(8, G0, 6, 9)
        t.rect(5, 11, 10, 14, G2)
        for x in range(5, 11, 2):
            t.vligne(x, G3, 11, 14)
        t.hligne(15, O, 5, 10)
        t.vligne(4, O, 11, 14)
        t.vligne(11, O, 11, 14)
    return t


# ---------------------------------------------------------------------------
# Mur du théâtre (fond, non solide)
# ---------------------------------------------------------------------------
def mur(type_):
    t = Tuile()
    t.rect(0, 0, T - 1, T - 1, B1)
    # motif damassé discret
    for x, y in [(3, 3), (11, 11), (4, 3), (3, 4), (2, 3), (3, 2), (11, 10), (10, 11), (12, 11), (11, 12)]:
        t.px(x, y, B0)
    t.hligne(T - 1, B2)
    if type_ == "applique":  # applique dorée avec bougie
        t.rect(6, 3, 9, 4, L0)
        t.px(7, 2, L1)
        t.px(8, 2, L1)
        t.px(7, 1, L0)
        t.rect(6, 5, 9, 9, I0)
        t.vligne(9, I1, 5, 9)
        t.rect(4, 10, 11, 11, G1)
        t.hligne(10, G0, 5, 10)
        t.rect(6, 12, 9, 13, G3)
        t.rect(7, 14, 8, 15, G4)
        for x, y in [(5, 2), (10, 2), (4, 4), (11, 4), (5, 6), (10, 6)]:  # halo
            t.px(x, y, (120, 52, 40))
    elif type_ == "lambris":  # soubassement en bois avec moulure dorée
        t.rect(0, 6, T - 1, T - 1, P2)
        t.hligne(5, O)
        t.hligne(6, G1)
        t.hligne(7, G3)
        t.rect(2, 9, 13, 14, P1)
        t.hligne(9, P0, 2, 13)
        t.hligne(14, P3, 2, 13)
        t.hligne(T - 1, O)
    return t


def colonne(partie):
    t = Tuile()
    # fût cannelé crème et or
    t.rect(3, 0, 12, T - 1, (232, 204, 150))
    for x in (5, 8, 11):
        t.vligne(x, (196, 160, 104))
    t.vligne(4, (250, 232, 190))
    t.vligne(2, O)
    t.vligne(13, O)
    if partie == "haut":  # chapiteau doré
        t.rect(0, 0, T - 1, 5, G2)
        t.hligne(0, O)
        t.hligne(1, G0)
        t.hligne(5, O)
        t.vligne(0, O, 0, 5)
        t.vligne(T - 1, O, 0, 5)
        for x in (2, 13):  # volutes
            t.px(x, 3, G4)
            t.px(x + (1 if x == 2 else -1), 3, G3)
        t.rect(2, 6, 13, 7, G1)
        t.hligne(8, O, 2, 13)
    elif partie == "base":  # socle doré
        t.rect(0, 10, T - 1, T - 1, G2)
        t.hligne(10, O)
        t.hligne(11, G0)
        t.hligne(T - 1, O)
        t.vligne(0, O, 10, 15)
        t.vligne(T - 1, O, 10, 15)
        t.hligne(14, G3, 1, T - 2)
        t.rect(2, 8, 13, 9, G1)
        t.hligne(7, O, 2, 13)
    return t


# ---------------------------------------------------------------------------
# Piano géant
# ---------------------------------------------------------------------------
def clavier(cote):
    t = Tuile()
    # touches blanches (4 gros pixels de large) + touches noires
    t.rect(0, 0, T - 1, 11, I0)
    t.hligne(0, O)
    for x in range(0, T, 4):
        t.vligne(x, I1, 1, 11)
    for x in (2, 6, 14):  # motif qui se répète sans couture : touches noires
        t.rect(x, 1, x + 1, 6, K2)
        t.px(x, 1, K0)
    t.hligne(11, I1)
    t.hligne(12, O)
    t.rect(0, 13, T - 1, T - 1, K1)
    t.hligne(13, K0)
    t.hligne(T - 1, O)
    if cote in ("gauche", "droite"):  # joue du piano (laque noire)
        t.rect(0, 0, 3, T - 1, K1)
        t.vligne(1, K0, 1, 14)
        t.vligne(0, O)
        t.vligne(4, O, 0, 12)
        t.hligne(0, O, 0, 4)
        t.efface(0, 0)
        if cote == "droite":
            return t.miroir()
    return t


def laque(type_):
    t = Tuile()
    t.rect(0, 0, T - 1, T - 1, K1)
    t.px(3, 4, K0)
    t.px(4, 3, K0)
    t.px(12, 11, K0)
    if type_ == "dore":  # filet doré décoratif
        t.hligne(7, G3)
        t.hligne(8, G1)
    return t


# ---------------------------------------------------------------------------
# Décors divers
# ---------------------------------------------------------------------------
def projecteur():
    t = Tuile()
    t.vligne(7, O, 0, 2)
    t.vligne(8, O, 0, 2)
    t.rect(5, 2, 10, 3, M2)  # étrier
    t.rect(3, 4, 12, 11, M2)
    t.rect(4, 5, 11, 10, M3)
    t.hligne(4, M1, 3, 12)
    t.vligne(3, O, 4, 11)
    t.vligne(12, O, 4, 11)
    t.rect(4, 11, 11, 12, L0)  # lentille allumée
    t.hligne(12, L1, 4, 11)
    t.hligne(13, O, 4, 11)
    for i, x in enumerate(range(2, 14)):
        if i % 3 != 1:
            t.px(x, 15, (120, 64, 40))
    t.px(1, 14, (90, 44, 34))
    t.px(14, 14, (90, 44, 34))
    return t


def corde():
    t = Tuile()
    for y in range(T):
        c = W1 if (y // 2) % 2 == 0 else W3
        t.px(7, y, c)
        t.px(8, y, W3 if c == W1 else W1)
        t.px(6, y, O)
        t.px(9, y, O)
    return t


def trappe():
    t = plancher(True, False, False, False)
    t.rect(2, 5, 13, 14, P2)
    t.hligne(5, O, 2, 13)
    t.hligne(14, O, 2, 13)
    t.vligne(2, O, 5, 14)
    t.vligne(13, O, 5, 14)
    t.vligne(7, P3, 6, 13)
    t.vligne(8, P1, 6, 13)
    for y in (7, 12):  # charnières
        t.rect(3, y, 5, y, M1)
        t.px(3, y, M0)
    t.rect(10, 9, 11, 10, G2)  # poignée
    return t


def fauteuil():
    t = Tuile()
    t.rect(3, 2, 12, 9, R1)  # dossier
    t.rect(4, 3, 11, 8, R0)
    t.vligne(5, (212, 84, 84), 3, 8)
    t.hligne(1, O, 3, 12)
    t.vligne(2, O, 2, 9)
    t.vligne(13, O, 2, 9)
    t.rect(2, 10, 13, 12, R1)  # assise
    t.hligne(10, R0, 3, 12)
    t.hligne(9, O, 2, 2)
    t.hligne(13, O, 2, 13)
    t.vligne(1, O, 10, 12)
    t.vligne(14, O, 10, 12)
    t.rect(3, 13, 4, 15, G3)  # pieds dorés
    t.rect(11, 13, 12, 15, G3)
    t.px(3, 13, G1)
    t.px(11, 13, G1)
    return t


def pupitre():
    t = Tuile()
    t.rect(3, 2, 12, 7, P1)  # tablette avec partition
    t.rect(4, 3, 11, 6, I0)
    for y in (4, 5):
        t.hligne(y, I1, 5, 10)
    t.px(6, 4, O)
    t.px(9, 5, O)
    t.hligne(1, O, 3, 12)
    t.hligne(8, O, 3, 12)
    t.vligne(2, O, 1, 8)
    t.vligne(13, O, 1, 8)
    t.rect(7, 9, 8, 13, M2)  # pied
    t.vligne(7, M1, 9, 13)
    t.hligne(14, M2, 4, 11)
    t.hligne(15, O, 4, 11)
    return t


def vide():
    return Tuile()


# ---------------------------------------------------------------------------
# Catalogue : (nom, tuile, propriétés)
#   estSolide : collision pleine        unSens : plateforme traversable par dessous
#   echelle   : on peut y grimper
# ---------------------------------------------------------------------------
SOLIDE = {"estSolide": True}
UN_SENS = {"estSolide": True, "unSens": True}

CATALOGUE = [
    # ligne 1 : plancher (haut) + plateforme fine + caisses
    ("plancher_haut_gauche", plancher(True, False, True, False), SOLIDE),
    ("plancher_haut", plancher(True, False, False, False), SOLIDE),
    ("plancher_haut_droite", plancher(True, False, False, True), SOLIDE),
    ("plateforme_gauche", plateforme_fine("gauche"), UN_SENS),
    ("plateforme_milieu", plateforme_fine("milieu"), UN_SENS),
    ("plateforme_droite", plateforme_fine("droite"), UN_SENS),
    ("caisse_x", caisse("x"), SOLIDE),
    ("caisse_diagonale", caisse("diag"), SOLIDE),
    # ligne 2 : plancher (milieu) + balcon
    ("plancher_gauche", plancher(False, False, True, False), SOLIDE),
    ("plancher_plein", plancher(False, False, False, False), SOLIDE),
    ("plancher_droite", plancher(False, False, False, True), SOLIDE),
    ("balcon_gauche", balcon("gauche"), UN_SENS),
    ("balcon_milieu", balcon("milieu"), UN_SENS),
    ("balcon_droite", balcon("droite"), UN_SENS),
    ("trappe", trappe(), SOLIDE),
    ("plancher_seul", plancher(True, True, True, True), SOLIDE),
    # ligne 3 : plancher (bas) + poutre métallique + échelle
    ("plancher_bas_gauche", plancher(False, True, True, False), SOLIDE),
    ("plancher_bas", plancher(False, True, False, False), SOLIDE),
    ("plancher_bas_droite", plancher(False, True, False, True), SOLIDE),
    ("poutre_gauche", poutre("gauche"), SOLIDE),
    ("poutre_milieu", poutre("milieu"), SOLIDE),
    ("poutre_droite", poutre("droite"), SOLIDE),
    ("echelle", echelle(), {"echelle": True}),
    ("corde", corde(), {"echelle": True}),
    # ligne 4 : rideaux (décor)
    ("rideau_haut", rideau("haut"), {}),
    ("rideau_plis_a", rideau("plis_a"), {}),
    ("rideau_plis_b", rideau("plis_b"), {}),
    ("rideau_bas", rideau("bas"), {}),
    ("rideau_embrasse", rideau("embrasse"), {}),
    ("mur", mur("simple"), {}),
    ("mur_applique", mur("applique"), {}),
    ("mur_lambris", mur("lambris"), {}),
    # ligne 5 : colonnes + piano géant
    ("colonne_haut", colonne("haut"), {}),
    ("colonne_milieu", colonne("milieu"), {}),
    ("colonne_base", colonne("base"), {}),
    ("clavier_gauche", clavier("gauche"), SOLIDE),
    ("clavier_milieu", clavier("milieu"), SOLIDE),
    ("clavier_droite", clavier("droite"), SOLIDE),
    ("laque", laque("simple"), SOLIDE),
    ("laque_doree", laque("dore"), SOLIDE),
    # ligne 6 : décors
    ("projecteur", projecteur(), {}),
    ("fauteuil", fauteuil(), {}),
    ("pupitre", pupitre(), {}),
    ("vide_1", vide(), {}),
    ("vide_2", vide(), {}),
    ("vide_3", vide(), {}),
    ("vide_4", vide(), {}),
    ("vide_5", vide(), {}),
]
ID = {nom: i for i, (nom, _, _) in enumerate(CATALOGUE)}
TP = T * ECHELLE  # taille d'une tuile en pixels (32)


def generer_image():
    lignes = (len(CATALOGUE) + COLONNES - 1) // COLONNES
    feuille = Image.new("RGBA", (COLONNES * TP, lignes * TP), (0, 0, 0, 0))
    for i, (_, tuile, _) in enumerate(CATALOGUE):
        feuille.paste(tuile.img.resize((TP, TP), Image.NEAREST), ((i % COLONNES) * TP, (i // COLONNES) * TP))
    chemin = os.path.join(IMAGES, "tileset_theatre.png")
    feuille.save(chemin, optimize=True)
    print(f"tileset_theatre.png   {feuille.size[0]}x{feuille.size[1]}  {os.path.getsize(chemin) / 1024:.1f} Ko")
    return feuille


def proprietes_xml(props):
    lignes = []
    for nom, valeur in props.items():
        lignes.append(f'    <property name="{nom}" type="bool" value="{str(valeur).lower()}"/>')
    return "\n".join(lignes)


def generer_tsx(feuille):
    tuiles = []
    for i, (nom, _, props) in enumerate(CATALOGUE):
        if nom.startswith("vide"):
            continue
        tuiles.append(f'  <tile id="{i}" type="{nom}">\n   <properties>\n'
                      f'    <property name="nom" value="{nom}"/>\n{proprietes_xml(props)}\n   </properties>\n  </tile>')
    tsx = (f'<?xml version="1.0" encoding="UTF-8"?>\n'
           f'<tileset version="1.10" tiledversion="1.10.2" name="tileset_theatre" tilewidth="{TP}" tileheight="{TP}" '
           f'tilecount="{len(CATALOGUE)}" columns="{COLONNES}">\n'
           f' <image source="../images/tileset_theatre.png" width="{feuille.width}" height="{feuille.height}"/>\n'
           + "\n".join(tuiles) + "\n</tileset>\n")
    with open(os.path.join(MAPS, "tileset_theatre.tsx"), "w", encoding="utf-8") as f:
        f.write(tsx)
    print("tileset_theatre.tsx")


def tileset_json(feuille):
    """Tileset intégré à la carte (Phaser ne lit pas les tilesets externes .tsx)."""
    tiles = []
    for i, (nom, _, props) in enumerate(CATALOGUE):
        if nom.startswith("vide"):
            continue
        p = [{"name": "nom", "type": "string", "value": nom}]
        p += [{"name": k, "type": "bool", "value": v} for k, v in props.items()]
        tiles.append({"id": i, "properties": p})
    return {
        "firstgid": 1, "name": "tileset_theatre", "image": "../images/tileset_theatre.png",
        "imagewidth": feuille.width, "imageheight": feuille.height,
        "tilewidth": TP, "tileheight": TP, "tilecount": len(CATALOGUE), "columns": COLONNES,
        "margin": 0, "spacing": 0, "tiles": tiles,
    }


def generer_exemple(feuille):
    """Petite carte 40x23 (1280x736) qui montre comment assembler les tuiles."""
    L, H = 40, 23
    fond = [[0] * L for _ in range(H)]
    decor = [[0] * L for _ in range(H)]  # objets posés devant le mur (fond transparent)
    plateformes = [[0] * L for _ in range(H)]

    def pose(calque, x, y, nom):
        if 0 <= x < L and 0 <= y < H:
            calque[y][x] = ID[nom] + 1  # gid = id + firstgid

    # fond : mur, lambris en bas, rideaux sur les côtés, lambrequin en haut
    for y in range(H):
        for x in range(L):
            pose(fond, x, y, "mur_lambris" if y == 18 else "mur")
    for x in range(L):
        pose(fond, x, 0, "rideau_haut")
    for x0 in (0, 36):
        for y in range(1, 19):
            for dx in range(4):
                pose(fond, x0 + dx, y, "rideau_plis_a" if (dx + y // 30) % 2 == 0 else "rideau_plis_b")
        for dx in range(4):
            pose(fond, x0 + dx, 19, "rideau_bas")
        pose(fond, x0 + (3 if x0 == 0 else 0), 11, "rideau_embrasse")
    for x in (8, 31):
        pose(decor, x, 9, "colonne_haut")
        for y in range(10, 17):
            pose(decor, x, y, "colonne_milieu")
        pose(decor, x, 17, "colonne_base")
    for x in (12, 20, 27):
        pose(fond, x, 6, "mur_applique")
    for x in range(13, 27, 4):
        pose(decor, x, 1, "projecteur")
    for x in (5, 6, 33, 34):
        pose(decor, x, 18, "fauteuil")
    pose(decor, 17, 18, "pupitre")

    # sol de la scène (3 rangées) avec une trappe
    for x in range(L):
        bord = "_gauche" if x == 0 else "_droite" if x == L - 1 else ""
        pose(plateformes, x, 20, "plancher_haut" + bord)
        pose(plateformes, x, 21, "plancher" + (bord or "_plein"))
        pose(plateformes, x, 22, "plancher_bas" + bord)
    pose(plateformes, 22, 20, "trappe")
    # plateformes, balcon, poutre, caisses, échelle, piano
    for x, nom in [(3, "plateforme_gauche"), (4, "plateforme_milieu"), (5, "plateforme_milieu"), (6, "plateforme_droite")]:
        pose(plateformes, x, 15, nom)
    for x in range(10, 17):
        pose(plateformes, x, 12, "balcon_gauche" if x == 10 else "balcon_droite" if x == 16 else "balcon_milieu")
    for x in range(22, 30):
        pose(plateformes, x, 8, "poutre_gauche" if x == 22 else "poutre_droite" if x == 29 else "poutre_milieu")
    for y in range(9, 20):
        pose(plateformes, 29, y, "echelle")
    for y in range(2, 8):
        pose(plateformes, 24, y, "corde")
    pose(plateformes, 13, 19, "caisse_x")
    pose(plateformes, 14, 19, "caisse_diagonale")
    pose(plateformes, 14, 18, "caisse_x")
    for x in range(31, 38):
        pose(plateformes, x, 16, "clavier_gauche" if x == 31 else "clavier_droite" if x == 37 else "clavier_milieu")
        pose(plateformes, x, 17, "laque_doree")
        pose(plateformes, x, 18, "laque")
        pose(plateformes, x, 19, "laque")

    def calque(nom, donnees, id_):
        return {"id": id_, "name": nom, "type": "tilelayer", "width": L, "height": H, "x": 0, "y": 0,
                "opacity": 1, "visible": True, "data": [g for ligne in donnees for g in ligne]}

    carte = {
        "type": "map", "version": "1.10", "tiledversion": "1.10.2", "orientation": "orthogonal",
        "renderorder": "right-down", "width": L, "height": H, "tilewidth": TP, "tileheight": TP,
        "infinite": False, "nextlayerid": 4, "nextobjectid": 1,
        "layers": [calque("calque_fond", fond, 1), calque("calque_decor", decor, 2),
                   calque("calque_plateformes", plateformes, 3)],
        "tilesets": [tileset_json(feuille)],
    }
    with open(os.path.join(MAPS, "exemple_solo.tmj"), "w", encoding="utf-8") as f:
        json.dump(carte, f)
    print("exemple_solo.tmj")
    return fond, decor, plateformes


def apercu(feuille, *calques):
    """Rendu de la carte d'exemple (pour vérifier l'assemblage des tuiles)."""
    img = Image.new("RGBA", (len(calques[0][0]) * TP, len(calques[0]) * TP), (18, 4, 10, 255))
    for calque in calques:
        for y, ligne in enumerate(calque):
            for x, gid in enumerate(ligne):
                if gid:
                    i = gid - 1
                    tuile = feuille.crop(((i % COLONNES) * TP, (i // COLONNES) * TP, (i % COLONNES + 1) * TP, (i // COLONNES + 1) * TP))
                    img.alpha_composite(tuile, (x * TP, y * TP))
    return img


if __name__ == "__main__":
    feuille = generer_image()
    generer_tsx(feuille)
    calques = generer_exemple(feuille)
    if "--apercu" in sys.argv:
        apercu(feuille, *calques).save(sys.argv[-1])
        print("aperçu :", sys.argv[-1])
