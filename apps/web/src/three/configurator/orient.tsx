'use client';

import type { Orientation, Placement } from '@redcore/domain';
import type { ReactNode } from 'react';
import type { PartMaterials } from '../materials';
import { AioPump, AioRadiator, ProceduralModel } from '../parts/procedural';

const HALF = Math.PI / 2;

/**
 * Повороты из осей процедурной модели в оси корпуса (+X — к передней панели, +Y — вверх,
 * +Z — к стеклу). Плоские детали платы построены «лицом вверх» и поворачиваются лицом к +Z;
 * видеокарта — разъёмом к плате и вентиляторами вниз; память — длиной вдоль платы.
 */
export function Orient({
  orientation,
  children,
}: {
  orientation: Orientation;
  children: ReactNode;
}) {
  switch (orientation) {
    case 'board':
    case 'gpu':
    case 'tower':
    case 'pump':
      return <group rotation={[HALF, 0, 0]}>{children}</group>;
    case 'dimm':
      return (
        <group rotation={[0, 0, HALF]}>
          <group rotation={[HALF, 0, 0]}>{children}</group>
        </group>
      );
    case 'psu':
      return <group rotation={[Math.PI, 0, 0]}>{children}</group>;
    case 'fan-front':
    case 'fan-rear':
      return <group rotation={[0, HALF, 0]}>{children}</group>;
    case 'fan-top':
      return <group rotation={[HALF, 0, 0]}>{children}</group>;
    case 'radiator-top':
    case 'flat':
      return <>{children}</>;
  }
}

/** Деталь сборки в осях корпуса: у СЖО помпа и радиатор рисуются отдельно. */
export function PlacedModel({ placement, m }: { placement: Placement; m: PartMaterials }) {
  const { spec, part, orientation } = placement;
  let body: ReactNode;
  if (spec.kind === 'cooler-aio' && part === 'pump') body = <AioPump spec={spec} m={m} />;
  else if (spec.kind === 'cooler-aio' && part === 'radiator')
    body = <AioRadiator spec={spec} m={m} />;
  else body = <ProceduralModel spec={spec} m={m} />;
  return <Orient orientation={orientation}>{body}</Orient>;
}
