function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Falta ${name} en el entorno`);
	return value;
}

// En producción el captcha es obligatorio: si faltan las llaves el login
// quedaría sin protección anti-bots y sin ningún aviso, así que se aborta el
// arranque (mismo criterio que `required`).
if (
	process.env.NODE_ENV === "production" &&
	!process.env.TURNSTILE_SECRET_KEY
) {
	throw new Error("Falta TURNSTILE_SECRET_KEY en el entorno (obligatoria en producción)");
}

export const env = {
	AUTH_API_URL: required("AUTH_API_URL"),
	AUTH_SYSTEM_SLUG: required("AUTH_SYSTEM_SLUG"),
	// Captcha invisible del login (Cloudflare Turnstile). Opcional a propósito:
	// sin configurar, el login funciona igual mostrando ningún reto (útil en
	// desarrollo); en producción es OBLIGATORIA (ver arriba).
	// Login con Google (por redirect). Opcional: sin APP_PUBLIC_URL el botón no
	// se muestra. AUTH_API_URL puede ser una dirección interna (p. ej. el nombre
	// del servicio en compose), inalcanzable desde el navegador, por eso el IS se
	// abre en su URL PÚBLICA. APP_PUBLIC_URL es el origen de ESTE frontend tal
	// como lo ve el navegador y debe estar permitido en el IS (ALLOWED_ORIGIN).
	AUTH_PUBLIC_URL: process.env.AUTH_PUBLIC_URL ?? required("AUTH_API_URL"),
	APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
	TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
	TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
};
