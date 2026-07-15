import { createServerFn } from "@tanstack/react-start";
import { readTheme, writeTheme } from "#/lib/theme.ts";
import { themeSchema } from "#/shared/validation.ts";

export const getThemeFn = createServerFn({ method: "GET" }).handler(() =>
	readTheme(),
);

export const setThemeFn = createServerFn({ method: "POST" })
	.validator(themeSchema)
	.handler(({ data }) => {
		writeTheme(data);
		return data;
	});
