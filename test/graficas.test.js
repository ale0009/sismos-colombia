import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marcasEje, svgBarras, nivelPxI, svgMatriz } from '../js/graficas.js';
import { svgMapa, estrella } from '../js/mapa.js';
import { readFileSync } from 'node:fs';
import { parsearGeoJSON } from '../js/sismos.js';

test('marcas del eje', () => {
  assert.deepEqual(marcasEje(3), [0, 1, 2, 3]);
  assert.deepEqual(marcasEje(11), [0, 2, 4, 6, 8, 10, 12]);
  assert.deepEqual(marcasEje(0), [0, 1]);
});

test('barras: una por fila con n > 0 y etiquetas cada k', () => {
  const filas = [{ etiqueta: 'a', n: 2 }, { etiqueta: 'b', n: 0 }, { etiqueta: 'c', n: 5, destacada: true }];
  const s = svgBarras({ filas, titulo: 'Prueba', cada: 2 });
  assert.equal((s.match(/class="g-barra/g) ?? []).length, 2);
  assert.equal((s.match(/g-dest/g) ?? []).length, 1);
  assert.match(s, />a</);
  assert.doesNotMatch(s, />b</);
});

test('matriz P × I con los umbrales del plan de riesgos (Alto ≥ 10, Medio 5–9, Bajo ≤ 4)', () => {
  assert.equal(nivelPxI(2, 5), 'alto');
  assert.equal(nivelPxI(3, 3), 'medio');
  assert.equal(nivelPxI(1, 5), 'medio');
  assert.equal(nivelPxI(2, 2), 'bajo');
  const s = svgMatriz();
  assert.equal((s.match(/class="m-alto"/g) ?? []).length, 10);
  assert.equal((s.match(/class="m-medio"/g) ?? []).length, 7);
  assert.equal((s.match(/class="m-bajo"/g) ?? []).length, 8);
  assert.equal((s.match(/<rect/g) ?? []).length, 25);
});

test('mapa: puntos, viñeta ¡RUMBLE! y Colombia destacada', () => {
  const paises = JSON.parse(readFileSync(new URL('../datos/paises.json', import.meta.url), 'utf8'));
  const sismos = parsearGeoJSON(JSON.parse(readFileSync(new URL('./muestra.geojson', import.meta.url), 'utf8')));
  const { W, H, marcado } = svgMapa({ paises, sismos, modo: 'puntos', fuerte: sismos.find((s) => s.id === 'a2'), seleccion: 'a1' });
  assert.equal(W, 640);
  assert.ok(H > 700);
  assert.equal((marcado.match(/class="sismo /g) ?? []).length, 5);
  assert.match(marcado, /¡RUMBLE!/);
  assert.match(marcado, /M 6,1/);
  assert.equal((marcado.match(/pais-col/g) ?? []).length, 1);
  assert.match(marcado, /anillo-sel/);
  const soloCalor = svgMapa({ paises, sismos, modo: 'calor' }).marcado;
  assert.equal((soloCalor.match(/class="sismo /g) ?? []).length, 0);
  assert.equal(estrella(0, 0, 10, 5, 4).split(' ').length, 8);
});
