const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, '.test-build');
function compile(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) compile(file);
    else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const output = path.join(destination, file.replace(/\.ts$/, '.js'));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, stripTypeScriptTypes(fs.readFileSync(path.join(root, file), 'utf8'), { mode: 'transform' }).replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g, (match, quote, specifier) => path.extname(specifier) ? match : 'from ' + quote + specifier + '.js' + quote));
    }
  }
}
for (const dir of ['apps/api/src', 'apps/api/test', 'apps/web/test', 'apps/web/src/app/field/map', 'apps/web/src/app/api']) compile(dir);
fs.writeFileSync(path.join(destination, 'package.json'), '{"type":"module"}');
const files = ['apps/api/test','apps/web/test'].flatMap(dir => fs.readdirSync(path.join(root,dir)).filter(f => f.endsWith('.test.ts')).map(f => path.join(destination,dir,f.replace(/\.ts$/,'.js'))));
const result = spawnSync(process.execPath, ['--test', ...files], {cwd: root, stdio: 'inherit'});
process.exitCode = result.status ?? 1;
