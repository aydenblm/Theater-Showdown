/*
 * Génère tous les sons et musiques de Theater Showdown en MP3.
 * Tout est synthétisé par ce script : les mélodies sont des œuvres du domaine
 * public (Beethoven, Wagner, Vivaldi, Rossini, Bach, Bizet, Grieg) réarrangées ici,
 * donc aucun problème de droits.
 *
 * Utilisation (depuis le dossier outils) :
 *   npm install
 *   node generer_sons.js
 */
const fs = require("fs");
const path = require("path");

// lamejs (encodeur MP3 en JS) : on charge le fichier "tout-en-un" pour éviter un bug du paquet npm
const lamejs = new Function(fs.readFileSync(require.resolve("lamejs/lame.all.js"), "utf8") + ";return lamejs;")();

const SR = 22050; // fréquence d'échantillonnage
const KBPS = 48; // 48 kbit/s = 6 Ko/s (limite de la SAE : 16 Ko/s)
const DOSSIER = path.join(__dirname, "..", "assets", "sons");
fs.mkdirSync(DOSSIER, { recursive: true });

/* ------------------------------------------------------------------ */
/* Outils de synthèse                                                  */
/* ------------------------------------------------------------------ */
let graine = 42;
function hasard() {
  graine = (graine * 1103515245 + 12345) & 0x7fffffff;
  return graine / 0x7fffffff;
}

function tampon(duree) {
  return new Float32Array(Math.ceil(duree * SR));
}

const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function frequence(nom) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(nom);
  let demi = NOTES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const midi = (parseInt(m[3], 10) + 1) * 12 + demi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Timbres : amplitudes des harmoniques + enveloppe
const INSTRUMENTS = {
  cordes: { h: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.12, 0.1], a: 0.04, r: 0.12, vib: 5.5, vibAmp: 0.006, decroissance: 0 },
  cuivre: { h: [1, 0.7, 0.55, 0.4, 0.3, 0.2, 0.12], a: 0.02, r: 0.06, vib: 5, vibAmp: 0.003, decroissance: 0.4 },
  orgue: { h: [1, 0.9, 0, 0.6, 0, 0.35, 0, 0.25], a: 0.01, r: 0.08, vib: 0, vibAmp: 0, decroissance: 0 },
  piano: { h: [1, 0.45, 0.25, 0.14, 0.08, 0.04], a: 0.004, r: 0.05, vib: 0, vibAmp: 0, decroissance: 3.2 },
  clavecin: { h: [1, 0.8, 0.6, 0.45, 0.3, 0.2, 0.1], a: 0.002, r: 0.03, vib: 0, vibAmp: 0, decroissance: 6 },
  hautbois: { h: [0.6, 1, 0.5, 0.45, 0.2, 0.15], a: 0.03, r: 0.08, vib: 5, vibAmp: 0.005, decroissance: 0.2 },
  pizz: { h: [1, 0.35, 0.12], a: 0.003, r: 0.03, vib: 0, vibAmp: 0, decroissance: 9 },
  cloche: { h: [1, 0, 0.4, 0, 0.2, 0.1], a: 0.002, r: 0.1, vib: 0, vibAmp: 0, decroissance: 5 },
};

function note(buf, t0, duree, freq, instr, vol = 0.3) {
  const I = INSTRUMENTS[instr];
  const debut = Math.floor(t0 * SR);
  const n = Math.floor((duree + I.r) * SR);
  let phase = I.h.map(() => 0);
  for (let i = 0; i < n && debut + i < buf.length; i++) {
    const t = i / SR;
    let env = t < I.a ? t / I.a : 1;
    env *= Math.exp(-I.decroissance * t);
    if (t > duree) env *= Math.max(0, 1 - (t - duree) / I.r);
    const f = freq * (1 + I.vibAmp * Math.sin(2 * Math.PI * I.vib * t));
    let s = 0;
    for (let k = 0; k < I.h.length; k++) {
      if (!I.h[k] || f * (k + 1) > SR / 2.2) continue;
      phase[k] += (2 * Math.PI * f * (k + 1)) / SR;
      s += I.h[k] * Math.sin(phase[k]);
    }
    buf[debut + i] += s * env * vol;
  }
}

// Joue une suite [["G4", durée en temps], ["R", 1] (silence), ["C4+E4+G4", 2] (accord)]
function melodie(buf, t0, tempsParUnite, suite, instr, vol, transpo = 0) {
  let t = t0;
  for (const [nom, d] of suite) {
    const duree = d * tempsParUnite;
    if (nom !== "R") {
      for (const n of nom.split("+")) {
        note(buf, t, duree * 0.92, frequence(n) * Math.pow(2, transpo / 12), instr, vol);
      }
    }
    t += duree;
  }
  return t;
}

function bruit(buf, t0, duree, vol, couleur = 0.5, decroissance = 20) {
  const debut = Math.floor(t0 * SR);
  let y = 0;
  for (let i = 0; i < duree * SR && debut + i < buf.length; i++) {
    const t = i / SR;
    y += couleur * (hasard() * 2 - 1 - y); // filtre passe-bas simple
    buf[debut + i] += y * vol * Math.exp(-decroissance * t);
  }
}

function glissando(buf, t0, duree, f0, f1, vol, decroissance = 6, harmoniques = [1]) {
  const debut = Math.floor(t0 * SR);
  let phase = 0;
  for (let i = 0; i < duree * SR && debut + i < buf.length; i++) {
    const t = i / SR;
    const f = f0 * Math.pow(f1 / f0, t / duree);
    phase += (2 * Math.PI * f) / SR;
    let s = 0;
    harmoniques.forEach((a, k) => (s += a * Math.sin(phase * (k + 1))));
    buf[debut + i] += s * vol * Math.exp(-decroissance * t) * Math.min(1, t / 0.003);
  }
}

function gong(buf, t0, duree, f, vol) {
  [[1, 1], [2.76, 0.6], [5.4, 0.35], [8.9, 0.2], [1.5, 0.4]].forEach(([m, a]) => {
    glissando(buf, t0, duree, f * m, f * m * 0.99, vol * a, 2.2 + m * 0.4);
  });
}

// Batterie
const kick = (b, t, v = 0.7) => glissando(b, t, 0.25, 140, 45, v, 14);
const caisse = (b, t, v = 0.35) => { bruit(b, t, 0.18, v, 0.8, 22); glissando(b, t, 0.1, 220, 180, v * 0.6, 25); };
const charley = (b, t, v = 0.12) => bruit(b, t, 0.05, v, 1, 70);

/* ------------------------------------------------------------------ */
/* Export MP3                                                          */
/* ------------------------------------------------------------------ */
function exporter(nom, buf, volume = 0.9) {
  // normalisation du volume puis conversion en entiers 16 bits
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  const k = max > 0 ? volume / max : 1;
  const pcm = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, buf[i] * k * 32767));
  const enc = new lamejs.Mp3Encoder(1, SR, KBPS);
  const morceaux = [];
  for (let i = 0; i < pcm.length; i += 1152) morceaux.push(Buffer.from(enc.encodeBuffer(pcm.subarray(i, i + 1152))));
  morceaux.push(Buffer.from(enc.flush()));
  const fichier = path.join(DOSSIER, nom + ".mp3");
  fs.writeFileSync(fichier, Buffer.concat(morceaux));
  const ko = fs.statSync(fichier).size / 1024;
  console.log(`${(nom + ".mp3").padEnd(26)} ${(buf.length / SR).toFixed(1).padStart(5)} s ${ko.toFixed(1).padStart(7)} Ko`);
}

/* ------------------------------------------------------------------ */
/* Bruitages                                                           */
/* ------------------------------------------------------------------ */
function bruitages() {
  let b;
  b = tampon(0.15); bruit(b, 0, 0.12, 0.8, 0.6, 35); glissando(b, 0, 0.12, 260, 120, 0.7, 25); exporter("coup_leger", b);
  b = tampon(0.4); bruit(b, 0, 0.3, 0.9, 0.4, 14); glissando(b, 0, 0.35, 150, 40, 1, 9); exporter("coup_lourd", b);
  b = tampon(0.3); [1250, 1870, 2710].forEach((f) => glissando(b, 0, 0.3, f, f, 0.3, 16)); bruit(b, 0, 0.04, 0.4, 1, 60); exporter("garde", b);
  b = tampon(0.2); ["C6", "E6", "G6"].forEach((n, i) => note(b, i * 0.045, 0.06, frequence(n), "cloche", 0.4)); exporter("tir", b);
  b = tampon(0.18); glissando(b, 0, 0.16, 300, 700, 0.6, 10); exporter("saut", b);
  b = tampon(0.3);
  for (let i = 0; i < 0.28 * SR; i++) {
    const t = i / SR;
    b[i] = (hasard() * 2 - 1) * Math.sin((Math.PI * t) / 0.28) * 0.5;
  }
  let y = 0;
  for (let i = 0; i < b.length; i++) { y += 0.15 * (b[i] - y); b[i] = y; }
  exporter("esquive", b);
  b = tampon(0.5); ["C5", "E5", "G5", "C6"].forEach((n, i) => note(b, i * 0.07, 0.12, frequence(n), "cloche", 0.4)); exporter("bonus", b);
  b = tampon(1.6); bruit(b, 0, 1.2, 0.8, 0.9, 3); glissando(b, 0, 1.0, 400, 60, 0.7, 2); gong(b, 0, 1.6, 90, 0.5); exporter("ko", b);
  b = tampon(2.2); gong(b, 0, 2.2, 110, 0.6); bruit(b, 0, 0.3, 0.3, 0.7, 12); exporter("gong", b);
  b = tampon(0.25); note(b, 0, 0.1, 1320, "cloche", 0.5); note(b, 0.06, 0.1, 1760, "cloche", 0.4); exporter("qte_ok", b);
  b = tampon(0.3); note(b, 0, 0.22, 110, "cuivre", 0.5); note(b, 0, 0.22, 116, "cuivre", 0.5); exporter("qte_rate", b);
  b = tampon(0.08); note(b, 0, 0.03, 880, "cloche", 0.5); exporter("menu_deplacer", b, 0.6);
  b = tampon(0.3); note(b, 0, 0.08, 660, "cloche", 0.5); note(b, 0.08, 0.14, 990, "cloche", 0.5); exporter("menu_valider", b);
  b = tampon(1.3); note(b, 0, 1.0, frequence("C3"), "piano", 0.6); exporter("note_piano", b);
  b = tampon(0.7); ["G5", "B5", "D6", "G6", "B6"].forEach((n, i) => note(b, i * 0.06, 0.2, frequence(n), "cloche", 0.35)); exporter("jauge_pleine", b);
  // applaudissements du public (écran de victoire)
  b = tampon(3);
  for (let i = 0; i < 900; i++) {
    const t = hasard() * 2.8;
    const v = 0.25 * Math.min(1, t / 0.4) * Math.min(1, (3 - t) / 1.2);
    bruit(b, t, 0.02, v, 0.9, 150);
  }
  exporter("applaudissements", b, 0.7);
}

/* ------------------------------------------------------------------ */
/* Attaques spéciales (≈ 3,5 s, durée du QTE)                          */
/* ------------------------------------------------------------------ */
function speciales() {
  let b;
  // Maestro : Beethoven, 5e symphonie
  b = tampon(3.9);
  const destin = [["G4", 1], ["G4", 1], ["G4", 1], ["Eb4", 6], ["R", 2], ["F4", 1], ["F4", 1], ["F4", 1], ["D4", 8]];
  melodie(b, 0.05, 0.16, destin, "cordes", 0.35);
  melodie(b, 0.05, 0.16, destin, "cordes", 0.3, -12);
  melodie(b, 0.05, 0.16, destin, "cuivre", 0.12, -24);
  exporter("special_maestro", b);

  // Diva : Wagner, la Chevauchée des Walkyries
  b = tampon(4.0);
  const walkyries = [
    ["F#4", 1], ["B4", 2], ["F#4", 1], ["B4", 1], ["D5", 3], ["B4", 3],
    ["B4", 1], ["D5", 2], ["B4", 1], ["D5", 1], ["F#5", 3], ["D5", 3],
    ["D5", 1], ["F#5", 2], ["D5", 1], ["F#5", 1], ["A5", 3], ["A4", 3],
  ];
  melodie(b, 0.05, 0.11, walkyries, "cuivre", 0.35);
  melodie(b, 0.05, 0.11, walkyries, "cuivre", 0.25, -12);
  for (let t = 0.05; t < 3.7; t += 0.055) note(b, t, 0.05, frequence("B2"), "cordes", 0.12);
  exporter("special_diva", b);

  // Violaine : Vivaldi, le Printemps
  b = tampon(3.6);
  const printemps = [
    ["E5", 1], ["G#5", 1], ["G#5", 1], ["G#5", 1], ["F#5", 0.5], ["E5", 0.5], ["B5", 3],
    ["B5", 0.5], ["A5", 0.5], ["G#5", 1], ["G#5", 1], ["G#5", 1], ["F#5", 0.5], ["E5", 0.5], ["B5", 3],
  ];
  melodie(b, 0.05, 0.2, printemps, "cordes", 0.4);
  melodie(b, 0.05, 0.2, [["R", 1], ["E3+B3+E4", 4], ["R", 3], ["E3+G#3+B3", 4], ["R", 4]], "clavecin", 0.25);
  exporter("special_violaine", b);

  // Major Timbale : Rossini, ouverture de Guillaume Tell
  b = tampon(3.9);
  const galop = [
    ["G4", 1], ["G4", 1], ["G4", 2], ["G4", 1], ["G4", 1], ["G4", 2], ["G4", 1], ["G4", 1], ["C5", 2], ["D5", 2], ["E5", 2],
    ["G4", 1], ["G4", 1], ["G4", 2], ["G4", 1], ["G4", 1], ["G4", 2], ["G4", 1], ["C5", 1], ["E5", 2], ["D5", 2], ["B4", 2],
    ["C5+E5+G5", 4],
  ];
  melodie(b, 0.05, 0.1, galop, "cuivre", 0.35);
  for (let i = 0; i < 18; i++) { caisse(b, 0.05 + i * 0.2, 0.3); kick(b, 0.05 + i * 0.4, 0.5); }
  exporter("special_timbale", b);

  // Fantôme : Bach, Toccata et fugue en ré mineur
  b = tampon(3.9);
  const toccata = [
    ["A5", 0.25], ["G5", 0.25], ["A5", 2.5], ["R", 0.4],
    ["G5", 0.25], ["F5", 0.25], ["E5", 0.25], ["D5", 0.25], ["C#5", 1], ["D5+A4+F4+D4", 3.5],
  ];
  melodie(b, 0.05, 0.3, toccata, "orgue", 0.3);
  melodie(b, 0.05, 0.3, toccata, "orgue", 0.25, -12);
  note(b, 2.2, 1.4, frequence("D2"), "orgue", 0.35);
  exporter("special_fantome", b);
}

/* ------------------------------------------------------------------ */
/* Musiques en boucle                                                  */
/* ------------------------------------------------------------------ */
function musiques() {
  // Menu : Bizet, Habanera de Carmen
  {
    const noire = 0.6;
    const b = tampon(16 * noire); // 8 mesures à 2 temps
    const chant = [
      ["D5", 0.75], ["C#5", 0.25], ["C5", 0.5], ["C5", 0.5],
      ["B4", 0.75], ["Bb4", 0.25], ["A4", 0.5], ["A4", 0.5],
      ["G4", 0.75], ["F4", 0.25], ["E4", 0.5], ["E4", 0.5],
      ["F4", 0.5], ["G4", 0.5], ["A4", 1],
    ];
    melodie(b, 0, noire, chant, "hautbois", 0.3);
    melodie(b, 8 * noire, noire, chant, "cordes", 0.28);
    melodie(b, 8 * noire, noire, chant, "cordes", 0.18, -12);
    const basses = ["D2", "D2", "A1", "D2", "D2", "D2", "A1", "D2"];
    for (let mesure = 0; mesure < 8; mesure++) {
      const t = mesure * 2 * noire;
      const f = basses[mesure];
      note(b, t, 0.3, frequence(f), "pizz", 0.5);
      note(b, t + 0.75 * noire, 0.15, frequence(f), "pizz", 0.35);
      note(b, t + noire, 0.3, frequence(f === "A1" ? "E2" : "A2"), "pizz", 0.45);
      note(b, t + 1.5 * noire, 0.3, frequence(f === "A1" ? "A2" : "D3"), "pizz", 0.4);
      [0, 0.75, 1, 1.5].forEach((d) => charley(b, t + d * noire, 0.1));
    }
    exporter("musique_menu", b, 0.8);
  }

  // Arène Opéra : Grieg, Dans l'antre du roi de la montagne
  {
    const croche = 0.19;
    const theme = [
      ["B3", 1], ["C#4", 1], ["D4", 1], ["E4", 1], ["F#4", 1], ["D4", 1], ["F#4", 2],
      ["F4", 1], ["C#4", 1], ["F4", 2], ["E4", 1], ["C4", 1], ["E4", 2],
      ["B3", 1], ["C#4", 1], ["D4", 1], ["E4", 1], ["F#4", 1], ["D4", 1], ["F#4", 1], ["B4", 1],
      ["A4", 1], ["F#4", 1], ["D4", 1], ["F#4", 1], ["A4", 4],
    ];
    const mesure = 8 * croche;
    const b = tampon(8 * mesure);
    melodie(b, 0, croche, theme, "pizz", 0.45);
    melodie(b, 0, croche, theme, "hautbois", 0.2, -12);
    melodie(b, 4 * mesure, croche, theme, "cordes", 0.3, 12);
    melodie(b, 4 * mesure, croche, theme, "cuivre", 0.22);
    for (let m = 0; m < 8; m++) {
      const t = m * mesure;
      for (let k = 0; k < 4; k++) {
        note(b, t + k * 2 * croche, 0.15, frequence(k % 2 ? "F#1" : "B1"), "pizz", 0.5);
        if (m >= 4 || k % 2 === 0) kick(b, t + k * 2 * croche, 0.55);
        if (k % 2) caisse(b, t + k * 2 * croche, m >= 4 ? 0.35 : 0.2);
        charley(b, t + (k * 2 + 1) * croche, 0.1);
      }
    }
    exporter("musique_opera", b, 0.8);
  }

  // Arène Piano géant : Beethoven, Lettre à Élise (version rythmée)
  {
    const dc = 0.14; // double-croche
    const phrase = [
      ["E5", 1], ["D#5", 1], ["E5", 1], ["D#5", 1], ["E5", 1], ["B4", 1], ["D5", 1], ["C5", 1],
      ["A4", 2], ["R", 1], ["C4", 1], ["E4", 1], ["A4", 1],
      ["B4", 2], ["R", 1], ["E4", 1], ["G#4", 1], ["B4", 1],
      ["C5", 2], ["R", 1], ["E4", 1], ["E5", 1], ["D#5", 1],
      ["E5", 1], ["D#5", 1], ["E5", 1], ["B4", 1], ["D5", 1], ["C5", 1],
      ["A4", 2], ["R", 1], ["C4", 1], ["E4", 1], ["A4", 1],
      ["B4", 2], ["R", 1], ["E4", 1], ["C5", 1], ["B4", 1],
      ["A4", 6],
    ];
    const longueur = phrase.reduce((s, [, d]) => s + d, 0) * dc;
    const b = tampon(2 * longueur);
    // accompagnement main gauche : arpèges calés sur les mesures de 6 double-croches
    const arpeges = { A: ["A2", "E3", "A3"], E: ["E2", "E3", "G#3"] };
    const grille = ["A", "A", "E", "A", "A", "A", "E", "A"];
    for (let passe = 0; passe < 2; passe++) {
      const t0 = passe * longueur;
      melodie(b, t0, dc, phrase, "piano", 0.4);
      if (passe === 1) melodie(b, t0, dc, phrase, "cordes", 0.12, 12);
      grille.forEach((acc, i) => {
        const tm = t0 + (2 + i * 6) * dc;
        arpeges[acc].forEach((n, k) => note(b, tm + k * dc, dc * 2, frequence(n), "piano", 0.25));
      });
      for (let t = t0; t < t0 + longueur - 0.01; t += 3 * dc) {
        kick(b, t, passe ? 0.5 : 0.35);
        charley(b, t + 1.5 * dc, 0.1);
        if (passe && Math.round((t - t0) / (3 * dc)) % 2) caisse(b, t, 0.25);
      }
    }
    exporter("musique_piano", b, 0.8);
  }
}

bruitages();
speciales();
musiques();
