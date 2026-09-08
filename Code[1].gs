/**
 * Client Follow Up — version Google Apps Script (sans compte Claude, sans
 * installation locale). Hébergé entièrement chez Google : un lien à ouvrir,
 * rien à installer.
 *
 * Cloisonnement par desk (EN/FR/IT/ES) : chaque desk a son propre code
 * d'accès et son propre fichier de données dans Drive (pas de Google Sheet
 * visible par les agents — juste des fichiers JSON internes que ce script
 * gère tout seul). Le code est vérifié côté serveur (dans ce fichier),
 * jamais seulement côté navigateur.
 *
 * ⚠️ AVANT DE PARTAGER LE LIEN AUX AGENTS : change les 4 codes ci-dessous
 * pour de vrais secrets (ne garde pas "en-desk-2026" etc.)
 */

var DESKS = {
  en: { label: "Anglais",  flag: "🇬🇧", appName: "Client Follow Up",      code: "en-desk-2026" },
  fr: { label: "Français", flag: "🇫🇷", appName: "Suivi Client",          code: "fr-desk-2026" },
  it: { label: "Italien",  flag: "🇮🇹", appName: "Follow-up Cliente",     code: "it-desk-2026" },
  es: { label: "Espagnol", flag: "🇪🇸", appName: "Seguimiento de Cliente", code: "es-desk-2026" }
};

var DATA_FOLDER_NAME = "Client Follow Up — données (ne pas modifier à la main)";

// ---------------------------------------------------------------------
// Page web
// ---------------------------------------------------------------------
function doGet(e) {
  var desk = ((e && e.parameter && e.parameter.desk) || "en").toLowerCase();
  if (!DESKS[desk]) desk = "en";
  var tpl = HtmlService.createTemplateFromFile("Index");
  tpl.desk = desk;
  return tpl.evaluate()
    .setTitle("Client Follow Up")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------------------------------------------------------------------
// Stockage (Drive, un fichier JSON par desk — pas un Google Sheet)
// ---------------------------------------------------------------------
function getDataFolder_() {
  var it = DriveApp.getFoldersByName(DATA_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(DATA_FOLDER_NAME);
}

function getDeskFile_(desk) {
  var folder = getDataFolder_();
  var fname = "clients-" + desk + ".json";
  var it = folder.getFilesByName(fname);
  if (it.hasNext()) return it.next();
  return folder.createFile(fname, JSON.stringify(seedFor_(desk)), MimeType.PLAIN_TEXT);
}

function readClients_(desk) {
  var file = getDeskFile_(desk);
  var raw = file.getBlob().getDataAsString();
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function writeClients_(desk, list) {
  var file = getDeskFile_(desk);
  file.setContent(JSON.stringify(list));
}

function seedFor_(desk) {
  var now = new Date().toISOString();
  var seeds = {
    en: [{
      id: "demo1", isExample: true,
      name: "James Whitfield", email: "james.whitfield@example.com", accountNumber: "CIS-2026-04471",
      brand: "cis", agent: "Camille", package: "premium", insurance: true,
      upsell: "in_progress", risk: "none", attention: false, attentionReason: "",
      pending: "none", pendingNote: "",
      nextActionDate: now.slice(0, 10), nextActionNote: "Relance offre All-Inclusive",
      notes: "Intéressé par l'upgrade depuis l'appel du 3/09.",
      createdAt: now, updatedAt: now, updatedBy: "Camille"
    }],
    fr: [{
      id: "demo1", isExample: true,
      name: "Amélie Laurent", email: "amelie.laurent@example.com", accountNumber: "VAC-2026-01823",
      brand: "vac", agent: "Yanis", package: "standard", insurance: false,
      upsell: "potential", risk: "at_risk", attention: true,
      attentionReason: "Menace de chargeback si délai IRCC non tenu",
      pending: "legal", pendingNote: "Avenant en attente de validation Legal",
      nextActionDate: now.slice(0, 10), nextActionNote: "Point avec Legal avant rappel client",
      notes: "Cliente premium, dossier soumis, attend une réponse IRCC depuis 4 mois.",
      createdAt: now, updatedAt: now, updatedBy: "Yanis"
    }],
    it: [{
      id: "demo1", isExample: true,
      name: "Giulia Bianchi", email: "giulia.bianchi@example.com", accountNumber: "CIS-2026-03390",
      brand: "cis", agent: "Nora", package: "allinclusive", insurance: true,
      upsell: "won", risk: "none", attention: false, attentionReason: "",
      pending: "none", pendingNote: "",
      nextActionDate: "", nextActionNote: "",
      notes: "Assurance souscrite le mois dernier, aucun point bloquant.",
      createdAt: now, updatedAt: now, updatedBy: "Nora"
    }],
    es: [{
      id: "demo1", isExample: true,
      name: "Mateo Vidal", email: "mateo.vidal@example.com", accountNumber: "CVS-2026-00957",
      brand: "cvs", agent: "Diego", package: "premium", insurance: false,
      upsell: "none", risk: "critical", attention: true,
      attentionReason: "Demande de remboursement intégral, risque chargeback élevé",
      pending: "board", pendingNote: "Décision board attendue sur dérogation refund >17%",
      nextActionDate: now.slice(0, 10), nextActionNote: "Suivre décision board avant vendredi",
      notes: "Client insatisfait du délai de traitement, escaladé au CS Manager.",
      createdAt: now, updatedAt: now, updatedBy: "Diego"
    }]
  };
  return seeds[desk] || [];
}

// ---------------------------------------------------------------------
// Auth — code partagé par desk, vérifié côté serveur à chaque appel
// ---------------------------------------------------------------------
function checkCode_(desk, code) {
  var conf = DESKS[desk];
  return !!conf && typeof code === "string" && code.length > 0 && code === conf.code;
}

function ok_(data) { return { ok: true, data: data }; }
function err_(message) { return { ok: false, error: message }; }

// ---------------------------------------------------------------------
// API appelée depuis la page via google.script.run
// ---------------------------------------------------------------------
function getDeskMeta(desk) {
  var conf = DESKS[desk];
  if (!conf) return err_("unknown_desk");
  return ok_({ label: conf.label, flag: conf.flag, appName: conf.appName });
}

function authDesk(desk, code) {
  if (!DESKS[desk]) return err_("unknown_desk");
  if (!checkCode_(desk, code)) return err_("invalid_code");
  return ok_(true);
}

function listClients(desk, code) {
  if (!checkCode_(desk, code)) return err_("invalid_code");
  return ok_(readClients_(desk));
}

function createClient(desk, code, data) {
  if (!checkCode_(desk, code)) return err_("invalid_code");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var list = readClients_(desk);
    var now = new Date().toISOString();
    var record = Object.assign({}, data, {
      id: Utilities.getUuid(),
      createdAt: now,
      updatedAt: now
    });
    list.push(record);
    writeClients_(desk, list);
    return ok_(record);
  } finally {
    lock.releaseLock();
  }
}

function updateClient(desk, code, id, patch) {
  if (!checkCode_(desk, code)) return err_("invalid_code");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var list = readClients_(desk);
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return err_("not_found");
    list[idx] = Object.assign({}, list[idx], patch, { updatedAt: new Date().toISOString() });
    writeClients_(desk, list);
    return ok_(list[idx]);
  } finally {
    lock.releaseLock();
  }
}

function deleteClient(desk, code, id) {
  if (!checkCode_(desk, code)) return err_("invalid_code");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var list = readClients_(desk);
    var next = list.filter(function (c) { return c.id !== id; });
    if (next.length === list.length) return err_("not_found");
    writeClients_(desk, next);
    return ok_(true);
  } finally {
    lock.releaseLock();
  }
}
