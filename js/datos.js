// Carga de datos (navegador): API del USGS con tiempo límite y respaldo local fechado.
import { construirURL, momentoGenerado, parsearGeoJSON } from './sismos.js';

export const RESPALDO = { ruta: 'datos/ejemplo-2026-11-10.json', fecha: '10 nov 2026' };
const LIMITE_MS = 12000;

function motivo(err) {
  if (err?.name === 'AbortError') return 'el USGS tardó más de 12 s en responder';
  if (err?.estado) return `el USGS respondió con el código HTTP ${err.estado}`;
  if (err instanceof TypeError) return 'no hay conexión o el navegador bloqueó la petición';
  return err?.message || 'error desconocido';
}

async function pedirJSON(url, senal) {
  const r = await fetch(url, { signal: senal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { estado: r.status });
  return r.json();
}

/**
 * Devuelve { sismos, ahora, origen: 'vivo'|'respaldo', error: string|null }.
 * `base` es la ruta relativa a la raíz del sitio ('' en /, '../' en /proceso/).
 * Con ?sin-conexion en la URL se fuerza el respaldo (para probar ese estado).
 */
export async function cargarSismos(base = '') {
  const forzar = new URLSearchParams(globalThis.location?.search ?? '').has('sin-conexion');
  let error = null;
  if (!forzar) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), LIMITE_MS);
    try {
      const ahora = Date.now();
      const fc = await pedirJSON(construirURL(ahora, 30), ctl.signal);
      return { sismos: parsearGeoJSON(fc), ahora: momentoGenerado(fc) ?? ahora, origen: 'vivo', error: null };
    } catch (e) {
      error = motivo(e);
    } finally {
      clearTimeout(t);
    }
  } else {
    error = 'modo sin conexión forzado con ?sin-conexion';
  }
  const fc = await pedirJSON(`${base}${RESPALDO.ruta}`);
  return { sismos: parsearGeoJSON(fc), ahora: momentoGenerado(fc), origen: 'respaldo', error };
}

export async function cargarPaises(base = '') {
  return pedirJSON(`${base}datos/paises.json`);
}
