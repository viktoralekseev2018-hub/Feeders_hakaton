import * as THREE from 'three';

/**
 * RemotePlayer.js
 * Класс удаленного игрока в Three.js с буфером снапшотов и LERP-интерполяцией.
 */
class RemotePlayer {
    constructor(id, username, scene) {
        this.id = id;
        this.username = username || `Игрок_${id.slice(-4)}`;
        this.scene = scene;

        // Буфер позиций для интерполяции (100 мс задержки по ТЗ)
        this.positionBuffer = [];
        this.interpolationDelayMs = 100;

        // Создание 3D-модели аватара
        this.group = new THREE.Group();
        this.group.name = `remote_player_${id}`;

        this._buildAvatarMesh();
        this._buildNameTag();

        this.scene.add(this.group);
    }

    _buildAvatarMesh() {
        // Материалы аватара
        const suitMat = new THREE.MeshStandardMaterial({
            color: 0x3182ce,
            roughness: 0.6,
            metalness: 0.2
        });
        const helmetMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.3,
            metalness: 0.8
        });
        const visorMat = new THREE.MeshStandardMaterial({
            color: 0xebcb8b,
            roughness: 0.1,
            metalness: 0.9
        });
        const backpackMat = new THREE.MeshStandardMaterial({
            color: 0x4c566a,
            roughness: 0.8
        });

        // Тело (скафандр исследователя времени)
        const bodyGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.9, 12);
        const body = new THREE.Mesh(bodyGeo, suitMat);
        body.position.y = 0.85;
        body.castShadow = true;
        this.group.add(body);

        // Голова/Шлем
        const headGeo = new THREE.SphereGeometry(0.28, 16, 16);
        const head = new THREE.Mesh(headGeo, helmetMat);
        head.position.y = 1.5;
        head.castShadow = true;
        this.group.add(head);

        // Визор шлема
        const visorGeo = new THREE.BoxGeometry(0.32, 0.16, 0.18);
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.5, 0.2);
        this.group.add(visor);

        // Рюкзак с приборами
        const packGeo = new THREE.BoxGeometry(0.45, 0.6, 0.25);
        const pack = new THREE.Mesh(packGeo, backpackMat);
        pack.position.set(0, 0.95, -0.28);
        pack.castShadow = true;
        this.group.add(pack);
    }

    _buildNameTag() {
        // Создание 2D-спрайта с именем игрока
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Фон бейджа
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.strokeStyle = '#3182ce';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(10, 10, 236, 44, 12);
        ctx.fill();
        ctx.stroke();

        // Текст никнейма
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.username, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        this.nameSprite = new THREE.Sprite(spriteMat);
        this.nameSprite.position.set(0, 2.1, 0);
        this.nameSprite.scale.set(1.6, 0.4, 1.0);
        this.group.add(this.nameSprite);
    }

    /**
     * Добавление точки состояния от серверного снапшота
     */
    addSnapshot(x, y, z, yaw, timestamp) {
        this.positionBuffer.push({
            x,
            y,
            z,
            yaw,
            time: timestamp || performance.now()
        });

        // Храним в буфере только последние 20 точек (~1-2 сек)
        if (this.positionBuffer.length > 20) {
            this.positionBuffer.shift();
        }
    }

    /**
     * LERP-интерполяция на текущий момент времени
     */
    update(renderTime) {
        if (this.positionBuffer.length === 0) return;

        // Целевое время рендеринга с задержкой интерполяции 100 мс
        const targetTime = renderTime - this.interpolationDelayMs;

        // Если в буфере только 1 точка
        if (this.positionBuffer.length === 1) {
            const p = this.positionBuffer[0];
            this.group.position.set(p.x, p.y || 0, p.z);
            this.group.rotation.y = p.yaw || 0;
            return;
        }

        // Ищем два соседних снапшота (p0 и p1), между которыми находится targetTime
        let p0 = this.positionBuffer[0];
        let p1 = this.positionBuffer[1];

        for (let i = 0; i < this.positionBuffer.length - 1; i++) {
            if (this.positionBuffer[i].time <= targetTime && targetTime <= this.positionBuffer[i + 1].time) {
                p0 = this.positionBuffer[i];
                p1 = this.positionBuffer[i + 1];
                break;
            }
        }

        // Коэффициент интерполяции t [0..1]
        const duration = p1.time - p0.time;
        const alpha = duration > 0 ? THREE.MathUtils.clamp((targetTime - p0.time) / duration, 0, 1) : 1;

        // LERP позиции
        this.group.position.x = THREE.MathUtils.lerp(p0.x, p1.x, alpha);
        this.group.position.y = THREE.MathUtils.lerp(p0.y || 0, p1.y || 0, alpha);
        this.group.position.z = THREE.MathUtils.lerp(p0.z, p1.z, alpha);

        // Плавная интерполяция угла поворота yaw (с учетом перехода через 2*PI)
        const diff = (p1.yaw - p0.yaw + Math.PI) % (Math.PI * 2) - Math.PI;
        this.group.rotation.y = p0.yaw + diff * alpha;
    }

    /**
     * Освобождение ресурсов при удалении игрока
     */
    dispose() {
        this.scene.remove(this.group);
        this.group.traverse((obj) => {
            if (obj.isMesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            } else if (obj.isSprite) {
                if (obj.material) {
                    if (obj.material.map) obj.material.map.dispose();
                    obj.material.dispose();
                }
            }
        });
        this.positionBuffer = [];
    }
}

/**
 * RemotePlayerManager.js
 * Менеджер пула удаленных игроков
 */
export class RemotePlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.players = new Map(); // Map<id, RemotePlayer>
        this.localPlayerId = null;
    }

    setLocalPlayerId(id) {
        this.localPlayerId = id;
    }

    /**
     * Обработка серверного снапшота (world.snapshot)
     * @param {Array} playersList - список игроков из снапшота
     * @param {number} serverTime - серверная временная метка
     */
    applySnapshot(playersList, serverTime) {
        if (!Array.isArray(playersList)) return;

        const activeIds = new Set();
        const now = performance.now();

        playersList.forEach((pData) => {
            // Пропускаем самого себя
            if (pData.id === this.localPlayerId) return;

            activeIds.add(pData.id);

            let player = this.players.get(pData.id);
            if (!player) {
                // Спавним нового удаленного игрока
                player = new RemotePlayer(pData.id, pData.name || pData.username, this.scene);
                this.players.set(pData.id, player);
                console.log(`[RemotePlayerManager] Новый игрок на сцене: ${player.username} (ID: ${pData.id})`);
            }

            // Добавляем точку в буфер интерполяции
            player.addSnapshot(pData.x, pData.y, pData.z, pData.yaw, now);
        });

        // Удаляем игроков, которые вышли из области видимости AOI
        for (const [id, player] of this.players.entries()) {
            if (!activeIds.has(id)) {
                player.dispose();
                this.players.delete(id);
                console.log(`[RemotePlayerManager] Игрок покинул область видимости: ${player.username}`);
            }
        }
    }

    /**
     * Покадровое обновление интерполяции всех игроков
     */
    update() {
        const now = performance.now();
        for (const player of this.players.values()) {
            player.update(now);
        }
    }

    /**
     * Очистка всех игроков (например, при логауте)
     */
    clearAll() {
        for (const player of this.players.values()) {
            player.dispose();
        }
        this.players.clear();
    }
}
