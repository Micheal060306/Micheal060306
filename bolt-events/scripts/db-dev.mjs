// Runs a real local PostgreSQL server for development (no installation needed).
// Data is kept in .pgdata. Stop with Ctrl+C. Windows, macOS and Linux.
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.PGDEV_PORT ?? 54329);
const pgsql = new EmbeddedPostgres({
  databaseDir: process.env.PGDEV_DIR ?? './.pgdata', user: 'postgres', password: 'postgres', port, persistent: true,
  // listen on loopback only; these credentials are for local development
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], initdbFlags: ['--encoding=UTF8', '--locale=C'],
});
if (!existsSync(`${process.env.PGDEV_DIR ?? './.pgdata'}/PG_VERSION`)) await pgsql.initialise();
await pgsql.start();
for (const name of ['bolt_events', 'bolt_test']) try { await pgsql.createDatabase(name); } catch { /* exists */ }
console.log(`PostgreSQL ready on 127.0.0.1:${port}`);
const stop = async () => { await pgsql.stop(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
