@echo off
REM ============================================
REM  ENGINEERS_SALARY_REFERENCE Portal - Project Cleanup Script
REM  تنظيف المشروع وتقليل الحجم
REM ============================================

echo ====================================
echo   ENGINEERS_SALARY_REFERENCE Portal - Project Cleanup
echo   تنظيف مجلدات المشروع
echo ====================================
echo.

REM عرض الحجم الحالي
echo [1/5] Checking current size... (فحص الحجم الحالي)
powershell -Command "$size = (Get-ChildItem -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB; Write-Host 'Current size: ' -NoNewline; Write-Host ([math]::Round($size, 2)) -ForegroundColor Yellow -NoNewline; Write-Host ' GB'"
echo.

REM تأكيد من المستخدم
set /p CONFIRM="Do you want to continue? (Y/N) / هل تريد المتابعة؟: "
if /i not "%CONFIRM%"=="Y" (
    echo Cleanup cancelled. / تم إلغاء التنظيف
    exit /b
)
echo.

REM حذف .angular cache
echo [2/5] Removing .angular cache... (حذف الكاش)
if exist .angular (
    rd /s /q .angular
    echo ✓ .angular deleted
) else (
    echo - .angular not found
)
echo.

REM حذف dist
echo [3/5] Removing dist folder... (حذف مجلد البناء)
if exist dist (
    rd /s /q dist
    echo ✓ dist deleted
) else (
    echo - dist not found
)
echo.

REM حذف node_modules وpackage-lock.json
echo [4/5] Removing node_modules... (حذف الحزم - قد يستغرق وقتاً)
if exist node_modules (
    rd /s /q node_modules
    echo ✓ node_modules deleted
) else (
    echo - node_modules not found
)

if exist package-lock.json (
    del /f /q package-lock.json
    echo ✓ package-lock.json deleted
)
echo.

REM إعادة التثبيت
echo [5/5] Reinstalling packages... (إعادة تثبيت الحزم - قد يستغرق 2-5 دقائق)
call npm install

echo.
echo ====================================
echo   Cleanup Complete! / اكتمل التنظيف
echo ====================================
echo.

REM عرض الحجم الجديد
echo New size:
powershell -Command "$size = (Get-ChildItem -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB; Write-Host ([math]::Round($size, 2)) -ForegroundColor Green -NoNewline; Write-Host ' GB'"
echo.

echo You can now run: npm start
echo يمكنك الآن تشغيل: npm start
pause
