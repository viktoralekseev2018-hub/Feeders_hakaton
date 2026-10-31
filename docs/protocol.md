# Контракт v1

## HTTP

Auth-ответы — JSON, `Cache-Control: no-store`. Ошибка:
`{"code":"unauthorized","message":"Неверное имя или пароль"}`.

| Метод / путь | Вход | Успех | Ошибки |
|---|---|---|---|
| `GET /healthz` | — | 200 `{"status":"ok"}` | — |
| `POST /api/auth/register` | `{username,password}` | 201 `{success:true,user:{id,username}}` + cookie | 400, 409, 429, 500 |
| `POST /api/auth/login` | `{username,password}` | 200 тот же формат + cookie | 400, 401, 429, 500 |
| `POST /api/auth/logout` | пусто/`{}` | 200 `{success:true}`, удаляет сессию | 403 Origin |
| `GET /api/auth/me` | cookie | 200 `{success:true,user:{id,username}}` | 401 |
| `GET /ws` | cookie + Upgrade | 101 | 401 до Upgrade, 403 Origin, 409 второй сокет, 503 остановка |

Имя: trim + lower case, 3–32 Unicode-буквы/цифры/`_`/`-`. Пароль: 6–72 **байта
UTF-8**, без нормализации. Тело auth ≤4096 байт. Cookie session_id: HttpOnly,
SameSite=Lax, Path=/, TTL и Secure из конфига. Регистрация уже создаёт сессию;
повторный login текущего UI поддержан и заменяет сессию в cookie. Хеши не выдаются.

POST из браузера допускается с совпадающим Origin: схема, host, порт. Отсутствующий
Origin разрешён для CLI. WS имеет ту же проверку после auth. Выход/истечение сессии
закрывают сокет при следующей проверке (каждую секунду). После рестарта старая cookie
недействительна. Один сокет на аккаунт; новая вкладка ждёт завершения старого cleanup.

## WebSocket

```json
{"protocol_version":1,"type":"player.init","request_id":"req-1","payload":{}}
```

Текстовый JSON ≤8192 байт. Payload — объект. Type: 1–64 байта, request_id: 1–128
байт (используйте ASCII). Ответ повторяет ID; событие сервера имеет пустой ID.
При повреждённом конверте error имеет пустой ID. Лишние поля конверта запрещены.
ID служит корреляции, не гарантирует дедупликацию/exactly-once; input имеет seq.

| Клиент → сервер | Payload | Ответ |
|---|---|---|
| `player.init` | `{}` либо `{client_time?,username?}` | `player.ready` |
| `ping` | любой объект, обычно `{timestamp}` | `pong` с тем же payload |
| `player.input` | `{seq,x,y,z,yaw}`, все обязательны | без ack при успехе, error при отказе |

Username в init принимается для совместимости, но идентичность берётся из cookie.
Client_time — целые Unix-миллисекунды, не авторитетное время. Seq — целое
1..9007199254740991, монотонное в пределах подключения. Координаты — конечные числа,
Y вверх, метры, yaw — радианы. Повторный init возвращает исходный ready без нового Join.

```json
{
  "protocol_version": 1,
  "type": "player.ready",
  "request_id": "req-1",
  "payload": {
    "user": { "id": "server-generated-id", "username": "explorer" },
    "state": {
      "player_id": "server-generated-id",
      "position": { "x": 0, "y": 1.7, "z": 5 },
      "yaw": 0, "last_seq": 0, "updated_at": "2026-10-31T00:00:00Z"
    },
    "capabilities": { "movement": false, "world": false, "agents": false }
  }
}
```

В каркасе все capabilities=false. Локальная сцена может двигаться, но это ещё не
синхронизированный мир. Подключение World включает movement/world; если этапы
включаются раздельно, расширьте конфигурацию capabilities при интеграции.

Error payload: `{code,message}`. Коды:

- `invalid_message`: конверт/версия.
- `unknown_type`: нет обработчика.
- `invalid_payload`: неверные поля.
- `not_initialized`: сначала init.
- `feature_disabled`: World не подключён.
- `input_rejected`: доменная проверка отвергла движение.
- `internal_error`: ошибка хранения/инициализации; детали только в логах.

Application ping/pong и протокольный WS ping/pong — разные механизмы. На протокольный
ping браузер отвечает автоматически. При разрыве проверьте /api/auth/me, откройте WS,
отправьте новый init; автоматический reconnect пока не реализован. Превышение
размера, частоты, переполнение очереди закрывают соединение; фиксированный close code
в этих случаях не гарантируется.

## Следующий этап

world.snapshot, world.manifest, chunk.load/unload, chat.send, agent.talk/reply —
названия для обсуждения, **не работающие API**. Listener world.snapshot в клиенте
ещё не означает согласованного payload. Сначала зафиксируйте версии чанков,
байтовые бюджеты, seq/timestamp снапшота, лимиты текста и ответы/память NPC.
