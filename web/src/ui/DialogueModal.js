import { SoundFX } from '../audio/SoundEffects.js';

/**
 * DialogueModal.js
 * Интерактивный диалоговый интерфейс взаимодействия с ИИ-членами экипажа
 * (Инженер Марк Вэнс, Биолог Елена Ростова, Командор Александр Волк, Бортовой ИИ АСТРА).
 * 
 * Реализация:
 * - Полная поддержка сетевого обмена agent.talk -> agent.reply
 * - Карточки первоисточников цитат (Source Cards / Citations) из базы знаний
 * - Эффект печатания текста в реальном времени (Typing effect)
 * - Процедурный звуковой отклик интерфейса (SoundFX)
 * - Динамические чипы подсказок по выживанию и расследованию аварии «Горизонт-7»
 */
export class DialogueModal {
    constructor(network, onClosedCallback) {
        this.network = network;
        this.onClosed = onClosedCallback;

        this.currentProfile = null;
        this.isOpen = false;
        this.isTyping = false;
        this.typingInterval = null;

        this._createDOM();
        this._initListeners();
        this._initNetworkListeners();
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
                        <div class="message-sender" id="dialogue-bubble-sender">Член экипажа</div>
                        <div class="message-content" id="dialogue-bubble-text">Инициализация защищённого канала...</div>
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

    _initNetworkListeners() {
        if (!this.network) return;

        // Обработка входящего ответа от ИИ-агента с сервера (agent.reply)
        this.network.on('agent.reply', (reply) => {
            this._showAiThinking(false);
            if (!this.isOpen) return;

            SoundFX.playIncomingTransmission();

            const sender = reply.agent_name || (this.currentProfile ? this.currentProfile.name : 'ИИ-Специалист');
            const text = reply.text || 'Данные получены.';
            const citation = reply.citation || null;

            this._addNpcMessageWithTyping(sender, text, citation);
        });

        this.network.on('error', (err) => {
            if (this.isOpen) {
                this._showAiThinking(false);
            }
        });
    }

    /**
     * Открытие диалога с выбранным персонажем
     */
    open(profile) {
        if (!profile) return;
        this.currentProfile = profile;
        this.isOpen = true;

        SoundFX.playClick();

        // Стилизация карточки под цвет персонажа
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
        } else if (profile.id === 'astra') {
            this.avatarIcon.textContent = '🔮';
        } else {
            this.avatarIcon.textContent = '🎖️';
        }

        this.crewName.textContent = profile.name;
        this.crewRole.textContent = profile.role;
        this.crewLocation.textContent = `📍 ${profile.locationName}`;
        this.dilemmaText.textContent = profile.dilemmaStance || profile.personality;

        // Очистка и первичное приветствие
        this.chatWindow.innerHTML = '';
        this._addNpcMessageWithTyping(profile.name, profile.initialGreeting, null, false);

        // Генерация тематических чипов вопросов
        this._renderChips(profile.knowledgeTopics);

        // Показ окна
        this.overlay.classList.remove('hidden');
        this.userInput.value = '';
        setTimeout(() => this.userInput.focus(), 150);
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
                SoundFX.playClick();
                this._handleQuestionSubmit(topic.label, topic.text);
            });
            this.chipsRow.appendChild(chip);
        });
    }

    _handleUserSubmit() {
        const text = this.userInput.value.trim();
        if (!text) return;
        this.userInput.value = '';
        SoundFX.playClick();
        this._handleQuestionSubmit(text);
    }

    _handleQuestionSubmit(questionText, fallbackText = null) {
        this._addUserMessage(questionText);
        this._showAiThinking(true);

        // 1. Сетевая отправка через WebSocket (Go-сервер + Ollama / RAG)
        if (this.network && this.network.isConnected && this.network.capabilities?.agents) {
            this.network.send('agent.talk', {
                agent_id: this.currentProfile.id,
                text: questionText
            });
        } else {
            // 2. Оффлайн-fallback с цитированием первоисточника
            setTimeout(() => {
                this._showAiThinking(false);
                SoundFX.playIncomingTransmission();

                const response = fallbackText || this._generateLocalResponse(questionText);
                const citation = this._generateLocalCitation(this.currentProfile.id);

                this._addNpcMessageWithTyping(this.currentProfile.name, response, citation);
            }, 600 + Math.random() * 400);
        }
    }

    /**
     * Добавление сообщения NPC с плавным эффектом печатания (Typing effect)
     */
    _addNpcMessageWithTyping(sender, fullText, citation = null, animated = true) {
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
            this.typingInterval = null;
        }

        const msg = document.createElement('div');
        msg.className = 'chat-message npc-message';

        const senderEl = document.createElement('div');
        senderEl.className = 'message-sender';
        senderEl.style.color = this.currentProfile?.themeColor || '#38bdf8';
        senderEl.textContent = sender;
        msg.appendChild(senderEl);

        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        msg.appendChild(contentEl);

        this.chatWindow.appendChild(msg);
        this._scrollToBottom();

        if (!animated) {
            contentEl.textContent = fullText;
            if (citation) this._appendCitationCard(msg, citation);
            return;
        }

        // Посимвольный вывод текста
        let charIndex = 0;
        this.isTyping = true;
        this.typingInterval = setInterval(() => {
            if (charIndex < fullText.length) {
                contentEl.textContent += fullText[charIndex];
                charIndex++;
                this._scrollToBottom();
            } else {
                clearInterval(this.typingInterval);
                this.typingInterval = null;
                this.isTyping = false;
                if (citation) {
                    this._appendCitationCard(msg, citation);
                    this._scrollToBottom();
                }
            }
        }, 16);
    }

    /**
     * Отображение карточки первоисточника цитаты (Source Card)
     */
    _appendCitationCard(parentMsg, citation) {
        if (!citation) return;

        const card = document.createElement('div');
        card.className = 'citation-source-card';
        card.innerHTML = `
            <div class="citation-header" title="Нажмите, чтобы развернуть цитату источника">
                <span class="citation-icon">📚</span>
                <div class="citation-title-block">
                    <span class="citation-title">${this._escapeHtml(citation.source_title || 'Бортовая библиотека «Горизонт-7»')}</span>
                    <span class="citation-section">${this._escapeHtml(citation.section || 'Научный раздел')}</span>
                </div>
                <span class="citation-chevron">▾</span>
            </div>
            <div class="citation-body">
                <p class="citation-excerpt">«${this._escapeHtml(citation.excerpt || '')}»</p>
                <div class="citation-meta">
                    <span class="citation-badge">ДОСТОВЕРНОСТЬ: ${this._escapeHtml(citation.confidence || '98.4%')}</span>
                </div>
            </div>
        `;

        // Клик по шапке карточки разворачивает/сворачивает выдержку
        const header = card.querySelector('.citation-header');
        header.addEventListener('click', () => {
            card.classList.toggle('expanded');
            SoundFX.playClick();
            this._scrollToBottom();
        });

        parentMsg.appendChild(card);
    }

    _addUserMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'chat-message user-message';
        msg.innerHTML = `
            <div class="message-sender">Исследователь станции</div>
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

    _generateLocalCitation(agentId) {
        if (agentId === 'engineer') {
            return {
                source_title: 'Руководство по термодинамике контуров охлаждения «Горизонт-7»',
                section: 'Раздел 4.1. Гидродинамика и засор фильтра',
                excerpt: 'Посторонние частицы в фильтре вызывают падение прокачки ниже 15% и скачкообразный перегрев плазменной камеры.',
                confidence: '99.4% (Инженерный терминал)'
            };
        } else if (agentId === 'biologist') {
            return {
                source_title: 'Биология замкнутых экологических систем космических комплексов',
                section: 'Глава 5. Светодиодная фитофотоника и ночной покой',
                excerpt: 'Перевод культур Chlorella vulgaris на узкополосный ночной спектр 430 нм снижает расход мощности подогрева с 12 МВт до 5 МВт с сохранением регенерации кислорода.',
                confidence: '98.7% (Биобанк)'
            };
        } else if (agentId === 'astra') {
            return {
                source_title: 'Архив хронологии событий бортового ИИ АСТРА',
                section: 'Сектор памяти 0x7F-CRASH: Логи аварийного протокола',
                excerpt: 'Зафиксирован внешний кинетический импульс в радиатор. Температура реактора превысила 1200 K. Для предотвращения взрыва выполнено экстренное отключение оранжереи.',
                confidence: '100% (Архивный сервер)'
            };
        }
        return {
            source_title: 'Протокол безопасности и аварийного выживания кораблей дальнего поиска',
            section: 'Директива 09-Омега: Преодоление ресурсных тупиков',
            excerpt: 'Суммарный баланс ресурсов: работающий реактор (+8 E), охлаждение (-0 H), активная оранжерея (-3 E, O2 -3 вместо -8). Батарея даёт +25 E, но отключает резервные каналы.',
            confidence: '100% (Командный устав)'
        };
    }

    _generateLocalResponse(userQuestion) {
        const q = userQuestion.toLowerCase();
        const p = this.currentProfile;

        if (p.id === 'herodotus') {
            if (q.includes('проще')) {
                return 'Проще говоря, юноша: я путешествовал по Египту и описывал лишь то, что видел сам своими глазами, либо слышал от жрецов Гелиополя. Не верь басням о летающих камнях — их поднимали машинами из коротких деревянных брусьев!';
            }
            if (q.includes('пример')) {
                return 'Приведу тебе притчу: путник, входящий в Лабиринт без проводника, блуждает средь трех тысяч покоев. Так и ум человеческий: если не различает правду очевидца и сплетни рынка — заблудится во тьме невежества!';
            }
            return 'Приветствую тебя, любознательный эллин! В моей второй книге («Евтерпа») записано устройство великих пирамид, тайна разлива Нила в летнее солнцестояние и величие Лабиринта. Исследуй карточки на моем постаменте!';
        }

        if (p.id === 'einstein') {
            if (q.includes('проще')) {
                return 'Смотрите: свет никого не догоняет и не ждёт — его скорость c всегда постоянна! Чтобы свет пробежал между движущимися зеркалами вагона, само время внутри обязано замедлиться. При 0.6c — на 25%, а при 0.8c — на 66.7%!';
            }
            if (q.includes('пример')) {
                return 'Представьте зеркальный вагончик поезда, мчащийся со скоростью 0.8c. Внутри вагона световой зайчик просто скачет вертикально вверх-вниз. Но с перрона станции его траектория вытягивается в длинный зигзаг! Скорость та же, путь длиннее — значит, время замедляется!';
            }
            return 'Рад вас видеть в физической лаборатории! Инвариантность скорости света c приводит к преобразованиям Лоренца. Проверьте рычаг скорости на световых часах перед вами!';
        }

        if (p.id === 'astra') {
            if (q.includes('обстановк') || q.includes('статус') || q.includes('телеметр') || q.includes('доклад')) {
                return 'Телеметрия «Горизонт-7»: O2 = 64%, Энергия = 35%, Корпус = 70%. Расход O2 составляет -8 за цикл при выключенной оранжерее. До падения на Юпитер остаётся 8 циклов.';
            }
            if (q.includes('оранжер') || q.includes('почему') || q.includes('отключ')) {
                return 'В 03:42 зафиксирован критический нагрев реактора до 1200 K. Защитные алгоритмы автоматически обесточили оранжерею для сброса тепловой нагрузки. Мои воспоминания фрагментированы.';
            }
            if (q.includes('реактор') || q.includes('фильтр') || q.includes('охлажден')) {
                return 'Контур охлаждения заблокирован посторонним объектом в главном фильтре. Запуск реактора без ремонта наносит 12 единиц урона обшивке за цикл.';
            }
            if (q.includes('улик') || q.includes('расследован') || q.includes('винов')) {
                return 'Для восстановления истины сопоставьте 3 ключевых факта: металлический осколок в фильтре, отметку внешнего удара в радиатор и защитную хронологию отключения.';
            }
            return 'АСТРА готова к содействию. Мы обязаны сбалансировать расход ресурсов и рассчитать безопасный манёвр до истечения 8 циклов.';
        }

        if (q.includes('реактор') || q.includes('энерг') || q.includes('мегаватт')) {
            if (p.id === 'engineer') {
                return 'Магнитная ловушка держит нестабильную плазму. Без охлаждения реактор плавит корпус (-12 H за цикл!). Сначала чиним фильтр охлаждения (6 E), затем запускаем реактор!';
            } else if (p.id === 'biologist') {
                return 'Марк требует энергию на реактор, но без света и тепла гидропоника гибнет. Нам нужен кислород: оранжерея снижает потери O2 с 8 до 3!';
            }
            return 'У нас 35 энергии. Реактор даст +8 за цикл, но требует 8 E на старт и исправное охлаждение. Координируйте действия в пульте операций [C]!';
        }

        if (q.includes('оранжер') || q.includes('кислород') || q.includes('растен') || q.includes('еда')) {
            if (p.id === 'biologist') {
                return 'Кислородный запас иссякнет за 8 циклов! Запуск оранжереи (12 E) снизит потребление до 3 O2 за цикл. Мы обязаны оживить растения!';
            } else if (p.id === 'engineer') {
                return 'Я не против растений, но без реактора оранжерея съест последние 12 E за один цикл. Сначала генерация энергии — потом биосфера!';
            }
            return 'Оранжерея даёт жизнь экипажу. Мы обязаны сохранить её хотя бы на ночном метаболизме.';
        }

        if (q.includes('расследован') || q.includes('авари') || q.includes('улик') || q.includes('причин')) {
            return 'Используйте клавишу [I] для изучения улик: металлический осколок в фильтре, пробитый радиатор и логи АСТРЫ доказывают внешнее попадание метеорита!';
        }

        return `С точки зрения моего поста (${p.locationName}), первоочередная задача — стабилизировать ресурсы и не допустить обнуления O2, энергии или корпуса. Следите за HUD!`;
    }

    _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    close() {
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
            this.typingInterval = null;
        }
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        SoundFX.playClick();
        if (this.onClosed) {
            this.onClosed();
        }
    }
}
