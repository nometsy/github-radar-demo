# GitHub Radar — правила проекта

## Что это

Next.js 16 (App Router) приложение для поиска свежих и быстрорастущих репозиториев GitHub. Интерфейс на английском, документация — на русском. Данные только реальные: GitHub REST API + локальные snapshot-ы.

## Команды

```powershell
npm run dev        # http://localhost:3000
npm run build
npm run start
npm run lint
npm run typecheck
npm test
```

- Менеджер пакетов — npm (`package-lock.json`). Не создавать lock-файлы других менеджеров.
- Проверки запускать последовательно (4 ГБ RAM): typecheck → test → lint → build.
- `npm run build` не должен требовать PostgreSQL.

## Окружение

- `.env.local` не коммитить; шаблон — `.env.example`.
- `GITHUB_TOKEN` читается только на сервере (`src/lib/`, route handlers). Никогда не добавлять `NEXT_PUBLIC_` для токена.
- `RADAR_STORAGE=file` — режим по умолчанию, данные в `.data/radar.json`; `RADAR_DATA_DIR` переопределяет каталог (постоянный диск на Render/Railway).
- Render Blueprint — `render.yaml`: web service + диск `/var/data` + cron `scripts/collect.mjs`. Cron не имеет доступа к диску и вызывает защищённый HTTP-endpoint.
- `RADAR_STORAGE=postgres` требует `DATABASE_URL` и `prisma generate`; на Vercel файловый режим запрещён.
- В production запись снимков требует `CRON_SECRET`.

## Архитектурные правила

- Все обращения к GitHub — через `src/lib/github/client.ts` (кэш, retry, rate limit) и `service.ts`. Не вызывать `fetch` к api.github.com из компонентов.
- Рост звёзд считать только в `src/lib/radar/growth.ts` по сохранённым точкам. Запрещено оценивать рост по возрасту репозитория или звёздам/день и выдавать это за измерение.
- При недостатке истории возвращать `available: false` + причину; UI обязан показывать «insufficient data» / «no history».
- Новые API-контракты описывать в `src/lib/api-types.ts` и валидировать в `src/lib/validation.ts` (Zod).
- Клиентские компоненты, использующие хуки/браузер, помечать `"use client"`. Route segment config (`dynamic`, `runtime`) — только в серверных файлах.
- Стили: Tailwind-токены из `src/app/globals.css`, примитивы из `src/components/ui/`. Не хардкодить hex-цвета в компонентах, использовать CSS-переменные.
- Внешние URL перед вставкой в `href`/`src` проверять через `safeHttpUrl`.
- Watchlist/compare — только `localStorage`; не притворяться, что это серверная синхронизация.

## Проверка изменений

- UI: запустить dev-сервер и проверить страницу в браузере (десктоп + мобильная ширина, консоль, клавиатурная навигация).
- Backend/данные: curl/`Invoke-RestMethod` к соответствующему route, проверить пустое состояние и rate limit.
- Перед заявлением о готовности приложить фактические выводы проверок.

## Особенности Windows

- `shell` в OpenCode может зависать на PowerShell-профиле; при проблемах запускать команды как `cmd /c "…"` в фоне.
- `prisma generate` выполнять после `npm install`, если используется Prisma-режим.
- Не запускать одновременно dev-сервер и production-сборку.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
