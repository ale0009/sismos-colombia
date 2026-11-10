// Interfaz de la herramienta «¿Tembló en Colombia?».
import { cargarSismos, cargarPaises, RESPALDO } from './datos.js';
import {
  PERIODOS, filtrarPeriodo, filtrarMagnitud, masFuertes, resumen, fmtMag, horaBogota, haceCuanto, lugarEs, claseProfundidad,
} from './sismos.js';
import { crearProyeccion, puntoEnPoligono, rejillaCalor } from './geo.js';
import { svgMapa, imagenDeRejilla, ANCHO_MAPA, CAJA_VISTA } from './mapa.js';
import { iniciarTema } from './tema.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const REFRESCO_MS = 5 * 60 * 1000;

const estado = { datos: null, paises: null, colombia: null, periodo: '7d', magMin: 2.5, vista: 'ambos', seleccion: null, cargando: false };

function plural(n, uno, varios) { return `${n} ${n === 1 ? uno : varios}`; }

function visibles() {
  const { sismos, ahora } = estado.datos;
  return filtrarMagnitud(filtrarPeriodo(sismos, ahora, PERIODOS[estado.periodo].horas), estado.magMin);
}

function pintarEstado() {
  const d = estado.datos;
  const e = $('estado');
  if (estado.cargando && !d) { e.innerHTML = '<span class="chip chip-carga">Cargando</span>'; return; }
  if (d.origen === 'vivo') {
    e.innerHTML = `<span class="chip chip-vivo">En vivo</span> USGS · consultado ${horaBogota(d.ahora, { conAnio: false })} (hora de Bogotá)
      <button type="button" class="mini" id="recargar">Actualizar</button>`;
  } else {
    e.innerHTML = `<span class="chip chip-error">Sin conexión: datos de ejemplo del ${RESPALDO.fecha}</span>
      <span class="motivo">No se pudo consultar el USGS: ${esc(d.error)}.</span>
      <button type="button" class="mini" id="recargar">Reintentar</button>`;
  }
  $('recargar').addEventListener('click', () => cargar());
}

function pintarVeredicto(lista) {
  const et = PERIODOS[estado.periodo].etiqueta;
  const enCol = lista.filter((s) => puntoEnPoligono(s.lon, s.lat, estado.colombia));
  const filtroTxt = estado.magMin > 2.5 ? ` con M ≥ ${fmtMag(estado.magMin)}` : '';
  let ver, exp;
  if (enCol.length) {
    const f = masFuertes(enCol, 1)[0];
    ver = '<span class="si">¡SÍ!</span>';
    exp = `${plural(enCol.length, 'sismo', 'sismos')}${filtroTxt} con epicentro en Colombia en ${et}. El más fuerte: <strong>M ${fmtMag(f.mag)}</strong>, ${esc(lugarEs(f.lugar))}, ${horaBogota(f.tiempo, { conAnio: false })}.`;
  } else if (lista.length) {
    const f = masFuertes(lista, 1)[0];
    ver = '<span class="no">NO</span>';
    exp = `Ningún epicentro en Colombia${filtroTxt} en ${et}, pero sí ${plural(lista.length, 'sismo', 'sismos')} en la región. El más fuerte: <strong>M ${fmtMag(f.mag)}</strong>, ${esc(lugarEs(f.lugar))}.`;
  } else {
    ver = '<span class="no">NO</span>';
    exp = `Ningún sismo${filtroTxt} en Colombia ni alrededores en ${et}, según el USGS.`;
  }
  $('veredicto').innerHTML = ver;
  $('explica').innerHTML = `${exp} <span class="nota">El USGS registra sobre todo sismos moderados o mayores.</span>`;
  return enCol.length;
}

function pintarHUD(lista, nCol) {
  const r = resumen(lista);
  $('h-n').textContent = r.n;
  $('h-max').textContent = r.magMax === null ? '–' : `M ${fmtMag(r.magMax)}`;
  $('h-col').textContent = nCol;
  $('h-prof').textContent = r.profMax === null ? '–' : `${Math.round(r.profMax)} km`;
}

function pintarTop(lista) {
  const top = masFuertes(lista, 5);
  const ol = $('top');
  if (!top.length) { ol.innerHTML = '<li class="vacio">Sin sismos con estos filtros.</li>'; return; }
  ol.innerHTML = top.map((s, i) => `<li>
    <button type="button" class="top-item${s.id === estado.seleccion ? ' activo' : ''}" data-id="${esc(s.id)}" aria-pressed="${s.id === estado.seleccion}">
      <span class="top-mag${i === 0 ? ' top-1' : ''}">${fmtMag(s.mag)}</span>
      <span class="top-txt"><span class="top-lugar">${esc(lugarEs(s.lugar))}</span>
      <span class="top-meta">${horaBogota(s.tiempo, { conAnio: false })} · ${s.prof === null ? 's/d' : `${Math.round(s.prof)} km`} · ${haceCuanto(s.tiempo, estado.datos.ahora)}</span></span>
    </button></li>`).join('');
}

function pintarFicha(lista) {
  const f = $('ficha');
  const s = lista.find((x) => x.id === estado.seleccion);
  if (!s) { f.hidden = true; return; }
  f.hidden = false;
  f.innerHTML = `<h2>M ${fmtMag(s.mag)} <span class="tipo">${esc(s.magTipo)}</span></h2>
    <p class="ficha-lugar">${esc(lugarEs(s.lugar))}</p>
    <dl>
      <dt>Hora (Bogotá)</dt><dd>${horaBogota(s.tiempo)}</dd>
      <dt>Profundidad</dt><dd>${s.prof === null ? 'sin dato' : `${s.prof.toFixed(1).replace('.', ',')} km · ${claseProfundidad(s.prof)}`}</dd>
      <dt>Coordenadas</dt><dd>${s.lat.toFixed(2).replace('.', ',')}°, ${s.lon.toFixed(2).replace('.', ',')}°</dd>
      ${s.sentido ? `<dt>Lo sintieron</dt><dd>${s.sentido} reportes</dd>` : ''}
    </dl>
    ${s.url ? `<a href="${esc(s.url)}" rel="noopener">Ficha en el USGS</a>` : ''}`;
}

function pintarMapa(lista) {
  const fuerte = masFuertes(lista, 1)[0] ?? null;
  let imagen = null;
  if (estado.vista !== 'puntos' && lista.length) {
    const p = crearProyeccion(CAJA_VISTA, ANCHO_MAPA);
    const nx = 128;
    const ny = Math.round((nx * p.alto) / p.ancho);
    imagen = imagenDeRejilla(rejillaCalor(lista, p, nx, ny, 26));
  }
  const { W, H, marcado } = svgMapa({ paises: estado.paises, sismos: lista, modo: estado.vista, seleccion: estado.seleccion, fuerte, imagenCalor: imagen });
  const resumenTxt = lista.length
    ? `Mapa de Colombia y alrededores con ${plural(lista.length, 'sismo', 'sismos')}; el más fuerte, M ${fmtMag(fuerte.mag)}, ${lugarEs(fuerte.lugar)}.`
    : 'Mapa de Colombia y alrededores sin sismos con los filtros actuales.';
  $('lienzo').style.aspectRatio = `${W} / ${H}`;
  $('lienzo').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(resumenTxt)}">${marcado}</svg>`;
  $('mapa').setAttribute('aria-busy', 'false');
}

function pintar() {
  if (!estado.datos || !estado.paises) return;
  const lista = visibles();
  if (estado.seleccion && !lista.some((s) => s.id === estado.seleccion)) estado.seleccion = null;
  if (!estado.seleccion && lista.length) estado.seleccion = masFuertes(lista, 1)[0].id;
  pintarEstado();
  const nCol = pintarVeredicto(lista);
  pintarHUD(lista, nCol);
  pintarTop(lista);
  pintarFicha(lista);
  pintarMapa(lista);
}

async function cargar() {
  estado.cargando = true;
  const btn = document.getElementById('recargar');
  if (btn) { btn.disabled = true; btn.textContent = 'Consultando…'; }
  try {
    const [datos, paises] = await Promise.all([cargarSismos(''), estado.paises ? estado.paises : cargarPaises('')]);
    estado.datos = datos;
    estado.paises = paises;
    estado.colombia = paises.features.find((f) => f.properties.iso === 'COL').geometry;
  } catch (e) {
    $('veredicto').innerHTML = '<span class="no">¿?</span>';
    $('explica').textContent = `No se pudo cargar ni el USGS ni el respaldo local (${e.message}). Abre la página desde un servidor web, no como archivo.`;
    $('estado').innerHTML = '<span class="chip chip-error">Error</span>';
    $('lienzo').innerHTML = '<div class="carga"><span>Sin datos</span></div>';
  } finally {
    estado.cargando = false;
  }
  pintar();
}

function iniciar() {
  iniciarTema($('tema'));
  document.querySelectorAll('input[name="periodo"]').forEach((r) => r.addEventListener('change', () => { estado.periodo = r.value; estado.seleccion = null; pintar(); }));
  document.querySelectorAll('input[name="vista"]').forEach((r) => r.addEventListener('change', () => { estado.vista = r.value; pintar(); }));
  const mag = $('mag');
  mag.addEventListener('input', () => {
    estado.magMin = Number(mag.value);
    $('mag-out').textContent = `M ${fmtMag(estado.magMin)}`;
    pintar();
  });
  $('top').addEventListener('click', (ev) => {
    const b = ev.target.closest('.top-item');
    if (!b) return;
    estado.seleccion = b.dataset.id;
    pintar();
    document.querySelector(`.top-item[data-id="${CSS.escape(b.dataset.id)}"]`)?.focus();
  });
  $('lienzo').addEventListener('click', (ev) => {
    const c = ev.target.closest('circle.sismo');
    if (!c) return;
    estado.seleccion = c.dataset.id;
    pintar();
  });
  cargar();
  setInterval(() => { if (estado.datos?.origen === 'vivo' && !document.hidden) cargar(); }, REFRESCO_MS);
}

iniciar();
