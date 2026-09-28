"""
Génère toutes les images du jeu Theater Showdown (sprites, décors, objets).
Tout est dessiné par programme : aucun asset externe, donc aucun problème de droits.

Utilisation (depuis le dossier Theater-Showdown) :
    python outils/generer_images.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER = os.path.join(RACINE, "assets", "images")
os.makedirs(DOSSIER, exist_ok=True)

S = 2  # sur-échantillonnage : on dessine en x2 puis on réduit (anti-crénelage)
ECHELLE_PERSO = 1.25  # les poses sont définies pour 96x144, puis agrandies
FW, FH = 120, 180  # taille d'une frame de personnage
CONTOUR = (20, 14, 24, 255)
POLICE_TITRE = "C:/Windows/Fonts/georgiab.ttf"


def sauver(img, nom, palette=False):
    chemin = os.path.join(DOSSIER, nom)
    if palette:
        img = img.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    img.save(chemin, optimize=True)
    print(f"{nom:28s} {os.path.getsize(chemin) / 1024:7.1f} Ko")


# ---------------------------------------------------------------------------
# Petits outils vectoriels
# ---------------------------------------------------------------------------
def add(a, b): return (a[0] + b[0], a[1] + b[1])
def sub(a, b): return (a[0] - b[0], a[1] - b[1])
def mul(a, k): return (a[0] * k, a[1] * k)
def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def norm(a):
    l = math.hypot(a[0], a[1]) or 1
    return (a[0] / l, a[1] / l)


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
# Poses : position des articulations dans une frame 96x144 (personnage tourné vers la droite)
# ---------------------------------------------------------------------------
BASE = dict(head=(48, 30), neck=(48, 44), hip=(48, 88),
            shF=(51, 50), elF=(56, 68), haF=(60, 84),
            shB=(45, 50), elB=(40, 68), haB=(38, 84),
            knF=(53, 112), ftF=(56, 138), knB=(43, 112), ftB=(40, 138))


def pose(**modifs):
    p = dict(BASE)
    p.update(modifs)
    return p


def decaler(p, dx, dy, cles=None):
    return {k: (v[0] + dx, v[1] + dy) if (cles is None or k in cles) else v for k, v in p.items()}


HAUT = ["head", "neck", "shF", "shB", "elF", "elB", "haF", "haB"]
POSES = [
    # 0-1 repos (respiration)
    pose(),
    decaler(pose(elF=(56, 69), elB=(40, 69)), 0, 1.5, HAUT[:4]),
    # 2-5 marche
    decaler(pose(knF=(58, 110), ftF=(66, 137), knB=(40, 112), ftB=(31, 136), elF=(50, 68), haF=(44, 82), elB=(48, 68), haB=(58, 82)), 0, 1, HAUT),
    pose(knF=(52, 110), ftF=(50, 136), knB=(47, 112), ftB=(46, 132)),
    decaler(pose(knF=(42, 112), ftF=(33, 136), knB=(57, 110), ftB=(65, 137), elF=(58, 68), haF=(62, 82), elB=(36, 68), haB=(34, 82)), 0, 1, HAUT),
    pose(knF=(50, 112), ftF=(52, 132), knB=(45, 110), ftB=(42, 136)),
    # 6 saut
    pose(hip=(48, 86), knF=(60, 100), ftF=(56, 122), knB=(40, 104), ftB=(34, 126),
         elF=(60, 40), haF=(64, 26), elB=(36, 42), haB=(30, 30)),
    # 7 garde (accroupi, bras croisés)
    pose(head=(52, 54), neck=(51, 68), hip=(46, 104), shF=(54, 74), elF=(66, 80), haF=(64, 64),
         shB=(48, 74), elB=(62, 86), haB=(68, 72), knF=(64, 114), ftF=(60, 138), knB=(34, 118), ftB=(34, 138)),
    # 8 attaque légère (coup de poing)
    pose(head=(54, 32), neck=(52, 46), hip=(46, 88), shF=(55, 52), elF=(71, 52), haF=(87, 51),
         shB=(49, 52), elB=(52, 66), haB=(60, 58), knF=(58, 112), ftF=(66, 138), knB=(38, 112), ftB=(30, 138)),
    # 9 attaque lourde (coup de pied haut)
    pose(head=(38, 32), neck=(41, 46), hip=(46, 90), shF=(44, 52), elF=(34, 60), haF=(26, 66),
         shB=(40, 52), elB=(30, 58), haB=(24, 50), knF=(66, 82), ftF=(90, 74), knB=(46, 114), ftB=(44, 138)),
    # 10 tir (bras tendu vers l'avant-haut)
    pose(head=(50, 30), neck=(49, 44), shF=(52, 50), elF=(66, 44), haF=(81, 36),
         elB=(38, 64), haB=(31, 76), knF=(57, 112), ftF=(62, 138), knB=(40, 112), ftB=(34, 138)),
    # 11 touché (penché en arrière)
    pose(head=(38, 35), neck=(41, 49), hip=(48, 90), shF=(44, 55), elF=(34, 62), haF=(24, 56),
         shB=(40, 55), elB=(30, 58), haB=(20, 48), knF=(55, 114), ftF=(60, 138), knB=(44, 114), ftB=(40, 138)),
    # 12 K.O. (allongé au sol)
    dict(head=(14, 127), neck=(25, 129), hip=(56, 131), shF=(30, 128), elF=(36, 118), haF=(44, 112),
         shB=(30, 130), elB=(38, 138), haB=(48, 139), knF=(70, 126), ftF=(88, 133), knB=(70, 135), ftB=(88, 139)),
    # 13 victoire (bras levé)
    pose(shF=(51, 50), elF=(57, 33), haF=(59, 15), elB=(35, 66), haB=(42, 80),
         knF=(57, 114), ftF=(63, 138), knB=(39, 114), ftB=(33, 138)),
]


class Repere:
    """Calcule les axes du corps pour que les costumes suivent la pose (même allongée)."""

    def __init__(self, p):
        self.p = p
        self.axe = norm(sub(p["hip"], p["neck"]))          # du cou vers la hanche
        self.av = (self.axe[1], -self.axe[0])              # vers l'avant du personnage
        self.up_t = norm(sub(p["head"], p["neck"]))       # vers le haut de la tête
        self.av_t = (-self.up_t[1], self.up_t[0])           # avant de la tête

    def torse(self, largeur_epaules, largeur_hanches, rallonge=0):
        n, h, av = self.p["neck"], add(self.p["hip"], mul(self.axe, rallonge)), self.av
        n = sub(n, mul(self.axe, 2))
        return [add(n, mul(av, largeur_epaules)), add(h, mul(av, largeur_hanches)),
                sub(h, mul(av, largeur_hanches)), sub(n, mul(av, largeur_epaules))]

    def tete(self, dx, dy):
        """Point relatif à la tête : dx vers l'avant, dy vers le haut."""
        return add(self.p["head"], add(mul(self.av_t, dx), mul(self.up_t, dy)))

    def corps(self, t, dx):
        """Point sur l'axe cou->hanche (t entre 0 et 1), décalé de dx vers l'avant."""
        return add(lerp(self.p["neck"], self.p["hip"], t), mul(self.av, dx))


def main_prolongee(p, cote, longueur):
    """Point au bout d'un objet tenu en main, dans le prolongement de l'avant-bras."""
    d = norm(sub(p["ha" + cote], p["el" + cote]))
    return add(p["ha" + cote], mul(d, longueur))


# ---------------------------------------------------------------------------
# Les 5 personnages
# ---------------------------------------------------------------------------
PEAU = {"claire": (246, 206, 172, 255), "rosee": (236, 188, 160, 255), "mate": (200, 146, 108, 255),
        "foncee": (150, 100, 70, 255), "pale": (232, 224, 214, 255)}


def base_corps(pc, r, p, c, jambes=True, bras_arriere=True):
    """Dessine bras arrière + jambes : commun à tous les personnages."""
    if bras_arriere:
        pc.membre([p["shB"], p["elB"], p["haB"]], c["manche"], 8.5)
        pc.disque(p["haB"], 4, c["main"])
    if jambes:
        pc.membre([p["hip"], p["knB"], p["ftB"]], c["jambe"], 10)
        pc.disque(p["ftB"], 4.5, c["chaussure"])
        pc.membre([p["hip"], p["knF"], p["ftF"]], c["jambe"], 10)
        pc.disque(p["ftF"], 4.5, c["chaussure"])


def tete_base(pc, r, p, peau):
    pc.membre([p["neck"], r.tete(0, -8)], peau, 6)
    pc.disque(p["head"], 12, peau)


def visage(pc, r, yeux=(20, 14, 24, 255), bouche=True):
    pc.disque(r.tete(6, 2), 1.7, yeux, False)
    if bouche:
        pc.trait(r.tete(4, -6), r.tete(9, -5), (120, 40, 40, 255), 1.2)


def bras_avant(pc, p, c):
    pc.membre([p["shF"], p["elF"], p["haF"]], c["manche"], 8.5)
    pc.disque(p["haF"], 4, c["main"])


def dessiner_maestro(pc, p):
    r = Repere(p)
    c = dict(manche=(28, 28, 40, 255), main=PEAU["claire"], jambe=(34, 34, 46, 255), chaussure=(10, 10, 10, 255))
    # queue de pie (derrière)
    q1 = r.corps(0.8, -6)
    pc.poly([q1, add(q1, add(mul(r.axe, 30), mul(r.av, -12))), add(q1, add(mul(r.axe, 26), mul(r.av, 2))), r.corps(0.8, 8)], c["manche"])
    base_corps(pc, r, p, c)
    pc.poly(r.torse(10, 9), c["manche"])
    # plastron blanc + noeud papillon rouge
    pc.poly([r.corps(0.0, 5), r.corps(0.0, -1), r.corps(0.55, 2)], (245, 245, 245, 255), False)
    nd = r.corps(0.08, 3)
    pc.poly([add(nd, mul(r.av, -4)), add(nd, add(mul(r.av, 4), mul(r.axe, -3))), add(nd, add(mul(r.av, 4), mul(r.axe, 3)))], (200, 20, 40, 255), False)
    tete_base(pc, r, p, PEAU["claire"])
    # cheveux blancs en bataille
    for dx, dy, rr in [(-9, 6, 6), (-5, 11, 6), (2, 12, 5), (-11, -1, 5), (-12, 11, 4), (7, 10, 3.5)]:
        pc.disque(r.tete(dx, dy), rr, (238, 238, 242, 255))
    pc.disque(r.tete(-2, 7), 7, (238, 238, 242, 255), False)
    visage(pc, r)
    pc.trait(r.tete(7, 5), r.tete(11, 6), (230, 230, 235, 255), 1.5)  # sourcil
    bras_avant(pc, p, c)
    # baguette de chef d'orchestre
    pc.membre([p["haF"], main_prolongee(p, "F", 22)], (250, 250, 250, 255), 2)


def dessiner_diva(pc, p):
    r = Repere(p)
    or_ = (240, 196, 70, 255)
    c = dict(manche=PEAU["rosee"], main=PEAU["rosee"], jambe=PEAU["rosee"], chaussure=or_)
    # tresses blondes (derrière)
    for dx in (-6, -10):
        pc.membre([r.tete(dx, -4), r.tete(dx - 3, -18), r.tete(dx - 2, -30)], (236, 196, 80, 255), 5)
    base_corps(pc, r, p, c)
    pc.poly(r.torse(9, 8), (170, 20, 44, 255))
    # robe longue évasée
    t = r.corps(0.55, 0)
    bas = add(p["hip"], mul(r.axe, 30))
    pc.poly([add(t, mul(r.av, 9)), add(bas, mul(r.av, 22)), sub(bas, mul(r.av, 22)), sub(t, mul(r.av, 9))], (170, 20, 44, 255))
    pc.trait(add(bas, mul(r.av, 21)), sub(bas, mul(r.av, 21)), or_, 2.5)
    pc.trait(add(t, mul(r.av, 9)), sub(t, mul(r.av, 9)), or_, 2.5)
    pc.disque(r.corps(0.12, 4), 2.5, or_)  # broche
    tete_base(pc, r, p, PEAU["rosee"])
    # casque viking à cornes
    casque = [r.tete(-13, 2), r.tete(-11, 10), r.tete(-4, 14), r.tete(4, 14), r.tete(11, 10), r.tete(13, 2)]
    pc.poly(casque, (190, 196, 210, 255))
    pc.poly([r.tete(-11, 8), r.tete(-20, 16), r.tete(-19, 26), r.tete(-14, 14)], (250, 240, 214, 255))
    pc.poly([r.tete(11, 8), r.tete(20, 16), r.tete(19, 26), r.tete(14, 14)], (250, 240, 214, 255))
    visage(pc, r)
    pc.disque(r.tete(9, -3), 2, (230, 90, 110, 255), False)  # joue
    pc.trait(r.tete(4, -6), r.tete(9, -6), (200, 20, 60, 255), 2)
    bras_avant(pc, p, c)


def dessiner_violaine(pc, p):
    r = Repere(p)
    c = dict(manche=(110, 52, 168, 255), main=PEAU["mate"], jambe=(46, 32, 70, 255), chaussure=(30, 20, 30, 255))
    pc.membre([r.tete(-10, 4), r.tete(-18, -6), r.tete(-16, -20)], (96, 56, 30, 255), 6)  # queue de cheval
    base_corps(pc, r, p, c)
    pc.poly(r.torse(9, 8, 4), c["manche"])
    for t in (0.3, 0.5, 0.7):
        pc.disque(r.corps(t, 5), 1.3, (240, 200, 90, 255), False)
    tete_base(pc, r, p, PEAU["mate"])
    pc.poly([r.tete(-13, 0), r.tete(-10, 10), r.tete(0, 13), r.tete(10, 9), r.tete(12, 4), r.tete(2, 7), r.tete(-6, 4)], (96, 56, 30, 255))
    visage(pc, r)
    # violon tenu contre l'épaule, dans la main arrière
    v = lerp(p["haB"], p["shF"], 0.35)
    d = norm(sub(p["shF"], p["haB"]))
    n = (d[1], -d[0])
    corps_v = [add(v, add(mul(d, -9), mul(n, 5))), add(v, add(mul(d, 7), mul(n, 5))),
               add(v, add(mul(d, 9), mul(n, -5))), add(v, add(mul(d, -9), mul(n, -5)))]
    pc.poly(corps_v, (170, 84, 30, 255))
    pc.membre([add(v, mul(d, -9)), add(v, mul(d, -20))], (60, 30, 12, 255), 2.5)
    bras_avant(pc, p, c)
    # archet
    pc.membre([sub(p["haF"], mul(norm(sub(p["haF"], p["elF"])), -2)), main_prolongee(p, "F", 24)], (225, 205, 160, 255), 1.8)


def dessiner_timbale(pc, p):
    r = Repere(p)
    vert = (32, 118, 76, 255)
    c = dict(manche=vert, main=PEAU["foncee"], jambe=(236, 236, 236, 255), chaussure=(20, 20, 20, 255))
    base_corps(pc, r, p, c)
    pc.poly(r.torse(11, 11), vert)
    pc.trait(r.corps(0.02, 9), r.corps(0.6, -9), (240, 200, 70, 255), 2.5)  # baudrier
    # tambour sur le ventre
    tb = r.corps(0.78, 9)
    pc.disque(tb, 11, (200, 30, 40, 255))
    pc.disque(tb, 7.5, (245, 240, 225, 255), False)
    tete_base(pc, r, p, PEAU["foncee"])
    # shako (grand chapeau) + plumet
    pc.poly([r.tete(-10, 6), r.tete(-11, 22), r.tete(9, 22), r.tete(10, 6)], (200, 30, 40, 255))
    pc.trait(r.tete(-10, 8), r.tete(10, 8), (240, 200, 70, 255), 3)
    pc.poly([r.tete(10, 6), r.tete(18, 4), r.tete(10, 10)], (20, 20, 20, 255))  # visière
    pc.membre([r.tete(-2, 22), r.tete(-4, 29)], (250, 250, 250, 255), 5)
    visage(pc, r)
    pc.trait(r.tete(3, -3), r.tete(11, -3), (40, 24, 20, 255), 2.5)  # moustache
    bras_avant(pc, p, c)
    for cote in ("F", "B"):
        bout = main_prolongee(p, cote, 16)
        pc.membre([p["ha" + cote], bout], (200, 160, 100, 255), 2.5)
        pc.disque(bout, 3, (245, 240, 225, 255))


def dessiner_fantome(pc, p):
    r = Repere(p)
    noir = (26, 22, 34, 255)
    c = dict(manche=noir, main=(245, 245, 245, 255), jambe=(30, 26, 40, 255), chaussure=(8, 8, 8, 255))
    # grande cape (derrière), doublure rouge
    e = r.corps(0.02, -2)
    bas_cape = add(p["hip"], mul(r.axe, 42))
    cape = [add(e, mul(r.av, 8)), add(bas_cape, mul(r.av, -4)), add(bas_cape, mul(r.av, -26)), add(e, mul(r.av, -12))]
    pc.poly(cape, noir)
    pc.poly([add(e, mul(r.av, 2)), add(bas_cape, mul(r.av, -8)), add(bas_cape, mul(r.av, -22)), add(e, mul(r.av, -8))], (140, 10, 30, 255), False)
    base_corps(pc, r, p, c)
    pc.poly(r.torse(9, 8), noir)
    pc.poly([r.corps(0.0, 4), r.corps(0.0, -1), r.corps(0.4, 2)], (240, 240, 240, 255), False)
    tete_base(pc, r, p, PEAU["pale"])
    # cheveux gominés
    pc.poly([r.tete(-13, -2), r.tete(-11, 10), r.tete(0, 13), r.tete(10, 10), r.tete(12, 5), r.tete(0, 8), r.tete(-8, 4)], (20, 18, 24, 255))
    # demi-masque blanc
    pc.poly([r.tete(1, 10), r.tete(11, 9), r.tete(13, -1), r.tete(9, -9), r.tete(2, -7)], (252, 252, 252, 255))
    pc.disque(r.tete(7, 2), 1.8, (20, 14, 24, 255), False)
    pc.trait(r.tete(3, -8), r.tete(7, -7), (120, 40, 40, 255), 1.2)
    bras_avant(pc, p, c)
    # rose rouge tenue dans la main avant
    rose = main_prolongee(p, "F", 12)
    pc.membre([p["haF"], rose], (40, 130, 50, 255), 1.8)
    pc.disque(rose, 3.5, (210, 20, 40, 255))


PERSONNAGES = {"maestro": dessiner_maestro, "diva": dessiner_diva, "violaine": dessiner_violaine,
               "timbale": dessiner_timbale, "fantome": dessiner_fantome}


def generer_personnages():
    for nom, fonction in PERSONNAGES.items():
        feuille = Image.new("RGBA", (FW * len(POSES), FH), (0, 0, 0, 0))
        for i, p in enumerate(POSES):
            img = Image.new("RGBA", (FW * S, FH * S), (0, 0, 0, 0))
            fonction(Pinceau(ImageDraw.Draw(img), ECHELLE_PERSO), p)
            feuille.paste(img.resize((FW, FH), Image.LANCZOS), (i * FW, 0))
        sauver(feuille, f"perso_{nom}.png")


# ---------------------------------------------------------------------------
# Objets, projectiles, icônes
# ---------------------------------------------------------------------------
def canevas(w, h):
    img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    return img, Pinceau(ImageDraw.Draw(img))


def fin(img, w, h, nom):
    sauver(img.resize((w, h), Image.LANCZOS), nom)


def dessiner_croche(pc, x, y, taille, couleur):
    """Une croche (note de musique) : tête ovale + hampe + crochet."""
    k = taille / 36
    tx, ty = x + 13 * k, y + 27 * k
    R = (8 * k * S, 6 * k * S)
    for col, ep in [(CONTOUR, 3), (couleur, 0)]:
        e = ep * S * 0.6
        pc.d.ellipse((tx * S - R[0] - e, ty * S - R[1] - e, tx * S + R[0] + e, ty * S + R[1] + e), fill=col)
    pc.membre([(tx + 7 * k, ty - 1 * k), (tx + 7 * k, y + 4 * k)], couleur, 3 * k)
    pc.membre([(tx + 7 * k, y + 4 * k), (tx + 15 * k, y + 11 * k), (tx + 13 * k, y + 19 * k)], couleur, 3 * k)


def generer_objets():
    blanc = (255, 255, 255, 255)
    img, pc = canevas(36, 36)
    dessiner_croche(pc, 2, 1, 32, blanc)
    fin(img, 36, 36, "note_projectile.png")

    img, pc = canevas(28, 28)
    dessiner_croche(pc, 1, 0, 26, blanc)
    fin(img, 28, 28, "note_hud.png")

    # étincelle d'impact
    img, pc = canevas(24, 24)
    pts = []
    for i in range(10):
        a = i * math.pi / 5
        rr = 11 if i % 2 == 0 else 4
        pts.append((12 + rr * math.cos(a), 12 + rr * math.sin(a)))
    pc.poly(pts, blanc, False)
    fin(img, 24, 24, "etincelle.png")

    # rose : soin
    img, pc = canevas(48, 48)
    pc.membre([(24, 44), (24, 22)], (50, 140, 60, 255), 3)
    pc.poly([(24, 34), (14, 28), (22, 30)], (60, 160, 70, 255))
    pc.poly([(24, 38), (34, 32), (26, 34)], (60, 160, 70, 255))
    for dx, dy in [(-6, -2), (6, -2), (0, -8), (-4, 5), (4, 5)]:
        pc.disque((24 + dx, 17 + dy), 6, (210, 24, 50, 255))
    pc.disque((24, 16), 4, (160, 10, 36, 255), False)
    fin(img, 48, 48, "objet_rose.png")

    # partition : remplit la jauge
    img, pc = canevas(48, 48)
    pc.poly([(8, 4), (40, 4), (40, 44), (8, 44)], (250, 244, 225, 255))
    for i in range(2):
        for j in range(5):
            y = 11 + i * 17 + j * 2.5
            pc.trait((11, y), (37, y), (80, 70, 60, 255), 0.7)
    for x, y in [(15, 15), (23, 12), (31, 17), (17, 31), (27, 28), (34, 33)]:
        pc.disque((x, y), 2, (30, 24, 30, 255), False)
        pc.trait((x + 1.8, y), (x + 1.8, y - 7), (30, 24, 30, 255), 0.8)
    fin(img, 48, 48, "objet_partition.png")

    # métronome : vitesse
    img, pc = canevas(48, 48)
    pc.poly([(16, 6), (32, 6), (40, 44), (8, 44)], (150, 90, 40, 255))
    pc.poly([(18, 14), (30, 14), (34, 38), (14, 38)], (240, 220, 180, 255), False)
    pc.membre([(24, 38), (32, 10)], (60, 60, 70, 255), 2)
    pc.poly([(29, 20), (35, 20), (34, 25), (29, 25)], (200, 170, 60, 255))
    fin(img, 48, 48, "objet_metronome.png")

    # baguette dorée : force
    img, pc = canevas(48, 48)
    pc.membre([(10, 40), (38, 10)], (250, 250, 250, 255), 3)
    pc.membre([(8, 42), (15, 35)], (220, 170, 40, 255), 6)
    for x, y, rr in [(38, 8, 4), (30, 6, 2.5), (42, 16, 2.5)]:
        pts = []
        for i in range(8):
            a = i * math.pi / 4
            q = rr if i % 2 == 0 else rr / 2.5
            pts.append((x + q * math.cos(a), y + q * math.sin(a)))
        pc.poly(pts, (255, 220, 80, 255), False)
    fin(img, 48, 48, "objet_baguette.png")


# ---------------------------------------------------------------------------
# Plateformes
# ---------------------------------------------------------------------------
def generer_plateformes():
    or_, or_f = (226, 176, 60, 255), (150, 100, 30, 255)
    # balcon de l'opéra 260x48
    img, pc = canevas(260, 48)
    pc.poly([(0, 0), (260, 0), (260, 12), (0, 12)], or_)
    for x in range(10, 260, 20):
        pc.membre([(x, 13), (x, 34)], or_f, 5)
    pc.poly([(0, 34), (260, 34), (248, 48), (12, 48)], (120, 16, 30, 255))
    pc.trait((0, 36), (260, 36), or_, 2)
    fin(img, 260, 48, "balcon.png")

    # lustre 240x90 (on se tient sur la barre du haut)
    img, pc = canevas(240, 90)
    pc.poly([(0, 0), (240, 0), (234, 14), (6, 14)], or_)
    for x in range(30, 240, 45):
        pc.membre([(x, 14), (x, 40)], or_f, 3)
        pc.disque((x, 46), 6, (230, 240, 255, 230))
        pc.disque((x, 60), 4, (200, 220, 255, 220))
    for x in range(15, 240, 30):
        pc.poly([(x, 14), (x + 4, 24), (x, 34), (x - 4, 24)], (210, 230, 255, 220))
    pc.poly([(110, 14), (130, 14), (124, 70), (116, 70)], or_)
    pc.disque((120, 76), 7, (230, 240, 255, 230))
    fin(img, 240, 90, "lustre.png")

    # touche blanche du piano géant 80x100
    img, pc = canevas(80, 100)
    pc.poly([(1, 0), (79, 0), (79, 100), (1, 100)], (248, 244, 232, 255))
    pc.poly([(3, 86), (77, 86), (77, 98), (3, 98)], (222, 214, 196, 255), False)
    pc.poly([(3, 2), (77, 2), (77, 8), (3, 8)], (255, 255, 255, 255), False)
    fin(img, 80, 100, "touche_blanche.png")

    # touche noire flottante 220x40
    img, pc = canevas(220, 40)
    pc.poly([(0, 0), (220, 0), (214, 40), (6, 40)], (22, 20, 26, 255))
    pc.poly([(6, 3), (214, 3), (212, 9), (8, 9)], (90, 88, 100, 255), False)
    fin(img, 220, 40, "touche_noire.png")

    # pupitre 260x60
    img, pc = canevas(260, 60)
    pc.poly([(0, 0), (260, 0), (256, 16), (4, 16)], (110, 60, 28, 255))
    pc.poly([(40, 16), (220, 16), (206, 30), (54, 30)], (90, 48, 20, 255))
    pc.membre([(130, 30), (130, 58)], (90, 48, 20, 255), 6)
    fin(img, 260, 60, "pupitre.png")


# ---------------------------------------------------------------------------
# Décors 1280x720
# ---------------------------------------------------------------------------
def degrade(w, h, haut, bas):
    img = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(haut[i] + (bas[i] - haut[i]) * t) for i in range(3)) + (255,))
    return img


def rideau(d, x0, x1, y0, y1, plis=7, rouge=(150, 16, 32)):
    largeur = (x1 - x0) / plis
    for i in range(plis):
        for k in range(int(largeur)):
            t = k / largeur
            lum = 0.55 + 0.45 * math.sin(t * math.pi)
            col = tuple(int(c * lum) for c in rouge)
            x = x0 + i * largeur + k
            d.line([(x, y0), (x, y1)], fill=col)


def lumiere(img, sommet, cible, largeur, alpha=60):
    calque = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(calque)
    d.polygon([sommet, (cible[0] - largeur, cible[1]), (cible[0] + largeur, cible[1])], fill=(255, 240, 190, alpha))
    d.ellipse((cible[0] - largeur, cible[1] - 18, cible[0] + largeur, cible[1] + 18), fill=(255, 240, 190, alpha + 20))
    calque = calque.filter(ImageFilter.GaussianBlur(14))
    return Image.alpha_composite(img, calque)


def generer_opera():
    random.seed(7)
    img = degrade(1280, 720, (70, 8, 22), (30, 2, 10))
    d = ImageDraw.Draw(img)
    or_, or_f = (214, 164, 64), (140, 96, 34)
    # trois rangées de loges avec public
    for rang, y in enumerate([120, 250, 380]):
        n = 9 - rang
        lw = 1000 / n
        for i in range(n):
            x = 140 + i * lw + (rang * lw / 4)
            if x + lw - 16 > 1150:
                continue
            d.rounded_rectangle((x, y, x + lw - 16, y + 100), 30, fill=(24, 4, 10), outline=or_, width=4)
            for k in range(3):
                cx = x + 20 + k * (lw - 50) / 2 + random.randint(-4, 4)
                d.ellipse((cx - 9, y + 50, cx + 9, y + 68), fill=(60, 30, 36))
                d.rectangle((cx - 13, y + 66, cx + 13, y + 100), fill=(60, 30, 36))
            d.rectangle((x - 4, y + 82, x + lw - 12, y + 100), fill=or_f)
            for bx in range(int(x), int(x + lw - 16), 10):
                d.line([(bx, y + 84), (bx, y + 98)], fill=or_, width=3)
    # fosse d'orchestre / scène en bois
    d.rectangle((0, 610, 1280, 720), fill=(96, 56, 28))
    for y in range(624, 720, 18):
        d.line([(0, y), (1280, y)], fill=(70, 40, 20), width=2)
    for x in range(0, 1280, 140):
        for y in range(610, 720, 36):
            d.line([(x + (y % 72), y), (x + (y % 72), y + 18)], fill=(70, 40, 20), width=2)
    d.rectangle((0, 604, 1280, 616), fill=or_)
    for x in range(40, 1280, 80):
        d.ellipse((x - 8, 606, x + 8, 614), fill=(255, 236, 150))
    # rideaux latéraux et lambrequin
    rideau(d, 0, 170, 0, 620)
    rideau(d, 1110, 1280, 0, 620)
    rideau(d, 0, 1280, 0, 70, plis=16)
    for x in range(0, 1280, 80):
        d.pieslice((x, 30, x + 80, 110), 0, 180, fill=(130, 12, 28))
        d.arc((x, 30, x + 80, 110), 0, 180, fill=or_, width=5)
    d.rectangle((0, 0, 1280, 22), fill=or_)
    img = lumiere(img, (330, 0), (330, 610), 150)
    img = lumiere(img, (950, 0), (950, 610), 150)
    sauver(img, "fond_opera.png", palette=True)
    return img


def dessiner_note_deco(d, x, y, t, col):
    d.ellipse((x, y + 3 * t, x + 5 * t, y + 7 * t), fill=col)
    d.line([(x + 5 * t, y + 5 * t), (x + 5 * t, y - 6 * t)], fill=col, width=max(2, int(t)))
    d.line([(x + 5 * t, y - 6 * t), (x + 9 * t, y - 2 * t)], fill=col, width=max(2, int(t)))


def generer_piano():
    random.seed(3)
    img = degrade(1280, 720, (12, 10, 44), (58, 24, 88))
    d = ImageDraw.Draw(img)
    for _ in range(170):
        x, y, r = random.randint(0, 1280), random.randint(0, 560), random.choice([1, 1, 1, 2])
        v = random.randint(150, 255)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(v, v, 255))
    # grand piano en silhouette au fond
    d.polygon([(760, 560), (820, 300), (900, 200), (1060, 170), (1210, 250), (1240, 560)], fill=(24, 18, 40))
    d.line([(820, 300), (1060, 60)], fill=(40, 32, 64), width=10)
    d.polygon([(820, 300), (1060, 60), (1100, 70), (900, 200)], fill=(32, 26, 54))
    # portée musicale géante ondulée + notes lumineuses
    calque = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dc = ImageDraw.Draw(calque)
    for ligne in range(5):
        pts = [(x, 250 + ligne * 22 + 60 * math.sin(x / 210)) for x in range(-10, 1300, 10)]
        dc.line(pts, fill=(170, 150, 255, 120), width=3)
    for i, x in enumerate(range(90, 1280, 150)):
        y = 250 + (i % 5) * 18 + 60 * math.sin(x / 210)
        dessiner_note_deco(dc, x, y - 10, 4, (230, 220, 255, 200))
    lueur = calque.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, lueur)
    img = Image.alpha_composite(img, calque)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 600, 1280, 720), fill=(20, 12, 20))
    sauver(img, "fond_piano.png", palette=True)
    return img


def generer_menu():
    img = degrade(1280, 720, (40, 4, 12), (12, 0, 4))
    d = ImageDraw.Draw(img)
    rideau(d, 0, 1280, 0, 720, plis=18, rouge=(120, 12, 28))
    d.rectangle((0, 0, 1280, 26), fill=(214, 164, 64))
    for x in range(0, 1280, 80):
        d.pieslice((x, -40, x + 80, 60), 0, 180, fill=(100, 8, 22))
        d.arc((x, -40, x + 80, 60), 0, 180, fill=(214, 164, 64), width=5)
    voile = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(voile).ellipse((240, 60, 1040, 760), fill=(255, 230, 170, 70))
    img = Image.alpha_composite(img, voile.filter(ImageFilter.GaussianBlur(60)))
    sauver(img, "fond_menu.png", palette=True)


def generer_vignettes(opera, piano):
    # sur la vignette du piano, on ajoute la rangée de touches (qui sont des sprites en jeu)
    piano = piano.copy()
    touche = Image.open(os.path.join(DOSSIER, "touche_blanche.png"))
    for i in range(16):
        piano.alpha_composite(touche, (i * 80, 620))
    for nom, fond in (("opera", opera), ("piano", piano)):
        v = fond.convert("RGB").resize((384, 216), Image.LANCZOS)
        sauver(v, f"vignette_{nom}.png", palette=True)


def generer_presentation(opera):
    """Jaquette 800x450 demandée pour la borne."""
    img = opera.convert("RGBA").resize((800, 450), Image.LANCZOS)
    voile = Image.new("RGBA", img.size, (0, 0, 0, 90))
    img = Image.alpha_composite(img, voile)
    ordre = ["violaine", "diva", "maestro", "timbale", "fantome"]
    for i, nom in enumerate(ordre):
        feuille = Image.open(os.path.join(DOSSIER, f"perso_{nom}.png"))
        frame = feuille.crop((13 * FW, 0, 14 * FW, FH)).resize((int(FW * 1.3), int(FH * 1.3)), Image.LANCZOS)
        if i >= 3:
            frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
        img.alpha_composite(frame, (int(45 + i * 140), 216))
    d = ImageDraw.Draw(img)
    police = ImageFont.truetype(POLICE_TITRE, 78)
    sous = ImageFont.truetype(POLICE_TITRE, 26)
    for texte, y, f in (("THEATER", 20, police), ("SHOWDOWN", 100, police)):
        w = d.textlength(texte, font=f)
        d.text(((800 - w) / 2, y), texte, font=f, fill=(255, 214, 90), stroke_width=6, stroke_fill=(60, 0, 16))
    t = "Duel musical en 1 contre 1"
    d.text(((800 - d.textlength(t, font=sous)) / 2, 185), t, font=sous, fill=(255, 255, 255), stroke_width=3, stroke_fill=(40, 0, 10))
    chemin = os.path.join(RACINE, "presentation.png")
    img.convert("RGB").save(chemin, optimize=True)
    print(f"presentation.png             {os.path.getsize(chemin) / 1024:7.1f} Ko")


if __name__ == "__main__":
    generer_personnages()
    generer_objets()
    generer_plateformes()
    op = generer_opera()
    pi = generer_piano()
    generer_menu()
    generer_vignettes(op, pi)
    generer_presentation(op)
