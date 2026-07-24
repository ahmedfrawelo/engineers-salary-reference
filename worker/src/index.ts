import { createDb } from './repository';
import { columnByField, readFields, type Db, type Env, type Row } from './types';

const view = '"vwSalaryReportReadRows"';
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };
const textFilters = readFields.filter(field => !['yearsOfExperience','monthlyNetSalary','dailyWorkHours'].includes(field));
const sortFields = new Set(['id','discipline','country','city','companytype','workmode','currency','yearsofexperience','monthlynetsalary','dailyworkhours','annualbonus']);
const aggregateOps = new Set(['sum','avg','average','count','min','max','distinct','distinctcount','countdistinct','median','percent']);
class ValidationError extends Error {}

type CachePolicy = { maxAge: number; staleWhileRevalidate: number };
const edgeCache = (globalThis as typeof globalThis & { caches?: { default?: Cache } }).caches?.default;
const requestWindows = new Map<string, { startedAt: number; count: number }>();
const rateWindows = { read: { limit: 120, windowMs: 60_000 }, write: { limit: 12, windowMs: 60_000 } };

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...headers } });
const problem = (status: number, title: string, detail: string) => json({ type: 'about:blank', title, status, detail }, status);

function cachePolicy(path: string): CachePolicy | null {
  if (path === '/options' || path === '/read-rows/filter-options') return { maxAge: 300, staleWhileRevalidate: 60 };
  if (path === '/read-rows' || path === '/read-rows/summary') return { maxAge: 20, staleWhileRevalidate: 60 };
  if (/^\/[0-9a-f-]{36}$/i.test(path)) return { maxAge: 30, staleWhileRevalidate: 60 };
  return null;
}

function clientKey(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

function allowRequest(request: Request): boolean {
  const policy = request.method === 'POST' ? rateWindows.write : rateWindows.read;
  const key = `${policy === rateWindows.write ? 'write' : 'read'}:${clientKey(request)}`;
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= policy.windowMs) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    if (requestWindows.size > 5000) requestWindows.delete(requestWindows.keys().next().value as string);
    return true;
  }
  current.count += 1;
  return current.count <= policy.limit;
}

function applySecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Referrer-Policy', 'no-referrer');
  return secured;
}

async function readCached(request: Request, policy: CachePolicy | null): Promise<Response | null> {
  if (!edgeCache || !policy || request.method !== 'GET') return null;
  const cached = await edgeCache.match(request);
  return cached ? new Response(cached.body, cached) : null;
}

async function writeCached(request: Request, response: Response, policy: CachePolicy | null): Promise<void> {
  if (!edgeCache || !policy || request.method !== 'GET' || !response.ok) return;
  await edgeCache.put(request, response.clone());
}

function corsOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  if (origin === env.ALLOWED_ORIGIN) return origin;
  if (env.ENVIRONMENT === 'development' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function withCors(response: Response, origin: string | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function value(search: URLSearchParams, name: string): string | undefined {
  const result = search.get(name)?.trim();
  if (result && result.length > 200) throw new ValidationError(`${name} cannot exceed 200 characters`);
  return result || undefined;
}

function filters(search: URLSearchParams): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, input: unknown) => { params.push(input); clauses.push(sql.replace('?', `$${params.length}`)); };
  for (const field of textFilters) {
    const input = value(search, field);
    if (input) add(`${columnByField[field.toLowerCase()]} = ?`, input);
  }
  const ranges: Array<[string,string,string]> = [
    ['minExperience','YearsOfExperience','>='],['maxExperience','YearsOfExperience','<='],
    ['minSalary','MonthlyNetSalary','>='],['maxSalary','MonthlyNetSalary','<='],
    ['minDailyWorkHours','DailyWorkHours','>='],['maxDailyWorkHours','DailyWorkHours','<=']
  ];
  for (const [name, column, op] of ranges) {
    const raw = search.get(name); if (raw === null || raw === '') continue;
    const number = Number(raw); if (!Number.isFinite(number) || number < 0 || (name.includes('Daily') && number > 24)) throw new ValidationError(`${name} is invalid`);
    add(`"${column}" ${op} ?`, number);
  }
  const pairs: Array<[string,string]> = [['minExperience','maxExperience'],['minSalary','maxSalary'],['minDailyWorkHours','maxDailyWorkHours']];
  for (const [minimum,maximum] of pairs) if (search.has(minimum) && search.has(maximum) && Number(search.get(minimum)) > Number(search.get(maximum))) throw new ValidationError(`${minimum}/${maximum} range is invalid`);
  const searchText = value(search, 'search');
  if (searchText) {
    params.push(`%${searchText.replace(/[\\%_]/g, '\\$&')}%`);
    clauses.push(`concat_ws(' ', "Discipline", "Country", "City", "CompanyType", "WorkMode", "Currency") ILIKE $${params.length} ESCAPE '\\'`);
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

function dbRow(row: Row): Row {
  const output: Row = {};
  const numericFields = new Set([
    'yearsOfExperience', 'monthlyNetSalary', 'dailyWorkHours', 'totalReports',
    'averageMonthlyNetSalary', 'minimumMonthlyNetSalary', 'maximumMonthlyNetSalary',
    'count', 'total'
  ]);
  for (const [key, item] of Object.entries(row)) {
    const camelKey = key[0].toLowerCase() + key.slice(1);
    output[camelKey] = numericFields.has(camelKey) && item !== null ? Number(item) : item;
  }
  return output;
}
function publicDetail(row: Row): Row {
  const mapped = dbRow(row);
  delete mapped.requestHash;
  return mapped;
}

async function readRows(request: Request, db: Db): Promise<Response> {
  const url = new URL(request.url); const filtered = filters(url.searchParams);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 100));
  const pageNumber = Math.max(1, Number(url.searchParams.get('pageNumber')) || 1);
  const sort = (url.searchParams.get('sortBy') || 'id').toLowerCase();
  if (!sortFields.has(sort)) throw new ValidationError(`Unsupported sort field '${sort}'`);
  const direction = (url.searchParams.get('sortDirection') || 'desc').toLowerCase();
  if (!['asc','desc'].includes(direction)) throw new ValidationError("Sort direction must be 'asc' or 'desc'");
  const count = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM ${view}${filtered.where}`, filtered.params);
  const params = [...filtered.params, pageSize, (pageNumber - 1) * pageSize];
  const items = await db.query(`SELECT * FROM ${view}${filtered.where} ORDER BY ${columnByField[sort]} ${direction.toUpperCase()}, "Id" ${direction.toUpperCase()} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  const totalCount = Number(count[0]?.total ?? 0);
  return json({ items: items.map(dbRow), totalCount, pageNumber, pageSize, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) });
}

async function summary(request: Request, db: Db): Promise<Response> {
  const filtered = filters(new URL(request.url).searchParams);
  const scalar = await db.query(`SELECT count(*)::int AS "TotalReports", avg("MonthlyNetSalary") AS "AverageMonthlyNetSalary", min("MonthlyNetSalary") AS "MinimumMonthlyNetSalary", max("MonthlyNetSalary") AS "MaximumMonthlyNetSalary" FROM ${view}${filtered.where}`, filtered.params);
  const breakdown = async (column: string) => (await db.query(`SELECT ${column} AS "Value", count(*)::int AS "Count", avg("MonthlyNetSalary") AS "AverageMonthlyNetSalary" FROM ${view}${filtered.where} GROUP BY ${column} ORDER BY "Count" DESC`, filtered.params)).map(dbRow);
  const [byDiscipline, byCountry, byExperience] = await Promise.all([breakdown('"Discipline"'), breakdown('"Country"'), breakdown('"YearsOfExperience"::text')]);
  return json({ ...dbRow(scalar[0] ?? {}), byDiscipline, byCountry, byExperience });
}

async function options(db: Db): Promise<Response> {
  const specs: Array<[string,string]> = [
    ['disciplines','Discipline'],['companyTypes','CompanyType'],['cities','City'],['countries','Country'],['workModes','WorkMode'],['currencies','Currency'],
    ['housingProvided','HousingProvided'],['transportationProvided','TransportationProvided'],['annualBonuses','AnnualBonus'],['salaryFairnessOptions','SalaryFairness'],
    ['recommendFieldOptions','RecommendField'],['professionalCertificates','ProfessionalCertificate'],['highestEducations','HighestEducation'],['extraDaysOff','ExtraDayOff'],
    ['monthlyNetSalaries','MonthlyNetSalary'],['yearsOfExperience','YearsOfExperience'],['dailyWorkHours','DailyWorkHours']
  ];
  const result: Row = {};
  const numericOptionColumns = new Set(['MonthlyNetSalary', 'YearsOfExperience', 'DailyWorkHours']);
  await Promise.all(specs.map(async ([key,column]) => {
    result[key] = (await db.query<{ value: unknown }>(`SELECT DISTINCT "${column}" AS value FROM ${view} WHERE "${column}" IS NOT NULL ORDER BY value`))
      .map(x => numericOptionColumns.has(column) ? Number(x.value) : x.value);
  }));
  return json(result);
}

async function filterOptions(request: Request, db: Db): Promise<Response> {
  const url = new URL(request.url); const field = (url.searchParams.get('field') || '').toLowerCase();
  const column = columnByField[field]; if (!column || field === 'id') throw new ValidationError(`Unsupported filter field '${field}'`);
  const filtered = filters(url.searchParams); const params = [...filtered.params];
  const optionSearch = value(url.searchParams, 'optionSearch'); if (optionSearch && optionSearch.length > 100) throw new ValidationError('optionSearch cannot exceed 100 characters');
  let extra = ''; if (optionSearch) { params.push(`%${optionSearch}%`); extra = ` AND ${column}::text ILIKE $${params.length}`; }
  const take = Math.min(500, Math.max(1, Number(url.searchParams.get('take')) || 200)); params.push(take);
  const rows = await db.query<{ value: string }>(`SELECT DISTINCT ${column}::text AS value FROM ${view}${filtered.where || ' WHERE TRUE'}${extra} AND ${column} IS NOT NULL ORDER BY value LIMIT $${params.length}`, params);
  return json(rows.map(row => row.value));
}

async function aggregates(request: Request, db: Db): Promise<Response> {
  const body = await request.json() as { filters?: Record<string, unknown>; scope?: string; aggregates?: Array<{field:string;operation:string;resultKey:string}> };
  if (!['page','filtered','all'].includes(body.scope || '') || !body.aggregates?.length || body.aggregates.length > 32) throw new ValidationError('Invalid aggregate request');
  const resultKeys = body.aggregates.map(item => item.resultKey?.trim().toLowerCase());
  if (resultKeys.some(key => !key || key.length > 80) || new Set(resultKeys).size !== resultKeys.length) throw new ValidationError('Aggregate result keys must be unique and at most 80 characters');
  const filterQuery = new URLSearchParams(); for (const [key,item] of Object.entries(body.filters ?? {})) if (item !== undefined && item !== null) filterQuery.set(key, String(item));
  const filtered = body.scope === 'all' ? { where:'', params:[] } : filters(filterQuery);
  const definitions = body.aggregates.map((aggregate, index) => {
    const field = aggregate.field.toLowerCase(); let op = aggregate.operation.toLowerCase(); if (op === 'average') op='avg'; if (['distinctcount','countdistinct'].includes(op)) op='distinct';
    const column = columnByField[field]; if (!column || !aggregateOps.has(op) || !aggregate.resultKey) throw new ValidationError('Invalid aggregate definition');
    const numeric = ['monthlynetsalary','yearsofexperience','dailyworkhours'].includes(field);
    if (!numeric && !['count','min','max','distinct','percent'].includes(op)) throw new ValidationError('Invalid aggregate operation for text field');
    const expression = op === 'distinct' ? `count(DISTINCT ${column})` : op === 'median' ? `percentile_cont(0.5) WITHIN GROUP (ORDER BY ${column})` : op === 'percent' ? `CASE WHEN count(*)=0 THEN 0 ELSE count(${column})*100.0/count(*) END` : `${op}(${op === 'count' ? '*' : column})`;
    return { expression, field: aggregate.resultKey, operation: op, alias: `a${index}` };
  });
  const scoped = `SELECT * FROM ${view}${filtered.where}`;
  const aggregateQuery = `WITH scoped AS (${scoped}) SELECT count(*)::int AS "__totalRows", ${definitions.map(item => `${item.expression} AS "${item.alias}"`).join(', ')} FROM scoped`;
  const rows = await db.query<Row>(aggregateQuery, filtered.params);
  const row = rows[0] ?? {};
  return json({
    scope: body.scope,
    totalRows: Number(row.__totalRows ?? row.total ?? 0),
    aggregates: definitions.map(item => ({
      field: item.field,
      operation: item.operation,
      value: row[item.alias] ?? (definitions.length === 1 ? row.value : null) ?? null
    }))
  });
}

const createFields = ['country','city','discipline','yearsOfExperience','companyType','workMode','currency','monthlyNetSalary','housingProvided','transportationProvided','annualBonus','salaryFairness','recommendField','negotiationAdvice','professionalCertificate','benefits','highestEducation','dailyWorkHours','extraDayOff'];
const childTables: Record<string,string> = {
  country:'SalaryReportCountries', city:'SalaryReportCities', discipline:'SalaryReportDisciplines', yearsOfExperience:'SalaryReportYearsOfExperience',
  companyType:'SalaryReportCompanyTypes', workMode:'SalaryReportWorkModes', currency:'SalaryReportCurrencies', monthlyNetSalary:'SalaryReportMonthlyNetSalaries',
  housingProvided:'SalaryReportHousing', transportationProvided:'SalaryReportTransportation', annualBonus:'SalaryReportAnnualBonuses', salaryFairness:'SalaryReportSalaryFairness',
  recommendField:'SalaryReportFieldRecommendations', negotiationAdvice:'SalaryReportNegotiationAdvice', professionalCertificate:'SalaryReportProfessionalCertificates',
  benefits:'SalaryReportBenefits', highestEducation:'SalaryReportEducations', dailyWorkHours:'SalaryReportDailyWorkHours', extraDayOff:'SalaryReportAdditionalDaysOff'
};
function validateCreate(body: Row): void {
  const max: Record<string,number> = { country:100,city:100,discipline:120,companyType:120,workMode:80,benefits:600,housingProvided:80,transportationProvided:80,annualBonus:80,salaryFairness:80,recommendField:80,negotiationAdvice:1000,professionalCertificate:120,highestEducation:120,extraDayOff:80 };
  for (const required of ['country','city','discipline','companyType','workMode','currency']) if (typeof body[required] !== 'string' || !String(body[required]).trim()) throw new ValidationError(`${required} is required`);
  for (const [field,limit] of Object.entries(max)) if (body[field] != null && (typeof body[field] !== 'string' || String(body[field]).length > limit)) throw new ValidationError(`${field} is invalid`);
  if (!/^[A-Za-z]{3}$/.test(String(body.currency))) throw new ValidationError('currency must be a 3-letter ISO code');
  if (!Number.isInteger(body.yearsOfExperience) || Number(body.yearsOfExperience)<0 || Number(body.yearsOfExperience)>60) throw new ValidationError('yearsOfExperience is invalid');
  if (typeof body.monthlyNetSalary !== 'number' || body.monthlyNetSalary<=0 || body.monthlyNetSalary>10_000_000) throw new ValidationError('monthlyNetSalary is invalid');
  if (body.dailyWorkHours != null && (typeof body.dailyWorkHours !== 'number' || body.dailyWorkHours<0 || body.dailyWorkHours>24)) throw new ValidationError('dailyWorkHours is invalid');
}
async function create(request: Request, db: Db): Promise<Response> {
  const key = request.headers.get('Idempotency-Key')?.trim() || '';
  if (!/^[A-Za-z0-9_.:-]{16,100}$/.test(key)) throw new ValidationError('A valid Idempotency-Key header between 16 and 100 characters is required.');
  const body = await request.json() as Row;
  validateCreate(body);
  const canonical = JSON.stringify(Object.fromEntries(createFields.map(field => [field, body[field] ?? null])));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const existing = await db.query(`SELECT v.*, r."SubmittedAt", i."RequestHash" FROM "SalarySubmissionIdempotencyRecords" i JOIN "SalaryReports" r ON r."Id"=i."SalaryReportId" JOIN ${view} v ON v."Id"=r."Id" WHERE i."Key"=$1`, [key]);
  if (existing.length) {
    if (existing[0].RequestHash !== hash) return problem(409, 'Idempotency key conflict', 'The idempotency key was already used for a different request.');
    return json(publicDetail(existing[0]), 200, { 'Idempotent-Replay': 'true' });
  }
  const id = crypto.randomUUID();
  const values = [id,new Date().toISOString().slice(0,10),...createFields.map(field => body[field] ?? null),key,hash];
  const ctes = [`root AS (INSERT INTO "SalaryReports" ("Id","SubmittedAt","Status") VALUES ($1,$2,'Published') RETURNING "Id")`];
  createFields.forEach((field,index) => ctes.push(`f${index} AS (INSERT INTO "${childTables[field]}" ("SalaryReportId","Value") SELECT "Id", $${index+3} FROM root RETURNING "SalaryReportId")`));
  ctes.push(`idem AS (INSERT INTO "SalarySubmissionIdempotencyRecords" ("Key","RequestHash","SalaryReportId","CreatedAt") SELECT $${createFields.length+3}, $${createFields.length+4}, "Id", now() FROM root RETURNING "SalaryReportId")`);
  try { await db.query(`WITH ${ctes.join(', ')} SELECT "SalaryReportId" FROM idem`, values); }
  catch (error) {
    if (String(error).toLowerCase().includes('unique')) {
      const replay = await db.query(`SELECT v.*, r."SubmittedAt", i."RequestHash" FROM "SalarySubmissionIdempotencyRecords" i JOIN "SalaryReports" r ON r."Id"=i."SalaryReportId" JOIN ${view} v ON v."Id"=r."Id" WHERE i."Key"=$1`, [key]);
      if (replay[0]?.RequestHash === hash) return json(publicDetail(replay[0]),200,{'Idempotent-Replay':'true'});
      return problem(409,'Idempotency key conflict','The idempotency key was already used for a different request.');
    }
    throw error;
  }
  const detail = { id, ...Object.fromEntries(createFields.map(field => [field, body[field] ?? null])), submittedAt: new Date().toISOString().slice(0,10) };
  return json(detail, 201, { Location: `/api/salary-reports/${id}` });
}

async function detail(id: string, db: Db): Promise<Response> {
  const rows = await db.query(`SELECT v.*, s."SubmittedAt" FROM ${view} v JOIN "SalaryReports" s ON s."Id"=v."Id" WHERE v."Id"=$1`, [id]);
  return rows.length ? json(dbRow(rows[0])) : new Response(null, { status: 404 });
}

export function createApp(dbFactory: (env: Env) => Db = createDb) {
  return { async fetch(request: Request, env: Env): Promise<Response> {
    const origin = corsOrigin(request, env);
    if (request.method === 'OPTIONS') {
      if (request.headers.get('Origin') && !origin) return new Response(null, { status: 403 });
      return withCors(new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods':'GET,POST,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type,Idempotency-Key', 'Access-Control-Max-Age':'86400' } }), origin);
    }
    try {
      const url = new URL(request.url);
      if (request.method==='GET' && (url.pathname==='/health/live' || url.pathname==='/health/ready')) return withCors(json({status:'Healthy'}),origin);
      const prefix='/api/salary-reports'; if (!url.pathname.startsWith(prefix)) return new Response(null,{status:404});
      if (!allowRequest(request)) return withCors(problem(429, 'Too Many Requests', 'Request rate limit exceeded. Please retry shortly.'), origin);
      const path=url.pathname.slice(prefix.length)||'/';
      const policy = cachePolicy(path);
      const cached = await readCached(request, policy);
      if (cached) return withCors(applySecurityHeaders(cached), origin);
      const db=dbFactory(env); let response: Response;
      if (request.method==='GET' && path==='/read-rows') response=await readRows(request,db);
      else if (request.method==='GET' && path==='/read-rows/summary') response=await summary(request,db);
      else if (request.method==='POST' && path==='/read-rows/aggregates') response=await aggregates(request,db);
      else if (request.method==='GET' && path==='/read-rows/filter-options') response=await filterOptions(request,db);
      else if (request.method==='GET' && path==='/options') response=await options(db);
      else if (request.method==='POST' && path==='/') response=await create(request,db);
      else if (request.method==='GET' && /^\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(path)) response=await detail(path.slice(1),db);
      else response=new Response(null,{status:404});
      const secured = applySecurityHeaders(response);
      if (policy && response.ok) {
        secured.headers.set('Cache-Control', `public, max-age=0, s-maxage=${policy.maxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`);
        secured.headers.set('Vary', 'Origin');
        await writeCached(request, secured, policy);
      }
      return withCors(secured, origin);
    } catch (error) {
      console.error('Request failed', error);
      const response = error instanceof ValidationError ? problem(400,'Validation error',error.message) : problem(500,'Internal Server Error','An unexpected error occurred.');
      return withCors(response, origin);
    }
  }};
}

export default createApp();
