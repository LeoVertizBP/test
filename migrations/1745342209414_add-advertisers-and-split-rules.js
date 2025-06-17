'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = async (pgm) => {
  console.log("Starting migration: add-advertisers-and-split-rules");

  // --- 1. Rename "Affiliate" to "Publisher" ---
  console.log("Renaming affiliate tables and columns to publisher...");
  pgm.renameTable('affiliates', 'publishers');
  pgm.renameTable('affiliate_channels', 'publisher_channels');
  pgm.renameTable('affiliate_products', 'publisher_products');
  pgm.renameTable('scan_job_affiliates', 'scan_job_publishers');

  // Rename columns (ensure constraints are handled if needed)
  pgm.renameColumn('publisher_channels', 'affiliate_id', 'publisher_id');
  pgm.renameColumn('publisher_products', 'affiliate_id', 'publisher_id');
  pgm.renameColumn('scan_job_publishers', 'affiliate_id', 'publisher_id');
  pgm.renameColumn('scan_job_channels', 'affiliate_id', 'publisher_id'); // Note: This column allows NULL
  pgm.renameColumn('content_items', 'affiliate_id', 'publisher_id');
  pgm.renameColumn('content_items', 'channel_id', 'publisher_channel_id'); // Assuming channel_id refers to affiliate_channels
  pgm.renameColumn('rule_violation_stats', 'affiliate_id', 'publisher_id');
  pgm.renameColumn('scan_jobs', 'scan_all_affiliates', 'scan_all_publishers');
  console.log("Affiliate to publisher renaming complete.");

  // --- 2. Add `advertisers` Table ---
  console.log("Creating advertisers table...");
  pgm.createTable('advertisers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    settings: { type: 'jsonb', default: '{}' },
    // Default rule set IDs will be added after rule_sets table is modified
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('advertisers', 'organization_id');
  console.log("Advertisers table created.");

  // --- 3. Modify `products` Table ---
  console.log("Modifying products table...");
  // Drop FK constraint before dropping column
  pgm.dropConstraint('products', 'products_organization_id_fkey');
  pgm.dropColumn('products', 'organization_id');
  pgm.addColumn('products', {
    advertiser_id: { type: 'uuid', notNull: true, references: 'advertisers', onDelete: 'CASCADE' }
  });
  pgm.createIndex('products', 'advertiser_id');
  console.log("Products table modified.");

  // --- 4. Split `rules` Table ---
  console.log("Splitting rules table...");

  // --- 4a. Rename Existing Join Table FIRST ---
  console.log("Renaming existing product_rules (join table) to product_rule_overrides...");
  // Drop FK constraint referencing rules(id) before renaming the target table
  pgm.dropConstraint('product_rules', 'product_rules_rule_id_fkey');
  pgm.renameTable('product_rules', 'product_rule_overrides');
  console.log("Renamed product_rules join table to product_rule_overrides.");

  // --- 4b. Rename Main Rules Table ---
  // Rename rules -> product_rules
  pgm.renameTable('rules', 'product_rules');
  console.log("Renamed rules to product_rules.");

  // --- 4c. Modify New product_rules Table ---
  // Modify product_rules: change organization_id FK to advertiser_id FK
  // Need to drop constraints referencing the old rules table first
  console.log("Dropping constraints referencing old rules table...");
  pgm.dropConstraint('rule_set_rules', 'rule_set_rules_rule_id_fkey'); // Drop constraint on the original table name
  pgm.dropConstraint('guideline_documents', 'guideline_documents_rule_id_fkey');
  // pgm.dropConstraint('product_rule_overrides', 'product_rules_rule_id_fkey'); // Constraint was dropped before renaming the table in step 4a
  pgm.dropConstraint('flags', 'flags_rule_id_fkey');
  pgm.dropConstraint('ai_feedback_examples', 'ai_feedback_examples_rule_id_fkey');
  pgm.dropConstraint('rule_violation_stats', 'rule_violation_stats_rule_id_fkey');
  console.log("Dropped constraints.");

  console.log("Modifying product_rules table...");
  pgm.dropConstraint('product_rules', 'rules_organization_id_fkey'); // Use original table name for constraint drop
  pgm.dropColumn('product_rules', 'organization_id');
  pgm.addColumn('product_rules', {
    advertiser_id: { type: 'uuid', notNull: true, references: 'advertisers', onDelete: 'CASCADE' }
  });
  pgm.createIndex('product_rules', 'advertiser_id');
  console.log("Product_rules table (formerly rules) modified.");

  // --- 4d. Create channel_rules table ---
  console.log("Creating channel_rules table...");
  pgm.createTable('channel_rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    advertiser_id: { type: 'uuid', notNull: true, references: 'advertisers', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text', notNull: true },
    rule_type: { type: 'varchar(50)', notNull: true, check: "rule_type IN ('document_based', 'manual')" },
    manual_text: { type: 'text' },
    applicable_channel: { type: 'varchar(50)' }, // e.g., 'instagram', 'tiktok', 'youtube', 'any'
    applicable_issuer: { type: 'varchar(255)' }, // e.g., 'chase', 'amex', 'any'
    version: { type: 'varchar(50)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('channel_rules', 'advertiser_id');
  pgm.createIndex('channel_rules', 'applicable_channel');
  pgm.createIndex('channel_rules', 'applicable_issuer');
  console.log("Channel_rules table created.");
  console.log("Rules table split complete.");


  // --- 5. Modify `rule_sets` Table ---
  console.log("Modifying rule_sets table...");
  pgm.dropConstraint('rule_sets', 'rule_sets_organization_id_fkey');
  pgm.dropColumn('rule_sets', 'organization_id');
  pgm.addColumn('rule_sets', {
    advertiser_id: { type: 'uuid', notNull: true, references: 'advertisers', onDelete: 'CASCADE' },
    set_type: { type: 'varchar(50)', notNull: true, check: "set_type IN ('product', 'channel')" },
    is_default: { type: 'boolean', notNull: true, default: false }
  });
  pgm.createIndex('rule_sets', 'advertiser_id');
  pgm.createIndex('rule_sets', 'set_type');
  console.log("Rule_sets table modified.");

  // Add default rule set FKs to advertisers table now
  console.log("Adding default rule set FKs to advertisers table...");
  pgm.addColumn('advertisers', {
      default_product_rule_set_id: { type: 'uuid', references: 'rule_sets', onDelete: 'SET NULL' },
      default_channel_rule_set_id: { type: 'uuid', references: 'rule_sets', onDelete: 'SET NULL' }
  });
   console.log("Default rule set FKs added to advertisers.");

  // --- 6. Split `rule_set_rules` Linking Table ---
  console.log("Splitting rule_set_rules table...");

  // --- 6a. Drop the original product_rule_sets table first to avoid name conflict ---
  console.log("Dropping original product_rule_sets table...");
  pgm.dropTable('product_rule_sets');
  console.log("Dropped original product_rule_sets table.");

  // --- 6b. Rename rule_set_rules -> product_rule_sets ---
  pgm.renameTable('rule_set_rules', 'product_rule_sets');
  console.log("Renamed rule_set_rules to product_rule_sets.");

  // Update FK in product_rule_sets
  pgm.renameColumn('product_rule_sets', 'rule_id', 'product_rule_id');
  // Re-add constraint (using new table/column names)
  pgm.addConstraint('product_rule_sets', 'product_rule_sets_product_rule_id_fkey', {
    foreignKeys: {
      columns: 'product_rule_id',
      references: 'product_rules(id)',
      onDelete: 'CASCADE'
    }
  });
  console.log("Updated product_rule_sets table.");

  // Create channel_rule_sets table
  console.log("Creating channel_rule_sets table...");
  pgm.createTable('channel_rule_sets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    rule_set_id: { type: 'uuid', notNull: true, references: 'rule_sets', onDelete: 'CASCADE' },
    channel_rule_id: { type: 'uuid', notNull: true, references: 'channel_rules', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('channel_rule_sets', 'channel_rule_sets_unique', { unique: ['rule_set_id', 'channel_rule_id'] });
  pgm.createIndex('channel_rule_sets', 'rule_set_id');
  pgm.createIndex('channel_rule_sets', 'channel_rule_id');
  console.log("Channel_rule_sets table created.");
  console.log("Rule_set_rules split complete.");


  // --- 7. Create `product_rule_set_assignments` Table ---
  console.log("Creating product_rule_set_assignments table...");
  pgm.createTable('product_rule_set_assignments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    rule_set_id: { type: 'uuid', notNull: true, references: 'rule_sets', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('product_rule_set_assignments', 'product_rule_set_assignments_unique', { unique: ['product_id', 'rule_set_id'] });
  pgm.createIndex('product_rule_set_assignments', 'product_id');
  pgm.createIndex('product_rule_set_assignments', 'rule_set_id');
  console.log("Product_rule_set_assignments table created.");


  // --- 8. Modify Override Tables ---
  console.log("Modifying override tables...");
  // product_rule_overrides was already renamed in step 4a

  // Update FK and change is_excluded to inclusion_type in product_rule_overrides
  pgm.renameColumn('product_rule_overrides', 'rule_id', 'product_rule_id'); // Rename the FK column first
  pgm.dropColumn('product_rule_overrides', 'is_excluded');
  pgm.addColumn('product_rule_overrides', {
    inclusion_type: { type: 'varchar(10)', notNull: true, check: "inclusion_type IN ('include', 'exclude')" }
  });
  // Re-add constraint referencing the new product_rules table
  pgm.addConstraint('product_rule_overrides', 'product_rule_overrides_product_rule_id_fkey', {
    foreignKeys: {
      columns: 'product_rule_id',
      references: 'product_rules(id)',
      onDelete: 'CASCADE'
    }
  });
  console.log("Updated product_rule_overrides table.");

  // Create product_channel_rule_overrides table
  console.log("Creating product_channel_rule_overrides table...");
  pgm.createTable('product_channel_rule_overrides', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    channel_rule_id: { type: 'uuid', notNull: true, references: 'channel_rules', onDelete: 'CASCADE' },
    inclusion_type: { type: 'varchar(10)', notNull: true, check: "inclusion_type IN ('include', 'exclude')" },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('product_channel_rule_overrides', 'product_channel_rule_overrides_unique', { unique: ['product_id', 'channel_rule_id'] });
  pgm.createIndex('product_channel_rule_overrides', 'product_id');
  pgm.createIndex('product_channel_rule_overrides', 'channel_rule_id');
  console.log("Product_channel_rule_overrides table created.");
  console.log("Override table modifications complete.");


  // --- 9. Add `rule_type` to Analysis Tables ---
  console.log("Adding rule_type to analysis tables...");
  // Note: We dropped the rule_id FKs earlier. We won't re-add them here
  // as rule_id now refers to two different tables based on rule_type.
  // Application logic will handle joining correctly.
  pgm.addColumn('flags', { rule_type: { type: 'varchar(50)', notNull: true, check: "rule_type IN ('product', 'channel')" } });
  pgm.addColumn('ai_feedback_examples', { rule_type: { type: 'varchar(50)', notNull: true, check: "rule_type IN ('product', 'channel')" } });
  pgm.addColumn('guideline_documents', { rule_type: { type: 'varchar(50)', notNull: true, check: "rule_type IN ('product', 'channel')" } });
  pgm.addColumn('rule_violation_stats', { rule_type: { type: 'varchar(50)', notNull: true, check: "rule_type IN ('product', 'channel')" } });
  console.log("Added rule_type column to analysis tables.");

  console.log("Migration add-advertisers-and-split-rules completed successfully.");
};

// Note: The down migration is complex due to renames and structural changes.
// It's often safer to restore from backup or create a new migration to revert specific parts if needed.
// A basic down migration is provided but might need adjustments based on specific needs.
exports.down = async (pgm) => {
  console.log("Starting down migration: add-advertisers-and-split-rules");

  // Revert analysis tables
  pgm.dropColumn('flags', 'rule_type');
  pgm.dropColumn('ai_feedback_examples', 'rule_type');
  pgm.dropColumn('guideline_documents', 'rule_type');
  pgm.dropColumn('rule_violation_stats', 'rule_type');
  // Re-add FKs (assuming they should point back to the original 'rules' table name)
  // This might fail if data integrity is violated during the up migration.
  // Consider adding these constraints manually after verifying data if needed.
  // pgm.addConstraint('flags', 'flags_rule_id_fkey', 'FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE');
  // pgm.addConstraint('ai_feedback_examples', 'ai_feedback_examples_rule_id_fkey', 'FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE');
  // pgm.addConstraint('guideline_documents', 'guideline_documents_rule_id_fkey', 'FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE');
  // pgm.addConstraint('rule_violation_stats', 'rule_violation_stats_rule_id_fkey', 'FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE');


  // Revert override tables
  pgm.dropTable('product_channel_rule_overrides');
  // Revert product_rule_overrides
  pgm.dropConstraint('product_rule_overrides', 'product_rule_overrides_product_rule_id_fkey');
  pgm.dropColumn('product_rule_overrides', 'inclusion_type');
  pgm.addColumn('product_rule_overrides', { is_excluded: { type: 'boolean', notNull: true, default: false } });
  pgm.renameColumn('product_rule_overrides', 'product_rule_id', 'rule_id');
  // Rename product_rule_overrides back to product_rules (join table) - MUST happen AFTER renaming main rules table back
  // pgm.renameTable('product_rule_overrides', 'product_rules'); // Moved down

  // Revert rule set assignments
  pgm.dropTable('product_rule_set_assignments');

  // Revert rule set linking tables
  pgm.dropTable('channel_rule_sets');
  // Rename product_rule_sets back to rule_set_rules
  pgm.dropConstraint('product_rule_sets', 'product_rule_sets_product_rule_id_fkey'); // Drop the new FK
  pgm.renameColumn('product_rule_sets', 'product_rule_id', 'rule_id');
  pgm.renameTable('product_rule_sets', 'rule_set_rules');
  // Recreate the original product_rule_sets table
  pgm.createTable('product_rule_sets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    rule_set_id: { type: 'uuid', notNull: true, references: 'rule_sets', onDelete: 'CASCADE' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
  });
   pgm.addConstraint('product_rule_sets', 'product_rule_sets_unique', { unique: ['product_id', 'rule_set_id'] });
   pgm.createIndex('product_rule_sets', 'product_id');
   pgm.createIndex('product_rule_sets', 'rule_set_id');


  // Revert rule_sets table
  pgm.dropColumn('rule_sets', 'advertiser_id');
  pgm.dropColumn('rule_sets', 'set_type');
  pgm.dropColumn('rule_sets', 'is_default');
  pgm.addColumn('rule_sets', { organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' } }); // Add back org FK

  // Revert advertisers table defaults (drop columns added after table creation)
   pgm.dropColumn('advertisers', 'default_product_rule_set_id');
   pgm.dropColumn('advertisers', 'default_channel_rule_set_id');

  // Revert rules split
  pgm.dropTable('channel_rules');
  // Revert main product_rules table back to rules
  pgm.dropColumn('product_rules', 'advertiser_id');
  pgm.addColumn('product_rules', { organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' } }); // Add back org FK
  pgm.renameTable('product_rules', 'rules'); // Rename back main rules table

  // NOW rename product_rule_overrides back to product_rules (join table)
  pgm.renameTable('product_rule_overrides', 'product_rules');
  // Re-add original FK constraint for the join table
  pgm.addConstraint('product_rules', 'product_rules_rule_id_fkey', 'FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE');


  // Revert products table
  pgm.dropColumn('products', 'advertiser_id');
  pgm.addColumn('products', { organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' } });

  // Revert advertisers table
  pgm.dropTable('advertisers');

  // Revert publisher renames
  pgm.renameColumn('rule_violation_stats', 'publisher_id', 'affiliate_id');
  pgm.renameColumn('content_items', 'publisher_channel_id', 'channel_id');
  pgm.renameColumn('content_items', 'publisher_id', 'affiliate_id');
  pgm.renameColumn('scan_job_channels', 'publisher_id', 'affiliate_id');
  pgm.renameColumn('scan_job_publishers', 'publisher_id', 'affiliate_id');
  pgm.renameColumn('publisher_products', 'publisher_id', 'affiliate_id');
  pgm.renameColumn('publisher_channels', 'publisher_id', 'affiliate_id');
  pgm.renameColumn('scan_jobs', 'scan_all_publishers', 'scan_all_affiliates');

  pgm.renameTable('scan_job_publishers', 'scan_job_affiliates');
  pgm.renameTable('publisher_products', 'affiliate_products');
  pgm.renameTable('publisher_channels', 'affiliate_channels');
  pgm.renameTable('publishers', 'affiliates');

  console.log("Down migration add-advertisers-and-split-rules completed.");
};
