import type { InferRequestType, InferResponseType } from "hono/client";
import type { z } from "zod";
import type { usersAdminRpc } from "#/modules/common/lib/rpc.ts";
import type { updateManagedUserSchema } from "../lib/validation.ts";

// Derivados del contrato RPC del servidor (GET /api/users/admin/managed).
export type ManagedUserList = InferResponseType<
	typeof usersAdminRpc.managed.$get,
	200
>;
export type ManagedUser = ManagedUserList["users"][number];
export type ManagedUserFilters = NonNullable<
	InferRequestType<typeof usersAdminRpc.managed.$get>["query"]
>;
export type UpdateManagedUserInput = z.infer<typeof updateManagedUserSchema>;
