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

/**
 * main.js
 * Точка входа Three.js клиентского приложения научно-образовательной платформы «Последний экипаж».
 * 
 * Предметная область: энергия, экология замкнутых систем и основы космонавтики.
 * 
 * Реализовано в этапе 3 и 4:
 * 1. Полный Sci-Fi ретеминг космического корабля «Горизонт-7» у Юпитера.
 * 2. Четыре уникальных ИИ-персонажа (Инженер Марк Вэнс, Биолог Елена Ростова, Капитан Александр Волк, Бортовой ИИ АСТРА).
 * 3. Спавн игрока в криокапсуле с плавным визуальным пробуждением и применением координат от сервера.
 * 4. Баннер аварийного обрыва связи с авто-переподключением (Exponential Backoff + таймер обратного отсчета).
 * 5. Интерактивная 3D proximity-система диалогов по клавише [E].
 * 6. Интерактивный пульт операций выживания [C] и детективный терминал расследования аварии [I].
 * 7. HUD телеметрии систем жизнеобеспечения (O2, Энергия, Корпус) и синхронизация 8-циклового протокола.
 * 8. Сохранение строгого LRU-кэша C <= 10% W с утилизацией через .dispose().
 */
class LastCrewApp {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.clock = new THREE.Clock();

        // Сеть и авторизация
        this.network = new NetworkManager();
        this.isAuthenticated = false;
        this.currentUser = null;

        // Таймер отправки координат на сервер (15-20 Гц = каждые ~55 мс)
        this.lastInputSendTime = 0;
        this.inputSequence = 1;

        // Текущий персонаж рядом
        this.activeInteractionTarget = null;

        this._initThree();
        this._initSpaceEnvironment();
        this._initWorldAndCache();
        this._initCrew();
        this._initRemotePlayers();
        this._initControls();
        this._initUI();
        this._initNetworkListeners();

        // Запуск анимационного цикла
        this._animate();
    }

    _initThree() {
        // WebGL Рендерер
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

        // Сцена
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050811);
        this.scene.fog = new THREE.FogExp2(0x050811, 0.015);

        // Камера от первого лица
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            600
        );
        // Начальная позиция до получения пакета спавна от сервера (в крио-отсеке [-15, 1.7, 0])
        this.camera.position.set(-15, 1.7, 0);

        window.addEventListener('resize', () => this._onWindowResize());
    }

    /**
     * Создание звездного неба и космического освещения
     */
    _initSpaceEnvironment() {
        // Рассеянный свет станции
        const ambientLight = new THREE.AmbientLight(0x1e293b, 0.7);
        this.scene.add(ambientLight);

        // Основной направленный источник (свет далекой звезды через иллюминаторы)
        const starLight = new THREE.DirectionalLight(0xe0f2fe, 1.2);
        starLight.position.set(30, 50, 40);
        starLight.castShadow = true;
        starLight.shadow.mapSize.width = 1024;
        starLight.shadow.mapSize.height = 1024;
        this.scene.add(starLight);

        // Локальное янтарное свечение аварийных маяков станции
        const alertLight = new THREE.PointLight(0xff6b1a, 1.4, 25);
        alertLight.position.set(14, 3, 0); // В отсеке реактора
        this.scene.add(alertLight);

        // Локальное бирюзовое свечение биокупола
        const bioLight = new THREE.PointLight(0x06b6d4, 1.2, 25);
        bioLight.position.set(0, 3, 14); // В оранжерее
        this.scene.add(bioLight);

        // Звездное поле (частицы далеких звезд в открытом космосе)
        const starsGeo = new THREE.BufferGeometry();
        const starsCount = 1500;
        const positions = new Float32Array(starsCount * 3);

        for (let i = 0; i < starsCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 600;
            positions[i + 1] = Math.random() * 300 + 20; // Выше горизонта
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
        // Менеджер отсеков-чанков и строгий кэш C <= 10% W
        this.chunkManager = new ChunkCacheManager(this.scene);
        this.chunkManager.updatePlayerPosition(this.camera.position);
    }

    _initCrew() {
        // Менеджер ИИ-членов экипажа
        this.crewManager = new CrewManager(this.scene);
    }

    _initRemotePlayers() {
        // Менеджер других игроков с LERP-интерполяцией (буфер 100 мс)
        this.remotePlayerManager = new RemotePlayerManager(this.scene);
    }

    _initControls() {
        this.controls = new PlayerControls(this.camera, document.body);

        this.canvas.addEventListener('click', () => {
            if (this.isAuthenticated && !this.dialogueModal?.isOpen && !this.survivalConsole?.isActionModalOpen && !this.survivalConsole?.isInvestigationModalOpen) {
                this.controls.lock();
            }
        });

        // Клавиши взаимодействия E (Диалог), C (Пульт операций), I (Улики расследования)
        window.addEventListener('keydown', (e) => {
            if (!this.isAuthenticated) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'KeyE') {
                if (this.activeInteractionTarget && !this.dialogueModal.isOpen) {
                    this.controls.unlock();
                    this.dialogueModal.open(this.activeInteractionTarget);
                }
            } else if (e.code === 'KeyC') {
                if (this.survivalConsole && !this.dialogueModal?.isOpen) {
                    this.controls.unlock();
                    if (this.survivalConsole.isActionModalOpen) {
                        this.survivalConsole.closeModals();
                    } else {
                        this.survivalConsole.openActionModal();
                    }
                }
            } else if (e.code === 'KeyI') {
                if (this.survivalConsole && !this.dialogueModal?.isOpen) {
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

        // Пульт операций выживания и расследования аварии «Горизонт-7»
        this.survivalConsole = new SurvivalConsole(this.network, () => {
            if (this.isAuthenticated && !this.dialogueModal?.isOpen) {
                setTimeout(() => this.controls.lock(), 150);
            }
        });

        // Диалоговое окно
        this.dialogueModal = new DialogueModal(this.network, () => {
            // При закрытии диалога восстанавливаем захват мыши
            if (this.isAuthenticated && !this.survivalConsole?.isActionModalOpen && !this.survivalConsole?.isInvestigationModalOpen) {
                setTimeout(() => this.controls.lock(), 150);
            }
        });

        // Элементы HUD
        this.hudUsername = document.getElementById('hud-username');
        this.hudCoords = document.getElementById('hud-coords');
        this.lanStatusDot = document.getElementById('lan-status-dot');
        this.lanStatusText = document.getElementById('lan-status-text');
        this.controlsHint = document.getElementById('controls-hint');
        this.playerInfoPill = document.getElementById('player-info-pill');
        this.posInfoPill = document.getElementById('pos-info-pill');
        this.stationTelemetryHud = document.getElementById('station-telemetry-hud');
        this.interactionPill = document.getElementById('interaction-pill');
        this.interactionLabel = document.getElementById('interaction-label');
        this.awakeningOverlay = document.getElementById('awakening-overlay');

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
    }

    _onAuthSuccess(user) {
        this.isAuthenticated = true;
        this.currentUser = user;

        if (this.remotePlayerManager && user.id) {
            this.remotePlayerManager.setLocalPlayerId(user.id);
        }

        console.log('[LastCrewApp] Успешная авторизация члена экипажа:', user.username);

        // Показываем элементы космического HUD
        if (this.hudUsername) this.hudUsername.textContent = user.username;
        if (this.playerInfoPill) this.playerInfoPill.style.display = 'inline-flex';
        if (this.posInfoPill) this.posInfoPill.style.display = 'inline-flex';
        if (this.controlsHint) this.controlsHint.style.display = 'block';

        // Анимация плавного пробуждения в криокапсуле
        this._triggerAwakeningEffect();

        // Подключаем WebSocket к Go-серверу
        this.network.connectWebSocket();

        setTimeout(() => this.controls.lock(), 600);

        // Демо-игрок для визуальной проверки LERP при оффлайн-разработке
        if (this.network.currentUser && this.network.currentUser.id.startsWith('local_')) {
            this._spawnDemoRemotePlayer();
        }
    }

    /**
     * Эффект пробуждения из криокапсулы (Awakening Transition)
     */
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
            console.log('[LastCrewApp] Связь со станцией успешно восстановлена!');
            if (this.connectionBanner) this.connectionBanner.classList.add('hidden');
        });

        this.network.on('disconnect', () => {
            if (this.lanStatusDot) this.lanStatusDot.classList.remove('online');
            if (this.lanStatusText) this.lanStatusText.textContent = 'LAN: Оффлайн';
        });

        // Обработка статуса авто-переподключения
        this.network.on('reconnecting', (info) => {
            if (this.connectionBanner) {
                this.connectionBanner.classList.remove('hidden');
                if (this.reconnectStatusText) {
                    this.reconnectStatusText.textContent = `Попытка #${info.attempt}. Повтор через ${info.remainingSeconds} сек...`;
                }
            }
        });

        this.network.on('reconnect_tick', (info) => {
            if (this.reconnectStatusText && this.connectionBanner && !this.connectionBanner.classList.contains('hidden')) {
                this.reconnectStatusText.textContent = `Повтор через ${info.remainingSeconds} сек...`;
            }
        });

        // 1. Слушатель спавна игрока (применение координат сервера)
        this.network.on('player.spawn', (spawnData) => {
            console.log('[LastCrewApp] Применение серверной позиции спавна:', spawnData.position);
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
            // Актуализируем чанки вокруг полученной позиции
            this.chunkManager.updatePlayerPosition(this.camera.position);
        });

        // 2. Слушатель серверных снапшотов мира (world.snapshot)
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
        // Смещение на 25 метров для демонстрации жюри выгрузки отсека
        curPos.z -= 25;
        this.chunkManager.updatePlayerPosition(curPos);
        this.auditPanel.registerEviction();
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

        // Обновление управления персонажем
        this.controls.update(delta);

        // Интерполяция удаленных игроков
        this.remotePlayerManager.update();

        // Позиция игрока
        const playerPos = this.controls.getPosition();

        // Обновление пространственного кэша отсеков (<= 10% W)
        this.chunkManager.updatePlayerPosition(playerPos);

        // Обновление ИИ-членов экипажа и проверка близости
        if (this.crewManager) {
            const nearest = this.crewManager.update(playerPos, time);
            this.activeInteractionTarget = nearest;

            // Отображение подсказки взаимодействия [E]
            if (this.interactionPill && this.interactionLabel) {
                if (nearest && !this.dialogueModal.isOpen) {
                    this.interactionLabel.textContent = `Поговорить: ${nearest.name} (${nearest.role})`;
                    this.interactionPill.classList.remove('hidden');
                } else {
                    this.interactionPill.classList.add('hidden');
                }
            }
        }

        // Обновление панели аудита для жюри
        if (this.auditPanel) {
            this.auditPanel.update();
        }

        // Обновление координат на HUD и отправка input на сервер
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

        // Рендеринг кадра
        this.renderer.render(this.scene, this.camera);
    }
}

// Запуск приложения при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    new LastCrewApp();
});
