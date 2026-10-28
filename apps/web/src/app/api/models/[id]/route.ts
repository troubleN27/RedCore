import { getDb } from '@redcore/db';
import { getStoredModel } from '@redcore/services';

export const runtime = 'nodejs';

/** Своя модель из базы (режим без R2). Файл неизменяем — у новой загрузки новый id. */
export async function GET(_request: Request, { params }: RouteContext<'/api/models/[id]'>) {
  const { id } = await params;
  const model = await getStoredModel(await getDb(), id);
  if (!model?.data) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(model.data), {
    headers: {
      'Content-Type': 'model/gltf-binary',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${model.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    },
  });
}
