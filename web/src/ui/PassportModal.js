/**
 * PassportModal.js
 * Модальное окно «Паспорт исследователя» (Stage 6).
 * Показывает:
 * - Имя исследователя и текущий допуск («Стажёр-исследователь», «Специалист СТО», «Старший историк-архивист»)
 * - Освоенные научные темы (термодинамика реактора, фитофотоника 430 нм, релятивистские световые часы)
 * - Пройденные исследовательские квесты
 * - Счётчик проведенных физических экспериментов
 * Горячая клавиша: [P] или кнопка на панели HUD.
 */
export class PassportModal {
    constructor(network, onClose) {
        this.network = network;
        this.onClose = onClose;
        this.isOpen = false;

        this._createDOM();
        this._initListeners();
    }

    _createDOM() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'passport-modal-overlay';
        this.overlay.className = 'modal-backdrop hidden';
        this.overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(5, 8, 17, 0.85);
            backdrop-filter: blur(10px); z-index: 1000;
            display: flex; align-items: center; justify-content: center;
        `;

        this.overlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                border: 2px solid #38bdf8;
                border-radius: 12px;
                box-shadow: 0 0 35px rgba(56, 189, 248, 0.35);
                width: 90%; max-width: 620px;
                color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    background: rgba(15, 23, 42, 0.9);
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(56, 189, 248, 0.3);
                    display: flex; align-items: center; justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 26px;">📜</span>
                        <div>
                            <div style="font-weight: 700; font-size: 18px; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">
                                Паспорт исследователя
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                Бортовой реестр научных квалификаций • Станция «Гелиос-7»
                            </div>
                        </div>
                    </div>
                    <button id="passport-close-btn" style="
                        background: none; border: none; color: #94a3b8; font-size: 24px;
                        cursor: pointer; padding: 4px 8px; line-height: 1;
                    ">✕</button>
                </div>

                <!-- Body -->
                <div style="padding: 24px; max-height: 70vh; overflow-y: auto;">
                    <!-- User & Clearance Badge -->
                    <div style="
                        background: rgba(56, 189, 248, 0.08);
                        border: 1px solid rgba(56, 189, 248, 0.25);
                        border-radius: 8px; padding: 16px; margin-bottom: 20px;
                        display: flex; justify-content: space-between; align-items: center;
                    ">
                        <div>
                            <div style="font-size: 13px; color: #94a3b8;">Имя исследователя:</div>
                            <div id="passport-username" style="font-size: 20px; font-weight: 700; color: #f8fafc;">Исследователь</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; color: #94a3b8;">Уровень допуска:</div>
                            <div id="passport-clearance" style="
                                display: inline-block; background: #0284c7; color: white;
                                font-weight: 700; font-size: 13px; padding: 4px 12px;
                                border-radius: 20px; margin-top: 4px; text-transform: uppercase;
                            ">Стажёр-исследователь</div>
                        </div>
                    </div>

                    <!-- Metrics Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 14px;">
                            <div style="font-size: 12px; color: #94a3b8;">Проведено опытов СТО</div>
                            <div id="passport-experiments" style="font-size: 26px; font-weight: 700; color: #38bdf8; margin-top: 4px;">0</div>
                        </div>
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 14px;">
                            <div style="font-size: 12px; color: #94a3b8;">Баллы открытий</div>
                            <div id="passport-score" style="font-size: 26px; font-weight: 700; color: #22c55e; margin-top: 4px;">0</div>
                        </div>
                    </div>

                    <!-- Mastered Topics -->
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 14px; font-weight: 600; color: #cbd5e1; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span>🎓</span> Освоенные темы и концепции:
                        </div>
                        <div id="passport-topics-list" style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <span style="background: #1e293b; border: 1px solid #475569; padding: 6px 12px; border-radius: 6px; font-size: 13px; color: #cbd5e1;">
                                Основы выживания на орбите
                            </span>
                        </div>
                    </div>

                    <!-- Completed Quests -->
                    <div>
                        <div style="font-size: 14px; font-weight: 600; color: #cbd5e1; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span>🏆</span> Завершенные исследовательские задания:
                        </div>
                        <div id="passport-quests-list" style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="font-size: 13px; color: #64748b; font-style: italic;">
                                Нет завершенных заданий. Поговорите с Геродотом или Эйнштейном!
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="
                    background: rgba(15, 23, 42, 0.9);
                    padding: 14px 24px;
                    border-top: 1px solid rgba(56, 189, 248, 0.2);
                    display: flex; justify-content: space-between; align-items: center;
                ">
                    <span style="font-size: 12px; color: #64748b;">Горячая клавиша: [P]</span>
                    <button id="passport-ok-btn" style="
                        background: #0284c7; border: none; color: white;
                        padding: 8px 20px; border-radius: 6px; font-weight: 600;
                        cursor: pointer;
                    ">Закрыть</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
    }

    _initListeners() {
        const closeBtn = document.getElementById('passport-close-btn');
        const okBtn = document.getElementById('passport-ok-btn');

        closeBtn?.addEventListener('click', () => this.close());
        okBtn?.addEventListener('click', () => this.close());

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // Слушатель WebSocket события passport.state
        this.network.on('passport.state', (passport) => {
            this.updateData(passport);
        });
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.remove('hidden');

        // Запрашиваем свежее состояние паспорта с сервера
        if (this.network.isConnected) {
            this.network.send('passport.get', {});
        } else {
            // Оффлайн фоллбэк
            this.updateData({
                user_id: this.network.currentUser?.username || 'Исследователь',
                clearance_level: 'Исследователь станции',
                mastered_topics: [
                    'Термодинамика реактора и компромисс 9 МВт',
                    'Фитофотоника 430 нм и Chlorella vulgaris',
                    'Релятивистские световые часы (γ = 1/√(1-v²/c²))'
                ],
                completed_quests: ['Разрешение энергетического кризиса'],
                experiment_runs: 2,
                score: 180
            });
        }
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        if (this.onClose) this.onClose();
    }

    updateData(p) {
        if (!p) return;

        const nameEl = document.getElementById('passport-username');
        const clearanceEl = document.getElementById('passport-clearance');
        const expEl = document.getElementById('passport-experiments');
        const scoreEl = document.getElementById('passport-score');
        const topicsList = document.getElementById('passport-topics-list');
        const questsList = document.getElementById('passport-quests-list');

        if (nameEl) nameEl.textContent = this.network.currentUser?.username || p.user_id || 'Исследователь';
        if (clearanceEl) clearanceEl.textContent = p.clearance_level || 'Исследователь';
        if (expEl) expEl.textContent = p.experiment_runs || 0;
        if (scoreEl) scoreEl.textContent = p.score || 0;

        if (topicsList && Array.isArray(p.mastered_topics)) {
            topicsList.innerHTML = p.mastered_topics.map(t => `
                <span style="background: rgba(2, 132, 199, 0.2); border: 1px solid #0284c7; padding: 6px 12px; border-radius: 6px; font-size: 13px; color: #bae6fd;">
                    ✓ ${t}
                </span>
            `).join('');
        }

        if (questsList && Array.isArray(p.completed_quests) && p.completed_quests.length > 0) {
            questsList.innerHTML = p.completed_quests.map(q => `
                <div style="background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #86efac; display: flex; align-items: center; gap: 8px;">
                    <span>🎖️</span> <strong>${q}</strong> — Задание успешно защищено!
                </div>
            `).join('');
        }
    }
}
