# ¿Tembló en Colombia?

**Español** · [English](README.en.md)

Una página que responde una sola pregunta: **¿tembló en Colombia?** Muestra un mapa de calor y puntos con los sismos de las últimas 24 horas, 7 días o 30 días en Colombia y alrededores, con datos en vivo de la API pública del Servicio Geológico de EE. UU. (USGS).

- Un **«¡SÍ!» o «NO»** grande: solo cuenta los epicentros dentro del contorno de Colombia.
- Mapa propio en SVG (sin teselas ni claves): calor + puntos, color por profundidad, tamaño por magnitud y un «¡RUMBLE!» sobre el más fuerte.
- Los **5 más fuertes**, filtro por magnitud mínima y hora de Bogotá (UTC − 5).
- Estados de carga y de error; si el USGS no responde, usa un respaldo marcado como «Sin conexión: datos de ejemplo del 10 nov 2026».
- `/proceso/`: de dónde salen los datos, cómo se procesan, gráficas (magnitudes, sismos por día), decisiones de diseño, limitaciones y fe de erratas, y la conexión con la gestión de riesgos (matriz P × I, ISO 31000 y PMBOK).

## Uso

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
node --test                   # pruebas (Node 20 o superior)
```

Añade `?sin-conexion` a la URL para ver el estado sin conexión. Para GitHub Pages basta con servir la rama `main` desde la raíz.

## Estructura

```
index.html, proceso/index.html   las dos páginas (sin build)
css/estilo.css                   línea "Tinta y trama" (claro) y "Jisseki" (oscuro)
js/sismos.js                     parseo del GeoJSON, filtros, agregaciones, hora de Bogotá
js/geo.js                        proyección, punto en polígono, mapa de calor
js/mapa.js, js/graficas.js       SVG del mapa y de las gráficas (texto, sin DOM)
js/datos.js                      llamada al USGS con tiempo límite y respaldo
js/main.js, js/proceso.js        interfaz
datos/paises.json                contornos de Natural Earth (recortados)
datos/ejemplo-2026-11-10.json    respaldo: 70 sismos reales descargados del USGS
test/                            pruebas node --test y un GeoJSON de muestra
```

## De qué trabajo sale

De los trabajos de gestión de riesgos de proyectos (PMBOK 7.ª ed. + ISO 31000:2018) que Mario y David hicieron en Ingeniería de Sistemas: la página `/proceso/` explica cómo un dato externo como la actividad sísmica alimentaría las etapas de identificar, analizar y monitorear, sin inventar valores de probabilidad ni de impacto.

## Créditos y licencias

- Datos de sismos: [USGS Earthquake Catalog API](https://earthquake.usgs.gov/fdsnws/event/1/) (dominio público).
- Contornos: [Natural Earth](https://www.naturalearthdata.com/), Admin 0 – Countries 1:50m (dominio público), recortados a la región y redondeados a 0,01°.
- Fuentes tipográficas: Bangers, Atkinson Hyperlegible e IBM Plex Mono (Google Fonts, licencia OFL).
- Mario Puerta × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/) · [github.com/ale0009](https://github.com/ale0009)

Código con licencia MIT © 2026 Mario Alejandro Puerta Alarcón y David Alexander Rincón Corredor.
