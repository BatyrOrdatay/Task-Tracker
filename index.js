const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { load, save, withDb } = require('./db');

const PORT = process.env.PORT || 3847;
const JWT_SECRET = process.env.JWT_SECRET || 'task-tracker-dev-secret-change-me';
// Static files live in the repository root so they can be uploaded to GitHub
// without creating a public/ directory. Keep this list explicit: the server
// must never expose source files or data.json.
const STATIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/friends.js', 'friends.js'],
]);

function uuid() { return crypto.randomUUID(); }

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { salt: s, hash };
}

function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
  } catch { return false; }
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(userId) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const payload = b64url(JSON.stringify({ sub: userId, exp }));
  const data = header + '.' + payload;
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return data + '.' + sig;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const data = header + '.' + payload;
  const expected = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  if (sig !== expected) return null;
  try {
    const pad = payload.replace(/-/g, '+').replace(/_/g, '/');
    const body = JSON.parse(Buffer.from(pad, 'base64').toString());
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch { return null; }
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function areFriends(data, a, b) {
  return data.friendships.some(f => (f.userA === a && f.userB === b) || (f.userA === b && f.userB === a));
}

function friendIds(data, userId) {
  return data.friendships.filter(f => f.userA === userId || f.userB === userId).map(f => f.userA === userId ? f.userB : f.userA);
}

function enrichSharedTask(data, t, viewerId) {
  const members = [t.ownerId, ...t.memberIds].filter((id, i, arr) => arr.indexOf(id) === i).map(id => {
    const u = data.users.find(x => x.id === id);
    const completions = (t.completions && t.completions[id]) || {};
    return { user: u ? publicUser(u) : { id, name: '?', email: '' }, completions, doneToday: !!completions[todayStr()] };
  });
  return {
    id: t.id, name: t.name, description: t.description || '', category: t.category || '',
    color: t.color || '#1e3a5f', titleColor: t.titleColor || '#f1f5f9', image: t.image || null, ownerId: t.ownerId, created: t.created,
    members, myCompletions: (t.completions && t.completions[viewerId]) || {}
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
  });
  res.end(body);
}

function getUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload) return null;
  const data = load();
  return data.users.find(u => u.id === payload.sub) || null;
}

function mime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[ext] || 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  const filename = STATIC_FILES.get(pathname);
  if (!filename) { res.writeHead(404); return res.end('Not found'); }
  const filePath = path.join(__dirname, filename);
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime(filePath) });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
    return res.end();
  }
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true, time: new Date().toISOString() });

    if (req.method === 'POST' && p === '/api/register') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim() || email.split('@')[0];
      if (!email.includes('@')) return send(res, 400, { error: 'Укажите корректный email' });
      if (password.length < 6) return send(res, 400, { error: 'Пароль минимум 6 символов' });
      let user;
      try {
        user = withDb(data => {
          if (data.users.some(u => u.email === email)) throw new Error('EMAIL_TAKEN');
          const { salt, hash } = hashPassword(password);
          const u = { id: uuid(), email, name, salt, passwordHash: hash, createdAt: new Date().toISOString() };
          data.users.push(u);
          return u;
        });
      } catch (e) {
        if (e.message === 'EMAIL_TAKEN') return send(res, 409, { error: 'Email уже зарегистрирован' });
        throw e;
      }
      return send(res, 200, { token: signToken(user.id), user: publicUser(user) });
    }

    if (req.method === 'POST' && p === '/api/login') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const data = load();
      const user = data.users.find(u => u.email === email);
      if (!user || !verifyPassword(password, user.salt, user.passwordHash)) return send(res, 401, { error: 'Неверный email или пароль' });
      return send(res, 200, { token: signToken(user.id), user: publicUser(user) });
    }

    if (req.method === 'GET' && p === '/api/me') {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      return send(res, 200, { user: publicUser(user) });
    }

    if (req.method === 'GET' && p === '/api/friends') {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const data = load();
      const ids = friendIds(data, user.id);
      const friends = data.users.filter(u => ids.includes(u.id)).map(publicUser);
      const incoming = data.friendRequests.filter(r => r.toId === user.id && r.status === 'pending').map(r => {
        const from = data.users.find(u => u.id === r.fromId);
        return { id: r.id, from: from ? publicUser(from) : null, createdAt: r.createdAt };
      });
      const outgoing = data.friendRequests.filter(r => r.fromId === user.id && r.status === 'pending').map(r => {
        const to = data.users.find(u => u.id === r.toId);
        return { id: r.id, to: to ? publicUser(to) : null, createdAt: r.createdAt };
      });
      return send(res, 200, { friends, incoming, outgoing });
    }

    if (req.method === 'POST' && p === '/api/friends/request') {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return send(res, 400, { error: 'Укажите email друга' });
      try {
        const result = withDb(data => {
          const target = data.users.find(u => u.email === email);
          if (!target) throw new Error('NOT_FOUND');
          if (target.id === user.id) throw new Error('SELF');
          if (areFriends(data, user.id, target.id)) throw new Error('ALREADY');
          const exists = data.friendRequests.find(r => r.status === 'pending' && ((r.fromId === user.id && r.toId === target.id) || (r.fromId === target.id && r.toId === user.id)));
          if (exists) throw new Error('PENDING');
          const reqRow = { id: uuid(), fromId: user.id, toId: target.id, status: 'pending', createdAt: new Date().toISOString() };
          data.friendRequests.push(reqRow);
          return { request: reqRow, to: publicUser(target) };
        });
        return send(res, 200, result);
      } catch (e) {
        const map = { NOT_FOUND: [404, 'Пользователь с таким email не найден'], SELF: [400, 'Нельзя добавить самого себя'], ALREADY: [400, 'Вы уже друзья'], PENDING: [400, 'Заявка уже отправлена'] };
        const m = map[e.message];
        if (m) return send(res, m[0], { error: m[1] });
        throw e;
      }
    }

    if (req.method === 'POST' && p === '/api/friends/respond') {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const body = await readBody(req);
      try {
        withDb(data => {
          const r = data.friendRequests.find(x => x.id === body.requestId && x.toId === user.id && x.status === 'pending');
          if (!r) throw new Error('NOT_FOUND');
          r.status = body.accept ? 'accepted' : 'rejected';
          r.respondedAt = new Date().toISOString();
          if (body.accept) data.friendships.push({ id: uuid(), userA: r.fromId, userB: r.toId, createdAt: new Date().toISOString() });
        });
        return send(res, 200, { ok: true });
      } catch (e) {
        if (e.message === 'NOT_FOUND') return send(res, 404, { error: 'Заявка не найдена' });
        throw e;
      }
    }

    if (req.method === 'DELETE' && p.startsWith('/api/friends/') && !p.includes('/stats')) {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const friendId = p.slice('/api/friends/'.length);
      withDb(data => {
        data.friendships = data.friendships.filter(f => !((f.userA === user.id && f.userB === friendId) || (f.userA === friendId && f.userB === user.id)));
      });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && /^\/api\/friends\/[^/]+\/stats$/.test(p)) {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const friendId = p.split('/')[3];
      const data = load();
      if (!areFriends(data, user.id, friendId)) return send(res, 403, { error: 'Только для друзей' });
      const friend = data.users.find(u => u.id === friendId);
      if (!friend) return send(res, 404, { error: 'Не найден' });
      const shared = data.sharedTasks.filter(t => !t.archived && (t.ownerId === user.id || t.memberIds.includes(user.id)) && (t.ownerId === friendId || t.memberIds.includes(friendId)));
      const today = todayStr();
      const tasks = shared.map(t => {
        const mine = (t.completions && t.completions[user.id]) || {};
        const theirs = (t.completions && t.completions[friendId]) || {};
        return { id: t.id, name: t.name, iDoneToday: !!mine[today], friendDoneToday: !!theirs[today], myTotal: Object.keys(mine).filter(k => mine[k]).length, friendTotal: Object.keys(theirs).filter(k => theirs[k]).length };
      });
      return send(res, 200, { friend: publicUser(friend), sharedCount: shared.length, tasks });
    }

    if (req.method === 'GET' && p === '/api/shared-tasks') {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const data = load();
      const list = data.sharedTasks.filter(t => !t.archived && (t.ownerId === user.id || t.memberIds.includes(user.id))).map(t => enrichSharedTask(data, t, user.id));
      return send(res, 200, { tasks: list });
    }

    if (req.method === 'POST' && p === '/api/shared-tasks') {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const friendId = String(body.friendId || '');
      if (!name) return send(res, 400, { error: 'Укажите название' });
      if (!friendId) return send(res, 400, { error: 'Выберите друга' });
      try {
        const task = withDb(data => {
          if (!areFriends(data, user.id, friendId)) throw new Error('NOT_FRIEND');
          const t = { id: uuid(), name, description: String(body.description || '').trim(), category: String(body.category || '').trim(), color: body.color || '#1e3a5f', titleColor: body.titleColor || '#f1f5f9', image: body.image || null, ownerId: user.id, memberIds: [friendId], completions: {}, created: todayStr(), archived: false };
          data.sharedTasks.push(t);
          return t;
        });
        return send(res, 200, { task: enrichSharedTask(load(), task, user.id) });
      } catch (e) {
        if (e.message === 'NOT_FRIEND') return send(res, 400, { error: 'Можно только с другом' });
        throw e;
      }
    }

    if (req.method === 'POST' && /^\/api\/shared-tasks\/[^/]+\/toggle$/.test(p)) {
      const user = getUser(req);
      if (!user) return send(res, 401, { error: 'Нужен вход' });
      const taskId = p.split('/')[3];
      const body = await readBody(req);
      const date = String(body.date || todayStr());
      try {
        const result = withDb(data => {
          const t = data.sharedTasks.find(x => x.id === taskId);
          if (!t) throw new Error('NOT_FOUND');
          if (!(t.ownerId === user.id || t.memberIds.includes(user.id))) throw new Error('FORBIDDEN');
          if (!t.completions) t.completions = {};
          if (!t.completions[user.id]) t.completions[user.id] = {};
          const map = t.completions[user.id];
          if (map[date]) delete map[date]; else map[date] = true;
          return t;
        });
        return send(res, 200, { task: enrichSharedTask(load(), result, user.id) });
      } catch (e) {
        if (e.message === 'NOT_FOUND') return send(res, 404, { error: 'Задача не найдена' });
        if (e.message === 'FORBIDDEN') return send(res, 403, { error: 'Нет доступа' });
        throw e;
      }
    }

    if (req.method === 'GET' && !p.startsWith('/api')) return serveStatic(req, res, p);
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Ошибка сервера' });
  }
});

server.listen(PORT, () => console.log('Task Tracker server: http://localhost:' + PORT));
