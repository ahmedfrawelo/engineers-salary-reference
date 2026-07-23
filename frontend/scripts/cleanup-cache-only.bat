@echo off
REM ============================================
REM  ENGINEERS_SALARY_REFERENCE Portal - Quick Cache Cleanup
REM  تنظيف الكاش فقط (آمن وسريع)
REM ============================================

echo ====================================
echo   Quick Cache Cleanup
echo   تنظيف الكاش السريع
echo ====================================
echo.

echo Removing .angular cache...
if exist .angular (
    rd /s /q .angular
    echo ✓ Cache cleared successfully!
    echo ✓ تم حذف الكاش بنجاح!
) else (
    echo - No cache found
    echo - لا يوجد كاش للحذف
)

echo.
echo Removing dist folder...
if exist dist (
    rd /s /q dist
    echo ✓ Build folder cleared!
    echo ✓ تم حذف مجلد البناء!
) else (
    echo - No build folder found
    echo - لا يوجد مجلد بناء للحذف
)

echo.
echo ====================================
echo   Done! / تم الانتهاء
echo ====================================
echo.
echo Saved approximately 1-5 GB
echo تم توفير تقريباً 1-5 جيجابايت
echo.

pause
