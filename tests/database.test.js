import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL enforces ownership, verification, renewal and expiry end to end', async () => {
  const pg = await PGlite.create();
  try {
    // Supabase auth schema contract; no real identity or production DB is used.
    await pg.exec(`create role anon nologin; create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin end $$;`);
    const migrations=new URL('../supabase/migrations/',import.meta.url);
    for(const file of (await readdir(migrations)).filter(name=>name.endsWith('.sql')).sort()) await pg.exec(await readFile(new URL(file,migrations),'utf8'));
    const outcomes = await pg.exec(await readFile(new URL('./commerce-security.sql',import.meta.url),'utf8'));
    assert.match(outcomes.at(-1).rows[0].result,/^PASS:/);
    const { rows } = await pg.query('select count(*)::int as n from auth.users');
    assert.equal(rows[0].n,0,'test identities are rolled back');
  } finally { await pg.close(); }
});
