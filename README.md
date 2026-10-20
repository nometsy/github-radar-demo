# GitHub Radar

Локальное веб-приложение для поиска молодых и быстро растущих open-source репозиториев на GitHub. Данные берутся из GitHub REST API, а рост звёзд считается **только по собственным снимкам (snapshot)** — приложение никогда не выдумывает проценты роста.

Интерфейс — тёмный «радар» с неоновой палитрой, полностью адаптивный; светлая тема переключается в шапке.

Визуальные сигналы: розовый бейдж **Hot** появляется только при положительном
измеренном росте и momentum ≥70/100. Популярность и возраст сами по себе не
включают подсветку. Заголовки плавно масштабируются под экран; карточки реагируют
на hover и выбор watchlist/compare. При `prefers-reduced-motion` движения отключены.

## Что внутри

- **Dashboard** — живая лента (New / Rising / Fresh / Hot), статистика GitHub, измеренные 24h-муверы, состояние хранилища снимков. В карточках виден возраст репозитория и спарклайн измеренной истории звёзд.
- **Fresh Repos** — репозитории, созданные за 6 / 12 часов, за 24 часа, 3 / 7 / 30 дней; фильтры по языку, звёздам, форкам, topic и сортировке.
- **Trending Radar** — пять документированных «полос»: Today, Week, Month, Hidden Gems, Rising AI. У каждой показана методология запроса.
- **AI Discovery** — восемь категорий: AI, LLM, агенты, vibe coding, devtools, автоматизация, cybersecurity, OSS-инструменты.
- **Repository Details** — метрики, языки, релизы, README (Markdown), история звёзд по снимкам, измеренный рост 24h/7d, коллекция снимка.
- **Watchlist** — локальное хранилище в браузере, избранное, коллекции, экспорт JSON, снимки для сохранённых репозиториев.
- **Compare** — до четырёх репозиториев рядом, живые метрики и измеренный рост.
- **Smart Search** — полнотекстовый поиск GitHub с фильтрами и пагинацией.
- **RSS** — `GET /api/radar/feed?lens=new&window=24` отдаёт ленту в RSS 2.0, чтобы следить за радаром из ридера.
- **Клавиатура (ПК)** — `/` фокусирует поиск, `g` + `d/f/t/a/s/w/c` переключает разделы.
- Состояния загрузки, пустых результатов и ошибок; обработка rate limit с честным stale-фолбэком.

## Мобильные и десктоп

- На ширине < 1024 px боковое меню заменяется нижней навигацией (Dashboard / Fresh / Trending / Search / Watchlist) — раздел переключается одним тапом.
- Учтены вырезы и «домашние» полоски экранов (`safe-area-inset`), отключён серый тап-флеш, добавлен `text-size-adjust: 100%`.
- Иконочные кнопки в карточках и пагинация увеличены до 36 px: попадать пальцем удобнее.
- Плитки статистики и фильтры перестраиваются в 2 колонки, окна Fresh листаются горизонтально без переноса строки.
- Таблица Compare прокручивается по горизонтали с закреплённой первой колонкой.

## Стек

Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4, Radix/shadcn-примитивы, TanStack Query 5, Recharts 3, Motion, Lucide, Sonner, Zod 4. Хранение снимков: файл по умолчанию, PostgreSQL + Prisma 6 — опционально.

## Требования

- Windows 10/11 (инструкции ниже для PowerShell), macOS или Linux.
- Node.js 20.9+ (проверено на Node 22+). npm входит в комплект.
- Опционально: PostgreSQL 14+ для режима `RADAR_STORAGE=postgres`.

## Быстрый старт (Windows)

```powershell
cd "C:\path\to\Github Radar"
npm install
Copy-Item .env.example .env.local   # необязательно, но рекомендуется
npm run dev
```

Откройте <http://localhost:3000>. PostgreSQL для первого запуска **не нужен**: снимки по умолчанию пишутся в `.data/radar.json`.

Если `npm install` зависает на проверке обновлений, выполните его без notifier:

```powershell
$env:NO_UPDATE_NOTIFIER="1"; $env:npm_config_update_notifier="false"
npm install --no-audit --no-fund
```

## Переменные окружения

Скопируйте `.env.example` в `.env.local`. Файл `.env.local` исключён из git.

| Переменная | Обязательна | Назначение |
| --- | --- | --- |
| `GITHUB_TOKEN` | нет, но настоятельно рекомендуется | Classic PAT **без scope** даёт 5000 core-запросов/час вместо 60. Хранится только на сервере. |
| `RADAR_STORAGE` | нет | `file` (по умолчанию) или `postgres`. На Vercel `file` не поддерживается. |
| `DATABASE_URL` | только для `postgres` | Строка подключения PostgreSQL. |
| `RADAR_DATA_DIR` | нет | Каталог для `radar.json` и `github-cache.json`. Для постоянного диска Render/Railway, например `/var/data`. |
| `CRON_SECRET` | только для production-снимков | Защищает `POST /api/radar/collect` и `POST /api/radar/snapshots`. |

Токен **никогда** не передаётся в браузер: все запросы к GitHub идут через серверные Route Handlers.

Если GitHub CLI уже авторизован (`gh auth status`), токен можно положить в `.env.local` одной командой — значение команды не попадает в вывод:

```powershell
$token = cmd /c "gh auth token"
"GITHUB_TOKEN=$token" | Out-File -FilePath .env.local -Encoding utf8
Remove-Variable token
```

Для публичных read-only данных подходит classic PAT **без scope**: 5000 core-запросов/час и 30 поисков/мин вместо 60/час и 10/мин у анонимного доступа.

## Деплой

- **Render + постоянный диск (основной):** `render.yaml` создаёт web service, диск в `/var/data` и cron каждые 45 минут. Файловый режим, PostgreSQL не нужен; история снимков переживает рестарты и деплои. Нужен платный план Render — ориентировочно $8.25/мес.
- **Render free demo:** web service без диска и без Render cron; сбор запускает GitHub Actions. История снимков на free-плане не сохраняется при рестарте/засыпании — это только демо.
- **Vercel + PostgreSQL (Neon):** публичное демо без своего сервера. На Vercel файловый режим запрещён: каталог проекта доступен только для чтения. Приложение явно пометит хранилище снимков как недоступное вместо тихой потери истории; нужен `RADAR_STORAGE=postgres`.
- **Свой ПК:** `npm run build` + `npm start`, HTTPS через Cloudflare Tunnel и Планировщик Windows. Работает, только пока компьютер включён.

Пошаговая инструкция для Render, Vercel, миграции, cron и чек-лист — в [docs/DEPLOY.md](docs/DEPLOY.md).

## Как считаются данные

### Почему в ленте «старые» репозитории

GitHub Search **не умеет сортировать по дате создания** — доступны только `stars`, `forks`, `updated`. Поэтому ленты упорядочены по числу звёзд, а окно задаётся фильтром `created:>=<timestamp>`:

- «New» (дашборд) — создано ≤24 ч назад, ≥5 звёзд;
- «Rising» — создано ≤14 дней назад, ≥25 звёзд;
- «Fresh Repos» — окно 6/12/24 ч, 3/7/30 дней.

Следствие: репозиторий, созданный час назад и набравший 10 звёзд, окажется **ниже** в ленте, чем созданный две недели назад с 15 000 звёзд. Это не ошибка данных, а ограничение GitHub API. Чтобы увидеть действительно свежие проекты, выберите короткое окно (6H/12H) — там сортировка по звёздам почти не искажает картину.

Счётчик «New · 24H» на дашборде — это число **всех** репозиториев, созданных с 00:00 UTC сегодняшнего дня (около 280 000), без фильтра по звёздам. Он кликабелен и ведёт в ленту свежего.

### Рост звёзд

1. Живые значения (звёзды, форки, даты, язык, README, релизы) приходят из GitHub REST API и кэшируются на сервере на короткое время. Успешные ответы сохраняются в `.data/github-cache.json` (до 200 записей и ~8 MB), поэтому кэш переживает перезапуск процесса. Относительные окна поиска (`created:>=`) выравниваются по 5-минутным корзинам: одинаковый запрос в пределах корзины берётся из кэша, а окно расширяется менее чем на 5 минут. Это публичные данные GitHub, токен в файл не попадает.
2. При rate limit или сетевой ошибке API отдаёт последний успешный кэш и помечает ответ `stale: true`; интерфейс явно показывает это.
3. Рост звёзд рассчитывается только по парам снимков, которые приложение само сохранило:
   - окно 24h принимает baseline возрастом 18–30 часов;
   - окно 7d — baseline возрастом 5.25–8.75 дней;
   - если подходящей пары нет, возвращается `available: false` с причиной, а UI пишет **insufficient data** / **no history**.
4. Спарклайн в карточке строится по последним 10 дням сохранённых снимков и только по реальным точкам. Если точек меньше двух, линия не рисуется: один снимок — не тренд.
5. «Momentum» — эвристический счёт 0–100, посчитанный **только** по измеренному приросту (абсолютный прирост, относительный прирост, согласованность с недельным окном и свежесть снимка). Это не метрика GitHub; при отсутствии измеренного прироста счёт не показывается.
6. Один снимок на репозиторий принимается не чаще, чем раз в 30 минут (`SNAPSHOT_MIN_INTERVAL_MINUTES`), остальные записи пропускаются.

Поэтому сразу после установки счётчики роста будут пустыми — это корректное поведение, а не баг.

### Проверка измеренного роста без ожидания суток

Чтобы увидеть работающий расчёт 24h на локальной машине, есть тестовая фикстура: она дописывает в файловое хранилище baseline-снимок ровно за 24 часа до последней точки.

```powershell
node scripts/seed-snapshot.mjs deepseek-ai/deepseek-harness
npm run dev
```

После этого на странице репозитория появляются измеренные `+N` звёзд, процент и график истории. Фикстура пишет только в локальный `.data/radar.json` и ничего не меняет в коде расчёта.

## Снимки и cron

### Вручную

В dev-режиме кнопка **Collect now** на Dashboard и **Collect snapshot** на странице репозитория работают без секрета.

Из терминала:

```powershell
# Собрать снимки для лент (rising, AI, fresh)
Invoke-RestMethod -Method Post http://localhost:3000/api/radar/collect

# Собрать снимки для конкретных репозиториев (до 8)
Invoke-RestMethod -Method Post http://localhost:3000/api/radar/snapshots `
  -ContentType "application/json" `
  -Body '{"repos":["vercel/next.js","ggerganov/llama.cpp"]}'
```

### В production

`npm run build` + `npm start` включают `NODE_ENV=production`. Без `CRON_SECRET` endpoint снимков заблокирован (код `COLLECTOR_LOCKED`). Секрет передаётся одним из способов:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Post -Headers $headers http://localhost:3000/api/radar/collect
```

Также поддерживается `x-radar-secret` и `?secret=`. Кнопки в UI в production не знают секрет — используйте планировщик.

На Render cron job `github-radar-collect` вызывает endpoint каждые 45 минут; на free-плане Render используется `.github/workflows/collect.yml` (нужны secrets `RADAR_BASE_URL` и `CRON_SECRET`). На Vercel `vercel.json` запускает сбор раз в сутки (ограничение Hobby). Для снимков каждые 30–60 минут на Vercel подключите GitHub Actions или внешний cron — оба просто вызывают тот же защищённый endpoint. Подробнее: [docs/DEPLOY.md](docs/DEPLOY.md).

### Планировщик Windows

Создайте задачу, запускающую каждые 30–60 минут:

```powershell
schtasks /Create /SC MINUTE /MO 45 /TN "GitHub Radar snapshots" /TR "powershell -NoProfile -Command \"Invoke-RestMethod -Method Post -Headers @{Authorization='Bearer <secret>'} http://localhost:3000/api/radar/collect\""
```

На сервере с постоянным процессом подойдёт Vercel Cron, GitHub Actions или системный cron — главное, чтобы запрос шёл с секретом.

## Опциональный PostgreSQL

```powershell
# .env.local
# RADAR_STORAGE=postgres
# DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/github_radar?schema=public"

npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Схема: `prisma/schema.prisma`. Для файлового режима Prisma-клиент не требуется, но `@prisma/client` установлен как зависимость.

## API

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/github/dashboard?lens=new\|rising\|fresh\|active&refresh=1` | лента + статистика |
| GET | `/api/github/fresh?window=6\|12\|24\|72\|168\|720&language=&minStars=&minForks=&topic=&sort=stars\|updated&page=&perPage=` | свежие репозитории (окно в часах) |
| GET | `/api/github/trending?lane=today\|week\|month\|gems\|ai` | trending-полосы |
| GET | `/api/github/ai?category=<id>&q=&sort=&page=` | AI-категории |
| GET | `/api/github/search?q=&language=&minStars=&topic=&createdDays=&sort=best\|stars\|updated` | поиск |
| GET | `/api/github/repos/:owner/:name` | детали + README + история |
| GET | `/api/github/repos/batch?names=a/b,c/d` | до 8 репозиториев c growth |
| GET | `/api/radar/leaderboard?window=24h\|7d&limit=` | измеренные муверы |
| GET | `/api/radar/feed?lens=new\|rising\|fresh\|active&window=6\|12\|24\|...` | RSS 2.0 лента |
| POST | `/api/radar/collect` | снимки для лент |
| POST | `/api/radar/snapshots` | снимки для списка репозиториев |
| GET | `/api/system` | rate limit + состояние хранилища |

Ответы с ошибкой имеют формат `{ "error": { "code", "message", "status", "retryAt?", "rateLimit?" } }`.

## Скрипты

```powershell
npm run dev        # разработка (Turbopack)
npm run build      # генерация Prisma Client + production-сборка Next.js
npm run start      # запуск собранного приложения
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # unit-тесты (tsx --test)
npm run prisma:generate / prisma:migrate / prisma:studio
```

## Структура проекта

```
src/app/            страницы App Router и API-роуты
src/components/ui/  shadcn-подобные примитивы
src/components/     каркас, радарные карточки и панели
src/lib/github/     клиент GitHub, схемы, запросы, сервисный слой
src/lib/radar/      снимки, growth-математика, файловое и Prisma-хранилища
src/providers/      тема, TanStack Query, watchlist, compare
src/lib/local-storage.ts  внешний стор над localStorage (useSyncExternalStore)
tests/              unit-тесты построителей запросов, growth-расчётов и localStorage
scripts/            фикстура роста и cron-клиент для Render
render.yaml         Render Blueprint: web service, диск, cron
.github/workflows/  CI и сбор снимков по расписанию
prisma/             схема и миграции PostgreSQL
.data/              файловое хранилище снимков (в git не попадает)
```

## Ограничения и честность данных

- Анонимный GitHub API: ~60 core-запросов/час и 10 поисков/минуту. С `GITHUB_TOKEN` — 5000/час и 30 поисков/минуту.
- GitHub Search API отдаёт максимум 1000 результатов на запрос; пагинация ограничена 50 страницами по 20.
- README может быть обрезан GitHub (`truncated`), и это отображается.
- Watchlist и compare хранятся в `localStorage` браузера, не синхронизируются между устройствами и не являются аутентификацией.
- Файловое хранилище рассчитано на один процесс и не работает на Vercel. На Render оно требует постоянного диска (`RADAR_DATA_DIR=/var/data`); без диска история теряется при рестарте. Для нескольких инстансов или serverless используйте PostgreSQL.
- Приложение не строит прогнозов, не «дорисовывает» историю и не оценивает рост звёзд по возрасту репозитория. Hidden Gems использует оценку звёзд/день только для сортировки и явно подписывает её как оценку, а не исторический рост.
- Нет встроенной авторизации: это локальный инструмент, а не многопользовательский сервис.

## Проверки

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

Если какая-то проверка недоступна в вашем окружении, вывод команды покажет причину — не считайте отсутствие ошибки доказательством без запуска.

## Лицензия

Учебный/портфолио-проект. Данные принадлежат GitHub и авторам репозиториев; соблюдайте [условия GitHub API](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).
