export interface Env {
  DATABASE_URL: string;
  ALLOWED_ORIGIN: string;
  ENVIRONMENT: 'production' | 'development';
}

export type Row = Record<string, unknown>;
export interface Db { query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>; }

export const readFields = [
  'discipline','country','city','yearsOfExperience','companyType','workMode','currency',
  'monthlyNetSalary','housingProvided','transportationProvided','annualBonus','salaryFairness',
  'recommendField','negotiationAdvice','professionalCertificate','benefits','highestEducation',
  'dailyWorkHours','extraDayOff'
] as const;

export const columnByField: Record<string, string> = Object.fromEntries(
  ['Id', ...readFields.map(value => value[0].toUpperCase() + value.slice(1))].map(value => [value.toLowerCase(), `"${value}"`])
);
