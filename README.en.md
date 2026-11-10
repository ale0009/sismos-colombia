# Did it shake in Colombia? (¿Tembló en Colombia?)

[Español](README.md) · **English**

A single-purpose page that answers one question: **was there an earthquake in Colombia?** It shows a live heat-and-dot map of the earthquakes of the last 24 hours, 7 days or 30 days in and around Colombia, using the public USGS earthquake API (no key, CORS-enabled).

- A big **«¡SÍ!» / «NO»** answer: only epicentres inside Colombia's outline count.
- Hand-made SVG map (no tiles, no keys): heat + dots, colour by depth, size by magnitude, and a sober «¡RUMBLE!» on the strongest event.
- Top 5 strongest, minimum-magnitude filter and Bogotá local time (UTC−5).
- Loading and error states; if USGS does not answer, a dated backup is shown and labelled as such.
- `/proceso/` (in Spanish): data sources, processing, SVG charts, design decisions, limitations and errata, and the link to project risk management (P × I matrix, ISO 31000, PMBOK).

## Usage

```bash
python3 -m http.server 8000   # open http://localhost:8000
node --test                   # tests (Node 20+)
```

Add `?sin-conexion` to the URL to preview the offline state.

## Credits and licences

- Earthquake data: USGS Earthquake Catalog API (public domain).
- Country outlines: Natural Earth, Admin 0 – Countries 1:50m (public domain), clipped and rounded.
- Fonts: Bangers, Atkinson Hyperlegible, IBM Plex Mono (Google Fonts, OFL).
- Mario Puerta × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/) · [github.com/ale0009](https://github.com/ale0009)

Code under the MIT licence © 2026 Mario Alejandro Puerta Alarcón and David Alexander Rincón Corredor.
