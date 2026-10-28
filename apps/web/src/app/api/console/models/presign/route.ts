import { presignModelUpload, r2ConfigFromEnv } from '@redcore/services';
import { z } from 'zod';
import { notFound, staffForApi } from '@/server/console-api';

export const runtime = 'nodejs';

const bodySchema = z.object({
  filename: z.string().min(1).max(200),
  size: z.number().int().positive().max(15_000_000),
});

/** Ссылка для прямой загрузки GLB в Cloudflare R2 (действует 10 минут). */
export async function POST(request: Request) {
  const staff = await staffForApi('products');
  if (!staff) return notFound();
  const config = r2ConfigFromEnv();
  if (!config) return Response.json({ error: 'r2_disabled' }, { status: 409 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  return Response.json(await presignModelUpload(config, parsed.data.filename));
}
