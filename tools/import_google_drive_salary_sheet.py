import argparse
import hashlib
import json
from pathlib import Path
from urllib import request
from urllib.error import HTTPError

try:
    import pandas as pd
except ModuleNotFoundError as error:
    raise SystemExit(
        "Missing Python package 'pandas'. Use the bundled Codex Python runtime documented in README.md, "
        "or install pandas and openpyxl in the Python environment running this importer."
    ) from error


DEFAULT_API_BASE = "http://localhost:5145/api"


def clean(value):
    if pd.isna(value):
        return None
    text = str(value).strip()
    return text if text and text.lower() != "nan" else None


def number(value, default=0):
    if pd.isna(value):
        return default
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return default


def seniority(years):
    if years <= 1:
        return "Fresh Graduate"
    if years <= 3:
        return "Junior"
    if years <= 7:
        return "Mid-Level"
    if years <= 12:
        return "Senior"
    return "Lead"


def currency_code(value):
    text = (clean(value) or "EGP").upper()
    mapping = {
        "جنيه": "EGP",
        "جنية": "EGP",
        "مصري": "EGP",
        "EGP": "EGP",
        "ريال سعودي": "SAR",
        "SAR": "SAR",
        "درهم": "AED",
        "AED": "AED",
        "دينار كويتي": "KWD",
        "كويتي": "KWD",
        "KWD": "KWD",
        "دولار": "USD",
        "USD": "USD",
        "يورو": "EUR",
        "EUR": "EUR",
        "OMR": "OMR",
        "ريال عماني": "OMR",
        "QAR": "QAR",
        "IQD": "IQD",
        "SYR": "SYR",
        "ETB": "ETB",
        "INR": "INR",
        "YER": "YER",
        "درهم": "AED",
        "UAE DIRHAM": "AED",
        "DURHAM": "AED",
        "UAE": "AED",
        "UAD": "AED",
        "ARD": "AED",
        "DH": "AED",
        "DHS": "AED",
        "DRHM": "AED",
        "دينار ليبي": "LYD",
        "الدينار الليبي": "LYD",
        "دينار": "LYD",
        "DINAR": "IQD",
        "دينار كويتي": "KWD",
        "JOD": "JOD",
        "JD": "JOD",
        "JOR": "JOD",
        "EURO": "EUR",
        "جنية سوداني": "SDG",
        "QR": "QAR",
        "NIS / SHEIKL": "ILS",
        "NAIRA": "NGN",
        "70% EGP - 30% USD": "EGP",
        "ريال قطري": "QAR",
    }
    for key, code in mapping.items():
        if key.upper() in text:
            return code
    return text[:3].ljust(3, "X")


def post_json(url, payload, idempotency_key):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency_key,
            "User-Agent": "EngineersSalaryImport/1.0",
        },
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        payload_json = json.dumps(payload, ensure_ascii=False)
        raise RuntimeError(f"POST failed: {error.code} {detail} payload={payload_json}") from error


def get_json(url):
    req = request.Request(url, headers={"User-Agent": "EngineersSalaryImport/1.0"})
    with request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def stable_idempotency_key(source_row, payload):
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"import-google-drive-{source_row}-{digest}"


def build_payload(row):
    years = int(number(row[4], 0))
    discipline = clean(row[3]) or "Engineering"
    salary = number(row[8], 0)
    if salary <= 0:
        return None

    return {
        "discipline": discipline,
        "roleTitle": f"{discipline} Engineer",
        "seniority": seniority(years),
        "companyName": "Imported Google Form Response",
        "companyType": clean(row[5]) or "Not specified",
        "city": clean(row[2]) or "Not specified",
        "country": clean(row[1]) or "Not specified",
        "monthlyNetSalary": salary,
        "currency": currency_code(row[7]),
        "yearsOfExperience": years,
        "employmentType": "Full-time",
        "workMode": clean(row[6]) or "Not specified",
        "isAnonymous": True,
        "benefits": clean(row[16]),
        "notes": clean(row[14]),
        "housingProvided": clean(row[9]),
        "transportationProvided": clean(row[10]),
        "annualBonus": clean(row[11]),
        "salaryFairness": clean(row[12]),
        "recommendField": clean(row[13]),
        "negotiationAdvice": clean(row[14]),
        "professionalCertificate": clean(row[15]),
        "highestEducation": clean(row[17]),
        "dailyWorkHours": number(row[18], None),
        "extraDayOff": clean(row[19]),
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Import the Google Drive salary workbook into the local API.")
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.workbook.exists():
        raise FileNotFoundError(f"Workbook not found: {args.workbook}")

    summary = get_json(f"{args.api_base}/salary-reports/read-rows/summary")
    existing_reports = summary.get("totalReports", 0)
    if existing_reports > 1000 and not args.force and not args.dry_run:
        print(json.dumps({"skipped": True, "reason": "database already has imported data", "totalReports": existing_reports}))
        return

    raw = pd.read_excel(args.workbook, sheet_name=0, header=None)
    rows = raw.iloc[2:].reset_index(drop=True)
    imported = 0
    skipped = 0

    for source_row, (_, row) in enumerate(rows.iterrows(), start=3):
        payload = build_payload(row)
        if payload is None:
            skipped += 1
            continue
        if not args.dry_run:
            post_json(
                f"{args.api_base}/salary-reports",
                payload,
                stable_idempotency_key(source_row, payload),
            )
        imported += 1

    print(json.dumps({"dryRun": args.dry_run, "existingReports": existing_reports, "imported": imported, "skipped": skipped}, ensure_ascii=False))


if __name__ == "__main__":
    main()
