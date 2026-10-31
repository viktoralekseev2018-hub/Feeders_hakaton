import * as THREE from 'three';

/**
 * TextureGenerator.js
 * Высококачественная процедурная генерация текстур через HTML5 Canvas API (100% Offline).
 * Обеспечивает фотореалистичный вид материалов без внешних CDN и тяжелых загрузок:
 * - Текстура обивки дивана и подушек
 * - Текстура темного дерева для журнального и обеденного стола
 * - Текстура полированного и шлифованного металла (brushed steel)
 * - Динамическая текстура Земли на экране телевизора в комнате отдыха
 * - Античный свиток папируса для Геродота
 * - Экраны осциллографа и релятивистских часов
 */
export class TextureGenerator {
    /**
     * Тканевая текстура обивки мягкой мебели (диван, подушки)
     */
    static createFabricTexture(baseHex = '#1e293b', accentHex = '#334155') {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, size, size);

        // Перекрестное плетение нитей
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 1;
        for (let i = 0; i < size; i += 4) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(size, i);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size);
            ctx.stroke();
        }

        // Шум микроволокон
        const imgData = ctx.getImageData(0, 0, size, size);
        for (let p = 0; p < imgData.data.length; p += 4) {
            const noise = (Math.random() - 0.5) * 20;
            imgData.data[p] = Math.min(255, Math.max(0, imgData.data[p] + noise));
            imgData.data[p + 1] = Math.min(255, Math.max(0, imgData.data[p + 1] + noise));
            imgData.data[p + 2] = Math.min(255, Math.max(0, imgData.data[p + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        return tex;
    }

    /**
     * Текстура благородного дерева для столешниц
     */
    static createWoodTexture(darkHex = '#3e2723', lightHex = '#5d4037') {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, size, 0);
        grad.addColorStop(0, darkHex);
        grad.addColorStop(0.5, lightHex);
        grad.addColorStop(1, darkHex);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // Годичные кольца и волокна
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < size; y += 3) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            const wave = Math.sin(y * 0.05) * 8;
            ctx.bezierCurveTo(size * 0.33, y + wave, size * 0.66, y - wave, size, y);
            ctx.lineWidth = 1 + Math.random();
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    /**
     * Шлифованный металл (Brushed Steel) для кухни, мостика и лаборатории
     */
    static createBrushedMetalTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#475569';
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        for (let i = 0; i < 600; i++) {
            const y = Math.random() * size;
            const h = 1 + Math.random() * 2;
            ctx.fillRect(0, y, size, h);
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        for (let i = 0; i < 400; i++) {
            const y = Math.random() * size;
            const h = 1 + Math.random();
            ctx.fillRect(0, y, size, h);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    /**
     * Земной пейзаж для широкоэкранного телевизора кают-компании
     */
    static createEarthLandscapeTexture() {
        const width = 512;
        const height = 288; // 16:9
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Небо с градиентом рассвета
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.65);
        skyGrad.addColorStop(0, '#0284c7');
        skyGrad.addColorStop(0.6, '#38bdf8');
        skyGrad.addColorStop(1, '#fde047');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Солнце
        ctx.fillStyle = 'rgba(255, 255, 240, 0.9)';
        ctx.beginPath();
        ctx.arc(width * 0.75, height * 0.35, 30, 0, Math.PI * 2);
        ctx.fill();

        // Горы на горизонте
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.6);
        ctx.lineTo(80, height * 0.38);
        ctx.lineTo(170, height * 0.55);
        ctx.lineTo(260, height * 0.32);
        ctx.lineTo(360, height * 0.52);
        ctx.lineTo(440, height * 0.36);
        ctx.lineTo(width, height * 0.58);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();

        // Хвойный зеленый лес
        ctx.fillStyle = '#166534';
        for (let x = 0; x < width; x += 12) {
            const treeH = 30 + Math.sin(x * 0.08) * 12 + Math.random() * 8;
            ctx.beginPath();
            ctx.moveTo(x - 8, height * 0.7);
            ctx.lineTo(x, height * 0.7 - treeH);
            ctx.lineTo(x + 8, height * 0.7);
            ctx.fill();
        }

        // Озеро с отражением
        const lakeGrad = ctx.createLinearGradient(0, height * 0.68, 0, height);
        lakeGrad.addColorStop(0, '#0369a1');
        lakeGrad.addColorStop(1, '#0c4a6e');
        ctx.fillStyle = lakeGrad;
        ctx.fillRect(0, height * 0.68, width, height * 0.32);

        // Титры в углу экрана
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('АРХИВ ЗЕМЛИ: Озеро Байкал • Цикл релаксации', 16, 26);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Текстура старинного папируса с греческим текстом для свитка Геродота
     */
    static createPapyrusTexture() {
        const width = 512;
        const height = 256;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Желто-песочный фон пергамента
        ctx.fillStyle = '#e2c58a';
        ctx.fillRect(0, 0, width, height);

        // Волокна тростника
        ctx.fillStyle = 'rgba(120, 85, 40, 0.12)';
        for (let y = 0; y < height; y += 2) {
            ctx.fillRect(0, y, width, 1);
        }
        for (let x = 0; x < width; x += 4) {
            ctx.fillRect(x, 0, 1, height);
        }

        // Обгорелые края
        const edgeGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.55);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGrad.addColorStop(1, 'rgba(100, 50, 10, 0.45)');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(0, 0, width, height);

        // Античный греческий текст
        ctx.fillStyle = '#2b1d0c';
        ctx.font = '13px serif';
        ctx.fillText('ΗΡΟΔΟΤΟΥ ΑΛΙΚΑΡΝΗΣΣΕΟΣ ΙΣΤΟΡΙΗΣ: ΕΥΤΕΡΠΗ (ΒΙΒΛΟΣ Β)', 20, 35);
        ctx.fillText('19. Της δε δη φύσιος του ποταμού περι ουδεν οιος τε εγενομην παραλαβειν...', 20, 65);
        ctx.fillText('124. Την δε πυραμίδα ποιησαι αναβαθμων τροπον, τας μετεξετεροι κροσσας...', 20, 95);
        ctx.fillText('148. Και δη και λαβυρινθον τουτον επραξαν υπερβαλλοντα και τας πυραμιδας...', 20, 125);
        ctx.fillText('«До сих пор я излагал то, что видел сам и исследовал лично...»', 20, 160);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Текстура приборной панели с индикаторами для капитанского мостика
     */
    static createCockpitPanelTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, size, size);

        // Сетка приборов
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, size - 20, size - 20);

        // Радар
        ctx.fillStyle = '#022c22';
        ctx.beginPath();
        ctx.arc(140, 140, 90, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(140, 140, 85, 0, Math.PI * 2);
        ctx.arc(140, 140, 55, 0, Math.PI * 2);
        ctx.arc(140, 140, 25, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(50, 140); ctx.lineTo(230, 140);
        ctx.moveTo(140, 50); ctx.lineTo(140, 230);
        ctx.stroke();

        // Сигналы на радаре
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(180, 100, 4, 0, Math.PI * 2); ctx.fill(); // Юпитер
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(120, 150, 3, 0, Math.PI * 2); ctx.fill(); // Станция

        // Цифровые шкалы
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('ТРАЕКТОРИЯ: ОРБИТА ЮПИТЕРА', 260, 60);
        ctx.fillStyle = '#22c55e';
        ctx.fillText('СКОРОСТЬ: 0.60 c (SUB-LIGHT)', 260, 95);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('ГРАВИТАЦИОННЫЙ РАДИУС: OK', 260, 130);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('ДЕФИЦИТ O2: ОСТАЛОСЬ 8 ЦИКЛОВ', 260, 165);

        // Тумблеры и кнопки внизу
        for (let x = 30; x < size - 30; x += 45) {
            ctx.fillStyle = (x % 90 === 0) ? '#ef4444' : '#0284c7';
            ctx.fillRect(x, 400, 30, 40);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(x + 10, 415, 10, 10);
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Светящаяся голографическая табличка-указатель над шлюзовыми дверями отсеков
     */
    static createRoomSignTexture(number, titleRu, titleEn, accentHex = '#00f5ff') {
        const width = 512;
        const height = 128;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Темный фон панели
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);

        // Светящаяся рамка с акцентным цветом
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 4;
        ctx.strokeRect(6, 6, width - 12, height - 12);

        // Внутренняя тонкая окантовка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(12, 12, width - 24, height - 24);

        // Номер отсека слева в светящемся квадрате
        ctx.fillStyle = accentHex;
        ctx.fillRect(20, 20, 88, 88);

        ctx.fillStyle = '#090d16';
        ctx.font = '900 48px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number, 64, 64);

        // Основное название отсека (RU)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 26px "Inter", sans-serif';
        ctx.fillText(titleRu, 128, 48);

        // Английский подзаголовок (EN)
        ctx.fillStyle = accentHex;
        ctx.font = '600 16px monospace';
        ctx.fillText(titleEn.toUpperCase(), 128, 82);

        // Индикатор онлайн-статуса отсека
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(width - 32, 32, 6, 0, Math.PI * 2);
        ctx.fill();

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Желто-черная диагональная полоса безопасности (Hazard Stripe)
     */
    static createHazardStripeTexture() {
        const width = 256;
        const height = 64;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f59e0b'; // Ярко-желтый
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#111827'; // Черный
        const stripeW = 32;
        for (let x = -height; x < width + height; x += stripeW * 2) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + stripeW, 0);
            ctx.lineTo(x + stripeW - height, height);
            ctx.lineTo(x - height, height);
            ctx.closePath();
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 1);
        return tex;
    }

    /**
     * Светлая плитка для камбуза и санотсеков
     */
    static createKitchenTileTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, size, size);

        // Швы между плитками
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        const step = 64;
        for (let x = 0; x <= size; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(size, x); ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        return tex;
    }
}
