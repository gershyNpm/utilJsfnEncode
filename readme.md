# Jsfn

An encoding format especially geared for replicating functions and classes across javascript processes. It's called jsfn because it's json plus functions! Pronounce it in two syllables: "jayce-fun".

## Code and code references

Encoding a jsfn value results in an object with `code` and `jsImports` properties:

```ts
import jsfnEncode from '@gershy/util-jsfn-encode';

const { code, jsImports } = jsfnEncode({
  baseUrl: import.meta.url,
  val: {
    desc: 'my custom object',
    fn: () => console.log('I am the custom object')
  }
});

console.log(code);
// Outputs a string representing encoded jsfn:
//  | `{
//  |   desc: 'my custom object',
//  |   fn: () => console.log('I am the custom object')
//  | }`

// This string can be decoded with a simple `eval` call:
const obj = eval(code);
obj.fn(); // Prints 'I am the custom object'
```

Note that `jsfnEncode`'d values must be decodable in any @gershy context! For this to be possible, every nested value in the `jsfnEncode` call must be *either* (1) a valid json value, or (2) a *sovereign* class or function.

## Sovereign functions

A sovereign function (or class) has no dependencies other than its own parameters, and the javascript global resolution context.

The "javascript global resolution context" is the sum of:
1. the subset of all javascript globals that are widely supported in all common, modern environments - including, e.g., `TextDecoder`, and excluding, e.g., `process` (which is unique to nodejs)
2. the `clearing` / `cl` globals from @gershy/clearing, what are considered defacto globals that pre-exist anywhere jsfn is used

Sovereign functions also must not reference meta-properties such as `import.meta`.

Some non-sovereign functions:
```ts
const val = 'hello';

// References local, outside-of-scope variable `val`
const notSovereign1 = () => console.log(val);

// References nodejs-specific `Buffer`
const notSovereign2 = (base64: string) => Buffer.from(v, 'base64').toString('utf8');
```

A sovereign function:
```ts
// Only references its parameter, and `Math` from the global resolution context
const sovereign = (val: string) => Math.max(50, val.length);
```

A sovereign function pretending to import another script (in this case, @gershy/phrasing)
```ts
const sovereign = (inp: { jsfnImport: (val: string) => any, parts: string[] }) => {
  
  // References nothing other than its parameters, and `cl` from @gershy/clearing - note that
  // specifically @gershy/clearing is considered, within the context of jsfn, to be a dependable
  // member of the "global resolution context"!
  
  const { default: ph } = inp.jsfnImport('@gershy/phrasing') as typeof import('@gershy/phrasing');
  
  return String[cl.baseline](`
    | You gave me some parts, that is, an array of strings.
    | Now I shall formulate a camel case value from them.
    | Here it is: "${ ph('parts->camel', inp.parts) }"
  `);
  
};
```

Oh actually...

## Sovereign functions can import other scripts!

When `jsfnEncode` encodes a function or class, it scans sourcecode for occurrences of the form:
- `const xxx                      = yyy.jsfnImport('zzz')`
- `const { xxx1, xxx2: { xxx3 } } = yyy.jsfnImport('zzz')`
- `const [ xxx1, xxx2 ]           = yyy.jsfnImport('zzz')`
- Any other destructuring assignment, followed by the `jsfnImport` call.

When `jsfnEncode` encodes, it will delete any such occurrences from the function/class sourcecode, interpret the occurrence, and populate its `jsImports` return property:

```ts

const sovereign = (inp: { jsfnImport: (val: string) => any, parts: string[] }) => {
  
  // References nothing other than its parameters, and `cl` from @gershy/clearing
  
  const { default: ph } = inp.jsfnImport('@gershy/phrasing') as typeof import('@gershy/phrasing');
  
  return String[cl.baseline](`
    | You gave me some parts, as in, an array of strings.
    | Now I shall formulate a camel case value from them.
    | Here it is: "${ ph('parts->camel', inp.parts) }"
  `);
  
};
const { code, jsImports } = jsfnEncode({
  baseUrl: import.meta.url,
  val: sovereign
});

console.log(code);
// Outputs a string representing the function with the `jsfnImport` line stripped - note the `ph`
// reference is dangling!
//  | inp => {
//  |   
//  |   return String[cl.baseline](`
//  |     | You gave me some parts, as in, an array of strings.
//  |     | Now I shall formulate a camel case value from them.
//  |     | Here it is: "${ ph('parts->camel', inp.parts) }"
//  |   `);
//  |   
//  | }

console.log(jsImports);
// The `jsImports` value is populated; it tracks what imports are needed for `code` to be decodable
// and covers the dangling reference in `code`
//  | [
//  |   {
//  |     importPath: '@gershy/phrasing',
//  |     varDef: '{default:ph}'            // Note this is a *string*!!
//  |   }
//  | ]
```

Note that for `yyy.jsfnImport('zzz')`, `zzz` may be an npm module name, any global url resolving to ts/js, or a relative filepath. If it's a relative filepath it's resolved against the `baseUrl` input property passed to `jsfnEncode`. Note a simple pattern can almost always be used: pass `import.meta.url` to `baseUrl`, and use the same relative filepath you would in a normal top-level `import`.

More effort is shifted to the decoding step when `code` contains `jsfnImport`s. For example, to decode arbitrary jsfn with imports a very coarse approach (there are subtle bugs here!) to produce runnable cjs could look like:
```ts
import { type JsImport } from '@gershy/util-jsfn-encode'; // type JsImport = { importPath: string, varDef: null | string };

const decodeReferentialJsfn = (jsfn: { code: string, jsImports: JsImport[] }) => eval([
  
  `require('@gershy/clearing')`, // In case clearing globals aren't already installed
  
  // Add in `eval`-able `require` calls for every js import
  ...jsImports.map(jsImport => {
    
    return jsImport.varDef
      ? `const ${ jsImport.varDef } = require('${ jsImport.importPath }')`
      :                              `require('${ jsImport.importPath }')`
    
  }),
  
  // Now dangling references throughout `code` are satisfied by the import `const` definitions
  code
  
].join(';'));
```

