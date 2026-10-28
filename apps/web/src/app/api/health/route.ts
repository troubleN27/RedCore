import { NextResponse } from 'next/server';

// Проверка живости для мониторинга и деплоя: сайт отвечает, БД доступна.
// db: neon — подключён Neon; local — встроенный PGlite с демо-данными (DATABASE_URL не задан).
export async function GET() {
  const startedAt = performance.now();
  try {
    const { databaseMode, getDb, sql } = await import('@redcore/db');
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      db: databaseMode(),
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    console.error('[health] database check failed', error);
    return NextResponse.json({ ok: false, db: 'error' }, { status: 503 });
  }
}
