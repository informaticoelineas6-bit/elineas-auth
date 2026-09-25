import { isApi } from "#/modules/common/lib/api-client.ts";
import type { MyPermission } from "../shared/types.ts";

export async function listMyPermissions() {
	const { permissions } = await isApi.get<{ permissions: MyPermission[] }>(
		"/api/permissions/me",
	);
	return permissions;
}
