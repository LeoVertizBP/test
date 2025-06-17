/**
 * Simplified Navigation Checker
 * 
 * This script analyzes navigation patterns in React components.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const componentsDir = path.join(process.cwd(), 'src', 'components');
const outputLogFile = path.join(process.cwd(), 'navigation-check-results.log');

// Colors for console output
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
};

// Patterns to search for
const navigationPatterns = [
  {
    type: 'Router Push (Recommended)',
    pattern: /router\.push\(['"`](.*?)['"`]\)/g,
    color: colors.green,
    recommended: true,
  },
  {
    type: 'Router Push with Routes (Best)',
    pattern: /router\.push\((ROUTES\.[A-Z_]+)\)/g,
    color: colors.green,
    recommended: true,
  },
  {
    type: 'Router Push with Variable (Recommended)',
    pattern: /router\.push\(`(.*?)`\)/g,
    color: colors.green,
    recommended: true,
  },
  {
    type: 'Link Component',
    pattern: /<Link.*?href=["'](.*?)["']/g,
    color: colors.green,
    recommended: true,
  },
  {
    type: 'Link Component with Routes (Best)',
    pattern: /<Link.*?href=\{(ROUTES\.[A-Z_]+)\}/g,
    color: colors.green,
    recommended: true,
  },
  {
    type: 'Direct Window Location',
    pattern: /window\.location\.href\s*=\s*["'](.*?)["']/g,
    color: colors.red,
    recommended: false,
  },
  {
    type: 'Router Replace',
    pattern: /router\.replace\(['"`](.*?)['"`]\)/g, 
    color: colors.green,
    recommended: true,
  },
  {
    type: 'Back Button',
    pattern: /(onClick|onPress)=\{.*?\(\)\s*=>\s*router\.(back|push\(['"]\/.*?['"])/g,
    color: colors.green,
    recommended: true,
  },
  {
    type: 'Navigate Function',
    pattern: /navigate\(['"](.+?)['"]\)/g,
    color: colors.yellow,
    recommended: false,
  },
];

// Results storage
const results = [];

// Function to scan a file for navigation patterns
function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const filename = path.basename(filePath);
    
    // Check if file uses navigation
    const usesRouter = content.includes('useRouter') || content.includes('import { useRouter }');
    
    // Check each line for navigation patterns
    lines.forEach((line, index) => {
      for (const { type, pattern, recommended } of navigationPatterns) {
        const matches = Array.from(line.matchAll(pattern));
        
        for (const match of matches) {
          const routePath = match[1] || 'unknown'; // Extract the path from the match
          const lineNumber = index + 1;
          const lineContext = line.trim();
          
          results.push({
            type,
            file: filename,
            line: lineNumber,
            path: routePath,
            context: lineContext,
            recommended,
          });
        }
      }
    });
    
    // Check for components that import useRouter but don't use router.push
    if (usesRouter && !content.includes('router.push') && !content.includes('router.back')) {
      console.log(colors.yellow(`Warning: ${filename} imports useRouter but might not use it for navigation.`));
    }
    
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
}

// Function to traverse directory recursively
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (stat.isFile() && 
              (filePath.endsWith('.tsx') || 
               filePath.endsWith('.ts') || 
               filePath.endsWith('.jsx') || 
               filePath.endsWith('.js'))) {
      scanFile(filePath);
    }
  }
}

// Main function
function checkNavigation() {
  console.log(colors.cyan('Starting navigation analysis...'));
  scanDirectory(componentsDir);
  
  // Analyze results
  const totalNavigations = results.length;
  const recommendedCount = results.filter(r => r.recommended).length;
  const nonRecommendedCount = totalNavigations - recommendedCount;
  
  // Group by file
  const fileGroups = {};
  results.forEach(result => {
    if (!fileGroups[result.file]) {
      fileGroups[result.file] = [];
    }
    fileGroups[result.file].push(result);
  });
  
  // Output results
  let output = `Navigation Analysis Results\n${new Date().toISOString()}\n\n`;
  output += `Total navigation points found: ${totalNavigations}\n`;
  if (totalNavigations > 0) {
    const recommendedPercentage = Math.round(recommendedCount/totalNavigations*100);
    const nonRecommendedPercentage = Math.round(nonRecommendedCount/totalNavigations*100);
    output += `Using recommended methods: ${recommendedCount} (${recommendedPercentage}%)\n`;
    output += `Using non-recommended methods: ${nonRecommendedCount} (${nonRecommendedPercentage}%)\n\n`;
  }
  
  output += 'Navigation by Component:\n\n';
  
  for (const [file, usages] of Object.entries(fileGroups)) {
    output += `=== ${file} ===\n`;
    usages.forEach(usage => {
      const recommendedLabel = usage.recommended ? '[GOOD]' : '[REVIEW]';
      output += `  ${recommendedLabel} Line ${usage.line}: ${usage.type} - Path: ${usage.path}\n`;
      output += `      ${usage.context}\n\n`;
    });
  }
  
  // Check for potential navigation issues
  output += '\nPotential Navigation Issues:\n\n';
  
  // Hard-coded paths (not from router)
  const hardcodedPaths = results.filter(r => 
    !r.context.includes('href={`') && 
    !r.context.includes('router.push(`') && 
    r.path.includes('/'));
  
  if (hardcodedPaths.length > 0) {
    output += '- Hardcoded Paths (consider using route constants):\n';
    hardcodedPaths.forEach(item => {
      output += `  ${item.file} Line ${item.line}: ${item.path}\n`;
    });
    output += '\n';
  }
  
  // Slugs in paths
  const slugPaths = results.filter(r => r.path.includes('[') && r.path.includes(']'));
  if (slugPaths.length > 0) {
    output += '- Dynamic Routes (verify parameters are passed correctly):\n';
    slugPaths.forEach(item => {
      output += `  ${item.file} Line ${item.line}: ${item.path}\n`;
    });
    output += '\n';
  }
  
  // Check for potential missing back buttons in subpages
  const potentialSubpages = results.filter(r => 
    r.path.split('/').length > 2 && 
    !results.some(other => 
      other.file === r.file && 
      other.context.includes('back')
    )
  );
  
  if (potentialSubpages.length > 0) {
    output += '- Potential Missing Back Navigation:\n';
    potentialSubpages.forEach(item => {
      output += `  ${item.file} - Navigates to deeper path ${item.path} but might not have back button\n`;
    });
    output += '\n';
  }
  
  // Cross-references between components (potential user flow)
  output += '\nNavigation Flows (showing probable user journeys):\n\n';
  
  const flows = {};
  results.forEach(result => {
    const fromComponent = result.file;
    const toPath = result.path;
    
    if (!flows[fromComponent]) {
      flows[fromComponent] = [];
    }
    
    if (!flows[fromComponent].includes(toPath)) {
      flows[fromComponent].push(toPath);
    }
  });
  
  for (const [component, destinations] of Object.entries(flows)) {
    output += `${component} → ${destinations.join(', ')}\n`;
  }
  
  // Write to file
  fs.writeFileSync(outputLogFile, output);
  
  // Output summary to console
  console.log(colors.cyan(`Analysis complete! Results written to ${outputLogFile}`));
  console.log(colors.green(`Found ${totalNavigations} navigation points.`));
  console.log(`${colors.green(`✓ ${recommendedCount}`)} using recommended methods.`);
  
  if (nonRecommendedCount > 0) {
    console.log(`${colors.yellow(`⚠ ${nonRecommendedCount}`)} using non-recommended methods.`);
  } else {
    console.log(colors.green('✓ No non-recommended navigation methods found!'));
  }

  console.log('\nMajor potential issues found:');
  if (potentialSubpages.length > 0) {
    console.log(colors.yellow(`⚠ ${potentialSubpages.length} pages with deeper paths might be missing back buttons`));
  }
  if (hardcodedPaths.length > 0) {
    console.log(colors.yellow(`⚠ ${hardcodedPaths.length} hardcoded navigation paths found`));
  }
}

// Run the check
checkNavigation();
