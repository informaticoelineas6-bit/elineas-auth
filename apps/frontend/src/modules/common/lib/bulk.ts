// Ejecuta `action` sobre cada fila, una a una, sin abortar al primer fallo:
// devuelve cuántas se aplicaron y cuáles fallaron (con su error) para informar
// de un resultado parcial en vez de dejar la operación a medias sin aviso.
export async function runBulk<T>(
	rows: T[],
	action: (row: T) => Promise<unknown>,
): Promise<{ ok: number; failed: { row: T; error: unknown }[] }> {
	let ok = 0;
	const failed: { row: T; error: unknown }[] = [];
	for (const row of rows) {
		try {
			await action(row);
			ok++;
		} catch (error) {
			failed.push({ row, error });
		}
	}
	return { ok, failed };
}
