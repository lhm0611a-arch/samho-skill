const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Modal scaling adjustments
content = content.replace(/text-lg md:text-xl/g, 'text-base md:text-lg');
content = content.replace(/p-4 md:p-6 lg:p-8/g, 'p-4 lg:p-6');
content = content.replace(/p-4 md:p-6/g, 'p-3 md:p-4');
content = content.replace(/w-5 h-5 md:w-6 md:h-6/g, 'w-4 h-4 md:w-5 md:h-5');
content = content.replace(/text-xl md:text-2xl lg:text-3xl/g, 'text-lg md:text-xl lg:text-2xl');
content = content.replace(/px-2 md:px-3 py-0.5 md:py-1/g, 'px-2 py-0.5');
content = content.replace(/text-sm md:text-base/g, 'text-xs md:text-sm');
content = content.replace(/w-4 h-4 md:w-5 md:h-5/g, 'w-3 h-3 md:w-4 md:h-4');
content = content.replace(/text-3xl md:text-4xl lg:text-5xl/g, 'text-2xl md:text-3xl lg:text-4xl');
content = content.replace(/max-h-\[75vh\]/g, 'max-h-[85vh]');
content = content.replace(/max-w-3xl/g, 'max-w-2xl');

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log("Updated Dashboard modal");
