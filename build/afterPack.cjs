// Pone el ícono de Kuadro dentro del .exe de Windows sin necesitar Wine (rcedit).
const path = require('path'), fs = require('fs');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const R = ResEdit.default || ResEdit;
  const exe = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const data = fs.readFileSync(exe);
  const pe = R.NtExecutable.from(data, { ignoreCert: true }); const res = R.NtExecutableResource.from(pe);
  const ico = R.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
  const ids = groups.length ? groups.map(g => g.id) : [1];
  for (const id of ids) R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, groups.find(g => g.id === id)?.lang ?? 1033, ico.icons.map(i => i.data));
  const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) { const v = ctx.packager.appInfo.version.split('.').map(Number); vi.setFileVersion(...v, 0, 1033); vi.setProductVersion(...v, 0, 1033); vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: 'Kuadro', FileDescription: 'Kuadro', CompanyName: 'Marcos Toscano', OriginalFilename: 'Kuadro.exe', InternalName: 'Kuadro', LegalCopyright: '© 2026 Marcos Toscano' }); vi.outputToResourceEntries(res.entries); }
  res.outputResource(pe); fs.writeFileSync(exe, Buffer.from(pe.generate()));
  console.log('  • icono de Kuadro aplicado a', path.basename(exe));
};
