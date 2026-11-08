const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../access-bridge.js'),'utf8');

function boot({session=new Map(),search=''}={}){
 const handlers={},classList={add(){},remove(){}},elements=new Map(),appended=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{id,classList,hidden:true,textContent:'',dataset:{app:'licencias',src:'https://revisor-licencias-medicas.vercel.app/?build=test'},addEventListener(){}});return elements.get(id);};
 const context={URL,URLSearchParams,Uint8Array,crypto:crypto.webcrypto,console:{info(){}},Date,Math,JSON,
  location:{href:'https://greencs017.github.io/apps/revisor-licencias-medicas/'+search,search,reload(){}},
  navigator:{platform:'iPhone',userAgent:'iPhone',maxTouchPoints:5},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  sessionStorage:{getItem:k=>session.has(k)?session.get(k):null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)},
  document:{cookie:'',getElementById:el,createElement:()=>({style:{},setAttribute(){}}),head:{appendChild(){}},body:{appendChild:n=>appended.push(n)}},
  setTimeout:()=>0,clearTimeout(){}};
 context.window={addEventListener:(n,f)=>handlers[n]=f,innerWidth:390};
 vm.runInNewContext(source,context);
 const url=new URL(el('app').src),channel=url.searchParams.get('bridge'),sent=[];
 const inner={postMessage:d=>sent.push(d)};
 const emit=d=>handlers.message({data:{app:'licencias',channel,...d},origin:'https://revisor-licencias-medicas.vercel.app',source:inner});
 return {sent,emit,appended,session};
}

test('opened from Green Apps shows the back button; opened directly it does not',()=>{
 assert.equal(boot().appended.length,0);
 const a=boot({search:'?via=green-apps'});
 assert.equal(a.appended.length,1);assert.equal(a.appended[0].href,'../green-apps/');
 assert.equal(a.session.get('greenapps.via'),'1');
 assert.equal(boot({session:a.session}).appended.length,1,'se mantiene al recargar en la misma sesión');
});

test('a valid Google credential from Green Apps is reused once per app instead of asking again',async()=>{
 const session=new Map([['greenapps.google.v1',JSON.stringify({credential:'x'.repeat(120),exp:Math.floor(Date.now()/1000)+1800})]]);
 const a=boot({session});
 await a.emit({type:'apps-bridge-ready',version:1});
 await a.emit({type:'apps-admin-google-required'});
 assert.deepEqual(a.sent.filter(m=>m.type==='apps-admin-google-credential').map(m=>m.credential),['x'.repeat(120)]);
 // Si la aplicación vuelve a pedir Google (p. ej. la credencial fue rechazada), ya no se reutiliza.
 const b=boot({session});
 await b.emit({type:'apps-bridge-ready',version:1});
 b.emit({type:'apps-admin-google-required'});
 assert.equal(b.sent.filter(m=>m.type==='apps-admin-google-credential').length,0);
});

test('an expired Green Apps credential is never sent',async()=>{
 const session=new Map([['greenapps.google.v1',JSON.stringify({credential:'y'.repeat(120),exp:Math.floor(Date.now()/1000)+30})]]);
 const a=boot({session});
 await a.emit({type:'apps-bridge-ready',version:1});
 a.emit({type:'apps-admin-google-required'});
 assert.equal(a.sent.filter(m=>m.type==='apps-admin-google-credential').length,0);
});
