// Mock data for use in forms and modals

// Mock rule sets for selection
export const mockRuleSets = [
  { value: '301', label: 'Core Compliance' },
  { value: '302', label: 'Premium Card Requirements' },
  { value: '303', label: 'Travel Card Compliance' },
  { value: '304', label: 'Global Financial Regulations' },
  { value: '305', label: 'US Market Rules' },
  { value: '306', label: 'EU Compliance Standards' },
  { value: '307', label: 'Basic Card Requirements' },
  { value: '308', label: 'Digital Marketing Standards' }
];

// Mock rules for selection
export const mockRules = [
  { value: '201', label: 'Fee Disclosure' },
  { value: '202', label: 'APR Transparency' },
  { value: '203', label: 'Rewards Limitations' },
  { value: '204', label: 'Benefits Timeline' },
  { value: '205', label: 'Balance Transfer Terms' },
  { value: '206', label: 'Credit Limit Disclosure' },
  { value: '207', label: 'Interest Calculation Method' },
  { value: '208', label: 'Consumer Rights Statement' }
];

// Mock advertisers/issuers
export const mockAdvertisers = [
  { value: 'chase', label: 'Chase' },
  { value: 'amex', label: 'Amex' },
  { value: 'citi', label: 'Citi' },
  { value: 'discover', label: 'Discover' },
  { value: 'capital_one', label: 'Capital One' },
  { value: 'wells_fargo', label: 'Wells Fargo' },
  { value: 'bank_of_america', label: 'Bank of America' }
];

// Platforms for channels
export const mockPlatforms = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'YOUTUBE_SHORTS', label: 'YouTube Shorts' }, // Added YouTube Shorts
  { value: 'Website', label: 'Website' } // Added Website for crawler testing
];

// Statuses
export const publisherStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export const channelStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'inactive', label: 'Inactive' }
];

export const userRoles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'reviewer', label: 'Reviewer' }
];

export const ruleSeverities = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

export const ruleCategories = [
  { value: 'financial_terms', label: 'Financial Terms' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'disclosures', label: 'Disclosures' },
  { value: 'consumer_rights', label: 'Consumer Rights' }
];

export const ruleSetTypes = [
  { value: 'global', label: 'Global' },
  { value: 'product', label: 'Product-specific' },
  { value: 'channel', label: 'Channel-specific' }
];
