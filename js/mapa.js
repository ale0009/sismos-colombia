// Construye el SVG del mapa como texto (sin DOM, salvo la imagen del calor que pinta un canvas).
import { crearProyeccion, rutaSVG, radioPunto } from './geo.js';
import { CAJA, claseProfundidad, fmtMag } from './sismos.js';

/** Vista del mapa: la caja de consulta con medio grado de margen para que no se corten los puntos del borde. */
export const CAJA_VISTA = Object.freeze({ oeste: CAJA.oeste - 0.5, este: CAJA.este + 0.5, sur: CAJA.sur - 0.5, norte: CAJA.norte + 0.5 });

export const ANCHO_MAPA = 640;

const ETIQUETAS = [
  { t: 'COLOMBIA', lon: -73.2, lat: 3.2, clase: 'eti-col' },
  { t: 'VENEZUELA', lon: -67.6, lat: 7.6 },
  { t: 'ECUADOR', lon: -78.4, lat: -2.6 },
  { t: 'PERÚ', lon: -75.4, lat: -4.2 },
  { t: 'BRASIL', lon: -67.6, lat: -1.4 },
  { t: 'PANAMÁ', lon: -80.4, lat: 8.9 },
  { t: 'Océano Pacífico', lon: -81.6, lat: 4.6, clase: 'eti-mar' },
  { t: 'Mar Caribe', lon: -77.2, lat: 12.7, clase: 'eti-mar' },
];

const BOGOTA = { lon: -74.0721, lat: 4.711 };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Estrella de onomatopeya (polígono de picos alternos). */
export function estrella(cx, cy, rExt, rInt, picos = 12) {
  const pts = [];
  for (let i = 0; i < picos * 2; i++) {
    const r = i % 2 ? rInt : rExt;
    const a = (Math.PI * i) / picos - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/**
 * Devuelve el marcado del <svg> del mapa.
 * opciones: { paises, sismos, modo: 'calor'|'puntos'|'ambos', seleccion (id), fuerte (sismo|null),
 *             imagenCalor (dataURL|null), ancho }
 */
export function svgMapa({ paises, sismos, modo = 'ambos', seleccion = null, fuerte = null, imagenCalor = null, ancho = ANCHO_MAPA }) {
  const p = crearProyeccion(CAJA_VISTA, ancho);
  const W = p.ancho;
  const H = Math.round(p.alto);
  const partes = [];
  partes.push(`<defs>
    <pattern id="trama-col" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" class="trama-fondo"/><circle cx="3.5" cy="3.5" r="1.15" class="trama-punto"/></pattern>
    <clipPath id="recorte"><rect width="${W}" height="${H}"/></clipPath>
  </defs>`);
  partes.push(`<rect class="mar" width="${W}" height="${H}"/>`);
  // retícula cada 4°
  const ret = [];
  for (let lon = -80; lon <= -68; lon += 4) ret.push(`M${p.x(lon).toFixed(1)} 0V${H}`);
  for (let lat = -4; lat <= 12; lat += 4) ret.push(`M0 ${p.y(lat).toFixed(1)}H${W}`);
  partes.push(`<path class="reticula" d="${ret.join('')}"/>`);
  partes.push('<g clip-path="url(#recorte)">');
  const qx = p.x(CAJA.oeste), qy = p.y(CAJA.norte);
  const cajaConsulta = `<rect class="caja-consulta" x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" width="${(p.x(CAJA.este) - qx).toFixed(1)}" height="${(p.y(CAJA.sur) - qy).toFixed(1)}"/>`;
  for (const f of paises.features) {
    const col = f.properties.iso === 'COL';
    partes.push(`<path class="${col ? 'pais pais-col' : 'pais'}" d="${rutaSVG(f.geometry, p)}"><title>${esc(f.properties.nombre)}</title></path>`);
  }
  for (const e of ETIQUETAS) {
    partes.push(`<text class="eti ${e.clase ?? ''}" x="${p.x(e.lon).toFixed(1)}" y="${p.y(e.lat).toFixed(1)}" text-anchor="${e.clase === 'eti-mar' && e.lon < -80 ? 'start' : 'middle'}">${e.t}</text>`);
  }
  if (imagenCalor && modo !== 'puntos') {
    partes.push(`<image class="calor" href="${imagenCalor}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`);
  }
  partes.push(cajaConsulta);
  // Bogotá como referencia
  const bx = p.x(BOGOTA.lon), by = p.y(BOGOTA.lat);
  partes.push(`<g class="bogota"><rect x="${(bx - 4).toFixed(1)}" y="${(by - 4).toFixed(1)}" width="8" height="8"/><text x="${(bx + 8).toFixed(1)}" y="${(by + 4).toFixed(1)}">Bogotá</text></g>`);
  if (modo !== 'calor') {
    // los pequeños encima de los grandes no taparían; dibujamos de mayor a menor
    const orden = [...sismos].sort((a, b) => b.mag - a.mag);
    partes.push('<g class="puntos">');
    for (const s of orden) {
      const cl = claseProfundidad(s.prof);
      partes.push(`<circle class="sismo prof-${cl}${s.id === seleccion ? ' sel' : ''}" data-id="${esc(s.id)}" cx="${p.x(s.lon).toFixed(1)}" cy="${p.y(s.lat).toFixed(1)}" r="${radioPunto(s.mag).toFixed(1)}"><title>M ${fmtMag(s.mag)} · ${esc(s.lugar)}</title></circle>`);
    }
    partes.push('</g>');
  }
  if (seleccion) {
    const s = sismos.find((x) => x.id === seleccion);
    if (s) partes.push(`<circle class="anillo-sel" cx="${p.x(s.lon).toFixed(1)}" cy="${p.y(s.lat).toFixed(1)}" r="${(radioPunto(s.mag) + 7).toFixed(1)}"/>`);
  }
  if (fuerte) {
    const fx = p.x(fuerte.lon), fy = p.y(fuerte.lat);
    partes.push(`<circle class="onda" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${radioPunto(fuerte.mag).toFixed(1)}"/>`);
    // la viñeta se coloca hacia el interior del mapa para no salirse del marco
    const dx = fx > W * 0.6 ? -96 : 96;
    const dy = fy < 90 ? 70 : -64;
    const cx = Math.min(W - 70, Math.max(70, fx + dx));
    const cy = Math.min(H - 50, Math.max(50, fy + dy));
    partes.push(`<g class="rumble" aria-hidden="true">
      <line x1="${fx.toFixed(1)}" y1="${fy.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}"/>
      <polygon points="${estrella(cx, cy, 64, 46, 14)}"/>
      <text class="rumble-t" x="${cx.toFixed(1)}" y="${(cy - 2).toFixed(1)}" text-anchor="middle">¡RUMBLE!</text>
      <text class="rumble-m" x="${cx.toFixed(1)}" y="${(cy + 17).toFixed(1)}" text-anchor="middle">M ${fmtMag(fuerte.mag)}</text>
    </g>`);
  }
  partes.push('</g>');
  partes.push(`<rect class="marco" x="1" y="1" width="${W - 2}" height="${H - 2}"/>`);
  return { W, H, marcado: partes.join('') };
}

/**
 * Pinta la rejilla de densidad en un canvas pequeño y devuelve un dataURL.
 * El navegador la escala con suavizado al ponerla en el SVG: así sale el difuminado.
 * Rampa: transparente → cian → rojo.
 */
export function imagenDeRejilla(rejilla, doc = globalThis.document) {
  const { valores, max, nx, ny } = rejilla;
  if (!doc || !max) return null;
  const c = doc.createElement('canvas');
  c.width = nx;
  c.height = ny;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(nx, ny);
  const cian = [67, 143, 184];
  const rojo = [203, 67, 62];
  for (let i = 0; i < valores.length; i++) {
    const t = Math.sqrt(valores[i] / max); // raíz: realza las zonas tenues
    if (t < 0.04) continue;
    const u = Math.min(1, Math.max(0, (t - 0.35) / 0.5));
    img.data[i * 4] = Math.round(cian[0] + (rojo[0] - cian[0]) * u);
    img.data[i * 4 + 1] = Math.round(cian[1] + (rojo[1] - cian[1]) * u);
    img.data[i * 4 + 2] = Math.round(cian[2] + (rojo[2] - cian[2]) * u);
    img.data[i * 4 + 3] = Math.round(255 * Math.min(0.82, t * 0.95));
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}
