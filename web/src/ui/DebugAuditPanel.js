/**
 * DebugAuditPanel.js
 * Панель аудита для жюри и отладки команды.
 * Визуализирует соблюдение правила ТЗ: «Клиент кэширует не более 10% общих данных мира».
 */
export class DebugAuditPanel {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;

        this.fps = 60;
        this.frames = 0;
        this.lastTime = performance.now();

        this._createDOM();
    }

    _createDOM() {
        const container = document.createElement('div');
        container.id = 'debug-audit-panel';
        container.innerHTML = `
            <div class="audit-header">
                <span class="audit-title">АУДИТ КЭША МИРА (ТЗ &le; 10%)</span>
                <span class="audit-badge" id="audit-badge">0.0%</span>
            </div>

            <div class="audit-meter-bar">
                <div class="audit-meter-fill" id="audit-meter-fill" style="width: 0%;"></div>
                <div class="audit-meter-threshold" title="Порог 10% ТЗ"></div>
            </div>

            <div class="audit-stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Мир W (несжатый):</span>
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
                    <span class="stat-label">Текущий чанк:</span>
                    <span class="stat-val" id="audit-stat-curchunk">[0, 0]</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Кадры в секунду:</span>
                    <span class="stat-val" id="audit-stat-fps">60 FPS</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Счетчик выгрузок:</span>
                    <span class="stat-val" id="audit-stat-evictions" style="color: #58a6ff;">0</span>
                </div>
            </div>

            <div class="audit-controls">
                <button class="audit-btn" id="audit-btn-test-eviction">Тест смены чанка (LRU)</button>
            </div>
        `;

        document.getElementById('ui-container').appendChild(container);

        this.badge = document.getElementById('audit-badge');
        this.meterFill = document.getElementById('audit-meter-fill');
        this.statW = document.getElementById('audit-stat-w');
        this.statC = document.getElementById('audit-stat-c');
        this.statChunks = document.getElementById('audit-stat-chunks');
        this.statCurChunk = document.getElementById('audit-stat-curchunk');
        this.statFps = document.getElementById('audit-stat-fps');
        this.statEvictions = document.getElementById('audit-stat-evictions');
        this.evictionCounter = 0;

        // Кнопка для быстрой проверки жюри
        document.getElementById('audit-btn-test-eviction').addEventListener('click', () => {
            if (this.onTestEvictionRequested) {
                this.onTestEvictionRequested();
            }
        });
    }

    /**
     * Покадровый подсчет FPS и обновление данных на панели
     */
    update() {
        this.frames++;
        const now = performance.now();

        if (now - this.lastTime >= 500) { // обновление дважды в секунду
            this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
            this.frames = 0;
            this.lastTime = now;
            this._refreshData();
        }
    }

    _refreshData() {
        const m = this.chunkManager.getMetrics();
        const percent = m.percent;

        const wMB = (m.W / 1048576).toFixed(1);
        const cMB = (m.C / 1048576).toFixed(1);

        this.badge.textContent = `${percent}%`;
        this.meterFill.style.width = `${Math.min(percent * 10, 100)}%`; // 10% = 100% шкалы

        // Цветовая маркировка по ТЗ
        if (percent <= 8.0) {
            this.badge.style.backgroundColor = '#238636'; // зеленый (в рамках рабочего бюджета)
            this.meterFill.style.backgroundColor = '#2ea043';
        } else if (percent <= 10.0) {
            this.badge.style.backgroundColor = '#d29922'; // оранжевый (приближение к пределу)
            this.meterFill.style.backgroundColor = '#e3b341';
        } else {
            this.badge.style.backgroundColor = '#da3633'; // красный (нарушение ТЗ)
            this.meterFill.style.backgroundColor = '#f85149';
        }

        this.statW.textContent = `${wMB} МБ`;
        this.statC.textContent = `${cMB} МБ`;
        this.statChunks.textContent = `${m.loadedChunksCount} / 100`;
        this.statCurChunk.textContent = `[${m.currentChunkCoord.cx}, ${m.currentChunkCoord.cz}]`;
        this.statFps.textContent = `${this.fps} FPS`;
    }

    registerEviction() {
        this.evictionCounter++;
        if (this.statEvictions) {
            this.statEvictions.textContent = this.evictionCounter;
        }
    }
}
