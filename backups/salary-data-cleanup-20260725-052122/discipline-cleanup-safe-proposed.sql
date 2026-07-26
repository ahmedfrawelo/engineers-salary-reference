-- SAFE PROPOSED SQL - review before running against Neon production.
-- Generated from backup: E:\MY DATA\div\ENGINEERING\engineers-salary-reference\backups\salary-data-cleanup-20260725-052122
BEGIN;
CREATE TABLE IF NOT EXISTS "SalaryReportDisciplines_Backup_20260725_052401" AS SELECT * FROM "SalaryReportDisciplines";
CREATE TEMP TABLE discipline_cleanup_map (original text NOT NULL, canonical text NOT NULL);
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مساح', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Agriculture', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('bms', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemical engineer', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('It', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Communication', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('بنيه تحتيه', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure civil engineer', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('FLS Engineer', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Frontend web development', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Dev', 'Information Technology');
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
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('utilities', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Computer science', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('هندسة زراعية', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('اعمال السلامة الانذار والاطفاء', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructural engineering', 'Structural');
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
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('agricultural', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مساحه', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemical engineer (Operation)', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Civil Defense Consultant', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('الزراعة', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('شبكات', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Smart home', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Hvac bim', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('كيمياء', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('لاندسكيب', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('تعدين وفلزات', 'Metallurgy');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('HVAC ENGINEER', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Health and safety', 'HSE');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemistry', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Mechanical Infrastructure', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Metallurgical (quality)', 'Metallurgy');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Mechanical, BIM', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Business Development', 'Information Technology');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure BIM', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Mechanical and electrical', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مساحة', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('زراعة', 'Agricultural Engineering');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('بنية تحتية', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Chemist', 'Chemical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('مدني تنفيذي', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Survey', 'Surveying');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Plumbing and fire protection', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Infrastructure and roads', 'Civil');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Draftsman mep & arch', 'Mechanical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('FLS', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('لاندسكيب شبكات ري', 'Electrical');
INSERT INTO discipline_cleanup_map (original, canonical) VALUES ('Biomedical', 'Biomedical Engineering');
UPDATE "SalaryReportDisciplines" d SET "Value" = m.canonical FROM discipline_cleanup_map m WHERE d."Value" = m.original;
-- Verification
SELECT "Value", count(*) FROM "SalaryReportDisciplines" GROUP BY "Value" ORDER BY count(*) DESC, "Value";
-- Review-only values not changed by this script:
-- REVIEW_TAXONOMY: Cost control count=3 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: Production count=2 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: Maintenance count=2 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: Operation count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: Unit head count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: management count=1 note=role/business function; decide whether to keep as discipline or separate category
-- KEEP_REVIEW: Thecnical count=1 note=needs manual review
-- KEEP_REVIEW: مهندس جوده طباعه count=1 note=needs manual review
-- REVIEW_TAXONOMY: Maintenance planner count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_NON_ENGINEERING: اخصائي شؤون الموظفين count=1 note=non-engineering role
-- REVIEW_TAXONOMY: Handover count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: Tender count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: QS count=1 note=role/business function; decide whether to keep as discipline or separate category
-- KEEP_REVIEW: Automation count=1 note=needs manual review
-- REVIEW_TAXONOMY: Project management count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_NON_ENGINEERING: محاسب count=1 note=non-engineering role
-- REVIEW_TAXONOMY: Production operator Production operator count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: Operation and maintenance count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_NON_ENGINEERING: المحاسبه count=1 note=non-engineering role
-- KEEP_REVIEW: Q. C count=1 note=needs manual review
-- REVIEW_TAXONOMY: Procurement count=1 note=role/business function; decide whether to keep as discipline or separate category
-- KEEP_REVIEW: Sr.Dc count=1 note=needs manual review
-- REVIEW_TAXONOMY: Cost control engineer count=1 note=role/business function; decide whether to keep as discipline or separate category
-- KEEP_REVIEW: Kitchen and laundry installation Eng count=1 note=needs manual review
-- REVIEW_TAXONOMY: Production planning count=1 note=role/business function; decide whether to keep as discipline or separate category
-- KEEP_REVIEW: Solar energy count=1 note=needs manual review
-- REVIEW_TAXONOMY: Facility count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_INVALID_FIELD: Alexandria count=1 note=looks like city, not discipline
-- REVIEW_TAXONOMY: Facilities count=1 note=role/business function; decide whether to keep as discipline or separate category
-- REVIEW_TAXONOMY: Technical office count=1 note=role/business function; decide whether to keep as discipline or separate category
-- If good: COMMIT;
-- If bad: ROLLBACK;
