CREATE TABLE "department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL UNIQUE,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"employee_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"is_head" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "employeeDepartment_employeeId_idx" ON "employee_department" ("employee_id");--> statement-breakpoint
CREATE INDEX "employeeDepartment_departmentId_idx" ON "employee_department" ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employeeDepartment_employeeId_departmentId_uidx" ON "employee_department" ("employee_id","department_id");--> statement-breakpoint
ALTER TABLE "employee_department" ADD CONSTRAINT "employee_department_employee_id_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_department" ADD CONSTRAINT "employee_department_department_id_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE CASCADE;