/* Friends + auth client for Task Tracker server */
(function () {
  const TOKEN_KEY = 'tt_auth_token';
  const USER_KEY = 'tt_auth_user';
  const API = '';

  let authUser = null;
  try {
    authUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    authUser = null;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    authUser = user;
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    authUser = null;
  }

  async function api(path, options = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    );
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(API + path, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Ошибка запроса');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else alert(msg);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.renderFriends = async function renderFriends() {
    const root = document.getElementById('friendsRoot');
    if (!root) return;

    if (!getToken()) {
      root.innerHTML = authPanelHtml();
      bindAuthForms();
      return;
    }

    root.innerHTML = `<div class="settings-block"><p class="settings-desc">Загрузка…</p></div>`;

    try {
      const me = await api('/api/me');
      authUser = me.user;
      localStorage.setItem(USER_KEY, JSON.stringify(me.user));

      const [friendsData, sharedData] = await Promise.all([
        api('/api/friends'),
        api('/api/shared-tasks'),
      ]);

      root.innerHTML = friendsPageHtml(me.user, friendsData, sharedData.tasks || []);
      bindFriendsPage();
    } catch (e) {
      if (e.status === 401) {
        clearSession();
        root.innerHTML = authPanelHtml();
        bindAuthForms();
        return;
      }
      root.innerHTML = `<div class="settings-block"><p style="color:var(--red)">${escapeHtml(e.message)}</p>
        <button class="btn btn-ghost" id="btnFriendsRetry">Повторить</button></div>`;
      document.getElementById('btnFriendsRetry')?.addEventListener('click', renderFriends);
    }
  };

  function authPanelHtml() {
    return `
      <div class="settings-block">
        <h3 class="settings-title">🔐 Вход в аккаунт</h3>
        <p class="settings-desc">Чтобы добавлять друзей и общие задачи, войди или зарегистрируйся</p>
        <div class="auth-tabs">
          <button type="button" class="btn btn-ghost auth-tab active" data-auth-tab="login">Вход</button>
          <button type="button" class="btn btn-ghost auth-tab" data-auth-tab="register">Регистрация</button>
        </div>
        <form id="authLoginForm" class="auth-form" style="margin-top:16px;">
          <div class="form-group"><label>Email</label><input type="email" id="loginEmail" required placeholder="you@email.com" autocomplete="email"></div>
          <div class="form-group"><label>Пароль</label><input type="password" id="loginPassword" required minlength="6" autocomplete="current-password"></div>
          <button type="submit" class="btn btn-primary">Войти</button>
        </form>
        <form id="authRegisterForm" class="auth-form" style="margin-top:16px; display:none;">
          <div class="form-group"><label>Имя</label><input type="text" id="regName" placeholder="Как тебя зовут" maxlength="40"></div>
          <div class="form-group"><label>Email</label><input type="email" id="regEmail" required placeholder="you@email.com" autocomplete="email"></div>
          <div class="form-group"><label>Пароль</label><input type="password" id="regPassword" required minlength="6" placeholder="Минимум 6 символов" autocomplete="new-password"></div>
          <button type="submit" class="btn btn-primary">Создать аккаунт</button>
        </form>
      </div>`;
  }

  function friendsPageHtml(user, friendsData, sharedTasks) {
    const friends = friendsData.friends || [];
    const incoming = friendsData.incoming || [];
    const outgoing = friendsData.outgoing || [];

    const friendsList =
      friends.length === 0
        ? '<p class="settings-desc">Пока нет друзей — отправь заявку по email</p>'
        : friends
            .map(
              (f) => `
        <div class="friend-row" data-friend-id="${f.id}">
          <div>
            <div class="friend-name">${escapeHtml(f.name)}</div>
            <div class="friend-email">${escapeHtml(f.email)}</div>
          </div>
          <div class="friend-actions">
            <button class="btn btn-ghost btn-sm" data-action="friend-stats" data-id="${f.id}">Статистика</button>
            <button class="btn btn-ghost btn-sm" data-action="shared-with" data-id="${f.id}" data-name="${escapeHtml(f.name)}">Общая задача</button>
            <button class="btn btn-danger btn-sm" data-action="unfriend" data-id="${f.id}">Удалить</button>
          </div>
        </div>`
            )
            .join('');

    const incomingHtml =
      incoming.length === 0
        ? ''
        : `<div class="settings-block"><h3 class="settings-title">📥 Входящие заявки</h3>
        ${incoming
          .map(
            (r) => `
          <div class="friend-row">
            <div><div class="friend-name">${escapeHtml(r.from?.name || '?')}</div>
            <div class="friend-email">${escapeHtml(r.from?.email || '')}</div></div>
            <div class="friend-actions">
              <button class="btn btn-primary btn-sm" data-action="accept" data-id="${r.id}">Принять</button>
              <button class="btn btn-ghost btn-sm" data-action="reject" data-id="${r.id}">Отклонить</button>
            </div>
          </div>`
          )
          .join('')}</div>`;

    const outgoingHtml =
      outgoing.length === 0
        ? ''
        : `<div class="settings-block"><h3 class="settings-title">📤 Исходящие</h3>
        ${outgoing
          .map(
            (r) =>
              `<div class="friend-row"><div class="friend-email">Ожидает: ${escapeHtml(r.to?.email || '')}</div></div>`
          )
          .join('')}</div>`;

    const sharedHtml =
      sharedTasks.length === 0
        ? '<p class="settings-desc">Общих задач пока нет</p>'
        : sharedTasks
            .map((t) => {
              const members = (t.members || [])
                .map((m) => {
                  const mark = m.doneToday ? '✅' : '⬜';
                  return `<span class="member-chip">${mark} ${escapeHtml(m.user?.name || '?')}</span>`;
                })
                .join('');
              const myDone = t.members?.find((m) => m.user?.id === user.id)?.doneToday;
              return `
          <div class="shared-task-card settings-block">
            <div class="shared-task-title">${escapeHtml(t.name)}</div>
            ${t.description ? `<div class="settings-desc">${escapeHtml(t.description)}</div>` : ''}
            <div class="member-row">${members}</div>
            <button class="btn ${myDone ? 'btn-ghost' : 'btn-primary'} btn-sm" data-action="toggle-shared" data-id="${t.id}">
              ${myDone ? 'Снять мою отметку за сегодня' : 'Отметить меня за сегодня'}
            </button>
          </div>`;
            })
            .join('');

    return `
      <div class="settings-block">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div>
            <h3 class="settings-title">👤 ${escapeHtml(user.name)}</h3>
            <p class="settings-desc" style="margin:0">${escapeHtml(user.email)}</p>
          </div>
          <button class="btn btn-ghost btn-sm" id="btnLogout">Выйти</button>
        </div>
      </div>

      <div class="settings-block">
        <h3 class="settings-title">➕ Добавить друга</h3>
        <p class="settings-desc">Отправь заявку по email (друг должен быть зарегистрирован)</p>
        <form id="formAddFriend" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="flex:1;min-width:200px;margin:0;">
            <label>Email друга</label>
            <input type="email" id="friendEmail" required placeholder="friend@email.com">
          </div>
          <button type="submit" class="btn btn-primary">Отправить заявку</button>
        </form>
      </div>

      ${incomingHtml}
      ${outgoingHtml}

      <div class="settings-block">
        <h3 class="settings-title">👥 Мои друзья</h3>
        ${friendsList}
      </div>

      <div class="settings-block">
        <h3 class="settings-title">🤝 Общие задачи</h3>
        <p class="settings-desc">У каждого своя отметка на день — видно, кто отметился</p>
        ${sharedHtml}
      </div>

      <div id="friendStatsPanel" style="display:none;" class="settings-block"></div>
    `;
  }

  function bindAuthForms() {
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const isLogin = tab.dataset.authTab === 'login';
        document.getElementById('authLoginForm').style.display = isLogin ? 'block' : 'none';
        document.getElementById('authRegisterForm').style.display = isLogin ? 'none' : 'block';
      });
    });

    document.getElementById('authLoginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/api/login', {
          method: 'POST',
          body: {
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value,
          },
        });
        setSession(data.token, data.user);
        toast('Вход выполнен');
        renderFriends();
      } catch (err) {
        toast(err.message);
      }
    });

    document.getElementById('authRegisterForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/api/register', {
          method: 'POST',
          body: {
            name: document.getElementById('regName').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value,
          },
        });
        setSession(data.token, data.user);
        toast('Аккаунт создан');
        renderFriends();
      } catch (err) {
        toast(err.message);
      }
    });
  }

  function bindFriendsPage() {
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      clearSession();
      toast('Вы вышли');
      renderFriends();
    });

    document.getElementById('formAddFriend')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/friends/request', {
          method: 'POST',
          body: { email: document.getElementById('friendEmail').value },
        });
        toast('Заявка отправлена');
        renderFriends();
      } catch (err) {
        toast(err.message);
      }
    });

    document.getElementById('friendsRoot')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      try {
        if (action === 'accept') {
          await api('/api/friends/respond', { method: 'POST', body: { requestId: id, accept: true } });
          toast('Заявка принята');
          renderFriends();
        } else if (action === 'reject') {
          await api('/api/friends/respond', { method: 'POST', body: { requestId: id, accept: false } });
          toast('Заявка отклонена');
          renderFriends();
        } else if (action === 'unfriend') {
          if (!confirm('Удалить из друзей?')) return;
          await api('/api/friends/' + id, { method: 'DELETE' });
          toast('Удалено');
          renderFriends();
        } else if (action === 'toggle-shared') {
          await api('/api/shared-tasks/' + id + '/toggle', { method: 'POST', body: {} });
          toast('Отметка обновлена');
          renderFriends();
        } else if (action === 'shared-with') {
          const name = prompt('Название общей задачи:', 'Общая привычка');
          if (!name || !name.trim()) return;
          await api('/api/shared-tasks', {
            method: 'POST',
            body: { name: name.trim(), friendId: id },
          });
          toast('Общая задача создана');
          renderFriends();
        } else if (action === 'friend-stats') {
          const stats = await api('/api/friends/' + id + '/stats');
          const panel = document.getElementById('friendStatsPanel');
          if (!panel) return;
          panel.style.display = 'block';
          panel.innerHTML = `
            <h3 class="settings-title">📊 ${escapeHtml(stats.friend.name)}</h3>
            <p class="settings-desc">Общих задач: ${stats.sharedCount}</p>
            ${(stats.tasks || [])
              .map(
                (t) => `
              <div class="friend-row">
                <div>
                  <div class="friend-name">${escapeHtml(t.name)}</div>
                  <div class="friend-email">Сегодня: ты ${t.iDoneToday ? '✅' : '⬜'} · друг ${t.friendDoneToday ? '✅' : '⬜'}</div>
                  <div class="friend-email">Всего отметок: ты ${t.myTotal} · друг ${t.friendTotal}</div>
                </div>
              </div>`
              )
              .join('') || '<p class="settings-desc">Нет общих задач</p>'}`;
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (err) {
        toast(err.message);
      }
    });
  }

  // styles
  const style = document.createElement('style');
  style.textContent = `
    .auth-tabs { display:flex; gap:8px; }
    .auth-tab.active { border-color: var(--accent); color: var(--text); }
    .friend-row {
      display:flex; justify-content:space-between; align-items:center; gap:12px;
      flex-wrap:wrap; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.06);
    }
    .friend-row:last-child { border-bottom:none; }
    .friend-name { font-weight:600; font-size:14px; }
    .friend-email { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .friend-actions { display:flex; gap:6px; flex-wrap:wrap; }
    .btn-sm { font-size:12px; padding:7px 12px; }
    .member-row { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 14px; }
    .member-chip {
      font-size:12px; padding:4px 10px; border-radius:8px;
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
    }
    .shared-task-title { font-weight:600; font-size:15px; margin-bottom:4px; }
  `;
  document.head.appendChild(style);
})();
