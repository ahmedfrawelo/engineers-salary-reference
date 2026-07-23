import { neon } from '@neondatabase/serverless';
import type { Db, Env, Row } from './types';

export function createDb(env: Env): Db {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sql = neon(env.DATABASE_URL);
  return {
    async query<T extends Row>(text: string, params: unknown[] = []): Promise<T[]> {
      return await sql.query(text, params) as T[];
    }
  };
}
