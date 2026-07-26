-- Proposed cleanup SQL generated from live backup. Review before running.
-- Backup folder: E:\MY DATA\div\ENGINEERING\engineers-salary-reference\backups\salary-data-cleanup-20260725-052122
BEGIN;

CREATE TABLE IF NOT EXISTS "SalaryReportDisciplines_Backup_20260725_052252" AS SELECT * FROM "SalaryReportDisciplines";

CREATE TEMP TABLE discipline_cleanup_map (original text NOT NULL, canonical text NOT NULL);
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Structural', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مساح', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Agriculture', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Cost control', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Production', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('bms', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Maintenance', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemical engineer', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('It', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Operation', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('بنيه تحتيه', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Unit head', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure civil engineer', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('FLS Engineer', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Frontend web development', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Dev', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('management', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('الصيانة الميكانيكية', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مدير مكتب فنى - مهندس مدنى', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Light current', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('عماره داخليه وتصميم داخلي واثاث', 'Architecture');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Agriculture Engineer', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Production chemist', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('safety', 'HSE');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('بترول', 'Petroleum');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Highway technical office engineer', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Petrochemical', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Irrigation', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Process engineer', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infra structure', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Traffic engineer', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Maintenance planner', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('utilities', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Computer science', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Handover', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('هندسة زراعية', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('اعمال السلامة الانذار والاطفاء', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructural engineering', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Interior and furniture design', 'Architecture');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مدنى / سيفتى', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Wet Utilities Engineer', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('marine construction works', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Pluming', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Water treatment', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Autocad Drawer', 'Drafting / CAD');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Civil Execution Engineer', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Furniture production', 'Architecture');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Land Scap', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Tender', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('agricultural', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مساحه', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('QS', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemical engineer (Operation)', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Civil Defense Consultant', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('الزراعة', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Project management', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('شبكات', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Smart home', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Hvac bim', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Production operator Production operator', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('كيمياء', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('لاندسكيب', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('تعدين وفلزات', 'Metallurgy');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('HVAC ENGINEER', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Operation and maintenance', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Health and safety', 'HSE');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemistry', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Mechanical Infrastructure', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Procurement', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Metallurgical (quality)', 'Metallurgy');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Mechanical, BIM', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Business Development', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure BIM', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Mechanical and electrical', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Cost control engineer', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مساحة', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Production planning', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('زراعة', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('بنية تحتية', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemist', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مدني تنفيذي', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Survey', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Plumbing and fire protection', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Facility', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure and roads', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Draftsman mep & arch', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('FLS', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('لاندسكيب شبكات ري', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Facilities', 'Operations / Maintenance');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Technical office', 'Project Controls / Technical Office');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Biomedical', 'Biomedical Engineering');

UPDATE "SalaryReportDisciplines" d
SET "Value" = m.canonical
FROM discipline_cleanup_map m
WHERE d."Value" = m.original;

-- Review invalid/non-engineering rows separately before delete/move:
-- REVIEW_NON_ENGINEERING: اخصائي شؤون الموظفين (1) => non-engineering role
-- REVIEW_NON_ENGINEERING: محاسب (1) => non-engineering role
-- REVIEW_NON_ENGINEERING: المحاسبه (1) => non-engineering role
-- REVIEW_INVALID_FIELD: Alexandria (1) => looks like city, not discipline

-- Verify before COMMIT:
SELECT "Value", count(*) FROM "SalaryReportDisciplines" GROUP BY "Value" ORDER BY count(*) DESC, "Value";

-- COMMIT;
-- ROLLBACK;
