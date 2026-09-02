import { useForm } from "@tanstack/react-form";
import { signInSchema } from "./validation.ts";

export type SignInFormValues = { email: string; password: string };

// Hook del formulario de login. `rememberMe` y `turnstileToken` no son campos
// del formulario: se añaden aparte al construir el payload de signInFn.
export function useSignInForm(
	onSubmit: (value: SignInFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues: { email: "", password: "" },
		validators: {
			onSubmit: signInSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type SignInFormApi = ReturnType<typeof useSignInForm>;
