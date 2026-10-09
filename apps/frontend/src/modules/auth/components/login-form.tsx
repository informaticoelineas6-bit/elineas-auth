import type { SignInFormApi } from "@/modules/auth/lib/form.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { PasswordInput } from "@/modules/common/components/ui/password-input.tsx";

// Formulario de login: email, contraseña, widget de Turnstile e integración
// con rate-limiting (cuenta atrás tras demasiados intentos fallidos).
export function LoginForm({
	form,
	rateLimit,
	turnstile,
	google,
}: {
	form: SignInFormApi;
	rateLimit: {
		active: boolean;
		remaining: number;
		start: (seconds: number) => void;
	};
	turnstile: {
		containerRef: { current: HTMLDivElement | null };
		getToken: () => Promise<string | undefined>;
	};
	// Presente solo si el login con Google está habilitado.
	google?: { onClick: () => void; pending: boolean };
}) {
	return (
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
								<FieldLabel htmlFor={field.name} required>
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
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
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
								<FieldLabel htmlFor={field.name} required>
									Contraseña
								</FieldLabel>
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
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>

			{/* Widget invisible: sin tamaño ni contenido visible (size: "invisible").
			    Cloudflare solo lo muestra si decide interponer un reto. */}
			<div ref={turnstile.containerRef} />

			<form.Subscribe
				selector={(state) => ({
					canSubmit: state.canSubmit,
					isSubmitting: state.isSubmitting,
				})}
			>
				{({ canSubmit, isSubmitting }) => (
					<div className="flex gap-2">
						<Button
							disabled={!canSubmit || rateLimit.active}
							type="submit"
							className="flex-1"
						>
							<LoadingSwap isLoading={isSubmitting}>
								{rateLimit.active
									? `Espera ${rateLimit.remaining}s`
									: "Autenticarse"}
							</LoadingSwap>
						</Button>
					</div>
				)}
			</form.Subscribe>

			{google && (
				<>
					<div className="flex items-center gap-3 text-muted-foreground text-xs">
						<span className="h-px flex-1 bg-border" />o
						<span className="h-px flex-1 bg-border" />
					</div>
					<Button
						type="button"
						variant="outline"
						disabled={google.pending}
						onClick={google.onClick}
						aria-label="Continuar con Google"
					>
						<LoadingSwap isLoading={google.pending}>
							<img src="/google.svg" alt="" className="size-5" />
						</LoadingSwap>
					</Button>
				</>
			)}
		</form>
	);
}
