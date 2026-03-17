import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_TABLES = new Set([
  'groups', 'companies', 'users', 'usercompanyaccess', 'usergroupaccess',
  'reports', 'forecasts', 'logs'
]);

const SYSTEM_PARAMS = new Set([
  '_t', 'fields', 'limit', 'offset', 'cache', 'field', 'value', 'table'
]);

const SAFE_ID = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const ALLOWED_ORIGINS = ['https://financehub.attentio.no'];

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function isAuthorized(req: VercelRequest): boolean {
  const secretKey = process.env.API_SECRET_KEY;
  if (!secretKey) return true;
  return req.headers.authorization === `Bearer ${secretKey}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const table = req.query.table as string;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: `Invalid table: ${table}` });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    switch (req.method) {
      case 'GET':    return await handleGet(req, res, sql, table);
      case 'POST':   return await handlePost(req, res, sql, table);
      case 'PATCH':  return await handlePatch(req, res, sql, table);
      case 'DELETE': return await handleDelete(req, res, sql, table);
      default:       return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error(`[API] ${req.method} /${table} error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  sql: any,
  table: string
) {
  const q = req.query;
  const limit = Math.min(parseInt(q.limit as string || '500'), 2000);
  const offset = parseInt(q.offset as string || '0');

  const rawFields = q.fields ? (q.fields as string).split(',') : [];
  const fields = rawFields.filter(f => SAFE_ID.test(f));

  const whereParams: any[] = [];
  const whereClauses: string[] = [];

  for (const [key, value] of Object.entries(q)) {
    if (SYSTEM_PARAMS.has(key)) continue;
    if (!SAFE_ID.test(key)) continue;
    whereParams.push(value);
    whereClauses.push(`"${key}" = $${whereParams.length}`);
  }

  const selectClause = fields.length ? fields.map(f => `"${f}"`).join(', ') : '*';
  const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const dataSql = `SELECT ${selectClause} FROM "${table}" ${whereClause} LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`;
  const countSql = `SELECT COUNT(*)::int AS total FROM "${table}" ${whereClause}`;

  const [rows, countResult] = await Promise.all([
    sql(dataSql, [...whereParams, limit, offset]),
    sql(countSql, whereParams),
  ]);

  const total = countResult[0]?.total ?? 0;

  return res.json({
    rows,
    total,
    count: rows.length,
    limit,
    offset,
    hasMore: offset + rows.length < total,
  });
}

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  sql: any,
  table: string
) {
  const items: any[] = Array.isArray(req.body) ? req.body : [req.body];
  if (items.length === 0) return res.json({ inserted: [], insertedCount: 0 });

  const inserted: any[] = [];
  for (const item of items) {
    const keys = Object.keys(item).filter(k => SAFE_ID.test(k));
    if (keys.length === 0) continue;
    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => item[k]);

    const result = await sql(
      `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    if (result[0]) inserted.push(result[0]);
  }

  return res.json({ inserted, insertedCount: inserted.length });
}

async function handlePatch(
  req: VercelRequest,
  res: VercelResponse,
  sql: any,
  table: string
) {
  const body = req.body;
  const items: Array<{ id: any; fields: Record<string, any> }> = Array.isArray(body)
    ? body.map(i => ({ id: i.id, fields: i.fields ?? {} }))
    : [{ id: body.id, fields: body.data ?? body.fields ?? {} }];

  const updated: any[] = [];
  for (const { id, fields } of items) {
    if (id == null) continue;
    const keys = Object.keys(fields).filter(k => SAFE_ID.test(k) && k !== 'id');
    if (keys.length === 0) continue;

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = [id, ...keys.map(k => fields[k])];

    const result = await sql(
      `UPDATE "${table}" SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );
    if (result[0]) updated.push(result[0]);
  }

  return res.json({ rows: updated, updatedCount: updated.length, mode: 'update' });
}

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  sql: any,
  table: string
) {
  const field = (req.query.field as string) || 'id';
  const value = req.query.value;

  if (!SAFE_ID.test(field)) {
    return res.status(400).json({ error: 'Invalid field name' });
  }

  const result = await sql(
    `DELETE FROM "${table}" WHERE "${field}" = $1 RETURNING id`,
    [value]
  );

  return res.json({ deleted: result.length, ids: result.map((r: any) => r.id) });
}
