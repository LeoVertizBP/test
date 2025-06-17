-- Organizations Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    auto_approval_threshold DECIMAL(5, 2) DEFAULT NULL,
    auto_approval_action VARCHAR(50) CHECK (auto_approval_action IN ('pending_remediation', 'closed')) DEFAULT 'pending_remediation',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Advertisers Table (NEW)
CREATE TABLE advertisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    default_product_rule_set_id UUID, -- FK added later
    default_channel_rule_set_id UUID, -- FK added later
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_advertisers_organization_id ON advertisers(organization_id);

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'reviewer')),
    settings JSONB DEFAULT '{}',
    last_login TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Publishers Table (Renamed from affiliates)
CREATE TABLE publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('onboarding', 'active', 'removed')),
    contact_info JSONB NOT NULL DEFAULT '{}',
    last_scan_date TIMESTAMP,
    last_scan_job_id UUID, -- FK added later
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_publishers_organization_id ON publishers(organization_id);
CREATE INDEX idx_publishers_status ON publishers(status);
CREATE INDEX idx_publishers_name ON publishers(name);

-- Publisher Channels Table (Renamed from affiliate_channels)
CREATE TABLE publisher_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE, -- Renamed FK column
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
    channel_url VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('onboarding', 'active', 'removed')),
    added_date TIMESTAMP NOT NULL DEFAULT NOW(),
    last_scanned TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_publisher_channels_publisher_id ON publisher_channels(publisher_id);
CREATE INDEX idx_publisher_channels_platform ON publisher_channels(platform);
CREATE INDEX idx_publisher_channels_status ON publisher_channels(status);

-- Products Table (Modified: advertiser_id instead of organization_id)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE, -- Changed FK
    name VARCHAR(255) NOT NULL,
    primary_issuer VARCHAR(255),
    fee DECIMAL(10, 2),
    marketing_bullets JSONB DEFAULT '[]',
    last_scan_date TIMESTAMP,
    last_scan_job_id UUID, -- FK added later
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_advertiser_id ON products(advertiser_id); -- Changed index
CREATE INDEX idx_products_primary_issuer ON products(primary_issuer);
CREATE INDEX idx_products_name ON products(name);

-- Rule Sets Table (Modified: advertiser_id, set_type, is_default)
CREATE TABLE rule_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE, -- Changed FK
    name VARCHAR(255) NOT NULL,
    description TEXT,
    set_type VARCHAR(50) NOT NULL CHECK (set_type IN ('product', 'channel')), -- NEW column
    is_default BOOLEAN NOT NULL DEFAULT FALSE, -- NEW column
    is_global BOOLEAN NOT NULL DEFAULT FALSE, -- Kept for potential future use? Or remove? (Migration removed org_id, kept is_global)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rule_sets_advertiser_id ON rule_sets(advertiser_id); -- Changed index
CREATE INDEX idx_rule_sets_set_type ON rule_sets(set_type); -- NEW index
CREATE INDEX idx_rule_sets_is_global ON rule_sets(is_global);

-- Add FK constraints for default rule sets in advertisers table
ALTER TABLE advertisers ADD CONSTRAINT advertisers_default_product_rule_set_id_fkey FOREIGN KEY (default_product_rule_set_id) REFERENCES rule_sets(id) ON DELETE SET NULL;
ALTER TABLE advertisers ADD CONSTRAINT advertisers_default_channel_rule_set_id_fkey FOREIGN KEY (default_channel_rule_set_id) REFERENCES rule_sets(id) ON DELETE SET NULL;

-- Product Rules Table (Renamed from rules, Modified: advertiser_id)
CREATE TABLE product_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE, -- Changed FK
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('document_based', 'manual')),
    manual_text TEXT,
    version VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_product_rules_advertiser_id ON product_rules(advertiser_id); -- Changed index
CREATE INDEX idx_product_rules_version ON product_rules(version);

-- Channel Rules Table (NEW)
CREATE TABLE channel_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('document_based', 'manual')),
    manual_text TEXT,
    applicable_channel VARCHAR(50),
    applicable_issuer VARCHAR(255),
    version VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_channel_rules_advertiser_id ON channel_rules(advertiser_id);
CREATE INDEX idx_channel_rules_applicable_channel ON channel_rules(applicable_channel);
CREATE INDEX idx_channel_rules_applicable_issuer ON channel_rules(applicable_issuer);

-- Product Rule Sets Linking Table (Renamed from rule_set_rules, Modified: product_rule_id)
CREATE TABLE product_rule_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    product_rule_id UUID NOT NULL REFERENCES product_rules(id) ON DELETE CASCADE, -- Changed FK column and reference
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(rule_set_id, product_rule_id)
);
CREATE INDEX idx_product_rule_sets_rule_set_id ON product_rule_sets(rule_set_id);
CREATE INDEX idx_product_rule_sets_product_rule_id ON product_rule_sets(product_rule_id); -- Changed index

-- Channel Rule Sets Linking Table (NEW)
CREATE TABLE channel_rule_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    channel_rule_id UUID NOT NULL REFERENCES channel_rules(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(rule_set_id, channel_rule_id)
);
CREATE INDEX idx_channel_rule_sets_rule_set_id ON channel_rule_sets(rule_set_id);
CREATE INDEX idx_channel_rule_sets_channel_rule_id ON channel_rule_sets(channel_rule_id);

-- Product Rule Set Assignments Table (NEW)
CREATE TABLE product_rule_set_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    rule_set_id UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, rule_set_id)
);
CREATE INDEX idx_product_rule_set_assignments_product_id ON product_rule_set_assignments(product_id);
CREATE INDEX idx_product_rule_set_assignments_rule_set_id ON product_rule_set_assignments(rule_set_id);

-- Guideline Documents Table (Modified: rule_type, rule_id FK removed in migration)
CREATE TABLE guideline_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL, -- FK removed, handled by application logic
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('product', 'channel')), -- NEW column
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    version VARCHAR(50) NOT NULL,
    upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_guideline_documents_rule_id ON guideline_documents(rule_id); -- Index kept
CREATE INDEX idx_guideline_documents_rule_type ON guideline_documents(rule_type); -- NEW index
CREATE INDEX idx_guideline_documents_uploaded_by ON guideline_documents(uploaded_by);

-- Product Rule Overrides Table (Renamed from product_rules join table, Modified: product_rule_id, inclusion_type)
CREATE TABLE product_rule_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_rule_id UUID NOT NULL REFERENCES product_rules(id) ON DELETE CASCADE, -- Changed FK column and reference
    inclusion_type VARCHAR(10) NOT NULL CHECK (inclusion_type IN ('include', 'exclude')), -- Changed column
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, product_rule_id)
);
CREATE INDEX idx_product_rule_overrides_product_id ON product_rule_overrides(product_id);
CREATE INDEX idx_product_rule_overrides_product_rule_id ON product_rule_overrides(product_rule_id); -- Changed index

-- Product Channel Rule Overrides Table (NEW)
CREATE TABLE product_channel_rule_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    channel_rule_id UUID NOT NULL REFERENCES channel_rules(id) ON DELETE CASCADE,
    inclusion_type VARCHAR(10) NOT NULL CHECK (inclusion_type IN ('include', 'exclude')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, channel_rule_id)
);
CREATE INDEX idx_product_channel_rule_overrides_product_id ON product_channel_rule_overrides(product_id);
CREATE INDEX idx_product_channel_rule_overrides_channel_rule_id ON product_channel_rule_overrides(channel_rule_id);

-- Publisher Product Table (Renamed from affiliate_products)
CREATE TABLE publisher_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE, -- Renamed FK column
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(publisher_id, product_id)
);
CREATE INDEX idx_publisher_products_publisher_id ON publisher_products(publisher_id);
CREATE INDEX idx_publisher_products_product_id ON publisher_products(product_id);

-- Scan Jobs Table (Modified: scan_all_publishers)
CREATE TABLE scan_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    description TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    source VARCHAR(50) NOT NULL CHECK (source IN ('scheduled', 'manual')),
    scan_all_publishers BOOLEAN NOT NULL DEFAULT FALSE, -- Renamed column
    platform_filter VARCHAR(50) CHECK (platform_filter IN ('all', 'instagram', 'tiktok', 'youtube')),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX idx_scan_jobs_source ON scan_jobs(source);
CREATE INDEX idx_scan_jobs_created_by ON scan_jobs(created_by);
CREATE INDEX idx_scan_jobs_start_time ON scan_jobs(start_time);

-- Add FK constraints for scan jobs after tables exist
ALTER TABLE publishers ADD CONSTRAINT publishers_last_scan_job_id_fkey FOREIGN KEY (last_scan_job_id) REFERENCES scan_jobs(id) ON DELETE SET NULL;
ALTER TABLE products ADD CONSTRAINT products_last_scan_job_id_fkey FOREIGN KEY (last_scan_job_id) REFERENCES scan_jobs(id) ON DELETE SET NULL;

-- Scan Job Publishers Table (Renamed from scan_job_affiliates)
CREATE TABLE scan_job_publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_job_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE, -- Renamed FK column
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(scan_job_id, publisher_id)
);
CREATE INDEX idx_scan_job_publishers_scan_job_id ON scan_job_publishers(scan_job_id);
CREATE INDEX idx_scan_job_publishers_publisher_id ON scan_job_publishers(publisher_id);

-- Scan Job Channels Table (Modified: publisher_id)
CREATE TABLE scan_job_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_job_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
    channel_url VARCHAR(255) NOT NULL,
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE, -- Renamed FK column
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scan_job_channels_scan_job_id ON scan_job_channels(scan_job_id);
CREATE INDEX idx_scan_job_channels_platform ON scan_job_channels(platform);
CREATE INDEX idx_scan_job_channels_publisher_id ON scan_job_channels(publisher_id);

-- Scan Job Product Focus Table
CREATE TABLE scan_job_product_focus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_job_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(scan_job_id, product_id)
);
CREATE INDEX idx_scan_job_product_focus_scan_job_id ON scan_job_product_focus(scan_job_id);
CREATE INDEX idx_scan_job_product_focus_product_id ON scan_job_product_focus(product_id);

-- Content Items Table (Modified: publisher_id, publisher_channel_id)
CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_job_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE, -- Renamed FK column
    publisher_channel_id UUID NOT NULL REFERENCES publisher_channels(id) ON DELETE CASCADE, -- Renamed FK column and reference
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
    channel_url VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    caption_transcript TEXT,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('text', 'image', 'mixed')),
    scan_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_content_items_scan_job_id ON content_items(scan_job_id);
CREATE INDEX idx_content_items_publisher_id ON content_items(publisher_id);
CREATE INDEX idx_content_items_publisher_channel_id ON content_items(publisher_channel_id);
CREATE INDEX idx_content_items_platform ON content_items(platform);
CREATE INDEX idx_content_items_scan_date ON content_items(scan_date);
CREATE INDEX idx_content_items_content_type ON content_items(content_type);

-- Content Images Table
CREATE TABLE content_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    image_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_content_images_content_item_id ON content_images(content_item_id);

-- Flags Table (Modified: rule_type, rule_id FK removed in migration)
CREATE TABLE flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL, -- FK removed, handled by application logic
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('product', 'channel')), -- NEW column
    ai_confidence DECIMAL(5, 2) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('new', 'in_review', 'pending_remediation', 'remediated', 'closed')),
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    internal_comments TEXT,
    ai_feedback TEXT,
    rule_citation TEXT,
    rule_section VARCHAR(255),
    context_text TEXT,
    context_start_index INTEGER,
    context_end_index INTEGER,
    image_reference_id UUID REFERENCES content_images(id) ON DELETE SET NULL,
    flag_source VARCHAR(50) NOT NULL DEFAULT 'ai' CHECK (flag_source IN ('ai', 'manual', 'system')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flags_content_item_id ON flags(content_item_id);
CREATE INDEX idx_flags_rule_id ON flags(rule_id); -- Index kept
CREATE INDEX idx_flags_rule_type ON flags(rule_type); -- NEW index
CREATE INDEX idx_flags_status ON flags(status);
CREATE INDEX idx_flags_reviewer_id ON flags(reviewer_id);
CREATE INDEX idx_flags_ai_confidence ON flags(ai_confidence);
CREATE INDEX idx_flags_flag_source ON flags(flag_source);

-- AI Feedback Examples Table (Modified: rule_type, rule_id FK removed in migration)
CREATE TABLE ai_feedback_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_snippet TEXT NOT NULL,
    rule_id UUID NOT NULL, -- FK removed, handled by application logic
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('product', 'channel')), -- NEW column
    ai_verdict BOOLEAN NOT NULL,
    human_verdict BOOLEAN NOT NULL,
    confidence_score DECIMAL(5, 2) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    tags JSONB DEFAULT '[]',
    content_item_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    image_reference_id UUID REFERENCES content_images(id) ON DELETE SET NULL,
    selection_reason TEXT,
    is_selected_for_training BOOLEAN NOT NULL DEFAULT FALSE,
    original_flag_source VARCHAR(50) CHECK (original_flag_source IN ('ai', 'manual', 'system')),
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    obsolescence_reason TEXT,
    obsolescence_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_feedback_examples_rule_id ON ai_feedback_examples(rule_id); -- Index kept
CREATE INDEX idx_ai_feedback_examples_rule_type ON ai_feedback_examples(rule_type); -- NEW index
CREATE INDEX idx_ai_feedback_examples_is_correct ON ai_feedback_examples(is_correct);
CREATE INDEX idx_ai_feedback_examples_reviewer_id ON ai_feedback_examples(reviewer_id);
CREATE INDEX idx_ai_feedback_examples_content_item_id ON ai_feedback_examples(content_item_id);
CREATE INDEX idx_ai_feedback_examples_is_selected_for_training ON ai_feedback_examples(is_selected_for_training);
CREATE INDEX idx_ai_feedback_examples_is_current ON ai_feedback_examples(is_current);

-- Rule Violation Stats Table (Modified: rule_type, publisher_id, rule_id FK removed in migration)
CREATE TABLE rule_violation_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL, -- FK removed, handled by application logic
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('product', 'channel')), -- NEW column
    issuer VARCHAR(255),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL, -- Renamed FK column
    time_period VARCHAR(50) NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    content_count INTEGER NOT NULL DEFAULT 0,
    violation_count INTEGER NOT NULL DEFAULT 0,
    violation_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rule_violation_stats_rule_id ON rule_violation_stats(rule_id); -- Index kept
CREATE INDEX idx_rule_violation_stats_rule_type ON rule_violation_stats(rule_type); -- NEW index
CREATE INDEX idx_rule_violation_stats_issuer ON rule_violation_stats(issuer);
CREATE INDEX idx_rule_violation_stats_product_id ON rule_violation_stats(product_id);
CREATE INDEX idx_rule_violation_stats_publisher_id ON rule_violation_stats(publisher_id); -- Changed index
CREATE INDEX idx_rule_violation_stats_period ON rule_violation_stats(time_period, period_start_date);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(255) NOT NULL,
    details JSONB NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
