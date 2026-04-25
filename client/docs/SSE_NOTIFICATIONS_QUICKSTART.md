# 🪶 Костыльный путь — SSE-уведомления (без Firebase)

**Время на запуск: 2 минуты. Внешних сервисов: 0.**

Бэкенд уже всё умеет — `NotificationService.createNotification()` теперь автоматически
шлёт событие во все открытые вкладки пользователя через Server-Sent Events.

---

## 🎯 Что работает

| Хочу | Получаю |
|------|---------|
| Реал-тайм уведомления, пока вкладка открыта | ✅ SSE (этот гайд) |
| Уведомления, когда вкладка закрыта / телефон в кармане | ❌ нужен FCM (см. `PUSH_NOTIFICATIONS_SETUP.md`) |
| Просто колокольчик с числом непрочитанных | ✅ SSE даёт это бесплатно |

Если нужны только уведомления **«когда вкладка открыта»** (а это 90% UX-кейса) — SSE решает всё.

---

## 🔌 Эндпоинт

```
GET /api/notifications/stream?token=<accessToken>
Content-Type: text/event-stream
```

> ⚠️ Токен передаётся в **query**, потому что браузерный `EventSource` не умеет ставить
> заголовки. Это безопасно для access-токена, который и так живёт в URL фронта.
> JWT-фильтр поддерживает `?token=` **только** для пути `/api/notifications/stream` —
> для всех остальных эндпоинтов работает обычный `Authorization: Bearer …`.

---

## 💻 Frontend — 10 строк

```ts
// src/lib/sse.ts
export function connectNotifications() {
  const token = localStorage.getItem('accessToken');
  const es = new EventSource(`/api/notifications/stream?token=${token}`);

  es.addEventListener('connected', () => console.log('✅ SSE connected'));

  es.addEventListener('notification', (e) => {
    const n = JSON.parse(e.data);
    console.log('🔔', n);
    // Здесь твоя логика: toast, обновление колокольчика, звук и т.д.
    showToast(n.title, n.message);
    incrementBellCounter();
  });

  es.onerror = () => {
    console.warn('SSE disconnected, browser will auto-reconnect');
    // EventSource сам переподключится через ~3 секунды
  };

  return es;
}

// Вызвать после логина:
const es = connectNotifications();

// При logout: es.close();
```

**Всё.** Никакого Firebase, никакого Service Worker, никаких ключей.

---

## 🧪 Проверка

1. Залогинься на фронте, в консоли увидишь `✅ SSE connected`.
2. В DevTools → Network найди запрос `stream` со статусом `200` и типом `eventsource`.
3. В другой вкладке/curl:
   ```bash
   curl -X POST http://localhost:8080/api/notifications/test \
     -H "Authorization: Bearer <token>"
   ```
4. В первой вкладке мгновенно вылетит `🔔 {...}` в консоли + сработает твой toast.

---

## ⚙️ Как это работает внутри

```
┌─────────┐  GET /stream    ┌──────────────────────┐
│ Browser │ ──────────────▶ │ NotificationController│
└────┬────┘  (long-lived)   └──────────┬───────────┘
     │                                 │ register(userId)
     │                                 ▼
     │                       ┌──────────────────┐
     │                       │ SseEmitterRegistry│
     │                       │  Map<userId, [...]>│
     │                       └─────────┬────────┘
     │                                 │
     │  event: notification            │ broadcast()
     │  data: {...}                    │
     ◀─────────────────────────────────┤
                                       │
                                       ▲
                            ┌──────────┴───────────┐
                            │ NotificationService  │
                            │  .createNotification │
                            └──────────┬───────────┘
                                       │ вызывается из:
                                       │ - PantryExpiry scheduler
                                       │ - MealReminder scheduler
                                       │ - WeeklyReport scheduler
                                       │ - RecipeGenerationService
                                       │ - /api/notifications/test
```

**Один пользователь = одна запись в Map.** Если он открыл 3 вкладки — у него 3 эмиттера в списке, broadcast разошлёт всем трём.

При закрытии вкладки/таймауте/ошибке эмиттер автоматически удаляется из реестра — нет утечек памяти.

---

## ⚖️ SSE vs FCM — когда что брать

| | SSE | FCM |
|--|-----|-----|
| Настройка | 0 минут | 30 минут |
| Внешние сервисы | нет | Firebase |
| Работает в фоне | ❌ | ✅ |
| Работает в нативных приложениях | ❌ | ✅ |
| iOS Safari | ✅ | требует APNs |
| Стоимость | $0 | $0 (FCM бесплатен) |
| Сложность кода фронта | 10 строк | ~50 строк + Service Worker |

**Рекомендация:**
- MVP / web-only / «когда вкладка открыта» → **SSE**
- Когда дойдёт до мобильного приложения / нужно будить фоновую вкладку → **+ FCM**

Они **могут работать одновременно**: `NotificationService.createNotification()` дёргает оба.
Если FCM не настроен — он молча скипается, SSE работает один.

---

## 🐢 Альтернатива на 2 строки — банальный polling

Если даже SSE кажется сложным, на фронте вообще можно так:

```ts
setInterval(async () => {
  const res = await api.get('/api/notifications?unreadOnly=true&size=10');
  updateBell(res.data.unreadCount);
}, 30_000);  // раз в 30 секунд
```

Минусы: задержка до 30 сек, лишний трафик, нагрузка на БД. Но для прототипа — ок.

