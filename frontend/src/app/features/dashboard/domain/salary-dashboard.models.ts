export type SalaryDashboardFilters = {
  discipline?: string;
  experience?: string;
  workMode?: string;
};

export type SalaryDashboardBreakdown = {
  label: string;
  count: number;
  averageSalary: number;
};

export type SalaryDashboardSummary = {
  totalReports: number;
  averageSalary: number;
  medianSalary: number;
  minSalary: number;
  maxSalary: number;
  currency: string;
  byDiscipline: SalaryDashboardBreakdown[];
  bySeniority: SalaryDashboardBreakdown[];
};

export type SalaryDashboardOptions = {
  disciplines: string[];
  seniorities: string[];
  workModes: string[];
  currencies: string[];
};

export type SalaryDashboardReportPreview = {
  id: string;
  discipline: string;
  roleTitle: string;
  seniority: string;
  companyName: string;
  city: string;
  monthlyNetSalary: number;
  currency: string;
  yearsOfExperience: number;
  workMode: string;
  isAnonymous: boolean;
};

export type SalaryDashboardSnapshot = {
  summary: SalaryDashboardSummary;
  latestReports: SalaryDashboardReportPreview[];
  options: SalaryDashboardOptions;
};
