#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Verifying build output for path resolution issues...');

const distDir = path.join(__dirname, 'dist');

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Run build first.');
  process.exit(1);
}

// Function to recursively scan files
function scanFiles(dir, callback) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      scanFiles(fullPath, callback);
    } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.mjs'))) {
      callback(fullPath);
    }
  }
}

// Look for signs of path resolution issues in JS files
let pathIssuesFound = false;
let jsFilesChecked = 0;

scanFiles(distDir, (filePath) => {
  jsFilesChecked++;
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for common signs of unresolved paths
  if (content.includes('Cannot find module') || 
      content.includes('@/') || 
      content.includes('Error: Module not found')) {
    pathIssuesFound = true;
    console.error(`Path resolution issue detected in: ${path.relative(distDir, filePath)}`);
    console.error('  - File contains unresolved path references');
  }
});

if (pathIssuesFound) {
  console.error('\n❌ Path resolution issues detected in the build.');
  console.error('   This may cause runtime errors in the deployed application.');
} else {
  console.log(`\n✅ No path resolution issues found in ${jsFilesChecked} JavaScript files.`);
  console.log('   Build appears to have correctly resolved all path aliases.');
}

console.log('\nRun this script after building to verify path resolution is working properly.'); 