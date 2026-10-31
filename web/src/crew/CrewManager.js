import * as THREE from 'three';

/**
 * CrewManager.js
 * Управление ИИ-членами экипажа станции «Последний экипаж».
 * 
 * Предметная область: энергия, экология замкнутых систем и основы космонавтики.
 * Персонажи:
 * 1. Инженер Марк Вэнс — реакторный отсек, прагматик, спасает термоядерный генератор.
 * 2. Биолог Д-р Елена Ростова — оранжерея/биокупол, спасает гидропонику и кислород O2.
 * 3. Капитан Командор Александр Волк — командный мостик, координирует команду, ищет третье решение.
 * 
 * Каждый обладает уникальной 3D-внешностью, характером и диалоговым контекстом.
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
                position: new THREE.Vector3(14, 0, 0),
                rotationY: -Math.PI / 2,
                personality: 'Прагматичный технарь. Опирается на жесткие расчеты термодинамики, эмоционален в спорах о технике, не доверяет биологическим системам.',
                avatarSvg: 'engineer',
                dilemmaStance: 'Требует направить 100% оставшейся энергии на удержание магнитного поля реактора.',
                initialGreeting: 'С возвращением из криосна! У нас критическая ситуация: контур охлаждения реактора пробит. Если реактор расплавится — станция замерзнет через 40 минут! Плевать на оранжерею, спасаем генератор!',
                knowledgeTopics: [
                    { id: 'reactor_status', label: 'Состояние реактора', text: 'Магнитные ловушки нестабильны. Плазма греет стенки до 1800 К. Нужно минимум 15 МВт для удержания.' },
                    { id: 'greenhouse_opinion', label: 'Что насчет оранжереи?', text: 'Биолог витает в облаках со своими помидорами! Без электричества её гидропоника всё равно превратится в лёд. Физику не обманешь.' },
                    { id: 'third_solution', label: 'Есть ли компромисс?', text: 'Если мы сможем запустить импульсный цикл охлаждения дейтерия с частотой 2 Гц, мы сэкономим до 40% мощности. Но кто рискнет рассчитать термодинамику?' }
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
                position: new THREE.Vector3(0, 0, 14),
                rotationY: Math.PI,
                personality: 'Глубокий исследователь, защитница жизни. Понимает хрупкость замкнутых экосистем, мыслит долгосрочным выживанием людей.',
                avatarSvg: 'biologist',
                dilemmaStance: 'Требует сохранить фитоосвещение и терморегуляцию гидропоники ради регенерации кислорода.',
                initialGreeting: 'Вы проснулись! Дышите глубже, пока есть чем. Уровень O2 упал до 68%. Инженер хочет обесточить биокупол! Если температура упадет ниже +8°C, штаммы водорослей-оксигенаторов погибнут, и мы задохнемся!',
                knowledgeTopics: [
                    { id: 'o2_cycle', label: 'Цикл кислорода', text: 'Наши водоросли хлореллы и вертикальные фермы дают 94% кислорода на станции. Без них фильтры исчерпают ресурс за 48 часов.' },
                    { id: 'engineer_opinion', label: 'Что насчет реактора?', text: 'Марк мыслит только мегаваттами. Зачем нам работающий реактор на станции, полной задохнувшихся трупов? Мы должны бороться за биосферу!' },
                    { id: 'third_solution', label: 'Поиск третьего пути', text: 'Если перевести водоросли на анаэробный ночной метаболизм и снизить спектр ламп до 430 нм, мы снизим потребление оранжереи на 60% без гибели экосистемы.' }
                ]
            },
            captain: {
                id: 'captain',
                name: 'Командор Александр Волк',
                role: 'Командир станции «Гелиос-7»',
                locationName: 'Командный мостик (Центральный хаб)',
                themeColor: '#38bdf8',
                threeColor: 0x38bdf8,
                secondaryColor: 0x0f172a,
                position: new THREE.Vector3(0, 0, -4),
                rotationY: 0,
                personality: 'Дисциплинированный, дальновидный лидер. Уравновешивает споры, стремится объединить команду ради нестандартного решения.',
                avatarSvg: 'captain',
                dilemmaStance: 'Ищет синергетический компромисс между инженером и биологом, предотвращая раскол экипажа.',
                initialGreeting: 'Добро пожаловать на мостик, специалист. С Землей связи нет. Станция повреждена, энергия на исходе. Инженер и биолог спорят насмерть. Мне нужен ясный разум, чтобы найти третье решение.',
                knowledgeTopics: [
                    { id: 'disaster_info', label: 'Что случилось?', text: 'В 03:40 произошел внешний удар — возможно, микрометеоритный рой или взрыв криогенного бака в грузовом доке. Данные черного ящика повреждены.' },
                    { id: 'crew_dilemma', label: 'В чем суть спора?', text: 'У нас осталось 20 МВт резервной мощности. Марку нужно 15 МВт на реактор, Елене — 12 МВт на оранжерею. 15 + 12 = 27 МВт, а у нас только 20. Команда должна объединить усилия.' },
                    { id: 'third_solution', label: 'Приказ командира', text: 'Я приказываю: найти способ синхронизировать импульсный режим реактора и ночной режим биокупола. Тогда мы уложимся в 18 МВт и спасем станцию!' }
                ]
            }
        };
    }

    /**
     * Создание уникальных 3D-моделей персонажей экипажа
     */
    _spawnCrewModels() {
        for (const [key, profile] of Object.entries(this.profiles)) {
            const memberGroup = new THREE.Group();
            memberGroup.name = `crew_${profile.id}`;
            memberGroup.position.copy(profile.position);
            memberGroup.rotation.y = profile.rotationY;

            // 1. Постамент / зона взаимодействия
            const padGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.08, 24);
            const padMat = new THREE.MeshStandardMaterial({
                color: 0x161b22,
                roughness: 0.6,
                metalness: 0.4
            });
            const padMesh = new THREE.Mesh(padGeo, padMat);
            padMesh.position.y = 0.04;
            padMesh.receiveShadow = true;
            memberGroup.add(padMesh);

            // Светящееся неоновое кольцо статуса вокруг ног
            const ringGeo = new THREE.RingGeometry(1.0, 1.15, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: profile.threeColor,
                side: THREE.DoubleSide
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = -Math.PI / 2;
            ringMesh.position.y = 0.09;
            memberGroup.add(ringMesh);

            // 2. Тело скафандра персонажа (уникальное для каждого)
            const bodyGroup = this._createCharacterBody(profile);
            memberGroup.add(bodyGroup);

            // 3. Плавающий голографический маркер имени над головой
            const nameplate = this._createNameplate(profile);
            nameplate.position.y = 2.4;
            memberGroup.add(nameplate);

            this.scene.add(memberGroup);

            this.crewMembers.set(profile.id, {
                profile,
                group: memberGroup,
                bodyGroup,
                nameplate,
                ringMesh,
                basePos: profile.position.clone()
            });
        }
    }

    /**
     * Процедурная генерация уникального скафандра в зависимости от роли
     */
    _createCharacterBody(profile) {
        const charGroup = new THREE.Group();

        // Основные материалы
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

        // Ботинки скафандра
        const bootGeo = new THREE.BoxGeometry(0.18, 0.14, 0.28);
        const bootL = new THREE.Mesh(bootGeo, accentMat);
        bootL.position.set(-0.2, 0.1, 0.05);
        bootL.castShadow = true;
        charGroup.add(bootL);

        const bootR = new THREE.Mesh(bootGeo, accentMat);
        bootR.position.set(0.2, 0.1, 0.05);
        bootR.castShadow = true;
        charGroup.add(bootR);

        // Торс (для инженера — усиленный каркас, для биолога — гладкий легкий, для капитана — офицерский китель)
        let torsoGeo;
        if (profile.id === 'engineer') {
            torsoGeo = new THREE.BoxGeometry(0.65, 0.75, 0.4);
        } else if (profile.id === 'captain') {
            torsoGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.75, 12);
        } else {
            torsoGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.72, 12);
        }
        const torso = new THREE.Mesh(torsoGeo, suitMat);
        torso.position.y = 1.15;
        torso.castShadow = true;
        charGroup.add(torso);

        // Нагрудная пластина со светящимися индикаторами
        const chestGeo = new THREE.BoxGeometry(0.35, 0.3, 0.06);
        const chest = new THREE.Mesh(chestGeo, accentMat);
        chest.position.set(0, 1.25, 0.18);
        charGroup.add(chest);

        // Рюкзак жизнеобеспечения за спиной
        const packGeo = new THREE.BoxGeometry(0.4, 0.5, 0.22);
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

        // Визор шлема (уникальный цвет свечения)
        const visorGeo = new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI);
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.rotation.y = Math.PI / 2;
        visor.rotation.x = -Math.PI / 2;
        visor.position.set(0, 1.72, 0.08);
        charGroup.add(visor);

        // Уникальный атрибут персонажа в руках/на поясе:
        if (profile.id === 'engineer') {
            // Термо-сварочный резак и ящик с инструментами
            const toolGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8);
            const tool = new THREE.Mesh(toolGeo, accentMat);
            tool.position.set(0.38, 0.85, 0.2);
            tool.rotation.x = Math.PI / 3;
            charGroup.add(tool);
        } else if (profile.id === 'biologist') {
            // Голографический планшет с ростком
            const padGeo = new THREE.BoxGeometry(0.25, 0.02, 0.35);
            const pad = new THREE.Mesh(padGeo, accentMat);
            pad.position.set(0, 1.0, 0.3);
            pad.rotation.x = -Math.PI / 6;
            charGroup.add(pad);
        } else if (profile.id === 'captain') {
            // Капитанские золотые эполеты
            const epauletGeo = new THREE.BoxGeometry(0.22, 0.06, 0.14);
            const epL = new THREE.Mesh(epauletGeo, accentMat);
            epL.position.set(-0.35, 1.5, 0);
            charGroup.add(epL);
            const epR = new THREE.Mesh(epauletGeo, accentMat);
            epR.position.set(0.35, 1.5, 0);
            charGroup.add(epR);
        }

        return charGroup;
    }

    /**
     * Создание динамической 2D/3D плашки над головой
     */
    _createNameplate(profile) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Фон бейджа
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.roundRect(10, 10, 492, 108, 16);
        ctx.fill();

        ctx.lineWidth = 4;
        ctx.strokeStyle = profile.themeColor;
        ctx.roundRect(10, 10, 492, 108, 16);
        ctx.stroke();

        // Текст
        ctx.fillStyle = profile.themeColor;
        ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(profile.name.toUpperCase(), 256, 55);

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

    /**
     * Обновление анимаций и проверка расстояния до игрока
     * @param {THREE.Vector3} playerPos 
     * @param {number} time 
     */
    update(playerPos, time) {
        let closest = null;
        let minDistance = Infinity;

        for (const [id, member] of this.crewMembers.entries()) {
            // Небольшая idle-анимация покачивания (дыхание)
            if (member.bodyGroup) {
                member.bodyGroup.position.y = Math.sin(time * 2.0 + (id.length)) * 0.03;
            }

            // Пульсация неонового кольца
            if (member.ringMesh) {
                const pulse = 1.0 + Math.sin(time * 3.0) * 0.08;
                member.ringMesh.scale.set(pulse, pulse, 1);
            }

            // Расчет дистанции до игрока в плоскости XZ
            const dist = playerPos.distanceTo(member.basePos);
            if (dist < minDistance) {
                minDistance = dist;
                closest = {
                    id,
                    profile: member.profile,
                    distance: dist
                };
            }

            // Если игрок рядом (< 5м), персонаж слегка поворачивается лицом к игроку
            if (dist < 5.0) {
                const targetRotation = Math.atan2(
                    playerPos.x - member.basePos.x,
                    playerPos.z - member.basePos.z
                );
                // Плавная интерполяция поворота к игроку
                member.group.rotation.y = THREE.MathUtils.lerp(
                    member.group.rotation.y,
                    targetRotation,
                    0.05
                );
            }
        }

        // Интерактивная зона разговора — до 3.5 метров
        if (closest && closest.distance <= 3.5) {
            this.nearestMember = closest.profile;
        } else {
            this.nearestMember = null;
        }

        return this.nearestMember;
    }

    /**
     * Получить профиль по идентификатору
     */
    getProfile(id) {
        return this.profiles[id] || null;
    }
}
