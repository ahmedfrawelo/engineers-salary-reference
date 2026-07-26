import { describe, expect, it } from 'vitest';
import { createApp } from '../src/index';
import type { Db, Env, Row } from '../src/types';

const env: Env = { DATABASE_URL:'postgres://unused', ALLOWED_ORIGIN:'https://engineers-salary-reference.pages.dev', ENVIRONMENT:'production' };
const app = (handler: (sql:string,params:unknown[])=>Row[]) => createApp(():Db => ({ async query<T extends Row>(text:string,params:unknown[]=[]):Promise<T[]> { return handler(text,params) as T[]; } }));
const request = (path:string, init?:RequestInit) => new Request(`https://api.example${path}`,init);

describe('salary worker contract', () => {
  it('returns the paged read-row envelope and parameterizes filters', async () => {
    const sql:string[]=[]; const worker=app(text=>{sql.push(text); return text.includes('count(*)')?[{total:1}]:[{Id:'11111111-1111-1111-1111-111111111111',Discipline:'Civil',MonthlyNetSalary:1000}];});
    const response=await worker.fetch(request('/api/salary-reports/read-rows?discipline=Civil&pageSize=6'),env);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({totalCount:1,pageSize:6,items:[{discipline:'Civil',monthlyNetSalary:1000}]});
    expect(sql.join('\n')).toContain('"Discipline" = $1');
  });

  it('sorts read rows by submittedAt for latest dashboard reports', async () => {
    const sql:string[]=[]; const worker=app(text=>{sql.push(text); return text.includes('count(*)')?[{total:1}]:[{Id:'11111111-1111-1111-1111-111111111111',SubmittedAt:'2026-07-25',Discipline:'Civil',MonthlyNetSalary:1000}];});
    const response=await worker.fetch(request('/api/salary-reports/read-rows?pageSize=10&sortBy=submittedAt&sortDirection=desc'),env);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({items:[{submittedAt:'2026-07-25'}]});
    expect(sql.join('\n')).toContain('ORDER BY s."SubmittedAt" DESC, v."Id" DESC');
  });

  it('maps aggregate resultKey into response field', async () => {
    const worker=app(text=>text.includes('__totalRows')?[{__totalRows:4,a0:1250}]:[]);
    const response=await worker.fetch(request('/api/salary-reports/read-rows/aggregates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filters:{currency:'EGP'},scope:'filtered',aggregates:[{field:'monthlyNetSalary',operation:'median',resultKey:'medianSalary'}]})}),env);
    expect(await response.json()).toEqual({scope:'filtered',totalRows:4,aggregates:[{field:'medianSalary',operation:'median',value:1250}]});
  });

  it('requires a valid idempotency key for create', async () => {
    const response=await app(()=>[]).fetch(request('/api/salary-reports',{method:'POST',body:'{}'}),env);
    expect(response.status).toBe(400); expect(await response.text()).toContain('Idempotency-Key');
  });

  it('hides the data cleanup endpoint when no cleanup token is configured', async () => {
    const response=await app(()=>{throw new Error('database must not be queried for disabled cleanup');}).fetch(request('/api/salary-reports/admin/data-cleanup/discipline',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),env);
    expect(response.status).toBe(404);
  });

  it('previews discipline cleanup mappings without updating data', async () => {
    const sql:string[]=[]; const params:unknown[][]=[];
    const worker=app((text,input)=>{
      sql.push(text); params.push(input);
      return [{original:'AGRICULTURE',canonical:'Agricultural Engineering',count:3}];
    });
    const response=await worker.fetch(request('/api/salary-reports/admin/data-cleanup/discipline',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer cleanup-token'},body:JSON.stringify({mode:'dryRun',mappings:[{original:'AGRICULTURE',canonical:'Agricultural Engineering'}]})}),{...env,DATA_CLEANUP_TOKEN:'cleanup-token'});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({mode:'dryRun',affectedRows:3,mappings:[{original:'AGRICULTURE',canonical:'Agricultural Engineering',count:3}]});
    expect(sql.join('\n')).toContain('LEFT JOIN "SalaryReportDisciplines"');
    expect(sql.join('\n')).not.toContain('UPDATE "SalaryReportDisciplines"');
    expect(params[0]).toEqual(['AGRICULTURE','Agricultural Engineering']);
  });

  it('previews cleanup mappings for supported text fields', async () => {
    const sql:string[]=[]; const params:unknown[][]=[];
    const worker=app((text,input)=>{
      sql.push(text); params.push(input);
      return [{original:'DRHM',canonical:'AED',count:2}];
    });
    const response=await worker.fetch(request('/api/salary-reports/admin/data-cleanup/text-field',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer cleanup-token'},body:JSON.stringify({field:'currency',mode:'dryRun',mappings:[{original:'DRHM',canonical:'AED'}]})}),{...env,DATA_CLEANUP_TOKEN:'cleanup-token'});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({mode:'dryRun',field:'currencies',table:'SalaryReportCurrencies',affectedRows:2});
    expect(sql.join('\n')).toContain('LEFT JOIN "SalaryReportCurrencies"');
    expect(sql.join('\n')).not.toContain('UPDATE "SalaryReportCurrencies"');
    expect(params[0]).toEqual(['DRHM','AED']);
  });

  it('allows the configured production and local development origins', async () => {
    const worker=app(()=>[]);
    const allowed=await worker.fetch(request('/api/salary-reports/options',{headers:{Origin:env.ALLOWED_ORIGIN}}),env);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
    const denied=await worker.fetch(request('/api/salary-reports/options',{headers:{Origin:'http://localhost:4200'}}),env);
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4200');
    const dev=await worker.fetch(request('/api/salary-reports/options',{headers:{Origin:'http://localhost:4200'}}),{...env,ENVIRONMENT:'development'});
    expect(dev.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4200');
  });

  it('serves probe endpoints without opening a database connection', async () => {
    const response=await app(()=>{throw new Error('database must not be queried');}).fetch(request('/health/live'),env);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({status:'Healthy'});
  });

  it('does not expose unexpected database errors', async () => {
    const response=await app(()=>{throw new Error('postgres password=secret');}).fetch(request('/api/salary-reports/options'),env);
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('password');
  });

  it('normalizes messy discipline options before returning dropdown values', async () => {
    const worker=app(text=>{
      if (text.includes('"Discipline"')) return [
        {value:'AGRICULTURE'},
        {value:'Agriculture Engineer'},
        {value:'Agricultural engineering'},
        {value:'Alexandria'},
        {value:'BMS'},
        {value:'Electrical'}
      ];
      return [];
    });
    const response=await worker.fetch(request('/api/salary-reports/options'),env);
    expect(response.status).toBe(200);
    const body=await response.json() as { disciplines: string[] };
    expect(body.disciplines).toEqual(['Agricultural Engineering','Electrical','Other / Needs Review']);
  });

  it('normalizes messy discipline filter options before returning filter values', async () => {
    const worker=app(text=>{
      if (text.includes('DISTINCT "Discipline"::text')) return [
        {value:'AGRICULTURE'},
        {value:'Agricultural engineering'},
        {value:'Alexandria'},
        {value:'civil'},
        {value:'Civil'}
      ];
      return [];
    });
    const response=await worker.fetch(request('/api/salary-reports/read-rows/filter-options?field=discipline&take=20'),env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(['Agricultural Engineering','Civil','Other / Needs Review']);
  });

  it('normalizes other text filter option fields before returning filter values', async () => {
    const worker=app(text=>{
      if (text.includes('DISTINCT "Currency"::text')) return [{value:'DRHM'},{value:'AED'},{value:'EURO'}];
      if (text.includes('DISTINCT "City"::text')) return [{value:'القاهرة'},{value:'Cairo'},{value:'Alexanderia'}];
      return [];
    });
    const currency=await worker.fetch(request('/api/salary-reports/read-rows/filter-options?field=currency&take=20'),env);
    expect(await currency.json()).toEqual(['AED','EUR']);
    const city=await worker.fetch(request('/api/salary-reports/read-rows/filter-options?field=city&take=20'),env);
    expect(await city.json()).toEqual(['Alexandria','Cairo']);
  });

  it('normalizes remaining review values for company type and discipline filters', async () => {
    const worker=app(text=>{
      if (text.includes('DISTINCT "CompanyType"::text')) return [{value:'Maitenance'},{value:'enegy and oil and gas'},{value:'David'}];
      if (text.includes('DISTINCT "Discipline"::text')) return [{value:'Thecnical'},{value:'management'},{value:'Project management'}];
      return [];
    });
    const companyType=await worker.fetch(request('/api/salary-reports/read-rows/filter-options?field=companyType&take=20'),env);
    expect(await companyType.json()).toEqual(['Maintenance','Oil & Gas','Other / Needs Review']);
    const discipline=await worker.fetch(request('/api/salary-reports/read-rows/filter-options?field=discipline&take=20'),env);
    expect(await discipline.json()).toEqual(['Project Management','Technical Office']);
  });
});
