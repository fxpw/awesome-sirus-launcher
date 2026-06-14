# Changelog

Все заметные изменения проекта фиксируются в этом файле.

Формат основан на Keep a Changelog, версии ведутся по SemVer.

## [Unreleased]

### Added

- Добавлен стартовый план разработки лаунчера.
- Добавлены правила разработки для backend/frontend и project skills в `.agents`.
- Добавлен будущий модуль автообновления WeakAuras в план.
- Зафиксировано правило установки GitHub-аддонов через zip архива кода репозитория.
- Добавлен файл `VERSION` для релизного версионирования.
- Добавлен GitHub Actions workflow для будущего autobuild.
- Добавлен changelog skill для обязательного обновления `CHANGELOG.md` агентами.
- Добавлен commit skill для описания коммитов агентами.
- Добавлен план модуля мультиаккаунтов с локальными профилями и подстановкой аккаунта в `WTF/Config.wtf`.
- План проекта возвращен на Electron + Vue 3 + TypeScript backend.
- Добавлено требование к тестируемому portable core, чтобы будущий переход на другой desktop shell был быстрым.
- Добавлен план механики автообновления лаунчера через проверку версии в GitHub Releases и скачивание релизного артефакта.
- Добавлен план настройки GitHub token для скачивания аддонов с повышенными лимитами.
- Добавлен стартовый Electron/Vue/TypeScript каркас приложения.
- Добавлены portable `core`-модули для `Config.wtf`, GitHub token/rate-limit, source zip URL и проверки версии лаунчера.
- Добавлены unit tests и portability test для запрета Electron imports в `core`.
- Добавлено зашифрованное хранение GitHub token через Electron `safeStorage`.
- GitHub Actions теперь собирает Electron output и на push может упаковать release artifacts через electron-builder.
- Добавлен документ чекпоинтов с текущим состоянием реализации и списком следующих задач.
- Расширены npm scripts и README-команды для dev, typecheck, tests, build и packaging.
- Добавлены persistent settings, выбор папки WoW через Electron dialog и UI для сохранения/удаления GitHub token.
- Frontend разнесен по архитектуре `page -> block -> element -> component`.
- Добавлены локализация `ru/en` и переключение светлой/темной темы.
- IPC handlers переведены на schema-first Zod validation для входов и выходов.
- Добавлен модуль создания backup `WTF`: core-план, zip adapter, IPC list/create, UI-блок и интеграционный тест.
- Добавлено восстановление, удаление и открытие папки backup `WTF` с safety-бекапом перед restore и защитой zip-распаковки от выхода за целевую папку.

## [0.0.0] - 2026-06-13

### Added

- Инициализирован репозиторий проекта.
