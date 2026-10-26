# AnonPulse — постоянные инструкции для Codex

## Продукт
AnonPulse — веб-платформа анонимной обратной связи в образовании. Преподаватель создаёт и публикует опросы, студенты голосуют без аккаунта, преподаватель анализирует агрегированные результаты и публикует решение. Главная ценность — прозрачный цикл «мнение → результаты → действие».

## Источники требований
- Продуктовое ТЗ и актуальное frontend Sprint 1 ТЗ определяют пользовательские сценарии и критерии приёмки.
- При интеграции сверяй контракт с актуальными backend-контроллерами и их документацией. Старые OpenAPI JSON могут не содержать публичное голосование, результаты и решения.
- Не придумывай API, права ролей, серверные возможности или несуществующие данные.

## Разработка и дизайн
- Для задач UI/UX ориентируйся на `DESIGN_GUIDE.md`. Используй принципы, но самостоятельно выбирай грамотную композицию, типографику, цветовую систему и адаптивное поведение.
- Дизайн должен быть визуально цельным, аккуратным и пригодным для ежедневной работы; не стремись механически исполнить воображаемый макет из промпта.
- Двигайся небольшими проверяемыми шагами. Первые образцы интерфейса создавай сразу в настоящем React-проекте, чтобы компоненты затем можно было подключить к API. Допустимы явно обозначенные фикстуры только для визуальной разработки; не выдавай моки за готовую интеграцию.
- После изменений в интерфейсе проверяй desktop и mobile, состояния загрузки/пустоты/ошибки, доступность клавиатурой, визуальную иерархию.
- Работай с существующим React + TypeScript + Vite-проектом; не переписывай архитектуру и не устанавливай лишние зависимости без необходимости.

## Жёсткие ограничения текущего API
- Студенты не регистрируются и не входят в аккаунт. Нет публичного каталога опросов; admin API существует, но полноценная admin-панель не входит в Sprint A. Backend поддерживает удаление собственного `draft` с CSRF; в Sprint A эта функция в UI не добавляется. Черновик преподавателя можно полностью заменить через `PUT /api/polls/{id}`; `open` и `closed` не редактируются.
- Серверная авторизация преподавателя — через HttpOnly cookie, не JWT и не localStorage; используй same-origin `/api` и `credentials: "include"`.
- Для новых опросов используй `questions`, а не legacy-поле `question`; оно может быть `null`. Backend поддерживает `single_choice`, `multiple_choice`, `text`, режимы `survey`/`test` и анонимное/именное участие. Старые опросы без новых полей трактуются как анонимные SURVEY с одиночным выбором.
- Публичное голосование SURVEY: сначала GET открытого опроса (для voter cookie), затем POST ответов с `X-AnonPulse-Vote: 1`. Успешный POST даёт `204` без JSON. TEST отправляется отдельно через `/test-submissions` с `X-AnonPulse-Test: 1` и неизменным `clientRequestId` на одну попытку. Успех `201` выдаёт `accessSecret` только один раз; не помещай секрет в URL и логи.
- Промежуточные результаты `open` доступны только владельцу-преподавателю и администратору. Итоговые результаты `closed` публичны и содержат только агрегаты по каждому вопросу; не придумывай динамику, сегменты или отдельные ответы.
- Обрабатывай `400`, `401`, `403`, `404`, `409`, `429`, `5xx`. Не угадывай однозначную причину `409` без надёжного признака.
- Никогда не сохраняй логины, пароли, токены, cookie или другие секреты в коде, документации, fixtures и коммитах.

## Что сообщать после задачи
Кратко укажи изменённые файлы, что реально работает, что пока показано на фикстурах, какие проверки выполнены и какие ограничения остаются. Не называй работу законченной без проверки соответствующего сценария.

## Project Documentation

Before implementing any feature, consult the relevant documentation:

- `docs/requirements/Frontend_Sprint1_TZ.md` — frontend requirements and acceptance criteria.
- `docs/requirements/Product_Requirements.md` — product vision, user stories and business context.
- `DESIGN_GUIDE.md` — visual direction, UX principles and design quality.
- `docs/api/Backend_Guide.md` — backend integration guidance.
- `docs/api/openapi.json` — API contract snapshot.
- Текущие документы backend `docs/frontend-*.md` в репозитории QualiMeter/AnonPulse_Beckend — источник новых контрактов SURVEY/TEST.

## Rules

- Follow the current sprint requirements.
- Check actual backend support before implementing API integration.
- Do not invent endpoints or backend functionality.
- Treat the OpenAPI file as a snapshot, not necessarily the latest contract.
- Keep the design consistent across all screens.
- Make independent UI design decisions within the design guide.
- Report contradictions between documents instead of silently choosing one.
- Never store credentials or secrets in the repository.

## Приоритет источников

1. Актуальный код и документация backend определяют фактическое поведение API.
2. Frontend_Sprint1_TZ.md определяет целевую функциональность фронтенда.
3. Product_Requirements.md описывает продуктовые требования и User Stories.
4. DESIGN_GUIDE.md определяет принципы UX/UI.

При расхождениях между документами не придумывай собственное поведение API.

Сообщай о противоречиях до реализации затронутой функциональности.

Учти, что учебный Sprint 1 в Product_Requirements.md и расширенное ТЗ фронтенда имеют разный объём. Мы разрабатываем расширенный MVP на основе возможностей реального backend.
