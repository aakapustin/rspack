import fs from 'node:fs';
import path from 'node:path';

/** @type {import('@rspack/test-tools').TCompilerCaseConfig} */
export default {
  description:
    'should keep the server-relative request when resolving through roots',
  build(context, compiler) {
    const first = context.getDist('first');
    const second = context.getDist('second');
    fs.mkdirSync(path.join(first, 'pkg', 'nested'), { recursive: true });
    fs.mkdirSync(path.join(second, 'pkg'), { recursive: true });
    fs.mkdirSync(path.join(first, 'directory'), { recursive: true });
    fs.writeFileSync(
      path.join(first, 'package.json'),
      JSON.stringify({
        browser: {
          './local.js': false,
          './directory/index.js': false,
          '/later.js': false,
          '/aliased.ts': false,
          '/ignored.js': false,
          '/redirected.js': './target.js',
          './target.js': false,
        },
      }),
    );
    fs.writeFileSync(
      path.join(first, 'pkg/package.json'),
      JSON.stringify({
        main: './nested',
        browser: { './nested/index.js': false },
      }),
    );
    fs.writeFileSync(path.join(first, 'pkg/nested/index.js'), '');
    fs.writeFileSync(path.join(first, 'directory/index.js'), '');
    fs.writeFileSync(
      path.join(second, 'package.json'),
      JSON.stringify({
        browser: {
          '/earlier.ts': false,
          './preferred.js': false,
          '/issuer.js': false,
        },
      }),
    );
    fs.writeFileSync(path.join(first, 'issuer.js'), '');
    fs.writeFileSync(path.join(first, 'replacement.ts'), '');
    for (const name of ['earlier', 'later']) {
      fs.writeFileSync(path.join(first, `${name}.js`), '');
      fs.writeFileSync(path.join(second, `${name}.ts`), '');
    }
    fs.writeFileSync(path.join(second, 'pkg/index.js'), '');
    for (const root of [first, second]) {
      for (const name of [
        'local.js',
        'alias.js',
        'ignored.js',
        'redirected.js',
        'target.js',
      ]) {
        fs.writeFileSync(path.join(root, name), '');
      }
    }

    const resolver = compiler.resolverFactory.get('normal', {
      roots: [first, second],
      alias: {
        [path.join(first, 'alias.js')]: false,
        '/aliased.ts': '/replacement.ts',
      },
      aliasFields: ['browser'],
      extensions: ['.js'],
      mainFields: ['main'],
    });
    const resolve = (request) =>
      resolver.resolveSync({}, context.getDist(), request);

    expect(resolve('/local.js')).toBe(path.join(first, 'local.js'));
    expect(resolve('/local')).toBe(path.join(first, 'local.js'));
    expect(resolve('/alias.js')).toBe(path.join(first, 'alias.js'));
    expect(resolve('/ignored.js')).toBe(false);
    expect(resolve('/redirected.js')).toBe(false);
    expect(resolve('/pkg')).toBe(false);
    expect(resolver.resolveSync({}, second, '/issuer.js')).toBe(false);
    expect(resolve('/directory')).toBe(path.join(first, 'directory/index.js'));

    const extensionAlias = resolver.withOptions({
      extensionAlias: { '.js': ['.ts', '.js'] },
    });
    expect(
      extensionAlias.resolveSync({}, context.getDist(), '/earlier.js'),
    ).toBe(false);
    expect(extensionAlias.resolveSync({}, context.getDist(), '/later.js')).toBe(
      path.join(second, 'later.ts'),
    );

    expect(
      extensionAlias.resolveSync({}, context.getDist(), '/aliased.js'),
    ).toBe(path.join(first, 'replacement.ts'));

    if (process.platform !== 'win32') {
      const mirror = path.join(first, second);
      fs.mkdirSync(mirror, { recursive: true });
      fs.writeFileSync(
        path.join(mirror, 'package.json'),
        JSON.stringify({ browser: { [path.join(second, 'cross.ts')]: false } }),
      );
      const preferred = path.join(second, 'preferred.js');
      const cross = path.join(second, 'cross.js');
      fs.writeFileSync(preferred, '');
      fs.writeFileSync(cross, '');
      fs.writeFileSync(path.join(mirror, 'preferred.js'), '');
      fs.writeFileSync(path.join(mirror, 'cross.ts'), '');

      expect(resolve(preferred)).toBe(path.join(mirror, 'preferred.js'));
      for (const option of ['preferAbsolute', 'preferRelative']) {
        const preferredResolver = resolver.withOptions({ [option]: true });
        expect(preferredResolver.resolveSync({}, second, preferred)).toBe(
          false,
        );
        expect(
          extensionAlias
            .withOptions({ [option]: true })
            .resolveSync({}, second, cross),
        ).toBe(false);
      }
    }
  },
};
