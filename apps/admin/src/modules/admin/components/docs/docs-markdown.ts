import {
	DOCS_DESCRIPTION,
	DOCS_TITLE,
	ENDPOINTS,
	SECTIONS,
	SECURITY_NOTES,
	STEPS,
} from "./docs-content.ts";
import {
	frameworkExamples,
	rolesSnippet,
	verifySnippet,
} from "./integration-snippets.ts";

// Serializa toda la página /docs a un único documento markdown (con los bloques
// de código en fences y el lenguaje anotado) para pegárselo a un LLM como
// contexto. La fuente es la misma que renderiza la página: docs-content.ts +
// integration-snippets.ts, así que no puede quedar desincronizado.

function codeFence(block: { title: string; language: string; code: string }) {
	return `**${block.title}**\n\n\`\`\`${block.language}\n${block.code.trimEnd()}\n\`\`\``;
}

function endpointsTable() {
	return [
		"| Método | Ruta | Autenticación | Qué hace |",
		"| --- | --- | --- | --- |",
		...ENDPOINTS.map(
			(endpoint) =>
				`| ${endpoint.method} | \`${endpoint.path}\` | ${endpoint.auth} | ${endpoint.description} |`,
		),
	].join("\n");
}

export function buildDocsMarkdown() {
	const parts: string[] = [`# ${DOCS_TITLE}`, DOCS_DESCRIPTION];

	parts.push(`## ${SECTIONS.steps.title}`);
	for (const step of STEPS) {
		parts.push(`### ${step.title}`, step.description);
		if ("link" in step && step.link) {
			parts.push(`Ruta en la consola administrativa: ${step.link.to}`);
		}
	}

	parts.push(
		`## ${SECTIONS.endpoints.title}`,
		SECTIONS.endpoints.intro,
		endpointsTable(),
	);

	parts.push(
		`## ${SECTIONS.verify.title}`,
		codeFence(verifySnippet),
		codeFence(rolesSnippet),
	);

	parts.push(`## ${SECTIONS.examples.title}`, SECTIONS.examples.intro);
	for (const framework of frameworkExamples) {
		parts.push(`### ${framework.label}`);
		for (const block of framework.blocks) parts.push(codeFence(block));
	}

	parts.push(
		`## ${SECTIONS.security.title}`,
		SECURITY_NOTES.map((note) => `- ${note}`).join("\n"),
	);

	return `${parts.join("\n\n")}\n`;
}
