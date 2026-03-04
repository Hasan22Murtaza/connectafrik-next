const fs = require('fs');
const s = fs.readFileSync('./public/swagger.json', 'utf8');
const j = JSON.parse(s);

console.log('Top-level keys:', Object.keys(j));
console.log('Path keys count:', Object.keys(j.paths).length);
console.log('Path keys:', Object.keys(j.paths));

// Check the value of the single path
const p = j.paths['/chat/calls/recent'];
console.log('\nKeys in /chat/calls/recent:', Object.keys(p));

// Check if there's nesting
const getVal = p.get;
if (getVal) {
  console.log('get.tags:', getVal.tags);
  console.log('get keys:', Object.keys(getVal));
}

// Manually search for path patterns in raw text
const pathMatches = s.match(/"\/[a-z][^"]*":\s*\{/g);
console.log('\nPath-like keys found in raw text:', pathMatches ? pathMatches.length : 0);
if (pathMatches) {
  console.log('Unique paths:', [...new Set(pathMatches)].length);
  console.log('First 5:', pathMatches.slice(0, 5));
  console.log('Last 5:', pathMatches.slice(-5));
}
