import { readFile, writeFile } from 'node:fs/promises';
// Genera tipos desde el catálogo de PostgreSQL tras ejecutar las migraciones.
export async function generateDbTypes(db, check = false) {
 const types = (await db.query("select oid,typname,typtype from pg_type")).rows;
 const byOid = new Map(types.map(t=>[t.oid,t]));
 const tsType = (name) => {
   if(name?.startsWith('_')) return `(${tsType(name.slice(1))})[]`;
   if(['int2','int4','int8','float4','float8','numeric','money'].includes(name))return 'number';
   if(name==='bool')return 'boolean';
   if(['json','jsonb'].includes(name))return 'Json';
   if(name==='void')return 'undefined';
   if(types.some(t=>t.typname===name&&t.typtype==='e'))return `Database["public"]["Enums"][${JSON.stringify(name)}]`;
   return 'string';
 };
 const enums=(await db.query(`select t.typname,array_agg(e.enumlabel order by e.enumsortorder) labels
   from pg_type t join pg_enum e on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace
   where n.nspname='public' group by t.typname order by t.typname`)).rows;
 const tables=(await db.query(`select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','v') order by c.relname`)).rows;
 const cols=(await db.query(`select table_name,column_name,udt_name,is_nullable,column_default,is_generated
   from information_schema.columns where table_schema='public' order by table_name,ordinal_position`)).rows;
 const fks=(await db.query(`select c.conname,s.relname as source,t.relname as target,
   (select json_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(att,ord) join pg_attribute a on a.attrelid=s.oid and a.attnum=k.att) as cols,
   (select json_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(att,ord) join pg_attribute a on a.attrelid=t.oid and a.attnum=k.att) as refs
   from pg_constraint c join pg_class s on s.oid=c.conrelid join pg_class t on t.oid=c.confrelid
   join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and n.nspname='public' order by c.conname`)).rows;
 let out='// Generado con npm run gen:types:embedded. Validar además contra Supabase aislado.\n';
 out+='export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n';
 out+='export type Database = { __InternalSupabase: { PostgrestVersion: "14.5" }; public: {\n';
 for(const [section,kind] of [['Tables','r'],['Views','v']]) {
   out+=section+': {\n';
   for(const table of tables.filter(t=>t.relkind===kind)) {
    out+=JSON.stringify(table.relname)+': {\n';
    for(const mode of kind==='v'?['Row']:['Row','Insert','Update']) {
     out+=mode+': {\n';
     for(const c of cols.filter(c=>c.table_name===table.relname)) {
      const generated=c.is_generated==='ALWAYS';
      const nullable=c.is_nullable==='YES'||kind==='v';
      const optional=mode==='Update'||(mode==='Insert'&&(nullable||c.column_default||generated));
      const typ=mode!=='Row'&&generated?'never':tsType(c.udt_name)+(nullable?' | null':'');
      out+=JSON.stringify(c.column_name)+(optional?'?':'')+': '+typ+';\n';
     } out+='};\n';
    }
    out+='Relationships: ['+fks.filter(f=>f.source===table.relname).map(f=>`{ foreignKeyName: ${JSON.stringify(f.conname)}; columns: ${JSON.stringify(f.cols)}; isOneToOne: false; referencedRelation: ${JSON.stringify(f.target)}; referencedColumns: ${JSON.stringify(f.refs)} }`).join(',')+'];\n};\n';
   } out+='};\n';
 }
 const fns=(await db.query(`select p.proname,p.proargnames,p.proargmodes,p.proargtypes::oid[] as inputs,p.proallargtypes,
   p.pronargdefaults,p.proretset,t.typname as result from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype
   where n.nspname='public' and t.typname<>'trigger' order by p.proname`)).rows;
 out+='Functions: {\n';
 for(const f of fns) {
  const all=f.proallargtypes??f.inputs;const names=f.proargnames??[];const modes=f.proargmodes??all.map(()=> 'i');
  const args=all.map((oid,i)=>({name:names[i]??'arg'+i,mode:modes[i],type:tsType(byOid.get(oid)?.typname)}));
  const input=args.filter(a=>a.mode==='i'||a.mode==='b');const result=args.filter(a=>['o','b','t'].includes(a.mode));
  const argsText=input.length?'{'+input.map((a,i)=>JSON.stringify(a.name)+(i>=input.length-f.pronargdefaults?'?':'')+': '+a.type+' | null').join(';')+'}':'Record<PropertyKey, never>';
  let returnType=result.length?'{'+result.map(a=>JSON.stringify(a.name)+': '+a.type).join(';')+'}':tables.some(t=>t.relname===f.result)?`Database["public"]["Tables"][${JSON.stringify(f.result)}]["Row"]`:tsType(f.result);
  if(f.proretset)returnType='('+returnType+')[]';
  out+=JSON.stringify(f.proname)+': { Args: '+argsText+'; Returns: '+returnType+' };\n';
 }
 out+='}; Enums: {'+enums.map(e=>JSON.stringify(e.typname)+': '+e.labels.map(JSON.stringify).join(' | ')).join(';')+'}; CompositeTypes: Record<never,never>; }; };\n';
 out+='type Schema = Database["public"];\nexport type Tables<T extends keyof (Schema["Tables"] & Schema["Views"])> = (Schema["Tables"] & Schema["Views"])[T]["Row"];\n';
 out+='export type TablesInsert<T extends keyof Schema["Tables"]> = Schema["Tables"][T]["Insert"];\nexport type TablesUpdate<T extends keyof Schema["Tables"]> = Schema["Tables"][T]["Update"];\n';
 out+='export type Enums<T extends keyof Schema["Enums"]> = Schema["Enums"][T];\nexport type CompositeTypes = Record<never,never>;\n';
 out+='export const Constants = '+JSON.stringify({public:{Enums:Object.fromEntries(enums.map(e=>[e.typname,e.labels]))}})+' as const;\n';
 if (check) {
  if ((await readFile('src/lib/database.types.ts','utf8')).replace(/\r\n/g,'\n') !== out.replace(/\r\n/g,'\n')) throw new Error('Tipos desactualizados: ejecuta npm run gen:types:embedded');
 } else await writeFile('src/lib/database.types.ts',out);
}
