const $ = id => document.getElementById(id);

/** Real authentication against the existing Go server. Never stores passwords. */
export class AuthScreen {
  constructor(network, onSuccess) {
    this.network = network;
    this.onSuccess = onSuccess;
    this.register = location.pathname === '/register';
    this.busy = false;
    // Adapt the terminal rail from the supplied FIZMA form to the ship's real
    // username-based authentication. No demo mode and no extra email account.
    const note = document.querySelector?.('.access-note');
    if (note) {
      const terminal = document.createElement('div');
      terminal.className = 'fizma-terminal';
      terminal.innerHTML = '<div class="fizma-terminal-heading">FIZMA / CREW ACCESS</div><p><i>&gt;</i>access: <strong>crew</strong></p><p><i>&gt;</i>progress: <strong>saved on host</strong></p><p><i>&gt;</i>world: <strong>shared</strong></p><p><i>&gt;</i>status: <strong id="fizma-auth-status">waiting for login</strong></p>';
      note.replaceWith(terminal);
    }
    $('auth-switch').onclick = () => this.setMode(!this.register);
    $('auth-login-tab').onclick = () => this.setMode(false);
    $('auth-register-tab').onclick = () => this.setMode(true);
    $('password-toggle').onclick = () => {
      const visible = $('password').type === 'password';
      for (const id of ['password', 'password-confirm']) $(id).type = visible ? 'text' : 'password';
      $('password-toggle').setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
      $('password-toggle').setAttribute('aria-pressed', String(visible));
    };
    for (const id of ['username', 'password', 'password-confirm']) {
      $(id).addEventListener('input', () => {
        this.error(id, '');
        $('auth-error').textContent = '';
        if (id === 'password') this.strength();
      });
    }
    $('password').addEventListener('keyup', e => {
      $('caps-warning').hidden = !e.getModifierState?.('CapsLock');
    });
    $('password').addEventListener('blur', () => $('caps-warning').hidden = true);
    $('auth-form').onsubmit = e => { e.preventDefault(); this.submit(); };
    window.addEventListener('popstate', () => { this.register = location.pathname === '/register'; this.render(); });
    this.render();
  }

  setMode(register) {
    if (this.busy) return;
    this.register = register;
    // Keep an invitation code when switching between login and registration.
    history.replaceState({}, '', (register ? '/register' : '/login') + location.search);
    $('password-confirm').value = '';
    // Switching modes must not leave either password field visible.
    for (const id of ['password', 'password-confirm']) $(id).type = 'password';
    $('password-toggle').setAttribute('aria-label', 'Показать пароль');
    $('password-toggle').setAttribute('aria-pressed', 'false');
    this.render();
    $('username').focus({preventScroll: true});
  }

  render() {
    const r = this.register;
    $('auth-title').textContent = r ? 'Ваше место в экипаже' : 'Вернуться на борт';
    $('auth-code').textContent = r ? '02 / CREATE ACCOUNT' : '01 / AUTHORIZATION';
    const terminalStatus = $('fizma-auth-status');
    if (terminalStatus) terminalStatus.textContent = r ? 'waiting for registration' : 'waiting for login';
    $('auth-subtitle').textContent = r ? 'Придумайте позывной. Впереди — ваша первая экспедиция и решения, которые изменят её исход.' : 'Ваша экспедиция ждёт. Войдите, чтобы продолжить с места остановки.';
    $('auth-submit').innerHTML = `<span>${r ? 'ПРИСОЕДИНИТЬСЯ К ЭКИПАЖУ' : 'ВОЙТИ НА КОРАБЛЬ'}</span><span aria-hidden="true">↗</span>`;
    $('auth-switch-caption').textContent = r ? 'Уже есть аккаунт?' : 'Первая экспедиция?';
    $('auth-switch').textContent = r ? 'Войти на корабль ↗' : 'Создать аккаунт ↗';
    $('password').autocomplete = r ? 'new-password' : 'current-password';
    $('password').placeholder = r ? 'Не менее 6 символов' : 'Ваш пароль';
    $('password-label-hint').textContent = r ? 'НЕ МЕНЕЕ 6 СИМВОЛОВ' : 'ДОСТУП К КОРАБЛЮ';
    $('auth-login-tab').setAttribute('aria-pressed', String(!r));
    $('auth-register-tab').setAttribute('aria-pressed', String(r));
    $('confirm-field').hidden = !r;
    $('password-confirm').required = r;
    $('password-strength').hidden = !r;
    $('auth-error').textContent = '';
    for (const id of ['username', 'password', 'password-confirm']) this.error(id, '');
    this.strength();
  }

  error(id, message) {
    $(id + '-error').textContent = message;
    $(id).setAttribute('aria-invalid', String(Boolean(message)));
    $(id).closest('.input-shell').classList.toggle('invalid', Boolean(message));
  }

  strength() {
    const value = $('password').value;
    // A length guide, not a claim that the password is cryptographically strong.
    const score = value.length >= 16 ? 4 : value.length >= 12 ? 3 : value.length >= 8 ? 2 : value.length >= 6 ? 1 : 0;
    $('password-strength').dataset.level = score;
    $('password-strength').querySelectorAll('i').forEach((el, i) => el.classList.toggle('filled', i < score));
    $('strength-caption').textContent = !value ? 'Используйте длинный пароль из нескольких слов' : score === 0 ? 'Добавьте ещё символы — нужно не менее 6' : score < 3 ? 'Можно сделать длиннее: 12–16 символов удобнее защитить' : 'Хорошая длина. Не используйте этот пароль в других сервисах';
  }

  async submit() {
    if (this.busy) return;
    const name = $('username').value.trim();
    const password = $('password').value;
    const bytes = new TextEncoder().encode(password).length;
    const errors = [];
    if (!/^[\p{L}\p{N}_-]{3,32}$/u.test(name)) errors.push(['username', 'От 3 до 32 букв или цифр. Допустимы _ и дефис.']);
    if (bytes < 6 || bytes > 72) errors.push(['password', 'Пароль должен занимать от 6 до 72 байт. Для кириллицы лимит символов меньше.']);
    if (this.register && password !== $('password-confirm').value) errors.push(['password-confirm', 'Пароли не совпадают. Проверьте повторный ввод.']);
    for (const id of ['username', 'password', 'password-confirm']) this.error(id, '');
    $('auth-error').textContent = '';
    if (errors.length) {
      errors.forEach(([id, message]) => this.error(id, message));
      $(errors[0][0]).focus();
      return;
    }
    this.busy = true;
    $('auth-form').setAttribute('aria-busy', 'true');
    const buttons = ['auth-submit', 'auth-switch', 'auth-login-tab', 'auth-register-tab'];
    buttons.forEach(id => $(id).disabled = true);
    $('auth-submit').innerHTML = `<span>${this.register ? 'СОЗДАЁМ АККАУНТ…' : 'ПРОВЕРЯЕМ ДОСТУП…'}</span><span class="button-spinner" aria-hidden="true"></span>`;
    try {
      const user = await this.network.authenticate(this.register ? 'register' : 'login', name, password);
      $('password').value = '';
      $('password-confirm').value = '';
      this.onSuccess(user);
    } catch (error) {
      if (error.status === 409) {
        this.error('username', 'Этот позывной уже занят. Выберите другой или войдите в аккаунт.');
        $('username').focus();
      } else {
        $('auth-error').textContent = error.status === 401 ? 'Позывной или пароль не совпали. Проверьте данные и попробуйте снова.' : error instanceof TypeError ? 'Нет связи с сервером. Проверьте адрес и подключение к локальной сети.' : error.message;
      }
    } finally {
      this.busy = false;
      $('auth-form').removeAttribute('aria-busy');
      buttons.forEach(id => $(id).disabled = false);
      $('auth-submit').innerHTML = `<span>${this.register ? 'ПРИСОЕДИНИТЬСЯ К ЭКИПАЖУ' : 'ВОЙТИ НА КОРАБЛЬ'}</span><span aria-hidden="true">↗</span>`;
    }
  }
}
