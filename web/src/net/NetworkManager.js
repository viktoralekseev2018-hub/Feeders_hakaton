/**
 * NetworkManager.js
 * Сетевой менеджер клиента для взаимодействия с Go-сервером в локальной сети (LAN).
 * Отвечает за HTTP-авторизацию (cookie) и последующее WebSocket-соединение.
 */
export class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.currentUser = null;
        this.listeners = new Map();
        this.requestIdCounter = 1;
        this.pingInterval = null;
        this.capabilities = null;
    }

    /**
     * Регистрация нового аккаунта через HTTP REST API
     * @param {string} username 
     * @param {string} password 
     */
    async register(username, password) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || `Ошибка регистрации (${response.status})`);
            }
            return data;
        } catch (err) {
            console.warn('[NetworkManager] Ошибка регистрации:', err.message);
            throw err;
        }
    }

    /**
     * Авторизация существующего пользователя
     * Сервер выставляет HttpOnly-cookie с сессией
     * @param {string} username 
     * @param {string} password 
     */
    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || `Ошибка входа (${response.status})`);
            }

            this.currentUser = data.user || { username, id: data.user_id || 'usr_1' };
            return data;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Подключение к WebSocket после успешной авторизации
     */
    connectWebSocket() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:8080';
        const wsUrl = `${protocol}//${host}/ws`;

        console.log(`[NetworkManager] Подключение к WebSocket: ${wsUrl}`);
        
        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                this.isConnected = true;
                console.log('[NetworkManager] WebSocket соединение установлено.');
                this._emit('connect', { user: this.currentUser });

                // Отправляем первичный пакет инициализации игрока по протоколу ТЗ
                this.send('player.init', {
                    client_time: Date.now(),
                    username: this.currentUser ? this.currentUser.username : 'Unknown'
                });

                // Начинаем heartbeat пинг
                this._startHeartbeat();
            };

            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'player.ready') {
                        this.currentUser = message.payload.user;
                        this.capabilities = message.payload.capabilities;
                    }
                    this._emit('message', message);
                    if (message.type) {
                        this._emit(message.type, message.payload, message);
                    }
                } catch (e) {
                    console.error('[NetworkManager] Ошибка парсинга WS пакета:', e);
                }
            };

            this.socket.onclose = (event) => {
                this.isConnected = false;
                this.capabilities = null;
                this._stopHeartbeat();
                console.warn(`[NetworkManager] WebSocket закрыт (код: ${event.code}, причина: ${event.reason || 'нет'})`);
                this._emit('disconnect', { code: event.code, reason: event.reason });
            };

            this.socket.onerror = (err) => {
                console.warn('[NetworkManager] WebSocket ошибка соединения:', err);
                this._emit('error', err);
            };

        } catch (err) {
            console.error('[NetworkManager] Не удалось создать WebSocket:', err);
            this._emit('disconnect', { error: err.message });
        }
    }

    /**
     * Отправка типизированного сообщения на сервер
     * @param {string} type 
     * @param {object} payload 
     * @returns {string} request_id
     */
    send(type, payload = {}) {
        // Scaffold advertises unavailable modules; do not flood it with 18 Hz errors.
        if (type === 'player.input' && !this.capabilities?.movement) return null;
        const requestId = `req-${this.requestIdCounter++}`;
        const packet = {
            protocol_version: 1,
            type: type,
            request_id: requestId,
            payload: payload
        };

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(packet));
        } else {
            // Если сокет еще не подключен или оффлайн, эмулируем локальное логирование
            // console.debug('[NetworkManager WS Offline] Packet queued/skipped:', type, packet);
        }

        return requestId;
    }

    /**
     * Подписка на события
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Отписка от событий
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const list = this.listeners.get(event).filter(cb => cb !== callback);
        this.listeners.set(event, list);
    }

    _emit(event, ...args) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => {
                try {
                    cb(...args);
                } catch (err) {
                    console.error(`[NetworkManager] Ошибка в слушателе '${event}':`, err);
                }
            });
        }
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping', { timestamp: Date.now() });
            }
        }, 10000);
    }

    _stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}
