import type { z } from "zod";
import type { themeSchema } from "@/modules/common/lib/validation";

export type Theme = z.infer<typeof themeSchema>;
