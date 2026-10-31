import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

/**
 * ChunkCacheManager.js
 * Менеджер пространственных отсеков-чанков и строгого LRU-кэша космического корабля «Горизонт-7».
 * 
 * Требования ТЗ хакатона:
 * 1. Мир космической станции разбит на отсеки-чанки 20х20 метров.
 * 2. W — канонический несжатый объем всех уникальных ресурсов мира (~125.8 МБ).
 * 3. C — объем ресурсов мира, удерживаемых клиентом в текущий момент.
 * 4. Строгий предел: C <= 10% W (рабочий бюджет: 8% W).
 * 5. При вытеснении чанка по LRU обязательно вызываются .dispose()
 *    для геометрий и материалов во избежание утечек WebGL VRAM.
 * 
 * Отсеки станции «Горизонт-7»:
 * - [0, 0]: Командный мостик (Капитан Александр Волк, панель управления, кресло капитана, Юпитер)
 * - [0, -1]: Камбуз и кухня экипажа (Пищевой синтезатор, холодильник, обеденный стол, стулья)
 * - [-1, 1]: Комната отдыха и спальные каюты (Мягкий диван, журнальный столик, ТВ с пейзажем Земли, двухъярусные кровати)
 * - [-1, 0]: Физическая лаборатория СТО (Альберт Эйнштейн, релятивистские световые часы, фотонный луч)
 * - [1, 1]: Павильон Истории и Архив (Геродот Галикарнасский, свитки папируса, кристалл АСТРА)
 * - [1, 0]: Реакторный отсек (Марк Вэнс, Токамак, плазма, верстак с инструментами)
 * - [0, 1]: Оранжерея и биолаборатория (Елена Ростова, гидропоника 430 нм, Chlorella vulgaris)
 * - [1, -1]: Шлюзовой отсек (Скафандры, аварийный челнок)
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

        // Общие переиспользуемые материалы станции с процедурными текстурами
        this._initSharedPalette();

        // Текущий чанк игрока
        this.currentChunkCoord = { cx: 0, cz: 0 };
    }

    _initSharedPalette() {
        this.materials = {
            deckFloor: new THREE.MeshStandardMaterial({
                color: 0x161e2e,
                roughness: 0.7,
                metalness: 0.6
            }),
            bulkheadWall: new THREE.MeshStandardMaterial({
                color: 0x242f3d,
                roughness: 0.4,
                metalness: 0.7
            }),
            hullDark: new THREE.MeshStandardMaterial({
                color: 0x0f172a,
                roughness: 0.8,
                metalness: 0.4
            }),
            reactorCoreGlow: new THREE.MeshStandardMaterial({
                color: 0xff5500,
                emissive: 0xff3300,
                emissiveIntensity: 1.8,
                roughness: 0.2
            }),
            energyConduit: new THREE.MeshStandardMaterial({
                color: 0x00f5ff,
                emissive: 0x0284c7,
                emissiveIntensity: 1.0,
                roughness: 0.2
            }),
            hydroGreen: new THREE.MeshStandardMaterial({
                color: 0x10b981,
                emissive: 0x047857,
                emissiveIntensity: 0.3,
                roughness: 0.6,
                metalness: 0.1
            }),
            hydroGlass: new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.45,
                roughness: 0.1,
                metalness: 0.3
            }),
            growLight430nm: new THREE.MeshStandardMaterial({
                color: 0x8b5cf6,
                emissive: 0x7c3aed,
                emissiveIntensity: 1.5,
                roughness: 0.2
            }),
            hazardStripe: new THREE.MeshStandardMaterial({
                color: 0xf59e0b,
                emissive: 0xb45309,
                emissiveIntensity: 0.6,
                roughness: 0.5
            }),
            cryoGlass: new THREE.MeshStandardMaterial({
                color: 0x67e8f9,
                transparent: true,
                opacity: 0.45,
                roughness: 0.1
            }),
            jupiterAtmosphere: new THREE.MeshStandardMaterial({
                color: 0xd97706,
                roughness: 0.9,
                metalness: 0.1
            }),
            batteryCell: new THREE.MeshStandardMaterial({
                color: 0x06b6d4,
                emissive: 0x0891b2,
                emissiveIntensity: 1.2,
                roughness: 0.2,
                metalness: 0.8
            }),
            meteoriteFragment: new THREE.MeshStandardMaterial({
                color: 0x64748b,
                emissive: 0x94a3b8,
                emissiveIntensity: 0.3,
                roughness: 0.8,
                metalness: 0.9
            }),
            // Новые богатые материалы с процедурными Canvas-текстурами:
            fabricCouch: new THREE.MeshStandardMaterial({
                map: TextureGenerator.createFabricTexture('#1e293b', '#334155'),
                roughness: 0.85
            }),
            fabricCushion: new THREE.MeshStandardMaterial({
                color: 0x0284c7,
                roughness: 0.7
            }),
            tableWood: new THREE.MeshStandardMaterial({
                map: TextureGenerator.createWoodTexture('#3e2723', '#5d4037'),
                roughness: 0.4,
                metalness: 0.1
            }),
            brushedSteel: new THREE.MeshStandardMaterial({
                map: TextureGenerator.createBrushedMetalTexture(),
                roughness: 0.35,
                metalness: 0.85
            }),
            tvScreenLandscape: new THREE.MeshBasicMaterial({
                map: TextureGenerator.createEarthLandscapeTexture()
            }),
            cockpitConsole: new THREE.MeshStandardMaterial({
                map: TextureGenerator.createCockpitPanelTexture(),
                roughness: 0.4,
                metalness: 0.7
            }),
            papyrusScroll: new THREE.MeshStandardMaterial({
                map: TextureGenerator.createPapyrusTexture(),
                roughness: 0.85
            }),
            leatherChair: new THREE.MeshStandardMaterial({
                color: 0x18181b,
                roughness: 0.5,
                metalness: 0.2
            }),
            mirrorPolish: new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.05,
                metalness: 0.95
            }),
            photonBeam: new THREE.MeshBasicMaterial({
                color: 0x38bdf8
            }),
            ancientMarble: new THREE.MeshStandardMaterial({
                color: 0xf1f5f9,
                roughness: 0.25,
                metalness: 0.1
            }),
            neonCyan: new THREE.MeshBasicMaterial({ color: 0x00f5ff }),
            neonAmber: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
            neonPurple: new THREE.MeshBasicMaterial({ color: 0xa855f7 })
        };
    }

    getMetrics() {
        const percent = (this.W > 0) ? ((this.C / this.W) * 100).toFixed(2) : '0.00';
        return {
            W: this.W,
            C: this.C,
            percent: parseFloat(percent),
            loadedChunksCount: this.activeChunks.size,
            currentChunkCoord: this.currentChunkCoord
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

    updateAnimation(time) {
        for (const chunk of this.activeChunks.values()) {
            if (chunk.animators) {
                for (let i = 0; i < chunk.animators.length; i++) {
                    chunk.animators[i](time);
                }
            }
        }
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

        const { group: meshGroup, animators } = this._generateStationChunkGeometry(cx, cz);
        this.scene.add(meshGroup);

        this.C += chunkSize;

        const now = performance.now();
        this.activeChunks.set(key, {
            cx,
            cz,
            key,
            sizeBytes: chunkSize,
            meshGroup,
            animators,
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

    evictChunk(chunkKey) {
        const chunk = this.activeChunks.get(chunkKey);
        if (!chunk) return;

        this.scene.remove(chunk.meshGroup);

        // Рекурсивный dispose всех геометрий и текстур
        chunk.meshGroup.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
            } else if (child.isPoints) {
                if (child.geometry) child.geometry.dispose();
            } else if (child.isLine) {
                if (child.geometry) child.geometry.dispose();
            }
        });

        this.C -= chunk.sizeBytes;
        this.activeChunks.delete(chunkKey);
    }

    _generateStationChunkGeometry(cx, cz) {
        const group = new THREE.Group();
        group.name = `chunk_${cx}_${cz}`;
        group.position.set(cx * this.chunkSize, 0, cz * this.chunkSize);

        const animators = [];

        // 1. Пол отсека
        const floorGeo = new THREE.BoxGeometry(this.chunkSize, 0.4, this.chunkSize);
        const floor = new THREE.Mesh(floorGeo, this.materials.deckFloor);
        floor.position.y = -0.2;
        floor.receiveShadow = true;
        group.add(floor);

        // 2. Потолок
        const ceilingGeo = new THREE.BoxGeometry(this.chunkSize, 0.4, this.chunkSize);
        const ceiling = new THREE.Mesh(ceilingGeo, this.materials.hullDark);
        ceiling.position.y = 5.0;
        group.add(ceiling);

        // 3. Отсеки корабля «Горизонт-7»
        if (cx === 0 && cz === 0) {
            // [0, 0]: КОМАНДНЫЙ МОСТИК
            this._buildBridgeModule(group, animators);
        } else if (cx === 0 && cz === -1) {
            // [0, -1]: КАМБУЗ И КУХНЯ ЭКИПАЖА
            this._buildGalleyKitchenModule(group, animators);
        } else if (cx === -1 && cz === 1) {
            // [-1, 1]: КОМНАТА ОТДЫХА И СПАЛЬНЫЕ КАЮТЫ
            this._buildCrewLoungeModule(group, animators);
        } else if (cx === -1 && cz === 0) {
            // [-1, 0]: ФИЗИЧЕСКАЯ ЛАБОРАТОРИЯ СТО
            this._buildPhysicsLabModule(group, animators);
        } else if (cx === 1 && cz === 1) {
            // [1, 1]: АРХИВ И ПАВИЛЬОН ГЕРОДОТА
            this._buildHistoryArchiveModule(group, animators);
        } else if (cx === 1 && cz === 0) {
            // [1, 0]: РЕАКТОРНЫЙ ОТСЕК
            this._buildReactorModule(group, animators);
        } else if (cx === 0 && cz === 1) {
            // [0, 1]: ГИДРОПОННАЯ ОРАНЖЕРЕЯ
            this._buildGreenhouseModule(group, animators);
        } else if (cx === 1 && cz === -1) {
            // [1, -1]: ШЛЮЗОВОЙ ОТСЕК
            this._buildAirlockModule(group, animators);
        } else {
            // ТЕХНИЧЕСКИЕ КОРИДОРЫ
            this._buildCorridorModule(group, cx, cz, animators);
        }

        return { group, animators };
    }

    /**
     * [0, 0] Командный мостик: панорамный иллюминатор Юпитера, кресло капитана,
     * консоль пилота с текстурой приборов, голостол и терминал расследования
     */
    _buildBridgeModule(group, animators) {
        // Панорамный иллюминатор
        const windowFrameGeo = new THREE.BoxGeometry(14.0, 3.8, 0.4);
        const windowFrame = new THREE.Mesh(windowFrameGeo, this.materials.bulkheadWall);
        windowFrame.position.set(0, 2.5, -9.8);
        group.add(windowFrame);

        const glassGeo = new THREE.PlaneGeometry(13.2, 3.0);
        const glass = new THREE.Mesh(glassGeo, this.materials.cryoGlass);
        glass.position.set(0, 2.5, -9.6);
        group.add(glass);

        // Модель Юпитера за окном
        const jupiterGeo = new THREE.SphereGeometry(14.0, 36, 36);
        const jupiter = new THREE.Mesh(jupiterGeo, this.materials.jupiterAtmosphere);
        jupiter.position.set(12.0, 8.0, -42.0);
        group.add(jupiter);

        // Атмосферные полосы Юпитера
        const bands = [];
        for (let b = -3; b <= 3; b += 2) {
            const bandGeo = new THREE.TorusGeometry(14.1, 0.6, 12, 48);
            const bandMat = new THREE.MeshBasicMaterial({ 
                color: b % 2 === 0 ? 0x92400e : 0xfbbf24, 
                transparent: true, 
                opacity: 0.65 
            });
            const band = new THREE.Mesh(bandGeo, bandMat);
            band.rotation.x = Math.PI / 2 + 0.15;
            band.position.set(12.0, 8.0 + b * 2.0, -42.0);
            group.add(band);
            bands.push({ mesh: band, speed: (b % 2 === 0 ? 0.015 : -0.012) });
        }

        animators.push((time) => {
            jupiter.rotation.y = time * 0.02;
            bands.forEach(b => {
                b.mesh.rotation.z = time * b.speed;
            });
        });

        // ГЛАВНАЯ ПАНЕЛЬ УПРАВЛЕНИЯ МОСТИКА (с текстурой приборной панели)
        const consoleGeo = new THREE.BoxGeometry(6.0, 1.1, 1.4);
        const consoleMesh = new THREE.Mesh(consoleGeo, this.materials.cockpitConsole);
        consoleMesh.position.set(0, 0.8, -7.0);
        consoleMesh.rotation.x = 0.2;
        consoleMesh.castShadow = true;
        consoleMesh.userData = {
            interactable: true,
            type: 'bridge_console',
            name: 'Главная консоль управления станцией'
        };
        group.add(consoleMesh);

        // КРЕСЛО КАПИТАНА (эргономичное кожаное кресло со спинкой и подлокотниками)
        const chairGroup = new THREE.Group();
        chairGroup.position.set(0, 0, -5.2);

        // База и опора кресла
        const baseGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.1, 16);
        const baseMesh = new THREE.Mesh(baseGeo, this.materials.brushedSteel);
        chairGroup.add(baseMesh);

        const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12);
        const poleMesh = new THREE.Mesh(poleGeo, this.materials.brushedSteel);
        poleMesh.position.y = 0.25;
        chairGroup.add(poleMesh);

        // Сиденье
        const seatGeo = new THREE.BoxGeometry(0.8, 0.15, 0.75);
        const seatMesh = new THREE.Mesh(seatGeo, this.materials.leatherChair);
        seatMesh.position.y = 0.55;
        chairGroup.add(seatMesh);

        // Спинка
        const backGeo = new THREE.BoxGeometry(0.75, 0.9, 0.14);
        const backMesh = new THREE.Mesh(backGeo, this.materials.leatherChair);
        backMesh.position.set(0, 1.05, 0.32);
        backMesh.rotation.x = -0.1;
        chairGroup.add(backMesh);

        // Подлокотники
        for (const side of [-0.44, 0.44]) {
            const armGeo = new THREE.BoxGeometry(0.12, 0.08, 0.5);
            const armMesh = new THREE.Mesh(armGeo, this.materials.leatherChair);
            armMesh.position.set(side, 0.85, 0.05);
            chairGroup.add(armMesh);

            const supportGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8);
            const supportMesh = new THREE.Mesh(supportGeo, this.materials.brushedSteel);
            supportMesh.position.set(side, 0.7, 0.05);
            chairGroup.add(supportMesh);
        }
        group.add(chairGroup);

        // Тактический стол с 3D-траекторией
        const tableGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.9, 20);
        const table = new THREE.Mesh(tableGeo, this.materials.bulkheadWall);
        table.position.set(0, 0.45, 3.5);
        table.receiveShadow = true;
        group.add(table);

        const holoscreenGeo = new THREE.PlaneGeometry(1.6, 1.0);
        const holoscreen = new THREE.Mesh(holoscreenGeo, this.materials.neonCyan);
        holoscreen.position.set(0, 1.25, 3.5);
        holoscreen.rotation.x = -Math.PI / 6;
        group.add(holoscreen);

        // Анимированный микро-челнок на траектории
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.9, 1.05, 3.1),
            new THREE.Vector3(0.0, 1.55, 3.5),
            new THREE.Vector3(0.9, 1.05, 3.9)
        );
        const points = curve.getPoints(32);
        const orbitLineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const orbitLineMat = new THREE.LineBasicMaterial({ color: 0x00f5ff, linewidth: 2 });
        const orbitLine = new THREE.Line(orbitLineGeo, orbitLineMat);
        group.add(orbitLine);

        const holoShipGeo = new THREE.ConeGeometry(0.06, 0.16, 6);
        const holoShipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const holoShip = new THREE.Mesh(holoShipGeo, holoShipMat);
        holoShip.rotation.x = Math.PI / 2;
        group.add(holoShip);

        animators.push((time) => {
            const t = (time * 0.2) % 1.0;
            const pt = curve.getPoint(t);
            holoShip.position.copy(pt);
        });

        // Терминал расследования
        const termGeo = new THREE.BoxGeometry(2.0, 1.2, 0.8);
        const term = new THREE.Mesh(termGeo, this.materials.bulkheadWall);
        term.position.set(-6.5, 0.6, 0);
        term.rotation.y = Math.PI / 2;
        term.userData = {
            interactable: true,
            type: 'investigation_terminal',
            name: 'Терминал расследования аварии'
        };
        group.add(term);
    }

    /**
     * [0, -1] Камбуз и кухня экипажа: кухонный гарнитур, раковина из стали,
     * пищевой синтезатор, холодильник, обеденный стол со стульями, термокружками и пайками
     */
    _buildGalleyKitchenModule(group, animators) {
        // 1. Кухонный блок столешницы (вдоль левой стены X = -7.5)
        const counterGeo = new THREE.BoxGeometry(1.8, 1.0, 7.0);
        const counterMesh = new THREE.Mesh(counterGeo, this.materials.bulkheadWall);
        counterMesh.position.set(-7.5, 0.5, 0);
        counterMesh.castShadow = true;
        group.add(counterMesh);

        // Столешница из шлифованной стали
        const topGeo = new THREE.BoxGeometry(1.9, 0.08, 7.1);
        const topMesh = new THREE.Mesh(topGeo, this.materials.brushedSteel);
        topMesh.position.set(-7.5, 1.04, 0);
        group.add(topMesh);

        // Мойка / раковина
        const sinkGeo = new THREE.BoxGeometry(1.1, 0.4, 1.4);
        const sinkMesh = new THREE.Mesh(sinkGeo, this.materials.brushedSteel);
        sinkMesh.position.set(-7.4, 0.9, -1.8);
        group.add(sinkMesh);

        // Кран смесителя
        const faucetGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
        const faucetMesh = new THREE.Mesh(faucetGeo, this.materials.brushedSteel);
        faucetMesh.position.set(-8.1, 1.3, -1.8);
        group.add(faucetMesh);

        // 2. ПИЩЕВОЙ СИНТЕЗАТОР РАЦИОНОВ
        const synthGeo = new THREE.BoxGeometry(1.4, 1.2, 1.6);
        const synthMesh = new THREE.Mesh(synthGeo, this.materials.hullDark);
        synthMesh.position.set(-7.5, 1.68, 1.5);
        synthMesh.castShadow = true;
        synthMesh.userData = {
            interactable: true,
            type: 'synthesizer',
            name: 'Пищевой синтезатор пайков'
        };
        group.add(synthMesh);

        const synthScreenGeo = new THREE.PlaneGeometry(0.8, 0.4);
        const synthScreen = new THREE.Mesh(synthScreenGeo, this.materials.neonCyan);
        synthScreen.position.set(-6.79, 1.8, 1.5);
        synthScreen.rotation.y = Math.PI / 2;
        group.add(synthScreen);

        // 3. ХОЛОДИЛЬНИК ЭКИПАЖА
        const fridgeGeo = new THREE.BoxGeometry(1.4, 2.6, 1.8);
        const fridgeMesh = new THREE.Mesh(fridgeGeo, this.materials.brushedSteel);
        fridgeMesh.position.set(-7.5, 1.3, 5.0);
        fridgeMesh.castShadow = true;
        fridgeMesh.userData = {
            interactable: true,
            type: 'refrigerator',
            name: 'Холодильник экипажа (+3.4°C)'
        };
        group.add(fridgeMesh);

        // Цифровой датчик температуры холодильника
        const tempGeo = new THREE.PlaneGeometry(0.4, 0.2);
        const tempMesh = new THREE.Mesh(tempGeo, this.materials.neonAmber);
        tempMesh.position.set(-6.79, 2.0, 5.0);
        tempMesh.rotation.y = Math.PI / 2;
        group.add(tempMesh);

        // 4. ОБЕДЕННЫЙ СТОЛ (Деревянная текстура)
        const tableGroup = new THREE.Group();
        tableGroup.position.set(1.5, 0, 0);

        const tableTopGeo = new THREE.BoxGeometry(3.6, 0.1, 2.2);
        const tableTop = new THREE.Mesh(tableTopGeo, this.materials.tableWood);
        tableTop.position.y = 0.85;
        tableTop.castShadow = true;
        tableGroup.add(tableTop);

        // Ножки стола
        for (const [lx, lz] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) {
            const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.85, 8);
            const leg = new THREE.Mesh(legGeo, this.materials.brushedSteel);
            leg.position.set(lx, 0.425, lz);
            tableGroup.add(leg);
        }

        // Посуда на столе: термокружки и пайки
        for (let m = -0.8; m <= 0.8; m += 0.8) {
            const mugGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.14, 10);
            const mug = new THREE.Mesh(mugGeo, this.materials.hazardStripe);
            mug.position.set(m, 0.97, 0.4);
            tableGroup.add(mug);

            const packGeo = new THREE.BoxGeometry(0.24, 0.05, 0.35);
            const pack = new THREE.Mesh(packGeo, this.materials.cryoGlass);
            pack.position.set(m, 0.93, -0.4);
            tableGroup.add(pack);
        }

        // 4 стула вокруг стола
        for (const [cx, cz, ry] of [[0, -1.5, 0], [0, 1.5, Math.PI], [-2.3, 0, Math.PI / 2], [2.3, 0, -Math.PI / 2]]) {
            const chair = this._createDiningChair();
            chair.position.set(cx, 0, cz);
            chair.rotation.y = ry;
            tableGroup.add(chair);
        }

        group.add(tableGroup);

        // Теплый потолочный светильник над столом (3000K)
        const lampLight = new THREE.PointLight(0xffedd5, 1.6, 12);
        lampLight.position.set(1.5, 3.2, 0);
        group.add(lampLight);
    }

    _createDiningChair() {
        const chair = new THREE.Group();
        const seatGeo = new THREE.BoxGeometry(0.65, 0.08, 0.65);
        const seat = new THREE.Mesh(seatGeo, this.materials.fabricCushion);
        seat.position.y = 0.48;
        chair.add(seat);

        const backGeo = new THREE.BoxGeometry(0.65, 0.65, 0.06);
        const back = new THREE.Mesh(backGeo, this.materials.bulkheadWall);
        back.position.set(0, 0.82, -0.3);
        chair.add(back);

        for (const [lx, lz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
            const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.48, 8);
            const leg = new THREE.Mesh(legGeo, this.materials.brushedSteel);
            leg.position.set(lx, 0.24, lz);
            chair.add(leg);
        }
        return chair;
    }

    /**
     * [-1, 1] Комната отдыха и спальные каюты:
     * мягкий диван с подушками, журнальный столик, большой телевизор с земным пейзажем,
     * двухъярусные кровати экипажа, торшер и ковер
     */
    _buildCrewLoungeModule(group, animators) {
        // 1. МЯГКИЙ УЮТНЫЙ ДИВАН (Тканевая текстура)
        const sofaGroup = new THREE.Group();
        sofaGroup.position.set(-4.0, 0, 3.0);

        // Основание дивана
        const sofaBaseGeo = new THREE.BoxGeometry(3.6, 0.35, 1.4);
        const sofaBase = new THREE.Mesh(sofaBaseGeo, this.materials.fabricCouch);
        sofaBase.position.y = 0.2;
        sofaBase.castShadow = true;
        sofaGroup.add(sofaBase);

        // Подушки сидений
        for (let p = -1.1; p <= 1.1; p += 1.1) {
            const cushionGeo = new THREE.BoxGeometry(1.0, 0.2, 1.2);
            const cushion = new THREE.Mesh(cushionGeo, this.materials.fabricCushion);
            cushion.position.set(p, 0.45, 0.05);
            sofaGroup.add(cushion);
        }

        // Спинка дивана
        const sofaBackGeo = new THREE.BoxGeometry(3.6, 0.85, 0.3);
        const sofaBack = new THREE.Mesh(sofaBackGeo, this.materials.fabricCouch);
        sofaBack.position.set(0, 0.8, -0.6);
        sofaGroup.add(sofaBack);

        // Подлокотники
        for (const side of [-1.75, 1.75]) {
            const armGeo = new THREE.BoxGeometry(0.3, 0.55, 1.4);
            const arm = new THREE.Mesh(armGeo, this.materials.fabricCouch);
            arm.position.set(side, 0.6, 0);
            sofaGroup.add(arm);
        }

        // Декоративные цветные подушки
        const pillow1Geo = new THREE.BoxGeometry(0.4, 0.4, 0.15);
        const pillow1 = new THREE.Mesh(pillow1Geo, this.materials.hazardStripe);
        pillow1.position.set(-1.3, 0.65, -0.4);
        pillow1.rotation.y = 0.3;
        sofaGroup.add(pillow1);

        group.add(sofaGroup);

        // 2. ЖУРНАЛЬНЫЙ СТОЛИК
        const tableGeo = new THREE.BoxGeometry(1.8, 0.06, 1.0);
        const tableMesh = new THREE.Mesh(tableGeo, this.materials.tableWood);
        tableMesh.position.set(-4.0, 0.45, 1.0);
        group.add(tableMesh);

        for (const [lx, lz] of [[-4.7, 0.6], [-3.3, 0.6], [-4.7, 1.4], [-3.3, 1.4]]) {
            const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
            const leg = new THREE.Mesh(legGeo, this.materials.brushedSteel);
            leg.position.set(lx, 0.225, lz);
            group.add(leg);
        }

        // 3. БОЛЬШОЙ ТЕЛЕВИЗОР НА СТЕНЕ (с земным пейзажем Байкала)
        const tvFrameGeo = new THREE.BoxGeometry(4.2, 2.5, 0.12);
        const tvFrame = new THREE.Mesh(tvFrameGeo, this.materials.hullDark);
        tvFrame.position.set(-4.0, 2.4, -4.5);
        group.add(tvFrame);

        const tvScreenGeo = new THREE.PlaneGeometry(4.0, 2.3);
        const tvScreen = new THREE.Mesh(tvScreenGeo, this.materials.tvScreenLandscape);
        tvScreen.position.set(-4.0, 2.4, -4.43);
        tvScreen.userData = {
            interactable: true,
            type: 'lounge_tv',
            name: 'Широкоэкранный дисплей релаксации (Архив Земли)'
        };
        group.add(tvScreen);

        // Мягкая подсветка от экрана
        const tvLight = new THREE.PointLight(0x38bdf8, 1.2, 10);
        tvLight.position.set(-4.0, 2.4, -3.5);
        group.add(tvLight);

        // 4. ДВУХЪЯРУСНЫЕ КРОВАТИ ЭКИПАЖА (Bunk Beds в правой зоне X = 4.5)
        const bunkGroup = new THREE.Group();
        bunkGroup.position.set(4.5, 0, 0);

        // Каркас кроватей
        for (const [bx, bz] of [[-1.2, -1.8], [1.2, -1.8], [-1.2, 1.8], [1.2, 1.8]]) {
            const postGeo = new THREE.BoxGeometry(0.12, 3.2, 0.12);
            const post = new THREE.Mesh(postGeo, this.materials.bulkheadWall);
            post.position.set(bx, 1.6, bz);
            bunkGroup.add(post);
        }

        // Нижний ярус
        const lowerMattressGeo = new THREE.BoxGeometry(2.2, 0.25, 3.4);
        const lowerMattress = new THREE.Mesh(lowerMattressGeo, this.materials.fabricCushion);
        lowerMattress.position.set(0, 0.45, 0);
        bunkGroup.add(lowerMattress);

        // Верхний ярус
        const upperMattressGeo = new THREE.BoxGeometry(2.2, 0.25, 3.4);
        const upperMattress = new THREE.Mesh(upperMattressGeo, this.materials.fabricCushion);
        upperMattress.position.set(0, 2.0, 0);
        bunkGroup.add(upperMattress);

        // Подушки и одеяла
        for (const y of [0.65, 2.2]) {
            const pillowGeo = new THREE.BoxGeometry(0.8, 0.14, 0.5);
            const pillow = new THREE.Mesh(pillowGeo, this.materials.deckFloor);
            pillow.position.set(0, y, -1.3);
            bunkGroup.add(pillow);
        }

        group.add(bunkGroup);

        // 5. УЮТНЫЙ ТОРШЕР (3000K теплый свет)
        const lampPoleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8);
        const lampPole = new THREE.Mesh(lampPoleGeo, this.materials.brushedSteel);
        lampPole.position.set(-7.0, 1.2, 3.5);
        group.add(lampPole);

        const lampShadeGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.4, 16, 1, true);
        const lampShadeMat = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfef08a,
            emissiveIntensity: 0.8,
            side: THREE.DoubleSide
        });
        const lampShade = new THREE.Mesh(lampShadeGeo, lampShadeMat);
        lampShade.position.set(-7.0, 2.3, 3.5);
        group.add(lampShade);

        const floorLight = new THREE.PointLight(0xfef08a, 1.5, 9);
        floorLight.position.set(-7.0, 2.3, 3.5);
        group.add(floorLight);
    }

    /**
     * [-1, 0] Физическая лаборатория СТО:
     * установка световых часов, 12-метровый рельсовый трек, вагон с зеркалами,
     * анимированный диагональный фотонный луч, пульт Лоренца
     */
    _buildPhysicsLabModule(group, animators) {
        // 1. Рельсовый трек длиной 12 метров
        const railGeo = new THREE.BoxGeometry(0.12, 0.1, 12.0);
        const railL = new THREE.Mesh(railGeo, this.materials.brushedSteel);
        railL.position.set(-1.0, 0.1, 0);
        group.add(railL);

        const railR = new THREE.Mesh(railGeo, this.materials.brushedSteel);
        railR.position.set(1.0, 0.1, 0);
        group.add(railR);

        // Шпалы трека
        for (let z = -5.5; z <= 5.5; z += 1.0) {
            const tieGeo = new THREE.BoxGeometry(2.4, 0.08, 0.2);
            const tie = new THREE.Mesh(tieGeo, this.materials.bulkheadWall);
            tie.position.set(0, 0.05, z);
            group.add(tie);
        }

        // 2. РЕЛЯТИВИСТСКИЙ ВАГОН СВЕТОВЫХ ЧАСОВ
        const carGroup = new THREE.Group();
        carGroup.position.set(0, 0.3, 0);

        const carChassisGeo = new THREE.BoxGeometry(2.2, 0.2, 3.0);
        const carChassis = new THREE.Mesh(carChassisGeo, this.materials.brushedSteel);
        carGroup.add(carChassis);

        // Нижнее полированное зеркало
        const mirrorLowerGeo = new THREE.BoxGeometry(1.4, 0.06, 1.4);
        const mirrorLower = new THREE.Mesh(mirrorLowerGeo, this.materials.mirrorPolish);
        mirrorLower.position.set(0, 0.15, 0);
        carGroup.add(mirrorLower);

        // Верхнее полированное зеркало
        const mirrorUpperGeo = new THREE.BoxGeometry(1.4, 0.06, 1.4);
        const mirrorUpper = new THREE.Mesh(mirrorUpperGeo, this.materials.mirrorPolish);
        mirrorUpper.position.set(0, 2.5, 0);
        carGroup.add(mirrorUpper);

        // Опоры верхнего зеркала
        for (const [px, pz] of [[-0.9, -1.2], [0.9, -1.2], [-0.9, 1.2], [0.9, 1.2]]) {
            const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8);
            const strut = new THREE.Mesh(strutGeo, this.materials.brushedSteel);
            strut.position.set(px, 1.2, pz);
            carGroup.add(strut);
        }

        // Фотонный световой луч (анимированный)
        const beamGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 10);
        const beamMesh = new THREE.Mesh(beamGeo, this.materials.photonBeam);
        beamMesh.position.set(0, 1.3, 0);
        carGroup.add(beamMesh);

        group.add(carGroup);

        // 3. ПУЛЬТ УПРАВЛЕНИЯ ЭКСПЕРИМЕНТОМ (интерактивный)
        const deskGeo = new THREE.BoxGeometry(2.2, 1.1, 1.0);
        const deskMesh = new THREE.Mesh(deskGeo, this.materials.bulkheadWall);
        deskMesh.position.set(-5.0, 0.55, 0);
        deskMesh.userData = {
            interactable: true,
            type: 'light_clock',
            name: 'Пульт релятивистских световых часов (СТО)'
        };
        group.add(deskMesh);

        // Экран пульта с фактором Лоренца
        const screenGeo = new THREE.PlaneGeometry(1.6, 0.8);
        const screen = new THREE.Mesh(screenGeo, this.materials.neonCyan);
        screen.position.set(-4.95, 1.3, 0);
        screen.rotation.y = Math.PI / 2;
        group.add(screen);

        // Анимация движения вагона и колебаний фотона
        animators.push((time) => {
            // Движение вагона по рельсам
            const carZ = Math.sin(time * 0.8) * 4.0;
            carGroup.position.z = carZ;

            // Колебания луча
            beamMesh.scale.y = 0.95 + Math.sin(time * 12.0) * 0.05;
        });
    }

    /**
     * [1, 1] Павильон Истории и Архив Геродота:
     * мраморные колонны, свитки папируса на постаменте, кристалл АСТРА
     */
    _buildHistoryArchiveModule(group, animators) {
        // Мраморные античные колонны по углам
        for (const [cx, cz] of [[-6.0, -6.0], [6.0, -6.0], [-6.0, 6.0], [6.0, 6.0]]) {
            const colGeo = new THREE.CylinderGeometry(0.45, 0.5, 4.8, 16);
            const col = new THREE.Mesh(colGeo, this.materials.ancientMarble);
            col.position.set(cx, 2.4, cz);
            col.castShadow = true;
            group.add(col);
        }

        // ЦЕНТРАЛЬНЫЙ ПОСТАМЕНТ ГЕРОДОТА (свиток папируса)
        const pedestalGeo = new THREE.CylinderGeometry(1.2, 1.5, 1.0, 16);
        const pedestal = new THREE.Mesh(pedestalGeo, this.materials.ancientMarble);
        pedestal.position.set(0, 0.5, 0);
        pedestal.castShadow = true;
        group.add(pedestal);

        // Наклонный аналой / пюпитр
        const standGeo = new THREE.BoxGeometry(1.2, 0.1, 0.8);
        const stand = new THREE.Mesh(standGeo, this.materials.tableWood);
        stand.position.set(0, 1.15, 0);
        stand.rotation.x = -Math.PI / 6;
        stand.userData = {
            interactable: true,
            type: 'herodotus_archive',
            name: 'Свитки Геродота (Исторический квест)'
        };
        group.add(stand);

        // Развернутый свиток папируса с греческим текстом
        const scrollGeo = new THREE.PlaneGeometry(1.0, 0.6);
        const scroll = new THREE.Mesh(scrollGeo, this.materials.papyrusScroll);
        scroll.position.set(0, 1.22, 0.02);
        scroll.rotation.x = -Math.PI / 6;
        group.add(scroll);

        // Парящий оптический кристалл памяти АСТРА
        const cubeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const cubeMat = new THREE.MeshStandardMaterial({
            color: 0x00f5ff,
            emissive: 0x0284c7,
            emissiveIntensity: 1.2,
            transparent: true,
            opacity: 0.75,
            roughness: 0.2
        });
        const cube = new THREE.Mesh(cubeGeo, cubeMat);
        cube.position.set(0, 2.5, 0);
        group.add(cube);

        animators.push((time) => {
            cube.rotation.x = time * 0.4;
            cube.rotation.y = time * 0.6;
            cube.position.y = 2.5 + Math.sin(time * 2.0) * 0.08;
        });
    }

    /**
     * [1, 0] Реакторный отсек: Токамак, плазменное ядро, верстак инженера
     */
    _buildReactorModule(group, animators) {
        // База реактора
        const reactorBaseGeo = new THREE.CylinderGeometry(4.0, 4.6, 1.2, 24);
        const reactorBase = new THREE.Mesh(reactorBaseGeo, this.materials.hullDark);
        reactorBase.position.set(0, 0.6, 0);
        group.add(reactorBase);

        // Плазменное термоядерное ядро реактора
        const coreGeo = new THREE.SphereGeometry(1.6, 24, 24);
        const coreMat = this.materials.reactorCoreGlow.clone();
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 2.5, 0);
        group.add(core);

        const coreLight = new THREE.PointLight(0xff4400, 2.2, 16);
        coreLight.position.set(0, 2.5, 0);
        group.add(coreLight);

        // Магнитные кольца удержания
        const rings = [];
        const ringHeights = [1.6, 2.5, 3.4];
        ringHeights.forEach((y, idx) => {
            const ringGeo = new THREE.TorusGeometry(2.5, 0.14, 16, 32);
            const ring = new THREE.Mesh(ringGeo, this.materials.energyConduit);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(0, y, 0);
            group.add(ring);
            rings.push({ mesh: ring, dir: idx % 2 === 0 ? 1 : -1 });
        });

        animators.push((time) => {
            const pulse = 1.0 + Math.sin(time * 5.0) * 0.05;
            core.scale.setScalar(pulse);
            coreMat.emissiveIntensity = 1.6 + Math.sin(time * 7.0) * 0.5;
            coreLight.intensity = 2.0 + Math.sin(time * 7.0) * 0.6;
            rings.forEach(r => {
                r.mesh.rotation.z = time * 0.7 * r.dir;
            });
        });

        // Засорённый фильтр охлаждения
        const filterBoxGeo = new THREE.BoxGeometry(1.6, 1.4, 1.2);
        const filterBox = new THREE.Mesh(filterBoxGeo, this.materials.hazardStripe);
        filterBox.position.set(6.0, 0.7, -4.0);
        group.add(filterBox);

        // ВЕРСТАК ИНЖЕНЕРА МАРКА ВЭНСА (инструменты, диагностический монитор)
        const benchGeo = new THREE.BoxGeometry(2.4, 1.0, 1.0);
        const bench = new THREE.Mesh(benchGeo, this.materials.bulkheadWall);
        bench.position.set(7.0, 0.5, 2.5);
        bench.userData = {
            interactable: true,
            type: 'reactor_bench',
            name: 'Верстак диагностики энергосистем'
        };
        group.add(bench);
    }

    /**
     * [0, 1] Гидропонная оранжерея: Chlorella vulgaris, фитолампы 430 нм, биостол
     */
    _buildGreenhouseModule(group, animators) {
        const growLamps = [];
        for (let x = -5; x <= 5; x += 5) {
            const rackGeo = new THREE.BoxGeometry(1.2, 3.6, 7.0);
            const rack = new THREE.Mesh(rackGeo, this.materials.bulkheadWall);
            rack.position.set(x, 1.8, 0);
            rack.castShadow = true;
            group.add(rack);

            for (let y = 0.8; y <= 3.2; y += 0.8) {
                const plantGeo = new THREE.BoxGeometry(1.0, 0.3, 6.6);
                const plants = new THREE.Mesh(plantGeo, this.materials.hydroGreen);
                plants.position.set(x, y, 0);
                group.add(plants);

                const lampGeo = new THREE.BoxGeometry(0.8, 0.06, 6.4);
                const lampMat = this.materials.growLight430nm.clone();
                const lamp = new THREE.Mesh(lampGeo, lampMat);
                lamp.position.set(x, y + 0.35, 0);
                group.add(lamp);
                growLamps.push(lampMat);
            }
        }

        // Центральный стеклянный оксигенатор с Chlorella vulgaris
        const tankGeo = new THREE.CylinderGeometry(1.4, 1.4, 3.2, 20);
        const tank = new THREE.Mesh(tankGeo, this.materials.hydroGlass);
        tank.position.set(0, 1.6, 0);
        tank.userData = {
            interactable: true,
            type: 'bioreactor',
            name: 'Фотобиореактор Chlorella vulgaris (430 нм)'
        };
        group.add(tank);

        const innerLiquidGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.8, 16);
        const innerLiquid = new THREE.Mesh(innerLiquidGeo, this.materials.hydroGreen);
        innerLiquid.position.set(0, 1.6, 0);
        group.add(innerLiquid);

        animators.push((time) => {
            const glow = 1.3 + Math.sin(time * 2.2) * 0.3;
            growLamps.forEach(mat => {
                mat.emissiveIntensity = glow;
            });
        });
    }

    /**
     * [1, -1] Стыковочный шлюз и Аварийный модуль
     */
    _buildAirlockModule(group, animators) {
        const ringGeo = new THREE.TorusGeometry(3.0, 0.4, 16, 32);
        const ring = new THREE.Mesh(ringGeo, this.materials.hazardStripe);
        ring.position.set(0, 3.0, -8.0);
        group.add(ring);

        // Спасательный челнок
        const podHullGeo = new THREE.ConeGeometry(2.2, 5.0, 16);
        const podHull = new THREE.Mesh(podHullGeo, this.materials.bulkheadWall);
        podHull.rotation.x = -Math.PI / 2;
        podHull.position.set(0, 3.0, -11.0);
        podHull.userData = {
            interactable: true,
            type: 'escape_pod',
            name: 'Аварийный спасательный челнок'
        };
        group.add(podHull);
    }

    _buildCorridorModule(group, cx, cz, animators) {
        for (const side of [-1, 1]) {
            const stripGeo = new THREE.BoxGeometry(0.1, 0.15, this.chunkSize);
            const strip = new THREE.Mesh(stripGeo, this.materials.energyConduit);
            strip.position.set(side * 9.8, 2.5, 0);
            group.add(strip);
        }
    }
}
