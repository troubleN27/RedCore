# Лицензии ассетов RedCore

Файл генерируется командой `pnpm assets:report` — не редактируйте вручную.

## Используются на сайте

| Ассет | Автор | Лицензия | Источник | Изменения |
| --- | --- | --- | --- | --- |
| MSI RTX 3080 Gaming X Trio | meu9MM98 | CC BY 4.0 | https://sketchfab.com/3d-models/e5356746dcec48f9868164bb9674ab9a | прорежение до 40000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| NVIDIA RTX 3070 | DatSketch | CC BY 4.0 | https://sketchfab.com/3d-models/29da4e10eb6c427cb72f3ebdf822f89e | прорежение до 40000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| ROG Strix X370-F | MUSHROOM_BUILDS | CC BY 4.0 | https://sketchfab.com/3d-models/56bd8923fdf341fd8d81b717055a61dd | прорежение до 60000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| AMD Ryzen 7 7800X3D | gioguarino12 | CC BY 4.0 | https://sketchfab.com/3d-models/209c4aada00e4b1790d8d274bac98779 | прорежение до 24000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| INTEL CPU | KuatEntralla3D | CC BY 4.0 | https://sketchfab.com/3d-models/ec11f729b05848488522ba6f8c6f254f | прорежение до 8000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| Corsair Dominator RGB | MG990 | CC BY 4.0 | https://sketchfab.com/3d-models/8995a60d2dcc46b3be14c35c1c016c0a | прорежение до 20000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| Corsair Vengeance LPX | supahot | CC BY 4.0 | https://sketchfab.com/3d-models/ee11e1926e514075a70642ecb5dc5c2d | прорежение до 5000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| Samsung 990 Pro | lime.ball.animations.official | CC BY 4.0 | https://sketchfab.com/3d-models/41b7bfda7eab40f8b13330913fd66fc2 | прорежение до 2000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| SSD NoName SATA | hlupich | CC BY 4.0 | https://sketchfab.com/3d-models/5a182a80361f407e965adaaee077e3cd | прорежение до 4000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| WD Green 1TB | MG990 | CC BY 4.0 | https://sketchfab.com/3d-models/e9244f56e0724dd097570e29bae4b7c6 | прорежение до 20000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| PSU Power Supply Unit | Groovex | CC BY 4.0 | https://sketchfab.com/3d-models/69ccd1be3a77497cb2acc9e39e7c52b3 | прорежение до 12000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| Lian Li UNI FAN SL120 RGB Black | DIEKO | CC BY 4.0 | https://sketchfab.com/3d-models/5abd0d8e89ea4241b7216f4b6d5a2ca4 | прорежение до 4600 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| Fractal Design Meshify C | MUSHROOM_BUILDS | CC BY 4.0 | https://sketchfab.com/3d-models/a46526af2ac84fa098edc3f01c012450 | прорежение до 60000 треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов |
| Inter (PDF и OG-картинки) | Rasmus Andersson | SIL Open Font License 1.1 | https://github.com/rsms/inter | без изменений, файлы WOFF из пакета inter-ui |
| Unbounded (заголовки) | NaN Studio | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Unbounded | без изменений, подключается через next/font |
| JetBrains Mono (характеристики) | JetBrains | SIL Open Font License 1.1 | https://github.com/JetBrains/JetBrainsMono | без изменений, подключается через next/font |
| detect-gpu — бенчмарки видеокарт для выбора качества 3D | pmndrs | MIT | https://github.com/pmndrs/detect-gpu | копия JSON в public/detect-gpu |

Процедурные 3D-модели (корпуса, платы, кулеры, СЖО, мониторы, периферия) созданы в коде проекта.
Освещение сцены — процедурное (лайтформеры), внешних HDRI нет.

## Ожидают скачивания (CC BY 4.0)

Положите GLB в `tooling/3d/raw/<ключ>/model.glb` или задайте `SKETCHFAB_API_TOKEN` и выполните `pnpm assets:fetch && pnpm assets:build`.

| Ключ | Модель | Автор | Ссылка |
| --- | --- | --- | --- |
