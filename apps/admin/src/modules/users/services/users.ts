import { isApi } from "#/modules/common/lib/api-client.ts";
import type {
	ChangeEmailInput,
	ChangeEmailResult,
	ChangePasswordInput,
	ChangePasswordResult,
	UpdateProfileInput,
	UpdateProfileResult,
	User,
} from "../shared/types.ts";

export async function getMe() {
	const { user } = await isApi.get<{ user: User }>("/api/users/me");
	return user;
}

export function updateMe(input: UpdateProfileInput) {
	return isApi.patch<UpdateProfileResult>("/api/users/me", input);
}

export function changePassword(input: ChangePasswordInput) {
	return isApi.post<ChangePasswordResult>(
		"/api/users/me/change-password",
		input,
	);
}

export function changeEmail(input: ChangeEmailInput) {
	return isApi.post<ChangeEmailResult>("/api/users/me/change-email", input);
}
