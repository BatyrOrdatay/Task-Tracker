const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'data.json');

const empty = () => ({
  users: [],
  friendRequests: [],
  friendships: [],
  sharedTasks: [],
  userStores: {},
});

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
      const data = empty();
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return data;
    }
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!parsed.userStores) parsed.userStores = {};
    if (!parsed.users) parsed.users = [];
    if (!parsed.friendRequests) parsed.friendRequests = [];
    if (!parsed.friendships) parsed.friendships = [];
    if (!parsed.sharedTasks) parsed.sharedTasks = [];
    return parsed;
  } catch {
    return empty();
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function withDb(fn) {
  const data = load();
  const result = fn(data);
  save(data);
  return result;
}

module.exports = { load, save, withDb, DB_PATH };
