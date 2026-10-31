/**
 * SoundEffects.js
 * Синтезатор процедурных звуковых эффектов для станции «Последний экипаж».
 * Работает 100% оффлайн на базе нативного Web Audio API браузера,
 * не требуя внешних mp3/wav файлов или сетевой загрузки.
 */
class SoundEffectsManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    _initContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Мягкий футуристичный клик при нажатии кнопок и чипов
     */
    playClick() {
        if (!this.enabled) return;
        try {
            this._initContext();
            if (!this.ctx) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.05);
        } catch (e) {
            // Audio context not allowed before user gesture
        }
    }

    /**
     * Двухтоновый сигнал связи при получении ответа от ИИ-агента
     */
    playIncomingTransmission() {
        if (!this.enabled) return;
        try {
            this._initContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880.00, now + 0.08); // A5

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {}
    }

    /**
     * Предупреждающий сигнал тревоги (при обрыве связи или критической телеметрии)
     */
    playAlert() {
        if (!this.enabled) return;
        try {
            this._initContext();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {}
    }
}

export const SoundFX = new SoundEffectsManager();
