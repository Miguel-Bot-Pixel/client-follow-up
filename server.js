// Client Follow Up — serveur autonome (aucun compte requis pour les agents)
//
// Chaque "desk" (en / fr / it / es) a sa propre base (fichier JSON séparé)
// et son propre code d'accès. Le code est vérifié côté SERVEUR sur chaque
// appel API (pas seulement dans le navigateur) : c'est une vraie barrière,
// pas cosmétique. Ce n'est pas un système d'authentification individuel
// (pas de compte par agent) — c'est un secret partagé par desk, adapté à
// une petite équipe de confiance. Pour une isolation plus forte (comptes
// nominatifs, audit par agent), il faudrait un vrai système d'auth plus tard.

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------
// Desks: code d'accès configurable par variable d'environnement.
// Change ces valeurs par défaut avant tout déploiement réel !
// ---------------------------------------------------------------------
const DESKS = {
  en: { label: "Anglais", flag: "🇬🇧", appName: "Client Follow Up", code: process.env.DESK_EN_CODE || "en-desk-2026" },
  fr: { label: "Français", flag: "🇫🇷", appName: "Suivi Client", code: process.env.DESK_FR_CODE || "fr-desk-2026" },
  it: { label: "Italien", flag: "🇮🇹", appName: "Follow-up Cliente", code: process.env.DESK_IT_CODE || "it-desk-2026" },
  es: { label: "Espagnol", flag: "🇪🇸", appName: "Seguimiento de Cliente", code: process.env.DESK_ES_CODE || "es-desk-2026" },
};

function dataPath(desk) {
  return path.join(DATA_DIR, `clients-${desk}.json`);
}

function readClients(desk) {
  const p = dataPath(desk);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.error("Failed to read", p, e);
    return [];
  }
}

// Very small write queue per desk to avoid concurrent write corruption
// (fine for a small team; not a real transactional DB).
const writeQueues = {};
function writeClients(desk, clients) {
  writeQueues[desk] = (writeQueues[desk] || Promise.resolve()).then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(dataPath(desk), JSON.stringify(clients, null, 2), (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  );
  return writeQueues[desk];
}

function seedIfEmpty(desk) {
  const p = dataPath(desk);
  if (fs.existsSync(p)) return;
  const now = new Date().toISOString();
  const seeds = {
    en: [
      {
        id: "demo1",
        isExample: true,
        name: "James Whitfield",
        email: "james.whitfield@example.com",
        accountNumber: "CIS-2026-04471",
        brand: "cis",
        agent: "Camille",
        package: "premium",
        insurance: true,
        upsell: "in_progress",
        risk: "none",
        attention: false,
        attentionReason: "",
        pending: "none",
        pendingNote: "",
        nextActionDate: now.slice(0, 10),
        nextActionNote: "Relance offre All-Inclusive",
        notes: "Intéressé par l'upgrade depuis l'appel du 3/09.",
        createdAt: now,
        updatedAt: now,
        updatedBy: "Camille",
      },
    ],
    fr: [
      {
        id: "demo1",
        isExample: true,
        name: "Amélie Laurent",
        email: "amelie.laurent@example.com",
        accountNumber: "VAC-2026-01823",
        brand: "vac",
        agent: "Yanis",
        package: "standard",
        insurance: false,
        upsell: "potential",
        risk: "at_risk",
        attention: true,
        attentionReason: "Menace de chargeback si délai IRCC non tenu",
        pending: "legal",
        pendingNote: "Avenant en attente de validation Legal",
        nextActionDate: now.slice(0, 10),
        nextActionNote: "Point avec Legal avant rappel client",
        notes: "Cliente premium, dossier soumis, attend une réponse IRCC depuis 4 mois.",
        createdAt: now,
        updatedAt: now,
        updatedBy: "Yanis",
      },
    ],
    it: [
      {
        id: "demo1",
        isExample: true,
        name: "Giulia Bianchi",
        email: "giulia.bianchi@example.com",
        accountNumber: "CIS-2026-03390",
        brand: "cis",
        agent: "Nora",
        package: "allinclusive",
        insurance: true,
        upsell: "won",
        risk: "none",
        attention: false,
        attentionReason: "",
        pending: "none",
        pendingNote: "",
        nextActionDate: "",
        nextActionNote: "",
        notes: "Assurance souscrite le mois dernier, aucun point bloquant.",
        createdAt: now,
        updatedAt: now,
        updatedBy: "Nora",
      },
    ],
    es: [
      {
        id: "demo1",
        isExample: true,
        name: "Mateo Vidal",
        email: "mateo.vidal@example.com",
        accountNumber: "CVS-2026-00957",
        brand: "cvs",
        agent: "Diego",
        package: "premium",
        insurance: false,
        upsell: "none",
        risk: "critical",
        attention: true,
        attentionReason: "Demande de remboursement intégral, risque chargeback élevé",
        pending: "board",
        pendingNote: "Décision board attendue sur dérogation refund >17%",
        nextActionDate: now.slice(0, 10),
        nextActionNote: "Suivre décision board avant vendredi",
        notes: "Client insatisfait du délai de traitement, escaladé au CS Manager.",
        createdAt: now,
        updatedAt: now,
        updatedBy: "Diego",
      },
    ],
  };
  fs.writeFileSync(p, JSON.stringify(seeds[desk] || [], null, 2));
}
Object.keys(DESKS).forEach(seedIfEmpty);

// ---------------------------------------------------------------------
// Desk auth middleware — checks x-desk-code header against the desk's
// configured passcode. Runs on every /api/:desk/* call.
// ---------------------------------------------------------------------
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function deskAuth(req, res, next) {
  const desk = req.params.desk;
  const config = DESKS[desk];
  if (!config) return res.status(404).json({ error: "unknown_desk" });
  const code = req.get("x-desk-code") || "";
  if (!timingSafeEqual(code, config.code)) {
    return res.status(401).json({ error: "invalid_code" });
  }
  req.deskConfig = config;
  next();
}

// ---------------------------------------------------------------------
// Public: check desk existence + app name (no code needed) — used to
// render the login screen's title before the code is entered.
// ---------------------------------------------------------------------
app.get("/api/:desk/meta", (req, res) => {
  const config = DESKS[req.params.desk];
  if (!config) return res.status(404).json({ error: "unknown_desk" });
  res.json({ label: config.label, flag: config.flag, appName: config.appName });
});

app.post("/api/:desk/auth", (req, res) => {
  const config = DESKS[req.params.desk];
  if (!config) return res.status(404).json({ error: "unknown_desk" });
  const code = (req.body && req.body.code) || "";
  if (!timingSafeEqual(code, config.code)) {
    return res.status(401).json({ error: "invalid_code" });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// CRUD, all behind deskAuth
// ---------------------------------------------------------------------
app.get("/api/:desk/clients", deskAuth, (req, res) => {
  res.json(readClients(req.params.desk));
});

app.post("/api/:desk/clients", deskAuth, async (req, res) => {
  const desk = req.params.desk;
  const clients = readClients(desk);
  const now = new Date().toISOString();
  const record = Object.assign({}, req.body, {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
  clients.push(record);
  try {
    await writeClients(desk, clients);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: "write_failed" });
  }
});

app.patch("/api/:desk/clients/:id", deskAuth, async (req, res) => {
  const desk = req.params.desk;
  const clients = readClients(desk);
  const idx = clients.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });
  clients[idx] = Object.assign({}, clients[idx], req.body, {
    updatedAt: new Date().toISOString(),
  });
  try {
    await writeClients(desk, clients);
    res.json(clients[idx]);
  } catch (e) {
    res.status(500).json({ error: "write_failed" });
  }
});

app.delete("/api/:desk/clients/:id", deskAuth, async (req, res) => {
  const desk = req.params.desk;
  let clients = readClients(desk);
  const before = clients.length;
  clients = clients.filter((c) => c.id !== req.params.id);
  if (clients.length === before) return res.status(404).json({ error: "not_found" });
  try {
    await writeClients(desk, clients);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: "write_failed" });
  }
});

// ---------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.get("/healthz", (req, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Client Follow Up server listening on port ${PORT}`);
  console.log("Desks configured:", Object.keys(DESKS).join(", "));
});
