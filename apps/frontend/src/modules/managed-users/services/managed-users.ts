import { unwrap, usersAdminRpc } from "#/modules/common/lib/rpc.ts";
import type {
	ManagedUserFilters,
	UpdateManagedUserInput,
} from "../shared/types.ts";

export function listManagedUsers(filters: ManagedUserFilters) {
	return unwrap(usersAdminRpc.managed.$get({ query: filters }));
}

export function updateManagedUser(id: string, input: UpdateManagedUserInput) {
	return unwrap(
		usersAdminRpc.managed[":id"].$patch({ param: { id }, json: input }),
	);
}

export function resendManagedUserInvite(id: string) {
	return unwrap(
		usersAdminRpc.managed[":id"].invite.$post({ param: { id } }),
	);
}
