// Escapa los metacaracteres de un patrón LIKE/ILIKE (`%`, `_` y el propio `\`)
// para que el texto que teclea el usuario se trate como literal. Sin esto, un
// `%` en la búsqueda actúa como comodín (coincidencias inesperadas) y patrones
// como `%_%_%_...` fuerzan escaneos costosos. Se combina con `%${term}%` en el
// servicio, que aporta los comodines de "contiene".
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
