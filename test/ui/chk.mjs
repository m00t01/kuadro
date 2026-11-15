import fs from 'node:fs'; import * as R0 from 'resedit'; const R = R0.default || R0;
for (const f of process.argv.slice(2)) {
  const pe = R.NtExecutable.from(fs.readFileSync(f), { ignoreCert: true }); const res = R.NtExecutableResource.from(pe);
  const g = R.Resource.IconGroupEntry.fromEntries(res.entries); const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0];
  console.log(f.split('/').pop(), 'grupos:', g.length, 'tamaños:', g.flatMap(x => x.icons.map(i => i.width || 256)).join(','), '|', vi ? JSON.stringify(vi.getStringValues({ lang: 1033, codepage: 1200 })) : '');
}
