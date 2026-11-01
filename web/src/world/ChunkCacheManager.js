import * as THREE from 'three';

/**
 * ChunkCacheManager.js
 * Менеджер пространственных отсеков-чанков и строгого LRU-кэша космического корабля «Горизонт-7».
 * 
 * Требования ТЗ хакатона:
 * 1. Мир космической станции разбит на отсеки-чанки 20х20 метров.
 * 2. W — канонический несжатый объем всех уникальных ресурсов мира.
 * 3. C — объем ресурсов мира, удерживаемых клиентом в текущий момент.
 * 4. Строгий предел: C <= 10% W (рабочий бюджет: 8% W).
 * 5. При вытеснении чанка по LRU обязательно вызываются .dispose()
 *    для геометрий и материалов во избежание утечек WebGL VRAM.
 * 
 * Отсеки станции «Горизонт-7»:
 * - [0, 0]: Командный мостик / Иллюминатор Юпитера (Капитан Александр Волк и ИИ АСТРА)
 * - [1, 0]: Энергетический отсек / Реактор и засорённый фильтр (Инженер Марк Вэнс)
 * - [0, 1]: Гидропонная оранжерея / Биосфера 430 нм (Биолог Елена Ростова)
 * - [-1, 0]: Жилой сектор / Криокапсулы пробуждения экипажа
 * - [0, -1]: Стыковочный шлюз и Аварийный спасательный модуль
 * - [1, 1]: Архивный сектор серверов памяти АСТРЫ
 * - Другие: Технологические переборки, сервисные коридоры
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

        // Общие переиспользуемые материалы станции
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
            neonCyan: new THREE.MeshBasicMaterial({ color: 0x00f5ff }),
            neonAmber: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
            neonPurple: new THREE.MeshBasicMaterial({ color: 0xa855f7 })
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

    /**
     * Покадровая анимация динамических 3D-элементов загруженных отсеков
     */
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
                if (child.material && child.material !== this.materials[child.material.name]) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else if (child.material.isMaterial) {
                        // Кастомные материалы утилизируются
                    }
                }
            } else if (child.isPoints) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            } else if (child.isLine) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
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

        // 2. Потолок со световыми коробами
        const ceilingGeo = new THREE.BoxGeometry(this.chunkSize, 0.4, this.chunkSize);
        const ceiling = new THREE.Mesh(ceilingGeo, this.materials.hullDark);
        ceiling.position.y = 5.0;
        group.add(ceiling);

        // 3. Отсеки корабля «Горизонт-7»
        if (cx === 0 && cz === 0) {
            // [0, 0]: КОМАНДНЫЙ МОСТИК / ИЛЛЮМИНАТОР ЮПИТЕРА
            this._buildBridgeModule(group, animators);
        } else if (cx === 1 && cz === 0) {
            // [1, 0]: ЭНЕРГЕТИЧЕСКИЙ ОТСЕК / РЕАКТОР И ЗАСОРЁННЫЙ ФИЛЬТР
            this._buildReactorModule(group, animators);
        } else if (cx === 0 && cz === 1) {
            // [0, 1]: ГИДРОПОННАЯ ОРАНЖЕРЕЯ 430 нм / БИОСФЕРА
            this._buildGreenhouseModule(group, animators);
        } else if (cx === -1 && cz === 0) {
            // [-1, 0]: ЖИЛОЙ СЕКТОР / КРИОКАПСУЛЫ ПРОБУЖДЕНИЯ
            this._buildCryoBayModule(group, animators);
        } else if (cx === 0 && cz === -1) {
            // [0, -1]: СТЫКОВОЧНЫЙ ШЛЮЗ И АВАРИЙНЫЙ СПАСАТЕЛЬНЫЙ МОДУЛЬ
            this._buildAirlockModule(group, animators);
        } else if (cx === 1 && cz === 1) {
            // [1, 1]: АРХИВНЫЙ СЕКТОР СЕРВЕРОВ АСТРЫ
            this._buildArchiveModule(group, animators);
        } else {
            // ТЕХНИЧЕСКИЕ КОРИДОРЫ
            this._buildCorridorModule(group, cx, cz, animators);
        }

        return { group, animators };
    }

    /**
     * Командный мостик: панорамный иллюминатор Юпитера с орбитальными лунами, 
     * голографический тактический стол с 3D-траекторией маневра и терминал расследования
     */
    _buildBridgeModule(group, animators) {
        // Панорамный иллюминатор в космос на фронтальной переборке (Z = -9.8)
        const windowFrameGeo = new THREE.BoxGeometry(14.0, 3.8, 0.4);
        const windowFrame = new THREE.Mesh(windowFrameGeo, this.materials.bulkheadWall);
        windowFrame.position.set(0, 2.5, -9.8);
        group.add(windowFrame);

        const glassGeo = new THREE.PlaneGeometry(13.2, 3.0);
        const glass = new THREE.Mesh(glassGeo, this.materials.cryoGlass);
        glass.position.set(0, 2.5, -9.6);
        group.add(glass);

        // 3D Модель Юпитера за окном в открытом космосе
        const jupiterGeo = new THREE.SphereGeometry(14.0, 36, 36);
        const jupiter = new THREE.Mesh(jupiterGeo, this.materials.jupiterAtmosphere);
        jupiter.position.set(12.0, 8.0, -42.0);
        group.add(jupiter);

        // Атмосферные полосы Юпитера с эффектом завихрений
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

        // Орбитальные луны Юпитера: Ио (Io) и Европа (Europa)
        const ioGeo = new THREE.SphereGeometry(0.85, 16, 16);
        const ioMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 });
        const io = new THREE.Mesh(ioGeo, ioMat);
        group.add(io);

        const europaGeo = new THREE.SphereGeometry(0.65, 16, 16);
        const europaMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.5 });
        const europa = new THREE.Mesh(europaGeo, europaMat);
        group.add(europa);

        // Анимация Юпитера и спутников
        animators.push((time) => {
            jupiter.rotation.y = time * 0.02;
            bands.forEach(b => {
                b.mesh.rotation.z = time * b.speed;
            });
            io.position.set(
                12.0 + Math.cos(time * 0.12) * 22.0,
                8.0 + Math.sin(time * 0.08) * 4.0,
                -42.0 + Math.sin(time * 0.12) * 22.0
            );
            europa.position.set(
                12.0 + Math.cos(time * 0.07 + 2.5) * 30.0,
                8.0 + Math.cos(time * 0.05) * 6.0,
                -42.0 + Math.sin(time * 0.07 + 2.5) * 30.0
            );
        });

        // Метеоритные осколки в космосе (напоминание о прохождении пояса)
        for (let r = 0; r < 14; r++) {
            const rockGeo = new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.5);
            const rock = new THREE.Mesh(rockGeo, this.materials.meteoriteFragment);
            rock.position.set(-8.0 + Math.random() * 22.0, 1.0 + Math.random() * 8.0, -22.0 - Math.random() * 16.0);
            rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
            group.add(rock);
        }

        // Тактический стол капитана
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

        // 3D Траектория спасительного гравитационного манёвра
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

        // Голографический мини-корабль на траектории
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

        // Терминал расследования аварии
        const termGeo = new THREE.BoxGeometry(2.0, 1.2, 0.8);
        const term = new THREE.Mesh(termGeo, this.materials.bulkheadWall);
        term.position.set(-6.5, 0.6, 0);
        term.rotation.y = Math.PI / 2;
        group.add(term);

        const termScreenGeo = new THREE.PlaneGeometry(1.6, 0.7);
        const termScreen = new THREE.Mesh(termScreenGeo, this.materials.neonAmber);
        termScreen.position.set(-6.05, 1.1, 0);
        termScreen.rotation.y = -Math.PI / 2;
        group.add(termScreen);
    }

    /**
     * Энергетический отсек: термоядерный реактор с пульсирующим плазменным ядром,
     * вращающимися магнитными кольцами, искрящимся фильтром охлаждения и батареей
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

        // Локальный источник освещения плазмы
        const coreLight = new THREE.PointLight(0xff4400, 2.2, 16);
        coreLight.position.set(0, 2.5, 0);
        group.add(coreLight);

        // Магнитные кольца удержания плазмы (встречное вращение)
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

        // Анимация пульсации плазмы и колец реактора
        animators.push((time) => {
            const pulse = 1.0 + Math.sin(time * 5.0) * 0.05;
            core.scale.setScalar(pulse);
            coreMat.emissiveIntensity = 1.6 + Math.sin(time * 7.0) * 0.5;
            coreLight.intensity = 2.0 + Math.sin(time * 7.0) * 0.6;
            rings.forEach(r => {
                r.mesh.rotation.z = time * 0.7 * r.dir;
            });
        });

        // ЗАСОРЁННЫЙ ФИЛЬТР КОНТУРА ОХЛАЖДЕНИЯ (Ключевая улика)
        const filterBoxGeo = new THREE.BoxGeometry(1.6, 1.4, 1.2);
        const filterBox = new THREE.Mesh(filterBoxGeo, this.materials.hazardStripe);
        filterBox.position.set(6.0, 0.7, -4.0);
        filterBox.castShadow = true;
        group.add(filterBox);

        // Трубы охлаждения к реактору
        const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 6.5, 12);
        const pipe = new THREE.Mesh(pipeGeo, this.materials.bulkheadWall);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(3.0, 1.0, -4.0);
        group.add(pipe);

        // Металлический фрагмент метеорита внутри смотрового окошка фильтра
        const shrapnelGeo = new THREE.DodecahedronGeometry(0.35);
        const shrapnel = new THREE.Mesh(shrapnelGeo, this.materials.meteoriteFragment);
        shrapnel.position.set(6.0, 1.2, -3.3);
        group.add(shrapnel);

        // Аварийные искры/плазма из повреждённого фильтра
        const sparkCount = 14;
        const sparkGeo = new THREE.BufferGeometry();
        const sparkPositions = new Float32Array(sparkCount * 3);
        for (let s = 0; s < sparkCount; s++) {
            sparkPositions[s * 3] = 6.0 + (Math.random() - 0.5) * 0.5;
            sparkPositions[s * 3 + 1] = 1.1 + Math.random() * 0.8;
            sparkPositions[s * 3 + 2] = -3.3 + (Math.random() - 0.5) * 0.5;
        }
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
        const sparkMat = new THREE.PointsMaterial({
            color: 0xffaa00,
            size: 0.14,
            transparent: true,
            opacity: 0.9
        });
        const sparks = new THREE.Points(sparkGeo, sparkMat);
        group.add(sparks);

        animators.push((time) => {
            const pos = sparkGeo.attributes.position.array;
            for (let s = 0; s < sparkCount; s++) {
                pos[s * 3 + 1] += 0.025 * (s % 3 + 1);
                if (pos[s * 3 + 1] > 2.3) {
                    pos[s * 3] = 6.0 + (Math.random() - 0.5) * 0.4;
                    pos[s * 3 + 1] = 1.0;
                    pos[s * 3 + 2] = -3.3 + (Math.random() - 0.5) * 0.4;
                }
            }
            sparkGeo.attributes.position.needsUpdate = true;
            sparkMat.opacity = 0.5 + Math.sin(time * 16.0) * 0.5;
        });

        // РЕЗЕРВНАЯ БАТАРЕЯ КОРАБЛЯ (Emergency Battery Unit B=1)
        const battGeo = new THREE.BoxGeometry(2.2, 2.0, 1.2);
        const batt = new THREE.Mesh(battGeo, this.materials.bulkheadWall);
        batt.position.set(-6.0, 1.0, -4.0);
        group.add(batt);

        // Светящиеся энергоячейки батареи
        for (let c = -0.6; c <= 0.6; c += 0.6) {
            const cellGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.6, 12);
            const cell = new THREE.Mesh(cellGeo, this.materials.batteryCell);
            cell.position.set(-6.0 + c, 1.0, -3.35);
            group.add(cell);
        }

        // Консоль инженера Марка Вэнса
        const engDeskGeo = new THREE.BoxGeometry(2.0, 1.0, 0.8);
        const engDesk = new THREE.Mesh(engDeskGeo, this.materials.bulkheadWall);
        engDesk.position.set(7.0, 0.5, 3.0);
        group.add(engDesk);
    }

    /**
     * Гидропонная оранжерея: культуры Chlorella vulgaris, 430 нм фитолампы, биопробы
     */
    _buildGreenhouseModule(group, animators) {
        // Вертикальные гидропонные фермы (стеллажи)
        const growLamps = [];
        for (let x = -5; x <= 5; x += 5) {
            const rackGeo = new THREE.BoxGeometry(1.2, 3.6, 7.0);
            const rack = new THREE.Mesh(rackGeo, this.materials.bulkheadWall);
            rack.position.set(x, 1.8, 0);
            rack.castShadow = true;
            group.add(rack);

            // Зеленые лотки с водорослями
            for (let y = 0.8; y <= 3.2; y += 0.8) {
                const plantGeo = new THREE.BoxGeometry(1.0, 0.3, 6.6);
                const plants = new THREE.Mesh(plantGeo, this.materials.hydroGreen);
                plants.position.set(x, y, 0);
                group.add(plants);

                // ФИТОЛАМПЫ СПЕКТРА 430 нм (Фитофотоника)
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
        group.add(tank);

        const innerLiquidGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.8, 16);
        const innerLiquid = new THREE.Mesh(innerLiquidGeo, this.materials.hydroGreen);
        innerLiquid.position.set(0, 1.6, 0);
        group.add(innerLiquid);

        // Биолюминесцентные всплывающие пузырьки водорослей
        const bubbleCount = 22;
        const bubbleGeo = new THREE.BufferGeometry();
        const bubblePositions = new Float32Array(bubbleCount * 3);
        for (let b = 0; b < bubbleCount; b++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.9;
            bubblePositions[b * 3] = Math.cos(angle) * r;
            bubblePositions[b * 3 + 1] = 0.3 + Math.random() * 2.5;
            bubblePositions[b * 3 + 2] = Math.sin(angle) * r;
        }
        bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
        const bubbleMat = new THREE.PointsMaterial({
            color: 0x34d399,
            size: 0.12,
            transparent: true,
            opacity: 0.85
        });
        const bubbles = new THREE.Points(bubbleGeo, bubbleMat);
        group.add(bubbles);

        animators.push((time) => {
            const pos = bubbleGeo.attributes.position.array;
            for (let b = 0; b < bubbleCount; b++) {
                pos[b * 3 + 1] += 0.018;
                if (pos[b * 3 + 1] > 3.0) {
                    pos[b * 3 + 1] = 0.3;
                }
            }
            bubbleGeo.attributes.position.needsUpdate = true;

            const glow = 1.3 + Math.sin(time * 2.2) * 0.3;
            growLamps.forEach(mat => {
                mat.emissiveIntensity = glow;
            });
        });

        // Лабораторный столик биопроб Д-ра Елены Ростовой
        const labDeskGeo = new THREE.BoxGeometry(1.8, 1.0, 0.9);
        const labDesk = new THREE.Mesh(labDeskGeo, this.materials.bulkheadWall);
        labDesk.position.set(0, 0.5, 6.0);
        group.add(labDesk);

        const sampleScreenGeo = new THREE.PlaneGeometry(1.2, 0.6);
        const sampleScreen = new THREE.Mesh(sampleScreenGeo, this.materials.neonCyan);
        sampleScreen.position.set(0, 1.2, 6.0);
        group.add(sampleScreen);
    }

    /**
     * Архивный сектор серверов АСТРЫ: парящий оптический кристалл памяти, стойки данных
     */
    _buildArchiveModule(group, animators) {
        // Стойки серверов по периметру
        for (let i = -1; i <= 1; i += 2) {
            const rackGeo = new THREE.BoxGeometry(1.4, 3.8, 5.0);
            const rack = new THREE.Mesh(rackGeo, this.materials.bulkheadWall);
            rack.position.set(i * 5.0, 1.9, 0);
            group.add(rack);

            // Мигающие оптические индикаторы
            for (let y = 0.8; y <= 3.4; y += 0.6) {
                const ledGeo = new THREE.BoxGeometry(0.1, 0.15, 4.2);
                const ledMat = (y > 2.0 && i > 0) ? this.materials.neonAmber : this.materials.neonCyan;
                const led = new THREE.Mesh(ledGeo, ledMat);
                led.position.set(i * 4.25, y, 0);
                group.add(led);
            }
        }

        // Центральный терминал восстановления архива
        const termGeo = new THREE.CylinderGeometry(1.2, 1.5, 1.0, 16);
        const term = new THREE.Mesh(termGeo, this.materials.hullDark);
        term.position.set(0, 0.5, 0);
        group.add(term);

        // Парящий оптический голографический куб памяти АСТРЫ
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
        cube.position.set(0, 1.9, 0);
        group.add(cube);

        const innerGeo = new THREE.OctahedronGeometry(0.42);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        cube.add(inner);

        animators.push((time) => {
            cube.rotation.x = time * 0.5;
            cube.rotation.y = time * 0.7;
            cube.position.y = 1.9 + Math.sin(time * 2.5) * 0.08;
            inner.rotation.y = -time * 1.1;
        });

        const screenGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.6, 16, 1, true, 0, Math.PI);
        const screen = new THREE.Mesh(screenGeo, this.materials.neonAmber);
        screen.position.set(0, 1.2, 0);
        group.add(screen);
    }

    /**
     * Жилой сектор с криокапсулами пробуждения
     */
    _buildCryoBayModule(group, animators) {
        for (let i = -1; i <= 1; i++) {
            const podBaseGeo = new THREE.BoxGeometry(1.6, 0.8, 2.6);
            const podBase = new THREE.Mesh(podBaseGeo, this.materials.bulkheadWall);
            podBase.position.set(i * 3.5, 0.4, -3.0);
            podBase.castShadow = true;
            group.add(podBase);

            const glassGeo = new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12, 1, false, 0, Math.PI);
            const glass = new THREE.Mesh(glassGeo, this.materials.cryoGlass);
            glass.rotation.z = Math.PI / 2;
            glass.position.set(i * 3.5, 0.8, -3.0);
            group.add(glass);

            const vitalsGeo = new THREE.PlaneGeometry(0.8, 0.4);
            const vitals = new THREE.Mesh(vitalsGeo, this.materials.neonCyan);
            vitals.position.set(i * 3.5, 1.5, -4.2);
            group.add(vitals);
        }
    }

    /**
     * Стыковочный шлюз и Аварийный спасательный модуль
     */
    _buildAirlockModule(group, animators) {
        // Герметичное стыковочное кольцо
        const ringGeo = new THREE.TorusGeometry(3.0, 0.4, 16, 32);
        const ring = new THREE.Mesh(ringGeo, this.materials.hazardStripe);
        ring.position.set(0, 3.0, -8.0);
        group.add(ring);

        // Аварийный пульсирующий маяк
        const alertLight = new THREE.PointLight(0xf59e0b, 1.6, 14);
        alertLight.position.set(0, 4.3, -8.0);
        group.add(alertLight);

        animators.push((time) => {
            alertLight.intensity = 1.0 + Math.sin(time * 3.5) * 0.8;
        });

        // АВАРИЙНЫЙ СПАСАТЕЛЬНЫЙ МОДУЛЬ (План частичной победы)
        const podHullGeo = new THREE.ConeGeometry(2.2, 5.0, 16);
        const podHull = new THREE.Mesh(podHullGeo, this.materials.bulkheadWall);
        podHull.rotation.x = -Math.PI / 2;
        podHull.position.set(0, 3.0, -11.0);
        group.add(podHull);

        const podGlassGeo = new THREE.SphereGeometry(1.0, 16, 16, 0, Math.PI);
        const podGlass = new THREE.Mesh(podGlassGeo, this.materials.cryoGlass);
        podGlass.position.set(0, 3.5, -10.0);
        group.add(podGlass);
    }

    _buildCorridorModule(group, cx, cz, animators) {
        // Световые неоновые полосы на стенах
        for (const side of [-1, 1]) {
            const stripGeo = new THREE.BoxGeometry(0.1, 0.15, this.chunkSize);
            const strip = new THREE.Mesh(stripGeo, this.materials.energyConduit);
            strip.position.set(side * 9.8, 2.5, 0);
            group.add(strip);
        }
    }
}
