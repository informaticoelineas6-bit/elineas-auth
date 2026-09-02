export type AuthApiUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	role?: string | null;
};

export type AuthApiSystem = { id: string; slug: string; name: string } | null;

export type AccessTokenPayload = {
	sub: string;
	email?: string;
	name?: string;
	image?: string | null;
	role?: string | null;
	exp: number;
	iat: number;
};

export type AuthSession = {
	userId: string;
	email?: string;
	name?: string;
	role?: string | null;
};
