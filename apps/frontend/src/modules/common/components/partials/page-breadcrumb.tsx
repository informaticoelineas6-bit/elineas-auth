import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/modules/common/components/ui/breadcrumb.tsx";

// `to` acepta cualquier ruta válida del route tree (mismo tipo que Link).
type LinkTo = React.ComponentProps<typeof Link>["to"];

export type Crumb = {
	label: string;
	to?: LinkTo;
};

// Breadcrumb genérico para las páginas de la consola. Antepone "Inicio"
// (enlazando al dashboard) salvo que se desactive con `home={false}`. El último
// elemento se renderiza como página actual (no enlazable); los intermedios con
// `to` se vuelven enlaces.
export function PageBreadcrumb({
	items,
	home = true,
}: {
	items: Crumb[];
	home?: boolean;
}) {
	const crumbs: Crumb[] = home
		? [{ label: "Inicio", to: "/dashboard" }, ...items]
		: items;

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{crumbs.map((crumb, index) => {
					const isLast = index === crumbs.length - 1;
					return (
						<Fragment key={crumb.label}>
							<BreadcrumbItem>
								{isLast || !crumb.to ? (
									<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link to={crumb.to}>{crumb.label}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{!isLast && <BreadcrumbSeparator />}
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
