// Google Sheets storage backend for Client Follow Up.
//
// Each desk (en/fr/it/es) is a tab in ONE Google Sheet. Row 1 = headers
// (COLUMNS below), every row after that = one client record. We read the
// whole tab, do the CRUD operation on the array of objects (same shape the
// app used with local JSON files), then rewrite the whole tab's body. This
// keeps the rest of server.js — and the frontend — completely unchanged.
//
// Auth: a Google Cloud service account (credentials passed via the
// GOOGLE_SERVICE_ACCOUNT_KEY env var, as a single-line JSON string) that has
// been given "Editor" access to the spreadsheet (GOOGLE_SHEET_ID).

const { google } = require("googleapis");

const COLUMNS = [
"id",
"isExample",
"name",
"email",
"accountNumber",
"brand",
"agent",
"package",
"insurance",
"upsell",
"risk",
"attention",
"attentionReason",
"pending",
"pendingNote",
"nextActionDate",
"nextActionNote",
"notes",
"closed",
"closedAt",
"createdAt",
"updatedAt",
"updatedBy",
];

const BOOLEAN_COLUMNS = new Set(["isExample", "insurance", "attention", "closed"]);

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const LAST_COL_LETTER = String.fromCharCode("A".charCodeAt(0) + COLUMNS.length - 1); // 23 cols -> "W"

let sheetsClientPromise = null;
function getSheetsClient() {
if (!sheetsClientPromise) {
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (!raw) {
throw new Error(
"GOOGLE_SERVICE_ACCOUNT_KEY is not set — cannot talk to Google Sheets."
);
}
if (!SHEET_ID) {
throw new Error("GOOGLE_SHEET_ID is not set — cannot talk to Google Sheets.");
}
let creds;
try {
creds = JSON.parse(raw);
} catch (e) {
throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.");
}
const auth = new google.auth.JWT({
email: creds.client_email,
key: creds.private_key,
scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
sheetsClientPromise = auth.authorize().then(() => google.sheets({ version: "v4", auth }));
}
return sheetsClientPromise;
}

function rowToClient(row) {
const obj = {};
COLUMNS.forEach((col, i) => {
let val = row[i];
if (val === undefined) val = "";
if (BOOLEAN_COLUMNS.has(col)) {
obj[col] = val === true || val === "TRUE" || val === "true";
} else {
obj[col] = val;
}
});
return obj;
}

function clientToRow(client) {
return COLUMNS.map((col) => {
const val = client[col];
if (BOOLEAN_COLUMNS.has(col)) return val ? true : false;
if (val === undefined || val === null) return "";
return val;
});
}

async function readClients(desk) {
const sheets = await getSheetsClient();
const range = `${desk}!A2:${LAST_COL_LETTER}`;
const res = await sheets.spreadsheets.values.get({
spreadsheetId: SHEET_ID,
range,
valueRenderOption: "UNFORMATTED_VALUE",
});
const rows = res.data.values || [];
return rows
.filter((row) => row.some((cell) => cell !== "" && cell !== undefined))
.map(rowToClient);
}

// Per-desk write queue so concurrent requests don't race each other while
// rewriting the whole tab body (fine for a small team; not a real
// transactional DB).
const writeQueues = {};
function writeClients(desk, clients) {
writeQueues[desk] = (writeQueues[desk] || Promise.resolve()).then(async () => {
const sheets = await getSheetsClient();
// Clear the whole body first so a shrinking list doesn't leave stale
// rows behind, then write the new body in one call.
await sheets.spreadsheets.values.clear({
spreadsheetId: SHEET_ID,
range: `${desk}!A2:${LAST_COL_LETTER}`,
});
if (clients.length > 0) {
await sheets.spreadsheets.values.update({
spreadsheetId: SHEET_ID,
range: `${desk}!A2`,
valueInputOption: "RAW",
requestBody: { values: clients.map(clientToRow) },
});
}
});
return writeQueues[desk];
}

module.exports = { readClients, writeClients, COLUMNS };
