"""
Génère les petites images dessinées par programme : objets bonus en pixel art,
notes de musique et étincelles.
Tout est dessiné par programme : aucun asset externe, donc aucun problème de droits.

Utilisation (depuis le dossier Theater-Showdown) :
    python outils/generer_images.py
"""
import math
import os

from PIL import Image, ImageDraw

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER = os.path.join(RACINE, "assets", "images")
os.makedirs(DOSSIER, exist_ok=True)

S = 2  # sur-échantillonnage : on dessine en x2 puis on réduit (anti-crénelage)
CONTOUR = (20, 14, 24, 255)


def sauver(img, nom, palette=False):
    chemin = os.path.join(DOSSIER, nom)
    if palette:
        img = img.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    img.save(chemin, optimize=True)
    print(f"{nom:28s} {os.path.getsize(chemin) / 1024:7.1f} Ko")


# ---------------------------------------------------------------------------
# Petits outils vectoriels
# ---------------------------------------------------------------------------
def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


class Pinceau:
    """Fonctions de dessin avec contour. 'echelle' agrandit tout le dessin."""

    def __init__(self, draw, echelle=1):
        self.d = draw
        self.k = S * echelle

    def P(self, p):
        return (p[0] * self.k, p[1] * self.k)

    def disque(self, c, r, couleur, contour=True):
        x, y = self.P(c)
        if contour:
            R = (r + 1.5) * self.k
            self.d.ellipse((x - R, y - R, x + R, y + R), fill=CONTOUR)
        R = r * self.k
        self.d.ellipse((x - R, y - R, x + R, y + R), fill=couleur)

    def membre(self, pts, couleur, ep, contour=True):
        pts_s = [self.P(p) for p in pts]
        if contour:
            self.d.line(pts_s, fill=CONTOUR, width=int((ep + 3) * self.k), joint="curve")
            for p in pts:
                self.disque(p, (ep + 3) / 2, CONTOUR, False)
        self.d.line(pts_s, fill=couleur, width=int(ep * self.k), joint="curve")
        for p in pts:
            self.disque(p, ep / 2, couleur, False)

    def poly(self, pts, couleur, contour=True):
        self.d.polygon([self.P(p) for p in pts], fill=couleur, outline=CONTOUR if contour else None,
                       width=int(1.5 * self.k) if contour else 0)

    def trait(self, a, b, couleur, ep):
        self.d.line([self.P(a), self.P(b)], fill=couleur, width=max(1, int(ep * self.k)))


# ---------------------------------------------------------------------------
# Objets, projectiles, icônes
# ---------------------------------------------------------------------------
def canevas(w, h):
    img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    return img, Pinceau(ImageDraw.Draw(img))


def fin(img, w, h, nom):
    sauver(img.resize((w, h), Image.LANCZOS), nom)


def bezier(p0, p1, p2, pas=24):
    """Points d'une courbe de Bézier quadratique (p1 = point de contrôle)."""
    return [lerp(lerp(p0, p1, t / pas), lerp(p1, p2, t / pas), t / pas) for t in range(pas + 1)]


def generer_croche(taille, nom):
    """Croche nette (jauge du HUD, projectile) : remplissage blanc (teinté en jeu
    par setTint) et contour sombre d'épaisseur constante autour de la silhouette.
    Les coordonnées sont données pour une grille de 28x28, puis mises à l'échelle."""
    k = 16 * taille / 28  # dessin en x16 puis réduction : bords bien lisses
    ep = 1.5  # épaisseur du contour, en unités de la grille 28x28

    # tête ovale inclinée
    cx, cy, rx, ry, angle = 10.3, 20.6, 6.0, 4.3, math.radians(-22)

    def tete(marge):
        pts = []
        for i in range(72):
            a = i * 2 * math.pi / 72
            x, y = (rx + marge) * math.cos(a), (ry + marge) * math.sin(a)
            pts.append((cx + x * math.cos(angle) - y * math.sin(angle), cy + x * math.sin(angle) + y * math.cos(angle)))
        return pts

    # hampe collée au bord droit de la tête, crochet qui retombe vers la droite
    hampe = [(14.3, 3.2), (16.4, 3.2), (16.4, 19.5), (14.3, 19.5)]
    crochet = (bezier((16.4, 3.2), (17.2, 7.5), (21.6, 10.2))
               + bezier((21.6, 10.2), (25.2, 13.2), (22.4, 18.6))
               + bezier((22.4, 18.6), (23.2, 13.6), (16.4, 11.0)))

    def calque(marge):
        m = Image.new("L", (taille * 16, taille * 16), 0)
        d = ImageDraw.Draw(m)
        for forme in (tete(marge), hampe, crochet):
            pts = [(x * k, y * k) for x, y in forme]
            d.polygon(pts, fill=255)
            if marge:  # dilatation : trait épais + disques aux sommets
                d.line(pts + [pts[0]], fill=255, width=int(2 * marge * k), joint="curve")
                r = marge * k
                for x, y in pts:
                    d.ellipse((x - r, y - r, x + r, y + r), fill=255)
        return m

    img = Image.new("RGBA", (taille * 16, taille * 16), (0, 0, 0, 0))
    img.paste(CONTOUR, (0, 0), calque(ep))
    img.paste((255, 255, 255, 255), (0, 0), calque(0))
    sauver(img.resize((taille, taille), Image.LANCZOS), nom)


def generer_objets():
    blanc = (255, 255, 255, 255)
    generer_croche(36, "note_projectile.png")
    generer_croche(28, "note_hud.png")

    # étincelle d'impact
    img, pc = canevas(24, 24)
    pts = []
    for i in range(10):
        a = i * math.pi / 5
        rr = 11 if i % 2 == 0 else 4
        pts.append((12 + rr * math.cos(a), 12 + rr * math.sin(a)))
    pc.poly(pts, blanc, False)
    fin(img, 24, 24, "etincelle.png")

    generer_objets_pixel_art()


# ---------------------------------------------------------------------------
# Objets bonus en pixel art : grille 16x16 agrandie x3 (48x48)
# ---------------------------------------------------------------------------
class Pixels:
    """Petite grille de pixels : on dessine les formes, puis le contour est ajouté automatiquement."""

    def __init__(self, taille=16):
        self.n = taille
        self.g = [[None] * taille for _ in range(taille)]
        self.reflets = []  # pixels ajoutés après le contour (étincelles)

    def pixel(self, x, y, c):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.g[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.pixel(x, y, c)

    def ligne(self, x0, y0, x1, y1, c):
        """Ligne de Bresenham."""
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.pixel(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def carte(self, lignes, palette):
        for y, ligne in enumerate(lignes):
            for x, car in enumerate(ligne):
                if car in palette:
                    self.pixel(x, y, palette[car])

    def contour(self):
        a_contourner = []
        for y in range(self.n):
            for x in range(self.n):
                if self.g[y][x] is not None:
                    continue
                voisins = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                if any(0 <= vx < self.n and 0 <= vy < self.n and self.g[vy][vx] not in (None, CONTOUR) for vx, vy in voisins):
                    a_contourner.append((x, y))
        for x, y in a_contourner:
            self.g[y][x] = CONTOUR

    def sauver(self, nom, zoom=3):
        self.contour()
        for x, y, c in self.reflets:
            self.pixel(x, y, c)
        img = Image.new("RGBA", (self.n, self.n), (0, 0, 0, 0))
        for y in range(self.n):
            for x in range(self.n):
                if self.g[y][x] is not None:
                    img.putpixel((x, y), self.g[y][x])
        sauver(img.resize((self.n * zoom, self.n * zoom), Image.NEAREST), nom)


def generer_objets_pixel_art():
    # --- rose : soin ---
    px = Pixels()
    px.carte([
        "................",
        "................",
        ".....HHRRR......",
        "....HRrrrRR.....",
        "....RrRRRrRr....",
        "....RrRHrrRr....",
        "....RRrrrRRr....",
        ".....RRRRRr.....",
        "......rGr.......",
        "...LLL.G........",
        "..LlLLLG..LL....",
        "...LLl.GLLlL....",
        ".......GLLL.....",
        ".......G........",
        ".......G........",
        "................",
    ], {"H": (255, 120, 130, 255), "R": (222, 38, 60, 255), "r": (150, 14, 40, 255),
        "G": (52, 132, 56, 255), "L": (96, 196, 82, 255), "l": (52, 132, 56, 255)})
    px.sauver("objet_rose.png")

    # --- partition : remplit la jauge ---
    px = Pixels()
    papier, ombre, portee, encre = (250, 244, 225, 255), (214, 198, 166, 255), (150, 132, 112, 255), (34, 26, 34, 255)
    px.rect(2, 1, 13, 14, papier)
    px.rect(13, 1, 13, 14, ombre)
    px.rect(2, 14, 13, 14, ombre)
    for y in (4, 6, 8, 11, 13):
        px.ligne(3, y, 12, y, portee)
    # deux croches reliées par une ligature
    px.rect(4, 7, 5, 8, encre)
    px.ligne(5, 3, 5, 6, encre)
    px.rect(9, 6, 10, 7, encre)
    px.ligne(10, 3, 10, 5, encre)
    px.rect(5, 2, 10, 2, encre)
    # deux noires sur la seconde portée
    px.rect(4, 12, 5, 13, encre)
    px.ligne(5, 9, 5, 11, encre)
    px.rect(9, 11, 10, 12, encre)
    px.ligne(10, 9, 10, 10, encre)
    px.sauver("objet_partition.png")

    # --- métronome : vitesse ---
    px = Pixels()
    bois, clair, fonce, cadran = (168, 100, 46, 255), (206, 140, 72, 255), (104, 58, 26, 255), (240, 222, 182, 255)
    px.rect(7, 1, 8, 1, fonce)
    for y in range(2, 13):
        demi = 1 + (y - 2) * 5 // 10
        gauche, droite = 7 - demi, 8 + demi
        px.rect(gauche, y, droite, y, bois)
        px.pixel(gauche, y, clair)
        px.pixel(droite, y, fonce)
        if 4 <= y <= 11 and droite - gauche >= 5:
            px.rect(gauche + 2, y, droite - 2, y, cadran)
    px.rect(1, 13, 14, 14, fonce)
    px.rect(2, 13, 13, 13, bois)
    px.ligne(7, 11, 12, 1, (70, 70, 84, 255))  # balancier
    px.rect(9, 6, 10, 7, (236, 192, 60, 255))  # poids doré
    px.pixel(7, 11, (236, 192, 60, 255))
    px.sauver("objet_metronome.png")

    # --- baguette dorée : force ---
    px = Pixels()
    blanc, gris, or_, or_fonce = (252, 252, 252, 255), (196, 196, 210, 255), (236, 192, 60, 255), (170, 120, 30, 255)
    px.ligne(5, 11, 12, 4, blanc)
    px.ligne(5, 12, 12, 5, gris)
    px.ligne(2, 12, 5, 9, or_)
    px.ligne(2, 13, 5, 10, or_)
    px.ligne(3, 13, 6, 10, or_fonce)
    # étincelles (sans contour)
    etoile = (255, 236, 120, 255)
    for x, y in [(13, 1), (12, 2), (13, 2), (14, 2), (13, 3), (9, 1), (15, 6), (10, 4)]:
        px.reflets.append((x, y, etoile))
    px.reflets.append((13, 2, (255, 255, 255, 255)))
    px.sauver("objet_baguette.png")


if __name__ == "__main__":
    # décors, plateformes, menus, personnages et jaquette viennent des visuels de l'équipe
    # (voir outils/integrer_visuels.py) : ce script ne génère plus que ce qui suit
    generer_objets()
