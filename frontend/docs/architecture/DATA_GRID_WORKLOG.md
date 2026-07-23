# DataGrid Worklog

تاريخ آخر تحديث: `2026-04-01`

هذا الملف يلخص الشغل الذي تم على `DataGrid` في هذه المحادثة، من أول إعادة تنظيم الحزمة وحتى آخر إصلاحات توافق الثيم.

## النطاق

النطاق هنا هو:

- `src/app/shared/data-grid`
- الشاشات التي تستهلك الجريد من الـ public API
- أي تنظيف أو نقل كان مطلوبًا لإرجاع ملكية تصميم الجريد وسلوكها إلى `DataGrid` نفسها

ليس الهدف هنا توثيق كل تغيير في المشروع بالكامل، بل كل ما يخص `DataGrid` وما كان مرتبطًا بها مباشرة.

## الهدف النهائي

كان الهدف الوصول إلى الآتي:

- جعل `DataGrid` المصدر الواحد لتصميم الجريد وسلوكها
- إزالة أي ownership سيئ للجريد من الصفحات
- تنظيم الملفات والفولدرات بشكل مهني
- توحيد الـ shell design على شكل واحد
- جعل الجريد تتبع الثيمات العامة للتطبيق بدل أي skin محلي ثابت
- التأكد أن الحزمة تبني وتشتغل وتُختبر بدون كسر معروف

## ما الذي تم إنجازه

### 1. توحيد ملكية الجريد داخل `DataGrid`

تم تجميع تصميم الجريد وسلوكها داخل الحزمة نفسها، بدل الاعتماد على page-level styling أو selectors قديمة.

النتيجة:

- الجريد صارت تملك:
  - shell layout
  - header/body/footer visuals
  - scroll behavior
  - sticky selection behavior
  - overlay and menu styling
- الصفحات أصبحت تستهلك الجريد عبر الـ public API فقط

### 2. إعادة تنظيم الحزمة إلى فولدرات واضحة

تم تقسيم الحزمة إلى بنية أوضح:

- `component/`
- `components/`
- `core/`
- `models/`
- `module/`
- `renderers/`
- `services/`
- `styles/`
- `utils/`
- `internal/`
- `docs/`

والـ root صار نظيفًا، مع اعتماد نقطة دخول واحدة:

- `src/app/shared/data-grid/index.ts`

كما تم تثبيت module واضح للحزمة:

- `src/app/shared/data-grid/module/data-grid.module.ts`

### 3. ضبط الـ public API ومنع الاستهلاك الداخلي الخاطئ

تم تثبيت قاعدة أن الاستيراد الخارجي يكون من:

- `@shared/data-grid`

وتم التخلص من الاعتماد الخارجي على ملفات داخلية للحزمة بقدر الشغل الذي تم في هذا المسار.

### 4. إزالة العقود القديمة الخاصة بالصفحات

تم تنظيف العقود القديمة التي كانت تربط الجريد بصفحات محددة عبر naming أو shell styling خارجي.

من أمثلة ما تم التخلص منه خلال هذا المسار:

- page-owned grid shell styling
- selectors القديمة مثل `page-design-grid`
- naming/contracts القديمة الخاصة بالجداول الموحدة

كما تم توحيد الشيل العام بحيث يكون تصميمه واحدًا بدل أن يكون لكل صفحة skin خاص بها.

### 5. توحيد التصميم العام على Shell واحد

تم اعتماد shell design موحدة للجريد بدل تقسيم التصميم حسب الصفحات.

والتقسيم الداخلي صار حسب المسؤولية، لا حسب الـ feature:

- shell layout
- shell visuals
- shell interactions
- body
- header
- footer
- cell content

وهذا أعطى:

- تصميمًا واحدًا
- وتنظيمًا أفضل
- مع إبقاء مصدر الحقيقة داخل `DataGrid`

### 6. تنظيم الـ styles

تم تنظيم طبقة الـ styles بشكل أوضح داخل:

- `styles/base`
- `styles/shell`
- `styles/structure`
- `styles/selection`
- `styles/content`

كما تم لاحقًا تقسيم طبقة الشيل لتكون أوضح:

- shell chrome
- shell header
- shell body
- shell footer

### 7. تحسين الـ runtime وتقسيم الملفات

تم فصل أجزاء من الـ runtime إلى وحدات أكثر وضوحًا بدل التجميع في ملفات أكبر من اللازم.

الهدف هنا كان:

- تقليل التداخل بين lifecycle وscroll logic
- جعل الـ runtime domains أوضح
- تخفيف ضخامة بعض الملفات الكبيرة

### 8. نقل آخر التبعيات العامة إلى helper/API مقصود

تم نقل الـ scroll-host contract إلى helper واضح داخل `DataGrid` بدل الاعتماد على DOM access هش.

هذا سمح بأن:

- تبقى الـ features مستهلكة لعقد عام
- من غير اختراق للبنية الداخلية للجريد

### 9. تنظيف البقايا والـ dead paths

تمت إزالة أو تفكيك بقايا قديمة خلال مسار التنظيف، ومنها:

- أجزاء style/layout قديمة
- ملفات helper قديمة ومجزأة من المسار السابق
- dead code وبلوكات غير مستخدمة
- بقايا naming قديمة في مسار الجريد

### 10. توحيد `Calculate footer` مع شكل الجريد

كان هناك اختلاف بصري في `Calculate footer`.

تم ربطها بنفس shell/theme tokens الخاصة بالجريد، بدل skin منفصلة.

الملف المتأثر:

- `src/app/shared/data-grid/components/footer/grid-calculate-footer.component.scss`

### 11. جعل التصميم متوافقًا مع الثيمات

تم ربط `DataGrid` بتوكنز الثيم العامة للتطبيق بدل الاعتماد على dark literals في المواضع الحساسة.

الأعمال شملت:

- تعريف semantic DataGrid theme tokens
- توحيد الـ overlays
- توحيد الـ menus
- توحيد dialogs
- توحيد footer surfaces
- إزالة hardcoded dark backgrounds من shell/sticky areas

الملفات الأساسية في هذا المسار:

- `src/app/shared/data-grid/styles/base/_theme-and-base.scss`
- `src/app/shared/data-grid/styles/base/context-menu.scss`
- `src/app/shared/data-grid/styles/structure/_menus.scss`
- `src/app/shared/data-grid/styles/structure/_grouping.scss`
- `src/app/shared/data-grid/styles/structure/_filters.scss`
- `src/app/shared/data-grid/styles/structure/_dialogs.scss`
- `src/app/shared/data-grid/styles/shell/_body.scss`
- `src/app/shared/data-grid/styles/shell/_chrome.scss`
- `src/app/shared/data-grid/styles/shell/_interactions.scss`
- `src/app/shared/data-grid/styles/base/_core-visuals.scss`
- `src/app/shared/data-grid/components/footer/grid-calculate-footer.component.scss`

### 12. آخر إصلاحات خاصة بالثيم

آخر دفعة أصلحت السبب المباشر الذي كان يجعل الجريد تبدو داكنة في light theme:

- إزالة local dark forcing داخل theme base
- إزالة hardcoded dark backgrounds من:
  - sticky selection surfaces
  - shell overlays
  - column chooser header
  - help dialogs

بعد هذه الإصلاحات، تم التأكد أن:

- `html[data-theme='light']` ينعكس فعليًا على ألوان الجريد
- `Suppliers` grid تقرأ خلفية ونصوص light theme بشكل صحيح

## الملفات الرئيسية بعد التنظيم

### نقطة الدخول

- `src/app/shared/data-grid/index.ts`

### الموديول

- `src/app/shared/data-grid/module/data-grid.module.ts`

### المكوّن العام

- `src/app/shared/data-grid/component/data-grid.component.ts`
- `src/app/shared/data-grid/component/data-grid.component.html`
- `src/app/shared/data-grid/component/data-grid.component.scss`

### التوثيق

- `src/app/shared/data-grid/docs/README.md`
- `docs/architecture/DATA_GRID_WORKLOG.md`

## الشاشات المتأثرة

الشاشات التي تم التعامل معها أو التي كانت جزءًا من تثبيت المسار أثناء الشغل:

- Tender Projects
- Tender Suppliers
- Tasks-related grids
- Material Classification related grid usage

## التحقق الذي تم تشغيله أثناء هذا المسار

تم الاعتماد خلال الشغل على التحققات التالية في مراحل متعددة:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test -- --watch=false --include src/app/shared/data-grid/**/*.spec.ts`
- `npm run test:e2e -- e2e/tender-projects-hover.spec.ts`
- `npm run test:e2e -- e2e/suppliers.spec.ts`
- `npx playwright test e2e/tasks.spec.ts`

كما تم عمل تحقق بصري وتشغيلي أثناء إصلاح الثيم على شاشة `Suppliers` تحت `light` theme.

## الحالة النهائية

الوضع النهائي للحزمة بعد هذا المسار:

- `DataGrid` تملك تصميمها وسلوكها داخليًا
- لا يوجد page-owned shell design خاص بالجريد خارج الحزمة
- الحزمة منظمة على مستوى الفولدرات والملفات بشكل أوضح بكثير
- التصميم العام موحد
- الجريد مرتبطة بتوكنز الثيم العامة
- لا يوجد كسر معروف في النطاق الذي تم التحقق منه

## Troubleshooting References

- `docs/troubleshooting/DATA_GRID_AGGREGATE_FOOTER_FIRST_CALCULATE_JITTER.md`
- `docs/troubleshooting/DATA_GRID_COLUMN_RESIZE_PREVIEW_PERFORMANCE.md`

## ملاحظات تشغيلية

- ظهر أثناء بعض تشغيلات الـ e2e log من Vite:
  - `ws proxy error: ECONNREFUSED`
- هذا لم يكن failure في `DataGrid` نفسها، بل ضوضاء من dev websocket/server lifecycle بعد نجاح الاختبارات

## قاعدة الصيانة المستقبلية

- أي shell styling جديدة للجريد يجب أن تدخل تحت `src/app/shared/data-grid/styles`
- أي runtime behavior جديدة للجريد يجب أن تدخل داخل `core`
- أي استهلاك خارجي يجب أن يظل من `@shared/data-grid`
- لا يجب إعادة إدخال page-specific shell ownership خارج `DataGrid`
