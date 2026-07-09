import { defineRelations } from "drizzle-orm";
import { user, session, account, verification, jwks } from "@/db/auth-schema";
import { employee, role, system, userRole } from "@/db/business-schema";

export const schema = {
  user,
  session,
  account,
  verification,
  jwks,
  employee,
  system,
  role,
  userRole,
};

export const relations = defineRelations(schema, (r) => ({
  user: {
    sessions: r.many.session(),
    accounts: r.one.account(),
    employee: r.one.employee(),
    userRole: r.many.userRole(),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  employee: {
    user: r.one.user({
      from: r.employee.userId,
      to: r.user.id,
    }),
  },
  system: {
    roles: r.many.role(),
  },
  role: {
    system: r.one.system({
      from: r.role.systemId,
      to: r.system.id,
    }),
    userRole: r.many.userRole(),
  },
  userRole: {
    user: r.one.user({
      from: r.userRole.userId,
      to: r.user.id,
    }),
    role: r.one.role({
      from: r.userRole.roleId,
      to: r.role.id,
    }),
  },
}));
