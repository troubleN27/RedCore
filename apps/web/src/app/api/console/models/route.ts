import { getDb } from '@redcore/db';
import { attachModel, inspectGlb, ModelValidationError, r2ConfigFromEnv } from '@redcore/services';
import { revalidatePath } from 'next/cache';
import { notFound, staffForApi } from '@/server/console-api';
import { audit } from '@/server/staff';

export const runtime = 'nodejs';

/**
 * Загрузка своей GLB без R2 (dev, демо): файл приходит multipart и хранится в базе.
 * С настроенным R2 этот путь закрыт — браузер грузит напрямую по presigned-ссылке.
 */
export async function POST(request: Request) {
  const staff = await staffForApi('products');
  if (!staff) return notFound();
  if (r2ConfigFromEnv()) return Response.json({ error: 'use_presign' }, { status: 409 });

  const form = await request.formData();
  const productId = String(form.get('productId') ?? '');
  const file = form.get('file');
  if (!/^[0-9a-f-]{36}$/.test(productId) || !(file instanceof File)) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const report = await inspectGlb(bytes);
    const result = await attachModel(await getDb(), {
      productId,
      filename: file.name,
      bytes,
      report,
      uploadedBy: staff.id,
    });
    await audit({ id: staff.id, login: staff.login }, 'product.model3d', 'product', productId, {
      filename: file.name,
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
