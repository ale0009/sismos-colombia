import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearProyeccion, rutaSVG, puntoEnPoligono, rejillaCalor, pesoMagnitud, radioPunto } from '../js/geo.js';
import { CAJA, parsearGeoJSON } from '../js/sismos.js';

const paises = JSON.parse(readFileSync(new URL('../datos/paises.json', import.meta.url), 'utf8'));
const colombia = paises.features.find((f) => f.properties.iso === 'COL').geometry;
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('proyección: esquinas de la caja y proporción', () => {
  const p = crearProyeccion(CAJA, 800);
  assert.ok(cerca(p.x(CAJA.oeste), 0));
  assert.ok(cerca(p.x(CAJA.este), 800));
  assert.ok(cerca(p.y(CAJA.norte), 0));
  assert.ok(cerca(p.y(CAJA.sur), p.alto));
  // 19° de alto por 16° de ancho con cos(4,5°): un poco más alto que ancho
  assert.ok(p.alto > 800 && p.alto < 800 * (19 / 16) * 1.01);
});

test('proyección: ida y vuelta', () => {
  const p = crearProyeccion(CAJA, 640);
  for (const [lon, lat] of [[-74.07, 4.71], [-81.7, 12.5], [-67, -4]]) {
    assert.ok(cerca(p.lon(p.x(lon)), lon, 1e-9));
    assert.ok(cerca(p.lat(p.y(lat)), lat, 1e-9));
  }
});

test('ruta SVG de un polígono simple', () => {
  const p = crearProyeccion({ oeste: 0, este: 10, sur: -1, norte: 1 }, 100);
  const d = rutaSVG({ type: 'Polygon', coordinates: [[[0, 1], [10, 1], [10, -1], [0, 1]]] }, p);
  assert.match(d, /^M0 0L100 0L100 [\d.]+L0 0Z$/);
});

test('punto en polígono con el contorno real de Colombia (Natural Earth)', () => {
  assert.equal(puntoEnPoligono(-74.07, 4.71, colombia), true); // Bogotá
  assert.equal(puntoEnPoligono(-73.1, 6.8, colombia), true); // Santander
  assert.equal(puntoEnPoligono(-79.5, 2.5, colombia), false); // océano Pacífico
  assert.equal(puntoEnPoligono(-78.5, -1.5, colombia), false); // Ecuador
  assert.equal(puntoEnPoligono(-66.9, 10.5, colombia), false); // Caracas
});

test('punto en polígono respeta huecos', () => {
  const g = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
  assert.equal(puntoEnPoligono(2, 2, g), true);
  assert.equal(puntoEnPoligono(5, 5, g), false);
});

test('mapa de calor: el máximo cae en la celda del sismo más fuerte', () => {
  const fc = JSON.parse(readFileSync(new URL('./muestra.geojson', import.meta.url), 'utf8'));
  const sismos = parsearGeoJSON(fc);
  const p = crearProyeccion(CAJA, 400);
  const nx = 40, ny = Math.round(40 * p.alto / p.ancho);
  const r = rejillaCalor(sismos, p, nx, ny, 12);
  assert.equal(r.valores.length, nx * ny);
  let imax = 0;
  r.valores.forEach((v, i) => { if (v > r.valores[imax]) imax = i; });
  assert.equal(r.max, r.valores[imax]);
  const fuerte = sismos.find((s) => s.id === 'a2');
  assert.equal(imax % nx, Math.floor(p.x(fuerte.lon) / (p.ancho / nx)));
  assert.equal(Math.floor(imax / nx), Math.floor(p.y(fuerte.lat) / (p.alto / ny)));
  assert.equal(rejillaCalor([], p, 4, 4, 5).max, 0);
});

test('peso y radio crecen con la magnitud', () => {
  assert.equal(pesoMagnitud(4), 1);
  assert.equal(pesoMagnitud(6), 4);
  assert.ok(radioPunto(6) > radioPunto(5) && radioPunto(5) > radioPunto(4));
});

test('el GeoJSON de países trae la licencia y Colombia', () => {
  assert.match(paises._licencia, /Natural Earth/);
  assert.ok(paises.features.length >= 5);
  assert.ok(colombia.coordinates.length >= 1);
});
