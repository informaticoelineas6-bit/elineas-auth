// Snippets de referencia para la página de documentación de integración
// (issue: nueva página "Documentación"). Son ejemplos ilustrativos, no código
// ejecutado por esta app: se muestran tal cual en <CodeBlock> (con resaltado
// de sintaxis vía prism-react-renderer). Mantenerlos alineados con el patrón
// real que implementa este mismo proyecto en `src/modules/auth/` (cookies.ts,
// jwt.ts, session.ts, services/auth.ts).

export const verifySnippet = {
	title: "verify-jwt.ts (cualquier backend Node/TypeScript)",
	language: "typescript",
	code: `import { createRemoteJWKSet, jwtVerify } from "jose";

// AUTH_API_URL: la URL base del Identity Server, p. ej. https://auth.elineas.com
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", process.env.AUTH_API_URL!));

// Verificación local, sin round-trip al IS: comprueba firma + expiración
// contra el JWKS público. jose cachea el JWKS en memoria automáticamente.
export async function verifyElineasToken(token: string) {
	try {
		const { payload } = await jwtVerify(token, jwks);
		// payload.sub = id de usuario en el IS. email/name reflejan el usuario,
		// pero NO uses un eventual payload.role para autorizar: no está
		// garantizado. Para permisos en TU sistema, consulta /api/user-roles/me
		// (con el session token, no con este JWT) — ver "Autorización" abajo.
		return payload as { sub: string; email?: string; name?: string; exp: number };
	} catch {
		return null; // firma inválida o token expirado (dura ~15 min)
	}
}`,
};

export const rolesSnippet = {
	title: "roles.ts",
	language: "typescript",
	code: `// Con el session token (no el JWT) obtenido en el login, de vida larga.
export async function getMyRoles(sessionToken: string, systemSlug: string) {
	const url = new URL("/api/user-roles/me", process.env.AUTH_API_URL);
	url.searchParams.set("systemSlug", systemSlug);

	const res = await fetch(url, {
		headers: { Authorization: \`Bearer \${sessionToken}\` },
	});
	if (!res.ok) return [];

	const { roles } = (await res.json()) as {
		roles: { id: string; name: string; description: string | null }[];
	};
	return roles;
}`,
};

export type FrameworkExample = {
	id: string;
	label: string;
	blocks: { title: string; language: string; code: string }[];
};

export const frameworkExamples: FrameworkExample[] = [
	{
		id: "react",
		label: "React",
		blocks: [
			{
				title: "server/login.ts (tu backend, p. ej. Express)",
				language: "typescript",
				code: `app.post("/api/login", async (req, res) => {
	const { email, password } = req.body;

	const r = await fetch(new URL("/api/auth/sign-in", process.env.AUTH_API_URL), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password, systemSlug: "mi-sistema" }),
	});
	if (!r.ok) return res.status(401).json({ error: "Credenciales inválidas" });

	const { user, token } = await r.json();
	// El session token (largo plazo) viaja en esta cabecera, no en el body.
	const sessionToken = r.headers.get("set-auth-token")!;

	// httpOnly: el JS del navegador nunca ve estos valores (mitiga XSS).
	res.cookie("session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });
	res.cookie("jwt", token, { httpOnly: true, secure: true, sameSite: "lax" });
	res.json({ user });
});`,
			},
			{
				title: "useAuth.tsx (React)",
				language: "tsx",
				code: `import { createContext, useContext, useState, type ReactNode } from "react";

type User = { id: string; name: string; email: string };
type Ctx = { user: User | null; signIn: (email: string, password: string) => Promise<void> };

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);

	async function signIn(email: string, password: string) {
		// Llama a TU backend, no directo al IS: así la cookie httpOnly la fija
		// tu propio servidor (ver server/login.ts).
		const res = await fetch("/api/login", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		if (!res.ok) throw new Error("Credenciales inválidas");
		setUser((await res.json()).user);
	}

	return <AuthContext.Provider value={{ user, signIn }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext)!;`,
			},
		],
	},
	{
		id: "nextjs",
		label: "Next.js",
		blocks: [
			{
				title: "app/api/login/route.ts",
				language: "typescript",
				code: `import { NextResponse } from "next/server";

export async function POST(req: Request) {
	const { email, password } = await req.json();

	const r = await fetch(new URL("/api/auth/sign-in", process.env.AUTH_API_URL), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password, systemSlug: "mi-sistema" }),
	});
	if (!r.ok) {
		return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
	}

	const { user, token } = await r.json();
	const sessionToken = r.headers.get("set-auth-token")!;

	const response = NextResponse.json({ user });
	response.cookies.set("session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });
	response.cookies.set("jwt", token, { httpOnly: true, secure: true, sameSite: "lax" });
	return response;
}`,
			},
			{
				title: "middleware.ts",
				language: "typescript",
				code: `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Verificación en el edge: sin round-trip al IS en cada petición protegida.
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", process.env.AUTH_API_URL!));

export async function middleware(req: NextRequest) {
	const jwt = req.cookies.get("jwt")?.value;
	if (!jwt) return NextResponse.redirect(new URL("/login", req.url));

	try {
		await jwtVerify(jwt, jwks);
		return NextResponse.next();
	} catch {
		// Expiró (~15 min): redirige a una ruta que pida /api/auth/token con el
		// session token para renovarlo, igual que hace este proyecto.
		return NextResponse.redirect(new URL("/login", req.url));
	}
}

export const config = { matcher: ["/dashboard/:path*"] };`,
			},
		],
	},
	{
		id: "tanstack-start",
		label: "TanStack Start",
		blocks: [
			{
				title: "modules/auth/actions/auth.ts",
				language: "typescript",
				code: `import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie } from "@tanstack/react-start/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_API_URL = process.env.AUTH_API_URL!;
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", AUTH_API_URL));
const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" } as const;

export const signInFn = createServerFn({ method: "POST" })
	.validator((d: { email: string; password: string }) => d)
	.handler(async ({ data }) => {
		const res = await fetch(new URL("/api/auth/sign-in", AUTH_API_URL), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...data, systemSlug: "mi-sistema" }),
		});
		if (!res.ok) throw new Error("Credenciales inválidas");

		const { user, token } = await res.json();
		setCookie("session", res.headers.get("set-auth-token")!, cookieOpts);
		setCookie("jwt", token, cookieOpts);
		return { user };
	});

// Este mismo patrón (cookies + verificación JWT + refresco) es el que usa
// este proyecto en src/modules/auth/lib/{cookies,jwt,session}.ts.
export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
	const jwt = getCookie("jwt");
	if (!jwt) return null;
	try {
		const { payload } = await jwtVerify(jwt, jwks);
		return { userId: payload.sub as string };
	} catch {
		return null; // expiró: renovar con GET /api/auth/token + el session token
	}
});`,
			},
		],
	},
	{
		id: "vue",
		label: "Vue",
		blocks: [
			{
				title: "server/login.ts (tu backend, p. ej. Fastify)",
				language: "typescript",
				code: `import type { FastifyInstance } from "fastify";

export async function registerLogin(app: FastifyInstance) {
	app.post("/api/login", async (request, reply) => {
		const { email, password } = request.body as { email: string; password: string };

		const r = await fetch(new URL("/api/auth/sign-in", process.env.AUTH_API_URL), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password, systemSlug: "mi-sistema" }),
		});
		if (!r.ok) return reply.code(401).send({ error: "Credenciales inválidas" });

		const { user, token } = await r.json();
		// El session token (largo plazo) viaja en esta cabecera, no en el body.
		const sessionToken = r.headers.get("set-auth-token")!;

		// httpOnly: el JS del navegador nunca ve estos valores (mitiga XSS).
		reply
			.setCookie("session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/" })
			.setCookie("jwt", token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" })
			.send({ user });
	});
}`,
			},
			{
				title: "composables/useAuth.ts (Vue 3)",
				language: "typescript",
				code: `import { ref, readonly } from "vue";

type User = { id: string; name: string; email: string };
const user = ref<User | null>(null);

export function useAuth() {
	async function signIn(email: string, password: string) {
		// Llama a tu backend (no directo al IS), que fija las cookies httpOnly.
		const res = await fetch("/api/login", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		if (!res.ok) throw new Error("Credenciales inválidas");
		user.value = (await res.json()).user;
	}

	return { user: readonly(user), signIn };
}`,
			},
		],
	},
	{
		id: "nuxt",
		label: "Nuxt",
		blocks: [
			{
				title: "server/api/login.post.ts (Nuxt 3/4)",
				language: "typescript",
				code: `export default defineEventHandler(async (event) => {
	const { email, password } = await readBody(event);
	const authApiUrl = useRuntimeConfig().authApiUrl;

	const res = await $fetch.raw(\`\${authApiUrl}/api/auth/sign-in\`, {
		method: "POST",
		body: { email, password, systemSlug: "mi-sistema" },
	}).catch(() => null);

	if (!res) {
		throw createError({ statusCode: 401, statusMessage: "Credenciales inválidas" });
	}

	const sessionToken = res.headers.get("set-auth-token")!;
	setCookie(event, "session", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });
	setCookie(event, "jwt", (res._data as any).token, { httpOnly: true, secure: true, sameSite: "lax" });
	return { user: (res._data as any).user };
});`,
			},
			{
				title: "composables/useAuth.ts (Nuxt)",
				language: "typescript",
				code: `export function useAuth() {
	const user = useState<{ id: string; name: string; email: string } | null>(
		"user",
		() => null,
	);

	async function signIn(email: string, password: string) {
		const { user: u } = await $fetch<{ user: typeof user.value }>("/api/login", {
			method: "POST",
			body: { email, password },
		});
		user.value = u;
	}

	return { user, signIn };
}`,
			},
		],
	},
];
