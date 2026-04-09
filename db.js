const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(DATA_DIR, 'data.json');

let _cache = { users: {} };

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

async function initDb() {
  ensureDataDir();

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(_cache, null, 2), 'utf8');
    console.log(`[db] Created new data file at ${DATA_FILE}`);
    return;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8').trim();
    const parsed = raw ? JSON.parse(raw) : { users: {} };
    _cache = parsed && parsed.users ? parsed : { users: {} };
    console.log(`[db] Loaded ${Object.keys(_cache.users).length} users from ${DATA_FILE}`);
  } catch (e) {
    console.warn(`[db] Failed to read ${DATA_FILE}: ${e.message}`);
    const broken = `${DATA_FILE}.broken-${Date.now()}`;
    try {
      fs.renameSync(DATA_FILE, broken);
      console.warn(`[db] Broken data file moved to ${broken}`);
    } catch {}
    _cache = { users: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(_cache, null, 2), 'utf8');
  }
}

function loadData() {
  return _cache;
}

function saveData(data) {
  ensureDataDir();
  _cache = data;
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

function ensureUser(chatId, info = {}) {
  const data = loadData();
  const id = String(chatId);
  if (!data.users[id]) {
    data.users[id] = {
      chatId: id,
      firstName: info.firstName || '',
      username: info.username || '',
      state: null,
      draftTracking: {},
      trackings: [],
      lang: info.lang || 'tr'
    };
    saveData(data);
  }
  return data.users[id];
}

function getUser(chatId) {
  return loadData().users[String(chatId)] || null;
}

function updateUser(chatId, fn) {
  const data = loadData();
  const id = String(chatId);
  if (!data.users[id]) return null;
  data.users[id] = fn(data.users[id]);
  saveData(data);
  return data.users[id];
}

function getAllUsers() {
  return Object.values(loadData().users || {});
}

module.exports = { initDb, ensureUser, getUser, updateUser, getAllUsers, DATA_FILE };
