const fs = require('fs');
const content = fs.readFileSync('/workspace/app-99gqsi7u251d/src/db/api.ts', 'utf8');
const lines = content.split('\n');
let depth = 0;
lines.forEach((line, index) => {
  const openCount = (line.match(/{/g) || []).length;
  const closeCount = (line.match(/}/g) || []).length;
  const trimmed = line.trim();
  const hasExport = trimmed.startsWith('export ');
  if (hasExport && depth !== 0) {
    console.log(`Line ${index + 1} has export but depth is ${depth}: ${trimmed}`);
  }
  depth += openCount - closeCount;
});
if (depth !== 0) {
  console.log(`End of file reached with depth ${depth}`);
}
