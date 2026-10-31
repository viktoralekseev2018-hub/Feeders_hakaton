import * as THREE from 'three';
import { PlayerControls } from './controls/PlayerControls.js';
import { NetworkManager } from './net/NetworkManager.js';
import { AuthModal } from './ui/AuthModal.js';

/**
 * main.js
 * Точка входа клиентского приложения Three.js для образовательного мира «ХроноГрад VR».
 * Этап 1: Базовый рендерер, сцена площади, управление FPS и авторизация с WebSocket.
 */
class ChronogradApp {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.clock = new THREE.Clock();

        // Сеть и авторизация
        this.network = new NetworkManager();
        this.isAuthenticated = false;
        this.currentUser = null;

        // Таймер отправки координат (15-20 Гц = каждые ~50-60 мс)
        this.lastInputSendTime = 0;
        this.inputSequence = 1;

        this._initThree();
        this._initSceneEnvironment();
        this._initControls();
        this._initUI();
        this._initNetworkListeners();

        // Запуск анимационного цикла
        this._animate();
    }

    _initThree() {
        // Рендерер
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Сцена с атмосферным туманом (по ТЗ скрывает границы чанков)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e14);
        this.scene.fog = new THREE.FogExp2(0x0a0e14, 0.015);

        // Камера
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        this.camera.position.set(0, 1.7, 5);

        // Слушатель ресайза
        window.addEventListener('resize', () => this._onWindowResize());
    }

    _initSceneEnvironment() {
        // Освещение
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        sunLight.position.set(20, 40, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 100;
        sunLight.shadow.camera.left = -30;
        sunLight.shadow.camera.right = 30;
        sunLight.shadow.camera.top = 30;
        sunLight.shadow.camera.bottom = -30;
        this.scene.add(sunLight);

        // Земля: Центральная площадь ХроноГрада
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x161b22,
            roughness: 0.85,
            metalness: 0.15
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Декоративная пространственная сетка площади
        const grid = new THREE.GridHelper(200, 100, 0x3182ce, 0x21262d);
        grid.position.y = 0.01;
        this.scene.add(grid);

        // Центральный монумент (Обелиск Открытий) на площади
        const monumentGroup = new THREE.Group();

        // Постамент
        const baseGeo = new THREE.CylinderGeometry(3, 3.5, 0.8, 16);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x21262d, roughness: 0.5 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.4;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        monumentGroup.add(baseMesh);

        // Светящееся кольцо ХроноГрафа
        const ringGeo = new THREE.TorusGeometry(1.4, 0.12, 16, 48);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x3182ce,
            emissive: 0x2b6cb0,
            emissiveIntensity: 0.8,
            roughness: 0.2
        });
        this.chronoRing = new THREE.Mesh(ringGeo, ringMat);
        this.chronoRing.position.y = 2.5;
        this.chronoRing.castShadow = true;
        monumentGroup.add(this.chronoRing);

        // Парящий кристалл времени
        const crystalGeo = new THREE.OctahedronGeometry(0.7, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0x63b3ed,
            emissive: 0x3182ce,
            emissiveIntensity: 0.6,
            roughness: 0.1,
            metalness: 0.9
        });
        this.crystal = new THREE.Mesh(crystalGeo, crystalMat);
        this.crystal.position.y = 2.5;
        monumentGroup.add(this.crystal);

        this.scene.add(monumentGroup);
    }

    _initControls() {
        this.controls = new PlayerControls(this.camera, document.body);

        // Клик по холсту захватывает курсор, если авторизация пройдена
        this.canvas.addEventListener('click', () => {
            if (this.isAuthenticated) {
                this.controls.lock();
            }
        });
    }

    _initUI() {
        this.authModal = new AuthModal(this.network, (user) => {
            this._onAuthSuccess(user);
        });

        this.hudUsername = document.getElementById('hud-username');
        this.hudCoords = document.getElementById('hud-coords');
        this.lanStatusDot = document.getElementById('lan-status-dot');
        this.lanStatusText = document.getElementById('lan-status-text');
        this.controlsHint = document.getElementById('controls-hint');
        this.playerInfoPill = document.getElementById('player-info-pill');
        this.posInfoPill = document.getElementById('pos-info-pill');
    }

    _onAuthSuccess(user) {
        this.isAuthenticated = true;
        this.currentUser = user;

        console.log('[ChronogradApp] Успешная авторизация игрока:', user.username);

        // Показываем элементы HUD
        if (this.hudUsername) this.hudUsername.textContent = user.username;
        if (this.playerInfoPill) this.playerInfoPill.style.display = 'inline-flex';
        if (this.posInfoPill) this.posInfoPill.style.display = 'inline-flex';
        if (this.controlsHint) this.controlsHint.style.display = 'block';

        // Открываем WebSocket-канал на сервере по ТЗ
        this.network.connectWebSocket();

        // Захватываем мышь для немедленного погружения
        setTimeout(() => this.controls.lock(), 300);
    }

    _initNetworkListeners() {
        this.network.on('connect', () => {
            if (this.lanStatusDot) this.lanStatusDot.classList.add('online');
            if (this.lanStatusText) this.lanStatusText.textContent = 'LAN: Онлайн';
        });

        this.network.on('disconnect', () => {
            if (this.lanStatusDot) this.lanStatusDot.classList.remove('online');
            if (this.lanStatusText) this.lanStatusText.textContent = 'LAN: Оффлайн';
        });

        // Слушатель серверных снапшотов (для этапа 2)
        this.network.on('world.snapshot', (snapshot) => {
            // Будет расширено на этапе 2 для интерполяции удаленных аватаров
        });
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

        // Анимация декоративного монумента
        if (this.chronoRing) {
            this.chronoRing.rotation.x = time * 0.5;
            this.chronoRing.rotation.y = time * 0.7;
        }
        if (this.crystal) {
            this.crystal.rotation.y = -time * 1.0;
            this.crystal.position.y = 2.5 + Math.sin(time * 2.0) * 0.15;
        }

        // Обновление управления персонажем
        this.controls.update(delta);

        // Обновление координат на HUD
        if (this.isAuthenticated && this.hudCoords) {
            const pos = this.controls.getPosition();
            this.hudCoords.textContent = `X: ${pos.x.toFixed(1)} | Y: ${pos.y.toFixed(1)} | Z: ${pos.z.toFixed(1)}`;

            // Отправка координат на сервер (15-20 раз в секунду по ТЗ)
            const now = performance.now();
            if (now - this.lastInputSendTime > 55) { // ~18 Гц
                this.lastInputSendTime = now;
                if (this.network.isConnected) {
                    this.network.send('player.input', {
                        seq: this.inputSequence++,
                        x: parseFloat(pos.x.toFixed(2)),
                        y: parseFloat(pos.y.toFixed(2)),
                        z: parseFloat(pos.z.toFixed(2)),
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
    new ChronogradApp();
});
