
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.6.0
 * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
 */
Prisma.prismaVersion = {
  client: "6.6.0",
  engine: "f676762280b54cd07c770017ed3711ddde35f37a"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.Ai_feedback_examplesScalarFieldEnum = {
  id: 'id',
  content_snippet: 'content_snippet',
  rule_id: 'rule_id',
  ai_verdict: 'ai_verdict',
  human_verdict: 'human_verdict',
  confidence_score: 'confidence_score',
  is_correct: 'is_correct',
  tags: 'tags',
  content_item_id: 'content_item_id',
  reviewer_id: 'reviewer_id',
  image_reference_id: 'image_reference_id',
  selection_reason: 'selection_reason',
  is_selected_for_training: 'is_selected_for_training',
  original_flag_source: 'original_flag_source',
  is_current: 'is_current',
  obsolescence_reason: 'obsolescence_reason',
  obsolescence_date: 'obsolescence_date',
  created_at: 'created_at',
  updated_at: 'updated_at',
  rule_type: 'rule_type'
};

exports.Prisma.Audit_logsScalarFieldEnum = {
  id: 'id',
  action: 'action',
  details: 'details',
  user_id: 'user_id',
  created_at: 'created_at'
};

exports.Prisma.Content_imagesScalarFieldEnum = {
  id: 'id',
  content_item_id: 'content_item_id',
  image_type: 'image_type',
  file_path: 'file_path',
  file_size: 'file_size',
  width: 'width',
  height: 'height',
  created_at: 'created_at',
  captured_at: 'captured_at',
  sha256: 'sha256'
};

exports.Prisma.Content_itemsScalarFieldEnum = {
  id: 'id',
  scan_job_id: 'scan_job_id',
  publisher_id: 'publisher_id',
  publisher_channel_id: 'publisher_channel_id',
  platform: 'platform',
  channel_url: 'channel_url',
  url: 'url',
  content_type: 'content_type',
  scan_date: 'scan_date',
  created_at: 'created_at',
  updated_at: 'updated_at',
  raw_data: 'raw_data',
  caption: 'caption',
  title: 'title',
  transcript: 'transcript'
};

exports.Prisma.Content_filesScalarFieldEnum = {
  id: 'id',
  contentItemId: 'contentItemId',
  version: 'version',
  state: 'state',
  fileType: 'fileType',
  filePath: 'filePath',
  sha256: 'sha256',
  createdAt: 'createdAt'
};

exports.Prisma.FlagsScalarFieldEnum = {
  id: 'id',
  content_item_id: 'content_item_id',
  rule_id: 'rule_id',
  ai_confidence: 'ai_confidence',
  reviewer_id: 'reviewer_id',
  rule_citation: 'rule_citation',
  rule_section: 'rule_section',
  context_text: 'context_text',
  context_start_index: 'context_start_index',
  context_end_index: 'context_end_index',
  image_reference_id: 'image_reference_id',
  flag_source: 'flag_source',
  created_at: 'created_at',
  updated_at: 'updated_at',
  rule_type: 'rule_type',
  ai_evaluation: 'ai_evaluation',
  product_id: 'product_id',
  ai_confidence_reasoning: 'ai_confidence_reasoning',
  ai_ruling: 'ai_ruling',
  ai_feedback_notes: 'ai_feedback_notes',
  decision_made_at: 'decision_made_at',
  human_verdict: 'human_verdict',
  human_verdict_reasoning: 'human_verdict_reasoning',
  in_review_at: 'in_review_at',
  internal_notes: 'internal_notes',
  remediation_completed_at: 'remediation_completed_at',
  reviewed_at: 'reviewed_at',
  status: 'status',
  example_selection_reason: 'example_selection_reason',
  is_learning_example: 'is_learning_example',
  rule_version_applied: 'rule_version_applied',
  librarian_consulted: 'librarian_consulted',
  librarian_examples_provided: 'librarian_examples_provided',
  resolution_method: 'resolution_method',
  content_source: 'content_source',
  transcript_end_ms: 'transcript_end_ms',
  transcript_start_ms: 'transcript_start_ms'
};

exports.Prisma.Guideline_documentsScalarFieldEnum = {
  id: 'id',
  rule_id: 'rule_id',
  file_name: 'file_name',
  file_path: 'file_path',
  file_type: 'file_type',
  file_size: 'file_size',
  version: 'version',
  upload_date: 'upload_date',
  uploaded_by: 'uploaded_by',
  rule_type: 'rule_type'
};

exports.Prisma.OrganizationsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  settings: 'settings',
  auto_approval_threshold: 'auto_approval_threshold',
  auto_approval_action: 'auto_approval_action',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.PgmigrationsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  run_on: 'run_on'
};

exports.Prisma.Product_rule_setsScalarFieldEnum = {
  id: 'id',
  rule_set_id: 'rule_set_id',
  product_rule_id: 'product_rule_id',
  created_at: 'created_at'
};

exports.Prisma.Product_rulesScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  rule_type: 'rule_type',
  manual_text: 'manual_text',
  version: 'version',
  created_at: 'created_at',
  updated_at: 'updated_at',
  advertiser_id: 'advertiser_id',
  bypass_threshold: 'bypass_threshold'
};

exports.Prisma.ProductsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  primary_issuer: 'primary_issuer',
  fee: 'fee',
  marketing_bullets: 'marketing_bullets',
  last_scan_date: 'last_scan_date',
  last_scan_job_id: 'last_scan_job_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
  advertiser_id: 'advertiser_id'
};

exports.Prisma.Rule_setsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  is_global: 'is_global',
  created_at: 'created_at',
  updated_at: 'updated_at',
  advertiser_id: 'advertiser_id',
  set_type: 'set_type',
  is_default: 'is_default'
};

exports.Prisma.Rule_violation_statsScalarFieldEnum = {
  id: 'id',
  rule_id: 'rule_id',
  issuer: 'issuer',
  product_id: 'product_id',
  publisher_id: 'publisher_id',
  time_period: 'time_period',
  period_start_date: 'period_start_date',
  period_end_date: 'period_end_date',
  content_count: 'content_count',
  violation_count: 'violation_count',
  violation_rate: 'violation_rate',
  created_at: 'created_at',
  updated_at: 'updated_at',
  rule_type: 'rule_type'
};

exports.Prisma.Scan_job_channelsScalarFieldEnum = {
  id: 'id',
  scan_job_id: 'scan_job_id',
  platform: 'platform',
  channel_url: 'channel_url',
  publisher_id: 'publisher_id',
  created_at: 'created_at'
};

exports.Prisma.Scan_job_product_focusScalarFieldEnum = {
  id: 'id',
  scan_job_id: 'scan_job_id',
  product_id: 'product_id',
  created_at: 'created_at'
};

exports.Prisma.Scan_jobsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  status: 'status',
  source: 'source',
  scan_all_publishers: 'scan_all_publishers',
  platform_filter: 'platform_filter',
  start_time: 'start_time',
  end_time: 'end_time',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  advertiser_id: 'advertiser_id',
  has_active_flags: 'has_active_flags'
};

exports.Prisma.Scan_job_runsScalarFieldEnum = {
  id: 'id',
  scan_job_id: 'scan_job_id',
  publisher_channel_id: 'publisher_channel_id',
  apify_actor_id: 'apify_actor_id',
  apify_run_id: 'apify_run_id',
  status: 'status',
  input_payload: 'input_payload',
  run_started_at: 'run_started_at',
  run_finished_at: 'run_finished_at',
  created_at: 'created_at',
  updated_at: 'updated_at',
  status_details: 'status_details'
};

exports.Prisma.UsersScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  email: 'email',
  name: 'name',
  password_hash: 'password_hash',
  role: 'role',
  settings: 'settings',
  last_login: 'last_login',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.AdvertisersScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  name: 'name',
  settings: 'settings',
  created_at: 'created_at',
  updated_at: 'updated_at',
  default_product_rule_set_id: 'default_product_rule_set_id',
  default_channel_rule_set_id: 'default_channel_rule_set_id',
  global_rule_set_id: 'global_rule_set_id'
};

exports.Prisma.Channel_rule_setsScalarFieldEnum = {
  id: 'id',
  rule_set_id: 'rule_set_id',
  channel_rule_id: 'channel_rule_id',
  created_at: 'created_at'
};

exports.Prisma.Channel_rulesScalarFieldEnum = {
  id: 'id',
  advertiser_id: 'advertiser_id',
  name: 'name',
  description: 'description',
  rule_type: 'rule_type',
  manual_text: 'manual_text',
  applicable_issuer: 'applicable_issuer',
  version: 'version',
  created_at: 'created_at',
  updated_at: 'updated_at',
  bypass_threshold: 'bypass_threshold',
  applicable_channel: 'applicable_channel'
};

exports.Prisma.Product_channel_rule_overridesScalarFieldEnum = {
  id: 'id',
  product_id: 'product_id',
  channel_rule_id: 'channel_rule_id',
  inclusion_type: 'inclusion_type',
  created_at: 'created_at'
};

exports.Prisma.Product_rule_overridesScalarFieldEnum = {
  id: 'id',
  product_id: 'product_id',
  product_rule_id: 'product_rule_id',
  created_at: 'created_at',
  inclusion_type: 'inclusion_type'
};

exports.Prisma.Product_rule_set_assignmentsScalarFieldEnum = {
  id: 'id',
  product_id: 'product_id',
  rule_set_id: 'rule_set_id',
  created_at: 'created_at'
};

exports.Prisma.Publisher_channelsScalarFieldEnum = {
  id: 'id',
  publisher_id: 'publisher_id',
  platform: 'platform',
  channel_url: 'channel_url',
  status: 'status',
  added_date: 'added_date',
  last_scanned: 'last_scanned',
  created_at: 'created_at',
  updated_at: 'updated_at',
  apifyActorId: 'apifyActorId'
};

exports.Prisma.Publisher_productsScalarFieldEnum = {
  id: 'id',
  publisher_id: 'publisher_id',
  product_id: 'product_id',
  created_at: 'created_at'
};

exports.Prisma.PublishersScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  name: 'name',
  status: 'status',
  contact_info: 'contact_info',
  last_scan_date: 'last_scan_date',
  last_scan_job_id: 'last_scan_job_id',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Scan_job_publishersScalarFieldEnum = {
  id: 'id',
  scan_job_id: 'scan_job_id',
  publisher_id: 'publisher_id',
  created_at: 'created_at'
};

exports.Prisma.Ai_usage_logsScalarFieldEnum = {
  id: 'id',
  timestamp: 'timestamp',
  service_name: 'service_name',
  action_name: 'action_name',
  model_name: 'model_name',
  input_tokens: 'input_tokens',
  output_tokens: 'output_tokens',
  total_tokens: 'total_tokens',
  latency_ms: 'latency_ms',
  cost: 'cost',
  status: 'status',
  error_message: 'error_message',
  related_context: 'related_context',
  correlation_id: 'correlation_id',
  request_payload: 'request_payload',
  response_payload: 'response_payload'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.HumanVerdict = exports.$Enums.HumanVerdict = {
  VIOLATION: 'VIOLATION',
  COMPLIANT: 'COMPLIANT',
  ERROR: 'ERROR'
};

exports.FlagStatus = exports.$Enums.FlagStatus = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  REMEDIATING: 'REMEDIATING',
  CLOSED: 'CLOSED'
};

exports.ResolutionMethod = exports.$Enums.ResolutionMethod = {
  AI_AUTO_REMEDIATE: 'AI_AUTO_REMEDIATE',
  AI_AUTO_CLOSE: 'AI_AUTO_CLOSE',
  HUMAN_REVIEW: 'HUMAN_REVIEW'
};

exports.Prisma.ModelName = {
  ai_feedback_examples: 'ai_feedback_examples',
  audit_logs: 'audit_logs',
  content_images: 'content_images',
  content_items: 'content_items',
  content_files: 'content_files',
  flags: 'flags',
  guideline_documents: 'guideline_documents',
  organizations: 'organizations',
  pgmigrations: 'pgmigrations',
  product_rule_sets: 'product_rule_sets',
  product_rules: 'product_rules',
  products: 'products',
  rule_sets: 'rule_sets',
  rule_violation_stats: 'rule_violation_stats',
  scan_job_channels: 'scan_job_channels',
  scan_job_product_focus: 'scan_job_product_focus',
  scan_jobs: 'scan_jobs',
  scan_job_runs: 'scan_job_runs',
  users: 'users',
  advertisers: 'advertisers',
  channel_rule_sets: 'channel_rule_sets',
  channel_rules: 'channel_rules',
  product_channel_rule_overrides: 'product_channel_rule_overrides',
  product_rule_overrides: 'product_rule_overrides',
  product_rule_set_assignments: 'product_rule_set_assignments',
  publisher_channels: 'publisher_channels',
  publisher_products: 'publisher_products',
  publishers: 'publishers',
  scan_job_publishers: 'scan_job_publishers',
  ai_usage_logs: 'ai_usage_logs'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
