import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { fetchAllPages } from "#/modules/common/lib/paginate.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import {
	addMembersSchema,
	bulkCreateDepartmentsSchema,
	createDepartmentSchema,
	departmentFiltersSchema,
	memberHeadSchema,
	memberRefSchema,
	updateDepartmentSchema,
} from "../lib/validation.ts";
import {
	addMembers,
	bulkCreateDepartments,
	createDepartment,
	deleteDepartment,
	getDepartment,
	listDepartments,
	listMembers,
	removeMember,
	setMemberHead,
	updateDepartment,
} from "../services/departments.ts";

// Todos los departamentos que cumplan los filtros (no solo la página visible),
// para exportar.
export const listAllDepartmentsFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(departmentFiltersSchema.omit({ page: true, limit: true }))
	.handler(({ data }) =>
		fetchAllPages(async (page, limit) => {
			const { departments, pagination } = await listDepartments({
				...data,
				page,
				limit,
			});
			return { rows: departments, totalPages: pagination.totalPages };
		}),
	);

export const listDepartmentsFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(departmentFiltersSchema)
	.handler(({ data }) => listDepartments(data));

export const getDepartmentFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => getDepartment(data.id));

export const createDepartmentFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(createDepartmentSchema)
	.handler(({ data }) => createDepartment(data));

export const bulkCreateDepartmentsFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(bulkCreateDepartmentsSchema)
	.handler(({ data }) => bulkCreateDepartments(data));

export const updateDepartmentFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ body: updateDepartmentSchema }))
	.handler(({ data }) => updateDepartment(data.id, data.body));

export const deleteDepartmentFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => deleteDepartment(data.id));

export const listMembersFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => listMembers(data.id));

export const addMembersFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ body: addMembersSchema }))
	.handler(({ data }) => addMembers(data.id, data.body));

export const setMemberHeadFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(memberHeadSchema)
	.handler(({ data }) => setMemberHead(data.id, data.employeeId, data.isHead));

export const removeMemberFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(memberRefSchema)
	.handler(({ data }) => removeMember(data.id, data.employeeId));
