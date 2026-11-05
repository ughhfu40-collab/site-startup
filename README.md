# StudyHour

Полноценное приложение предзаказов ИИ-инструментов для учеников НИШ: React + TypeScript + Vinext, серверные API и Cloudflare D1 (SQLite).

## Что работает
- Каталог ChatGPT, Claude, Gemini, Turnitin, Study Pack; поиск, категории и сортировка.
- Вход через ChatGPT на размещённом Sites-приложении.
- Сохранение и чтение заявок из D1, отмена, история и личный кабинет.
- Серверная проверка времени и цены, проверка Origin, изоляция заявок по идентификатору пользователя.
- Адаптивный интерфейс и доступные с клавиатуры формы.

700 ₸/час для ChatGPT, Claude и Gemini. 1 400 ₸/2 часа, 2 100 ₸/3 часа. Turnitin — 700 ₸/проверка. Study Pack — 1 400 ₸/2 часа.

## Важные границы текущей версии
Это сервис **предзаказов**, не запущенная продажа доступа. Платежи, ответы ИИ и отчёты Turnitin не имитируются. Чтобы принимать платежи и предоставлять доступ, нужны выбранный платёжный провайдер и его merchant-реквизиты, разрешённые интеграции ИИ, правила лимитов и подтверждённый доступ Turnitin. Личные пароли не собираются. Подписки Plus/Pro — названия позиций каталога, а не утверждение о доступности интеграции.

## Локальный запуск
Node.js >= 22.13.0.

```bash
npm install
npm run dev
```

Для управляемой среды Sites используются её scripts/project-setup.mjs, install-dependencies.mjs и build-site.mjs. Для обычного окружения доступны npm run dev / npm run build.

```bash
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_violet_black_tarantula.sql
npx tsc --noEmit
```

Миграции выполняйте один раз на каждой базе. В размещённом Sites они применяются при публикации. Локальный dev не эмулирует вход: защищённые API без identity-заголовков вернут 401. Заголовки oai-authenticated-user-* доверяются только за шлюзом Sites. При переносе на другой хостинг необходим собственный защищённый auth gateway; не открывайте Worker напрямую с доверием клиентским заголовкам.

## API
- GET /api/bookings — заявки текущего пользователя.
- POST /api/bookings — service, hours (1..3), startsAt (ISO UTC). Цена вычисляется на сервере.
- DELETE /api/bookings — id; отменяет только собственную ожидающую заявку.

## Проверки
- `npx tsc --noEmit` — проверка типов.
- `npm run build` — production-сборка.
- `python scripts/test-api.py` — интеграционная проверка локального сервера на localhost:4173 с тестовыми identity-заголовками; не запускать на production. Для запуска нужны доступный из терминала dev-сервер и локальная миграция.
- В текущей среде проверены браузерные фильтры, поиск и расчёт 2 часов. Интеграционный тест требует локального сервера, доступного из той же сетевой среды, что и Python.

## Структура
app/dashboard.tsx — интерфейс; app/api/bookings/route.ts — API; lib/catalog.ts — цены; db/schema.ts — схема базы; drizzle/ — миграции; .openai/hosting.json — привязки Sites.

Секреты и данные пользователей в репозиторий не включены. Независимый проект, не официальный сервис НИШ или провайдеров.
