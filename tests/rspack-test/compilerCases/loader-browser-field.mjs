import fs from 'node:fs';
import path from 'node:path';

/** @type {import('@rspack/test-tools').TCompilerCaseConfig} */
export default {
  description: 'should apply browser aliases to loaders only when configured',
  build(context, compiler) {
    const directory = context.getDist();
    const loader = path.join(directory, 'loader.js');
    fs.writeFileSync(loader, '');
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ browser: { './loader.js': false } }),
    );

    const resolver = compiler.resolverFactory.get('loader');
    expect(resolver.resolveSync({}, directory, './loader.js')).toBe(loader);
    expect(
      resolver
        .withOptions({ aliasFields: ['browser'] })
        .resolveSync({}, directory, './loader.js'),
    ).toBe(false);
  },
};
