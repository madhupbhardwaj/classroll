import pg from 'pg';
pg.types.setTypeParser(20, value => Number(value));
const globalPg = globalThis as unknown as { classrollPool?: pg.Pool };
function pool() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
 return globalPg.classrollPool ??= new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:20000});
}
function placeholders(sql:string){let n=0;return sql.replace(/\?/g,()=>'$'+(++n));}
export function db(){return {prepare(sql:string){return {bind(...values:unknown[]){const query=placeholders(sql);return {
 async first<T=Record<string,unknown>>(){const r=await pool().query(query,values);return (r.rows[0] as T)||null},
 async all(){const r=await pool().query(query,values);return {results:r.rows as Record<string,unknown>[]}},
 async run(){const r=await pool().query(query,values);return {meta:{changes:r.rowCount||0}}}
 }}}}}}
