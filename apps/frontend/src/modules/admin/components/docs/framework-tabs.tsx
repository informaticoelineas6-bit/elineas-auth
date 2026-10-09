import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/modules/common/components/ui/tabs.tsx";
import { CodeBlock } from "./code-block.tsx";
import {
	type FrameworkExample,
	frameworkExamples,
} from "./integration-snippets.ts";

// Ejemplos de login por stack de frontend. Todos siguen el mismo patrón: el
// frontend llama a un backend propio (no directo al IS) que guarda el session
// token y el JWT en cookies httpOnly.
export function FrameworkTabs({
	examples = frameworkExamples,
}: {
	examples?: FrameworkExample[];
}) {
	return (
		<Tabs defaultValue={examples[0].id}>
			<TabsList className="flex-wrap">
				{examples.map((fw) => (
					<TabsTrigger key={fw.id} value={fw.id}>
						{fw.label}
					</TabsTrigger>
				))}
			</TabsList>
			{examples.map((fw) => (
				<TabsContent key={fw.id} value={fw.id} className="space-y-4">
					{fw.blocks.map((block) => (
						<CodeBlock
							key={block.title}
							title={block.title}
							code={block.code}
							language={block.language}
						/>
					))}
				</TabsContent>
			))}
		</Tabs>
	);
}
