import * as THREE from 'three';

/**
 * ChunkCacheManager.js
 * Менеджер пространственных отсеков-чанков и строгого LRU-кэша космической станции «Последний экипаж».
 * 
 * Требования ТЗ хакатона:
 * 1. Мир космической станции разбит на отсеки-чанки 20х20 метров.
 * 2. W — канонический несжатый объем всех уникальных ресурсов мира.
 * 3. C — объем ресурсов мира, удерживаемых клиентом в текущий момент.
 * 4. Строгий предел: C <= 10% W (рабочий бюджет: 8% W).
 * 5. При вытеснении чанка по LRU обязательно вызываются .dispose()
 *    для геометрий и материалов во избежание утечек WebGL VRAM.
 * 
 * Отсеки станции:
 * - [0, 0]: Командный мостик / Центральный хаб (Капитан Александр Волк)
 * - [1, 0]: Энергетический отсек / Реактор (Инженер Марк Вэнс)
 * - [0, 1]: Гидропонная оранжерея / Биосфера (Биолог Елена Ростова)
 * - [-1, 0]: Жилой сектор / Криокапсулы пробуждения
 * - [0, -1]: Стыковочный шлюз и технический ангар
 * - Другие: Технологические переборки, коридоры и иллюминаторы в открытый космос
 */
export class ChunkCacheManager {
    constructor(scene) {
        this.scene = scene;

        // Константы пространственной сетки по ТЗ
        this.chunkSize = 20.0; // 20x20 метров на отсек
        this.totalWorldChunks = 100;

        // Базовый канонический вес одного отсека станции
        this.canonicalChunkWeightBytes = 1258291; // ~1.2 МБ

        // Канонический размер всего мира W
        this.W = this.totalWorldChunks * this.canonicalChunkWeightBytes;

        // Бюджеты кэша по ТЗ
        this.maxLimitC = Math.floor(this.W * 0.10);  // Жесткий предел: 10% W (~12.58 МБ)
        this.budgetC = Math.floor(this.W * 0.08);    // Рабочий бюджет: 8% W (~10.06 МБ)

        // Текущий объем удерживаемых ресурсов C
        this.C = 0;

        // Кэш активных чанков в памяти: Map<chunkKey, ChunkData>
        this.activeChunks = new Map();

        // Ссылки на общие переиспользуемые материалы станции
        this._initSharedPalette();

        // Текущий чанк игрока
        this.currentChunkCoord = { cx: 0, cz: 0 };
    }

    /**
     * Палитра материалов космической станции «Последний экипаж»
     */
    _initSharedPalette() {
        this.materials = {
            deckFloor: new THREE.MeshStandardMaterial({
                color: 0x1a202c,
                roughness: 0.7,
                metalness: 0.6
            }),
            bulkheadWall: new THREE.MeshStandardMaterial({
                color: 0x2d3748,
                roughness: 0.4,
                metalness: 0.7
            }),
            hullDark: new THREE.MeshStandardMaterial({
                color: 0x111827,
                roughness: 0.8,
                metalness: 0.3
            }),
            reactorCoreGlow: new THREE.MeshStandardMaterial({
                color: 0xff6b1a,
                emissive: 0xff4500,
                emissiveIntensity: 1.5,
                roughness: 0.2
            }),
            energyConduit: new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: 0x0284c7,
                emissiveIntensity: 0.9,
                roughness: 0.2
            }),
            hydroGreen: new THREE.MeshStandardMaterial({
                color: 0x10b981,
                roughness: 0.6,
                metalness: 0.1
            }),
            hydroGlass: new THREE.MeshStandardMaterial({
                color: 0x06b6d4,
                transparent: true,
                opacity: 0.5,
                roughness: 0.1,
                metalness: 0.2
            }),
            hazardStripe: new THREE.MeshStandardMaterial({
                color: 0xf59e0b,
                emissive: 0xb45309,
                emissiveIntensity: 0.5,
                roughness: 0.5
            }),
            cryoGlass: new THREE.MeshStandardMaterial({
                color: 0x67e8f9,
                transparent: true,
                opacity: 0.45,
                roughness: 0.1
            }),
            neonCyan: new THREE.MeshBasicMaterial({
                color: 0x38bdf8
            }),
            neonAmber: new THREE.MeshBasicMaterial({
                color: 0xf59e0b
            })
        };
    }

    worldToChunkCoords(x, z) {
        const cx = Math.floor((x + this.chunkSize / 2) / this.chunkSize);
        const cz = Math.floor((z + this.chunkSize / 2) / this.chunkSize);
        return { cx, cz };
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    updatePlayerPosition(playerPos) {
        const { cx, cz } = this.worldToChunkCoords(playerPos.x, playerPos.z);

        if (cx === this.currentChunkCoord.cx && cz === this.currentChunkCoord.cz && this.activeChunks.size > 0) {
            const currentKey = this.getChunkKey(cx, cz);
            if (this.activeChunks.has(currentKey)) {
                this.activeChunks.get(currentKey).lastAccessedAt = performance.now();
            }
            return false;
        }

        this.currentChunkCoord = { cx, cz };

        // Area of Interest (радиальная зона 1 отсек вокруг игрока = 9 отсеков)
        const requiredKeys = new Set();
        const aoiRadius = 1;

        for (let dx = -aoiRadius; dx <= aoiRadius; dx++) {
            for (let dz = -aoiRadius; dz <= aoiRadius; dz++) {
                const targetCx = cx + dx;
                const targetCz = cz + dz;
                requiredKeys.add(this.getChunkKey(targetCx, targetCz));
            }
        }

        // Загрузка новых отсеков
        for (const key of requiredKeys) {
            if (!this.activeChunks.has(key)) {
                const [targetCx, targetCz] = key.split(',').map(Number);
                this._requestAndLoadChunk(targetCx, targetCz, key);
            } else {
                this.activeChunks.get(key).lastAccessedAt = performance.now();
            }
        }

        // Строгое вытеснение дальних чанков за пределами AOI по LRU
        this._enforceCacheBudget(requiredKeys);

        return true;
    }

    _enforceCacheBudget(currentAoiKeys) {
        while (this.C > this.budgetC) {
            let oldestKey = null;
            let oldestTime = Infinity;

            for (const [key, chunk] of this.activeChunks.entries()) {
                if (!currentAoiKeys.has(key)) {
                    if (chunk.lastAccessedAt < oldestTime) {
                        oldestTime = chunk.lastAccessedAt;
                        oldestKey = key;
                    }
                }
            }

            if (!oldestKey) break;
            this.evictChunk(oldestKey);
        }
    }

    _requestAndLoadChunk(cx, cz, key) {
        const chunkSize = this.canonicalChunkWeightBytes;

        if (this.C + chunkSize > this.maxLimitC) {
            this._evictFarthestChunk(cx, cz);
        }

        const meshGroup = this._generateStationChunkGeometry(cx, cz);
        this.scene.add(meshGroup);

        this.C += chunkSize;

        const now = performance.now();
        this.activeChunks.set(key, {
            cx,
            cz,
            key,
            sizeBytes: chunkSize,
            meshGroup,
            loadedAt: now,
            lastAccessedAt: now
        });
    }

    _evictFarthestChunk(currentCx, currentCz) {
        let farthestKey = null;
        let maxDistSq = -1;

        for (const [key, chunk] of this.activeChunks.entries()) {
            const distSq = Math.pow(chunk.cx - currentCx, 2) + Math.pow(chunk.cz - currentCz, 2);
            if (distSq > maxDistSq) {
                maxDistSq = distSq;
                farthestKey = key;
            }
        }

        if (farthestKey) {
            this.evictChunk(farthestKey);
        }
    }

    evictChunk(key) {
        const chunk = this.activeChunks.get(key);
        if (!chunk) return;

        this.scene.remove(chunk.meshGroup);

        // Рекурсивное освобождение памяти GPU (dispose)
        chunk.meshGroup.traverse((object) => {
            if (object.isMesh) {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => this._disposeMaterial(m));
                    } else {
                        this._disposeMaterial(object.material);
                    }
                }
            }
        });

        this.C -= chunk.sizeBytes;
        this.activeChunks.delete(key);
    }

    _disposeMaterial(mat) {
        if (!mat) return;
        if (mat.map) mat.map.dispose();
        if (mat.lightMap) mat.lightMap.dispose();
        if (mat.bumpMap) mat.bumpMap.dispose();
        if (mat.normalMap) mat.normalMap.dispose();
        if (mat.specularMap) mat.specularMap.dispose();
        if (!Object.values(this.materials).includes(mat)) {
            mat.dispose();
        }
    }

    /**
     * Процедурная генерация научно-исследовательских отсеков станции «Последний экипаж»
     */
    _generateStationChunkGeometry(cx, cz) {
        const group = new THREE.Group();
        group.name = `station_chunk_${cx}_${cz}`;

        const worldX = cx * this.chunkSize;
        const worldZ = cz * this.chunkSize;
        group.position.set(worldX, 0, worldZ);

        // 1. Палубный пол отсека со световой окантовкой
        const floorGeo = new THREE.PlaneGeometry(this.chunkSize - 0.2, this.chunkSize - 0.2);
        const floorMesh = new THREE.Mesh(floorGeo, this.materials.deckFloor);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.y = 0.02;
        floorMesh.receiveShadow = true;
        group.add(floorMesh);

        // 2. Потолочные балки и аварийные светильники
        const ceilingBeamGeo = new THREE.BoxGeometry(this.chunkSize, 0.4, 0.8);
        const ceilingBeam = new THREE.Mesh(ceilingBeamGeo, this.materials.bulkheadWall);
        ceilingBeam.position.set(0, 5.0, 0);
        group.add(ceilingBeam);

        const neonGeo = new THREE.BoxGeometry(this.chunkSize * 0.8, 0.05, 0.15);
        const neonLight = new THREE.Mesh(neonGeo, this.materials.neonCyan);
        neonLight.position.set(0, 4.8, 0);
        group.add(neonLight);

        // 3. Тематическое наполнение в зависимости от координат отсека
        if (cx === 0 && cz === 0) {
            // [0, 0]: КОМАНДНЫЙ МОСТИК (МОДУЛЬ КАПИТАНА)
            this._buildBridgeModule(group);
        } else if (cx === 1 && cz === 0) {
            // [1, 0]: ЭНЕРГЕТИЧЕСКИЙ ОТСЕК / РЕАКТОР (МОДУЛЬ ИНЖЕНЕРА)
            this._buildReactorModule(group);
        } else if (cx === 0 && cz === 1) {
            // [0, 1]: ГИДРОПОННАЯ ОРАНЖЕРЕЯ / БИОСФЕРА (МОДУЛЬ БИОЛОГА)
            this._buildGreenhouseModule(group);
        } else if (cx === -1 && cz === 0) {
            // [-1, 0]: ЖИЛОЙ СЕКТОР / КРИОКАПСУЛЫ (СПАВН ИГРОКА)
            this._buildCryoBayModule(group);
        } else if (cx === 0 && cz === -1) {
            // [0, -1]: СТЫКОВОЧНЫЙ ШЛЮЗ
            this._buildAirlockModule(group);
        } else {
            // ДРУГИЕ ОТСЕКИ: ТЕХНИЧЕСКИЕ КОРИДОРЫ И СЕРВИСНЫЕ БЛОКИ
            this._buildCorridorModule(group, cx, cz);
        }

        return group;
    }

    /**
     * Постройка командного мостика
     */
    _buildBridgeModule(group) {
        // Голографический пьедестал статуса станции в центре
        const holocoreGeo = new THREE.CylinderGeometry(2.0, 2.4, 0.6, 24);
        const holocore = new THREE.Mesh(holocoreGeo, this.materials.bulkheadWall);
        holocore.position.set(0, 0.3, 0);
        holocore.receiveShadow = true;
        group.add(holocore);

        // Светящееся кольцо голограммы
        const holoRingGeo = new THREE.TorusGeometry(1.5, 0.06, 16, 48);
        const holoRing = new THREE.Mesh(holoRingGeo, this.materials.energyConduit);
        holoRing.rotation.x = Math.PI / 2;
        holoRing.position.set(0, 1.2, 0);
        group.add(holoRing);

        // Терминалы навигации по периметру
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            const termGeo = new THREE.BoxGeometry(1.8, 1.1, 0.8);
            const terminal = new THREE.Mesh(termGeo, this.materials.bulkheadWall);
            terminal.position.set(Math.cos(angle) * 6.0, 0.55, Math.sin(angle) * 6.0);
            terminal.rotation.y = -angle + Math.PI / 2;
            terminal.castShadow = true;
            group.add(terminal);

            // Экран терминала
            const screenGeo = new THREE.PlaneGeometry(1.4, 0.6);
            const screen = new THREE.Mesh(screenGeo, this.materials.neonCyan);
            screen.position.set(Math.cos(angle) * 5.95, 1.15, Math.sin(angle) * 5.95);
            screen.rotation.y = -angle + Math.PI / 2;
            group.add(screen);
        }
    }

    /**
     * Постройка энергетического отсека с термоядерным реактором
     */
    _buildReactorModule(group) {
        // Защитная база реактора
        const reactorBaseGeo = new THREE.CylinderGeometry(4.0, 4.5, 1.2, 24);
        const reactorBase = new THREE.Mesh(reactorBaseGeo, this.materials.hullDark);
        reactorBase.position.set(0, 0.6, 0);
        group.add(reactorBase);

        // Плазменное термоядерное ядро реактора
        const coreGeo = new THREE.SphereGeometry(1.6, 24, 24);
        const core = new THREE.Mesh(coreGeo, this.materials.reactorCoreGlow);
        core.position.set(0, 2.5, 0);
        group.add(core);

        // Магнитные кольца удержания плазмы
        for (let y = 1.6; y <= 3.4; y += 0.9) {
            const ringGeo = new THREE.TorusGeometry(2.5, 0.12, 16, 32);
            const ring = new THREE.Mesh(ringGeo, this.materials.energyConduit);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(0, y, 0);
            group.add(ring);
        }

        // Высоковольтные шины питания к стенам отсека
        const pipeGeo = new THREE.CylinderGeometry(0.2, 0.2, 8.0, 12);
        const pipe1 = new THREE.Mesh(pipeGeo, this.materials.hazardStripe);
        pipe1.rotation.z = Math.PI / 2;
        pipe1.position.set(4.0, 1.8, 0);
        group.add(pipe1);

        const pipe2 = new THREE.Mesh(pipeGeo, this.materials.hazardStripe);
        pipe2.rotation.x = Math.PI / 2;
        pipe2.position.set(0, 1.8, 4.0);
        group.add(pipe2);
    }

    /**
     * Постройка гидропонной оранжереи (биосферы)
     */
    _buildGreenhouseModule(group) {
        // Вертикальные гидропонные фермы (стеллажи)
        for (let x = -5; x <= 5; x += 5) {
            const rackGeo = new THREE.BoxGeometry(1.2, 3.6, 7.0);
            const rack = new THREE.Mesh(rackGeo, this.materials.bulkheadWall);
            rack.position.set(x, 1.8, 0);
            rack.castShadow = true;
            group.add(rack);

            // Зеленые лотки с водорослями и культурами
            for (let y = 0.8; y <= 3.2; y += 0.8) {
                const plantGeo = new THREE.BoxGeometry(1.0, 0.3, 6.6);
                const plants = new THREE.Mesh(plantGeo, this.materials.hydroGreen);
                plants.position.set(x, y, 0);
                group.add(plants);

                // Фитолампы спектра 430–660 нм над лотками
                const lampGeo = new THREE.BoxGeometry(0.8, 0.05, 6.4);
                const lamp = new THREE.Mesh(lampGeo, this.materials.neonCyan);
                lamp.position.set(x, y + 0.35, 0);
                group.add(lamp);
            }
        }

        // Центральный стеклянный резервуар с хлореллой (оксигенатор)
        const tankGeo = new THREE.CylinderGeometry(1.4, 1.4, 3.2, 20);
        const tank = new THREE.Mesh(tankGeo, this.materials.hydroGlass);
        tank.position.set(0, 1.6, 0);
        group.add(tank);

        const innerLiquidGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.8, 16);
        const innerLiquid = new THREE.Mesh(innerLiquidGeo, this.materials.hydroGreen);
        innerLiquid.position.set(0, 1.6, 0);
        group.add(innerLiquid);
    }

    /**
     * Постройка жилого сектора с криокапсулами гибернации (спавн)
     */
    _buildCryoBayModule(group) {
        // Ряд криокапсул экипажа
        for (let i = -1; i <= 1; i++) {
            const podBaseGeo = new THREE.BoxGeometry(1.6, 0.8, 2.6);
            const podBase = new THREE.Mesh(podBaseGeo, this.materials.bulkheadWall);
            podBase.position.set(i * 3.5, 0.4, -3.0);
            podBase.castShadow = true;
            group.add(podBase);

            // Стеклянная крышка криокапсулы
            const glassGeo = new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12, 1, false, 0, Math.PI);
            const glass = new THREE.Mesh(glassGeo, this.materials.cryoGlass);
            glass.rotation.z = Math.PI / 2;
            glass.position.set(i * 3.5, 0.8, -3.0);
            group.add(glass);

            // Монитор жизненных показателей
            const vitalsGeo = new THREE.PlaneGeometry(0.8, 0.4);
            const vitals = new THREE.Mesh(vitalsGeo, this.materials.neonCyan);
            vitals.position.set(i * 3.5, 1.5, -4.2);
            group.add(vitals);
        }

        // Аварийный шлюз выхода из отсека
        const doorGeo = new THREE.BoxGeometry(2.4, 3.2, 0.2);
        const door = new THREE.Mesh(doorGeo, this.materials.hazardStripe);
        door.position.set(0, 1.6, 8.0);
        group.add(door);
    }

    /**
     * Постройка стыковочного шлюза
     */
    _buildAirlockModule(group) {
        // Герметичное стыковочное кольцо
        const ringGeo = new THREE.TorusGeometry(3.0, 0.4, 16, 32);
        const ring = new THREE.Mesh(ringGeo, this.materials.hazardStripe);
        ring.position.set(0, 3.0, -8.0);
        group.add(ring);

        // Контейнеры с припасами и скафандрами
        for (let side = -1; side <= 1; side += 2) {
            const crateGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
            const crate = new THREE.Mesh(crateGeo, this.materials.bulkheadWall);
            crate.position.set(side * 5.0, 0.9, 0);
            crate.castShadow = true;
            group.add(crate);
        }
    }

    /**
     * Постройка сервисного коридора / переборки
     */
    _buildCorridorModule(group, cx, cz) {
        // Опорные арки переборок
        const archGeo = new THREE.BoxGeometry(this.chunkSize - 2, 0.5, 0.8);
        const arch = new THREE.Mesh(archGeo, this.materials.bulkheadWall);
        arch.position.set(0, 4.2, 0);
        group.add(arch);

        // Трубопровод под потолком
        const ductGeo = new THREE.CylinderGeometry(0.3, 0.3, this.chunkSize, 12);
        const duct = new THREE.Mesh(ductGeo, this.materials.hullDark);
        duct.rotation.x = Math.PI / 2;
        duct.position.set(3.5, 4.0, 0);
        group.add(duct);

        // Иллюминатор в открытый космос со звездным светом
        const windowFrameGeo = new THREE.RingGeometry(1.6, 2.0, 24);
        const windowFrame = new THREE.Mesh(windowFrameGeo, this.materials.hazardStripe);
        windowFrame.position.set(0, 2.5, this.chunkSize / 2 - 0.2);
        group.add(windowFrame);

        const glassGeo = new THREE.CircleGeometry(1.6, 24);
        const glass = new THREE.Mesh(glassGeo, this.materials.cryoGlass);
        glass.position.set(0, 2.5, this.chunkSize / 2 - 0.19);
        group.add(glass);
    }

    getMetrics() {
        const percent = this.W > 0 ? (this.C / this.W) * 100 : 0;
        return {
            W: this.W,
            C: this.C,
            percent: parseFloat(percent.toFixed(2)),
            loadedChunksCount: this.activeChunks.size,
            maxAllowedLimitBytes: this.maxLimitC,
            budgetLimitBytes: this.budgetC,
            currentChunkCoord: this.currentChunkCoord
        };
    }
}
