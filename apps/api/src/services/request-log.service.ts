import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "@/db/index";
import { requestLog } from "@/db/log-schema";
import { escapeLike } from "@/lib/search";
import { toOffset, type PaginationInput } from "@/lib/pagination";

type RequestLogFilters = {
  from?: Date;
  to?: Date;
  userId?: string;
  status?: number;
  method?: string;
  path?: string;
};

// Lista los logs de peticiones, más recientes primero, con filtros opcionales.
// Solo se usa desde la ruta de administración (requireAdmin).
export async function listRequestLogs(
  filters: RequestLogFilters,
  pagination: PaginationInput,
) {
  const conditions = [
    filters.from ? gte(requestLog.ts, filters.from) : undefined,
    filters.to ? lte(requestLog.ts, filters.to) : undefined,
    filters.userId ? eq(requestLog.userId, filters.userId) : undefined,
    filters.status !== undefined ? eq(requestLog.status, filters.status) : undefined,
    filters.method ? eq(requestLog.method, filters.method.toUpperCase()) : undefined,
    filters.path
      ? ilike(requestLog.path, `%${escapeLike(filters.path)}%`)
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(requestLog)
      .where(where)
      .orderBy(desc(requestLog.ts))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db.select({ total: count() }).from(requestLog).where(where),
  ]);
  return { rows, total };
}
