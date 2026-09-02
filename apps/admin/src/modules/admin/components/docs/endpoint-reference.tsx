import { Badge } from "@/modules/common/components/ui/badge.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/modules/common/components/ui/table.tsx";
import { ENDPOINT_METHODS, ENDPOINTS } from "./docs-content.ts";

// Tabla de referencia rápida de los endpoints que necesita un backend nuevo
// para integrarse (login, verificación y autorización). El resto de la API
// (empleados, sistemas, roles…) es exclusiva de esta consola administrativa.
export function EndpointReference() {
	return (
		<div className="rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Método</TableHead>
						<TableHead>Ruta</TableHead>
						<TableHead>Autenticación</TableHead>
						<TableHead>Qué hace</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{ENDPOINTS.map((endpoint) => (
						<TableRow key={endpoint.path}>
							<TableCell>
								<Badge variant={ENDPOINT_METHODS[endpoint.method]}>
									{endpoint.method}
								</Badge>
							</TableCell>
							<TableCell className="font-mono text-xs whitespace-normal">
								{endpoint.path}
							</TableCell>
							<TableCell className="whitespace-normal text-muted-foreground">
								{endpoint.auth}
							</TableCell>
							<TableCell className="whitespace-normal text-muted-foreground">
								{endpoint.description}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
