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

  function sharedTaskCardHtml(task, user) {
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const todayKey = `${monthKey}-${String(today.getDate()).padStart(2, '0')}`;
    const members = task.members || [];
    const memberHtml = members.map((member) => {
      const marks = member.completions || {};
      const monthMarks = Object.keys(marks).filter((key) => key.startsWith(monthKey) && marks[key]).length;
      const status = member.doneToday ? 'Выполнил сегодня' : 'Не отметил сегодня';
      return `<div class="shared-member-progress ${member.doneToday ? 'done' : 'missed'}">
        <div class="shared-member-name"><span class="shared-status-dot"></span>${escapeHtml(member.user?.name || '?')}</div>
        <div class="shared-member-meta">${status} · ${monthMarks} отметок за месяц</div>
      </div>`;
    }).join('');
    const myDone = members.find((member) => member.user?.id === user.id)?.doneToday;
    const color = task.color || '#1e3a5f';
    return `<article class="shared-task-visual-card" style="--shared-accent:${escapeHtml(color)}">
      <div class="shared-card-banner"></div>
      <div class="shared-card-body">
        ${task.category ? `<span class="card-badge">${escapeHtml(task.category)}</span>` : ''}
        <h4>${escapeHtml(task.name)}</h4>
        ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}
        <div class="shared-members-progress">${memberHtml}</div>
        <button class="btn ${myDone ? 'btn-ghost' : 'btn-primary'} btn-sm" data-action="toggle-shared" data-id="${task.id}">
          ${myDone ? 'Отменить мою отметку' : 'Отметить выполнение'}
        </button>
        <div class="shared-task-actions">
          <button type="button" class="shared-action-btn mark ${myDone ? 'is-active' : ''}" data-action="mark-shared" data-id="${task.id}" title="Отметить выполнение">✓</button>
          <button type="button" class="shared-action-btn unmark ${myDone ? '' : 'is-active'}" data-action="unmark-shared" data-id="${task.id}" title="Отменить отметку">×</button>
        </div>
      </div>
    </article>`;
  }

  function openSharedTaskModalV2(friendId, friendName) {
    const colors = ['#1e3a5f','#0f2747','#263238','#1e1e1e','#4a2c2a','#3d2115','#164b36','#0b362b','#0d4b50','#1e293b','#292060','#3b1488','#500c0c','#6b1023','#35203b','#30361b'];
    const titleColors = ['#f1f5f9','#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#fb7185','#2dd4bf','#fb923c','#38bdf8','#a3e635','#c084fc','#fdecc8','#f59e0b','#d24b5a','#ef4444','#6ee7b7','#10b981','#06b6d4','#818cf8','#cbd5e1'];
    let color = colors[0], titleColor = titleColors[0], image = '';
    const options = (items, selected, kind) => items.map((value) => `<button type="button" class="color-option ${value === selected ? 'selected' : ''}" data-${kind}="${value}" style="background:${value}"></button>`).join('');
    document.getElementById('sharedTaskModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="sharedTaskModal"><div class="modal" role="dialog" aria-modal="true"><h2>Новая общая задача</h2><div class="form-group"><label>Фото задачи</label><div class="avatar-upload"><div class="avatar-preview" id="sharedAvatarPreview">?</div><div class="avatar-actions"><button type="button" class="btn btn-ghost" id="sharedUploadPhoto">Загрузить фото</button><input type="file" id="sharedPhotoInput" accept="image/*" hidden></div></div></div><form id="sharedTaskForm"><div class="form-group"><label>Название задачи</label><input id="sharedTaskName" maxlength="120" required placeholder="Например: Утренняя зарядка"></div><div class="form-group"><label>Тема</label><input id="sharedTaskCategory" maxlength="40" placeholder="Например: Дом, Работа, Спорт"></div><div class="form-group"><label>Описание (необязательно)</label><textarea id="sharedTaskDescription" rows="2" maxlength="400" placeholder="Краткое описание или заметка"></textarea></div><div class="form-group"><label>Цвет карточки</label><div class="color-grid" id="sharedColorGrid">${options(colors,color,'color')}</div></div><div class="form-group"><label>Цвет названия</label><div class="color-grid" id="sharedTitleColorGrid">${options(titleColors,titleColor,'title-color')}</div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" id="cancelSharedTask">Отмена</button><button type="submit" class="btn btn-primary">Сохранить</button></div></form></div></div>`);
    const modal = document.getElementById('sharedTaskModal'), close = () => modal.remove();
    modal.querySelector('#cancelSharedTask').onclick = close;
    modal.onclick = (event) => { if (event.target === modal) close(); };
    modal.querySelector('#sharedColorGrid').onclick = (event) => { const el = event.target.closest('[data-color]'); if (!el) return; color = el.dataset.color; modal.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('selected', x === el)); };
    modal.querySelector('#sharedTitleColorGrid').onclick = (event) => { const el = event.target.closest('[data-title-color]'); if (!el) return; titleColor = el.dataset.titleColor; modal.querySelectorAll('[data-title-color]').forEach(x => x.classList.toggle('selected', x === el)); };
    modal.querySelector('#sharedUploadPhoto').onclick = () => modal.querySelector('#sharedPhotoInput').click();
    modal.querySelector('#sharedPhotoInput').onchange = (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { image = reader.result; modal.querySelector('#sharedAvatarPreview').innerHTML = `<img src="${image}" alt="">`; }; reader.readAsDataURL(file); };
    modal.querySelector('#sharedTaskForm').onsubmit = async (event) => { event.preventDefault(); try { await api('/api/shared-tasks', { method:'POST', body:{ friendId, name:modal.querySelector('#sharedTaskName').value.trim(), category:modal.querySelector('#sharedTaskCategory').value.trim(), description:modal.querySelector('#sharedTaskDescription').value.trim(), color, titleColor, image } }); close(); toast('Общая задача создана'); renderFriends(); } catch (error) { toast(error.message); } };
    modal.querySelector('#sharedTaskName').focus();
  }

  function openSharedTaskModal(friendId, friendName) {
    document.getElementById('sharedTaskModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay open" id="sharedTaskModal">
        <div class="modal shared-task-modal" role="dialog" aria-modal="true" aria-labelledby="sharedTaskModalTitle">
          <h2 id="sharedTaskModalTitle">Общая задача с ${escapeHtml(friendName)}</h2>
          <p class="settings-desc">Каждый отмечает выполнение отдельно — прогресс виден вам обоим.</p>
          <form id="sharedTaskForm">
            <div class="form-group"><label>Название задачи</label><input id="sharedTaskName" maxlength="120" required placeholder="Например: Утренняя зарядка"></div>
            <div class="form-group"><label>Категория</label><input id="sharedTaskCategory" maxlength="40" placeholder="Например: Спорт, Учёба"></div>
            <div class="form-group"><label>Описание</label><textarea id="sharedTaskDescription" rows="3" maxlength="400" placeholder="Коротко опишите общую цель"></textarea></div>
            <div class="form-group"><label>Цвет карточки</label><input id="sharedTaskColor" type="color" value="#1e3a5f"></div>
            <div class="modal-actions"><button type="button" class="btn btn-ghost" id="cancelSharedTask">Отмена</button><button type="submit" class="btn btn-primary">Создать общую задачу</button></div>
          </form>
        </div>
      </div>`);
    const close = () => document.getElementById('sharedTaskModal')?.remove();
    document.getElementById('cancelSharedTask').addEventListener('click', close);
    document.getElementById('sharedTaskModal').addEventListener('click', (event) => { if (event.target.id === 'sharedTaskModal') close(); });
    document.getElementById('sharedTaskForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await api('/api/shared-tasks', { method: 'POST', body: {
          friendId,
          name: document.getElementById('sharedTaskName').value.trim(),
          category: document.getElementById('sharedTaskCategory').value.trim(),
          description: document.getElementById('sharedTaskDescription').value.trim(),
          color: document.getElementById('sharedTaskColor').value,
        }});
        close();
        toast('Общая задача создана');
        renderFriends();
      } catch (error) { toast(error.message); }
    });
    document.getElementById('sharedTaskName').focus();
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

    const sharedCardsHtml = sharedTasks.length
      ? `<div class="shared-tasks-grid">${sharedTasks.map((task) => sharedTaskCardHtml(task, user)).join('')}</div>`
      : '<p class="settings-desc">Общих задач пока нет</p>';

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
        ${sharedCardsHtml}
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
    document.getElementById('friendsRoot')?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || !['shared-with', 'friend-stats'].includes(button.dataset.action)) return;
      event.stopImmediatePropagation();
      if (button.dataset.action === 'shared-with') {
        openSharedTaskModalV2(button.dataset.id, button.dataset.name || 'другом');
        return;
      }
      try {
        const stats = await api('/api/friends/' + button.dataset.id + '/stats');
        switchView('stats');
        renderStats();
        const statsRoot = document.getElementById('statsRoot');
        const tasks = (stats.tasks || []).map((task) => `<div class="task-stat-item"><div><div class="task-stat-name">${escapeHtml(task.name)}</div><div class="task-stat-meta">Сегодня: вы ${task.iDoneToday ? '✓' : '—'} · ${escapeHtml(stats.friend.name)} ${task.friendDoneToday ? '✓' : '—'}</div></div><div class="task-stat-meta">Ваши отметки: ${task.myTotal} · друга: ${task.friendTotal}</div></div>`).join('') || '<p class="settings-desc">Общих задач пока нет</p>';
        statsRoot.insertAdjacentHTML('beforeend', `<section id="friendStatsDashboard" class="settings-block friend-stats-dashboard"><div class="stats-block-title">Статистика друга · ${escapeHtml(stats.friend.name)}</div><div class="stats-block-desc">Общих задач: ${stats.sharedCount}. Здесь показан прогресс только по вашим общим задачам.</div>${tasks}</section>`);
        document.getElementById('friendStatsDashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) { toast(error.message); }
    }, true);

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
        } else if (action === 'mark-shared' || action === 'unmark-shared') {
          const actions = btn.closest('.shared-task-actions');
          const isDone = actions.querySelector('.mark').classList.contains('is-active');
          const wantDone = action === 'mark-shared';
          if (isDone === wantDone || actions.dataset.saving === 'true') return;
          actions.dataset.saving = 'true';
          actions.querySelector('.mark').classList.toggle('is-active', wantDone);
          actions.querySelector('.unmark').classList.toggle('is-active', !wantDone);
          try {
            await api('/api/shared-tasks/' + id + '/toggle', { method: 'POST', body: {} });
            renderFriends();
          } catch (err) {
            toast(err.message);
            renderFriends();
          }
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
    .shared-tasks-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:18px; margin-top:16px; }
    .shared-task-visual-card { overflow:hidden; border:1px solid color-mix(in srgb, var(--shared-accent) 55%, var(--border)); border-radius:16px; background:var(--bg-card); box-shadow:0 8px 28px rgba(0,0,0,.2); }
    .shared-card-banner { height:48px; background:linear-gradient(135deg,var(--shared-accent),color-mix(in srgb,var(--shared-accent) 48%,#000)); }
    .shared-card-body { padding:16px; }
    .shared-card-body h4 { margin:10px 0 6px; font-size:17px; }
    .shared-card-body p { margin:0 0 14px; color:var(--text-muted); font-size:13px; }
    .shared-members-progress { display:grid; gap:8px; margin:14px 0; }
    .shared-task-visual-card [data-action="toggle-shared"] { display:none; }
    .shared-task-actions { display:flex; gap:10px; margin-top:16px; }
    .shared-action-btn { width:38px; height:38px; border-radius:50%; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.06); color:var(--text-muted); cursor:pointer; font-size:21px; font-weight:700; line-height:1; transition:transform .15s,background .15s,box-shadow .15s,color .15s; }
    .shared-action-btn:hover:not(:disabled) { transform:scale(1.07); }
    .shared-action-btn:disabled { opacity:.55; cursor:wait; }
    .shared-action-btn.mark.is-active { background:var(--green); color:white; border-color:var(--green); box-shadow:0 0 0 3px rgba(0,184,148,.2); }
    .shared-action-btn.unmark.is-active { background:var(--red); color:white; border-color:var(--red); box-shadow:0 0 0 3px rgba(225,112,85,.2); }
    .shared-member-progress { padding:9px 10px; border-radius:10px; background:rgba(255,255,255,.04); border-left:3px solid var(--text-muted); }
    .shared-member-progress.done { border-left-color:var(--green); }
    .shared-member-progress.missed { border-left-color:var(--red); }
    .shared-member-name { font-size:13px; font-weight:600; display:flex; align-items:center; gap:7px; }
    .shared-status-dot { width:7px; height:7px; border-radius:50%; background:currentColor; }
    .shared-member-progress.done { color:var(--green); }.shared-member-progress.missed { color:var(--red); }
    .shared-member-progress .shared-member-meta { color:var(--text-muted); font-size:12px; margin-top:3px; }
    .shared-task-modal { width:min(520px,calc(100vw - 32px)); }
    .shared-task-modal h2 { margin-bottom:6px; }
    .shared-task-modal .form-group { margin-top:14px; }
    .shared-task-modal input[type="color"] { height:42px; padding:4px; cursor:pointer; }
    .friend-stats-dashboard { margin-top:22px; border-color:color-mix(in srgb,var(--accent) 45%,var(--border)); }
  `;
  document.head.appendChild(style);
})();
