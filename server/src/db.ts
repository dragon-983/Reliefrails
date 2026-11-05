import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

const connectionString =
  process.env.NODE_ENV === 'test' ? config.databaseTestUrl : config.databaseUrl;

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export interface QueryOptions {
  wallet?: string;
  role?: string;
}

/**
 * Execute a query with optional wallet/role session variables for Row-Level Security
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: any[] = [],
  options?: QueryOptions
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    if (options?.wallet) {
      await client.query(
        `SELECT set_config('app.current_wallet', $1, true), set_config('app.current_role', $2, true)`,
        [options.wallet, options.role || 'user']
      );
    }
    const res = await client.query<T>(text, params);
    return res;
  } finally {
    client.release();
  }
}

/**
 * Execute a transactional block with RLS wallet session context
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
  options?: QueryOptions
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (options?.wallet) {
      await client.query(
        `SELECT set_config('app.current_wallet', $1, true), set_config('app.current_role', $2, true)`,
        [options.wallet, options.role || 'user']
      );
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
