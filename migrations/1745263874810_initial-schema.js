'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = async (pgm) => {
  // Enable UUID generation if not already enabled
  // pgm.createExtension('pgcrypto', { ifNotExists: true }); // Alternative: gen_random_uuid() is built-in in newer PG versions

  // Organizations Table
  pgm.createTable('organizations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(255)', notNull: true },
    settings: { type: 'jsonb', default: '{}' },
    auto_approval_threshold: { type: 'decimal(5, 2)', default: null },
    auto_approval_action: {
      type: 'varchar(50)',
      check: "auto_approval_action IN ('pending_remediation', 'closed')",
      default: 'pending_remediation'
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });

  // Users Table
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    name: { type: 'varchar(255)', notNull: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(50)', notNull: true, check: "role IN ('admin', 'reviewer')" },
    settings: { type: 'jsonb', default: '{}' },
    last_login: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('users', 'organization_id');
  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'role');

  // Scan Jobs Table (Needed before Affiliates/Products due to FK)
  pgm.createTable('scan_jobs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(255)' },
    description: { type: 'text' },
    status: { type: 'varchar(50)', notNull: true, check: "status IN ('pending', 'in_progress', 'completed', 'failed')" },
    source: { type: 'varchar(50)', notNull: true, check: "source IN ('scheduled', 'manual')" },
    scan_all_affiliates: { type: 'boolean', notNull: true, default: false },
    platform_filter: { type: 'varchar(50)', check: "platform_filter IN ('all', 'instagram', 'tiktok', 'youtube')" },
    start_time: { type: 'timestamp' },
    end_time: { type: 'timestamp' },
    created_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('scan_jobs', 'status');
  pgm.createIndex('scan_jobs', 'source');
  pgm.createIndex('scan_jobs', 'created_by');
  pgm.createIndex('scan_jobs', 'start_time');

  // Affiliates Table
  pgm.createTable('affiliates', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    status: { type: 'varchar(50)', notNull: true, check: "status IN ('onboarding', 'active', 'removed')" },
    contact_info: { type: 'jsonb', notNull: true, default: '{}' },
    last_scan_date: { type: 'timestamp' },
    last_scan_job_id: { type: 'uuid', references: 'scan_jobs', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('affiliates', 'organization_id');
  pgm.createIndex('affiliates', 'status');
  pgm.createIndex('affiliates', 'name');

  // Affiliate Channels Table
  pgm.createTable('affiliate_channels', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    affiliate_id: { type: 'uuid', notNull: true, references: 'affiliates', onDelete: 'CASCADE' },
    platform: { type: 'varchar(50)', notNull: true, check: "platform IN ('instagram', 'tiktok', 'youtube')" },
    channel_url: { type: 'varchar(255)', notNull: true },
    status: { type: 'varchar(50)', notNull: true, check: "status IN ('onboarding', 'active', 'removed')" },
    added_date: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    last_scanned: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('affiliate_channels', 'affiliate_id');
  pgm.createIndex('affiliate_channels', 'platform');
  pgm.createIndex('affiliate_channels', 'status');

  // Products Table
  pgm.createTable('products', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    primary_issuer: { type: 'varchar(255)' },
    fee: { type: 'decimal(10, 2)' },
    marketing_bullets: { type: 'jsonb', default: '[]' },
    last_scan_date: { type: 'timestamp' },
    last_scan_job_id: { type: 'uuid', references: 'scan_jobs', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('products', 'organization_id');
  pgm.createIndex('products', 'primary_issuer');
  pgm.createIndex('products', 'name');

  // Rule Sets Table
  pgm.createTable('rule_sets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    is_global: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('rule_sets', 'organization_id');
  pgm.createIndex('rule_sets', 'is_global');

  // Rules Table
  pgm.createTable('rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text', notNull: true },
    rule_type: { type: 'varchar(50)', notNull: true, check: "rule_type IN ('document_based', 'manual')" },
    manual_text: { type: 'text' },
    version: { type: 'varchar(50)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('rules', 'organization_id');
  pgm.createIndex('rules', 'version');

  // Rule Set Rules Table
  pgm.createTable('rule_set_rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    rule_set_id: { type: 'uuid', notNull: true, references: 'rule_sets', onDelete: 'CASCADE' },
    rule_id: { type: 'uuid', notNull: true, references: 'rules', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('rule_set_rules', 'rule_set_rules_unique', { unique: ['rule_set_id', 'rule_id'] });
  pgm.createIndex('rule_set_rules', 'rule_set_id');
  pgm.createIndex('rule_set_rules', 'rule_id');

  // Product Rule Sets Table
  pgm.createTable('product_rule_sets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    rule_set_id: { type: 'uuid', notNull: true, references: 'rule_sets', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('product_rule_sets', 'product_rule_sets_unique', { unique: ['product_id', 'rule_set_id'] });
  pgm.createIndex('product_rule_sets', 'product_id');
  pgm.createIndex('product_rule_sets', 'rule_set_id');

  // Guideline Documents Table
  pgm.createTable('guideline_documents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    rule_id: { type: 'uuid', notNull: true, references: 'rules', onDelete: 'CASCADE' },
    file_name: { type: 'varchar(255)', notNull: true },
    file_path: { type: 'varchar(255)', notNull: true },
    file_type: { type: 'varchar(50)', notNull: true },
    file_size: { type: 'bigint', notNull: true },
    version: { type: 'varchar(50)', notNull: true },
    upload_date: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    uploaded_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' }
  });
  pgm.createIndex('guideline_documents', 'rule_id');
  pgm.createIndex('guideline_documents', 'uploaded_by');

  // Product Rule Table (for exclusions/additions)
  pgm.createTable('product_rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    rule_id: { type: 'uuid', notNull: true, references: 'rules', onDelete: 'CASCADE' },
    is_excluded: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('product_rules', 'product_rules_unique', { unique: ['product_id', 'rule_id'] });
  pgm.createIndex('product_rules', 'product_id');
  pgm.createIndex('product_rules', 'rule_id');

  // Affiliate Product Table
  pgm.createTable('affiliate_products', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    affiliate_id: { type: 'uuid', notNull: true, references: 'affiliates', onDelete: 'CASCADE' },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('affiliate_products', 'affiliate_products_unique', { unique: ['affiliate_id', 'product_id'] });
  pgm.createIndex('affiliate_products', 'affiliate_id');
  pgm.createIndex('affiliate_products', 'product_id');

  // Scan Job Affiliates Table
  pgm.createTable('scan_job_affiliates', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    scan_job_id: { type: 'uuid', notNull: true, references: 'scan_jobs', onDelete: 'CASCADE' },
    affiliate_id: { type: 'uuid', notNull: true, references: 'affiliates', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('scan_job_affiliates', 'scan_job_affiliates_unique', { unique: ['scan_job_id', 'affiliate_id'] });
  pgm.createIndex('scan_job_affiliates', 'scan_job_id');
  pgm.createIndex('scan_job_affiliates', 'affiliate_id');

  // Scan Job Channels Table
  pgm.createTable('scan_job_channels', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    scan_job_id: { type: 'uuid', notNull: true, references: 'scan_jobs', onDelete: 'CASCADE' },
    platform: { type: 'varchar(50)', notNull: true, check: "platform IN ('instagram', 'tiktok', 'youtube')" },
    channel_url: { type: 'varchar(255)', notNull: true },
    affiliate_id: { type: 'uuid', references: 'affiliates', onDelete: 'CASCADE' }, // Can be null if scanning specific URLs not tied to a known affiliate
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('scan_job_channels', 'scan_job_id');
  pgm.createIndex('scan_job_channels', 'platform');
  pgm.createIndex('scan_job_channels', 'affiliate_id');

  // Scan Job Product Focus Table
  pgm.createTable('scan_job_product_focus', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    scan_job_id: { type: 'uuid', notNull: true, references: 'scan_jobs', onDelete: 'CASCADE' },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('scan_job_product_focus', 'scan_job_product_focus_unique', { unique: ['scan_job_id', 'product_id'] });
  pgm.createIndex('scan_job_product_focus', 'scan_job_id');
  pgm.createIndex('scan_job_product_focus', 'product_id');

  // Content Items Table
  pgm.createTable('content_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    scan_job_id: { type: 'uuid', notNull: true, references: 'scan_jobs', onDelete: 'CASCADE' },
    affiliate_id: { type: 'uuid', notNull: true, references: 'affiliates', onDelete: 'CASCADE' },
    channel_id: { type: 'uuid', notNull: true, references: 'affiliate_channels', onDelete: 'CASCADE' },
    platform: { type: 'varchar(50)', notNull: true, check: "platform IN ('instagram', 'tiktok', 'youtube')" },
    channel_url: { type: 'varchar(255)', notNull: true },
    url: { type: 'varchar(255)', notNull: true },
    caption_transcript: { type: 'text' },
    content_type: { type: 'varchar(50)', notNull: true, check: "content_type IN ('text', 'image', 'mixed')" },
    scan_date: { type: 'timestamp', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('content_items', 'scan_job_id');
  pgm.createIndex('content_items', 'affiliate_id');
  pgm.createIndex('content_items', 'channel_id');
  pgm.createIndex('content_items', 'platform');
  pgm.createIndex('content_items', 'scan_date');
  pgm.createIndex('content_items', 'content_type');

  // Content Images Table
  pgm.createTable('content_images', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    content_item_id: { type: 'uuid', notNull: true, references: 'content_items', onDelete: 'CASCADE' },
    image_type: { type: 'varchar(50)', notNull: true }, // e.g., 'screenshot', 'original'
    file_path: { type: 'varchar(255)', notNull: true },
    file_size: { type: 'bigint', notNull: true },
    width: { type: 'integer' },
    height: { type: 'integer' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('content_images', 'content_item_id');

  // Flags Table
  pgm.createTable('flags', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    content_item_id: { type: 'uuid', notNull: true, references: 'content_items', onDelete: 'CASCADE' },
    rule_id: { type: 'uuid', notNull: true, references: 'rules', onDelete: 'CASCADE' },
    ai_confidence: { type: 'decimal(5, 2)', notNull: true },
    status: { type: 'varchar(50)', notNull: true, check: "status IN ('new', 'in_review', 'pending_remediation', 'remediated', 'closed')" },
    reviewer_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    internal_comments: { type: 'text' },
    ai_feedback: { type: 'text' }, // Feedback from AI on why it flagged
    rule_citation: { type: 'text' }, // Specific text from rule document if applicable
    rule_section: { type: 'varchar(255)' }, // Section/page number in rule document
    context_text: { type: 'text' }, // Snippet of text where violation occurred
    context_start_index: { type: 'integer' },
    context_end_index: { type: 'integer' },
    image_reference_id: { type: 'uuid', references: 'content_images', onDelete: 'SET NULL' }, // Reference to specific image if violation is visual
    flag_source: { type: 'varchar(50)', notNull: true, default: 'ai', check: "flag_source IN ('ai', 'manual', 'system')" },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('flags', 'content_item_id');
  pgm.createIndex('flags', 'rule_id');
  pgm.createIndex('flags', 'status');
  pgm.createIndex('flags', 'reviewer_id');
  pgm.createIndex('flags', 'ai_confidence');
  pgm.createIndex('flags', 'flag_source');

  // AI Feedback Examples Table
  pgm.createTable('ai_feedback_examples', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    content_snippet: { type: 'text', notNull: true },
    rule_id: { type: 'uuid', notNull: true, references: 'rules', onDelete: 'CASCADE' },
    ai_verdict: { type: 'boolean', notNull: true }, // What the AI originally decided
    human_verdict: { type: 'boolean', notNull: true }, // What the human decided
    confidence_score: { type: 'decimal(5, 2)', notNull: true }, // AI's confidence
    is_correct: { type: 'boolean', notNull: true }, // Was the AI correct?
    tags: { type: 'jsonb', default: '[]' }, // For categorization
    content_item_id: { type: 'uuid', references: 'content_items', onDelete: 'SET NULL' },
    reviewer_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    image_reference_id: { type: 'uuid', references: 'content_images', onDelete: 'SET NULL' },
    selection_reason: { type: 'text' }, // Why was this example selected?
    is_selected_for_training: { type: 'boolean', notNull: true, default: false },
    original_flag_source: { type: 'varchar(50)', check: "original_flag_source IN ('ai', 'manual', 'system')" },
    is_current: { type: 'boolean', notNull: true, default: true }, // Is this example still relevant?
    obsolescence_reason: { type: 'text' },
    obsolescence_date: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('ai_feedback_examples', 'rule_id');
  pgm.createIndex('ai_feedback_examples', 'is_correct');
  pgm.createIndex('ai_feedback_examples', 'reviewer_id');
  pgm.createIndex('ai_feedback_examples', 'content_item_id');
  pgm.createIndex('ai_feedback_examples', 'is_selected_for_training');
  pgm.createIndex('ai_feedback_examples', 'is_current');

  // Rule Violation Stats Table
  pgm.createTable('rule_violation_stats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    rule_id: { type: 'uuid', notNull: true, references: 'rules', onDelete: 'CASCADE' },
    issuer: { type: 'varchar(255)' }, // Optional: Filter stats by issuer
    product_id: { type: 'uuid', references: 'products', onDelete: 'SET NULL' }, // Optional: Filter stats by product
    affiliate_id: { type: 'uuid', references: 'affiliates', onDelete: 'SET NULL' }, // Optional: Filter stats by affiliate
    time_period: { type: 'varchar(50)', notNull: true }, // e.g., 'daily', 'weekly', 'monthly'
    period_start_date: { type: 'date', notNull: true },
    period_end_date: { type: 'date', notNull: true },
    content_count: { type: 'integer', notNull: true, default: 0 },
    violation_count: { type: 'integer', notNull: true, default: 0 },
    violation_rate: { type: 'decimal(5, 2)', notNull: true, default: 0 },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('rule_violation_stats', 'rule_id');
  pgm.createIndex('rule_violation_stats', 'issuer');
  pgm.createIndex('rule_violation_stats', 'product_id');
  pgm.createIndex('rule_violation_stats', 'affiliate_id');
  pgm.createIndex('rule_violation_stats', ['time_period', 'period_start_date']); // Composite index

  // Audit Logs Table
  pgm.createTable('audit_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    action: { type: 'varchar(255)', notNull: true },
    details: { type: 'jsonb', notNull: true },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('audit_logs', 'action');
  pgm.createIndex('audit_logs', 'user_id');
  pgm.createIndex('audit_logs', 'created_at');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = async (pgm) => {
  // Drop tables in reverse order of creation to respect foreign key constraints
  pgm.dropTable('audit_logs');
  pgm.dropTable('rule_violation_stats');
  pgm.dropTable('ai_feedback_examples');
  pgm.dropTable('flags');
  pgm.dropTable('content_images');
  pgm.dropTable('content_items');
  pgm.dropTable('scan_job_product_focus');
  pgm.dropTable('scan_job_channels');
  pgm.dropTable('scan_job_affiliates');
  pgm.dropTable('affiliate_products');
  pgm.dropTable('product_rules');
  pgm.dropTable('guideline_documents');
  pgm.dropTable('product_rule_sets');
  pgm.dropTable('rule_set_rules');
  pgm.dropTable('rules');
  pgm.dropTable('rule_sets');
  pgm.dropTable('products');
  pgm.dropTable('affiliate_channels');
  pgm.dropTable('affiliates');
  pgm.dropTable('scan_jobs'); // Dropped after affiliates/products
  pgm.dropTable('users');
  pgm.dropTable('organizations');
};
