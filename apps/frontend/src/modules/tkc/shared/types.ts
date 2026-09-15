import type { InferResponseType } from "hono/client";
import type { z } from "zod";
import type { usersAdminRpc } from "#/modules/common/lib/rpc.ts";
import type { tkcCredentialsSchema } from "../lib/validation.ts";

export type TkcCredentialsInput = z.infer<typeof tkcCredentialsSchema>;

// Tipo derivado del grafo de rutas real del IS (patrón del módulo `users`, ver
// el README): si la respuesta del servidor cambia, el panel deja de compilar en
// vez de romperse en producción. `linkedAt`/`updatedAt` llegan como string ISO,
// que es lo que sobrevive a JSON, y eso ya viene reflejado en el tipo inferido.
export type TkcKeySummary = NonNullable<
	InferResponseType<(typeof usersAdminRpc)[":id"]["tkc"]["$get"], 200>["tkc"]
>;
