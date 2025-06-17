/**
 * Navigation Test Utility
 * 
 * This script performs static analysis on our navigation implementation
 * to ensure we're using the correct methods consistently.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Configuration
const componentsDir = path.join(process.cwd(), 'src', 'components');
const outputLogFile = path.join(process.cwd(), 'navigation-check-results.log');

// Patterns to search for
const navigationPatterns = [
  {
    type: 'Router Push (Recommended)',
    pattern: /router\.push\(['"](.*?)['"]\)/g,
    color: chalk.green,
    recommended: true,
  },
  {
    type: 'Link Component',
    pattern: /<Link.*?href=["'](.*?)["']/g,
    color: chalk.yellow,
    recommended: false,
  },
  {
    type: 'Direct Window Location',
    pattern: /window\.location\.href\s*=\s*["'](.*?)["']/g,
    color: chalk.red,
    recommended: false,
  },
  {
    type: 'Router Replace',
    pattern: /router\.replace\(['"](.*?)['"]\)/g, 
    color: chalk.blue,
    recommended: true,
  },
  {
    type: 'Back Button',
    pattern: /(onClick|onPress)=\{.*?\(\)\s*=>\s*router\.(back|push\(['"]\/.*?['"])/g,
    color: chalk.magenta,
    recommended: true,
  },
  {
    type: 'Navigate Function',
    pattern: /navigate\(['"](.+?)['"]\)/g,
    color: chalk.blue,
    recommended: false,
  },
];

// Results storage
interface NavigationUse {
  type: string;
  file: string;
  line: number;
  path: string;
  context: string;
  recommended: boolean;
}

const results: NavigationUse[] = [];

// Function to scan a file for navigation patterns
function scanFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Check if file uses navigation
    const usesRouter = content.includes('useRouter') || content.includes('import { useRouter }');
    
    // Check each line for navigation patterns
    lines.forEach((line, index) => {
      for (const { type, pattern, recommended } of navigationPatterns) {
        const matches = [...line.matchAll(pattern)];
        
        for (const match of matches) {
          const path = match[1] || 'unknown'; // Extract the path from the match
          const lineNumber = index + 1;
          const lineContext = line.trim();
          
          results.push({
            type,
            file: typeof filePath === 'string' ? filePath.split('/').pop() || '' : '',
            line: lineNumber,
            path: path, // Use the extracted path
            context: lineContext,
            recommended,
          });
        }
      }
    });
    
    // Check for components that import useRouter but don't use router.push
    if (usesRouter && !content.includes('router.push') && !content.includes('router.back')) {
      const filename = typeof filePath === 'string' ? filePath.split('/').pop() || '' : '';
      console.log(chalk.yellow(`Warning: ${filename} imports useRouter but might not use it for navigation.`));
    }
    
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
}

// Function to traverse directory recursively
function scanDirectory(dir: string) {
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
  console.log(chalk.cyan('Starting navigation analysis...'));
  scanDirectory(componentsDir);
  
  // Analyze results
  const totalNavigations = results.length;
  const recommendedCount = results.filter(r => r.recommended).length;
  const nonRecommendedCount = totalNavigations - recommendedCount;
  
  // Group by file
  const fileGroups: Record<string, NavigationUse[]> = {};
  results.forEach(result => {
    if (!fileGroups[result.file]) {
      fileGroups[result.file] = [];
    }
    fileGroups[result.file].push(result);
  });
  
  // Output results
  let output = `Navigation Analysis Results\n${new Date().toISOString()}\n\n`;
  output += `Total navigation points found: ${totalNavigations}\n`;
  output += `Using recommended methods: ${recommendedCount} (${Math.round(recommendedCount/totalNavigations*100)}%)\n`;
  output += `Using non-recommended methods: ${nonRecommendedCount} (${Math.round(nonRecommendedCount/totalNavigations*100)}%)\n\n`;
  
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
  
  const flows: Record<string, string[]> = {};
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
  
  console.log(chalk.cyan(`Analysis complete! Results written to ${outputLogFile}`));
  console.log(chalk.green(`Found ${totalNavigations} navigation points.`));
  console.log(`${chalk.green(`✓ ${recommendedCount}`)} using recommended methods.`);
  
  if (nonRecommendedCount > 0) {
    console.log(`${chalk.yellow(`⚠ ${nonRecommendedCount}`)} using non-recommended methods.`);
  } else {
    console.log(chalk.green('✓ No non-recommended navigation methods found!'));
  }
}

// Run the check
checkNavigation();
