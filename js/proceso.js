// Página /proceso/: gráficas calculadas con los mismos datos que la herramienta.
import { cargarSismos, cargarPaises, RESPALDO } from './datos.js';
import {
  DIA_MS, filtrarPeriodo, histogramaMagnitud, porDia, masFuertes, resumen, porTipoMagnitud, fmtMag, horaBogota, diaBogota, lugarEs,
} from './sismos.js';
import { crearProyeccion, rejillaCalor, puntoEnPoligono } from './geo.js';
import { svgBarras, svgMatriz } from './graficas.js';
import { svgMapa, imagenDeRejilla, CAJA_VISTA, ANCHO_MAPA } from './mapa.js';
import { iniciarTema } from './tema.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function miniMapa(id, paises, lista, modo) {
  let imagen = null;
  if (modo !== 'puntos') {
    const p = crearProyeccion(CAJA_VISTA, ANCHO_MAPA);
    imagen = imagenDeRejilla(rejillaCalor(lista, p, 128, Math.round((128 * p.alto) / p.ancho), 26));
  }
  const { W, H, marcado } = svgMapa({ paises, sismos: lista, modo, imagenCalor: imagen });
  $(id).innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa en modo ${modo === 'puntos' ? 'solo puntos' : 'calor y puntos'}">${marcado}</svg>`;
}

async function iniciar() {
  iniciarTema($('tema'));
  $('matriz').innerHTML = svgMatriz();
  let datos, paises;
  try {
    [datos, paises] = await Promise.all([cargarSismos('../'), cargarPaises('../')]);
  } catch (e) {
    $('origen').innerHTML = `<span class="chip chip-error">Error</span> No se pudieron cargar los datos (${esc(e.message)}).`;
    return;
  }
  $('origen').innerHTML = datos.origen === 'vivo'
    ? `<span class="chip chip-vivo">En vivo</span> Datos del USGS consultados el ${horaBogota(datos.ahora)} (hora de Bogotá).`
    : `<span class="chip chip-error">Sin conexión: datos de ejemplo del ${RESPALDO.fecha}</span> No se pudo consultar el USGS: ${esc(datos.error)}.`;

  const lista = filtrarPeriodo(datos.sismos, datos.ahora, 24 * 30);
  const fuerte = masFuertes(lista, 1)[0];
  const hist = histogramaMagnitud(lista, 0.5).map((f) => ({
    etiqueta: fmtMag(f.desde), n: f.n, destacada: fuerte && fuerte.mag >= f.desde && fuerte.mag < f.hasta,
  }));
  $('g-hist').innerHTML = hist.length ? svgBarras({ filas: hist, titulo: 'Histograma de magnitudes de los últimos 30 días' }) : '<p class="vacio">Sin sismos.</p>';
  const dias = porDia(lista, datos.ahora - 30 * DIA_MS, datos.ahora).map((f) => ({
    etiqueta: f.etiqueta, n: f.n, destacada: fuerte && f.dia === diaBogota(fuerte.tiempo),
  }));
  $('g-dia').innerHTML = svgBarras({ filas: dias, titulo: 'Sismos por día en los últimos 30 días', cada: 7 });

  const r = resumen(lista);
  const colombia = paises.features.find((f) => f.properties.iso === 'COL').geometry;
  const enCol = lista.filter((s) => puntoEnPoligono(s.lon, s.lat, colombia)).length;
  const diaMax = dias.reduce((a, f) => (f.n > a.n ? f : a), dias[0]);
  const tipos = porTipoMagnitud(lista);
  const magMin = lista.length ? Math.min(...lista.map((s) => s.mag)) : null;
  $('cifras').innerHTML = lista.length ? `<h3>En cifras (30 días · calculado aquí)</h3>
    <ul>
      <li><strong>${r.n}</strong> sismos en la caja de consulta; <strong>${enCol}</strong> con epicentro dentro de Colombia.</li>
      <li>El más fuerte: <strong>M ${fmtMag(fuerte.mag)}</strong> (${esc(fuerte.magTipo)}), ${esc(lugarEs(fuerte.lugar))}, ${horaBogota(fuerte.tiempo)}.</li>
      <li>El día con más sismos: <strong>${diaMax.etiqueta}</strong>, con ${diaMax.n}.</li>
      <li>${r.superficiales} de ${r.n} son superficiales (menos de 70 km); el más profundo, a ${Math.round(r.profMax)} km.</li>
    </ul>` : '<p>Sin sismos en el periodo.</p>';
  if (magMin !== null) $('mag-min-txt').textContent = `En estos datos, la magnitud más baja es M ${fmtMag(magMin)} (calculado aquí).`;
  $('tipos-txt').textContent = tipos.length ? `En estos datos: ${tipos.map(([t, n]) => `${t} ${n}`).join(', ')} (calculado aquí).` : '';

  const semana = filtrarPeriodo(datos.sismos, datos.ahora, 24 * 7);
  miniMapa('v1', paises, semana, 'puntos');
  miniMapa('v2', paises, semana, 'ambos');
}

iniciar();
