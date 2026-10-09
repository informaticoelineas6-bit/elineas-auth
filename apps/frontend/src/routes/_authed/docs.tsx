import { createFileRoute, Link } from "@tanstack/react-router";
import { CodeBlock } from "@/modules/admin/components/docs/code-block.tsx";
import { CopyDocsButton } from "@/modules/admin/components/docs/copy-docs-button.tsx";
import {
	DOCS_DESCRIPTION,
	DOCS_TITLE,
	GOOGLE_ERROR_CODES,
	GOOGLE_FLOW_STEPS,
	SECTIONS,
	SECURITY_NOTES,
	STEPS,
} from "@/modules/admin/components/docs/docs-content.ts";
import { EndpointReference } from "@/modules/admin/components/docs/endpoint-reference.tsx";
import { FrameworkTabs } from "@/modules/admin/components/docs/framework-tabs.tsx";
import { InlineMarkdown } from "@/modules/admin/components/docs/inline-markdown.tsx";
import {
	googleExamples,
	rolesSnippet,
	tanstackMiddlewareSnippet,
	verifySnippet,
} from "@/modules/admin/components/docs/integration-snippets.ts";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import { requireResourceAccess } from "@/modules/permissions/lib/guard.ts";

// Documentación de integración: cómo dar de alta un sistema consumidor,
// registrar sus roles y verificar el JWT. Es contenido admin-only aunque no
// llame a ningún endpoint (así que no hay ningún 403 del IS que lo bloquee
// por su cuenta, a diferencia del resto de páginas): un rol delegado como
// "rrhh" no gestiona sistemas ni necesita esta guía. `beforeLoad` cancela la
// navegación en vez de dejar montar la página y mostrar un estado "sin
// permisos" después.
export const Route = createFileRoute("/_authed/docs")({
	beforeLoad: ({ context }) => requireResourceAccess(undefined, context),
	component: DocsPage,
});

function DocsPage() {
	return (
		<div className="space-y-8">
			<PageBreadcrumb items={[{ label: "Documentación" }]} />
			<PageHeader
				title={DOCS_TITLE}
				description={DOCS_DESCRIPTION}
				actions={<CopyDocsButton />}
			/>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{STEPS.map((step) => (
					<Card key={step.title}>
						<CardHeader>
							<div className="flex items-center gap-3">
								<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<step.icon className="size-4" />
								</span>
								<CardTitle>{step.title}</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<CardDescription>{step.description}</CardDescription>
							{"link" in step && step.link && (
								<Link
									to={step.link.to}
									className="text-sm font-medium text-primary underline-offset-4 hover:underline"
								>
									{step.link.label} →
								</Link>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			<section className="space-y-3">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					{SECTIONS.endpoints.title}
				</h2>
				<p className="text-sm text-muted-foreground">
					{SECTIONS.endpoints.intro}
				</p>
				<EndpointReference />
			</section>

			<section className="space-y-3">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					{SECTIONS.verify.title}
				</h2>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<CodeBlock
						title={verifySnippet.title}
						code={verifySnippet.code}
						language={verifySnippet.language}
					/>
					<CodeBlock
						title={rolesSnippet.title}
						code={rolesSnippet.code}
						language={rolesSnippet.language}
					/>
				</div>
				<CodeBlock
					title={tanstackMiddlewareSnippet.title}
					code={tanstackMiddlewareSnippet.code}
					language={tanstackMiddlewareSnippet.language}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					{SECTIONS.google.title}
				</h2>
				<p className="text-sm text-muted-foreground">
					{SECTIONS.google.intro}
				</p>
				<ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
					{GOOGLE_FLOW_STEPS.map((step) => (
						<li key={step}>
							<InlineMarkdown text={step} />
						</li>
					))}
				</ol>
				<div className="overflow-x-auto rounded-md border">
					<table className="w-full text-left text-sm">
						<thead className="bg-muted/50 text-muted-foreground">
							<tr>
								<th className="px-3 py-2 font-medium">Código</th>
								<th className="px-3 py-2 font-medium">Significado</th>
							</tr>
						</thead>
						<tbody>
							{GOOGLE_ERROR_CODES.map((e) => (
								<tr key={e.code} className="border-t">
									<td className="px-3 py-2 font-mono text-xs">{e.code}</td>
									<td className="px-3 py-2 text-muted-foreground">
										<InlineMarkdown text={e.meaning} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<FrameworkTabs examples={googleExamples} />
			</section>

			<section className="space-y-3">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					{SECTIONS.examples.title}
				</h2>
				<p className="text-sm text-muted-foreground">
					{SECTIONS.examples.intro}
				</p>
				<FrameworkTabs />
			</section>

			<Card>
				<CardHeader>
					<CardTitle>{SECTIONS.security.title}</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
						{SECURITY_NOTES.map((note) => (
							<li key={note}>
								<InlineMarkdown text={note} />
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}
