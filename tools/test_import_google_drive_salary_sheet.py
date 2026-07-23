import importlib.util
import unittest
from pathlib import Path


def load_importer():
    importer_path = Path(__file__).with_name("import_google_drive_salary_sheet.py")
    spec = importlib.util.spec_from_file_location("import_google_drive_salary_sheet", importer_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ImportGoogleDriveSalarySheetTests(unittest.TestCase):
    def test_currency_code_maps_arabic_currency_names(self):
        importer = load_importer()

        self.assertEqual("EGP", importer.currency_code("جنيه مصري"))
        self.assertEqual("SAR", importer.currency_code("ريال سعودي"))
        self.assertEqual("AED", importer.currency_code("درهم"))
        self.assertEqual("KWD", importer.currency_code("دينار كويتي"))

    def test_seniority_maps_experience_bands(self):
        importer = load_importer()

        self.assertEqual("Fresh Graduate", importer.seniority(0))
        self.assertEqual("Junior", importer.seniority(3))
        self.assertEqual("Mid-Level", importer.seniority(7))
        self.assertEqual("Senior", importer.seniority(12))
        self.assertEqual("Lead", importer.seniority(13))


if __name__ == "__main__":
    unittest.main()
