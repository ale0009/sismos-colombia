// Lógica pura de los sismos: parseo del GeoJSON del USGS, filtros y agregaciones.
// Sin DOM: se prueba con `node --test`.

export const HORA_MS = 3600 * 1000;
export const DIA_MS = 24 * HORA_MS;
/** Colombia no usa horario de verano: hora local = UTC − 5 todo el año. */
export const DESFASE_BOGOTA_MS = -5 * HORA_MS;

/** Caja de consulta: Colombia y alrededores (grados). */
export const CAJA = Object.freeze({ oeste: -82, este: -66, sur: -5, norte: 14 });

export const PERIODOS = Object.freeze({
  '24h': { horas: 24, etiqueta: 'las últimas 24 h' },
  '7d': { horas: 24 * 7, etiqueta: 'los últimos 7 días' },
  '30d': { horas: 24 * 30, etiqueta: 'los últimos 30 días' },
});

/**
 * URL de la API FDSN del USGS para los últimos `dias` días en la caja.
 * Se pide siempre el periodo más largo y se filtra en el navegador (una sola llamada).
 */
export function construirURL(ahoraMs, dias = 30, caja = CAJA) {
  const inicio = new Date(ahoraMs - dias * DIA_MS).toISOString().slice(0, 19);
  const p = new URLSearchParams({
    format: 'geojson',
    minlatitude: String(caja.sur),
    maxlatitude: String(caja.norte),
    minlongitude: String(caja.oeste),
    maxlongitude: String(caja.este),
    starttime: inicio,
    orderby: 'time',
  });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${p}`;
}

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Convierte la FeatureCollection del USGS en una lista plana de sismos.
 * Descarta lo que no es un sismo (explosiones de cantera, etc.), lo que no tiene
 * magnitud o coordenadas válidas, y los duplicados por id.
 */
export function parsearGeoJSON(fc) {
  if (!fc || !Array.isArray(fc.features)) throw new Error('La respuesta no es un GeoJSON FeatureCollection.');
  const vistos = new Set();
  const salida = [];
  for (const f of fc.features) {
    const p = f?.properties ?? {};
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || !esNumero(c[0]) || !esNumero(c[1])) continue;
    if (!esNumero(p.mag) || !esNumero(p.time)) continue;
    if (p.type && p.type !== 'earthquake') continue;
    const id = String(f.id ?? `${p.time}-${c[0]}-${c[1]}`);
    if (vistos.has(id)) continue;
    vistos.add(id);
    salida.push({
      id,
      mag: p.mag,
      magTipo: p.magType ?? '',
      lugar: p.place ?? 'Sin descripción',
      tiempo: p.time,
      lon: c[0],
      lat: c[1],
      prof: esNumero(c[2]) ? c[2] : null,
      url: typeof p.url === 'string' ? p.url : '',
      sentido: esNumero(p.felt) ? p.felt : null,
      tsunami: p.tsunami === 1,
    });
  }
  return salida.sort((a, b) => b.tiempo - a.tiempo);
}

/** Momento de referencia del GeoJSON (cuándo lo generó el USGS), o null. */
export function momentoGenerado(fc) {
  const g = fc?.metadata?.generated;
  return esNumero(g) ? g : null;
}

/** Sismos ocurridos en las `horas` anteriores a `ahoraMs` (incluye el borde). */
export function filtrarPeriodo(sismos, ahoraMs, horas) {
  const desde = ahoraMs - horas * HORA_MS;
  return sismos.filter((s) => s.tiempo >= desde && s.tiempo <= ahoraMs);
}

export function filtrarMagnitud(sismos, minima) {
  return sismos.filter((s) => s.mag >= minima);
}

/** Los `n` más fuertes; a igual magnitud, el más reciente primero. */
export function masFuertes(sismos, n = 5) {
  return [...sismos].sort((a, b) => b.mag - a.mag || b.tiempo - a.tiempo).slice(0, n);
}

/** Clases de profundidad usadas en sismología: superficial, intermedio, profundo (km). */
export function claseProfundidad(km) {
  if (!esNumero(km)) return 'desconocida';
  if (km < 70) return 'superficial';
  if (km < 300) return 'intermedio';
  return 'profundo';
}

/** Clave de día local de Bogotá (entero) para agrupar. */
export function diaBogota(ms) {
  return Math.floor((ms + DESFASE_BOGOTA_MS) / DIA_MS);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n) => String(n).padStart(2, '0');

/** «10 nov 2026, 07:23» en hora de Bogotá (sin depender de la zona del equipo). */
export function horaBogota(ms, { conAnio = true } = {}) {
  const d = new Date(ms + DESFASE_BOGOTA_MS);
  const fecha = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}${conAnio ? ` ${d.getUTCFullYear()}` : ''}`;
  return `${fecha}, ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}

/** «10 nov» del día local de Bogotá. */
export function etiquetaDia(clave) {
  const d = new Date(clave * DIA_MS);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** «hace 3 h», «hace 12 min», «hace 2 d». */
export function haceCuanto(ms, ahoraMs) {
  const min = Math.max(0, Math.round((ahoraMs - ms) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Magnitud con coma decimal: 6.1 → «6,1». */
export function fmtMag(m) {
  return m.toFixed(1).replace('.', ',');
}

/**
 * Conteo de sismos por día de Bogotá entre `desdeMs` y `hastaMs`,
 * incluyendo los días con cero sismos.
 */
export function porDia(sismos, desdeMs, hastaMs) {
  const d0 = diaBogota(desdeMs);
  const d1 = diaBogota(hastaMs);
  const filas = [];
  for (let d = d0; d <= d1; d++) filas.push({ dia: d, etiqueta: etiquetaDia(d), n: 0, magMax: null });
  for (const s of sismos) {
    const i = diaBogota(s.tiempo) - d0;
    if (i < 0 || i >= filas.length) continue;
    filas[i].n += 1;
    filas[i].magMax = filas[i].magMax === null ? s.mag : Math.max(filas[i].magMax, s.mag);
  }
  return filas;
}

/**
 * Histograma de magnitudes en clases de ancho `paso` (por defecto 0,5).
 * Las clases van de floor(min) a la clase que contiene el máximo.
 */
export function histogramaMagnitud(sismos, paso = 0.5) {
  if (!sismos.length) return [];
  const clase = (m) => Math.floor(Math.round((m / paso) * 1e6) / 1e6) * paso;
  const mags = sismos.map((s) => s.mag);
  const ini = Math.floor(Math.min(...mags));
  const fin = clase(Math.max(...mags));
  const filas = [];
  for (let x = ini; x <= fin + 1e-9; x = Math.round((x + paso) * 1e6) / 1e6) filas.push({ desde: x, hasta: x + paso, n: 0 });
  for (const m of mags) {
    const i = Math.round((clase(m) - ini) / paso);
    if (filas[i]) filas[i].n += 1;
  }
  return filas;
}

/** Cifras para el HUD. */
export function resumen(sismos) {
  if (!sismos.length) return { n: 0, magMax: null, profMax: null, superficiales: 0 };
  let magMax = -Infinity;
  let profMax = -Infinity;
  let superficiales = 0;
  for (const s of sismos) {
    magMax = Math.max(magMax, s.mag);
    if (s.prof !== null) profMax = Math.max(profMax, s.prof);
    if (claseProfundidad(s.prof) === 'superficial') superficiales += 1;
  }
  return { n: sismos.length, magMax, profMax: profMax === -Infinity ? null : profMax, superficiales };
}

/** Conteo por tipo de magnitud (mb, mww, ml…): no son la misma escala. */
export function porTipoMagnitud(sismos) {
  const c = {};
  for (const s of sismos) c[s.magTipo || '?'] = (c[s.magTipo || '?'] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

const RUMBOS = { N: 'N', S: 'S', E: 'E', W: 'O' };
/**
 * Traducción ligera de la descripción del USGS: «80 km ENE of Lagunas, Peru» → «80 km al ENE de Lagunas, Perú».
 * Solo toca el rumbo, «of» y algunos países; el resto queda como lo escribe el USGS.
 */
export function lugarEs(texto) {
  if (typeof texto !== 'string') return 'Sin descripción';
  return texto
    .replace(/^(\d+(?:\.\d+)?) km ([NSEW]{1,3}) of /, (_, km, r) => `${km} km al ${[...r].map((c) => RUMBOS[c]).join('')} de `)
    .replace(/^near the coast of /i, 'cerca de la costa de ')
    .replace(/^offshore /i, 'mar adentro, ')
    .replace(/\bPeru\b/g, 'Perú')
    .replace(/\bPanama\b/g, 'Panamá')
    .replace(/\bBrazil\b/g, 'Brasil')
    .replace(/\bCaribbean Sea\b/g, 'mar Caribe')
    .replace(/\bregion\b/g, 'región');
}
