-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'REMEDIATING', 'CLOSED', 'REMEDIATION_COMPLETE');

-- CreateEnum
CREATE TYPE "HumanVerdict" AS ENUM ('VIOLATION', 'COMPLIANT', 'ERROR');

-- CreateEnum
CREATE TYPE "ResolutionMethod" AS ENUM ('AI_AUTO_REMEDIATE', 'AI_AUTO_CLOSE', 'HUMAN_REVIEW');

-- CreateTable
CREATE TABLE "ai_feedback_examples" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_snippet" TEXT NOT NULL,
    "rule_id" UUID NOT NULL,
    "ai_verdict" BOOLEAN NOT NULL,
    "human_verdict" BOOLEAN NOT NULL,
    "confidence_score" DECIMAL(5,2) NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "tags" JSONB DEFAULT '[]',
    "content_item_id" UUID,
    "reviewer_id" UUID,
    "image_reference_id" UUID,
    "selection_reason" TEXT,
    "is_selected_for_training" BOOLEAN NOT NULL DEFAULT false,
    "original_flag_source" VARCHAR(50),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "obsolescence_reason" TEXT,
    "obsolescence_date" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rule_type" VARCHAR(50) NOT NULL,

    CONSTRAINT "ai_feedback_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" VARCHAR(255) NOT NULL,
    "details" JSONB NOT NULL,
    "user_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggering_event_log_id" UUID,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "image_type" VARCHAR(50) NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "captured_at" TIMESTAMP(6),
    "sha256" CHAR(64),

    CONSTRAINT "content_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scan_job_id" UUID NOT NULL,
    "publisher_id" UUID NOT NULL,
    "publisher_channel_id" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "channel_url" VARCHAR(255) NOT NULL,
    "url" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(50) NOT NULL,
    "scan_date" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,
    "caption" TEXT,
    "title" TEXT,
    "transcript" JSONB,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_files" (
    "id" UUID NOT NULL,
    "contentItemId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" VARCHAR(20) NOT NULL,
    "fileType" VARCHAR(20) NOT NULL,
    "filePath" VARCHAR(255) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "ai_confidence" DECIMAL(5,2) NOT NULL,
    "reviewer_id" UUID,
    "rule_citation" TEXT,
    "rule_section" VARCHAR(255),
    "context_text" TEXT,
    "context_start_index" INTEGER,
    "context_end_index" INTEGER,
    "image_reference_id" UUID,
    "flag_source" VARCHAR(50) NOT NULL DEFAULT 'ai',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "rule_type" VARCHAR(50) NOT NULL,
    "ai_evaluation" TEXT,
    "product_id" UUID,
    "ai_confidence_reasoning" TEXT,
    "ai_ruling" VARCHAR(50),
    "ai_feedback_notes" TEXT,
    "decision_made_at" TIMESTAMP(6),
    "human_verdict" "HumanVerdict",
    "human_verdict_reasoning" TEXT,
    "in_review_at" TIMESTAMP(6),
    "internal_notes" TEXT,
    "remediation_completed_at" TIMESTAMP(6),
    "reviewed_at" TIMESTAMP(6),
    "status" "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "example_selection_reason" TEXT,
    "is_learning_example" BOOLEAN NOT NULL DEFAULT false,
    "rule_version_applied" VARCHAR(50),
    "librarian_consulted" BOOLEAN NOT NULL DEFAULT false,
    "librarian_examples_provided" BOOLEAN NOT NULL DEFAULT false,
    "resolution_method" "ResolutionMethod",
    "content_source" VARCHAR(50) NOT NULL,
    "transcript_end_ms" INTEGER,
    "transcript_start_ms" INTEGER,
    "visual_location" TEXT,
    "remediation_start_time" TIMESTAMP(6),

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guideline_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "upload_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" UUID,
    "rule_type" VARCHAR(50) NOT NULL,

    CONSTRAINT "guideline_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "settings" JSONB DEFAULT '{}',
    "auto_approval_threshold" DECIMAL(5,2),
    "auto_approval_action" VARCHAR(50) DEFAULT 'pending_remediation',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_approve_compliant_enabled" BOOLEAN DEFAULT false,
    "auto_remediate_violation_enabled" BOOLEAN DEFAULT false,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pgmigrations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "run_on" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pgmigrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rule_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_set_id" UUID NOT NULL,
    "product_rule_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_set_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "rule_type" VARCHAR(50) NOT NULL,
    "manual_text" TEXT,
    "version" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "advertiser_id" UUID NOT NULL,
    "bypass_threshold" DECIMAL(3,2),

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "primary_issuer" VARCHAR(255),
    "fee" DECIMAL(10,2),
    "marketing_bullets" JSONB DEFAULT '[]',
    "last_scan_date" TIMESTAMP(6),
    "last_scan_job_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "advertiser_id" UUID NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "advertiser_id" UUID NOT NULL,
    "set_type" VARCHAR(50) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_violation_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID NOT NULL,
    "issuer" VARCHAR(255),
    "product_id" UUID,
    "publisher_id" UUID,
    "time_period" VARCHAR(50) NOT NULL,
    "period_start_date" DATE NOT NULL,
    "period_end_date" DATE NOT NULL,
    "content_count" INTEGER NOT NULL DEFAULT 0,
    "violation_count" INTEGER NOT NULL DEFAULT 0,
    "violation_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rule_type" VARCHAR(50) NOT NULL,

    CONSTRAINT "rule_violation_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_job_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scan_job_id" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "channel_url" VARCHAR(255) NOT NULL,
    "publisher_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_job_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_job_product_focus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scan_job_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_job_product_focus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255),
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "scan_all_publishers" BOOLEAN NOT NULL DEFAULT false,
    "platform_filter" VARCHAR(50),
    "start_time" TIMESTAMP(6),
    "end_time" TIMESTAMP(6),
    "created_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "advertiser_id" UUID,
    "has_active_flags" BOOLEAN NOT NULL DEFAULT false,
    "assignee_id" UUID,
    "bypass_ai_processing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_job_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scan_job_id" UUID NOT NULL,
    "publisher_channel_id" UUID NOT NULL,
    "apify_actor_id" VARCHAR(255) NOT NULL,
    "apify_run_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'STARTED',
    "input_payload" JSONB,
    "run_started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_finished_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_details" TEXT,

    CONSTRAINT "scan_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "settings" JSONB DEFAULT '{}',
    "last_login" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publisher_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "default_product_rule_set_id" UUID,
    "default_channel_rule_set_id" UUID,
    "global_rule_set_id" UUID,

    CONSTRAINT "advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_rule_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_set_id" UUID NOT NULL,
    "channel_rule_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "advertiser_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "rule_type" VARCHAR(50) NOT NULL,
    "manual_text" TEXT,
    "applicable_issuer" VARCHAR(255),
    "version" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bypass_threshold" DECIMAL(3,2),
    "applicable_channel" VARCHAR(50)[],

    CONSTRAINT "channel_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_channel_rule_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "channel_rule_id" UUID NOT NULL,
    "inclusion_type" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_channel_rule_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rule_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "product_rule_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inclusion_type" VARCHAR(10) NOT NULL,

    CONSTRAINT "product_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rule_set_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "rule_set_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_rule_set_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publisher_id" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "channel_url" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "added_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_scanned" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apifyActorId" VARCHAR(255),

    CONSTRAINT "affiliate_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_channel_configs" (
    "id" UUID NOT NULL,
    "publisher_channel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sitemapUrl" VARCHAR(255),
    "loginSecretId" VARCHAR(255),
    "includeDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxPages" INTEGER,
    "maxDepth" INTEGER,
    "imageMaxBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "article_content_selector" TEXT,
    "hero_image_selector" TEXT,

    CONSTRAINT "publisher_channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publisher_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "contact_info" JSONB NOT NULL DEFAULT '{}',
    "last_scan_date" TIMESTAMP(6),
    "last_scan_job_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_job_publishers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scan_job_id" UUID NOT NULL,
    "publisher_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_job_affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "service_name" VARCHAR(100) NOT NULL,
    "action_name" VARCHAR(100) NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER,
    "cost" DECIMAL(10,6),
    "status" VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "related_context" JSONB,
    "correlation_id" UUID,
    "request_payload" TEXT,
    "response_payload" TEXT,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_comments" (
    "id" UUID NOT NULL,
    "flag_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flag_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_feedback_examples_content_item_id_index" ON "ai_feedback_examples"("content_item_id");

-- CreateIndex
CREATE INDEX "ai_feedback_examples_is_correct_index" ON "ai_feedback_examples"("is_correct");

-- CreateIndex
CREATE INDEX "ai_feedback_examples_is_current_index" ON "ai_feedback_examples"("is_current");

-- CreateIndex
CREATE INDEX "ai_feedback_examples_is_selected_for_training_index" ON "ai_feedback_examples"("is_selected_for_training");

-- CreateIndex
CREATE INDEX "ai_feedback_examples_reviewer_id_index" ON "ai_feedback_examples"("reviewer_id");

-- CreateIndex
CREATE INDEX "ai_feedback_examples_rule_id_index" ON "ai_feedback_examples"("rule_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_index" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_index" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_index" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_triggering_event_log_id_idx" ON "audit_logs"("triggering_event_log_id");

-- CreateIndex
CREATE INDEX "content_images_content_item_id_index" ON "content_images"("content_item_id");

-- CreateIndex
CREATE INDEX "content_images_sha256_index" ON "content_images"("sha256");

-- CreateIndex
CREATE INDEX "content_items_affiliate_id_index" ON "content_items"("publisher_id");

-- CreateIndex
CREATE INDEX "content_items_channel_id_index" ON "content_items"("publisher_channel_id");

-- CreateIndex
CREATE INDEX "content_items_content_type_index" ON "content_items"("content_type");

-- CreateIndex
CREATE INDEX "content_items_platform_index" ON "content_items"("platform");

-- CreateIndex
CREATE INDEX "content_items_scan_date_index" ON "content_items"("scan_date");

-- CreateIndex
CREATE INDEX "content_items_scan_job_id_index" ON "content_items"("scan_job_id");

-- CreateIndex
CREATE INDEX "content_files_contentItemId_idx" ON "content_files"("contentItemId");

-- CreateIndex
CREATE INDEX "content_files_contentItemId_version_idx" ON "content_files"("contentItemId", "version");

-- CreateIndex
CREATE INDEX "flags_ai_confidence_index" ON "flags"("ai_confidence");

-- CreateIndex
CREATE INDEX "flags_content_item_id_index" ON "flags"("content_item_id");

-- CreateIndex
CREATE INDEX "flags_product_id_index" ON "flags"("product_id");

-- CreateIndex
CREATE INDEX "flags_flag_source_index" ON "flags"("flag_source");

-- CreateIndex
CREATE INDEX "flags_reviewer_id_index" ON "flags"("reviewer_id");

-- CreateIndex
CREATE INDEX "flags_rule_id_index" ON "flags"("rule_id");

-- CreateIndex
CREATE INDEX "flags_status_index" ON "flags"("status");

-- CreateIndex
CREATE INDEX "flags_human_verdict_index" ON "flags"("human_verdict");

-- CreateIndex
CREATE INDEX "flags_resolution_method_index" ON "flags"("resolution_method");

-- CreateIndex
CREATE INDEX "flags_content_source_index" ON "flags"("content_source");

-- CreateIndex
CREATE INDEX "flags_created_at_index" ON "flags"("created_at");

-- CreateIndex
CREATE INDEX "guideline_documents_rule_id_index" ON "guideline_documents"("rule_id");

-- CreateIndex
CREATE INDEX "guideline_documents_uploaded_by_index" ON "guideline_documents"("uploaded_by");

-- CreateIndex
CREATE INDEX "rule_set_rules_rule_id_index" ON "product_rule_sets"("product_rule_id");

-- CreateIndex
CREATE INDEX "rule_set_rules_rule_set_id_index" ON "product_rule_sets"("rule_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "rule_set_rules_unique" ON "product_rule_sets"("rule_set_id", "product_rule_id");

-- CreateIndex
CREATE INDEX "product_rules_advertiser_id_index" ON "product_rules"("advertiser_id");

-- CreateIndex
CREATE INDEX "rules_version_index" ON "product_rules"("version");

-- CreateIndex
CREATE INDEX "products_name_index" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_primary_issuer_index" ON "products"("primary_issuer");

-- CreateIndex
CREATE INDEX "products_advertiser_id_index" ON "products"("advertiser_id");

-- CreateIndex
CREATE INDEX "rule_sets_is_global_index" ON "rule_sets"("is_global");

-- CreateIndex
CREATE INDEX "rule_sets_advertiser_id_index" ON "rule_sets"("advertiser_id");

-- CreateIndex
CREATE INDEX "rule_sets_set_type_index" ON "rule_sets"("set_type");

-- CreateIndex
CREATE INDEX "rule_violation_stats_affiliate_id_index" ON "rule_violation_stats"("publisher_id");

-- CreateIndex
CREATE INDEX "rule_violation_stats_issuer_index" ON "rule_violation_stats"("issuer");

-- CreateIndex
CREATE INDEX "rule_violation_stats_product_id_index" ON "rule_violation_stats"("product_id");

-- CreateIndex
CREATE INDEX "rule_violation_stats_rule_id_index" ON "rule_violation_stats"("rule_id");

-- CreateIndex
CREATE INDEX "rule_violation_stats_time_period_period_start_date_index" ON "rule_violation_stats"("time_period", "period_start_date");

-- CreateIndex
CREATE INDEX "scan_job_channels_affiliate_id_index" ON "scan_job_channels"("publisher_id");

-- CreateIndex
CREATE INDEX "scan_job_channels_platform_index" ON "scan_job_channels"("platform");

-- CreateIndex
CREATE INDEX "scan_job_channels_scan_job_id_index" ON "scan_job_channels"("scan_job_id");

-- CreateIndex
CREATE INDEX "scan_job_product_focus_product_id_index" ON "scan_job_product_focus"("product_id");

-- CreateIndex
CREATE INDEX "scan_job_product_focus_scan_job_id_index" ON "scan_job_product_focus"("scan_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_job_product_focus_unique" ON "scan_job_product_focus"("scan_job_id", "product_id");

-- CreateIndex
CREATE INDEX "scan_jobs_advertiser_id_idx" ON "scan_jobs"("advertiser_id");

-- CreateIndex
CREATE INDEX "scan_jobs_created_by_index" ON "scan_jobs"("created_by");

-- CreateIndex
CREATE INDEX "scan_jobs_assignee_id_index" ON "scan_jobs"("assignee_id");

-- CreateIndex
CREATE INDEX "scan_jobs_source_index" ON "scan_jobs"("source");

-- CreateIndex
CREATE INDEX "scan_jobs_start_time_index" ON "scan_jobs"("start_time");

-- CreateIndex
CREATE INDEX "scan_jobs_status_index" ON "scan_jobs"("status");

-- CreateIndex
CREATE INDEX "scan_jobs_has_active_flags_index" ON "scan_jobs"("has_active_flags");

-- CreateIndex
CREATE UNIQUE INDEX "scan_job_runs_apify_run_id_key" ON "scan_job_runs"("apify_run_id");

-- CreateIndex
CREATE INDEX "scan_job_runs_scan_job_id_idx" ON "scan_job_runs"("scan_job_id");

-- CreateIndex
CREATE INDEX "scan_job_runs_publisher_channel_id_idx" ON "scan_job_runs"("publisher_channel_id");

-- CreateIndex
CREATE INDEX "scan_job_runs_apify_run_id_idx" ON "scan_job_runs"("apify_run_id");

-- CreateIndex
CREATE INDEX "scan_job_runs_status_idx" ON "scan_job_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_index" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_index" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_publisher_id_idx" ON "users"("publisher_id");

-- CreateIndex
CREATE INDEX "users_role_index" ON "users"("role");

-- CreateIndex
CREATE INDEX "advertisers_organization_id_index" ON "advertisers"("organization_id");

-- CreateIndex
CREATE INDEX "channel_rule_sets_channel_rule_id_index" ON "channel_rule_sets"("channel_rule_id");

-- CreateIndex
CREATE INDEX "channel_rule_sets_rule_set_id_index" ON "channel_rule_sets"("rule_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_rule_sets_unique" ON "channel_rule_sets"("rule_set_id", "channel_rule_id");

-- CreateIndex
CREATE INDEX "channel_rules_advertiser_id_index" ON "channel_rules"("advertiser_id");

-- CreateIndex
CREATE INDEX "channel_rules_applicable_channel_index" ON "channel_rules"("applicable_channel");

-- CreateIndex
CREATE INDEX "channel_rules_applicable_issuer_index" ON "channel_rules"("applicable_issuer");

-- CreateIndex
CREATE INDEX "product_channel_rule_overrides_channel_rule_id_index" ON "product_channel_rule_overrides"("channel_rule_id");

-- CreateIndex
CREATE INDEX "product_channel_rule_overrides_product_id_index" ON "product_channel_rule_overrides"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_channel_rule_overrides_unique" ON "product_channel_rule_overrides"("product_id", "channel_rule_id");

-- CreateIndex
CREATE INDEX "product_rules_product_id_index" ON "product_rule_overrides"("product_id");

-- CreateIndex
CREATE INDEX "product_rules_rule_id_index" ON "product_rule_overrides"("product_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_rules_unique" ON "product_rule_overrides"("product_id", "product_rule_id");

-- CreateIndex
CREATE INDEX "product_rule_set_assignments_product_id_index" ON "product_rule_set_assignments"("product_id");

-- CreateIndex
CREATE INDEX "product_rule_set_assignments_rule_set_id_index" ON "product_rule_set_assignments"("rule_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_rule_set_assignments_unique" ON "product_rule_set_assignments"("product_id", "rule_set_id");

-- CreateIndex
CREATE INDEX "affiliate_channels_affiliate_id_index" ON "publisher_channels"("publisher_id");

-- CreateIndex
CREATE INDEX "affiliate_channels_platform_index" ON "publisher_channels"("platform");

-- CreateIndex
CREATE INDEX "publisher_channels_apify_actor_id_index" ON "publisher_channels"("apifyActorId");

-- CreateIndex
CREATE INDEX "affiliate_channels_status_index" ON "publisher_channels"("status");

-- CreateIndex
CREATE UNIQUE INDEX "publisher_channel_configs_publisher_channel_id_key" ON "publisher_channel_configs"("publisher_channel_id");

-- CreateIndex
CREATE INDEX "publisher_channel_configs_publisher_channel_id_idx" ON "publisher_channel_configs"("publisher_channel_id");

-- CreateIndex
CREATE INDEX "affiliate_products_affiliate_id_index" ON "publisher_products"("publisher_id");

-- CreateIndex
CREATE INDEX "affiliate_products_product_id_index" ON "publisher_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_products_unique" ON "publisher_products"("publisher_id", "product_id");

-- CreateIndex
CREATE INDEX "affiliates_name_index" ON "publishers"("name");

-- CreateIndex
CREATE INDEX "affiliates_organization_id_index" ON "publishers"("organization_id");

-- CreateIndex
CREATE INDEX "affiliates_status_index" ON "publishers"("status");

-- CreateIndex
CREATE INDEX "scan_job_affiliates_affiliate_id_index" ON "scan_job_publishers"("publisher_id");

-- CreateIndex
CREATE INDEX "scan_job_affiliates_scan_job_id_index" ON "scan_job_publishers"("scan_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_job_affiliates_unique" ON "scan_job_publishers"("scan_job_id", "publisher_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_correlation_id_idx" ON "ai_usage_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_timestamp_idx" ON "ai_usage_logs"("timestamp");

-- CreateIndex
CREATE INDEX "ai_usage_logs_service_name_idx" ON "ai_usage_logs"("service_name");

-- CreateIndex
CREATE INDEX "ai_usage_logs_action_name_idx" ON "ai_usage_logs"("action_name");

-- CreateIndex
CREATE INDEX "ai_usage_logs_model_name_idx" ON "ai_usage_logs"("model_name");

-- CreateIndex
CREATE INDEX "ai_usage_logs_status_idx" ON "ai_usage_logs"("status");

-- CreateIndex
CREATE INDEX "flag_comments_flag_id_idx" ON "flag_comments"("flag_id");

-- CreateIndex
CREATE INDEX "flag_comments_user_id_idx" ON "flag_comments"("user_id");

-- AddForeignKey
ALTER TABLE "ai_feedback_examples" ADD CONSTRAINT "ai_feedback_examples_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_feedback_examples" ADD CONSTRAINT "ai_feedback_examples_image_reference_id_fkey" FOREIGN KEY ("image_reference_id") REFERENCES "content_images"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_feedback_examples" ADD CONSTRAINT "ai_feedback_examples_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_images" ADD CONSTRAINT "content_images_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_affiliate_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_channel_id_fkey" FOREIGN KEY ("publisher_channel_id") REFERENCES "publisher_channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_scan_job_id_fkey" FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_files" ADD CONSTRAINT "content_files_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_image_reference_id_fkey" FOREIGN KEY ("image_reference_id") REFERENCES "content_images"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "guideline_documents" ADD CONSTRAINT "guideline_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rule_sets" ADD CONSTRAINT "product_rule_sets_product_rule_id_fkey" FOREIGN KEY ("product_rule_id") REFERENCES "product_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rule_sets" ADD CONSTRAINT "rule_set_rules_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rules" ADD CONSTRAINT "product_rules_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_last_scan_job_id_fkey" FOREIGN KEY ("last_scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rule_violation_stats" ADD CONSTRAINT "rule_violation_stats_affiliate_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rule_violation_stats" ADD CONSTRAINT "rule_violation_stats_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_job_channels" ADD CONSTRAINT "scan_job_channels_affiliate_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_job_channels" ADD CONSTRAINT "scan_job_channels_scan_job_id_fkey" FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_job_product_focus" ADD CONSTRAINT "scan_job_product_focus_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_job_product_focus" ADD CONSTRAINT "scan_job_product_focus_scan_job_id_fkey" FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_job_runs" ADD CONSTRAINT "scan_job_runs_publisher_channel_id_fkey" FOREIGN KEY ("publisher_channel_id") REFERENCES "publisher_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_job_runs" ADD CONSTRAINT "scan_job_runs_scan_job_id_fkey" FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_default_channel_rule_set_id_fkey" FOREIGN KEY ("default_channel_rule_set_id") REFERENCES "rule_sets"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_default_product_rule_set_id_fkey" FOREIGN KEY ("default_product_rule_set_id") REFERENCES "rule_sets"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_global_rule_set_id_fkey" FOREIGN KEY ("global_rule_set_id") REFERENCES "rule_sets"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "channel_rule_sets" ADD CONSTRAINT "channel_rule_sets_channel_rule_id_fkey" FOREIGN KEY ("channel_rule_id") REFERENCES "channel_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "channel_rule_sets" ADD CONSTRAINT "channel_rule_sets_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "channel_rules" ADD CONSTRAINT "channel_rules_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_channel_rule_overrides" ADD CONSTRAINT "product_channel_rule_overrides_channel_rule_id_fkey" FOREIGN KEY ("channel_rule_id") REFERENCES "channel_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_channel_rule_overrides" ADD CONSTRAINT "product_channel_rule_overrides_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rule_overrides" ADD CONSTRAINT "product_rule_overrides_product_rule_id_fkey" FOREIGN KEY ("product_rule_id") REFERENCES "product_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rule_overrides" ADD CONSTRAINT "product_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rule_set_assignments" ADD CONSTRAINT "product_rule_set_assignments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rule_set_assignments" ADD CONSTRAINT "product_rule_set_assignments_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publisher_channels" ADD CONSTRAINT "affiliate_channels_affiliate_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publisher_channel_configs" ADD CONSTRAINT "publisher_channel_configs_publisher_channel_id_fkey" FOREIGN KEY ("publisher_channel_id") REFERENCES "publisher_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_products" ADD CONSTRAINT "affiliate_products_affiliate_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publisher_products" ADD CONSTRAINT "affiliate_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publishers" ADD CONSTRAINT "affiliates_last_scan_job_id_fkey" FOREIGN KEY ("last_scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publishers" ADD CONSTRAINT "affiliates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_job_publishers" ADD CONSTRAINT "scan_job_affiliates_affiliate_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_job_publishers" ADD CONSTRAINT "scan_job_affiliates_scan_job_id_fkey" FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "flag_comments" ADD CONSTRAINT "flag_comments_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_comments" ADD CONSTRAINT "flag_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
