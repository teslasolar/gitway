// Update script to add new views to renderer
const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, 'kaleidoscope', 'renderer.js');

// Read the file
let content = fs.readFileSync(rendererPath, 'utf8');

// Replace the views array
const oldViews = "const views = ['Dashboard', 'Gateway', 'Integration', 'Tags', 'GitDB'];";
const newViews = "const views = ['Dashboard', 'Production', 'Maintenance', 'Alarms', 'Reports', 'Energy', 'Gateway', 'Tags', 'GitDB', 'Integration'];";

if (content.includes(oldViews)) {
    content = content.replace(oldViews, newViews);
    fs.writeFileSync(rendererPath, content);
    console.log('✅ Successfully updated renderer.js with new views:');
    console.log('   - Production');
    console.log('   - Maintenance');
    console.log('   - Alarms');
    console.log('   - Reports');
    console.log('   - Energy');
} else {
    console.log('⚠️  Views array already updated or format changed');
}

console.log('\n📊 Total views available: 10');