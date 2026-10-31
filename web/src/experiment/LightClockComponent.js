/**
 * LightClockComponent.js
 * Интерактивный пульт управления физическим экспериментом СТО «Релятивистские световые часы» (Stage 5).
 * Позволяет:
 * - Задавать субсветовую скорость вагона/станции v от 0.0c до 0.8c.
 * - Переключать роль наблюдателя: station_observer (на движущейся станции) vs lab_observer (в лаборатории).
 * - Рассчитывать релятивистский фактор Лоренца: γ = 1 / √(1 - v²/c²).
 * - Синхронизировать параметры по WebSocket (event 'experiment.update' / 'experiment.state').
 */
export class LightClockComponent {
    constructor(network, onClose) {
        this.network = network;
        this.onClose = onClose;
        this.isOpen = false;

        this.velocity = 0.6; // canonical v = 0.6c -> gamma = 1.25
        this.role = 'station_observer';
        this.gamma = 1.25;

        this._createDOM();
        this._initListeners();
    }

    _createDOM() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'light-clock-modal-overlay';
        this.overlay.className = 'modal-backdrop hidden';
        this.overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(5, 8, 17, 0.85);
            backdrop-filter: blur(10px); z-index: 1000;
            display: flex; align-items: center; justify-content: center;
        `;

        this.overlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #091e3a 0%, #0f172a 100%);
                border: 2px solid #38bdf8;
                border-radius: 12px;
                box-shadow: 0 0 40px rgba(56, 189, 248, 0.4);
                width: 90%; max-width: 680px;
                color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    background: rgba(15, 23, 42, 0.95);
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(56, 189, 248, 0.3);
                    display: flex; align-items: center; justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 26px;">⏱️</span>
                        <div>
                            <div style="font-weight: 700; font-size: 18px; color: #38bdf8; text-transform: uppercase;">
                                Релятивистские световые часы (СТО)
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                Мысленный эксперимент Эйнштейна • Лоренцево замедление времени
                            </div>
                        </div>
                    </div>
                    <button id="clock-close-btn" style="
                        background: none; border: none; color: #94a3b8; font-size: 24px;
                        cursor: pointer; padding: 4px 8px; line-height: 1;
                    ">✕</button>
                </div>

                <!-- Body -->
                <div style="padding: 24px;">
                    <!-- Visual Scheme -->
                    <div style="
                        background: #020617; border: 1px solid #1e293b; border-radius: 8px;
                        padding: 16px; margin-bottom: 20px; text-align: center;
                    ">
                        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;">
                            Траектория фотона между параллельными зеркалами:
                        </div>
                        <div style="display: flex; justify-content: space-around; align-items: center; height: 110px;">
                            <div style="border: 1px dashed #0284c7; padding: 10px; border-radius: 6px; width: 45%;">
                                <div style="font-size: 11px; color: #38bdf8; font-weight: 600;">Покоящийся вагон (Δt₀)</div>
                                <div style="font-size: 20px; margin: 8px 0; color: #22c55e;">↕ Вертикальный луч</div>
                                <div style="font-size: 11px; color: #64748b;">Путь: 2L</div>
                            </div>
                            <div style="border: 1px dashed #f59e0b; padding: 10px; border-radius: 6px; width: 45%;">
                                <div style="font-size: 11px; color: #f59e0b; font-weight: 600;">Движение со скоростью v (Δt')</div>
                                <div style="font-size: 20px; margin: 8px 0; color: #eab308;">⤢ Диагональный зигзаг</div>
                                <div style="font-size: 11px; color: #64748b;">Путь: 2L · γ (длиннее!)</div>
                            </div>
                        </div>
                    </div>

                    <!-- Velocity Slider -->
                    <div style="margin-bottom: 22px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <label style="font-weight: 600; font-size: 14px; color: #e2e8f0;">
                                Скорость маневра v (в долях скорости света c):
                            </label>
                            <span id="clock-v-val" style="
                                font-size: 18px; font-weight: 700; color: #38bdf8;
                                background: #0f172a; padding: 2px 10px; border-radius: 4px; border: 1px solid #38bdf8;
                            ">0.60 c</span>
                        </div>
                        <input id="clock-v-slider" type="range" min="0" max="0.8" step="0.05" value="0.6" style="
                            width: 100%; accent-color: #38bdf8; cursor: pointer;
                        ">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 4px;">
                            <span>0.0c (Покой)</span>
                            <span style="color: #38bdf8;">0.60c (γ = 1.25)</span>
                            <span style="color: #f59e0b;">0.80c (γ = 1.6667)</span>
                        </div>
                    </div>

                    <!-- Role Switcher -->
                    <div style="margin-bottom: 22px;">
                        <label style="font-weight: 600; font-size: 14px; color: #e2e8f0; display: block; margin-bottom: 8px;">
                            Позиция наблюдателя:
                        </label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <button id="clock-role-station" style="
                                background: #0284c7; border: 1px solid #38bdf8; color: white;
                                padding: 10px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;
                            ">🚀 На движущейся станции (Mark Vens)</button>
                            <button id="clock-role-lab" style="
                                background: #1e293b; border: 1px solid #475569; color: #cbd5e1;
                                padding: 10px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;
                            ">🔬 В неподвижной лаборатории</button>
                        </div>
                    </div>

                    <!-- Relativistic Metrics Results -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 8px; padding: 14px;">
                            <div style="font-size: 12px; color: #94a3b8;">Фактор Лоренца (γ = 1/√(1-v²)):</div>
                            <div id="clock-gamma-val" style="font-size: 26px; font-weight: 700; color: #38bdf8; margin-top: 4px;">1.2500</div>
                        </div>
                        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 8px; padding: 14px;">
                            <div style="font-size: 12px; color: #94a3b8;">Замедление бортового времени:</div>
                            <div id="clock-dilation-val" style="font-size: 26px; font-weight: 700; color: #22c55e; margin-top: 4px;">+25.0%</div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="
                    background: rgba(15, 23, 42, 0.95);
                    padding: 14px 24px;
                    border-top: 1px solid rgba(56, 189, 248, 0.2);
                    display: flex; justify-content: space-between; align-items: center;
                ">
                    <span style="font-size: 12px; color: #64748b;">Параметры транслируются всем участникам в LAN</span>
                    <button id="clock-apply-btn" style="
                        background: #0284c7; border: none; color: white;
                        padding: 10px 24px; border-radius: 6px; font-weight: 700; cursor: pointer;
                    ">Применить маневр</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
    }

    _initListeners() {
        const closeBtn = document.getElementById('clock-close-btn');
        const applyBtn = document.getElementById('clock-apply-btn');
        const slider = document.getElementById('clock-v-slider');
        const roleStationBtn = document.getElementById('clock-role-station');
        const roleLabBtn = document.getElementById('clock-role-lab');

        closeBtn?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        slider?.addEventListener('input', (e) => {
            this.velocity = parseFloat(e.target.value);
            this._updateCalculations();
        });

        roleStationBtn?.addEventListener('click', () => {
            this.role = 'station_observer';
            roleStationBtn.style.background = '#0284c7';
            roleStationBtn.style.borderColor = '#38bdf8';
            roleLabBtn.style.background = '#1e293b';
            roleLabBtn.style.borderColor = '#475569';
        });

        roleLabBtn?.addEventListener('click', () => {
            this.role = 'lab_observer';
            roleLabBtn.style.background = '#0284c7';
            roleLabBtn.style.borderColor = '#38bdf8';
            roleStationBtn.style.background = '#1e293b';
            roleStationBtn.style.borderColor = '#475569';
        });

        applyBtn?.addEventListener('click', () => {
            this.applyExperiment();
        });

        // Слушатель событий от сервера
        this.network.on('experiment.state', (state) => {
            if (state && typeof state.velocity === 'number') {
                this.velocity = state.velocity;
                this.gamma = state.gamma;
                const s = document.getElementById('clock-v-slider');
                if (s) s.value = this.velocity;
                this._updateCalculations();
            }
        });
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        if (this.network.isConnected) {
            this.network.send('experiment.get', {});
        }
        this._updateCalculations();
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        if (this.onClose) this.onClose();
    }

    _updateCalculations() {
        const v = Math.min(0.8, Math.max(0.0, this.velocity));
        // Лоренц фактор gamma = 1 / sqrt(1 - v^2)
        this.gamma = 1.0 / Math.sqrt(1.0 - v * v);
        const dilationPct = (this.gamma - 1.0) * 100.0;

        const vVal = document.getElementById('clock-v-val');
        const gammaVal = document.getElementById('clock-gamma-val');
        const dilationVal = document.getElementById('clock-dilation-val');

        if (vVal) vVal.textContent = `${v.toFixed(2)} c`;
        if (gammaVal) gammaVal.textContent = this.gamma.toFixed(4);
        if (dilationVal) dilationVal.textContent = `+${dilationPct.toFixed(1)}%`;
    }

    applyExperiment() {
        if (this.network.isConnected) {
            this.network.send('experiment.update', {
                velocity: this.velocity,
                role: this.role
            });
        }
        this.close();
    }
}
