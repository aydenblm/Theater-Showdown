"""
Construit le niveau 1 du mode solo, en mode plateformer, avec le tileset de generer_tileset.py.

La carte fait 120 x 30 tuiles (3840 x 960 px) : elle défile en largeur et en hauteur.
Le joueur progresse de gauche à droite en sautant de plateforme en plateforme, grimpe
à l'échelle et à la corde, évite les trous et atteint la sortie tout en haut à droite.

Elle est écrite en deux formats, générés à partir des mêmes données :
  niveau_solo_1.tmx   XML de Tiled, à ouvrir et retoucher dans Tiled
  niveau_solo_1.tmj   JSON, celui que lit Phaser (tilemapTiledJSON)

Calques :
  calque_fond         murs, rideaux, lambris (décor, sans collision)
  calque_decor        colonnes, projecteurs, mobilier (décor, sans collision)
  calque_plateformes  sol, plateformes, caisses, piano, échelle, corde
  objets              départ, points de passage, ennemis, notes, sortie, zones de mort, murs invisibles

Utilisation (depuis le dossier theater_showdown) :
    python outils/generer_niveau_solo.py
    python outils/generer_niveau_solo.py --apercu chemin/apercu.png
"""
import json
import os
import sys

from PIL import Image, ImageDraw

import generer_tileset as tuiles

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS = os.path.join(RACINE, "assets", "maps")

L, H = 120, 30  # en tuiles
TP = tuiles.TP  # 32 px
SOL, SOL_MILIEU, SOL_BAS = 27, 28, 29  # rangées du sol (SOL = dessus, où l'on marche)
TROUS = [(20, 23), (46, 49), (96, 100)]  # colonnes sans sol, bornes incluses
FOND, DECOR, PLATEFORMES = "calque_fond", "calque_decor", "calque_plateformes"

COULEURS_APERCU = {
    "depart_joueur": (80, 255, 120),
    "checkpoint": (80, 160, 255),
    "ennemi": (255, 120, 0),
    "note": (255, 255, 255),
    "sortie": (255, 230, 80),
    "zone_mort": (255, 0, 255),
    "mur_invisible": (0, 255, 255),
}


def dans_trou(x):
    return any(a <= x <= b for a, b in TROUS)


class Carte:
    def __init__(self):
        self.calques = {nom: [[0] * L for _ in range(H)] for nom in (FOND, DECOR, PLATEFORMES)}
        self.objets = []
        self.prochain_id = 1
        self.proprietes = [("nom", "string", "niveau_solo_1"), ("mode", "string", "plateformer")]

    def pose(self, calque, x, y, nom):
        if 0 <= x < L and 0 <= y < H:
            self.calques[calque][y][x] = tuiles.ID[nom] + 1  # gid = id + firstgid (1)

    def remplit(self, calque, x0, x1, y0, y1, nom):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.pose(calque, x, y, nom)

    def ajoute_objet(self, type_, x, y, largeur=0, hauteur=0, point=False):
        """Coordonnées en pixels, comme dans Tiled."""
        objet = {"id": self.prochain_id, "name": "", "type": type_, "x": x, "y": y,
                 "width": largeur, "height": hauteur, "rotation": 0, "visible": True}
        if point:
            objet["point"] = True
        self.objets.append(objet)
        self.prochain_id += 1

    def point(self, type_, colonne, rangee):
        """Point posé sur le dessus de la tuile (colonne, rangee) : le joueur s'y tient."""
        self.ajoute_objet(type_, colonne * TP + TP // 2, rangee * TP - 8, point=True)


def plateforme(c, x0, x1, y, style):
    """Plateforme à 3 morceaux (gauche, milieu, droite) : style = 'plateforme', 'balcon' ou 'poutre'."""
    c.pose(PLATEFORMES, x0, y, style + "_gauche")
    c.remplit(PLATEFORMES, x0 + 1, x1 - 1, y, y, style + "_milieu")
    c.pose(PLATEFORMES, x1, y, style + "_droite")


def sol(c):
    """Sol de la scène, interrompu par les trous. Les bords des morceaux sont marqués."""
    for x in range(L):
        if dans_trou(x):
            continue
        gauche = x == 0 or dans_trou(x - 1)
        droite = x == L - 1 or dans_trou(x + 1)
        bord = "_gauche" if gauche else "_droite" if droite else ""
        c.pose(PLATEFORMES, x, SOL, "plancher_haut" + bord)
        c.pose(PLATEFORMES, x, SOL_MILIEU, "plancher" + (bord or "_plein"))
        c.pose(PLATEFORMES, x, SOL_BAS, "plancher_bas" + bord)


def piano(c, x0):
    """Piano géant de 7 tuiles : touches en haut, laque noire dessous, posé sur le sol."""
    for x in range(x0, x0 + 7):
        nom = "clavier_gauche" if x == x0 else "clavier_droite" if x == x0 + 6 else "clavier_milieu"
        c.pose(PLATEFORMES, x, SOL - 3, nom)
        c.pose(PLATEFORMES, x, SOL - 2, "laque_doree")
        c.pose(PLATEFORMES, x, SOL - 1, "laque")


def construire():
    c = Carte()

    # ---- fond : rideau de scène, murs, rideaux sur les bords ----
    c.remplit(FOND, 0, L - 1, 1, H - 1, "mur")
    c.remplit(FOND, 0, L - 1, 0, 0, "rideau_haut")
    c.remplit(FOND, 0, L - 1, 25, 25, "mur_lambris")
    for x in list(range(3)) + list(range(L - 3, L)):
        c.remplit(FOND, x, x, 1, SOL - 1, "rideau_plis_a" if x % 2 == 0 else "rideau_plis_b")
        c.pose(FOND, x, SOL, "rideau_bas")
    c.pose(FOND, 2, 11, "rideau_embrasse")
    for x in (14, 30, 44, 60, 78, 96, 110):
        c.pose(FOND, x, 5, "mur_applique")

    # ---- décor : colonnes, projecteurs, mobilier (sans collision) ----
    for x in (13, 66, 84, 106):
        c.pose(DECOR, x, 9, "colonne_haut")
        c.remplit(DECOR, x, x, 10, SOL - 2, "colonne_milieu")
        c.pose(DECOR, x, SOL - 1, "colonne_base")
    for x in (10, 26, 40, 56, 72, 88, 104):
        c.pose(DECOR, x, 1, "projecteur")
    for x, y in [(4, SOL - 1), (5, SOL - 1), (50, SOL - 1), (51, SOL - 1), (102, SOL - 1), (103, SOL - 1)]:
        c.pose(DECOR, x, y, "fauteuil")
    c.pose(DECOR, 88, SOL - 1, "pupitre")

    # ---- plateformes et obstacles ----
    sol(c)
    piano(c, 54)
    # zone 1 : départ et premières plateformes
    plateforme(c, 8, 11, 24, "plateforme")
    plateforme(c, 14, 17, 21, "balcon")
    # zone 2 : caisses, poutre accessible par l'échelle, corde pour remonter
    for x, y, nom in [(30, SOL - 1, "caisse_x"), (31, SOL - 1, "caisse_diagonale"), (31, SOL - 2, "caisse_x"),
                      (77, SOL - 1, "caisse_diagonale"), (77, SOL - 2, "caisse_x")]:
        c.pose(PLATEFORMES, x, y, nom)
    plateforme(c, 36, 44, 18, "poutre")
    for y in range(19, SOL):
        c.pose(PLATEFORMES, 35, y, "echelle")
    for y in range(1, 18):
        c.pose(PLATEFORMES, 40, y, "corde")
    # zone 3 : escalade au-dessus du piano
    plateforme(c, 62, 66, 21, "balcon")
    plateforme(c, 68, 71, 18, "plateforme")
    plateforme(c, 73, 80, 15, "poutre")
    # zone 4 : descente, puis pont au-dessus du trou
    plateforme(c, 83, 86, 21, "plateforme")
    plateforme(c, 88, 91, 24, "plateforme")
    plateforme(c, 95, 101, 24, "plateforme")
    # zone 5 : escalier vers la sortie
    plateforme(c, 102, 104, 24, "plateforme")
    plateforme(c, 106, 108, 21, "plateforme")
    plateforme(c, 110, 112, 18, "plateforme")
    plateforme(c, 113, 116, 15, "poutre")
    for y in range(1, 15):
        c.pose(PLATEFORMES, 116, y, "corde")

    # ---- objets : départ, points de passage, ennemis, notes, sortie, zones ----
    c.point("depart_joueur", 4, SOL)
    for colonne in (24, 50, 92):
        c.point("checkpoint", colonne, SOL)
    for colonne, rangee in [(28, SOL), (40, 18), (66, 21), (90, 24), (107, 21)]:
        c.point("ennemi", colonne, rangee)
    for colonne, rangee in [(9, 24), (15, 21), (37, 18), (57, 24), (63, 21), (75, 15), (108, 18), (115, 15)]:
        c.point("note", colonne, rangee)
    c.ajoute_objet("sortie", 113 * TP, 11 * TP, 4 * TP, 4 * TP)
    for a, b in TROUS:
        c.ajoute_objet("zone_mort", a * TP, SOL * TP, (b - a + 1) * TP, (H - SOL) * TP)
    c.ajoute_objet("mur_invisible", 3 * TP - 4, 0, 8, H * TP)           # bord gauche, après le rideau
    c.ajoute_objet("mur_invisible", (L - 3) * TP - 4, 0, 8, H * TP)     # bord droit, avant le rideau
    return c


def calque_tuiles(nom, donnees, id_):
    return {"id": id_, "name": nom, "type": "tilelayer", "width": L, "height": H,
            "x": 0, "y": 0, "opacity": 1, "visible": True,
            "data": [gid for ligne in donnees for gid in ligne]}


def calque_objets(objets, id_):
    return {"id": id_, "name": "objets", "type": "objectgroup", "draworder": "topdown",
            "x": 0, "y": 0, "opacity": 1, "visible": True, "objects": objets}


def carte_tmj(c, feuille):
    return {
        "type": "map", "version": "1.10", "tiledversion": "1.10.2", "orientation": "orthogonal",
        "renderorder": "right-down", "width": L, "height": H, "tilewidth": TP, "tileheight": TP,
        "infinite": False, "backgroundcolor": "#12040a",
        "nextlayerid": 5, "nextobjectid": c.prochain_id,
        "properties": [{"name": n, "type": t, "value": v} for n, t, v in c.proprietes],
        "layers": [
            calque_tuiles(FOND, c.calques[FOND], 1),
            calque_tuiles(DECOR, c.calques[DECOR], 2),
            calque_tuiles(PLATEFORMES, c.calques[PLATEFORMES], 3),
            calque_objets(c.objets, 4),
        ],
        "tilesets": [tuiles.tileset_json(feuille)],
    }


def valeur_tmx(prop):
    """Tiled écrit les booléens en minuscules : true / false."""
    return str(prop["value"]).lower() if prop["type"] == "bool" else prop["value"]


def attribut_type(type_):
    """En XML, Tiled omet l'attribut type pour les textes (type par défaut)."""
    return "" if type_ == "string" else f' type="{type_}"'


def carte_tmx(c, feuille):
    """Même carte au format XML de Tiled (.tmx)."""
    tileset = tuiles.tileset_json(feuille)
    lignes = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" '
        f'width="{L}" height="{H}" tilewidth="{TP}" tileheight="{TP}" infinite="0" '
        f'nextlayerid="5" nextobjectid="{c.prochain_id}" backgroundcolor="#12040a">',
        ' <properties>',
    ]
    for nom, type_, valeur in c.proprietes:
        lignes.append(f'  <property name="{nom}"{attribut_type(type_)} value="{valeur}"/>')
    lignes += [
        ' </properties>',
        f' <tileset firstgid="1" name="{tileset["name"]}" tilewidth="{TP}" tileheight="{TP}" '
        f'tilecount="{tileset["tilecount"]}" columns="{tuiles.COLONNES}">',
        f'  <image source="{tileset["image"]}" width="{feuille.width}" height="{feuille.height}"/>',
    ]
    for tile in tileset["tiles"]:
        lignes.append(f'  <tile id="{tile["id"]}">')
        lignes.append('   <properties>')
        for p in tile["properties"]:
            lignes.append(f'    <property name="{p["name"]}"{attribut_type(p["type"])} value="{valeur_tmx(p)}"/>')
        lignes += ['   </properties>', '  </tile>']
    lignes.append(' </tileset>')

    for id_, nom in enumerate((FOND, DECOR, PLATEFORMES), start=1):
        donnees = ",\n".join(",".join(str(gid) for gid in ligne) for ligne in c.calques[nom])
        lignes += [f' <layer id="{id_}" name="{nom}" width="{L}" height="{H}">',
                   '  <data encoding="csv">', donnees, '  </data>', ' </layer>']

    lignes.append(' <objectgroup id="4" name="objets" draworder="topdown">')
    for o in c.objets:
        entete = f'  <object id="{o["id"]}" name="" type="{o["type"]}" x="{o["x"]}" y="{o["y"]}"'
        if o.get("point"):
            lignes += [entete + '>', '   <point/>', '  </object>']
        else:
            lignes.append(entete + f' width="{o["width"]}" height="{o["height"]}"/>')
    lignes += [' </objectgroup>', '</map>']
    return "\n".join(lignes) + "\n"


def apercu(feuille, c, chemin):
    """Rendu du niveau, avec les objets en couleur, pour vérifier le dessin sans ouvrir Tiled."""
    img = Image.new("RGBA", (L * TP, H * TP), (18, 4, 10, 255))
    for nom in (FOND, DECOR, PLATEFORMES):
        for y, ligne in enumerate(c.calques[nom]):
            for x, gid in enumerate(ligne):
                if gid:
                    i = gid - 1
                    colonne, rangee = i % tuiles.COLONNES, i // tuiles.COLONNES
                    tuile = feuille.crop((colonne * TP, rangee * TP, (colonne + 1) * TP, (rangee + 1) * TP))
                    img.alpha_composite(tuile, (x * TP, y * TP))
    d = ImageDraw.Draw(img)
    for objet in c.objets:
        couleur = COULEURS_APERCU[objet["type"]]
        x, y = objet["x"], objet["y"]
        if objet.get("point"):
            d.line([(x - 8, y), (x + 8, y)], fill=couleur, width=3)
            d.line([(x, y - 8), (x, y + 8)], fill=couleur, width=3)
        else:
            d.rectangle((x, y, x + objet["width"] - 1, y + objet["height"] - 1), outline=couleur, width=3)
    img.save(chemin)


if __name__ == "__main__":
    feuille = tuiles.generer_image()
    c = construire()
    chemin_tmx = os.path.join(MAPS, "niveau_solo_1.tmx")
    with open(chemin_tmx, "w", encoding="utf-8") as f:
        f.write(carte_tmx(c, feuille))
    print(f"niveau_solo_1.tmx  {L}x{H} tuiles  {os.path.getsize(chemin_tmx) // 1024} Ko  "
          f"{len(c.objets)} objets")

    chemin_tmj = os.path.join(MAPS, "niveau_solo_1.tmj")  # version JSON, celle que lit Phaser
    with open(chemin_tmj, "w", encoding="utf-8") as f:
        json.dump(carte_tmj(c, feuille), f)
    print("niveau_solo_1.tmj  (JSON pour Phaser)")
    if "--apercu" in sys.argv:
        chemin_apercu = sys.argv[sys.argv.index("--apercu") + 1]
        apercu(feuille, c, chemin_apercu)
        print("aperçu :", chemin_apercu)
