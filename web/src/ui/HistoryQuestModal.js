/**
 * HistoryQuestModal.js
 * Интерактивный интерфейс исторического квеста Геродота (Stage 7).
 * Игрок сортирует карточки утверждений на две категории:
 * 1. «Подлинный источник (Геродот, Книга II "Евтерпа")»
 * 2. «Современный домысел (Псевдонаучные мифы)»
 * Серверная проверка через WebSocket event 'quest.herodotus.submit'.
 */
export class HistoryQuestModal {
    constructor(network, onClose) {
        this.network = network;
        this.onClose = onClose;
        this.isOpen = false;

        this.cards = [
            {
                id: 'pyramids_machines',
                text: 'Пирамиду строили уступами, поднимая огромные камни машинами из коротких деревянных брусьев ярус за ярусом.',
                category: null // 'quote' | 'assumption'
            },
            {
                id: 'pyramids_powerplant',
                text: 'Пирамиды Гизы возводились как генераторы космической энергии и передатчики торсионных полей.',
                category: null
            },
            {
                id: 'labyrinth_rooms',
                text: 'Лабиринт превосходит величием даже пирамиды: в нём 12 дворов и ровно 3000 покоев (1500 надземных и 1500 подземных).',
                category: null
            },
            {
                id: 'alien_laser_cutting',
                text: 'Древние зодчие использовали высокоточные плазменные резаки и акустическую левитацию для переноски монолитов.',
                category: null
            },
            {
                id: 'nile_summer_flood',
                text: 'Разлив Нила наступает в летнее солнцестояние и длится 100 дней, когда все другие реки мелеют; жрецы не дали сему объяснения.',
                category: null
            },
            {
                id: 'underground_atlantis',
                text: 'Истоки реки Нил сокрыты в кристаллических подземных храмах затонувших атлантов.',
                category: null
            }
        ];

        this._createDOM();
        this._initListeners();
    }

    _createDOM() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'history-quest-overlay';
        this.overlay.className = 'modal-backdrop hidden';
        this.overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(5, 8, 17, 0.88);
            backdrop-filter: blur(12px); z-index: 1000;
            display: flex; align-items: center; justify-content: center;
        `;

        this.overlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1e1b18 0%, #292524 100%);
                border: 2px solid #d97706;
                border-radius: 12px;
                box-shadow: 0 0 35px rgba(217, 119, 6, 0.35);
                width: 92%; max-width: 820px;
                color: #fef3c7; font-family: 'Inter', system-ui, sans-serif;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    background: rgba(28, 25, 23, 0.95);
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(217, 119, 6, 0.4);
                    display: flex; align-items: center; justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 28px;">🏛️</span>
                        <div>
                            <div style="font-weight: 700; font-size: 18px; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.05em;">
                                Испытание Геродота: Первоисточник против Домыслов
                            </div>
                            <div style="font-size: 12px; color: #d6d3d1;">
                                Книга II «Евтерпа» • Распределите факты по категориям
                            </div>
                        </div>
                    </div>
                    <button id="history-quest-close" style="
                        background: none; border: none; color: #a8a29e; font-size: 24px;
                        cursor: pointer; padding: 4px 8px; line-height: 1;
                    ">✕</button>
                </div>

                <!-- Content -->
                <div style="padding: 20px; max-height: 70vh; overflow-y: auto;">
                    <div style="
                        background: rgba(217, 119, 6, 0.1); border-left: 4px solid #f59e0b;
                        padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; line-height: 1.5; color: #fed7aa;
                    ">
                        «О досточтимый исследователь! Отдели подлинные свидетельства очевидцев и древних египтян, описанные мною в "Евтерпе", от позднейших домыслов и фантастических догадок».
                    </div>

                    <!-- Cards Container -->
                    <div id="history-cards-container" style="display: flex; flex-direction: column; gap: 12px;">
                        <!-- Generated via JS -->
                    </div>

                    <!-- Result Alert -->
                    <div id="history-result-alert" class="hidden" style="
                        margin-top: 18px; padding: 14px; border-radius: 8px;
                        font-weight: 600; font-size: 14px; text-align: center;
                    "></div>
                </div>

                <!-- Footer -->
                <div style="
                    background: rgba(28, 25, 23, 0.95);
                    padding: 14px 24px;
                    border-top: 1px solid rgba(217, 119, 6, 0.3);
                    display: flex; justify-content: space-between; align-items: center;
                ">
                    <span style="font-size: 12px; color: #a8a29e;">Для зачета требуется верно определить не менее 5 карточек</span>
                    <button id="history-submit-btn" style="
                        background: #d97706; border: none; color: white;
                        padding: 10px 24px; border-radius: 6px; font-weight: 700;
                        cursor: pointer; box-shadow: 0 2px 10px rgba(217, 119, 6, 0.4);
                    ">Проверить классификацию</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
    }

    _initListeners() {
        document.getElementById('history-quest-close')?.addEventListener('click', () => this.close());
        document.getElementById('history-submit-btn')?.addEventListener('click', () => this.submit());

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // Слушатель результатов квеста от сервера
        this.network.on('quest.herodotus.result', (res) => {
            this._handleResult(res);
        });
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        this._renderCards();
        const alertBox = document.getElementById('history-result-alert');
        if (alertBox) alertBox.className = 'hidden';
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        if (this.onClose) this.onClose();
    }

    _renderCards() {
        const container = document.getElementById('history-cards-container');
        if (!container) return;

        container.innerHTML = this.cards.map((c, idx) => `
            <div style="
                background: #292524; border: 1px solid #44403c; border-radius: 8px;
                padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px;
            ">
                <div style="flex: 1; font-size: 14px; line-height: 1.4; color: #f5f5f4;">
                    <span style="color: #f59e0b; font-weight: 700; margin-right: 6px;">#${idx + 1}</span>
                    ${c.text}
                </div>
                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                    <button data-card="${c.id}" data-type="quote" class="history-select-btn ${c.category === 'quote' ? 'active-quote' : ''}" style="
                        background: ${c.category === 'quote' ? '#059669' : '#1c1917'};
                        border: 1px solid ${c.category === 'quote' ? '#10b981' : '#57534e'};
                        color: ${c.category === 'quote' ? '#ffffff' : '#d6d3d1'};
                        padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
                    ">📜 Подлинный источник</button>
                    <button data-card="${c.id}" data-type="assumption" class="history-select-btn ${c.category === 'assumption' ? 'active-myth' : ''}" style="
                        background: ${c.category === 'assumption' ? '#b91c1c' : '#1c1917'};
                        border: 1px solid ${c.category === 'assumption' ? '#ef4444' : '#57534e'};
                        color: ${c.category === 'assumption' ? '#ffffff' : '#d6d3d1'};
                        padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
                    ">🛸 Современный домысел</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.history-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cardId = e.currentTarget.getAttribute('data-card');
                const catType = e.currentTarget.getAttribute('data-type');
                const card = this.cards.find(c => c.id === cardId);
                if (card) {
                    card.category = catType;
                    this._renderCards();
                }
            });
        });
    }

    submit() {
        const answers = {};
        let allAnswered = true;

        for (const c of this.cards) {
            if (!c.category) {
                allAnswered = false;
                break;
            }
            answers[c.id] = c.category;
        }

        if (!allAnswered) {
            alert('Пожалуйста, классифицируйте все 6 карточек перед отправкой!');
            return;
        }

        if (this.network.isConnected) {
            this.network.send('quest.herodotus.submit', { answers });
        } else {
            // Оффлайн проверка
            const groundTruth = {
                pyramids_machines: 'quote',
                pyramids_powerplant: 'assumption',
                labyrinth_rooms: 'quote',
                alien_laser_cutting: 'assumption',
                nile_summer_flood: 'quote',
                underground_atlantis: 'assumption'
            };
            let score = 0;
            const feedback = {};
            for (const [k, v] of Object.entries(groundTruth)) {
                const ok = answers[k] === v;
                feedback[k] = ok;
                if (ok) score++;
            }
            this._handleResult({
                score,
                total: 6,
                passed: score >= 5,
                message: score >= 5
                    ? 'Поздравляем! Вы безупречно отличили подлинные свидетельства Геродота от современных домыслов!'
                    : 'Некоторые карточки определены неверно. Помните: Геродот опирался на свидетельства жрецов и деревянные машины, а не на фантастику!'
            });
        }
    }

    _handleResult(res) {
        const alertBox = document.getElementById('history-result-alert');
        if (!alertBox) return;

        alertBox.classList.remove('hidden');
        if (res.passed) {
            alertBox.style.background = 'rgba(16, 185, 129, 0.2)';
            alertBox.style.border = '1px solid #10b981';
            alertBox.style.color = '#a7f3d0';
            alertBox.innerHTML = `✓ ${res.message} (Правильно: ${res.score} из ${res.total})`;
        } else {
            alertBox.style.background = 'rgba(239, 68, 68, 0.2)';
            alertBox.style.border = '1px solid #ef4444';
            alertBox.style.color = '#fca5a5';
            alertBox.innerHTML = `✗ ${res.message} (Правильно: ${res.score} из ${res.total}). Попробуйте исправить выбор!`;
        }
    }
}
