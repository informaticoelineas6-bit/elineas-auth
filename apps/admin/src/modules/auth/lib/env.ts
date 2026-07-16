function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Falta ${name} en el entorno`);
	return value;
}

export const env = {
	AUTH_API_URL: required("AUTH_API_URL"),
	AUTH_SYSTEM_SLUG: required("AUTH_SYSTEM_SLUG"),
};
