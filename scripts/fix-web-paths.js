/**
 * Cross-platform script to fix web build paths for GitHub Pages deployment.
 * Replaces macOS-only sed commands that fail on Linux CI/CD.
 */

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distPath, 'index.html');

// Read the index.html file
let html = fs.readFileSync(indexPath, 'utf8');

// Fix paths for GitHub Pages subdirectory deployment
html = html.replace(/href="\/favicon.ico"/g, 'href="/momentum/favicon.ico"');
html = html.replace(/src="\/_expo/g, 'src="/momentum/_expo');

// Add module type to script tags for proper ES module loading
html = html.replace(/<script src=/g, '<script type="module" src=');

// Write the modified index.html
fs.writeFileSync(indexPath, html);

// Copy to 404.html for client-side routing
fs.copyFileSync(indexPath, path.join(distPath, '404.html'));

// Create .nojekyll to prevent GitHub Pages from ignoring _expo folder
fs.writeFileSync(path.join(distPath, '.nojekyll'), '');

console.log('Web build paths fixed for GitHub Pages deployment');
