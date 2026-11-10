// Geometría pura: proyección, trazado SVG de polígonos, punto en polígono y mapa de calor.

/**
 * Proyección equirectangular con corrección de coseno en la latitud media
 * (cerca del ecuador casi no deforma y es trivial de invertir y probar).
 * Devuelve funciones x(lon), y(lat) en píxeles de un lienzo de `ancho` de ancho.
 */
export function crearProyeccion(caja, ancho) {
  const latMedia = ((caja.sur + caja.norte) / 2) * (Math.PI / 180);
  const k = Math.cos(latMedia);
  const escala = ancho / ((caja.este - caja.oeste) * k);
  const alto = (caja.norte - caja.sur) * escala;
  return {
    ancho,
    alto,
    escala,
    x: (lon) => (lon - caja.oeste) * k * escala,
    y: (lat) => (caja.norte - lat) * escala,
    lon: (x) => x / (k * escala) + caja.oeste,
    lat: (y) => caja.norte - y / escala,
  };
}

const r1 = (v) => Math.round(v * 10) / 10;

/** Atributo `d` de un <path> SVG para un Polygon o MultiPolygon GeoJSON. */
export function rutaSVG(geometria, proy) {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  let d = '';
  for (const poli of poligonos) {
    for (const anillo of poli) {
      anillo.forEach(([lon, lat], i) => {
        d += `${i ? 'L' : 'M'}${r1(proy.x(lon))} ${r1(proy.y(lat))}`;
      });
      d += 'Z';
    }
  }
  return d;
}

function enAnillo(lon, lat, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** ¿El punto cae dentro del Polygon/MultiPolygon? (rayo par-impar, respeta huecos). */
export function puntoEnPoligono(lon, lat, geometria) {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  return poligonos.some(([exterior, ...huecos]) => enAnillo(lon, lat, exterior) && !huecos.some((h) => enAnillo(lon, lat, h)));
}

/**
 * Peso visual de un sismo en el mapa de calor: se duplica por cada unidad de magnitud
 * (2^(M−4)). Es una decisión de diseño para que un M6 destaque sin borrar a los M4,
 * no una medida física de energía.
 */
export function pesoMagnitud(m) {
  return 2 ** (m - 4);
}

/**
 * Densidad de núcleo gaussiano en una rejilla de nx × ny celdas sobre el lienzo de la proyección.
 * `sigma` en píxeles del lienzo. Devuelve { valores: Float64Array, max, nx, ny }.
 */
export function rejillaCalor(sismos, proy, nx, ny, sigma) {
  const valores = new Float64Array(nx * ny);
  const cw = proy.ancho / nx;
  const ch = proy.alto / ny;
  const radio = 3 * sigma;
  const dos2 = 2 * sigma * sigma;
  for (const s of sismos) {
    const px = proy.x(s.lon);
    const py = proy.y(s.lat);
    const w = pesoMagnitud(s.mag);
    const i0 = Math.max(0, Math.floor((px - radio) / cw));
    const i1 = Math.min(nx - 1, Math.floor((px + radio) / cw));
    const j0 = Math.max(0, Math.floor((py - radio) / ch));
    const j1 = Math.min(ny - 1, Math.floor((py + radio) / ch));
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - py;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - px;
        valores[j * nx + i] += w * Math.exp(-(dx * dx + dy * dy) / dos2);
      }
    }
  }
  let max = 0;
  for (const v of valores) if (v > max) max = v;
  return { valores, max, nx, ny };
}

/** Radio del punto en píxeles según la magnitud (área ∝ peso visual). */
export function radioPunto(m) {
  return 2.5 + 2.2 * Math.sqrt(pesoMagnitud(m));
}
