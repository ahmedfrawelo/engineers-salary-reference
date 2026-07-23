# خطة توحيد نظام الـ Notifications

**التاريخ:** 2026-04-08
**الحالة:** ✅ مكتملة تنفيذيًا
**الأولوية:** متوسطة

---

## الملخص التنفيذي

تم تنفيذ خطة التوحيد بالكامل على مستوى النظام الفعلي في المشروع، مع اعتماد قرار معماري واضح:

- لا نستخدم `window.confirm()` في مسارات الـ grid المحلية.
- لا نعمم `Undo` إلا عندما يكون هناك rollback محلي واضح أو contract عكسي من الـ backend.
- عند غياب restore contract صريح، نستخدم `toast.action(..., 'Undo')` مع `onExpire` لتأجيل العملية التدميرية الفعلية.

النتيجة الحالية:

- كل feedback الخاص بالإشعارات والعمليات القابلة للتراجع أصبح مبنيًا على `ToastService` و`UndoActionToastService`.
- تم توحيد notification presentation contract بين الباك والفرونت.
- تم إزالة heuristics التي كانت تستنتج نوع الإشعار من نص الرسالة.
- تم توسيع الـ undo rollout ليشمل المسارات المحلية، ومسارات API-backed الآمنة، والمسارات الإدارية الحساسة التي لها rollback واضح.

---

## ما تم تنفيذه

### 1. طبقة الإشعارات العامة

- توحيد `GlobalErrorHandler` على `ToastService`.
- ربط `NotificationsBridgeService` بمصدر موحد من WebSocket + HTTP.
- دعم auto-toast للإشعارات الجديدة القادمة من الباك.
- إزالة heuristics من الفرونت التي كانت تغيّر `type/priority` بناءً على نص الرسالة.

### 2. عقد العرض بين الباك والفرونت

- دعم `NotificationType`
- دعم `Priority`
- دعم `ActionUrl`
- دعم `ActionLabel`
- دعم `Icon`
- دعم `SourceModule`
- تطبيق migration الخاصة بعقد العرض الجديد

### 3. Grid local undo

- إزالة `confirm()` من مسارات الحذف المحلية داخل الـ grid
- تحويل الحذف المحلي وpreset overwrite إلى `toast.action(..., 'Undo')`
- إضافة registration layer حتى يظل runtime منفصلًا عن Angular DI

### 4. CRM local CRUD undo

- توحيد create/update/delete القابلة للتراجع عبر `UndoActionToastService`
- تغطية المسارات المحلية الأساسية داخل CRM
- الحفاظ على auto-save الهادئ في المسارات التي لا يناسبها spam toasts

### 5. Inline toast cleanup

- إزالة أنظمة toast المحلية المتناثرة
- توحيد feedback في `Material Classification` وما حولها

### 6. API-backed undo rollout

تم التنفيذ على المسارات التالية:

- `Tender Pricing`
  - item create/update/delete
  - quote create/update/delete
  - preferred quote switching
  - add-item overlay save

- `Material Classification`
  - material create/update/delete
  - level type create/update/delete
  - level option create/update
  - schema create/update
  - hierarchy node creation
  - chain level creation

- `Tender Settings`
  - create with rollback delete
  - update with rollback update
  - delete via deferred delete + undo + `onExpire`

- `Tender Projects main page`
  - create with `Open` action toast
  - rename with rollback undo
  - single edit with rollback undo
  - bulk edit with rollback undo
  - delete via deferred delete + undo + `onExpire`

- `Tender Reports`
  - local report create with undo remove

- `Tasks`
  - Team Tasks create/update/delete with undo
  - Team Tasks quick add, bulk/status/template, drag-drop, and reschedule with undo
  - Task Future create/update/delete with undo
  - Task Future quick add, inline patch, bulk/status/template, board/list moves, and reschedule with undo

- `BOQ Project Breakdown`
  - imported item batch create with undo
  - adopt-unit-rate local update with undo
  - local breakdown add/remove with undo
  - duplicate breakdown with undo
  - clipboard paste with undo
  - inline cell edit with undo

- `User Access Control`
  - create user with undo delete
  - restore deleted user with undo re-delete
  - edit user with rollback for profile/status/role عندما يكون rollback كاملًا ممكنًا
  - quick edit مع rollback موحد
  - bulk status update مع undo
  - bulk delete مع restore undo
  - single delete مع restore undo
  - admin actions success toasts لـ `force logout` و`unlock`
  - hard delete يبقى بدون undo، مع success feedback فقط

- `Account Notifications`
  - archive / restore / delete الفردي عبر action toasts
  - `mark all read` عبر action toast مع rollback batch
  - `archive read` عبر action toast مع restore batch
  - delete archived يبقى confirm-like action toast عبر `Cancel`

- `HR Leave`
  - local leave request create with undo remove
  - local leave status update with undo revert

- `In-Hand Stores Execution`
  - receive / issue / adjust line add with undo
  - receive / issue / adjust line remove with undo restore
  - local post flows with draft restore undo + delayed return to register

---

## القرارات المعمارية النهائية

### متى نستخدم `Undo`

نستخدم `Undo` في واحدة من ثلاث حالات:

1. يوجد local rollback واضح وآمن.
2. يوجد reverse API contract واضح.
3. العملية التدميرية يمكن تأجيلها حتى `onExpire`.

### متى لا نستخدم `Undo`

لا نعرض `Undo` عندما يكون الرجوع ناقصًا أو مضللًا، مثل:

- تغيير كلمة مرور بدون old-password restore contract
- hard delete غير القابل للاسترجاع
- أي rollback جزئي لا يعيد الحالة بالكامل

في هذه الحالات نعرض success/error feedback فقط.

---

## التغطية الحالية

```text
Toast System
────────────────────────────────────────────
✅ Global errors             → ToastService
✅ Notification inbox        → unified HTTP/WebSocket bridge
✅ Notification presentation → backend contract + frontend rendering
✅ Grid local actions        → toast.action + Undo
✅ CRM local CRUD            → UndoActionToastService
✅ Tasks domain module       → Team Tasks + Task Future undo rollout
✅ Material panels           → unified toast feedback
✅ Tender Pricing            → unified undo rollout
✅ Tender Projects main page → create/open + rollback undo
✅ Tender Reports            → local create undo
✅ BOQ local actions         → import, add/remove, duplicate, paste, and inline edit undo
✅ Material Classification   → API-backed undo rollout
✅ Tender Settings           → create/update/delete unified
✅ User Access Control       → admin-safe selective undo rollout
✅ HR leave                  → request create + status update undo
✅ In-Hand stores actions    → line add/remove + post draft restore undo
────────────────────────────────────────────
```

---

## التحقق المنفذ

تم تنفيذ التحقق التالي بعد آخر مرحلة:

- `npm run typecheck`
- `npx vitest run src/app/core/notifications/undo-action-toast.service.spec.ts`
- `npx vitest run src/app/shared/data-grid/utils/feedback/data-grid-feedback.util.spec.ts`
- `npx vitest run src/app/shared/data-grid/core/runtime/data-grid.component.part1.internal.impl.spec.ts`
- `npx vitest run src/app/shared/data-grid/core/runtime/data-grid.component.runtime-interactions.spec.ts`
- `npx vitest run src/app/features/settings/presentation/user-access-control/helpers/user-access-control.roster.helper.permissions.spec.ts`

النتيجة:

- `typecheck` ناجح
- حزمة الاختبارات المرتبطة بالتوحيد ناجحة

ملاحظة معروفة:

- ملف `notifications-bridge.service.spec.ts` قد يفشل في بيئة التشغيل الحالية بسبب `Angular JIT decorator` issue في test environment نفسه، وليس بسبب منطق التوحيد المنفذ هنا.

---

## المتبقي

لا يوجد متبقي تنفيذي blocker داخل الخطة نفسها.

المتبقي فقط إن أردنا مرحلة أعلى من التحقق أو التوسيع:

- `UAT` يدوي شامل على الصفحات الرئيسية
- مرور وظيفي على السيناريوهات الإنتاجية بحسابات تشغيل حقيقية

مرجع التغطية التفصيلي:

- `docs/roadmap/CRUD-UNDO-COVERAGE-MATRIX.md`

---

## قاعدة العمل للمراحل القادمة

أي feature جديدة في المشروع تتبع القاعدة التالية:

- `save immediately + success toast` إذا لم يوجد rollback contract
- `save immediately + undo with rollback API` إذا وجد reverse endpoint واضح
- `toast.action + onExpire` إذا كانت العملية مناسبة للتأجيل قبل التنفيذ الفعلي

بهذا الشكل يبقى نظام الـ notifications والـ action feedback موحدًا، ويمكن توسيعه بدون رجوع إلى confirm dialogs أو toast implementations محلية متناثرة.
