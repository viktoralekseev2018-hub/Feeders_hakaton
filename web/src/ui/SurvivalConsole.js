import { SoundFX } from '../audio/SoundEffects.js';

/**
 * SurvivalConsole.js
 * РРЅС‚РµСЂС„РµР№СЃ СѓРїСЂР°РІР»РµРЅРёСЏ РІС‹Р¶РёРІР°РЅРёРµРј РєРѕСЂР°Р±Р»СЏ В«Р“РѕСЂРёР·РѕРЅС‚-7В» РїРѕ СЃС†РµРЅР°СЂРёСЋ В«РџРѕСЃР»РµРґРЅРёР№ СЌРєРёРїР°Р¶В».
 * 
 * РџРѕРґРґРµСЂР¶РёРІР°РµС‚:
 * - РћС‚РѕР±СЂР°Р¶РµРЅРёРµ СЂРµСЃСѓСЂСЃРѕРІ (O2, Р­РЅРµСЂРіРёСЏ, РљРѕСЂРїСѓСЃ) Рё РёРіСЂРѕРІРѕРіРѕ С†РёРєР»Р° (1..8)
 * - РџСѓР»СЊС‚ РѕРїРµСЂР°С†РёР№ С†РёРєР»Р° (Р—Р°РїСѓСЃРє СЂРµР°РєС‚РѕСЂР°, РћС…Р»Р°Р¶РґРµРЅРёРµ, РћСЂР°РЅР¶РµСЂРµСЏ, Р‘Р°С‚Р°СЂРµСЏ, РђСЂС…РёРІ, РљСѓСЂСЃ, РћР¶РёРґР°РЅРёРµ)
 * - Р”РѕСЃС‚СѓРї Рє С„РёРЅР°Р»СЊРЅС‹Рј РјР°РЅС‘РІСЂР°Рј СЃРїР°СЃРµРЅРёСЏ
 * - РРЅС‚РµСЂР°РєС‚РёРІРЅС‹Р№ С‚РµСЂРјРёРЅР°Р» СЂР°СЃСЃР»РµРґРѕРІР°РЅРёСЏ Р°РІР°СЂРёРё (СЃРѕРїРѕСЃС‚Р°РІР»РµРЅРёРµ 3 РєР»СЋС‡РµРІС‹С… СѓР»РёРє)
 * - РџРµСЂРµРєР»СЋС‡РµРЅРёРµ СЂРѕР»РµР№ (РљР°РїРёС‚Р°РЅ, РРЅР¶РµРЅРµСЂ, Р‘РёРѕР»РѕРі, Р’СЃРµ СЂРѕР»Рё)
 * - 100% РѕС„С„Р»Р°Р№РЅ Р°РІС‚РѕРЅРѕРјРЅС‹Р№ СЂРµР¶РёРј РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ СЃРµСЂРІРµСЂРѕРј
 */
export class SurvivalConsole {
    constructor(network, onModalsClosedCallback = null) {
        this.onModalsClosed = onModalsClosedCallback;
        this.network = network;
        this.currentRole = 'all'; // 'all' | 'captain' | 'engineer' | 'biologist'

        // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РїРѕ СЃС†РµРЅР°СЂРёСЋ (O=64, E=35, H=70, Cycle=1..8)
        this.state = {
            cycle: 1,
            max_cycles: 8,
            oxygen: 64,
            energy: 35,
            hull: 70,
            reactor_active: false,
            cooling_repaired: false,
            greenhouse_active: false,
            battery_available: true,
            course_calculated: false,
            archive_restored: false,
            investigation_solved: false,
            game_over: false,
            victory: false,
            victory_type: 'none',
            unlocked_clues: ['temp_spike', 'no_infection'],
            logs: ['РђРЎРўР Рђ: РџСЂРѕР±СѓР¶РґРµРЅРёРµ СЌРєРёРїР°Р¶Р°. РљРѕСЂР°Р±Р»СЊ РЅР° Р°РІР°СЂРёР№РЅРѕР№ С‚СЂР°РµРєС‚РѕСЂРёРё. РћСЃС‚Р°Р»РѕСЃСЊ 8 С†РёРєР»РѕРІ.']
        };

        this.clueMetadata = {
            temp_spike: {
                id: 'temp_spike',
                title: 'РўРµРјРїРµСЂР°С‚СѓСЂРЅС‹Р№ СЃРєР°С‡РѕРє',
                source: 'РРЅР¶РµРЅРµСЂРЅР°СЏ С‚РµР»РµРјРµС‚СЂРёСЏ',
                desc: 'РџРµСЂРµРіСЂРµРІ РєРѕРЅС‚СѓСЂР° РЅР°С‡Р°Р»СЃСЏ Р”Рћ РѕС‚РєР»СЋС‡РµРЅРёСЏ РѕСЃРІРµС‰РµРЅРёСЏ РѕСЂР°РЅР¶РµСЂРµРё.',
                isKey: false
            },
            no_infection: {
                id: 'no_infection',
                title: 'Р§РёСЃС‚С‹Рµ Р±РёРѕРїСЂРѕР±С‹',
                source: 'Р›Р°Р±РѕСЂР°С‚РѕСЂРёСЏ Р±РёРѕР»РѕРіР°',
                desc: 'РЁС‚Р°РјРјС‹ С…Р»РѕСЂРµР»Р»С‹ Р·РґРѕСЂРѕРІС‹. РЈРІСЏРґР°РЅРёРµ РІС‹Р·РІР°РЅРѕ РѕР±РµСЃС‚РѕС‡РёРІР°РЅРёРµРј С„РёС‚РѕР»Р°РјРї, Р° РЅРµ Р·Р°СЂР°Р¶РµРЅРёРµРј.',
                isKey: false
            },
            damaged_filter: {
                id: 'damaged_filter',
                title: 'РњРµС‚Р°Р»Р»РёС‡РµСЃРєРёР№ РѕСЃРєРѕР»РѕРє РІ С„РёР»СЊС‚СЂРµ',
                source: 'Р РµРјРѕРЅС‚ РѕС…Р»Р°Р¶РґРµРЅРёСЏ',
                desc: 'Р’ С„РёР»СЊС‚СЂРµ РѕР±РЅР°СЂСѓР¶РµРЅ РїРѕСЃС‚РѕСЂРѕРЅРЅРёР№ РјРµС‚Р°Р»Р»РёС‡РµСЃРєРёР№ С„СЂР°РіРјРµРЅС‚ РѕС‚ РІРЅРµС€РЅРµРіРѕ СѓРґР°СЂР°.',
                isKey: true
            },
            impact_mark: {
                id: 'impact_mark',
                title: 'РћС‚РјРµС‚РєР° РІРЅРµС€РЅРµРіРѕ СѓРґР°СЂР°',
                source: 'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹Р№ Р°СЂС…РёРІ',
                desc: 'Р”Р°С‚С‡РёРє РѕР±С€РёРІРєРё Р·Р°С„РёРєСЃРёСЂРѕРІР°Р» РїРѕРїР°РґР°РЅРёРµ РјРёРєСЂРѕРјРµС‚РµРѕСЂРёС‚Р° РІ СЂР°РґРёР°С‚РѕСЂ Р·Р° СЃРµРєСѓРЅРґС‹ РґРѕ РїРµСЂРµРіСЂРµРІР°.',
                isKey: true
            },
            protective_chronology: {
                id: 'protective_chronology',
                title: 'Р—Р°С‰РёС‚РЅР°СЏ С…СЂРѕРЅРѕР»РѕРіРёСЏ РђРЎРўР Р«',
                source: 'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹Р№ Р°СЂС…РёРІ',
                desc: 'РђРЎРўР Рђ РѕС‚РєР»СЋС‡РёР»Р° РѕСЂР°РЅР¶РµСЂРµСЋ РєР°Рє Р·Р°С‰РёС‚РЅСѓСЋ РјРµСЂСѓ СЃР±СЂРѕСЃР° РЅР°РіСЂСѓР·РєРё РґР»СЏ СЃРїР°СЃРµРЅРёСЏ СЂРµР°РєС‚РѕСЂР°.',
                isKey: true
            }
        };

        this.isActionModalOpen = false;
        this.isInvestigationModalOpen = false;

        this._createDOM();
        this._initListeners();
        this._initNetworkListeners();
        this._render();
    }

    _createDOM() {
        // РљРѕРЅС‚РµР№РЅРµСЂ РІРµСЂС…РЅРµРіРѕ СЃС‚Р°С‚СѓСЃ-Р±Р°СЂР° С†РёРєР»РѕРІ Рё СЂРµСЃСѓСЂСЃРѕРІ
        this.topBar = document.createElement('div');
        this.topBar.id = 'survival-top-bar';
        this.topBar.className = 'survival-top-bar';
        this.topBar.innerHTML = `
            <div class="survival-status-card">
                <div class="survival-cycle-box">
                    <span class="cycle-title">РџР РћРўРћРљРћР› Р’Р«Р–РР’РђРќРРЇ</span>
                    <span class="cycle-val" id="survival-cycle-label">Р¦РРљР› 1 / 8</span>
                    <div class="cycle-dots" id="survival-cycle-dots"></div>
                </div>

                <div class="survival-meters">
                    <div class="survival-meter" title="РљРёСЃР»РѕСЂРѕРґ O: РїСЂРё <=0 СЌРєРёРїР°Р¶ РїРѕРіРёР±Р°РµС‚">
                        <div class="meter-header">
                            <span class="meter-icon">рџ«Ѓ</span>
                            <span class="meter-name">РљРРЎР›РћР РћР” Oв‚‚</span>
                            <span class="meter-val" id="val-o2">64%</span>
                        </div>
                        <div class="meter-bar-bg"><div class="meter-bar-fill o2" id="fill-o2" style="width: 64%;"></div></div>
                    </div>

                    <div class="survival-meter" title="Р­РЅРµСЂРіРёСЏ E: РїСЂРё <=0 РѕС‚РєР°Р· СѓРїСЂР°РІР»РµРЅРёСЏ">
                        <div class="meter-header">
                            <span class="meter-icon">вљЎ</span>
                            <span class="meter-name">Р­РќР•Р Р“РРЇ</span>
                            <span class="meter-val" id="val-energy">35%</span>
                        </div>
                        <div class="meter-bar-bg"><div class="meter-bar-fill energy" id="fill-energy" style="width: 35%;"></div></div>
                    </div>

                    <div class="survival-meter" title="РљРѕСЂРїСѓСЃ H: РїСЂРё <=0 СЂР°Р·СЂСѓС€РµРЅРёРµ РєРѕСЂР°Р±Р»СЏ">
                        <div class="meter-header">
                            <span class="meter-icon">рџ›ЎпёЏ</span>
                            <span class="meter-name">РљРћР РџРЈРЎ</span>
                            <span class="meter-val" id="val-hull">70%</span>
                        </div>
                        <div class="meter-bar-bg"><div class="meter-bar-fill hull" id="fill-hull" style="width: 70%;"></div></div>
                    </div>
                </div>

                <div class="survival-badges-row">
                    <span class="sys-badge" id="badge-reactor">Р Р•РђРљРўРћР : Р’Р«РљР›</span>
                    <span class="sys-badge danger" id="badge-cooling">РћРҐР›РђР–Р”Р•РќРР•: РџР РћР‘РРўРћ</span>
                    <span class="sys-badge" id="badge-greenhouse">РћР РђРќР–Р•Р Р•РЇ: Р’Р«РљР›</span>
                    <span class="sys-badge active" id="badge-battery">Р‘РђРўРђР Р•РЇ: Р“РћРўРћР’Рђ</span>
                    <span class="sys-badge" id="badge-investigation">Р РђРЎРЎР›Р•Р”РћР’РђРќРР•: 0/3</span>
                </div>

                <div class="survival-buttons-row">
                    <button class="survival-btn primary" id="btn-open-actions">вљЎ РџСѓР»СЊС‚ РѕРїРµСЂР°С†РёР№ [C]</button>
                    <button class="survival-btn secondary" id="btn-open-investigation">рџ”Ќ РЈР»РёРєРё Р°РІР°СЂРёРё [I]</button>
                    <div class="role-selector">
                        <button class="role-tab active" data-role="all">Р’СЃРµ</button>
                        <button class="role-tab" data-role="captain">РљР°РїРёС‚Р°РЅ</button>
                        <button class="role-tab" data-role="engineer">РРЅР¶РµРЅРµСЂ</button>
                        <button class="role-tab" data-role="biologist">Р‘РёРѕР»РѕРі</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.topBar);

        // РњРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ РїСѓР»СЊС‚Р° РѕРїРµСЂР°С†РёР№ С†РёРєР»Р°
        this.actionModal = document.createElement('div');
        this.actionModal.id = 'survival-action-modal';
        this.actionModal.className = 'modal-overlay hidden';
        this.actionModal.innerHTML = `
            <div class="survival-card action-card">
                <div class="survival-modal-header">
                    <h2>РџРЈР›Р¬Рў РћРџР•Р РђР¦РР™ Р¦РРљР›Рђ</h2>
                    <button class="modal-close-btn" id="close-action-modal">&times;</button>
                </div>
                <p class="modal-subtitle">РљР°РїРёС‚Р°РЅ РїРѕРґС‚РІРµСЂР¶РґР°РµС‚ РѕРґРЅСѓ РѕР±С‰СѓСЋ РѕРїРµСЂР°С†РёСЋ С†РёРєР»Р°. РР·СѓС‡РёС‚Рµ С†РµРЅСѓ Рё РїСЂРѕРіРЅРѕР· СЂРµСЃСѓСЂСЃРѕРІ.</p>

                <div class="actions-grid" id="actions-grid">
                    <!-- Р—Р°РїРѕР»РЅСЏРµС‚СЃСЏ РґРёРЅР°РјРёС‡РµСЃРєРё -->
                </div>

                <div class="final-maneuvers-section" id="final-maneuvers-section">
                    <h3>Р¤РРќРђР›Р¬РќР«Р• РњРђРќРЃР’Р Р« РЎРџРђРЎР•РќРРЇ</h3>
                    <div class="maneuvers-grid" id="maneuvers-grid">
                        <!-- Р—Р°РїРѕР»РЅСЏРµС‚СЃСЏ РґРёРЅР°РјРёС‡РµСЃРєРё -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.actionModal);

        // РњРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ СЂР°СЃСЃР»РµРґРѕРІР°РЅРёСЏ Р°РІР°СЂРёРё
        this.investigationModal = document.createElement('div');
        this.investigationModal.id = 'survival-investigation-modal';
        this.investigationModal.className = 'modal-overlay hidden';
        this.investigationModal.innerHTML = `
            <div class="survival-card investigation-card">
                <div class="survival-modal-header">
                    <h2>Р РђРЎРЎР›Р•Р”РћР’РђРќРР• РџР РР§РРќ РђР’РђР РР</h2>
                    <button class="modal-close-btn" id="close-investigation-modal">&times;</button>
                </div>
                <p class="modal-subtitle">РЎРѕРїРѕСЃС‚Р°РІСЊС‚Рµ 3 РєР»СЋС‡РµРІС‹С… С„Р°РєС‚Р°, С‡С‚РѕР±С‹ СѓСЃС‚Р°РЅРѕРІРёС‚СЊ РёСЃС‚РёРЅРЅСѓСЋ РїСЂРёС‡РёРЅСѓ Р°РІР°СЂРёРё Рё СЃРЅСЏС‚СЊ РїРѕРґРѕР·СЂРµРЅРёСЏ СЃ РР РђРЎРўР Рђ.</p>

                <div class="clues-list" id="clues-list">
                    <!-- Р—Р°РїРѕР»РЅСЏРµС‚СЃСЏ РґРёРЅР°РјРёС‡РµСЃРєРё -->
                </div>

                <div class="investigation-footer">
                    <div class="investigation-feedback" id="investigation-feedback">Р’С‹Р±РµСЂРёС‚Рµ 3 СѓР»РёРєРё РґР»СЏ РїСЂРѕРІРµСЂРєРё РІРµСЂСЃРёРё.</div>
                    <button class="survival-btn primary" id="btn-submit-hypothesis">РџРѕРґС‚РІРµСЂРґРёС‚СЊ РІРµСЂСЃРёСЋ СЌРєРёРїР°Р¶Р°</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.investigationModal);

        // РћРєРЅРѕ С„РёРЅР°Р»Р° (РџРѕР±РµРґР° / РџРѕСЂР°Р¶РµРЅРёРµ)
        this.gameOverOverlay = document.createElement('div');
        this.gameOverOverlay.id = 'survival-gameover-modal';
        this.gameOverOverlay.className = 'modal-overlay hidden';
        this.gameOverOverlay.innerHTML = `
            <div class="survival-card gameover-card" id="gameover-card">
                <div class="gameover-badge" id="gameover-badge">РџР РћРўРћРљРћР› Р’Р«Р–РР’РђРќРРЇ</div>
                <h1 class="gameover-title" id="gameover-title">РњРРЎРЎРРЇ Р—РђР’Р•Р РЁР•РќРђ</h1>
                <p class="gameover-desc" id="gameover-desc"></p>
                <div class="gameover-stats" id="gameover-stats"></div>
                <button class="survival-btn primary" id="btn-restart-game">РќР°С‡Р°С‚СЊ Р·Р°РЅРѕРІРѕ</button>
            </div>
        `;
        document.body.appendChild(this.gameOverOverlay);
    }

    _initListeners() {
        // РљРЅРѕРїРєРё РѕС‚РєСЂС‹С‚РёСЏ РјРѕРґР°Р»РѕРє
        document.getElementById('btn-open-actions').addEventListener('click', () => {
            this.openActionModal();
        });

        document.getElementById('btn-open-investigation').addEventListener('click', () => {
            this.openInvestigationModal();
        });

        // Р—Р°РєСЂС‹С‚РёРµ РјРѕРґР°Р»РѕРє
        document.getElementById('close-action-modal').addEventListener('click', () => {
            this.closeModals();
        });

        document.getElementById('close-investigation-modal').addEventListener('click', () => {
            this.closeModals();
        });

        // Р“РѕСЂСЏС‡РёРµ РєР»Р°РІРёС€Рё [C] Рё [I]
        window.addEventListener('keydown', (e) => {
            // РРіРЅРѕСЂРёСЂСѓРµРј РІРІРѕРґ РІ С‚РµРєСЃС‚РѕРІС‹С… РїРѕР»СЏС… РґРёР°Р»РѕРіР°
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'KeyC') {
                if (this.isActionModalOpen) {
                    this.closeModals();
                } else {
                    this.openActionModal();
                }
            } else if (e.code === 'KeyI') {
                if (this.isInvestigationModalOpen) {
                    this.closeModals();
                } else {
                    this.openInvestigationModal();
                }
            } else if (e.code === 'Escape') {
                this.closeModals();
            }
        });

        // РџРµСЂРµРєР»СЋС‡Р°С‚РµР»Рё СЂРѕР»РµР№
        const roleTabs = this.topBar.querySelectorAll('.role-tab');
        roleTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                roleTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentRole = tab.dataset.role;
                SoundFX.playClick();
                this._renderActionsGrid();
            });
        });

        // РџСЂРѕРІРµСЂРєР° СЂР°СЃСЃР»РµРґРѕРІР°РЅРёСЏ
        document.getElementById('btn-submit-hypothesis').addEventListener('click', () => {
            this._submitInvestigation();
        });

        // РџРµСЂРµР·Р°РїСѓСЃРє РїР°СЂС‚РёРё
        document.getElementById('btn-restart-game').addEventListener('click', () => {
            window.location.reload();
        });
    }

    _initNetworkListeners() {
        if (!this.network) return;

        // РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РѕР±С‰РµРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРѕСЂР°Р±Р»СЏ РѕС‚ Go-СЃРµСЂРІРµСЂР°
        this.network.on('game.state', (state) => {
            this.state = state;
            this._render();
        });

        this.network.on('investigation.result', (res) => {
            const feedback = document.getElementById('investigation-feedback');
            if (feedback) {
                feedback.textContent = res.message;
                feedback.className = `investigation-feedback ${res.solved ? 'success' : 'warn'}`;
            }
            if (res.solved) {
                SoundFX.playIncomingTransmission();
            } else {
                SoundFX.playAlert();
            }
        });
    }

    openActionModal() {
        this.closeModals();
        this.isActionModalOpen = true;
        this._renderActionsGrid();
        this._renderManeuversGrid();
        this.actionModal.classList.remove('hidden');
        SoundFX.playClick();
    }

    openInvestigationModal() {
        this.closeModals();
        this.isInvestigationModalOpen = true;
        this._renderCluesList();
        this.investigationModal.classList.remove('hidden');
        SoundFX.playClick();
    }

    closeModals() {
        this.isActionModalOpen = false;
        this.isInvestigationModalOpen = false;
        this.actionModal.classList.add('hidden');
        this.investigationModal.classList.add('hidden');
        SoundFX.playClick();
    }

    /**
     * Р’С‹РїРѕР»РЅРµРЅРёРµ РѕРїРµСЂР°С†РёРё С†РёРєР»Р° С‡РµСЂРµР· WebSocket РёР»Рё Р»РѕРєР°Р»СЊРЅС‹Р№ Р°РІС‚РѕРЅРѕРјРЅС‹Р№ РґРІРёР¶РѕРє
     */
    executeAction(actionKey) {
        SoundFX.playClick();

        if (this.network && this.network.isConnected) {
            this.network.send('game.action', { action: actionKey });
            this.closeModals();
            return;
        }

        // РћР¤Р¤Р›РђР™Рќ Р›РћРљРђР›Р¬РќРђРЇ РЎРРњРЈР›РЇР¦РРЇ (РµСЃР»Рё Wi-Fi РІС‹РєР»СЋС‡РµРЅ)
        this._executeLocalAction(actionKey);
        this.closeModals();
    }

    _executeLocalAction(actionKey) {
        const s = this.state;
        if (s.game_over) return;

        switch (actionKey) {
            case 'start_reactor':
                if (s.energy < 8) return;
                s.energy -= 8;
                s.reactor_active = true;
                s.logs.push(`Р¦РёРєР» ${s.cycle}: Р—Р°РїСѓС‰РµРЅ СЂРµР°РєС‚РѕСЂ (-8 E).`);
                this._localAdvanceCycle();
                break;

            case 'repair_cooling':
                if (s.energy < 6) return;
                s.energy -= 6;
                s.cooling_repaired = true;
                if (!s.unlocked_clues.includes('damaged_filter')) {
                    s.unlocked_clues.push('damaged_filter');
                }
                s.logs.push(`Р¦РёРєР» ${s.cycle}: РћС‚СЂРµРјРѕРЅС‚РёСЂРѕРІР°РЅРѕ РѕС…Р»Р°Р¶РґРµРЅРёРµ (-6 E). РќР°Р№РґРµРЅ РѕСЃРєРѕР»РѕРє РјРµС‚РµРѕСЂРёС‚Р° РІ С„РёР»СЊС‚СЂРµ!`);
                this._localAdvanceCycle();
                break;

            case 'start_greenhouse':
                if (s.energy < 12) return;
                s.energy -= 12;
                s.greenhouse_active = true;
                s.logs.push(`Р¦РёРєР» ${s.cycle}: Р—Р°РїСѓС‰РµРЅР° РѕСЂР°РЅР¶РµСЂРµСЏ (-12 E).`);
                this._localAdvanceCycle();
                break;

            case 'use_battery':
                if (!s.battery_available) return;
                s.battery_available = false;
                s.energy = Math.min(100, s.energy + 25);
                s.logs.push(`Р¦РёРєР» ${s.cycle}: РџРѕРґРєР»СЋС‡РµРЅР° Р±Р°С‚Р°СЂРµСЏ (+25 E).`);
                break;

            case 'restore_archive':
                if (s.energy < 2) return;
                s.energy -= 2;
                s.archive_restored = true;
                if (!s.unlocked_clues.includes('impact_mark')) s.unlocked_clues.push('impact_mark');
                if (!s.unlocked_clues.includes('protective_chronology')) s.unlocked_clues.push('protective_chronology');
                s.logs.push(`Р¦РёРєР» ${s.cycle}: РђСЂС…РёРІ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅ (-2 E).`);
                this._localAdvanceCycle();
                break;

            case 'calculate_course':
                if (s.energy < 4) return;
                s.energy -= 4;
                s.course_calculated = true;
                s.logs.push(`Р¦РёРєР» ${s.cycle}: РљСѓСЂСЃ СЂР°СЃСЃС‡РёС‚Р°РЅ (-4 E).`);
                this._localAdvanceCycle();
                break;

            case 'wait_cycle':
                s.logs.push(`Р¦РёРєР» ${s.cycle}: РћР¶РёРґР°РЅРёРµ Р±РµР· РѕРїРµСЂР°С†РёР№.`);
                this._localAdvanceCycle();
                break;

            case 'final_combined':
                if (!s.reactor_active || !s.cooling_repaired || !s.battery_available) return;
                s.energy -= 10;
                s.oxygen -= 12;
                s.hull -= 5;
                s.battery_available = false;
                s.game_over = true;
                s.victory = true;
                s.victory_type = 'safe_orbit';
                break;

            case 'final_emergency':
                if (!s.reactor_active || s.energy < 22) return;
                s.energy -= 22;
                s.hull -= s.cooling_repaired ? 10 : 45;
                s.game_over = true;
                s.victory = s.hull >= 25;
                s.victory_type = s.hull >= 25 ? 'safe_orbit' : 'failed';
                break;

            case 'final_ecosystem':
                s.energy -= 16;
                s.game_over = true;
                s.victory = true;
                s.victory_type = 'safe_orbit';
                break;

            case 'final_evacuation':
                s.energy -= 4;
                s.oxygen -= 6;
                s.game_over = true;
                s.victory = true;
                s.victory_type = 'evacuated';
                break;
        }

        this._render();
    }

    _localAdvanceCycle() {
        const s = this.state;
        if (s.game_over) return;

        // Р­РЅРµСЂРіРёСЏ О”E = 8R - 4 - 3G
        let dE = -4;
        if (s.reactor_active) dE += 8;
        if (s.greenhouse_active) dE -= 3;
        s.energy = Math.max(0, Math.min(100, s.energy + dE));

        // РљРёСЃР»РѕСЂРѕРґ О”O = -3 (РѕСЂР°РЅР¶РµСЂРµСЏ) РёР»Рё -8
        const dO = s.greenhouse_active ? -3 : -8;
        s.oxygen = Math.max(0, Math.min(100, s.oxygen + dO));

        // РљРѕСЂРїСѓСЃ: РµСЃР»Рё СЂРµР°РєС‚РѕСЂ Р±РµР· РѕС…Р»Р°Р¶РґРµРЅРёСЏ -12 H
        if (s.reactor_active && !s.cooling_repaired) {
            s.hull = Math.max(0, s.hull - 12);
        }

        if (s.oxygen <= 0 || s.energy <= 0 || s.hull <= 0) {
            s.game_over = true;
            s.victory = false;
            s.victory_type = 'failed';
            return;
        }

        s.cycle++;
        if (s.cycle > s.max_cycles) {
            s.game_over = true;
            s.victory = false;
            s.victory_type = 'failed';
        }
    }

    _submitInvestigation() {
        const checkedClues = [];
        const checkboxes = document.querySelectorAll('.clue-checkbox:checked');
        checkboxes.forEach(cb => checkedClues.push(cb.value));

        if (checkedClues.length !== 3) {
            const fb = document.getElementById('investigation-feedback');
            fb.textContent = `Р’С‹Р±РµСЂРёС‚Рµ СЂРѕРІРЅРѕ 3 РєР»СЋС‡РµРІС‹С… С„Р°РєС‚Р° (СЃРµР№С‡Р°СЃ РІС‹Р±СЂР°РЅРѕ: ${checkedClues.length})`;
            fb.className = 'investigation-feedback warn';
            SoundFX.playAlert();
            return;
        }

        if (this.network && this.network.isConnected) {
            this.network.send('investigation.solve', { clues: checkedClues });
            return;
        }

        // РћС„С„Р»Р°Р№РЅ РїСЂРѕРІРµСЂРєР°
        const hasFilter = checkedClues.includes('damaged_filter');
        const hasImpact = checkedClues.includes('impact_mark');
        const hasChronology = checkedClues.includes('protective_chronology');

        const fb = document.getElementById('investigation-feedback');
        if (hasFilter && hasImpact && hasChronology) {
            this.state.investigation_solved = true;
            fb.textContent = 'РџСЂРёС‡РёРЅР° Р°РІР°СЂРёРё РїРѕРґС‚РІРµСЂР¶РґРµРЅР°! РњРёРєСЂРѕРјРµС‚РµРѕСЂРёС‚ РїСЂРѕР±РёР» СЂР°РґРёР°С‚РѕСЂ, СЃС‚СЂСѓР¶РєР° Р·Р°Р±РёР»Р° С„РёР»СЊС‚СЂ РѕС…Р»Р°Р¶РґРµРЅРёСЏ, Р° РђРЎРўР Рђ РІС‹РїРѕР»РЅРёР»Р° Р·Р°С‰РёС‚РЅРѕРµ РѕС‚РєР»СЋС‡РµРЅРёРµ РѕСЂР°РЅР¶РµСЂРµРё РґР»СЏ СЃРїР°СЃРµРЅРёСЏ СЂРµР°РєС‚РѕСЂР°.';
            fb.className = 'investigation-feedback success';
            SoundFX.playIncomingTransmission();
            this._render();
        } else {
            fb.textContent = 'Р’РµСЂСЃРёСЏ РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°. РўСЂРµР±СѓСЋС‚СЃСЏ РїСЂСЏРјС‹Рµ СѓР»РёРєРё РІРЅРµС€РЅРµРіРѕ СѓРґР°СЂР°, Р·Р°СЃРѕСЂР° С„РёР»СЊС‚СЂР° Рё Р·Р°С‰РёС‚РЅРѕРіРѕ РѕС‚РєР»СЋС‡РµРЅРёСЏ.';
            fb.className = 'investigation-feedback warn';
            SoundFX.playAlert();
        }
    }

    _render() {
        const s = this.state;

        // Р¦РёРєР»
        const cycleLabel = document.getElementById('survival-cycle-label');
        if (cycleLabel) {
            cycleLabel.textContent = `Р¦РРљР› ${s.cycle} / ${s.max_cycles}`;
        }

        const cycleDots = document.getElementById('survival-cycle-dots');
        if (cycleDots) {
            cycleDots.innerHTML = '';
            for (let i = 1; i <= s.max_cycles; i++) {
                const dot = document.createElement('span');
                dot.className = `cycle-dot ${i < s.cycle ? 'passed' : ''} ${i === s.cycle ? 'active' : ''}`;
                cycleDots.appendChild(dot);
            }
        }

        // Р§РёСЃР»РѕРІС‹Рµ РїРѕРєР°Р·Р°С‚РµР»Рё
        document.getElementById('val-o2').textContent = `${s.oxygen}%`;
        document.getElementById('val-energy').textContent = `${s.energy}%`;
        document.getElementById('val-hull').textContent = `${s.hull}%`;

        document.getElementById('fill-o2').style.width = `${s.oxygen}%`;
        document.getElementById('fill-energy').style.width = `${s.energy}%`;
        document.getElementById('fill-hull').style.width = `${s.hull}%`;

        // Р‘РµР№РґР¶Рё СЃРёСЃС‚РµРј
        const bReactor = document.getElementById('badge-reactor');
        bReactor.textContent = s.reactor_active ? 'Р Р•РђРљРўРћР : Р РђР‘РћРўРђР•Рў (+8 E)' : 'Р Р•РђРљРўРћР : Р’Р«РљР›';
        bReactor.className = `sys-badge ${s.reactor_active ? 'active' : ''}`;

        const bCooling = document.getElementById('badge-cooling');
        bCooling.textContent = s.cooling_repaired ? 'РћРҐР›РђР–Р”Р•РќРР•: РРЎРџР РђР’РќРћ' : 'РћРҐР›РђР–Р”Р•РќРР•: РџР РћР‘РРўРћ (-12 H)';
        bCooling.className = `sys-badge ${s.cooling_repaired ? 'active' : 'danger'}`;

        const bGreenhouse = document.getElementById('badge-greenhouse');
        bGreenhouse.textContent = s.greenhouse_active ? 'РћР РђРќР–Р•Р Р•РЇ: Р РђР‘РћРўРђР•Рў (Oв‚‚: -3)' : 'РћР РђРќР–Р•Р Р•РЇ: Р’Р«РљР› (Oв‚‚: -8)';
        bGreenhouse.className = `sys-badge ${s.greenhouse_active ? 'active' : ''}`;

        const bBattery = document.getElementById('badge-battery');
        bBattery.textContent = s.battery_available ? 'Р‘РђРўРђР Р•РЇ: Р“РћРўРћР’Рђ (+25 E)' : 'Р‘РђРўРђР Р•РЇ: РР—Р РђРЎРҐРћР”РћР’РђРќРђ';
        bBattery.className = `sys-badge ${s.battery_available ? 'active' : 'disabled'}`;

        const bInvest = document.getElementById('badge-investigation');
        bInvest.textContent = s.investigation_solved ? 'Р РђРЎРЎР›Р•Р”РћР’РђРќРР•: Р РђРЎРљР Р«РўРћ' : `РЈР›РРљР: ${s.unlocked_clues.length}/5`;
        bInvest.className = `sys-badge ${s.investigation_solved ? 'success' : ''}`;

        // Р­РєСЂР°РЅ РєРѕРЅС†Р° РёРіСЂС‹
        if (s.game_over) {
            this._showGameOverScreen();
        }
    }

    _renderActionsGrid() {
        const grid = document.getElementById('actions-grid');
        if (!grid) return;
        const s = this.state;

        const actions = [
            {
                key: 'start_reactor',
                title: 'Р—Р°РїСѓСЃС‚РёС‚СЊ СЂРµР°РєС‚РѕСЂ',
                cost: '8 E',
                available: !s.reactor_active && s.energy >= 8,
                desc: 'Р’РѕР·РѕР±РЅРѕРІР»СЏРµС‚ РІС‹СЂР°Р±РѕС‚РєСѓ +8 E Р·Р° С†РёРєР». Р”Рѕ СЂРµРјРѕРЅС‚Р° РѕС…Р»Р°Р¶РґРµРЅРёСЏ СЂРµР°РєС‚РѕСЂ РЅР°РіСЂРµРІР°РµС‚ РєРѕСЂРїСѓСЃ (-12 H).',
                role: 'engineer',
                tag: 'РРЅР¶РµРЅРµСЂ'
            },
            {
                key: 'repair_cooling',
                title: 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РѕС…Р»Р°Р¶РґРµРЅРёРµ',
                cost: '6 E',
                available: !s.cooling_repaired && s.energy >= 6,
                desc: 'РћС‡РёС‰Р°РµС‚ Р·Р°Р±РёС‚С‹Р№ РєРѕРЅС‚СѓСЂ Рё СѓСЃС‚СЂР°РЅСЏРµС‚ РїРѕРІСЂРµР¶РґРµРЅРёРµ РєРѕСЂРїСѓСЃР°. Р”Р°С‘С‚ СѓР»РёРєСѓ РїРѕРІСЂРµР¶РґС‘РЅРЅРѕРіРѕ С„РёР»СЊС‚СЂР°.',
                role: 'engineer',
                tag: 'РРЅР¶РµРЅРµСЂ'
            },
            {
                key: 'start_greenhouse',
                title: 'Р—Р°РїСѓСЃС‚РёС‚СЊ РѕСЂР°РЅР¶РµСЂРµСЋ',
                cost: '12 E',
                available: !s.greenhouse_active && s.energy >= 12,
                desc: 'Р’РєР»СЋС‡Р°РµС‚ РїРѕРґРѕРіСЂРµРІ РіРёРґСЂРѕРїРѕРЅРёРєРё. РЎРЅРёР¶Р°РµС‚ СЂР°СЃС…РѕРґ РєРёСЃР»РѕСЂРѕРґР° СЃ 8 РґРѕ 3 РµРґРёРЅРёС† Р·Р° С†РёРєР».',
                role: 'biologist',
                tag: 'Р‘РёРѕР»РѕРі'
            },
            {
                key: 'use_battery',
                title: 'РџРѕРґРєР»СЋС‡РёС‚СЊ Р±Р°С‚Р°СЂРµСЋ',
                cost: '+25 E (B=0)',
                available: s.battery_available,
                desc: 'РћРґРЅРѕРєСЂР°С‚РЅРѕРµ РІР»РёРІР°РЅРёРµ СЌРЅРµСЂРіРёРё. РћС‚РєР»СЋС‡Р°РµС‚ РїРµСЂРµРґР°С‚С‡РёРє Рё Р±Р»РѕРєРёСЂСѓРµС‚ РєРѕРјР±РёРЅРёСЂРѕРІР°РЅРЅС‹Р№ С„РёРЅР°Р»СЊРЅС‹Р№ РїР»Р°РЅ.',
                role: 'engineer',
                tag: 'РРЅР¶РµРЅРµСЂ'
            },
            {
                key: 'restore_archive',
                title: 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ Р°СЂС…РёРІ РђРЎРўР Р«',
                cost: '2 E',
                available: !s.archive_restored && s.energy >= 2,
                desc: 'Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РїР°РјСЏС‚СЊ Р±РѕСЂС‚РѕРІРѕРіРѕ РР. РћС‚РєСЂС‹РІР°РµС‚ СѓР»РёРєСѓ РєРёРЅРµС‚РёС‡РµСЃРєРѕРіРѕ СѓРґР°СЂР° Рё Р·Р°С‰РёС‚РЅРѕРіРѕ РѕС‚РєР»СЋС‡РµРЅРёСЏ.',
                role: 'captain',
                tag: 'РљР°РїРёС‚Р°РЅ'
            },
            {
                key: 'calculate_course',
                title: 'Р Р°СЃСЃС‡РёС‚Р°С‚СЊ РєСѓСЂСЃ РѕСЂР±РёС‚С‹',
                cost: '4 E',
                available: !s.course_calculated && s.energy >= 4,
                desc: 'Р’С‹С‡РёСЃР»СЏРµС‚ Р±РµР·РѕРїР°СЃРЅСѓСЋ РіСЂР°РІРёС‚Р°С†РёРѕРЅРЅСѓСЋ С‚СЂР°РµРєС‚РѕСЂРёСЋ. РћР±СЏР·Р°С‚РµР»РµРЅ РґР»СЏ РїР»Р°РЅР° В«Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРЅР°СЏ СЌРєРѕСЃРёСЃС‚РµРјР°В».',
                role: 'captain',
                tag: 'РљР°РїРёС‚Р°РЅ'
            },
            {
                key: 'wait_cycle',
                title: 'РћР¶РёРґР°РЅРёРµ (Р‘РµР· Р·Р°С‚СЂР°С‚)',
                cost: '0 E',
                available: true,
                desc: 'РџСЂРѕРїСѓСЃРє С…РѕРґР° РґР»СЏ РєРѕРѕСЂРґРёРЅР°С†РёРё РєРѕРјР°РЅРґС‹. РџСЂРёРјРµРЅСЏРµС‚СЃСЏ РѕР±С‹С‡РЅС‹Р№ С„РѕРЅРѕРІС‹Р№ СЂР°СЃС…РѕРґ СЂРµСЃСѓСЂСЃРѕРІ С†РёРєР»Р°.',
                role: 'all',
                tag: 'РћР±С‰РµРµ'
            }
        ];

        grid.innerHTML = '';
        actions.forEach(act => {
            // Р¤РёР»СЊС‚СЂ РїРѕ РІС‹Р±СЂР°РЅРЅРѕР№ СЂРѕР»Рё (РµСЃР»Рё РЅРµ 'all')
            const isDimmed = this.currentRole !== 'all' && act.role !== 'all' && act.role !== this.currentRole;

            const card = document.createElement('div');
            card.className = `action-item-card ${act.available ? '' : 'disabled'} ${isDimmed ? 'role-dimmed' : ''}`;
            card.innerHTML = `
                <div class="act-header">
                    <span class="act-title">${act.title}</span>
                    <span class="act-cost">${act.cost}</span>
                </div>
                <p class="act-desc">${act.desc}</p>
                <div class="act-footer">
                    <span class="act-tag">${act.tag}</span>
                    <button class="act-execute-btn" ${act.available ? '' : 'disabled'}>Р’С‹РїРѕР»РЅРёС‚СЊ РѕРїРµСЂР°С†РёСЋ</button>
                </div>
            `;

            const btn = card.querySelector('.act-execute-btn');
            btn.addEventListener('click', () => {
                this.executeAction(act.key);
            });

            grid.appendChild(card);
        });
    }

    _renderManeuversGrid() {
        const grid = document.getElementById('maneuvers-grid');
        if (!grid) return;
        const s = this.state;

        const maneuvers = [
            {
                key: 'final_combined',
                title: 'вљЎ РљРѕРјР±РёРЅРёСЂРѕРІР°РЅРЅС‹Р№ РёРјРїСѓР»СЊСЃ',
                cond: 'Р РµР°РєС‚РѕСЂ + РћС…Р»Р°Р¶РґРµРЅРёРµ + Р‘Р°С‚Р°СЂРµСЏ (Eв‰Ґ10, Oв‰Ґ12, Hв‰Ґ30)',
                available: s.reactor_active && s.cooling_repaired && s.battery_available && s.energy >= 10 && s.oxygen >= 12 && s.hull >= 30,
                cost: '-10 E, -12 O, -5 H, B=0',
                desc: 'РљРѕСЂРѕС‚РєРёР№ СЂР°Р·РіРѕРЅ СЂРµР°РєС‚РѕСЂР° РїСЂРё РїРѕРґРґРµСЂР¶РєРµ Р±Р°С‚Р°СЂРµРё. РРґРµР°Р»СЊРЅС‹Р№ РёСЃС…РѕРґ РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё Р±Р°С‚Р°СЂРµРё РґРѕ РєРѕРЅС†Р°!'
            },
            {
                key: 'final_ecosystem',
                title: 'рџЊї Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРЅР°СЏ СЌРєРѕСЃРёСЃС‚РµРјР°',
                cond: 'Р РµР°РєС‚РѕСЂ + РћС…Р»Р°Р¶РґРµРЅРёРµ + РћСЂР°РЅР¶РµСЂРµСЏ + РљСѓСЂСЃ (Eв‰Ґ18, Oв‰Ґ25, Hв‰Ґ40, 2 С†РёРєР»Р°)',
                available: s.reactor_active && s.cooling_repaired && s.greenhouse_active && s.course_calculated && s.energy >= 18 && s.oxygen >= 25 && s.hull >= 40 && s.cycle <= 7,
                cost: '-16 E (2 С†РёРєР»Р°)',
                desc: 'РџР»Р°РІРЅС‹Р№ РІС‹С…РѕРґ РЅР° Р±РµР·РѕРїР°СЃРЅСѓСЋ РѕСЂР±РёС‚Сѓ СЃРёР»Р°РјРё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРЅРѕР№ Р±РёРѕСЃС„РµСЂС‹ СЃС‚Р°РЅС†РёРё.'
            },
            {
                key: 'final_emergency',
                title: 'рџљЂ РђРІР°СЂРёР№РЅС‹Р№ Р·Р°РїСѓСЃРє СЂРµР°РєС‚РѕСЂР°',
                cond: 'Р РµР°РєС‚РѕСЂ (Eв‰Ґ22, O>0, РѕСЃС‚. 1 С†РёРєР»)',
                available: s.reactor_active && s.energy >= 22 && s.oxygen > 0,
                cost: '-22 E, -10 H (РїСЂРё РёСЃРїСЂР°РІРЅРѕРј РѕС…Р»Р°Р¶РґРµРЅРёРё)',
                desc: 'РњРіРЅРѕРІРµРЅРЅС‹Р№ РјР°СЂС€РµРІС‹Р№ СЂР°Р·РіРѕРЅ. Р•СЃР»Рё РѕС…Р»Р°Р¶РґРµРЅРёРµ РїСЂРѕР±РёС‚Рѕ вЂ” РЅР°РЅРѕСЃРёС‚ -45 H РєРѕСЂРїСѓСЃСѓ!'
            },
            {
                key: 'final_evacuation',
                title: 'рџ›ё Р­РІР°РєСѓР°С†РёСЏ РЅР° Р°РІР°СЂРёР№РЅРѕРј РјРѕРґСѓР»Рµ',
                cond: 'Eв‰Ґ4, Oв‰Ґ6, H>0',
                available: s.energy >= 4 && s.oxygen >= 6 && s.hull > 0,
                cost: '-4 E, -6 O',
                desc: 'РћС‚СЃС‚СЂРµР» СЃРїР°СЃР°С‚РµР»СЊРЅРѕРіРѕ С‡РµР»РЅРѕРєР°. Р­РєРёРїР°Р¶ СЃРїР°СЃС‘РЅ, РЅРѕ РєРѕСЂР°Р±Р»СЊ В«Р“РѕСЂРёР·РѕРЅС‚-7В» РїРѕС‚РµСЂСЏРЅ.'
            }
        ];

        grid.innerHTML = '';
        maneuvers.forEach(man => {
            const card = document.createElement('div');
            card.className = `maneuver-item-card ${man.available ? 'ready' : 'locked'}`;
            card.innerHTML = `
                <div class="act-header">
                    <span class="act-title">${man.title}</span>
                    <span class="act-cost">${man.cost}</span>
                </div>
                <div class="man-cond">РЈСЃР»РѕРІРёСЏ: ${man.cond}</div>
                <p class="act-desc">${man.desc}</p>
                <button class="man-execute-btn" ${man.available ? '' : 'disabled'}>
                    ${man.available ? 'Р—РђРџРЈРЎРўРРўР¬ РњРђРќРЃР’Р ' : 'РЈРЎР›РћР’РРЇ РќР• Р’Р«РџРћР›РќР•РќР«'}
                </button>
            `;

            const btn = card.querySelector('.man-execute-btn');
            btn.addEventListener('click', () => {
                this.executeAction(man.key);
            });

            grid.appendChild(card);
        });
    }

    _renderCluesList() {
        const list = document.getElementById('clues-list');
        if (!list) return;

        list.innerHTML = '';
        Object.values(this.clueMetadata).forEach(clue => {
            const isUnlocked = this.state.unlocked_clues.includes(clue.id);

            const item = document.createElement('div');
            item.className = `clue-item-card ${isUnlocked ? 'unlocked' : 'locked'}`;
            item.innerHTML = `
                <label class="clue-label">
                    <input type="checkbox" class="clue-checkbox" value="${clue.id}" ${isUnlocked ? '' : 'disabled'}>
                    <div class="clue-content">
                        <div class="clue-header">
                            <span class="clue-title">${clue.title}</span>
                            <span class="clue-source">${clue.source}</span>
                            <span class="clue-status">${isUnlocked ? 'РћРўРљР Р«РўРћ' : 'Р—РђР‘Р›РћРљРР РћР’РђРќРћ'}</span>
                        </div>
                        <p class="clue-desc">${isUnlocked ? clue.desc : 'Р”Р°РЅРЅС‹Рµ РїРѕРєР° РЅРµРґРѕСЃС‚СѓРїРЅС‹. Р’С‹РїРѕР»РЅРёС‚Рµ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰СѓСЋ РѕРїРµСЂР°С†РёСЋ С†РёРєР»Р°.'}</p>
                    </div>
                </label>
            `;

            list.appendChild(item);
        });
    }

    _showGameOverScreen() {
        const modal = this.gameOverOverlay;
        const s = this.state;
        modal.classList.remove('hidden');

        const title = document.getElementById('gameover-title');
        const desc = document.getElementById('gameover-desc');
        const badge = document.getElementById('gameover-badge');
        const stats = document.getElementById('gameover-stats');

        if (s.victory) {
            SoundFX.playIncomingTransmission();
            if (s.victory_type === 'safe_orbit') {
                badge.textContent = 'РўР РРЈРњР¤ Р­РљРРџРђР–Рђ';
                badge.className = 'gameover-badge success';
                title.textContent = 'В«Р“РћР РР—РћРќРў-7В» Р’Р«Р’Р•Р”Р•Рќ РќРђ Р‘Р•Р—РћРџРђРЎРќРЈР® РћР Р‘РРўРЈ!';
                desc.textContent = 'РљРѕРјР°РЅРґР° СѓСЃРїРµС€РЅРѕ СЃРїСЂР°РІРёР»Р°СЃСЊ СЃ СЂРµСЃСѓСЂСЃРЅС‹Рј РєСЂРёР·РёСЃРѕРј. Р’СЃРµ С‡Р»РµРЅС‹ СЌРєРёРїР°Р¶Р° Р¶РёРІС‹, СЂРµР°РєС‚РѕСЂ Рё СЃС‚Р°РЅС†РёСЏ СЃС‚Р°Р±РёР»РёР·РёСЂРѕРІР°РЅС‹.';
            } else {
                badge.textContent = 'Р§РђРЎРўРР§РќР«Р™ РЈРЎРџР•РҐ';
                badge.className = 'gameover-badge warning';
                title.textContent = 'Р­РљРРџРђР– РЎРџРђРЎРЃРќ Р’ РђР’РђР РР™РќРћРњ РњРћР”РЈР›Р•';
                desc.textContent = 'РЎРїР°СЃР°С‚РµР»СЊРЅС‹Р№ С‡РµР»РЅРѕРє Р±Р»Р°РіРѕРїРѕР»СѓС‡РЅРѕ РѕС‚СЃС‚С‹РєРѕРІР°РЅ. Р­РєРёРїР°Р¶ Р¶РёРІ, С…РѕС‚СЏ РёСЃСЃР»РµРґРѕРІР°С‚РµР»СЊСЃРєРёР№ РєРѕСЂР°Р±Р»СЊ В«Р“РѕСЂРёР·РѕРЅС‚-7В» СѓС‚СЂР°С‡РµРЅ.';
            }
        } else {
            SoundFX.playAlert();
            badge.textContent = 'РљРђРўРђРЎРўР РћР¤Рђ';
            badge.className = 'gameover-badge danger';
            title.textContent = 'РџР РћРўРћРљРћР› Р’Р«Р–РР’РђРќРРЇ РџР РћР’РђР›Р•Рќ';
            desc.textContent = 'РљСЂРёС‚РёС‡РµСЃРєРёР№ РїСЂРµРґРµР» СЃРёСЃС‚РµРј Р¶РёР·РЅРµРѕР±РµСЃРїРµС‡РµРЅРёСЏ РёСЃС‡РµСЂРїР°РЅ Р»РёР±Рѕ РєРѕСЂР°Р±Р»СЊ РІРѕС€С‘Р» РІ СЂР°РґРёР°С†РёРѕРЅРЅС‹Р№ РїРѕСЏСЃ Р®РїРёС‚РµСЂР°.';
        }

        const causeText = s.investigation_solved 
            ? 'вњ… РџСЂРёС‡РёРЅР° Р°РІР°СЂРёРё СѓСЃС‚Р°РЅРѕРІР»РµРЅР° (РѕСЃРєРѕР»РѕРє РјРµС‚РµРѕСЂРёС‚Р° РІ РѕС…Р»Р°Р¶РґРµРЅРёРё, Р·Р°С‰РёС‚РЅРѕРµ РѕС‚РєР»СЋС‡РµРЅРёРµ РђРЎРўР Р«)'
            : 'вќЊ РџСЂРёС‡РёРЅР° Р°РІР°СЂРёРё РѕСЃС‚Р°Р»Р°СЃСЊ Р·Р°РіР°РґРєРѕР№';

        stats.innerHTML = `
            <div class="stat-pill">РС‚РѕРіРѕРІС‹Р№ С†РёРєР»: <b>${s.cycle} / ${s.max_cycles}</b></div>
            <div class="stat-pill">РљРёСЃР»РѕСЂРѕРґ: <b>${s.oxygen}%</b></div>
            <div class="stat-pill">Р­РЅРµСЂРіРёСЏ: <b>${s.energy}%</b></div>
            <div class="stat-pill">РљРѕСЂРїСѓСЃ: <b>${s.hull}%</b></div>
            <div class="stat-investigation">${causeText}</div>
        `;
    }
}

