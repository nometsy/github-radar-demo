# Деплой GitHub Radar

Приложение можно развернуть тремя способами:

- **Render + постоянный диск** — основной вариант: файловое хранилище,
  PostgreSQL не нужен, история снимков переживает рестарты и деплои.
- **Vercel + Neon PostgreSQL** — публичное демо без своего сервера, но с
  внешней базой и ограничениями Hobby-плана.
- **Свой ПК** — бесплатно, пока компьютер включён.

На Vercel файловый режим работать не может: каталог проекта доступен только
для чтения, а `/tmp` живёт до перезапуска инстанса. В `src/lib/radar/store.ts`
есть явная проверка: при `VERCEL=1` и `RADAR_STORAGE=file` приложение помечает
хранилище снимков как недоступное, а не теряет историю молча.

## Вариант A — Render + постоянный диск (основной)

`render.yaml` в корне репозитория описывает три ресурса:

- web service `github-radar` на Node 22, план `0.5c-512mb`, регион Frankfurt;
- постоянный диск 1 GB, смонтированный в `/var/data`;
- cron job `github-radar-collect`, который каждые 45 минут вызывает
  `POST /api/radar/collect` у web service.

Web service работает в файловом режиме:

```text
RADAR_STORAGE=file
RADAR_DATA_DIR=/var/data
GITHUB_TOKEN=<ваш classic PAT без scope>
CRON_SECRET=<Render генерирует автоматически>
```

Cron job не достучится до диска напрямую — Render не даёт cron-джобам диски.
Поэтому он не читает `radar.json`, а вызывает защищённый HTTP-endpoint.
`RADAR_BASE_URL` и `CRON_SECRET` cron получает из web service через
`fromService`; в `RADAR_BASE_URL` подставляется `RENDER_EXTERNAL_URL`.

### Стоимость

Ориентир по тарифам Render:

| Ресурс | Цена |
| --- | --- |
| Web service `0.5c-512mb` | около $7/мес |
| Диск 1 GB | около $0.25/мес |
| Cron job (минимальный план) | от $1/мес |
| **Итого** | **около $8.25/мес** |

Цены меняются; проверьте актуальные на <https://render.com/pricing>.
Для диска и cron нужен платный аккаунт с привязанным способом оплаты.
Бесплатный web service Render не поддерживает постоянные диски, поэтому
файловая история на нём не сохранится.

### 1. Подготовьте репозиторий

Изменения должны быть в ветке, которую собирает Render (обычно `main`).
`render.yaml` и `scripts/collect.mjs` обязаны попасть в репозиторий: Render
читает Blueprint из Git, а cron запускает скрипт из этого же репозитория.

### 2. Создайте Blueprint

1. Откройте <https://dashboard.render.com>.
2. Нажмите **New → Blueprint**.
3. Подключите GitHub-репозиторий `nometsy/github-radar`.
4. Render прочитает `render.yaml` и покажет создаваемые resources.
5. Заполните `GITHUB_TOKEN`. `CRON_SECRET` Render сгенерирует сам.
6. Подтвердите создание и дождитесь первого деплоя.

Если Render попросит `RADAR_BASE_URL` для cron, впишите публичный адрес
web service: `https://<service>.onrender.com`. Обычно поле заполняется
автоматически из `RENDER_EXTERNAL_URL`.

### 3. Проверьте приложение

Откройте публичный URL и `/api/system`:

```powershell
$base = "https://<service>.onrender.com"
Invoke-RestMethod "$base/api/system" | ConvertTo-Json -Depth 8
```

Ожидаемые значения:

- `storage.driver` — `file`;
- `storage.writable` — `true`;
- `storage.trackedRepos` и `storage.snapshotCount` — сначала `0`;
- `tokenConfigured` — `true`, если `GITHUB_TOKEN` задан.

### 4. Сделайте первый снимок

В Dashboard откройте cron job `github-radar-collect` и нажмите **Trigger run**.
Либо вызовите endpoint вручную (секрет виден в Environment web service):

```powershell
$base = "https://<service>.onrender.com"
$secret = "<CRON_SECRET из Render>"
$headers = @{ Authorization = "Bearer $secret" }

$result = Invoke-RestMethod -Method Post -Headers $headers "$base/api/radar/collect"
$result | ConvertTo-Json -Depth 8
```

Первый вызов создаст снимки для лент (`captured` > 0, `tracked` > 0).
Повторный вызов в течение 30 минут вернёт `captured: 0` и `skipped` — это
нормально, интервал между снимками одного репозитория ограничен.

После этого `/api/system` должен показать `snapshotCount` больше нуля.
Рост 24h появится только после второго снимка с подходящим baseline
(18–30 часов): приложение не оценивает рост по возрасту репозитория.

### 5. Cron

Расписание в `render.yaml`:

```text
*/45 * * * *
```

Render использует UTC. Снимки будут появляться примерно в 00:00, 00:45,
01:30 и так далее. Встроенный лимит приложения — не чаще одного снимка
репозитория за 30 минут, поэтому 45-минутный интервал подходит.

Проверьте, что запуск действительно доставляет запрос:

- в Dashboard у cron job есть история запусков и логи;
- успешный запуск печатает строку вида
  `Collected 80 snapshot(s), skipped 0; ...`;
- при 401 проверьте, что `CRON_SECRET` у cron совпадает с секретом web service.

### 6. Перезапуски и обновления

Диск переживает деплой и рестарт. Чтобы убедиться в этом, запомните
`snapshotCount`, запустите **Manual Deploy → Deploy latest commit**, дождитесь
старта и снова откройте `/api/system` — счётчик не должен обнулиться.

Обновления: пуш в `main` запускает новый деплой. Диск остаётся на месте.
У сервиса с диском нет zero-downtime deploys: на время деплоя возможен
короткий простой. Не запускайте больше одного инстанса — файловое хранилище
рассчитано на один процесс.

### 7. Бэкапы и ограничения

- Render делает снапшоты диска; проверьте срок хранения в Dashboard.
- 1 GB достаточно для JSON-файлов приложения при текущих лимитах
  (120 дней истории, до 5000 репозиториев), но следите за размером.
- Удаление диска или сервиса удаляет историю. Не пересоздавайте диск без
  необходимости.
- Cron job не имеет доступа к диску; он работает только через HTTP.
- `RADAR_DATA_DIR` должен указывать на точку монтирования, иначе данные
  окажутся на эфемерной файловой системе и исчезнут при деплое.

### Бесплатное демо на Render (без диска)

Если карта не привязана, можно проверить приложение на free web service.
Это **только демо**: история снимков не сохраняется.

1. Создайте Web Service вручную из репозитория:
   - Runtime — Node, Node 22, план `Free`;
   - Build Command — `npm ci && npm run build`;
   - Start Command — `npm start`.
2. Переменные: `RADAR_STORAGE=file`, `GITHUB_TOKEN`, `CRON_SECRET`.
   `RADAR_DATA_DIR` не задавайте: файлы попадут в `.data` на эфемерном диске.
3. Cron job Render — платный. В репозитории уже есть
   `.github/workflows/collect.yml`; добавьте в GitHub Secrets:
   - `RADAR_BASE_URL` — публичный URL сервиса;
   - `CRON_SECRET` — тот же секрет, что у web service.
4. Запустите workflow вручную через **Actions → Collect snapshots → Run workflow**
   и убедитесь, что запрос доходит.

Ограничения бесплатного варианта:

- free web service засыпает после 15 минут без запросов; первый запуск
  после пробуждения может занять десятки секунд;
- `.data` живёт до рестарта, деплоя или засыпания — `snapshotCount` обнулится;
- GitHub Actions может задержать запуск, а после 60 дней без активности
  репозитория расписание может отключиться.

Чтобы перейти на постоянную историю, привяжите карту, переведите сервис на
платный план, подключите диск в `/var/data`, задайте `RADAR_DATA_DIR=/var/data`
и сделайте редеплой. Снимки, сделанные на бесплатном сервисе, не переносятся:
история начнётся заново уже на диске.

## Вариант B — Vercel + Neon PostgreSQL

Подходит для бесплатного публичного демо. История хранится в PostgreSQL,
файловый режим на Vercel запрещён.

### 1. База данных

Создайте проект в [Neon](https://neon.tech) и базу `github_radar`. Нужны две
строки подключения:

- **pooled** — для `DATABASE_URL` в production (хост содержит `-pooler`);
- **direct** — только для применения миграций.

### 2. Миграция

Выполните один раз со своей машины, подставив direct-строку:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/github_radar?sslmode=require&connect_timeout=15"
npm run prisma:deploy
Remove-Item Env:DATABASE_URL
```

Миграция создаёт таблицы `tracked_repositories` и `repository_snapshots`.
Команда `npm run build` сама генерирует Prisma Client, отдельный шаг не нужен.

### 3. Проект в Vercel

Импортируйте репозиторий в Vercel. Framework Preset — Next.js, Build Command —
`npm run build`, Output — по умолчанию. Node.js 20.9+ (лучше 22).

Переменные окружения для Production (и Preview, если нужен полноценный preview):

| Переменная | Значение |
| --- | --- |
| `GITHUB_TOKEN` | classic PAT без scope |
| `RADAR_STORAGE` | `postgres` |
| `DATABASE_URL` | pooled-строка Neon с `?sslmode=require&connect_timeout=15` |
| `CRON_SECRET` | случайная строка, например `openssl rand -hex 32` |

`GITHUB_TOKEN` и `CRON_SECRET` не должны начинаться с `NEXT_PUBLIC_`.
После деплоя откройте `/api/system` — там должно быть
`"driver": "postgres"` и `"writable": true`.

### 4. Первый снимок

```powershell
$base = "https://<project>.vercel.app"
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }

Invoke-RestMethod -Method Post -Headers $headers "$base/api/radar/collect"
Invoke-RestMethod "$base/api/system"
```

Первый вызов создаст снимки. Рост 24h появится только после второго снимка
примерно через сутки: приложение не оценивает рост по возрасту репозитория.

### 5. Cron

`vercel.json` уже содержит ежедневный запуск около 00:00 UTC:

```json
{ "crons": [{ "path": "/api/radar/collect", "schedule": "0 0 * * *" }] }
```

Vercel сам добавляет `Authorization: Bearer <CRON_SECRET>`, если переменная
задана. На Hobby расписание может быть не чаще одного раза в сутки. Для
снимков каждые 30–60 минут используйте GitHub Actions или внешний cron
(например, cron-job.org) — оба варианта просто вызывают защищённый endpoint.

Пример GitHub Actions (секреты `CRON_SECRET` и `RADAR_BASE_URL` в настройках
репозитория):

```yaml
name: Collect snapshots
on:
  schedule:
    - cron: "*/45 * * * *"
  workflow_dispatch:
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger collection
        run: |
          curl --fail --silent --show-error \
            -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.RADAR_BASE_URL }}/api/radar/collect"
```

GitHub может задержать запуск — это нормально. Встроенный интервал снимков
всё равно не чаще одного раза в 30 минут.

### 6. Обновления схемы

После изменения `prisma/schema.prisma`:

```powershell
npm run prisma:migrate -- --name change_name   # локально, с dev-базой
```

Команда создаёт новую миграцию в `prisma/migrations/`.

Затем примените миграции к production через direct-строку:

```powershell
$env:DATABASE_URL = "<direct-url>"
npm run prisma:deploy
```

## Вариант C — свой ПК, бесплатно

Подходит, только если компьютер включён постоянно:

1. `npm run build`, затем `npm start` (не `npm run dev`).
2. Откройте наружу через Cloudflare Tunnel или другой обратный прокси с HTTPS.
3. Планировщик Windows запускает `POST /api/radar/collect` каждые 45 минут
   с `CRON_SECRET`.
4. Файлы `radar.json` и `github-cache.json` остаются в `RADAR_DATA_DIR`
   (по умолчанию `.data`).

Минусы: нет SLA, ПК и интернет должны быть доступны, обновления и бэкапы — вручную.

## Чек-лист перед публикацией

### Render

- [ ] Blueprint создан из `render.yaml`, деплой завершился успешно.
- [ ] Web service работает на платном плане, диск смонтирован в `/var/data`.
- [ ] `RADAR_STORAGE=file`, `RADAR_DATA_DIR=/var/data`.
- [ ] `/api/system` показывает `driver: file`, `writable: true`, растущий `snapshotCount`.
- [ ] Cron job существует, его расписание — `*/45 * * * *`.
- [ ] Ручной запуск cron доставляет запрос, в логах нет 401.
- [ ] `CRON_SECRET` задан в web service и cron; вызов без секрета возвращает 401.
- [ ] После Manual Deploy счётчик снимков не обнуляется.
- [ ] Запущен ровно один инстанс web service.

### Vercel

- [ ] `RADAR_STORAGE=postgres`; миграция применена.
- [ ] `/api/system` показывает `driver: postgres`, `writable: true`, растущий `snapshotCount`.
- [ ] `CRON_SECRET` задан в production; вызов без секрета возвращает 401.
- [ ] Cron или GitHub Actions реально доставляет запрос (проверьте логи).

### Общее

- [ ] `GITHUB_TOKEN` есть только в серверных env, без `NEXT_PUBLIC_`.
- [ ] Токен имеет минимальные права (classic PAT без scope).
- [ ] Понимаете, что у приложения нет авторизации: публичные read-only endpoints
      расходуют квоту GitHub. Следите за `/api/system` и логами 429.

## Типовые ошибки

| Симптом | Причина и решение |
| --- | --- |
| Render: `need_payment_info` при создании Blueprint | У аккаунта нет способа оплаты. Добавьте карту; бесплатный web service не поддерживает диск. |
| Render: Blueprint не создаёт cron | Проверьте, что `render.yaml` лежит в корне ветки и что cron-план доступен в workspace. |
| `COLLECTOR_LOCKED` | В production не задан `CRON_SECRET`. Добавьте переменную и перезапустите. |
| Cron завершается с 401 | `CRON_SECRET` у cron не совпадает с web service. Проверьте env и `fromService`; при ручной настройке задайте одинаковое значение. |
| `RADAR_BASE_URL is not set` | В cron не подставился `RENDER_EXTERNAL_URL`. Укажите `https://<service>.onrender.com` вручную. |
| После деплоя пустая история на Render | Не задан `RADAR_DATA_DIR=/var/data`, диск не смонтирован или сервис на бесплатном плане. Проверьте `/api/system` и диск в Dashboard. |
| `EACCES` / `writable: false` на Render | Приложение не может писать в точку монтирования. Используйте `/var/data` и проверьте, что диск подключён к этому сервису. |
| В логах `RADAR_STORAGE=file cannot persist snapshots on Vercel` | На Vercel нужен `RADAR_STORAGE=postgres` и `DATABASE_URL`. |
| Prisma: таблица не найдена | Миграция не применена. Выполните `npm run prisma:deploy` с direct-строкой. |
| Prisma: `prepared statement already exists` | Pooler в transaction mode несовместим с подготовленными запросами. Возьмите pooled-строку провайдера; для старого PgBouncer или Supabase добавьте `?pgbouncer=true&connection_limit=1`. |
| `insufficient data` / `no history` | Снимков меньше двух или нет пары нужного возраста. Это корректное состояние, а не ошибка. |
| Короткий простой при деплое Render | У сервиса с постоянным диском нет zero-downtime deploys. Это ожидаемо; данные на диске сохраняются. |
