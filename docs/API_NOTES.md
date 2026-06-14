# Заметки по внешним API и файлам

## MD5 API клиента

Источники:

- `https://s-patches.pro/api/client/patches`
- `https://s-patches.ru/api/client/patches`
- `https://sirus.world/api/client/patches`

Перед реализацией нужно сохранить пример ответа API в `docs/samples/patches-response.json` или в тестовый fixture. После этого зафиксировать:

- поля файла;
- формат пути;
- где находится URL скачивания;
- есть ли размер файла;
- есть ли версия/дата манифеста;
- как API сообщает удаленные или устаревшие файлы.

Ожидаемый контракт внутри приложения:

```ts
export interface ClientPatchFile {
  path: string
  md5: string
  size?: number
  url?: string
}

export interface ClientPatchManifest {
  sourceUrl: string
  receivedAt: string
  files: ClientPatchFile[]
}
```

## FPS-патч

Файл:

- `patch-ruRU-[.mpq`

Источники:

- `https://d1st4r.ru/patch/patch-ruRU-[.mpq`
- `http://d1st4r.stream/patch/patch-ruRU-[.mpq`

Целевой путь:

- `<wowPath>/Data/ruRU/patch-ruRU-[.mpq`

Внутренний контракт:

```ts
export interface FpsPatchSource {
  url: string
  priority: number
  secure: boolean
}

export interface FpsPatchStatus {
  installed: boolean
  targetPath: string
  size?: number
  modifiedAt?: string
}
```

## GitHub аддоны

В MVP каталог аддонов можно хранить в `addons.catalog.json`. Аддоны скачиваются как zip архива кода GitHub-репозитория, а не из releases/assets.

```ts
export interface AddonCatalogItem {
  id: string
  name: string
  repo: string
  ref: string
  installDir?: string
  source: 'source-zip'
  zipUrl?: string
}
```

Правила:

- без токена использовать публичный GitHub endpoint и учитывать rate limit;
- опциональный GitHub token хранить через защищенное хранилище ОС;
- при наличии токена добавлять `Authorization: Bearer <token>` к GitHub-запросам;
- не писать токен в config, логи, ошибки, changelog или telemetry;
- считывать заголовки `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, если они есть;
- при 401/403 различать неверный токен, недостаточные права и превышение лимита, насколько это позволяет ответ GitHub;
- основной URL для ветки: `https://github.com/{owner}/{repo}/archive/refs/heads/{ref}.zip`;
- для tag/commit позже можно добавить отдельный resolver;
- скачивать zip во временный файл;
- распаковывать во временную директорию;
- не ставить верхнюю папку GitHub-архива в `Interface/AddOns`;
- искать реальные папки аддонов по наличию `.toc`;
- переносить найденные папки в `<wowPath>/Interface/AddOns`;
- если `installDir` задан, использовать его как итоговое имя папки;
- перед заменой существующей папки использовать временный backup или atomic replace;
- обработать zip slip;
- позволить ручную установку zip, если GitHub недоступен.
