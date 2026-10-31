import * as THREE from 'three';
import { PlayerControls } from './controls/PlayerControls.js';
import { NetworkManager } from './net/NetworkManager.js';
import { AuthModal } from './ui/AuthModal.js';
import { ChunkCacheManager } from './world/ChunkCacheManager.js';
import { RemotePlayerManager } from './render/RemotePlayerManager.js';
import { DebugAuditPanel } from './ui/DebugAuditPanel.js';
import { CrewManager } from './crew/CrewManager.js';
import { DialogueModal } from './ui/DialogueModal.js';
import { SurvivalConsole } from './ui/SurvivalConsole.js';
import { PassportModal } from './ui/PassportModal.js';
import { HistoryQuestModal } from './ui/HistoryQuestModal.js';
import { LightClockComponent } from './experiment/LightClockComponent.js';

/**
 * main.js
 * Точка входа Three.js клиентского приложения научно-образовательной платформы «Последний экипаж».
 * 
 * Включает полную реализацию этапов 5, 6, 7, 8 и графического обновления:
 * - Раздельные тематические комнаты: Капитанский мостик, Камбуз/Кухня, Комната отдыха с ТВ и диваном,
 *   Физическая лаборатория СТО, Павильон Истории Геродота, Реактор, Оранжерея, Шлюз.
 * - Центральный Raycaster для прицельного взаимодействия с объектами станции по [E].
 * - Горячие клавиши: [E] Взаимодействие/Диалог, [P] Паспорт исследователя, [C] Пульт операций, [I] Улики.
 * - Интерактивные модальные окна: Световые часы (СТО), Квест Геродота, Паспорт исследователя.
 * - Панель арбитража жюри с контролем кэша (C <= 10% W) и 5-минутным сценарием.
 */
class LastCrewApp {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.clock = new THREE.Clock();

        this.network = new NetworkManager();
        this.isAuthenticated = false;
        this.currentUser = null;

        this.lastInputSendTime = 0;
        this.inputSequence = 1;

        // Цели взаимодействия
        this.activeInteractionTarget = null; // NPC рядом
        this.activeHoverObject = null;       // Физический объект в перекрестье прицела

        // Центральный луч прицела для raycasting
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 6.5; // Дистанция взаимодействия 6.5 метров
        this.screenCenter = new THREE.Vector2(0, 0);

        this._initThree();
        this._initSpaceEnvironment();
        this._initWorldAndCache();
        this._initCrew();
        this._initRemotePlayers();
        this._initControls();
        this._initUI();
        this._initNetworkListeners();

        this._animate();
    }

    _initThree() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050811);
        this.scene.fog = new THREE.FogExp2(0x050811, 0.012);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            600
        );
        // Стартовая позиция в каютах отдыха [-20, 1.7, 20]
        this.camera.position.set(-20, 1.7, 20);

        window.addEventListener('resize', () => this._onWindowResize());
    }

    _initSpaceEnvironment() {
        const ambientLight = new THREE.AmbientLight(0x1e293b, 0.7);
        this.scene.add(ambientLight);

        const starLight = new THREE.DirectionalLight(0xe0f2fe, 1.2);
        starLight.position.set(30, 50, 40);
        starLight.castShadow = true;
        starLight.shadow.mapSize.width = 1024;
        starLight.shadow.mapSize.height = 1024;
        this.scene.add(starLight);

        // Звездное небо
        const starsGeo = new THREE.BufferGeometry();
        const starsCount = 1800;
        const positions = new Float32Array(starsCount * 3);

        for (let i = 0; i < starsCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 600;
            positions[i + 1] = Math.random() * 300 + 10;
            positions[i + 2] = (Math.random() - 0.5) * 600;
        }

        starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starsMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.2,
            transparent: true,
            opacity: 0.85
        });

        const starField = new THREE.Points(starsGeo, starsMat);
        this.scene.add(starField);
    }

    _initWorldAndCache() {
        this.chunkManager = new ChunkCacheManager(this.scene);
        this.chunkManager.updatePlayerPosition(this.camera.position);
    }

    _initCrew() {
        this.crewManager = new CrewManager(this.scene);
    }

    _initRemotePlayers() {
        this.remotePlayerManager = new RemotePlayerManager(this.scene);
    }

    _initControls() {
        this.controls = new PlayerControls(this.camera, document.body);

        this.canvas.addEventListener('click', () => {
            if (this.isAuthenticated && !this._isAnyModalOpen()) {
                this.controls.lock();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (!this.isAuthenticated) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'KeyE') {
                if (this.activeInteractionTarget && !this.dialogueModal?.isOpen) {
                    this.controls.unlock();
                    this.dialogueModal.open(this.activeInteractionTarget);
                } else if (this.activeHoverObject) {
                    this._handleObjectInteraction(this.activeHoverObject);
                }
            } else if (e.code === 'KeyP') {
                if (this.passportModal) {
                    this.controls.unlock();
                    if (this.passportModal.isOpen) {
                        this.passportModal.close();
                    } else {
                        this.passportModal.open();
                    }
                }
            } else if (e.code === 'KeyC') {
                if (this.survivalConsole && !this._isAnyModalOpen()) {
                    this.controls.unlock();
                    if (this.survivalConsole.isActionModalOpen) {
                        this.survivalConsole.closeModals();
                    } else {
                        this.survivalConsole.openActionModal();
                    }
                }
            } else if (e.code === 'KeyI') {
                if (this.survivalConsole && !this._isAnyModalOpen()) {
                    this.controls.unlock();
                    if (this.survivalConsole.isInvestigationModalOpen) {
                        this.survivalConsole.closeModals();
                    } else {
                        this.survivalConsole.openInvestigationModal();
                    }
                }
            }
        });
    }

    _initUI() {
        this.authModal = new AuthModal(this.network, (user) => {
            this._onAuthSuccess(user);
        });

        this.survivalConsole = new SurvivalConsole(this.network, () => this._onModalClosed());
        this.dialogueModal = new DialogueModal(this.network, () => this._onModalClosed());
        this.passportModal = new PassportModal(this.network, () => this._onModalClosed());
        this.historyQuestModal = new HistoryQuestModal(this.network, () => this._onModalClosed());
        this.lightClockComponent = new LightClockComponent(this.network, () => this._onModalClosed());

        // Элементы HUD
        this.hudUsername = document.getElementById('hud-username');
        this.hudCoords = document.getElementById('hud-coords');
        this.lanStatusDot = document.getElementById('lan-status-dot');
        this.lanStatusText = document.getElementById('lan-status-text');
        this.controlsHint = document.getElementById('controls-hint');
        this.playerInfoPill = document.getElementById('player-info-pill');
        this.posInfoPill = document.getElementById('pos-info-pill');
        this.interactionPill = document.getElementById('interaction-pill');
        this.interactionLabel = document.getElementById('interaction-label');
        this.awakeningOverlay = document.getElementById('awakening-overlay');

        // Кнопка паспорта в левом верхнем углу
        const passportHudBtn = document.getElementById('passport-hud-btn');
        if (passportHudBtn) {
            passportHudBtn.style.display = 'inline-flex';
            passportHudBtn.addEventListener('click', () => {
                this.controls.unlock();
                this.passportModal.open();
            });
        }

        // Баннер авто-переподключения
        this.connectionBanner = document.getElementById('connection-alert-banner');
        this.reconnectStatusText = document.getElementById('reconnect-status-text');
        this.reconnectNowBtn = document.getElementById('reconnect-now-btn');
        if (this.reconnectNowBtn) {
            this.reconnectNowBtn.addEventListener('click', () => {
                this.network.reconnectNow();
            });
        }

        // Панель аудита кэша (ТЗ <= 10%)
        this.auditPanel = new DebugAuditPanel(this.chunkManager);
        this.auditPanel.onTestEvictionRequested = () => {
            this._runCacheEvictionDemo();
        };
        this.auditPanel.onDemoRequested = () => {
            this._runFiveMinuteDemo();
        };
    }

    _isAnyModalOpen() {
        return (
            this.dialogueModal?.isOpen ||
            this.survivalConsole?.isActionModalOpen ||
            this.survivalConsole?.isInvestigationModalOpen ||
            this.passportModal?.isOpen ||
            this.historyQuestModal?.isOpen ||
            this.lightClockComponent?.isOpen
        );
    }

    _onModalClosed() {
        if (this.isAuthenticated && !this._isAnyModalOpen()) {
            setTimeout(() => this.controls.lock(), 150);
        }
    }

    _onAuthSuccess(user) {
        this.isAuthenticated = true;
        this.currentUser = user;

        if (this.remotePlayerManager && user.id) {
            this.remotePlayerManager.setLocalPlayerId(user.id);
        }

        console.log('[LastCrewApp] Успешная авторизация члена экипажа:', user.username);

        if (this.hudUsername) this.hudUsername.textContent = user.username;
        if (this.playerInfoPill) this.playerInfoPill.style.display = 'inline-flex';
        if (this.posInfoPill) this.posInfoPill.style.display = 'inline-flex';
        if (this.controlsHint) this.controlsHint.style.display = 'block';

        this._triggerAwakeningEffect();
        this.network.connectWebSocket();
        setTimeout(() => this.controls.lock(), 600);

        if (this.network.currentUser && this.network.currentUser.id.startsWith('local_')) {
            this._spawnDemoRemotePlayer();
        }
    }

    _triggerAwakeningEffect() {
        if (!this.awakeningOverlay) return;
        this.awakeningOverlay.classList.remove('hidden');
        setTimeout(() => {
            this.awakeningOverlay.classList.add('hidden');
        }, 1600);
    }

    _initNetworkListeners() {
        this.network.on('connect', () => {
            if (this.lanStatusDot) this.lanStatusDot.classList.add('online');
            if (this.lanStatusText) this.lanStatusText.textContent = 'LAN: Онлайн';
            if (this.connectionBanner) this.connectionBanner.classList.add('hidden');
        });

        this.network.on('reconnected', () => {
            if (this.connectionBanner) this.connectionBanner.classList.add('hidden');
        });

        this.network.on('disconnect', () => {
            if (this.lanStatusDot) this.lanStatusDot.classList.remove('online');
            if (this.lanStatusText) this.lanStatusText.textContent = 'LAN: Оффлайн';
        });

        this.network.on('reconnecting', (info) => {
            if (this.connectionBanner) {
                this.connectionBanner.classList.remove('hidden');
                if (this.reconnectStatusText) {
                    this.reconnectStatusText.textContent = `Попытка #${info.attempt}. Повтор через ${info.remainingSeconds} сек...`;
                }
            }
        });

        this.network.on('player.spawn', (spawnData) => {
            if (spawnData.position) {
                this.controls.setPosition(
                    spawnData.position.x,
                    spawnData.position.y,
                    spawnData.position.z
                );
            }
            if (typeof spawnData.yaw === 'number') {
                this.controls.setYaw(spawnData.yaw);
            }
            this.chunkManager.updatePlayerPosition(this.camera.position);
        });

        this.network.on('world.snapshot', (snapshot) => {
            if (snapshot && snapshot.players) {
                this.remotePlayerManager.applySnapshot(snapshot.players, snapshot.server_time);
            }
        });
    }

    _spawnDemoRemotePlayer() {
        const demoPlayerId = 'demo_astronaut_alex';
        const demoUsername = 'Алекс (Инженер-стажер)';
        let angle = 0;
        setInterval(() => {
            angle += 0.03;
            const x = Math.cos(angle) * 7;
            const z = Math.sin(angle) * 7;
            const yaw = -angle + Math.PI / 2;

            this.remotePlayerManager.applySnapshot([
                { id: demoPlayerId, name: demoUsername, x, y: 0, z, yaw }
            ], performance.now());
        }, 66);
    }

    _runCacheEvictionDemo() {
        const curPos = this.controls.getPosition();
        curPos.z -= 25;
        this.chunkManager.updatePlayerPosition(curPos);
        this.auditPanel.registerEviction();
    }

    /**
     * 5-минутный демонстрационный тур для жюри
     */
    _runFiveMinuteDemo() {
        const checkpoints = [
            { pos: { x: 0, y: 1.7, z: 0 }, desc: '1. Мостик: Капитан Волк и панорама Юпитера' },
            { pos: { x: 0, y: 1.7, z: -20 }, desc: '2. Камбуз: Пищевой синтезатор и холодильник экипажа' },
            { pos: { x: -20, y: 1.7, z: 20 }, desc: '3. Кают-компания: Уютный диван, ТВ с Землей и спальные места' },
            { pos: { x: 20, y: 1.7, z: 0 }, desc: '4. Реактор: Токамак 15 МВт, плазма и инженер Марк Вэнс' },
            { pos: { x: 0, y: 1.7, z: 20 }, desc: '5. Оранжерея: Фотобиореактор Chlorella 430 нм и биолог Елена' },
            { pos: { x: -20, y: 1.7, z: 0 }, desc: '6. Физическая лаборатория: Световые часы СТО и Эйнштейн' },
            { pos: { x: 20, y: 1.7, z: 20 }, desc: '7. Павильон Истории: Свитки Геродота и память АСТРЫ' }
        ];

        let index = 0;
        const interval = setInterval(() => {
            if (index >= checkpoints.length) {
                clearInterval(interval);
                this._showStationNotification('🏁 Завершение демо-тура', 'Все ключевые отсеки станции и научные задачи продемонстрированы!');
                return;
            }

            const cp = checkpoints[index];
            this.controls.setPosition(cp.pos.x, cp.pos.y, cp.pos.z);
            this.chunkManager.updatePlayerPosition(cp.pos);
            this._showStationNotification('📍 Демонстрационный маршрут', cp.desc);
            index++;
        }, 8000);
    }

    /**
     * Прицельный опрос интерактивных объектов в центре экрана
     */
    _checkRaycastInteraction() {
        this.raycaster.setFromCamera(this.screenCenter, this.camera);

        // Собираем все интерактивные меши из активных чанков
        const interactables = [];
        for (const chunk of this.chunkManager.activeChunks.values()) {
            if (chunk.meshGroup) {
                chunk.meshGroup.traverse((child) => {
                    if (child.isMesh && child.userData && child.userData.interactable) {
                        interactables.push(child);
                    }
                });
            }
        }

        const intersects = this.raycaster.intersectObjects(interactables, false);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (this.activeHoverObject !== hit) {
                this._clearHoverHighlight();
                this.activeHoverObject = hit;
                this._applyHoverHighlight(hit);
            }

            // Если рядом нет говорящего NPC, показываем подсказку предмета
            if (!this.activeInteractionTarget && this.interactionPill && this.interactionLabel) {
                this.interactionLabel.textContent = `[E] ${hit.userData.name || 'Использовать объект'}`;
                this.interactionPill.classList.remove('hidden');
            }
        } else {
            this._clearHoverHighlight();
            this.activeHoverObject = null;
            if (!this.activeInteractionTarget && this.interactionPill) {
                this.interactionPill.classList.add('hidden');
            }
        }
    }

    _applyHoverHighlight(mesh) {
        if (!mesh || !mesh.material) return;
        this._highlightedMesh = mesh;
        if (mesh.material.emissive) {
            this._originalEmissive = mesh.material.emissive.clone();
            this._originalEmissiveIntensity = mesh.material.emissiveIntensity;
            mesh.material.emissive.set(0x38bdf8);
            mesh.material.emissiveIntensity = 0.9;
        }
    }

    _clearHoverHighlight() {
        if (this._highlightedMesh && this._highlightedMesh.material) {
            if (this._originalEmissive && this._highlightedMesh.material.emissive) {
                this._highlightedMesh.material.emissive.copy(this._originalEmissive);
                this._highlightedMesh.material.emissiveIntensity = this._originalEmissiveIntensity ?? 0;
            }
        }
        this._highlightedMesh = null;
        this._originalEmissive = null;
    }

    _handleObjectInteraction(obj) {
        if (!obj || !obj.userData) return;

        const type = obj.userData.type;

        switch (type) {
            case 'bridge_console':
                this.controls.unlock();
                this.survivalConsole.openActionModal();
                break;
            case 'synthesizer':
                this._showStationNotification('🍔 Пищевой синтезатор', 'Питательный космический рацион синтезирован! Калорийность: 2400 ккал.');
                break;
            case 'refrigerator':
                this._showStationNotification('❄️ Холодильник экипажа', 'Температура контура: +3.4°C. Образцы клеточных культур Chlorella в сохранности.');
                break;
            case 'lounge_tv':
                this._showStationNotification('📺 ТВ Кают-компании', 'Трансляция земного архива (Озеро Байкал). Психологический индекс экипажа повышен.');
                break;
            case 'light_clock':
                this.controls.unlock();
                this.lightClockComponent.open();
                break;
            case 'herodotus_archive':
                this.controls.unlock();
                this.historyQuestModal.open();
                break;
            case 'reactor_bench':
                this.controls.unlock();
                this.survivalConsole.openInvestigationModal();
                break;
            case 'bioreactor':
                this._showStationNotification('🌱 Фотобиореактор', 'Культура микроводорослей переведена на узкополосный ночной спектр 430 нм (5 МВт).');
                break;
            case 'escape_pod':
                this._showStationNotification('🚀 Спасательный челнок', 'Шлюз челнока разгерметизирован. Требуется подтверждение протокола эвакуации.');
                break;
            case 'investigation_terminal':
                this.controls.unlock();
                this.survivalConsole.openInvestigationModal();
                break;
            default:
                this._showStationNotification('🔧 Объект станции', obj.userData.name || 'Взаимодействие выполнено');
        }
    }

    _showStationNotification(title, text) {
        let notif = document.getElementById('station-global-toast');
        if (!notif) {
            notif = document.createElement('div');
            notif.id = 'station-global-toast';
            notif.style.cssText = `
                position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
                background: rgba(15, 23, 42, 0.95); border: 2px solid #38bdf8;
                border-radius: 8px; padding: 12px 24px; color: #f8fafc;
                font-family: 'Inter', system-ui, sans-serif; z-index: 9999;
                box-shadow: 0 0 25px rgba(56, 189, 248, 0.4); text-align: center;
                pointer-events: none; transition: opacity 0.3s ease;
            `;
            document.body.appendChild(notif);
        }

        notif.innerHTML = `
            <div style="font-weight: 700; font-size: 14px; color: #38bdf8; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 13px; color: #e2e8f0;">${text}</div>
        `;
        notif.style.opacity = '1';

        if (this._notifTimeout) clearTimeout(this._notifTimeout);
        this._notifTimeout = setTimeout(() => {
            notif.style.opacity = '0';
        }, 3500);
    }

    _onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        this.controls.update(delta);
        this.remotePlayerManager.update();

        const playerPos = this.controls.getPosition();
        this.chunkManager.updatePlayerPosition(playerPos);

        // Обновление NPC экипажа и проверка близости
        if (this.crewManager) {
            const nearest = this.crewManager.update(playerPos, time);
            this.activeInteractionTarget = nearest;

            if (this.interactionPill && this.interactionLabel) {
                if (nearest && !this.dialogueModal.isOpen) {
                    this.interactionLabel.textContent = `Поговорить: ${nearest.name} (${nearest.role})`;
                    this.interactionPill.classList.remove('hidden');
                } else if (!this.activeHoverObject) {
                    this.interactionPill.classList.add('hidden');
                }
            }
        }

        // Прицельный Raycasting по объектам
        if (this.isAuthenticated && !this._isAnyModalOpen()) {
            this._checkRaycastInteraction();
        }

        if (this.chunkManager && this.chunkManager.updateAnimation) {
            this.chunkManager.updateAnimation(time);
        }

        if (this.auditPanel) {
            this.auditPanel.update();
        }

        // Обновление HUD координат и отправка движения на сервер
        if (this.isAuthenticated && this.hudCoords) {
            this.hudCoords.textContent = `X: ${playerPos.x.toFixed(1)} | Y: ${playerPos.y.toFixed(1)} | Z: ${playerPos.z.toFixed(1)}`;

            const now = performance.now();
            if (now - this.lastInputSendTime > 55) { // ~18 Гц
                this.lastInputSendTime = now;
                if (this.network.isConnected) {
                    this.network.send('player.input', {
                        seq: this.inputSequence++,
                        x: parseFloat(playerPos.x.toFixed(2)),
                        y: parseFloat(playerPos.y.toFixed(2)),
                        z: parseFloat(playerPos.z.toFixed(2)),
                        yaw: parseFloat(this.controls.getYaw().toFixed(3))
                    });
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new LastCrewApp();
});
