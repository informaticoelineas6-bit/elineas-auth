// staleTime para "catálogos": datos que cambian muy poco (roles, sistemas) y
// que varias vistas piden como fuente para resolver nombres. Con este valor no
// se re-fetchean al re-montar ni al enfocar la ventana durante la sesión de
// trabajo típica; una mutación sobre ellos los invalida igual, así que no
// quedan obsoletos tras un cambio real.
export const CATALOG_STALE_TIME = 5 * 60_000; // 5 min
