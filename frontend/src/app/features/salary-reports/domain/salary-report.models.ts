export type SalaryOptions = {
  disciplines: string[];
  companyTypes: string[];
  cities: string[];
  countries: string[];
  workModes: string[];
  currencies: string[];
  housingProvided: string[];
  transportationProvided: string[];
  annualBonuses: string[];
  salaryFairnessOptions: string[];
  recommendFieldOptions: string[];
  professionalCertificates: string[];
  highestEducations: string[];
  extraDaysOff: string[];
  monthlyNetSalaries: number[];
  yearsOfExperience: number[];
  dailyWorkHours: number[];
};

export type SalaryReportDraft = {
  discipline: string;
  companyType: string;
  city: string;
  country: string;
  monthlyNetSalary: number | null;
  currency: string;
  yearsOfExperience: number | null;
  workMode: string;
  benefits: string;
  housingProvided: string;
  transportationProvided: string;
  annualBonus: string;
  salaryFairness: string;
  recommendField: string;
  negotiationAdvice: string;
  professionalCertificate: string;
  highestEducation: string;
  dailyWorkHours: number | null;
  extraDayOff: string;
};

export type SalaryReportDetail = {
  id: string;
  country: string;
  city: string;
  discipline: string;
  companyType: string;
  yearsOfExperience: number;
  workMode: string;
  currency: string;
  monthlyNetSalary: number;
  submittedAt: string;
  housingProvided?: string | null;
  transportationProvided?: string | null;
  annualBonus?: string | null;
  salaryFairness?: string | null;
  recommendField?: string | null;
  negotiationAdvice?: string | null;
  professionalCertificate?: string | null;
  benefits?: string | null;
  highestEducation?: string | null;
  dailyWorkHours?: number | null;
  extraDayOff?: string | null;
};

export type SalaryReportTextField = Exclude<
  keyof SalaryReportDraft,
  'monthlyNetSalary' | 'yearsOfExperience' | 'dailyWorkHours'
>;
export type SalaryReportNumberField = 'monthlyNetSalary' | 'yearsOfExperience' | 'dailyWorkHours';

export const emptySalaryOptions = (): SalaryOptions => ({
  disciplines: [], companyTypes: [], cities: [], countries: [], workModes: [], currencies: [], housingProvided: [], transportationProvided: [], annualBonuses: [],
  salaryFairnessOptions: [], recommendFieldOptions: [], professionalCertificates: [], highestEducations: [],
  extraDaysOff: [], monthlyNetSalaries: [], yearsOfExperience: [], dailyWorkHours: []
});

export const createSalaryReportDraft = (): SalaryReportDraft => ({
  discipline: '', companyType: '', city: '', country: '', monthlyNetSalary: null,
  currency: 'EGP', yearsOfExperience: null, workMode: 'Hybrid', benefits: '',
  housingProvided: '', transportationProvided: '', annualBonus: '', salaryFairness: '',
  recommendField: '', negotiationAdvice: '', professionalCertificate: '', highestEducation: '',
  dailyWorkHours: null, extraDayOff: ''
});
