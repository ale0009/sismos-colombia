// Gráficas SVG propias como texto (sin DOM): barras verticales y matriz P × I.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Divisiones «bonitas» del eje Y (enteros). */
export function marcasEje(max) {
  if (max <= 0) return [0, 1];
  const paso = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10;
  const tope = Math.ceil(max / paso) * paso;
  const m = [];
  for (let v = 0; v <= tope; v += paso) m.push(v);
  return m;
}

/**
 * Barras verticales. filas: [{ etiqueta, n, destacada? }].
 * `cada`: cada cuántas barras se escribe la etiqueta del eje X.
 */
export function svgBarras({ filas, titulo, ancho = 480, alto = 230, cada = 1, unidad = 'sismos' }) {
  const m = { iz: 40, de: 10, ar: 14, ab: 46 };
  const w = ancho - m.iz - m.de;
  const h = alto - m.ar - m.ab;
  const marcas = marcasEje(Math.max(0, ...filas.map((f) => f.n)));
  const tope = marcas.at(-1);
  const bw = w / Math.max(1, filas.length);
  const y = (v) => m.ar + h - (v / tope) * h;
  const p = [`<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(titulo)}" class="grafica">`];
  for (const v of marcas) {
    p.push(`<line class="g-reji" x1="${m.iz}" x2="${ancho - m.de}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`);
    p.push(`<text class="g-eje" x="${m.iz - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`);
  }
  filas.forEach((f, i) => {
    const x = m.iz + i * bw;
    const hb = (f.n / tope) * h;
    if (f.n > 0) {
      p.push(`<rect class="g-barra${f.destacada ? ' g-dest' : ''}" x="${(x + bw * 0.12).toFixed(1)}" y="${(m.ar + h - hb).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${hb.toFixed(1)}"><title>${esc(f.etiqueta)}: ${f.n} ${unidad}</title></rect>`);
    }
    if (i % cada === 0) p.push(`<text class="g-eje" x="${(x + bw / 2).toFixed(1)}" y="${alto - m.ab + 18}" text-anchor="middle">${esc(f.etiqueta)}</text>`);
  });
  p.push(`<line class="g-base" x1="${m.iz}" x2="${ancho - m.de}" y1="${m.ar + h}" y2="${m.ar + h}"/>`);
  p.push('</svg>');
  return p.join('');
}

/** Nivel según la escala del plan de riesgos estudiado: Alto ≥ 10, Medio 5–9, Bajo ≤ 4. */
export function nivelPxI(p, i) {
  const v = p * i;
  if (v >= 10) return 'alto';
  if (v >= 5) return 'medio';
  return 'bajo';
}

/** Matriz 5 × 5 de probabilidad (filas, 5 arriba) por impacto (columnas). */
export function svgMatriz({ ancho = 360 } = {}) {
  const c = (ancho - 60) / 5;
  const alto = c * 5 + 50;
  const p = [`<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Matriz 5 por 5 de probabilidad por impacto: Alto si P×I es 10 o más, Medio de 5 a 9, Bajo 4 o menos" class="grafica matriz">`];
  for (let pr = 5; pr >= 1; pr--) {
    for (let im = 1; im <= 5; im++) {
      const x = 40 + (im - 1) * c;
      const yy = 6 + (5 - pr) * c;
      p.push(`<rect class="m-${nivelPxI(pr, im)}" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${c.toFixed(1)}" height="${c.toFixed(1)}"/>`);
      p.push(`<text class="m-v" x="${(x + c / 2).toFixed(1)}" y="${(yy + c / 2 + 5).toFixed(1)}" text-anchor="middle">${pr * im}</text>`);
    }
    p.push(`<text class="g-eje" x="30" y="${(6 + (5 - pr) * c + c / 2 + 4).toFixed(1)}" text-anchor="end">${pr}</text>`);
  }
  for (let im = 1; im <= 5; im++) p.push(`<text class="g-eje" x="${(40 + (im - 0.5) * c).toFixed(1)}" y="${(6 + 5 * c + 18).toFixed(1)}" text-anchor="middle">${im}</text>`);
  p.push(`<text class="g-eje" x="${(40 + 2.5 * c).toFixed(1)}" y="${(6 + 5 * c + 38).toFixed(1)}" text-anchor="middle">Impacto →</text>`);
  p.push(`<text class="g-eje" transform="translate(12 ${(6 + 2.5 * c).toFixed(1)}) rotate(-90)" text-anchor="middle">Probabilidad →</text>`);
  p.push('</svg>');
  return p.join('');
}
