import { getCookie, setCookie } from "@tanstack/react-start/server";
import type { Theme } from "#/shared/types.ts";
import { themeSchema } from "#/shared/validation.ts";

const THEME_COOKIE = "theme";

export const DEFAULT_THEME: Theme = "dark";

// Preferencia de UI, no credencial: puede vivir un año sin riesgo.
const THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readTheme(): Theme {
	const parsed = themeSchema.safeParse(getCookie(THEME_COOKIE));
	return parsed.success ? parsed.data : DEFAULT_THEME;
}

export function writeTheme(theme: Theme) {
	setCookie(THEME_COOKIE, theme, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: THEME_MAX_AGE_SECONDS,
	});
}
