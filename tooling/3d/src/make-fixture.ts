import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { repoRoot } from './paths';

// Маленькая GLB для E2E загрузки своей модели: коробка 300×120×50 мм с материалом body_*.
const doc = new Document();
const buffer = doc.createBuffer();
const [x, y, z] = [0.15, 0.06, 0.025];
const p = [-x, -y, z, x, -y, z, x, y, z, -x, y, z, -x, -y, -z, x, -y, -z, x, y, -z, -x, y, -z];
const i = [
  0, 1, 2, 0, 2, 3, 1, 5, 6, 1, 6, 2, 5, 4, 7, 5, 7, 6, 4, 0, 3, 4, 3, 7, 3, 2, 6, 3, 6, 7, 4, 5, 1,
  4, 1, 0,
];
const prim = doc
  .createPrimitive()
  .setAttribute(
    'POSITION',
    doc.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buffer),
  )
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(i)).setBuffer(buffer))
  .setMaterial(doc.createMaterial('body_Shell').setBaseColorFactor([0.1, 0.1, 0.1, 1]));
doc
  .createScene('scene')
  .addChild(doc.createNode('box').setMesh(doc.createMesh('box').addPrimitive(prim)));
const file = path.join(repoRoot, 'e2e', 'fixtures', 'box.glb');
writeFileSync(file, await new NodeIO().writeBinary(doc));
console.log(file);
