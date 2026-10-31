# ХроноГрад — каркас хоста

Go-хост для образовательной браузерной игры в LAN/Wi-Fi. Хост запускает сервер и
открывает игру в браузере; остальные открывают тот же клиент по IP хоста. Каждый
ноутбук рендерит сцену самостоятельно. Во время игры интернет не нужен.

Работают HTTP, cookie-авторизация, WebSocket, файловое хранение аккаунтов и начального
состояния игрока, встроенная раздача существующего Three.js-клиента. **Мир, проверка
движения, синхронизация игроков, AOI/чанки, кеш ≤10% и локальные NPC ещё не реализованы.**
Для них подготовлены интерфейсы. Текущая 3D-сцена уже была в репозитории.

## Запуск

Нужен Go 1.23+. Первую загрузку зависимостей выполните до отключения интернета.
Для существующего клиента не нужны Node.js, npm, Vite или Ollama.

```powershell
go mod download
go run ./cmd/game-server
```

Откройте http://localhost:8080 и зарегистрируйтесь: имя от 3 символов, пароль от
6 байт. Второй ноутбук в той же сети открывает `http://<IPv4-хоста>:8080`.
IPv4 смотрите через `ipconfig`; при запросе Windows разрешите приложению доступ
в частной сети. Wi-Fi не должен изолировать устройства друг от друга.

Соберите бинарник заранее:

```powershell
./scripts/build.ps1
./bin/game-server.exe
```

Кроссплатформенно: `go build -trimpath -o bin/game-server ./cmd/game-server`.
Клиент встроен в бинарник. Для переноса достаточно бинарника; каталог data переносите
отдельно, если нужны прежние аккаунты/состояния. Данные создаются относительно
рабочей директории процесса. Только один процесс хоста на каталог данных.

## Конфигурация

Переменные окружения; файл .env автоматически не читается.

| Переменная | По умолчанию | Назначение |
|---|---|---|
| HOST_ADDR | 0.0.0.0:8080 | Все LAN-интерфейсы |
| DATA_DIR | data | Аккаунты/состояния, вне публичной статики |
| SESSION_TTL | 12h | Время жизни сессии от 1s до 720h |
| COOKIE_SECURE | false | Для прямого LAN HTTP; true требует HTTPS |

```powershell
$env:HOST_ADDR = '0.0.0.0:8090'
$env:DATA_DIR = 'D:\Hackathon\host-data'
go run ./cmd/game-server
```

Сессии хранятся в памяти и сбрасываются при перезапуске. Аккаунты с bcrypt-хешами
и состояния — в JSON. Сейчас сохраняется только стартовая позиция; последующие
сохранения проверенных перемещений реализует World.

## Параллельная работа команды

| Владелец | Директории | Подключение |
|---|---|---|
| Dev 1: Core/World/Storage | internal/world, internal/storage, internal/server, cmd/game-server | Реализовать world.Service, передать в game.New |
| Dev 2: Auth/Realtime/AI | internal/auth, internal/realtime, internal/agents, будущий cmd/mcp-tools | Hub.Handle, Hub.Publish, agents.Service |
| Dev 3: Client | web/src, web/css, web/index.html, будущая Vite-конфигурация | HTTP/WS, player.ready и события |
| Общие, согласовывать | contracts, pkg/protocol, internal/model, internal/game, go.mod, web/embed*.go | Контракты и склейка |

Начните с [архитектуры](docs/architecture.md), [протокола](docs/protocol.md) и
[чек-листа интеграции](docs/acceptance.md). Go-типы: pkg/protocol, TS-типы:
contracts/protocol.ts, JSON Schema: contracts/client-message.schema.json.
Для UI есть явно подключаемый contracts/mock-network.js. Ошибки настоящего
сервера больше не превращаются в скрытый «успешный вход».

## Клиент и Vite

Сейчас в репозитории JavaScript и локальный Three.js r160 без сборщика. Обычный
Go build встраивает index.html, css, src, vendor. После правок клиента перезапустите
Go с пересборкой. Когда Dev 3 перейдёт на TS/Vite, сборка должна попадать в web/dist:

```powershell
# Сначала npm run build в web, когда появится Vite-проект
./scripts/build.ps1 -WebDist
# или
go build -tags webdist -o bin/game-server.exe ./cmd/game-server
```

Тег webdist встраивает только готовую сборку. web/dist не коммитится. Все ассеты,
шрифты и модели локальные, без CDN. Для Vite dev server настройте прокси /api и /ws
(ws: true) на Go-хост с согласованными Host/Origin (changeOrigin: false),
не отключая проверку Origin. Финальная LAN-проверка идёт через один origin Go-хоста.

## Проверки

```powershell
go test ./...
go vet ./...
go test -race ./...
```

Race требует CGO и C-компилятор; CI запускает его на Linux. Тесты проверяют реальные
HTTP/WS, 401, Origin, cookie, logout/expiry, shutdown, сохранение после перезапуска,
контракт и подключение World. CI рассчитан на Go 1.23 Windows/Linux.
Это не заменяет проверку на двух настоящих ноутбуках.

Технические основания: [Go embed](https://pkg.go.dev/embed),
[Gorilla WebSocket](https://pkg.go.dev/github.com/gorilla/websocket),
[bcrypt](https://pkg.go.dev/golang.org/x/crypto/bcrypt).
