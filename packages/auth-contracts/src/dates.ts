// Fechas de negocio como string "YYYY-MM-DD" (el mismo formato que emite
// <input type="date">). Al ser ISO y zero-padded se comparan
// lexicográficamente, sin parsear a Date ni arrastrar la ambigüedad de zona
// horaria que introduce `new Date("2026-01-01")` (que se interpreta en UTC y
// puede caer en el día anterior en husos negativos).

/** Fecha de hoy en el calendario local, como "YYYY-MM-DD". */
export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `true` si la fecha "YYYY-MM-DD" no es posterior a hoy. */
export function isNotFutureDate(value: string): boolean {
  return value <= todayIsoDate();
}
