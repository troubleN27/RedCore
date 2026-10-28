# Лицензии ассетов RedCore

Файл генерируется командой `pnpm assets:report` — не редактируйте вручную.

## Используются на сайте

| Ассет | Автор | Лицензия | Источник | Изменения |
| --- | --- | --- | --- | --- |
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
| `gpu_3fan` | MSI RTX 3080 Gaming X Trio | meu9MM98 | https://sketchfab.com/3d-models/e5356746dcec48f9868164bb9674ab9a |
| `gpu_2fan` | NVIDIA RTX 3070 | DatSketch | https://sketchfab.com/3d-models/29da4e10eb6c427cb72f3ebdf822f89e |
| `mb_atx` | ROG Strix X370-F | MUSHROOM_BUILDS | https://sketchfab.com/3d-models/56bd8923fdf341fd8d81b717055a61dd |
| `cpu_am5` | AMD Ryzen 7 7800X3D | gioguarino12 | https://sketchfab.com/3d-models/209c4aada00e4b1790d8d274bac98779 |
| `cpu_am4` | AM4 CPU | Igor.Jop | https://sketchfab.com/3d-models/912c9c42d2dc40fe95574345aae51ea0 |
| `cpu_intel` | INTEL CPU | KuatEntralla3D | https://sketchfab.com/3d-models/ec11f729b05848488522ba6f8c6f254f |
| `ram_rgb` | Corsair Dominator RGB | MG990 | https://sketchfab.com/3d-models/8995a60d2dcc46b3be14c35c1c016c0a |
| `ram_lowprofile` | Corsair Vengeance LPX | supahot | https://sketchfab.com/3d-models/ee11e1926e514075a70642ecb5dc5c2d |
| `ssd_m2` | Samsung 990 Pro | lime.ball.animations.official | https://sketchfab.com/3d-models/41b7bfda7eab40f8b13330913fd66fc2 |
| `ssd_25` | SSD NoName SATA | hlupich | https://sketchfab.com/3d-models/5a182a80361f407e965adaaee077e3cd |
| `hdd_35` | WD Green 1TB | MG990 | https://sketchfab.com/3d-models/e9244f56e0724dd097570e29bae4b7c6 |
| `psu_atx` | PSU Power Supply Unit | Groovex | https://sketchfab.com/3d-models/69ccd1be3a77497cb2acc9e39e7c52b3 |
| `fan_120` | Lian Li UNI FAN SL120 RGB Black | DIEKO | https://sketchfab.com/3d-models/5abd0d8e89ea4241b7216f4b6d5a2ca4 |
| `case_atx` | Fractal Design Meshify C | MUSHROOM_BUILDS | https://sketchfab.com/3d-models/a46526af2ac84fa098edc3f01c012450 |
