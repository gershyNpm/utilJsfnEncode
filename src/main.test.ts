import { assertEqual, testRunner } from '../build/utils.test.ts';
import jsfnEncode from './main.ts';

// Type testing
(async () => {
  
  type Enforce<Provided, Expected extends Provided> = { provided: Provided, expected: Expected };
  
  type Tests = {
    1: Enforce<{ x: 'y' }, { x: 'y' }>,
  };
  if (0) ((v?: Tests) => void 0)();
  
})();

testRunner([
  
  { name: 'basic', fn: async () => {
    
    assertEqual(
      jsfnEncode({ baseUrl: import.meta.url, val: { type: 'rec', props: {} } }),
      {
        code: '{type:"rec",props:{}}',
        jsImports: []
      }
    );
    
  }},
  
  { name: 'function with import resolution', fn: async () => {
    
    // TODO: this test assumes we always run with tsx-minified code... fair assumption??
    assertEqual(
      jsfnEncode({ baseUrl: import.meta.url, val: {
        arr: [ 1, 2, 3 ],
        fn1: () => console.log('hi!'),
        fn2: ctx => { const { v } = ctx.jsfnImport('./haha.ts'); return v.help(); },
        fn3: ctx => { const [ x ] = ctx.jsfnImport('@gershy/made-up-helper'); return x.help(); }
      }}),
      {
        code: String[cl.baseline](`
          | {
          |   arr: [ 1, 2, 3 ],
          |   'fn1': () => console.log("hi!"),
          |   'fn2': ctx => { /* jsfn:hoisted:const { v } = ctx.jsfnImport("./haha.ts"); */ return~v.help() },
          |   'fn3': ctx => { /* jsfn:hoisted:const [ x ] = ctx.jsfnImport("@gershy/made-up-helper"); */ return~x.help() }
          | }
        `).replace(/\s/g, '').replace(/~/g, ' '),
        jsImports: [
          { importPath: new URL('./haha.ts', import.meta.url).href, varDef: '{v}' },
          { importPath: '@gershy/made-up-helper', varDef: '[x]' }
        ]
      }
    );
    
  }}
  
]);