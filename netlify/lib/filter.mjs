// Filtre de vulgarités (français + anglais). Un rêve qui en contient part en modération au lieu d'être publié.
// Pour ajouter un mot : mets-le en minuscules, sans accent, dans EXACT (mot entier) ou STEMS (début de mot).

const EXACT = new Set([
  // français
  "putain", "ptn", "pute", "putes", "salope", "salopes", "salopard", "salaud", "salauds", "connard", "connards",
  "connasse", "connasses", "con", "cons", "conne", "connes", "merde", "merdes", "merdique", "chier", "chie",
  "bite", "bites", "couille", "couilles", "chatte", "chattes", "nique", "niquer", "niques", "niqué", "ntm",
  "fdp", "tg", "ta gueule", "pd", "pede", "pedes", "tapette", "tapettes", "gouine", "gouines", "batard", "batards",
  "enfoire", "enfoires", "branleur", "branleurs", "bouffon", "abruti", "abrutis", "debile", "debiles", "pouffiasse",
  "petasse", "garce", "trouduc", "zob", "teub", "bougnoule", "bougnoules", "negre", "negres", "youpin", "youpins",
  "bicot", "bicots", "chinetoque", "chintok", "sodomie", "porno", "pornographie",
  "baiseur", "suceur", "suceuse", "foutre", "nazi", "nazis",
  // anglais
  "fuck", "fucks", "fucked", "fucker", "fucking", "fuk", "shit", "shits", "shitty", "bitch", "bitches", "cunt", "cunts",
  "dick", "dicks", "cock", "cocks", "pussy", "whore", "whores", "slut", "sluts", "asshole", "assholes", "bastard",
  "nigger", "niggers", "nigga", "niggas", "faggot", "faggots", "fag", "retard", "porn", "motherfucker", "wtf", "stfu",
]);
const STEMS = ["encul", "connard", "conass", "niqu", "enfoir", "branl", "fuck", "shit", "bitch", "cunt",
  "bougnoul", "youpin", "pornogr", "salopard", "pouffias", "motherf", "sodomi"];

const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "€": "e" };

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$€]/g, (c) => LEET[c] || c)
    .replace(/(.)\1{2,}/g, "$1$1"); // « fuuuuck » → « fuuck »
}
const squeeze = (w) => w.replace(/(.)\1+/g, "$1");
const STEMS_SQ = STEMS.map(squeeze);

/** Renvoie la liste des mots vulgaires trouvés (vide si le texte est propre). */
export function findProfanity(...texts) {
  const found = new Set();
  for (const t of texts) {
    const norm = normalize(t);
    if (/\bta\s+gueule\b/.test(norm)) found.add("ta gueule");
    // mots écrits avec des points ou des espaces entre les lettres : « p.u.t.e », « f u c k »
    const joined = norm.replace(/\b(\w)[\s.\-_*]+(?=\w\b)/g, "$1");
    for (const src of [norm, joined]) {
      for (const raw of src.split(/[^a-z]+/)) {
        if (!raw) continue;
        const w = squeeze(raw);
        if (EXACT.has(raw) || EXACT.has(w) || STEMS_SQ.some((s) => w.startsWith(s))) found.add(raw);
      }
    }
  }
  return [...found];
}
