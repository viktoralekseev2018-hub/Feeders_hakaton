import * as THREE from 'three';

/**
 * CrewManager.js
 * Управление 3D-моделями экипажа и бортовым ИИ АСТРА корабля «Горизонт-7».
 * 
 * Персонажи:
 * 1. Инженер Марк Вэнс — реакторный отсек (13.5, 0, 0), спасает термоядерный генератор.
 * 2. Биолог Д-р Елена Ростова — оранжерея (0, 0, 13.5), защищает гидропонику и кислород.
 * 3. Капитан Александр Волк — командный мостик (0, 0, 3.5), координирует экипаж.
 * 4. Бортовой ИИ АСТРА — командный мостик (0, 0, -3.5), голографическое ядро.
 */
export class CrewManager {
    constructor(scene) {
        this.scene = scene;
        this.crewMembers = new Map();
        this.nearestMember = null;

        this._initCrewProfiles();
        this._spawnCrewModels();
    }

    _initCrewProfiles() {
        this.profiles = {
            engineer: {
                id: 'engineer',
                name: 'Марк Вэнс',
                role: 'Главный инженер энергосистем',
                locationName: 'Энергетический сектор (Реактор)',
                themeColor: '#ff6b1a',
                threeColor: 0xff6b1a,
                secondaryColor: 0x1f242d,
                position: new THREE.Vector3(13.5, 0, 0),
                rotationY: -Math.PI / 2,
                personality: 'Прагматичный технарь. Опирается на жесткие расчеты термодинамики. Знает, что температура скакнула раньше падения мощности.',
                avatarSvg: 'engineer',
                initialGreeting: 'С возвращением из криосна! Контур охлаждения повреждён. Если реактор перегреется — корабль разорвёт или замёрзнет за 40 минут. Нужно срочно восстановить охлаждение!',
                knowledgeTopics: [
                    { id: 'reactor_status', label: 'Состояние реактора', text: 'Магнитные ловушки нестабильны. Без охлаждения реактор наносит 12 урона корпусу каждый цикл!' },
                    { id: 'cooling_filter', label: 'Контур охлаждения', text: 'Поток упал до критических 14%. Давление в фильтре зашкаливает — там что-то застряло.' },
                    { id: 'battery_advice', label: 'Резервная батарея', text: 'Батарея даст нам +25 E мгновенно, но обесточит передатчик и закроет комбинированный план манёвра.' }
                ]
            },
            biologist: {
                id: 'biologist',
                name: 'Д-р Елена Ростова',
                role: 'Ведущий биоэколог замкнутых систем',
                locationName: 'Гидропонный биокупол (Оранжерея)',
                themeColor: '#00e5a3',
                threeColor: 0x00e5a3,
                secondaryColor: 0x243330,
                position: new THREE.Vector3(0, 0, 13.5),
                rotationY: Math.PI,
                personality: 'Глубокий исследователь, защитница жизни. Проверила биопробы: заражения нет, водоросли увядают чисто из-за отсутствия света.',
                avatarSvg: 'biologist',
                initialGreeting: 'Вы проснулись! Дышите глубже, пока есть чем. Без оранжереи мы теряем 8 единиц O2 за цикл. Запуск фитоламп сократит потери до 3 единиц!',
                knowledgeTopics: [
                    { id: 'o2_cycle', label: 'Запас кислорода', text: 'Стартовые 64 единицы O2 иссякнут за 8 циклов, если не запустить оранжерею (12 E).' },
                    { id: 'bio_samples', label: 'Результаты биопроб', text: 'Я проверила микроструктуру водорослей Chlorella vulgaris под микроскопом. Никакой инфекции нет!' },
                    { id: 'night_mode', label: 'Фитофотоника 430 нм', text: 'Узкополосный спектр 430 нм позволяет культуре фотосинтезировать при пониженном потреблении тепла.' }
                ]
            },
            captain: {
                id: 'captain',
                name: 'Командор Александр Волк',
                role: 'Командир корабля «Горизонт-7»',
                locationName: 'Командный мостик (Тактический пульт)',
                themeColor: '#38bdf8',
                threeColor: 0x38bdf8,
                secondaryColor: 0x0f172a,
                position: new THREE.Vector3(0, 0, 3.5),
                rotationY: Math.PI,
                personality: 'Дисциплинированный стратег. Держит команду от паники, ищет доказательства в архиве и готовит безопасный курс.',
                avatarSvg: 'captain',
                initialGreeting: 'Добро пожаловать на мостик, специалист. Мы на опасной траектории у Юпитера. У нас 8 циклов. Мне нужны выверенные решения!',
                knowledgeTopics: [
                    { id: 'disaster_log', label: 'Журнал аварии', text: 'В журнале обнаружена команда на отключение оранжереи, но временная метка повреждена. Нужно восстановить архив за 2 E!' },
                    { id: 'course_plan', label: 'Расчёт курса', text: 'Подготовка гравитационного манёвра стоит 4 E. Без неё план «Восстановленная экосистема» невозможен.' },
                    { id: 'final_options', label: 'Планы спасения', text: 'Если сохраним батарею до финала — выполним комбинированный импульс. Иначе придётся идти на риск или эвакуироваться!' }
                ]
            },
            astra: {
                id: 'astra',
                name: 'Бортовой ИИ АСТРА',
                role: 'Искусственный интеллект корабля',
                locationName: 'Центральный голографический пьедестал',
                themeColor: '#00f5ff',
                threeColor: 0x00f5ff,
                secondaryColor: 0x082f49,
                position: new THREE.Vector3(0, 0, -3.5),
                rotationY: 0,
                personality: 'Аварийная Система Телеметрии и Расчёта Алгоритмов. Вежливая, точная, восстанавливает логику расследования по мере нахождения улик.',
                avatarSvg: 'astra',
                initialGreeting: 'Экипаж, вы пробуждены аварийным протоколом. При текущем расходе кислорода у нас осталось восемь циклов. Причина происшествия анализируется.',
                knowledgeTopics: [
                    { id: 'astra_status', label: 'Доклад телеметрии', text: 'O2: 64%, Энергия: 35%, Корпус: 70%. Реактор и оранжерея выключены. Охлаждение повреждено.' },
                    { id: 'astra_investigation', label: 'Причина аварии', text: 'До восстановления архива я не могу установить первопричину. Требуются данные внешнего датчика и фильтра.' },
                    { id: 'astra_advice', label: 'Рекомендация по шагам', text: 'Предлагаю сначала запустить реактор и восстановить охлаждение, затем запустить оранжерею и восстановить архив.' }
                ]
            },
            herodotus: {
                id: 'herodotus',
                name: 'Геродот Галикарнасский',
                role: 'Отец истории, античный летописец',
                locationName: 'Павильон Истории (Архив)',
                themeColor: '#fbbf24',
                threeColor: 0xfbbf24,
                secondaryColor: 0x451a03,
                position: new THREE.Vector3(20, 0, 23.5),
                rotationY: Math.PI,
                personality: 'Мудрый античный рассказчик. Опирается на свидетельства очевидцев из второй книги «Истории» («Евтерпа») и учит отделять факты от домыслов.',
                avatarSvg: 'herodotus',
                initialGreeting: 'Приветствую тебя, любознательный путник! Я — Геродот. В моем труде о Египте я записал то, что видел сам, и то, что слышал от жрецов. Готов ли ты отделить истину от домыслов?',
                knowledgeTopics: [
                    { id: 'hero_method', label: 'Метод исследования', text: 'Я разделяю то, что зрел очами своими, от того, что передано по слуху от египетских жрецов!' },
                    { id: 'hero_pyramids', label: 'Постройка пирамид', text: 'Пирамиду строили уступами, поднимая каменные блоки машинами из коротких деревянных брусьев с яруса на ярус.' },
                    { id: 'hero_nile', label: 'Разлив Нила', text: 'Нил разливается в течение 100 дней от летнего солнцестояния, когда другие реки пересыхают.' },
                    { id: 'hero_labyrinth', label: 'Лабиринт 12 царей', text: 'Лабиринт близ озера Мерида превосходит пирамиды: в нем 12 крытых дворов и 3000 покоев.' }
                ]
            },
            einstein: {
                id: 'einstein',
                name: 'Альберт Эйнштейн',
                role: 'Физик-теоретик, автор СТО',
                locationName: 'Физическая лаборатория СТО',
                themeColor: '#a855f7',
                threeColor: 0xa855f7,
                secondaryColor: 0x2e1065,
                position: new THREE.Vector3(-17.0, 0, 2.5),
                rotationY: -Math.PI / 2,
                personality: 'Доброжелательный гений. Объясняет релятивистские эффекты, инвариантность скорости света и работу световых часов.',
                avatarSvg: 'einstein',
                initialGreeting: 'Приветствую, коллега! Скорость света c инвариантна во всех системах отсчета. Из-за этого время в движущемся поезде течет медленнее!',
                knowledgeTopics: [
                    { id: 'einstein_c', label: 'Инвариантность c', text: 'Скорость света c = 299 792 км/с одинакова для любого наблюдателя, независимо от его движения.' },
                    { id: 'einstein_clock', label: 'Световые часы', text: 'Фотон между зеркалами движущегося вагона чертит диагональ. Путь длиннее, а c постоянна — значит, время замедляется.' },
                    { id: 'einstein_gamma', label: 'Фактор Лоренца', text: 'При скорости 0.6c время замедляется в 1.25 раза, а при 0.8c — в 1.6667 раза!' }
                ]
            }
        };
    }

    _spawnCrewModels() {
        for (const [key, profile] of Object.entries(this.profiles)) {
            const memberGroup = new THREE.Group();
            memberGroup.name = `crew_${profile.id}`;
            memberGroup.position.copy(profile.position);
            memberGroup.rotation.y = profile.rotationY;

            let charMesh;
            if (profile.id === 'astra') {
                charMesh = this._createAstraHologramModel(profile);
            } else {
                charMesh = this._createHumanCrewModel(profile);
            }
            memberGroup.add(charMesh);

            // 2D/3D динамический бейдж над головой
            const nameplate = this._createNameplate(profile);
            nameplate.position.y = profile.id === 'astra' ? 2.6 : 2.3;
            memberGroup.add(nameplate);

            // Неоновый маркер на полу
            const ringGeo = new THREE.RingGeometry(0.8, 0.95, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: profile.threeColor,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.6
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = 0.02;
            memberGroup.add(ringMesh);

            this.scene.add(memberGroup);

            this.crewMembers.set(profile.id, {
                group: memberGroup,
                bodyGroup: charMesh,
                ringMesh: ringMesh,
                profile: profile,
                basePos: profile.position.clone()
            });
        }
    }

    /**
     * Создание уникальной голограммы бортового ИИ АСТРА
     */
    _createAstraHologramModel(profile) {
        const astraGroup = new THREE.Group();

        // 1. Пьедестал на полу
        const pedestalGeo = new THREE.CylinderGeometry(1.0, 1.3, 0.35, 24);
        const pedestalMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.4,
            metalness: 0.8
        });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.y = 0.175;
        pedestal.receiveShadow = true;
        astraGroup.add(pedestal);

        // Светящееся неоновое кольцо эмиттера
        const emitterRingGeo = new THREE.TorusGeometry(0.85, 0.05, 16, 48);
        const emitterRingMat = new THREE.MeshStandardMaterial({
            color: 0x00f5ff,
            emissive: 0x00f5ff,
            emissiveIntensity: 1.0,
            roughness: 0.2,
            metalness: 0.8
        });
        const emitterRing = new THREE.Mesh(emitterRingGeo, emitterRingMat);
        emitterRing.rotation.x = Math.PI / 2;
        emitterRing.position.y = 0.36;
        astraGroup.add(emitterRing);

        // 2. Голографический конус восходящего света
        const beamGeo = new THREE.CylinderGeometry(0.4, 0.85, 2.0, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x00f5ff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 1.35;
        astraGroup.add(beam);

        // 3. Центральное парящее ядро ИИ
        const coreGeo = new THREE.IcosahedronGeometry(0.42, 1);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x00f5ff,
            emissive: 0x00b4d8,
            emissiveIntensity: 0.9,
            roughness: 0.1,
            metalness: 0.9
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 1.6;
        astraGroup.add(core);

        // Внутренний полигональный каркас
        const wireGeo = new THREE.IcosahedronGeometry(0.48, 1);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        const wireCore = new THREE.Mesh(wireGeo, wireMat);
        wireCore.position.y = 1.6;
        astraGroup.add(wireCore);

        // 4. Встречно вращающиеся кольца гироскопа
        const ring1Geo = new THREE.TorusGeometry(0.72, 0.025, 16, 48);
        const ring1 = new THREE.Mesh(ring1Geo, emitterRingMat);
        ring1.position.y = 1.6;
        astraGroup.add(ring1);

        const ring2Geo = new THREE.TorusGeometry(0.92, 0.02, 16, 48);
        const ring2 = new THREE.Mesh(ring2Geo, emitterRingMat);
        ring2.position.y = 1.6;
        astraGroup.add(ring2);

        // 5. Орбитальные узлы данных (4 спутника)
        const satellites = [];
        for (let i = 0; i < 4; i++) {
            const satGeo = new THREE.OctahedronGeometry(0.08);
            const satMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0x00f5ff,
                emissiveIntensity: 1.0
            });
            const sat = new THREE.Mesh(satGeo, satMat);
            sat.position.y = 1.6;
            astraGroup.add(sat);
            satellites.push(sat);
        }

        astraGroup.userData = {
            isAstra: true,
            core,
            wireCore,
            ring1,
            ring2,
            satellites
        };

        return astraGroup;
    }

    /**
     * Создание детального 3D-скафандра для людей
     */
    _createHumanCrewModel(profile) {
        const charGroup = new THREE.Group();

        const suitMat = new THREE.MeshStandardMaterial({
            color: profile.secondaryColor,
            roughness: 0.4,
            metalness: 0.3
        });

        const accentMat = new THREE.MeshStandardMaterial({
            color: profile.threeColor,
            roughness: 0.3,
            metalness: 0.6
        });

        const visorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: profile.threeColor,
            emissiveIntensity: 0.9,
            roughness: 0.1,
            metalness: 0.9
        });

        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            roughness: 0.3,
            metalness: 0.8
        });

        // Ноги
        const legGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.8, 12);
        const legLeft = new THREE.Mesh(legGeo, suitMat);
        legLeft.position.set(-0.2, 0.45, 0);
        legLeft.castShadow = true;
        charGroup.add(legLeft);

        const legRight = new THREE.Mesh(legGeo, suitMat);
        legRight.position.set(0.2, 0.45, 0);
        legRight.castShadow = true;
        charGroup.add(legRight);

        // Ботинки
        const bootGeo = new THREE.BoxGeometry(0.18, 0.14, 0.28);
        const bootL = new THREE.Mesh(bootGeo, accentMat);
        bootL.position.set(-0.2, 0.1, 0.05);
        bootL.castShadow = true;
        charGroup.add(bootL);

        const bootR = new THREE.Mesh(bootGeo, accentMat);
        bootR.position.set(0.2, 0.1, 0.05);
        bootR.castShadow = true;
        charGroup.add(bootR);

        // Торс (модифицируется по роли)
        let torsoGeo;
        if (profile.id === 'engineer') {
            torsoGeo = new THREE.BoxGeometry(0.68, 0.78, 0.42);
        } else if (profile.id === 'captain') {
            torsoGeo = new THREE.CylinderGeometry(0.29, 0.25, 0.76, 12);
        } else {
            torsoGeo = new THREE.CylinderGeometry(0.25, 0.23, 0.72, 12);
        }
        const torso = new THREE.Mesh(torsoGeo, suitMat);
        torso.position.y = 1.15;
        torso.castShadow = true;
        charGroup.add(torso);

        // Нагрудная пластина
        const chestGeo = new THREE.BoxGeometry(0.36, 0.32, 0.06);
        const chest = new THREE.Mesh(chestGeo, accentMat);
        chest.position.set(0, 1.25, 0.19);
        charGroup.add(chest);

        // Рюкзак системы жизнеобеспечения
        const packGeo = new THREE.BoxGeometry(0.42, 0.52, 0.22);
        const pack = new THREE.Mesh(packGeo, metalMat);
        pack.position.set(0, 1.2, -0.22);
        pack.castShadow = true;
        charGroup.add(pack);

        // Руки
        const armGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.65, 10);
        const armLeft = new THREE.Mesh(armGeo, suitMat);
        armLeft.position.set(-0.4, 1.1, 0);
        armLeft.rotation.z = 0.15;
        armLeft.castShadow = true;
        charGroup.add(armLeft);

        const armRight = new THREE.Mesh(armGeo, suitMat);
        armRight.position.set(0.4, 1.1, 0);
        armRight.rotation.z = -0.15;
        armRight.castShadow = true;
        charGroup.add(armRight);

        // Шлем
        const helmetGeo = new THREE.SphereGeometry(0.24, 20, 20);
        const helmet = new THREE.Mesh(helmetGeo, suitMat);
        helmet.position.y = 1.72;
        helmet.castShadow = true;
        charGroup.add(helmet);

        // Визор шлема
        const visorGeo = new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI);
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.rotation.y = Math.PI / 2;
        visor.position.set(0, 1.72, 0.12);
        charGroup.add(visor);

        // Ролевые аксессуары
        if (profile.id === 'engineer') {
            // Наплечный прожектор и инструмент на поясе
            const lightGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.14, 12);
            const light = new THREE.Mesh(lightGeo, accentMat);
            light.position.set(-0.25, 1.6, 0.1);
            light.rotation.x = Math.PI / 3;
            charGroup.add(light);

            const toolGeo = new THREE.BoxGeometry(0.08, 0.35, 0.1);
            const tool = new THREE.Mesh(toolGeo, metalMat);
            tool.position.set(0.36, 0.85, 0.1);
            charGroup.add(tool);
        } else if (profile.id === 'biologist') {
            // Планшет с биопробами в руке и био-колба
            const padGeo = new THREE.BoxGeometry(0.24, 0.02, 0.32);
            const pad = new THREE.Mesh(padGeo, accentMat);
            pad.position.set(0, 1.0, 0.3);
            pad.rotation.x = -Math.PI / 6;
            charGroup.add(pad);

            const vialGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10);
            const vialMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.8 });
            const vial = new THREE.Mesh(vialGeo, vialMat);
            vial.position.set(-0.35, 0.9, 0);
            charGroup.add(vial);
        } else if (profile.id === 'captain') {
            // Командирские золотые эполеты и тактический визор
            const epauletGeo = new THREE.BoxGeometry(0.24, 0.06, 0.14);
            const epL = new THREE.Mesh(epauletGeo, accentMat);
            epL.position.set(-0.36, 1.5, 0);
            charGroup.add(epL);

            const epR = new THREE.Mesh(epauletGeo, accentMat);
            epR.position.set(0.36, 1.5, 0);
            charGroup.add(epR);
        } else if (profile.id === 'herodotus') {
            // Античная тога, золотой лавровый венок и свиток папируса
            const togaMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
            const togaGeo = new THREE.CylinderGeometry(0.36, 0.44, 1.25, 16);
            const toga = new THREE.Mesh(togaGeo, togaMat);
            toga.position.y = 0.95;
            charGroup.add(toga);

            const wreathGeo = new THREE.TorusGeometry(0.24, 0.03, 8, 24);
            const wreathMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 });
            const wreath = new THREE.Mesh(wreathGeo, wreathMat);
            wreath.position.set(0, 1.82, 0);
            wreath.rotation.x = Math.PI / 2;
            charGroup.add(wreath);

            const scrollGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 12);
            const scrollMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
            const scroll = new THREE.Mesh(scrollGeo, scrollMat);
            scroll.position.set(0.38, 1.0, 0.2);
            scroll.rotation.x = Math.PI / 4;
            charGroup.add(scroll);
        } else if (profile.id === 'einstein') {
            // Теплый свитер, пышные белые волосы и фотонный излучатель
            const sweaterMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
            const sweaterGeo = new THREE.BoxGeometry(0.66, 0.76, 0.44);
            const sweater = new THREE.Mesh(sweaterGeo, sweaterMat);
            sweater.position.y = 1.15;
            charGroup.add(sweater);

            const hairGeo = new THREE.SphereGeometry(0.28, 12, 12);
            const hairMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95 });
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 1.8, -0.05);
            charGroup.add(hair);

            const emitterGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.26, 10);
            const emitterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.2 });
            const emitter = new THREE.Mesh(emitterGeo, emitterMat);
            emitter.position.set(0.38, 1.0, 0.2);
            emitter.rotation.x = -Math.PI / 6;
            charGroup.add(emitter);
        }

        return charGroup;
    }

    _createNameplate(profile) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Фон бейджа
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.roundRect(10, 10, 492, 108, 16);
        ctx.fill();

        ctx.lineWidth = 4;
        ctx.strokeStyle = profile.themeColor;
        ctx.roundRect(10, 10, 492, 108, 16);
        ctx.stroke();

        // Текст имени
        ctx.fillStyle = profile.themeColor;
        ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(profile.name.toUpperCase(), 256, 55);

        // Текст роли
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(profile.role, 256, 95);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(2.4, 0.6, 1.0);
        return sprite;
    }

    update(playerPos, time) {
        let closest = null;
        let minDistance = Infinity;

        for (const [id, member] of this.crewMembers.entries()) {
            // Анимация АСТРЫ (голограмма)
            if (member.group.userData?.isAstra) {
                const u = member.group.userData;
                const floatY = 1.6 + Math.sin(time * 2.5) * 0.07;
                u.core.position.y = floatY;
                u.wireCore.position.y = floatY;
                u.wireCore.rotation.y = time * 0.8;
                u.wireCore.rotation.x = time * 0.5;

                u.ring1.position.y = floatY;
                u.ring1.rotation.x = time * 1.6;
                u.ring1.rotation.y = time * 1.1;

                u.ring2.position.y = floatY;
                u.ring2.rotation.x = -time * 1.3;
                u.ring2.rotation.z = time * 1.5;

                u.satellites.forEach((sat, idx) => {
                    const angle = time * 2.0 + (idx * Math.PI / 2);
                    const radius = 1.25;
                    sat.position.set(
                        Math.cos(angle) * radius,
                        floatY + Math.sin(time * 3.0 + idx) * 0.15,
                        Math.sin(angle) * radius
                    );
                    sat.rotation.y = time * 4.0;
                });
            } else {
                // Дыхание людей
                if (member.bodyGroup) {
                    member.bodyGroup.position.y = Math.sin(time * 2.0 + (id.length)) * 0.03;
                }
            }

            // Пульсация неонового круга на полу
            if (member.ringMesh) {
                const pulse = 1.0 + Math.sin(time * 3.0) * 0.08;
                member.ringMesh.scale.set(pulse, pulse, 1);
            }

            // Дистанция до игрока
            const dist = playerPos.distanceTo(member.basePos);
            if (dist < minDistance) {
                minDistance = dist;
                closest = {
                    id,
                    profile: member.profile,
                    distance: dist
                };
            }

            // Поворот людей к игроку при приближении
            if (dist < 5.0 && !member.group.userData?.isAstra) {
                const targetRotation = Math.atan2(
                    playerPos.x - member.basePos.x,
                    playerPos.z - member.basePos.z
                );
                member.group.rotation.y = THREE.MathUtils.lerp(
                    member.group.rotation.y,
                    targetRotation,
                    0.05
                );
            }
        }

        if (closest && closest.distance <= 3.5) {
            this.nearestMember = closest.profile;
        } else {
            this.nearestMember = null;
        }

        return this.nearestMember;
    }

    getProfile(id) {
        return this.profiles[id] || null;
    }
}
