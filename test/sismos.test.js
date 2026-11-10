import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsearGeoJSON, momentoGenerado, filtrarPeriodo, filtrarMagnitud, masFuertes, claseProfundidad,
  horaBogota, diaBogota, porDia, histogramaMagnitud, resumen, construirURL, fmtMag, haceCuanto,
  porTipoMagnitud, HORA_MS, DIA_MS,
} from '../js/sismos.js';

const fc = JSON.parse(readFileSync(new URL('./muestra.geojson', import.meta.url), 'utf8'));
const AHORA = momentoGenerado(fc);
const sismos = parsearGeoJSON(fc);

test('parseo: descarta explosiones, magnitudes nulas y duplicados', () => {
  assert.equal(sismos.length, 5);
  assert.deepEqual(sismos.map((s) => s.id).sort(), ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.ok(sismos.every((s) => typeof s.mag === 'number'));
});

test('parseo: ordena del más reciente al más antiguo y lee profundidad', () => {
  for (let i = 1; i < sismos.length; i++) assert.ok(sismos[i - 1].tiempo >= sismos[i].tiempo);
  const a1 = sismos.find((s) => s.id === 'a1');
  assert.equal(a1.prof, 150.2);
  assert.equal(a1.sentido, 12);
  assert.equal(sismos.find((s) => s.id === 'a5').prof, null);
  assert.equal(sismos.find((s) => s.id === 'a2').tsunami, true);
});

test('parseo: rechaza lo que no es FeatureCollection', () => {
  assert.throws(() => parsearGeoJSON({}), /FeatureCollection/);
  assert.throws(() => parsearGeoJSON(null));
});

test('filtro por periodo: 24 h, 7 d y 30 d respecto a la hora de generación', () => {
  assert.equal(AHORA, 1794332255000);
  assert.deepEqual(filtrarPeriodo(sismos, AHORA, 24).map((s) => s.id), ['a1', 'a4']);
  assert.equal(filtrarPeriodo(sismos, AHORA, 24 * 7).length, 3);
  assert.equal(filtrarPeriodo(sismos, AHORA, 24 * 30).length, 5);
  // el borde se incluye
  assert.equal(filtrarPeriodo([{ tiempo: AHORA - HORA_MS }], AHORA, 1).length, 1);
});

test('filtro por magnitud y los más fuertes', () => {
  assert.equal(filtrarMagnitud(sismos, 4.6).length, 4);
  assert.equal(filtrarMagnitud(sismos, 5).length, 2);
  const top = masFuertes(sismos, 3);
  assert.deepEqual(top.map((s) => s.id), ['a2', 'a5', 'a1']); // a1 y a4 empatan: gana el más reciente
});

test('clases de profundidad', () => {
  assert.equal(claseProfundidad(10), 'superficial');
  assert.equal(claseProfundidad(70), 'intermedio');
  assert.equal(claseProfundidad(299.9), 'intermedio');
  assert.equal(claseProfundidad(350), 'profundo');
  assert.equal(claseProfundidad(null), 'desconocida');
});

test('hora de Bogotá = UTC − 5, sin depender de la zona del equipo', () => {
  // 2026-11-10 17:37:35 UTC → 12:37 en Bogotá
  assert.equal(horaBogota(AHORA), '10 nov 2026, 12:37');
  // 03:00 UTC del 1 de enero aún es 31 de diciembre en Bogotá
  assert.equal(horaBogota(Date.UTC(2027, 0, 1, 3, 0)), '31 dic 2026, 22:00');
  assert.equal(diaBogota(Date.UTC(2027, 0, 1, 3)), diaBogota(Date.UTC(2026, 11, 31, 12)));
});

test('agregación por día incluye días vacíos y la magnitud máxima', () => {
  const filas = porDia(sismos, AHORA - 30 * DIA_MS, AHORA);
  assert.equal(filas.length, 31);
  assert.equal(filas.reduce((a, f) => a + f.n, 0), 5);
  const hoy = filas.at(-1);
  assert.equal(hoy.etiqueta, '10 nov');
  assert.equal(hoy.n, 2);
  assert.equal(hoy.magMax, 4.6);
  assert.ok(filas.some((f) => f.n === 0 && f.magMax === null));
});

test('histograma de magnitudes por clases de 0,5', () => {
  const h = histogramaMagnitud(sismos, 0.5);
  assert.deepEqual(h.map((f) => f.desde), [4, 4.5, 5, 5.5, 6]);
  assert.deepEqual(h.map((f) => f.n), [1, 2, 1, 0, 1]);
  assert.equal(h.reduce((a, f) => a + f.n, 0), sismos.length);
  assert.deepEqual(histogramaMagnitud([]), []);
});

test('resumen para el HUD y tipos de magnitud', () => {
  const r = resumen(sismos);
  assert.equal(r.n, 5);
  assert.equal(r.magMax, 6.1);
  assert.equal(r.profMax, 350);
  assert.equal(r.superficiales, 2);
  assert.deepEqual(resumen([]), { n: 0, magMax: null, profMax: null, superficiales: 0 });
  assert.deepEqual(porTipoMagnitud(sismos)[0], ['mb', 3]);
});

test('URL de la API: caja de Colombia y fecha de inicio a 30 días', () => {
  const u = new URL(construirURL(AHORA, 30));
  assert.equal(u.hostname, 'earthquake.usgs.gov');
  assert.equal(u.searchParams.get('format'), 'geojson');
  assert.equal(u.searchParams.get('minlatitude'), '-5');
  assert.equal(u.searchParams.get('maxlongitude'), '-66');
  assert.equal(u.searchParams.get('starttime'), '2026-10-11T17:37:35');
});

test('formatos cortos', () => {
  assert.equal(fmtMag(6.1), '6,1');
  assert.equal(fmtMag(5.04), '5,0');
  assert.equal(haceCuanto(AHORA - 12 * 60000, AHORA), 'hace 12 min');
  assert.equal(haceCuanto(AHORA - 5 * HORA_MS, AHORA), 'hace 5 h');
  assert.equal(haceCuanto(AHORA - 3 * DIA_MS, AHORA), 'hace 3 d');
});

test('traducción ligera del lugar', async () => {
  const { lugarEs } = await import('../js/sismos.js');
  assert.equal(lugarEs('80 km ENE of Lagunas, Peru'), '80 km al ENE de Lagunas, Perú');
  assert.equal(lugarEs('12 km WSW of Los Santos, Colombia'), '12 km al OSO de Los Santos, Colombia');
  assert.equal(lugarEs('near the coast of Ecuador'), 'cerca de la costa de Ecuador');
  assert.equal(lugarEs('Colombia'), 'Colombia');
  assert.equal(lugarEs(undefined), 'Sin descripción');
});

test('las etiquetas de periodo traen su artículo', async () => {
  const { PERIODOS } = await import('../js/sismos.js');
  assert.equal(PERIODOS['24h'].etiqueta, 'las últimas 24 h');
  assert.equal(PERIODOS['7d'].etiqueta, 'los últimos 7 días');
});
