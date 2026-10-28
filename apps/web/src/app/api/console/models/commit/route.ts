import { getDb } from '@redcore/db';
import { attachModel, inspectGlb, ModelValidationError, r2ConfigFromEnv } from '@redcore/services';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { notFound, staffForApi } from '@/server/console-api';
import { audit } from '@/server/staff';

export const runtime = 'nodejs';

const bodySchema = z.object({
  productId: z.uuid(),
  filename: z.string().min(1).max(200),
  publicUrl: z.url(),
});

/** После загрузки в R2: сервер скачивает файл, проверяет его и привязывает к товару. */
export async function POST(request: Request) {
  const staff = await staffForApi('products');
  if (!staff) return notFound();
  const config = r2ConfigFromEnv();
  if (!config) return Response.json({ error: 'r2_disabled' }, { status: 409 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  // Только файлы нашего бакета: не даём подсунуть произвольный URL
  if (!parsed.success || !parsed.data.publicUrl.startsWith(`${config.publicUrl}/models/`)) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }
  const { productId, filename, publicUrl } = parsed.data;
  const response = await fetch(publicUrl);
  if (!response.ok) return Response.json({ error: 'not_uploaded' }, { status: 400 });
  try {
    const report = await inspectGlb(new Uint8Array(await response.arrayBuffer()));
    const result = await attachModel(await getDb(), {
      productId,
      filename,
      r2PublicUrl: publicUrl,
      report,
      uploadedBy: staff.id,
    });
    await audit({ id: staff.id, login: staff.login }, 'product.model3d', 'product', productId, {
      filename,
      storage: 'r2',
      sizeBytes: report.sizeBytes,
      triangles: report.triangles,
    });
    revalidatePath('/[locale]/p/[slug]', 'page');
    return Response.json({ ok: true, url: result.url, report });
  } catch (error) {
    if (error instanceof ModelValidationError)
      return Response.json({ error: error.reason }, { status: 422 });
    throw error;
  }
}
