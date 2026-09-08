// Client Follow Up — serveur autonome (aucun compte requis pour les agents)
//
// Chaque "desk" (en / fr / it / es) a sa propre base (un onglet dans un
// Google Sheet partagé) et son propre code d'accès. Le code est vérifié
// côté SERVEUR sur chaque appel API (pas seulement dans le navigateur) :
// c'est une vraie barrière, pas cosmétique. Ce n'est pas un système
// d'authentification individuel (pas de compte par agent) — c'est un
// secret partagé par desk, adapté à une petite équipe de confiance. Pour
// une isolation plus forte (comptes nominatifs, audit par agent), il
// faudrait un vrai système d'auth plus tard.
//
// Stockage : Google Sheets (voir sheets.js) — persistant, gratuit, pas de
// carte bancaire requise. Les données survivent aux redéploiements et aux
// redémarrages du serveur.

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { readClients, writeClients } = require("./sheets");

const app = express();
app.use(express.json({ limit: "1mb" }));

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
app.get("/api/:desk/clients", deskAuth, async (req, res) => {
  try {
    res.json(await readClients(req.params.desk));
  } catch (e) {
    console.error("read_failed", e);
    res.status(500).json({ error: "read_failed" });
  }
});

app.post("/api/:desk/clients", deskAuth, async (req, res) => {
  const desk = req.params.desk;
  try {
    const clients = await readClients(desk);
    const now = new Date().toISOString();
    const record = Object.assign({}, req.body, {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
    clients.push(record);
    await writeClients(desk, clients);
    res.status(201).json(record);
  } catch (e) {
    console.error("write_failed", e);
    res.status(500).json({ error: "write_failed" });
  }
});

app.patch("/api/:desk/clients/:id", deskAuth, async (req, res) => {
  const desk = req.params.desk;
  try {
    const clients = await readClients(desk);
    const idx = clients.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "not_found" });
    clients[idx] = Object.assign({}, clients[idx], req.body, {
      updatedAt: new Date().toISOString(),
    });
    await writeClients(desk, clients);
    res.json(clients[idx]);
  } catch (e) {
    console.error("write_failed", e);
    res.status(500).json({ error: "write_failed" });
  }
});

app.delete("/api/:desk/clients/:id", deskAuth, async (req, res) => {
  const desk = req.params.desk;
  try {
    let clients = await readClients(desk);
    const before = clients.length;
    clients = clients.filter((c) => c.id !== req.params.id);
    if (clients.length === before) return res.status(404).json({ error: "not_found" });
    await writeClients(desk, clients);
    res.status(204).end();
  } catch (e) {
    console.error("write_failed", e);
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
