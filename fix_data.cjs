const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf8');

content = content.replace(/\];스트레스를 긍정적으로[\s\S]*?\];/g, '];');

fs.writeFileSync('src/data.ts', content);
console.log('Fixed syntax error');
