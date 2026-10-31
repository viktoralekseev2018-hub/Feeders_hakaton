/**
 * DebugAuditPanel.js
 * Панель аудита для жюри и отладки команды (Stage 8).
 * Визуализирует соблюдение правила ТЗ: «Клиент кэширует не более 10% общих данных мира (C/W <= 10%)».
 * Отображает:
 * - Живой процент кэша (зеленый <= 8%, желтый <= 10%, красный > 10%)
 * - FPS и Ping сети
 * - Кнопку запуска 5-минутного демонстрационного сценария для жюри.
 */
export class DebugAuditPanel {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;

        this.fps = 60;
        this.ping = 4; // ms in LAN
        this.frames = 0;
        this.lastTime = performance.now();

        this._createDOM();
    }

    _createDOM() {
        const container = document.createElement('div');
        container.id = 'debug-audit-panel';
        container.innerHTML = `
            <div class="audit-header">
                <span class="audit-title">АРБИТРАЖ ЖЮРИ (КЭШ C &le; 10% W)</span>
                <span class="audit-badge" id="audit-badge">0.0%</span>
            </div>

            <div class="audit-meter-bar">
                <div class="audit-meter-fill" id="audit-meter-fill" style="width: 0%;"></div>
                <div class="audit-meter-threshold" title="Лимит 10% ТЗ"></div>
            </div>

            <div class="audit-stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Мир W (канон):</span>
                    <span class="stat-val" id="audit-stat-w">125.8 МБ</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Кэш C (активный):</span>
                    <span class="stat-val" id="audit-stat-c">0.0 МБ</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Чанки в сцене:</span>
                    <span class="stat-val" id="audit-stat-chunks">0 / 100</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Текущий отсек:</span>
                    <span class="stat-val" id="audit-stat-curchunk">[0, 0]</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Кадры в сек (FPS):</span>
                    <span class="stat-val" id="audit-stat-fps">60 FPS</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">LAN Ping:</span>
                    <span class="stat-val" id="audit-stat-ping" style="color: #22c55e;">~4 мс</span>
                </div>
            </div>

            <div class="audit-controls" style="display: flex; gap: 8px; margin-top: 10px;">
                <button class="audit-btn" id="audit-btn-test-eviction" style="flex: 1;">Вытеснение LRU</button>
                <button class="audit-btn" id="audit-btn-demo" style="flex: 1.2; background: #0284c7; color: white;">▶ 5-мин Демо</button>
            </div>
        `;

        const uiContainer = document.getElementById('ui-container') || document.body;
        uiContainer.appendChild(container);

        this.badge = document.getElementById('audit-badge');
        this.meterFill = document.getElementById('audit-meter-fill');
        this.statW = document.getElementById('audit-stat-w');
        this.statC = document.getElementById('audit-stat-c');
        this.statChunks = document.getElementById('audit-stat-chunks');
        this.statCurChunk = document.getElementById('audit-stat-curchunk');
        this.statFps = document.getElementById('audit-stat-fps');
        this.statPing = document.getElementById('audit-stat-ping');
        this.statEvictions = document.getElementById('audit-stat-evictions');
        this.evictionCounter = 0;

        document.getElementById('audit-btn-test-eviction')?.addEventListener('click', () => {
            if (this.onTestEvictionRequested) this.onTestEvictionRequested();
        });

        document.getElementById('audit-btn-demo')?.addEventListener('click', () => {
            if (this.onDemoRequested) this.onDemoRequested();
        });
    }

    update() {
        this.frames++;
        const now = performance.now();

        if (now - this.lastTime >= 500) {
            this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
            this.frames = 0;
            this.lastTime = now;
            this._refreshData();
        }
    }

    _refreshData() {
        if (!this.chunkManager || !this.chunkManager.getMetrics) return;

        const m = this.chunkManager.getMetrics();
        const percent = m.percent;

        const wMB = (m.W / 1048576).toFixed(1);
        const cMB = (m.C / 1048576).toFixed(1);

        if (this.badge) this.badge.textContent = `${percent}%`;
        if (this.meterFill) this.meterFill.style.width = `${Math.min(percent * 10, 100)}%`;

        if (this.badge && this.meterFill) {
            if (percent <= 8.0) {
                this.badge.style.backgroundColor = '#16a34a';
                this.meterFill.style.backgroundColor = '#22c55e';
            } else if (percent <= 10.0) {
                this.badge.style.backgroundColor = '#d97706';
                this.meterFill.style.backgroundColor = '#f59e0b';
            } else {
                this.badge.style.backgroundColor = '#dc2626';
                this.meterFill.style.backgroundColor = '#ef4444';
            }
        }

        if (this.statW) this.statW.textContent = `${wMB} МБ`;
        if (this.statC) this.statC.textContent = `${cMB} МБ`;
        if (this.statChunks) this.statChunks.textContent = `${m.loadedChunksCount} / 100`;
        if (this.statCurChunk && m.currentChunkCoord) {
            this.statCurChunk.textContent = `[${m.currentChunkCoord.cx}, ${m.currentChunkCoord.cz}]`;
        }
        if (this.statFps) this.statFps.textContent = `${this.fps} FPS`;
    }

    setPing(ms) {
        this.ping = ms;
        if (this.statPing) {
            this.statPing.textContent = `${ms} мс`;
        }
    }

    registerEviction() {
        this.evictionCounter++;
        if (this.statEvictions) {
            this.statEvictions.textContent = this.evictionCounter;
        }
    }
}
