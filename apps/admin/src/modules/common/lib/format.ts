// Formateo de fechas del IS (string ISO o null) al locale es-ES. Devuelve
// `fallback` para valores vacíos o inválidos. Punto único para dar formato
// consistente a las fechas de todos los listados/fichas.
export function formatDate(
	value: string | null | undefined,
	{
		locale = "es-ES",
		fallback = "—",
	}: { locale?: string; fallback?: string } = {},
): string {
	if (!value) return fallback;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return fallback;
	return new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}
