const fs = require('fs');
let content = fs.readFileSync('src/index.css', 'utf8');

// Reduce table padding and font size for list
content = content.replace(/padding: 10px 12px/g, 'padding: 4px 8px');
content = content.replace(/font-size: 0.8125rem/g, 'font-size: 0.75rem');
content = content.replace(/font-size: 0.875rem/g, 'font-size: 0.8125rem');

fs.writeFileSync('src/index.css', content);
console.log('Updated index.css');
