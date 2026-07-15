function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Falta ${name} en el entorno`);
	return value;
}

export const env = {
	AUTH_API_URL: required("AUTH_API_URL"),
	// Sistema de elineas-auth que representa a este frontend. Debe existir en
	// el IS y el usuario debe tener un rol asignado en él (ver .env.example).
	AUTH_SYSTEM_SLUG: required("AUTH_SYSTEM_SLUG"),
};
