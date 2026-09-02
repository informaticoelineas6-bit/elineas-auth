import { createServerFn } from "@tanstack/react-start";
import { themeSchema } from "#/modules/common/lib/validation.ts";
import { readTheme, writeTheme } from "@/modules/common/lib/theme.ts";

export const getThemeFn = createServerFn({ method: "GET" }).handler(() =>
	readTheme(),
);

export const setThemeFn = createServerFn({ method: "POST" })
	.validator(themeSchema)
	.handler(({ data }) => {
		writeTheme(data);
		return data;
	});
