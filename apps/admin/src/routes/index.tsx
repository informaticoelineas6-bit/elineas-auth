import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getSessionFn, signInFn } from "#/actions/auth.ts";
import { Button } from "#/components/ui/button.tsx";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";
import { LoadingSwap } from "#/components/ui/loading-swap.tsx";
import { PasswordInput } from "#/components/ui/password-input.tsx";
import SideRays from "#/components/ui/side-rays.tsx";
import { reportError } from "#/lib/errors.ts";
import { signInSchema } from "#/shared/validation.ts";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (session) throw redirect({ to: "/dashboard" });
	},
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const login = useServerFn(signInFn);

	const form = useForm({
		defaultValues: { email: "", password: "" },
		validators: {
			onSubmit: signInSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const result = await login({
					data: {
						email: value.email,
						password: value.password,
						rememberMe: false,
					},
				});
				if (result.error) {
					reportError(result.error);
					return;
				}
				navigate({ to: "/dashboard" });
			} catch (error) {
				reportError(error, "No se pudo iniciar sesión. Intenta nuevamente.");
			}
		},
	});

	return (
		<div className="relative w-full min-h-screen overflow-hidden">
			<div className="absolute inset-0">
				<SideRays
					speed={2.5}
					rayColor1="#1b08ea"
					rayColor2="#578bc5"
					intensity={2.5}
					spread={2}
					origin="top-left"
					tilt={14}
					saturation={1.15}
					blend={0.75}
					falloff={1.6}
					opacity={0.75}
				/>
			</div>
			<div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 p-8">
				<h1 className="text-5xl font-semibold shimmer text-muted-foreground">
					Elineas Identity Server
				</h1>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex w-full max-w-sm flex-col gap-4"
				>
					<FieldGroup>
						<form.Field name="email">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Correo electrónico
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="ejemplo@mercadoelineas.com"
											autoComplete="off"
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="password">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Contraseña</FieldLabel>
										<PasswordInput
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="***************"
											autoComplete="off"
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{({ canSubmit, isSubmitting }) => (
							<Button disabled={!canSubmit} type="submit">
								<LoadingSwap isLoading={isSubmitting}>Autenticarse</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</form>
			</div>
		</div>
	);
}
