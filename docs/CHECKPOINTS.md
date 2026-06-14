# Чекпоинты проекта

Документ фиксирует текущее состояние реализации: что уже сделано, что проверено и что осталось сделать дальше.

## Текущий статус

Проект перешел от планирования к первому рабочему каркасу Electron/Vue/TypeScript. Уже есть сборка, typed preload API, переносимые `core`-модули и первые тесты.

## Сделано

### Документация и правила

- Создан [план разработки](PROJECT_PLAN.md).
- Созданы [заметки по API](API_NOTES.md).
- Создан [changelog](../CHANGELOG.md).
- Создан файл версии [VERSION](../VERSION).
- Созданы agent rules и skills в `.agents`.
- Добавлены skills:
  - `backend`;
  - `frontend`;
  - `changelog`;
  - `commit`.
- В plan добавлены будущие модули:
  - GitHub-аддоны через source zip;
  - backup `WTF`;
  - FPS-патч;
  - обновление клиента по MD5;
  - мультиаккаунты;
  - автообновление WeakAuras;
  - автообновление лаунчера через GitHub Releases;
  - GitHub token для повышенных лимитов.

### Каркас приложения

- Добавлен `package.json`.
- Добавлен `package-lock.json`.
- Добавлен `electron-vite` config.
- Добавлены TypeScript configs:
  - `tsconfig.json`;
  - `tsconfig.node.json`;
  - `tsconfig.web.json`.
- Добавлен Electron main process.
- Добавлен preload через `contextBridge`.
- Добавлен Vue renderer.
- Добавлен базовый UI Dashboard.
- Renderer разнесен по frontend-слоям `page -> block -> element -> component`.
- Добавлена локализация `ru/en`.
- Добавлена светлая/темная тема через CSS variables.
- Добавлен CSP в renderer HTML.
- Добавлен `.gitignore`.

### Архитектура

- Заложена структура:
  - `src/core`;
  - `src/main`;
  - `src/preload`;
  - `src/renderer`;
  - `src/shared`;
  - `tests`.
- `core` сделан переносимым: без импортов Electron.
- Electron-specific логика держится в `main`/`preload`.
- Общие DTO и IPC channel names лежат в `src/shared/contracts.ts`.

### Реализованные core-модули

- `src/core/wow/wowPaths.ts`
  - строит пути клиента WoW;
  - проверяет базовую структуру клиента.
- `src/core/accounts/configWtf.ts`
  - обновляет `SET accountName`;
  - обновляет `SET readTerminationWithoutNotice`;
  - сохраняет остальные строки `Config.wtf`;
  - экранирует кавычки и slash в значениях.
- `src/core/github/githubAuth.ts`
  - создает `Authorization: Bearer ...`;
  - редактирует токен из логируемого текста;
  - парсит `X-RateLimit-*`;
  - классифицирует `401/403`.
- `src/core/github/sourceZip.ts`
  - строит GitHub source zip URL для ветки.
- `src/core/updater/appUpdate.ts`
  - мапит GitHub Release response;
  - сравнивает SemVer;
  - игнорирует pre-release по умолчанию;
  - определяет наличие обновления лаунчера.
- `src/core/backup/wtfBackup.ts`
  - строит план бекапа `WTF`;
  - строит план восстановления `WTF` с safety backup;
  - создает стабильное имя zip-архива;
  - определяет папку хранения бекапов.
- `src/core/fpsPatch/fpsPatch.ts`
  - определяет имя FPS-патча;
  - хранит primary/fallback ссылки;
  - строит план установки в `Data/ruRU`.

### Electron backend

- Main process создает `BrowserWindow`.
- Включен `contextIsolation`.
- Отключен `nodeIntegration`.
- Внешние ссылки открываются через `shell.openExternal`.
- IPC handlers регистрируются через schema-first wrapper с Zod validation для входов и выходов.
- Добавлены первые IPC handlers:
  - получить app info;
  - проверить GitHub token status;
  - сохранить GitHub token;
  - удалить GitHub token;
  - получить settings;
  - сохранить settings;
  - выбрать папку WoW через dialog;
  - список backup `WTF`;
  - создать backup `WTF`;
  - восстановить backup `WTF`;
  - удалить backup `WTF`;
  - открыть папку backup `WTF`;
  - получить статус FPS-патча;
  - установить FPS-патч;
  - проверить путь к WoW;
  - preview изменения `Config.wtf`.
- GitHub token сохраняется через Electron `safeStorage` в encrypted file внутри `userData`.
- Настройки лаунчера сохраняются в `settings.json` внутри `userData`.

### UI

- Есть базовый layout:
  - sidebar;
  - topbar;
  - dashboard panel.
- Показывается версия приложения.
- Показывается статус GitHub token.
- Есть ручная проверка пути к WoW.
- Есть сохранение пути к WoW.
- Есть выбор папки WoW через системный dialog.
- Есть toggles поведения запуска.
- Есть форма сохранения/удаления GitHub token.
- Есть переключение языка.
- Есть переключение светлой/темной темы.
- Есть блок создания, просмотра, восстановления и удаления backup `WTF`.
- Есть кнопка открытия папки backup `WTF` в проводнике.
- Есть блок статуса FPS-патча с установкой/переустановкой.
- Показываются найденные/отсутствующие базовые элементы клиента.

### CI и сборка

- GitHub Actions workflow делает install/check/build.
- На push workflow может запускать packaging через `electron-builder`.
- `npm run check` выполняет typecheck и unit tests.
- `npm run build` собирает main/preload/renderer.
- `npm run package` должен упаковывать приложение через `electron-builder`.

## Проверено

- `npm run check` проходит.
- `npm run build` проходит.
- Тесты проходят: 11 test files, 30 tests.
- Проверка portable core проходит: `src/core` не импортирует Electron.

## Частично сделано

### GitHub token

Сделано:

- core helpers;
- IPC save/clear/status;
- encrypted storage через `safeStorage`;
- UI показывает факт наличия токена;
- UI позволяет сохранить и удалить токен.

Осталось:

- проверка токена через GitHub API;
- отображение rate limit;
- обработка 401/403 в UI;
- тесты Electron adapter для secret storage.

### Мультиаккаунты

Сделано:

- core-функция обновления `Config.wtf`;
- IPC preview handler;
- тесты для `Config.wtf`.

Осталось:

- модель аккаунтов;
- UI управления аккаунтами;
- защищенное хранение паролей аккаунтов;
- реальная запись `Config.wtf` с backup;
- выбор аккаунта перед запуском.

### Автообновление лаунчера

Сделано:

- core helpers для GitHub Releases и SemVer.

Осталось:

- GitHub API client;
- выбор release asset;
- интеграция `electron-updater` или manual updater;
- UI проверки обновлений;
- публикация update metadata в GitHub Releases.

### Backup `WTF`

Сделано:

- core-план backup;
- core-план restore;
- zip adapter;
- безопасный unzip adapter;
- IPC list/create/restore/delete/open-folder;
- UI блок создания, восстановления и удаления backup;
- safety backup перед restore;
- integration test на создание zip из временной папки.
- integration test на распаковку zip и отказ от небезопасного archive entry.

Осталось:

- progress events;
- cancellation для долгих операций.

### FPS-патч

Сделано:

- core-план установки;
- downloader adapter через `fetch` и stream в файл;
- скачивание во временный файл;
- fallback с основной ссылки на альтернативную;
- установка в `<wowPath>/Data/ruRU/patch-ruRU-[.mpq`;
- IPC status/install;
- UI блок статуса и install/reinstall;
- тесты core-плана, fallback и установки через fake downloader.

Осталось:

- progress events;
- cancellation;
- checksum/MD5-проверка, если появится надежный эталон для файла.

## Следующие чекпоинты

### Чекпоинт 1. Настройки и путь к WoW

- Добавить tests для settings file adapter.
- Улучшить отображение статуса клиента на Dashboard.
- Добавить кнопку открытия папки клиента в проводнике.
- Добавить обработку ошибок чтения/записи settings.

### Чекпоинт 2. GitHub token settings

- Проверять token через GitHub API.
- Показывать rate limit.
- Не показывать сохраненное значение token.
- Добавить adapter tests для secret storage.

### Чекпоинт 3. Backup `WTF`

- Добавить progress events.
- Добавить cancellation для долгих операций backup/restore.
- Добавить лимиты/retention для старых backup.

### Чекпоинт 4. FPS-патч

- Добавить progress events.
- Добавить cancellation.
- Добавить checksum/MD5-проверку при наличии эталона.

### Чекпоинт 5. GitHub-аддоны

- Создать addon catalog.
- Скачать source zip по `repo/ref`.
- Распаковать безопасно.
- Отбросить верхнюю папку архива.
- Найти папки с `.toc`.
- Установить в `Interface/AddOns`.
- Использовать GitHub token при наличии.

### Чекпоинт 6. Запуск игры

- Проверить `Wow.exe`.
- Перед запуском применить выбранный аккаунт.
- Запустить процесс через main adapter.
- Добавить настройку закрытия лаунчера после запуска.

### Чекпоинт 7. MD5 обновление клиента

- Получить пример ответа API patches.
- Зафиксировать схему manifest.
- Реализовать stream MD5.
- Сравнить локальные файлы.
- Скачать отсутствующие/битые файлы.
- Проверить MD5 после скачивания.

### Чекпоинт 8. Packaging и release

- Проверить `npm run package`.
- Настроить имена Windows artifacts.
- Настроить GitHub Release publish.
- Настроить update metadata.
- Решить вопрос code signing.

## Известные риски

- `npm audit` показывает high vulnerabilities в цепочке `vite/electron-vite/esbuild`; automated fix требует breaking upgrades.
- В окружении был warning `NODE_TLS_REJECT_UNAUTHORIZED=0`; это небезопасно для сетевых операций.
- Текущий GitHub token storage использует `safeStorage`; надо проверить поведение на целевых Windows-машинах.
- Пароль аккаунта нельзя логировать или хранить в plain config.
- Схема API MD5 patches пока не зафиксирована примером ответа.
- `Config.wtf` строка `SET readTerminationWithoutNotice` требует подтверждения на реальном клиенте Sirus.

## Последний зеленый прогон

- `npm run check` - успешно, 11 test files, 30 tests.
- `npm run build` - успешно.
