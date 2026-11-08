const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('OneSignal usa el mismo worker accesible bajo /apps/ en las tres aplicaciones',()=>{
  const script=fs.readFileSync(path.join(__dirname,'../access-bridge.js'),'utf8');
  const worker=fs.readFileSync(path.join(__dirname,'../OneSignalSDKWorker.js'),'utf8');
  assert.match(worker,/importScripts\(['"]https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\/OneSignalSDK\.sw\.js['"]\)/);
  assert.match(script,/serviceWorkerParam:\{scope:'\/apps\/'\},serviceWorkerPath:'\/apps\/OneSignalSDKWorker\.js'/);
  assert.doesNotMatch(script,/serviceWorkerPath:new URL\(/);
  for(const dir of ['simulador-remuneraciones','escalafon-online','revisor-cargo-fiscal']){
    for(const page of ['index.html','windows.html']){
      const html=fs.readFileSync(path.join(__dirname,'..',dir,page),'utf8');
      assert.match(html,/access-bridge\.js\?v=20261108-seguridad1/);
    }
  }
});
