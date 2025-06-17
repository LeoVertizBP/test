-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "triggering_event_log_id" UUID;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "auto_approve_compliant_enabled" BOOLEAN DEFAULT false,
ADD COLUMN     "auto_remediate_violation_enabled" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "scan_jobs" ADD COLUMN     "bypass_ai_processing" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "audit_logs_triggering_event_log_id_idx" ON "audit_logs"("triggering_event_log_id");

