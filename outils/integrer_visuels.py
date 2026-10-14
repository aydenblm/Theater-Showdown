"""
Intègre les visuels de l'équipe (dossier "visuel/SAE 301", extrait de visuel.zip) dans le jeu :
renommage en minuscules sans espaces, recadrage, redimensionnement et compression
pour respecter les consignes de la borne (image plein écran < 200 Ko, chemins simples).

Utilisation (depuis le dossier Theater-Showdown) :
    python outils/integrer_visuels.py [chemin/vers/SAE 301]
"""
import os
import shutil
import sys

from PIL import Image, ImageFont, ImageDraw

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, "..", "visuel", "SAE 301")
IMAGES = os.path.join(RACINE, "assets", "images")
VIDEOS = os.path.join(RACINE, "assets", "videos")
os.makedirs(IMAGES, exist_ok=True)
os.makedirs(VIDEOS, exist_ok=True)


def src(*chemin):
    return Image.open(os.path.join(SOURCE, *chemin))


def sauver(img, nom, dossier=IMAGES):
    chemin = os.path.join(dossier, nom)
    if nom.endswith(".jpg"):
        img.convert("RGB").save(chemin, quality=86, optimize=True)
    else:
        img.save(chemin, optimize=True)
        if os.path.getsize(chemin) > 40 * 1024:  # trop lourd : palette de 256 couleurs
            img.convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE).save(chemin, optimize=True)
    print(f"{nom:32s} {img.size[0]:5d}x{img.size[1]:<5d} {os.path.getsize(chemin) / 1024:7.1f} Ko")


def largeur(img, w, filtre=Image.LANCZOS):
    """Redimensionne à la largeur w en gardant les proportions."""
    return img.resize((w, round(img.height * w / img.width)), filtre)


def recadrer(img):
    """Supprime les marges transparentes."""
    return img.crop(img.getbbox())


# ---------------------------------------------------------------------------
# Menus
# ---------------------------------------------------------------------------
def menus():
    sauver(src("menu", "fond", "fond_rideau_ferme_720p.jpg"), "fond_menu.jpg")
    sauver(src("menu", "fond", "fond_rideau_ouvert_720p.jpg"), "fond_scene.jpg")
    sauver(largeur(recadrer(src("menu", "logo_Theater_Showdown.png").convert("RGBA")), 700), "logo.png")
    # les boutons sont centrés dans une image 1920x1080 : on garde la même zone pour tous
    for nom in ("solo", "multi", "commandes"):
        for suffixe in ("", "_sombre"):
            img = src("menu", "bouton", f"bouton_{nom}{suffixe}.png").convert("RGBA").crop((509, 322, 1413, 768))
            sauver(largeur(img, 300), f"bouton_{nom}{suffixe}.png")
    sauver(src("menu", "perso", "carte_Joueur1.png"), "carte_joueur1.png")
    sauver(src("menu", "perso", "carte_joueur2.png"), "carte_joueur2.png")
    for nom in ("ouverture", "fermeture"):
        shutil.copy(os.path.join(SOURCE, "menu", "fond", f"animation_{nom}.mp4"), os.path.join(VIDEOS, f"rideau_{nom}.mp4"))
        print(f"rideau_{nom}.mp4")


# ---------------------------------------------------------------------------
# Arènes : décors, vignettes et plateformes
# ---------------------------------------------------------------------------
def arenes():
    decors = {
        "opera": ("map 1", "Background_Map1_compressed.jpg"),
        "piano": ("map 2", "Background_Map2_compressed.jpg"),
        "coulisses": ("map 3", "Background_Map3.png"),
    }
    for nom, (dossier, fichier) in decors.items():
        fond = src("menu", "map", dossier, fichier).convert("RGB").resize((1280, 720), Image.LANCZOS)
        sauver(fond, f"fond_{nom}.jpg")
        sauver(fond.resize((384, 216), Image.LANCZOS), f"vignette_{nom}.jpg")

    plateformes = {
        ("map 1", "plateforme_balcon.png"): "balcon.png",
        ("map 1", "plateforme_bois.png"): "plateforme_bois.png",
        ("map 1", "plateforme_lustre.png"): "lustre.png",
        ("map 2", "plateforme_piano.png"): "touche_noire.png",
        ("map 3", "caisse_bois.png"): "caisse_bois.png",
        ("map 3", "flight_case.png"): "flight_case.png",
        ("map 3", "pont_lumiere.png"): "pont_lumiere.png",
        ("map 3", "poutre_suspendue.png"): "poutre_suspendue.png",
    }
    for (dossier, fichier), nom in plateformes.items():
        sauver(src("menu", "map", dossier, fichier).convert("RGBA"), nom)


# ---------------------------------------------------------------------------
# HUD et textes
# ---------------------------------------------------------------------------
ECHELLE_BARRE = 0.45


def hud():
    # barre de vie : on garde seulement la version vide et la version pleine,
    # le jeu "rogne" la pleine selon les PV (affichage continu au lieu de 9 paliers)
    for fichier, nom in (("barre joueur vide.png", "barre_vie_vide.png"), ("Plan de travail 9.png", "barre_vie_pleine.png")):
        img = src("hud", "barre hp joueur", fichier).convert("RGBA").crop((112, 234, 1138, 492))
        img = img.resize((round(img.width * ECHELLE_BARRE), round(img.height * ECHELLE_BARRE)), Image.LANCZOS)
        sauver(img, nom)
        # version miroir pour le joueur 2 (setFlipX + setCrop se combinent mal dans Phaser 3.60)
        sauver(img.transpose(Image.FLIP_LEFT_RIGHT), nom.replace(".png", "_j2.png"))

    # notes de la jauge spéciale (pixels de 8 px dans l'original -> 2 px)
    for fichier, nom in (("note_ult_normale.png", "note_ult.png"), ("note_ult_transparente.png", "note_ult_vide.png")):
        sauver(src("hud", "note ult", fichier).convert("RGBA").resize((48, 48), Image.NEAREST), nom)

    textes = {
        "choisissez_votre_artiste.png": ("titre_artiste.png", 820),
        "choisissez_la_scene.png": ("titre_scene.png", 760),
        "gagnant_joueur_1.png": ("gagnant_joueur_1.png", 820),
        "gagnant_joueur_2.png": ("gagnant_joueur_2.png", 820),
        "entracte.png": ("titre_entracte.png", 480),
        "joueur_1.png": ("texte_joueur_1.png", 420),
        "joueur_2.png": ("texte_joueur_2.png", 420),
        "round_1.png": ("texte_round_1.png", 520),
        "round_2.png": ("texte_round_2.png", 520),
        "round_3.png": ("texte_round_3.png", 520),
        "texte_ko.png": ("texte_ko.png", 320),
    }
    for fichier, (nom, w) in textes.items():
        img = recadrer(src("hud", "textes", fichier).convert("RGBA"))
        sauver(largeur(img, w) if img.width > w else img, nom)


# ---------------------------------------------------------------------------
# Personnages pixel art : planche au même format que les autres personnages
# ---------------------------------------------------------------------------
# Les planches du jeu ont 14 frames : repos x2, marche x4, saut, garde, légère, lourde,
# tir, touché, K.O., victoire. Doremi et Symphanie n'ont pour l'instant que 4 dessins
# (repos + 3 étapes d'attaque) : on fabrique les frames manquantes à partir de ceux-ci,
# en attendant les vraies animations. Frames 14 à 16 = séquence d'attaque complète.
T = 128


COLONNES = 9  # frames par ligne dans les planches des personnages


def planche_pixel(dossier, fichier, nom):
    attaque = src("personnages", dossier, fichier).convert("RGBA")
    f = [attaque.crop((i * T, 0, (i + 1) * T, T)) for i in range(4)]

    def decale(img, dy):
        """Décale l'image verticalement de dy pixels (négatif = vers le haut)."""
        out = Image.new("RGBA", (T, T), (0, 0, 0, 0))
        out.paste(img, (0, dy), img)
        return out

    def penche(img, angle):
        return img.rotate(angle, resample=Image.NEAREST, center=(T // 2, T))

    allonge = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    couche = recadrer(f[0]).rotate(90, expand=True, resample=Image.NEAREST)
    allonge.alpha_composite(couche, ((T - couche.width) // 2, T - couche.height))

    frames = [
        f[0], decale(f[0], 1),                                  # repos
        decale(f[0], -2), f[0], decale(f[0], -2), f[0],         # marche (rebond)
        decale(f[1], -4),                                        # saut
        decale(f[1], 3),                                         # garde
        f[3], f[3], f[3],                                        # légère, lourde, tir
        penche(f[0], 10),                                        # touché
        allonge,                                                 # K.O.
        f[1],                                                    # victoire
        f[1], f[2], f[3],                                        # séquence d'attaque
    ]
    # grille de COLONNES frames par ligne : une seule ligne ferait 2176 px de large,
    # au-delà de la taille de texture maximale du GPU du Raspberry Pi 3 (2048 px)
    lignes = -(-len(frames) // COLONNES)
    feuille = Image.new("RGBA", (T * COLONNES, T * lignes), (0, 0, 0, 0))
    for i, img in enumerate(frames):
        feuille.alpha_composite(img, ((i % COLONNES) * T, (i // COLONNES) * T))
    sauver(feuille, nom)


def personnages():
    planche_pixel("Doremi", "Doremi_attack1.png", "perso_doremi.png")
    planche_pixel("Symphanie", "Symphanie_attack1.png", "perso_symphanie.png")
    sauver(src("Projectiles", "Attaques_Doremi", "cle_de_fa.png").convert("RGBA"), "cle_de_fa.png")
    sauver(src("Projectiles", "Attaques_Symphanie", "cle_de_sol.png").convert("RGBA"), "cle_de_sol.png")


# ---------------------------------------------------------------------------
# Jaquette 800x450 pour la borne
# ---------------------------------------------------------------------------
def presentation():
    img = Image.open(os.path.join(IMAGES, "fond_opera.jpg")).convert("RGBA").resize((800, 450), Image.LANCZOS)
    img.alpha_composite(Image.new("RGBA", img.size, (0, 0, 0, 70)))
    logo = largeur(Image.open(os.path.join(IMAGES, "logo.png")).convert("RGBA"), 520)
    img.alpha_composite(logo, ((800 - logo.width) // 2, 8))
    for i, nom in enumerate(("doremi", "symphanie")):
        perso = Image.open(os.path.join(IMAGES, f"perso_{nom}.png")).crop((13 % COLONNES * T, 13 // COLONNES * T, (13 % COLONNES + 1) * T, (13 // COLONNES + 1) * T))
        perso = perso.resize((T * 2, T * 2), Image.NEAREST)
        if i == 1:
            perso = perso.transpose(Image.FLIP_LEFT_RIGHT)
        img.alpha_composite(perso, (150 + i * 250, 450 - T * 2))
    chemin = os.path.join(RACINE, "presentation.png")
    img.convert("RGB").quantize(256, method=Image.Quantize.MEDIANCUT).save(chemin, optimize=True)
    print(f"presentation.png                 {os.path.getsize(chemin) / 1024:7.1f} Ko")


if __name__ == "__main__":
    menus()
    arenes()
    hud()
    personnages()
    presentation()
