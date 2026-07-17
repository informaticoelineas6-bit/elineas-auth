import { defineRelations } from "drizzle-orm";
import { user, session, account, verification, jwks } from "@/db/auth-schema";
import {
  employee,
  role,
  system,
  userRole,
  sessionSystem,
} from "@/db/business-schema";
import { requestLog } from "@/db/log-schema";

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
  sessionSystem,
  // Sin relaciones: no se declara en defineRelations más abajo. Se incluye aquí
  // para que drizzle conozca la tabla (db.insert/select) y por consistencia.
  requestLog,
};

export const relations = defineRelations(schema, (r) => ({
  user: {
    sessions: r.many.session(),
    accounts: r.one.account(),
    employee: r.one.employee(),
    userRole: r.many.userRole(),
    sessionSystem: r.many.sessionSystem(),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
    sessionSystem: r.one.sessionSystem(),
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
    sessionSystem: r.many.sessionSystem(),
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
  sessionSystem: {
    session: r.one.session({
      from: r.sessionSystem.sessionId,
      to: r.session.id,
    }),
    user: r.one.user({
      from: r.sessionSystem.userId,
      to: r.user.id,
    }),
    system: r.one.system({
      from: r.sessionSystem.systemId,
      to: r.system.id,
    }),
  },
}));
