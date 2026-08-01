import '@gershy/clearing';

export type JsImport = { importPath: string, varDef: null | string }; // Javascript-style import, so `varDef` can include simple variable assignment or destructuring; any content between `const ` and ` = ctx.jsfnImport(...)`!
export type SovereignFn = (...args: any) => any;
export type SovereignCls = abstract new (...args: any) => any;

// TODO: Would love if these types could force the constructor params to a subset of Jsfn, but I'm
// struggling to implement that in a well-behaved way
export type JsfnInst<Cls extends abstract new (...args: any[]) => any> = { toJsfn: () => JsfnInstSer<Cls> };
export type JsfnInstSer<Cls extends abstract new (...args: any[]) => any> = {
  hoist: `${string /* import url */}::${string /* exported class name */}`,
  form: Cls,
  args: ConstructorParameters<Cls>
};

export type Jsfn =
  | null
  | boolean
  | number
  | string
  | SovereignFn
  | SovereignCls
  | JsfnInst<any>
  | Jsfn[]
  | { [K: string]: Jsfn };

export type JsfnEncodeArgs<V extends Jsfn> = { val: V, baseUrl: string };
export default <V extends Jsfn>(args: JsfnEncodeArgs<V>) => {
  
  // const importReg = niceRegex(String[cl.baseline](`
  //   | ^[ ]*                                                                              (?:         )?
  //   |      const[ ]       [=][ ]*                     [.]jsfnImport[(]['#]        ['#][)]   [ ]+as[ ]  
  //   |              ([^=]+)       [a-zA-Z][a-zA-Z0-9.]*                    ([^'#]+)                     
  // `).replaceAll('#', '`'));
  
  // Captures lines like:
  // const util = ctx.jsfnImport('<repo>/src/boot/util');
  // const util = ctx.jsfnImport('<repo>/src/boot/util') as typeof import('../src/boot/util');
  // const { util1, util2 } = ctx.jsfnImport('<repo>/src/boot/util') as typeof import('../src/boot/util');
  // const { util1, util2 } = c.jsfnImport('<repo>/src/boot/util') as typeof import('../src/boot/util');
  
  const jsImports: JsImport[] = []; // Note "js imports" are a "reference to code, including a url, relative filepath, or name of an npm module"
  const serializeObjKey = (key: string) => /^[$_a-zA-Z][$_a-zA-Z0-9]+$/.test(key) ? key : `'${key.replaceAll(`'`, `\\'`)}'`;
  const serialize = (val: Jsfn): string => {
    
    if (cl.isCls(val, Array))    return '[' + val.map      ((v   ) =>                          serialize(v)  ).join(',') + ']';
    if (cl.isCls(val, Object))   return '{' + val[cl.toArr]((v, k) => `${serializeObjKey(k)}:${serialize(v)}`).join(',') + '}';
    
    if (cl.inCls(val, Function)) {
      
      const importReg = /\b(?:const|let|var)[ ]*([^=]+)[=][ ]*[a-zA-Z][a-zA-Z0-9.]*[.]jsfnImport[(]["'`]([^"'`]+)["'`][)][;]?/g;
      
      return val.toString().replace(importReg, (full: string, varDef: string, importPath: string) => {
        jsImports.push({ varDef, importPath });
        return `/*jsfn:hoisted:${full}*/`;
      });
      
    }
    
    if (cl.inCls((val as any)?.toJsfn, Function)) {
      const { args, hoist } = (val as any).toJsfn() as JsfnInstSer<any>;
      const [ importPath, varDef ] = hoist.split('::');
      
      // If `varDef` looks like `'{ Cls }'` then the `varDef` resolves to `'{ Cls }'`, while the
      // constructor string representation removes the {}, looking like `'new Cls(...)'`
      jsImports.push({ importPath, varDef });
      return `new ${varDef.replace(/[{}]/g, '').trim()}(${args.map(a => serialize(a as Jsfn)).join(',')})`;
    }
    
    return JSON.stringify(val);
    
  };
  
  return {
    
    // Note `code` is stringified, but it isn't json - it's js, in string representation
    code: serialize(args.val), // `jsImports` isn't populated until this is called!
    
    // Imports beginning with "." are treated as relative paths
    jsImports: jsImports.map(ji => ji.importPath[0] !== '.' ? ji : {
      ...ji,
      importPath: new URL(ji.importPath, args.baseUrl).href
    })
    
  };

};