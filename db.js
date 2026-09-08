const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

const empty = () => ({
  users: [],
  friendRequests: [],
  friendships: [],
  sharedTasks: [],
});

function load() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const data = empty();
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return data;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
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
