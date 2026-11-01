/**
 * AuthModal.js
 * Управление экраном авторизации и регистрации
 */
export class AuthModal {
    constructor(networkManager, onAuthSuccess) {
        this.network = networkManager;
        this.onAuthSuccess = onAuthSuccess;
        this.isRegisterMode = false;

        this.modal = document.getElementById('auth-modal');
        this.form = document.getElementById('auth-form');
        this.usernameInput = document.getElementById('auth-username');
        this.passwordInput = document.getElementById('auth-password');
        this.submitBtn = document.getElementById('auth-submit-btn');
        this.feedback = document.getElementById('auth-feedback');
        this.tabLoginBtn = document.getElementById('tab-login-btn');
        this.tabRegisterBtn = document.getElementById('tab-register-btn');

        this._initEvents();
    }

    _initEvents() {
        this.tabLoginBtn.addEventListener('click', () => this._setMode(false));
        this.tabRegisterBtn.addEventListener('click', () => this._setMode(true));

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });
    }

    _setMode(isRegister) {
        this.isRegisterMode = isRegister;
        this.feedback.textContent = '';
        if (isRegister) {
            this.tabRegisterBtn.classList.add('active');
            this.tabLoginBtn.classList.remove('active');
            this.submitBtn.textContent = 'Создать аккаунт';
        } else {
            this.tabLoginBtn.classList.add('active');
            this.tabRegisterBtn.classList.remove('active');
            this.submitBtn.textContent = 'Войти в мир';
        }
    }

    async _handleSubmit() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            this._showError('Пожалуйста, заполните все поля');
            return;
        }

        this.submitBtn.disabled = true;
        this.submitBtn.textContent = 'Подключение...';
        this.feedback.textContent = '';

        try {
            if (this.isRegisterMode) {
                // Сначала регистрация
                await this.network.register(username, password);
                this._showMessage('Аккаунт создан! Выполняется вход...', 'green');
            }

            // Затем авторизация
            const loginRes = await this.network.login(username, password);
            
            // Скрываем окно авторизации
            this.hide();

            // Оповещаем приложение об успехе
            if (this.onAuthSuccess) {
                this.onAuthSuccess(loginRes.user || { username });
            }

        } catch (err) {
            this._showError(err.message || 'Ошибка соединения с сервером');
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = this.isRegisterMode ? 'Создать аккаунт' : 'Войти в мир';
        }
    }

    _showError(msg) {
        this.feedback.style.color = '#f85149';
        this.feedback.textContent = msg;
    }

    _showMessage(msg, color = '#2ea043') {
        this.feedback.style.color = color;
        this.feedback.textContent = msg;
    }

    hide() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    }

    show() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
        }
    }
}
