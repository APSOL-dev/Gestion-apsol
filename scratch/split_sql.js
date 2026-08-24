const fs = require('fs');
const sql = fs.readFileSync('scratch/update_data.sql', 'utf-16le'); // Assuming it's UTF-16LE as seen before
const lines = sql.split('\n');
const mid = Math.floor(lines.length / 2);
fs.writeFileSync('scratch/update_part1.sql', lines.slice(0, mid).join('\n'), 'utf8');
fs.writeFileSync('scratch/update_part2.sql', lines.slice(mid).join('\n'), 'utf8');
