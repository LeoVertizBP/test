/**
 * Navigation Flow Diagram Generator
 * 
 * This utility generates a Mermaid diagram of the navigation flows in the application.
 * It helps visualize user journeys and validate the completeness of navigation paths.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Configuration
const componentsDir = path.join(process.cwd(), 'src', 'components');
const outputFile = path.join(process.cwd(), 'navigation-flow-diagram.md');

// Patterns to search for
const navigationPatterns = [
  { pattern: /router\.push\(['"](.*?)['"]\)/g, color: 'green' },
  { pattern: /<Link.*?href=["'](.*?)["']/g, color: 'yellow' },
  { pattern: /window\.location\.href\s*=\s*["'](.*?)["']/g, color: 'red' },
  { pattern: /router\.replace\(['"](.*?)['"]\)/g, color: 'blue' },
  { pattern: /navigate\(['"](.+?)['"]\)/g, color: 'purple' },
];

// Connection storage
interface Connection {
  from: string;
  to: string;
  method: string;
}

// Store navigation links
const connections: Connection[] = [];
const components: Set<string> = new Set();
const pages: Set<string> = new Set();

// Function to clean path for diagram node id
function cleanForNodeId(path: string): string {
  return path.replace(/[^\w]/g, '_').replace(/^_+|_+$/g, '');
}

// Function to get component name from file path
function getComponentName(filePath: string): string {
  const basename = filePath.split('/').pop() || '';
  return basename.replace(/\.(tsx|jsx|js|ts)$/, '');
}

// Function to scan a file for navigation patterns
function scanFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const componentName = getComponentName(filePath);
    
    components.add(componentName);
    
    // Check navigation patterns
    navigationPatterns.forEach(({ pattern }) => {
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        const path = match[1] || '';
        if (path) {
          pages.add(path);
          connections.push({
            from: componentName,
            to: path,
            method: pattern.toString().includes('push') ? 'Push' : 
                   pattern.toString().includes('Link') ? 'Link' : 
                   pattern.toString().includes('replace') ? 'Replace' : 'Other',
          });
        }
      }
    });
    
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
              (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))) {
      scanFile(filePath);
    }
  }
}

// Generate mermaid diagram
function generateDiagram() {
  console.log(chalk.cyan('Generating navigation flow diagram...'));
  scanDirectory(componentsDir);
  
  let diagram = `# Navigation Flow Diagram\n\n`;
  diagram += `_Generated on ${new Date().toLocaleString()}_\n\n`;
  diagram += `This diagram visualizes the navigation flows between components and pages in the application.\n\n`;
  diagram += '```mermaid\nflowchart LR\n\n';
  
  // Add components as squares
  [...components].forEach(component => {
    diagram += `  ${cleanForNodeId(component)}["${component}"]:::component\n`;
  });
  
  // Add pages as rounded boxes
  [...pages].forEach(page => {
    diagram += `  ${cleanForNodeId(page)}("${page}"):::page\n`;
  });
  
  // Add connections
  diagram += '\n  %% Navigation connections\n';
  connections.forEach(({ from, to, method }) => {
    const style = method === 'Push' ? '-->' : 
                  method === 'Link' ? '-.->':
                  method === 'Replace' ? '==>':
                  '-.->';

    diagram += `  ${cleanForNodeId(from)} ${style} ${cleanForNodeId(to)}\n`;
  });
  
  // Add styling
  diagram += `
  %% Component and page styling
  classDef component fill:#f9f,stroke:#333,stroke-width:2px
  classDef page fill:#bbf,stroke:#33f,stroke-width:1px
  `;
  
  diagram += '```\n\n';
  
  // Add legend
  diagram += `## Legend

- Rectangles with sharp corners \`[ ]\` represent Components
- Rectangles with rounded corners \`( )\` represent Pages/Routes
- Arrow types:
  - Solid arrow \`-->\` represents router.push() navigation
  - Dashed arrow \`-..->\` represents <Link> navigation
  - Double line arrow \`==>\` represents router.replace() navigation
  - Other arrows represent other navigation methods
`;

  // Add statistics
  diagram += `\n## Statistics
- Total Components: ${components.size}
- Total Pages/Routes: ${pages.size}
- Total Navigation Connections: ${connections.length}
`;

  diagram += '\n## Potential Issues\n';

  // Find orphaned pages (no incoming connections)
  const orphanedPages = [...pages].filter(page => 
    !connections.some(conn => conn.to === page)
  );
  
  if (orphanedPages.length > 0) {
    diagram += '\n### Orphaned Pages (no incoming navigation)\n';
    orphanedPages.forEach(page => {
      diagram += `- \`${page}\`\n`;
    });
  }

  // Find dead-end pages (no outgoing connections)
  const deadEndPages = [...pages].filter(page => 
    !connections.some(conn => conn.from === page)
  );
  
  if (deadEndPages.length > 0) {
    diagram += '\n### Dead-End Pages (no outgoing navigation)\n';
    deadEndPages.forEach(page => {
      diagram += `- \`${page}\`\n`;
    });
  }

  fs.writeFileSync(outputFile, diagram);
  console.log(chalk.green(`Navigation flow diagram generated: ${outputFile}`));
  console.log(chalk.cyan(`Components: ${components.size}, Pages: ${pages.size}, Connections: ${connections.length}`));
}

// Run generator
generateDiagram();
