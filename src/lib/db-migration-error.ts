/** True when Supabase/Postgres reports a missing column (migration not applied). */
export function isDbMigrationRequiredError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const msg = error.message || '';
  return /column/i.test(msg) && /does not exist/i.test(msg);
}
