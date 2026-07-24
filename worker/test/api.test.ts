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

  it('maps aggregate resultKey into response field', async () => {
    const worker=app(text=>text.includes('__totalRows')?[{__totalRows:4,a0:1250}]:[]);
    const response=await worker.fetch(request('/api/salary-reports/read-rows/aggregates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filters:{currency:'EGP'},scope:'filtered',aggregates:[{field:'monthlyNetSalary',operation:'median',resultKey:'medianSalary'}]})}),env);
    expect(await response.json()).toEqual({scope:'filtered',totalRows:4,aggregates:[{field:'medianSalary',operation:'median',value:1250}]});
  });

  it('requires a valid idempotency key for create', async () => {
    const response=await app(()=>[]).fetch(request('/api/salary-reports',{method:'POST',body:'{}'}),env);
    expect(response.status).toBe(400); expect(await response.text()).toContain('Idempotency-Key');
  });

  it('allows only the configured production origin', async () => {
    const worker=app(()=>[]);
    const allowed=await worker.fetch(request('/api/salary-reports/options',{headers:{Origin:env.ALLOWED_ORIGIN}}),env);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
    const denied=await worker.fetch(request('/api/salary-reports/options',{headers:{Origin:'http://localhost:4200'}}),env);
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
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
});
