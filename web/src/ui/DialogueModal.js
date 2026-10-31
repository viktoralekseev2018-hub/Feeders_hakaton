/**
 * DialogueModal.js
 * Интерактивный диалоговый интерфейс взаимодействия с ИИ-членами экипажа
 * (Инженер, Биолог, Капитан).
 * 
 * Поддерживает:
 * - Отображение уникального портрета, характера и позиции в дилемме
 * - Быстрые подсказки вопросов (Suggestion Chips)
 * - Поле свободного ввода вопроса игрока
 * - Индикатор размышления ИИ (генерация ответа)
 * - Восстановление фокуса мыши (PointerLock) при закрытии
 */
export class DialogueModal {
    constructor(network, onClosedCallback) {
        this.network = network;
        this.onClosed = onClosedCallback;

        this.currentProfile = null;
        this.isOpen = false;
        this.conversationHistory = [];

        this._createDOM();
        this._initListeners();
    }

    _createDOM() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'dialogue-modal-overlay hidden';
        this.overlay.id = 'dialogue-modal';

        this.overlay.innerHTML = `
            <div class="dialogue-card" id="dialogue-card">
                <!-- Шапка диалога -->
                <div class="dialogue-header">
                    <div class="crew-badge-container">
                        <div class="crew-avatar-frame" id="dialogue-avatar-frame">
                            <span class="crew-avatar-icon" id="dialogue-avatar-icon">🧑‍🚀</span>
                        </div>
                        <div class="crew-meta">
                            <div class="crew-name-row">
                                <h2 class="crew-name" id="dialogue-crew-name">Член экипажа</h2>
                                <span class="crew-role-badge" id="dialogue-crew-role">Специалист</span>
                            </div>
                            <p class="crew-location" id="dialogue-crew-location">Отсек станции</p>
                        </div>
                    </div>
                    <button class="dialogue-close-btn" id="dialogue-close-btn" title="Закрыть (Esc)">✕</button>
                </div>

                <!-- Блок характера и дилеммы персонажа -->
                <div class="crew-dilemma-bar" id="dialogue-dilemma-bar">
                    <span class="dilemma-tag">ПОЗИЦИЯ:</span>
                    <span class="dilemma-text" id="dialogue-dilemma-text">Позиция по энергии</span>
                </div>

                <!-- Окно сообщений / лента диалога -->
                <div class="dialogue-chat-window" id="dialogue-chat-window">
                    <div class="chat-message npc-message" id="dialogue-initial-bubble">
                        <div class="message-sender" id="dialogue-bubble-sender">Марк Вэнс</div>
                        <div class="message-content" id="dialogue-bubble-text">Инициализация связи...</div>
                    </div>
                </div>

                <!-- Индикатор генерации ИИ -->
                <div class="ai-status-indicator hidden" id="dialogue-ai-status">
                    <span class="status-pulse-dot"></span>
                    <span id="dialogue-ai-status-text">ИИ-агент формулирует ответ...</span>
                </div>

                <!-- Быстрые варианты вопросов (Chips) -->
                <div class="dialogue-chips-row" id="dialogue-chips-row">
                    <!-- Чипы генерируются динамически -->
                </div>

                <!-- Поле свободного ввода вопроса -->
                <form class="dialogue-input-form" id="dialogue-input-form" onsubmit="return false;">
                    <input type="text" 
                           id="dialogue-user-input" 
                           class="dialogue-input" 
                           placeholder="Спросить члена экипажа о ситуации на станции..." 
                           autocomplete="off">
                    <button type="submit" class="dialogue-send-btn" id="dialogue-send-btn">
                        <span>Отправить</span>
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Кэширование ссылок на элементы
        this.card = this.overlay.querySelector('#dialogue-card');
        this.avatarFrame = this.overlay.querySelector('#dialogue-avatar-frame');
        this.avatarIcon = this.overlay.querySelector('#dialogue-avatar-icon');
        this.crewName = this.overlay.querySelector('#dialogue-crew-name');
        this.crewRole = this.overlay.querySelector('#dialogue-crew-role');
        this.crewLocation = this.overlay.querySelector('#dialogue-crew-location');
        this.dilemmaBar = this.overlay.querySelector('#dialogue-dilemma-bar');
        this.dilemmaText = this.overlay.querySelector('#dialogue-dilemma-text');
        this.chatWindow = this.overlay.querySelector('#dialogue-chat-window');
        this.chipsRow = this.overlay.querySelector('#dialogue-chips-row');
        this.inputForm = this.overlay.querySelector('#dialogue-input-form');
        this.userInput = this.overlay.querySelector('#dialogue-user-input');
        this.aiStatus = this.overlay.querySelector('#dialogue-ai-status');
        this.closeBtn = this.overlay.querySelector('#dialogue-close-btn');
    }

    _initListeners() {
        this.closeBtn.addEventListener('click', () => this.close());

        this.inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleUserSubmit();
        });

        // Закрытие по нажатию Esc
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Открытие диалога с выбранным персонажем
     * @param {object} profile 
     */
    open(profile) {
        if (!profile) return;
        this.currentProfile = profile;
        this.isOpen = true;

        // Настройка визуальных стилей по теме персонажа
        this.card.style.setProperty('--crew-color', profile.themeColor);
        this.avatarFrame.style.borderColor = profile.themeColor;
        this.avatarFrame.style.boxShadow = `0 0 16px ${profile.themeColor}55`;
        this.crewRole.style.backgroundColor = `${profile.themeColor}22`;
        this.crewRole.style.color = profile.themeColor;
        this.crewRole.style.borderColor = profile.themeColor;

        if (profile.id === 'engineer') {
            this.avatarIcon.textContent = '🛠️';
        } else if (profile.id === 'biologist') {
            this.avatarIcon.textContent = '🌱';
        } else {
            this.avatarIcon.textContent = '🎖️';
        }

        this.crewName.textContent = profile.name;
        this.crewRole.textContent = profile.role;
        this.crewLocation.textContent = `📍 ${profile.locationName}`;
        this.dilemmaText.textContent = profile.dilemmaStance;

        // Очистка и первичное приветствие
        this.chatWindow.innerHTML = '';
        this._addNpcMessage(profile.name, profile.initialGreeting);

        // Генерация подсказок (chips)
        this._renderChips(profile.knowledgeTopics);

        // Показ окна
        this.overlay.classList.remove('hidden');
        this.userInput.value = '';
        setTimeout(() => this.userInput.focus(), 100);
    }

    _renderChips(topics) {
        this.chipsRow.innerHTML = '';
        if (!topics) return;

        topics.forEach(topic => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'dialogue-chip';
            chip.textContent = topic.label;
            chip.addEventListener('click', () => {
                this._addUserMessage(topic.label);
                this._simulateAiResponse(topic.text);
            });
            this.chipsRow.appendChild(chip);
        });
    }

    _handleUserSubmit() {
        const text = this.userInput.value.trim();
        if (!text) return;

        this._addUserMessage(text);
        this.userInput.value = '';

        // Попытка отправить через сетевой протокол к Go-серверу (если World/Agents подключены)
        if (this.network && this.network.isConnected && this.network.capabilities?.agents) {
            this.network.send('agent.talk', {
                agent_id: this.currentProfile.id,
                text: text
            });
            this._showAiThinking(true);
        } else {
            // Оффлайн/Scaffold fallback: адаптивный локальный ответ согласно характеру персонажа
            this._showAiThinking(true);
            setTimeout(() => {
                const response = this._generateLocalResponse(text);
                this._showAiThinking(false);
                this._addNpcMessage(this.currentProfile.name, response);
            }, 600 + Math.random() * 500);
        }
    }

    _simulateAiResponse(responseText) {
        this._showAiThinking(true);
        setTimeout(() => {
            this._showAiThinking(false);
            this._addNpcMessage(this.currentProfile.name, responseText);
        }, 500);
    }

    _generateLocalResponse(userQuestion) {
        const q = userQuestion.toLowerCase();
        const p = this.currentProfile;

        if (q.includes('реактор') || q.includes('энерг') || q.includes('мегаватт')) {
            if (p.id === 'engineer') {
                return 'Магнитная ловушка держит нестабильную плазму. Без дополнительного контура охлаждения через 30 минут случится тепловой взрыв. Я не шучу!';
            } else if (p.id === 'biologist') {
                return 'Марк всё время кричит о реакторе, но нам не нужна энергия ценой уничтожения всей оранжереи. Нужно найти альтернативный баланс.';
            } else {
                return 'Реактор — сердце станции, но мы не можем допустить гибели экипажа от удушья. Нужна плавная балансировка мощности.';
            }
        }

        if (q.includes('оранжер') || q.includes('кислород') || q.includes('растен') || q.includes('еда')) {
            if (p.id === 'biologist') {
                return 'Наши гидропонные лотки поддерживают уровень O2 на отметке 68%. Еще пара часов без подогрева — и хлорелла отомрет. Мы обязаны спасти фитосистему!';
            } else if (p.id === 'engineer') {
                return 'Растения важны, не спорю, но замерзшие растения не выделяют кислород! Сначала спасем источник тепла, потом займемся фауной.';
            } else {
                return 'Оранжерея обеспечивает автономность станции. Без нее мы зависим от аварийных картриджей регенерации всего на 48 часов.';
            }
        }

        if (q.includes('треть') || q.includes('решен') || q.includes('компромисс') || q.includes('вместе') || q.includes('выход')) {
            return `Именно это мы и обсуждаем! Вау-фишка станции — не выбирать между реактором и оранжереей, а скоординировать энергопотребление. Мы можем перевести реактор в 2 Гц импульсный режим и снизить спектр биокупола до 430 нм!`;
        }

        if (q.includes('привет') || q.includes('кто ты') || q.includes('что делать')) {
            return `Я ${p.name}, ${p.role}. Твоя задача как исследователя — обойти все отсеки станции, оценить телеметрию и помочь нашему экипажу восстановить баланс!`;
        }

        return `С точки зрения моего отсека (${p.locationName}), первоочередная задача — стабилизировать телеметрию. Внимательно следи за показателями O2 и энергии на HUD!`;
    }

    _addUserMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'chat-message user-message';
        msg.innerHTML = `
            <div class="message-sender">Вы (Исследователь)</div>
            <div class="message-content">${this._escapeHtml(text)}</div>
        `;
        this.chatWindow.appendChild(msg);
        this._scrollToBottom();
    }

    _addNpcMessage(sender, text) {
        const msg = document.createElement('div');
        msg.className = 'chat-message npc-message';
        msg.innerHTML = `
            <div class="message-sender" style="color: ${this.currentProfile?.themeColor || '#38bdf8'}">${this._escapeHtml(sender)}</div>
            <div class="message-content">${this._escapeHtml(text)}</div>
        `;
        this.chatWindow.appendChild(msg);
        this._scrollToBottom();
    }

    _showAiThinking(show) {
        if (show) {
            this.aiStatus.classList.remove('hidden');
        } else {
            this.aiStatus.classList.add('hidden');
        }
        this._scrollToBottom();
    }

    _scrollToBottom() {
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }

    _escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        if (this.onClosed) {
            this.onClosed();
        }
    }
}
