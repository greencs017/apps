/* One authenticated WindowProxy and one startup protocol for all launchers. */
(() => {
  'use strict';
  const app=document.getElementById('app'),shell=document.getElementById('shell');
  const appId=app.dataset.app,googleLayer=document.getElementById('googleLayer'),status=document.getElementById('googleStatus');
  const clientId='892491045559-mt2b7iabv71djbu6icf6rpl2a2fa90e8.apps.googleusercontent.com';
  const prefix=appId==='escalafon'?'escalafon-':'apps-'+appId+'-';
  const logoutKey='apps.'+appId+'.signed-out.v1';
  const trace=document.getElementById('bridgeTrace'),summary=document.getElementById('bridgeSummary');
  // Orígenes permitidos por aplicación. Escalafón admite la versión actual y
  // la nueva versión sin Apps Script (escalafon-online) durante la transición.
  const appOrigins={
    escalafon:['https://escalafon-pns.vercel.app','https://escalafon-online.vercel.app'],
    revisor:['https://revisor-cargo-l5.vercel.app'],
    simulador:['https://simulador-remuneraciones-delta.vercel.app'],
    gastos:['https://mis-gastos-ecru.vercel.app']
  };
  const appSourceOrigin=(()=>{try{return new URL(app.dataset.src).origin;}catch(_){return '';}})();
  const expectedOrigin=(appOrigins[appId]||[]).includes(appSourceOrigin)?appSourceOrigin:'';
  let source=null,sourceOrigin='',channel='',timer,lastState='OPENING',googlePromise,googleReady=false,owner=false,oneSignal=null;
  const events=[];
  function log(state,detail=''){
    events.push(new Date().toLocaleTimeString('es-CL')+' '+state+(detail?' · '+detail:''));
    trace.textContent=events.slice(-30).join('\n');summary.textContent='Diagnóstico · '+state;
    console.info('[access]',state,detail);
  }
  function fail(message){clearTimeout(timer);log('ERROR',message);document.getElementById('bridgeDiagnostics').open=true;shell.classList.remove('ready');document.getElementById('loadingText').textContent=message;document.getElementById('retry').hidden=false;}
  function deadline(){
    clearTimeout(timer);
    // El Simulador puede esperar hasta 55 s una respuesta completa del backend.
    // Las demás aplicaciones mantienen su plazo de inicio original.
    const ms=appId==='simulador'?65000:45000;
    timer=setTimeout(()=>fail('No se completó el acceso. Último estado: '+lastState+'. Pulsa Reintentar.'),ms);
  }
  function transition(state,detail=''){
    lastState=state;log(state,detail);
    if(['LOGIN_READY','GOOGLE_REQUIRED','GOOGLE_READY','APP_READY'].includes(state)){clearTimeout(timer);shell.classList.add('ready');}
    else if(state==='ERROR'){fail(detail||'No se pudo completar el acceso.');return;}
    else deadline();
    if(state==='APP_READY'){googleLayer.hidden=true;document.getElementById('bridgeDiagnostics').open=false;}
  }
  function hex(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');}
  const DEVICE_STORAGE_KEY='apps.admin.device.v1';
  const DEVICE_COOKIE_KEY='apps_admin_device_v1';
  function readDeviceCookie_(){
    const match=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(DEVICE_COOKIE_KEY+'='));
    if(!match)return '';
    try{return decodeURIComponent(match.slice(DEVICE_COOKIE_KEY.length+1));}catch(_){return '';}
  }
  function writeDeviceCookie_(key){
    document.cookie=DEVICE_COOKIE_KEY+'='+encodeURIComponent(key)+'; Path=/apps/; Max-Age=315360000; SameSite=Lax; Secure';
  }
  function stableDevice(){
    let key='';
    try{key=localStorage.getItem(DEVICE_STORAGE_KEY)||'';}catch(_){}
    if(!/^[a-f0-9]{64}$/.test(key))key=readDeviceCookie_();
    if(!/^[a-f0-9]{64}$/.test(key))key=hex();
    try{localStorage.setItem(DEVICE_STORAGE_KEY,key);}catch(_){}
    writeDeviceCookie_(key);
    if(!/^[a-f0-9]{64}$/.test(key))throw Error('El identificador guardado del dispositivo no es válido.');
    const ua=navigator.userAgent||'',ipad=/iPad/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    // Solo el Simulador distingue tablets. Escalafón y Revisor mantienen sus
    // protocolos actuales para no cambiar vinculaciones ya existentes.
    const type=appId==='simulador'&&ipad?'tablet':(ipad||/Mobi|Android|iPhone|iPod/i.test(ua)?'mobile':'desktop');
    return type+':'+key;
  }
  function trustedOrigin(origin){
    return !!expectedOrigin&&origin===expectedOrigin;
  }
  function send(payload){
    if(!source)return false;
    source.postMessage({...payload,channel,app:appId},sourceOrigin);
    return true;
  }
  function loadGoogle(){
    if(googlePromise)return googlePromise;
    googlePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
      const t=setTimeout(()=>reject(Error('Google no cargó en 20 segundos. Comprueba tu conexión y reintenta.')),20000);
      script.onload=()=>{clearTimeout(t);window.google?.accounts?.id?resolve():reject(Error('Google no pudo inicializarse.'));};
      script.onerror=()=>{clearTimeout(t);reject(Error('No fue posible cargar el acceso de Google.'));};document.head.appendChild(script);
    });return googlePromise;
  }
  async function showGoogle(){
    transition('GOOGLE_REQUIRED');googleLayer.hidden=false;status.textContent='Preparando Google…';
    try{
      await loadGoogle();
      if(!googleReady){
        google.accounts.id.initialize({client_id:clientId,auto_select:false,cancel_on_tap_outside:false,callback:r=>{
          if(!r.credential){status.textContent='Google no entregó una credencial válida.';return;}
          transition('GOOGLE_VERIFYING');status.textContent='Validando la cuenta…';
          send({type:appId==='escalafon'?'escalafon-google-credential':'apps-admin-google-credential',credential:r.credential});
        }});
        google.accounts.id.renderButton(document.getElementById('googleButton'),{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'rectangular',width:Math.min(320,window.innerWidth-64),locale:'es'});
        googleReady=true;
      }
      status.textContent='Confirma tu identidad con Google.';transition('GOOGLE_READY');
    }catch(e){status.textContent=e.message;fail(e.message);}
  }
  let pushRegistrationId='',pushRegistrationTimer;
  let pushActivationInProgress=false,pushActivationTimer,pushPermissionDialog=null;
  function closePushPermissionDialog(){if(pushPermissionDialog)pushPermissionDialog.style.display='none';}
  function pushError(message,needsApi=false){
    pushActivationInProgress=false;clearTimeout(pushActivationTimer);closePushPermissionDialog();
    send({type:prefix+'push-status',enabled:false,error:message,needsApi});
  }
  async function sharePush(){
    if(!owner||!oneSignal)return;
    const enabled=oneSignal.User.PushSubscription.optedIn,id=oneSignal.User.PushSubscription.id;
    if(!enabled||!id){pushRegistrationId='';if(!pushActivationInProgress)send({type:prefix+'push-status',enabled:false});return;}
    if(pushRegistrationId===id){
      if(pushActivationInProgress){pushActivationInProgress=false;clearTimeout(pushActivationTimer);closePushPermissionDialog();send({type:prefix+'push-status',enabled:true});}
      return;
    }
    pushRegistrationId=id;
    clearTimeout(pushRegistrationTimer);
    pushRegistrationTimer=setTimeout(()=>{pushRegistrationId='';pushError('El servidor no confirmó el registro. Pulsa Activar notificaciones para reintentar.');},20000);
    send({type:prefix+'push-subscription',subscriptionId:id});
  }
  let pushPromise;
  function ensurePush(){
    if(pushPromise)return pushPromise;
    pushPromise=new Promise((resolve,reject)=>{
      window.OneSignalDeferred=window.OneSignalDeferred||[];
      window.OneSignalDeferred.push(async sdk=>{try{await sdk.init({appId:'0956c8db-37fb-4a11-98bd-397d121ae8fa',serviceWorkerParam:{scope:'/apps/'},serviceWorkerPath:'/apps/OneSignalSDKWorker.js'});oneSignal=sdk;sdk.User.PushSubscription.addEventListener('change',()=>{pushRegistrationId='';void sharePush();});sdk.Notifications.addEventListener('permissionChange',()=>{pushRegistrationId='';void sharePush();});resolve();await sharePush();}catch(e){reject(e);}});
      const s=document.createElement('script');s.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';s.defer=true;s.onerror=()=>reject(Error('No cargaron las notificaciones.'));document.head.appendChild(s);
    });return pushPromise;
  }

  // Los navegadores, especialmente iOS, exigen que el permiso se solicite
  // desde una pulsación real en el documento principal, no desde un iframe
  // ni en la recepción de postMessage.
  function getPushPermissionDialog(){
    if(pushPermissionDialog)return pushPermissionDialog;
    const shade=document.createElement('div');
    shade.id='appsPushPermissionDialog';
    shade.style.cssText='position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(10,32,23,.62);font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    shade.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="appsPushTitle" style="width:min(100%,420px);max-height:90vh;overflow:auto;box-sizing:border-box;padding:24px;background:#fff;border-radius:16px;color:#173d2b;box-shadow:0 16px 45px #0004">'
      +'<h2 id="appsPushTitle" style="font-size:22px;margin:0 0 12px">Activar notificaciones</h2>'
      +'<p data-push-message role="status" aria-live="polite" style="font-size:15px;line-height:1.5;margin:0 0 18px">Preparando OneSignal…</p>'
      +'<button type="button" data-push-allow disabled style="width:100%;min-height:48px;border:0;border-radius:10px;background:#173d2b;color:#fff;font:600 16px -apple-system,BlinkMacSystemFont,sans-serif;padding:12px">Permitir notificaciones</button>'
      +'<button type="button" data-push-cancel style="width:100%;min-height:44px;margin-top:10px;border:1px solid #b9cabe;border-radius:10px;background:white;color:#173d2b;font:600 16px -apple-system,BlinkMacSystemFont,sans-serif;padding:10px">Cancelar</button>'
      +'</section>';
    document.body.appendChild(shade);
    const allow=shade.querySelector('[data-push-allow]');
    const status=shade.querySelector('[data-push-message]');
    shade.querySelector('[data-push-cancel]').addEventListener('click',()=>{
      pushError('Activación cancelada. Puedes volver a intentarlo.');
    });
    allow.addEventListener('click',()=>{
      // La llamada al SDK se hace inmediatamente desde este evento físico.
      allow.disabled=true;
      status.textContent='Solicitando permiso al dispositivo…';
      let permissionRequest;
      try{permissionRequest=oneSignal.Notifications.requestPermission();}
      catch(e){pushError(e.message||'El navegador no permitió solicitar notificaciones.');return;}
      Promise.resolve(permissionRequest).then(async()=>{
        if(!oneSignal.Notifications.permission){
          throw Error('El dispositivo no concedió permiso. Revisa Ajustes > Notificaciones para esta aplicación.');
        }
        status.textContent='Permiso concedido. Registrando este dispositivo…';
        await oneSignal.User.PushSubscription.optIn();
        await sharePush();
      }).catch(e=>pushError(e.message||'No fue posible registrar las notificaciones.'));
    });
    pushPermissionDialog=shade;
    return shade;
  }
  async function beginPushPermission(){
    const dialog=getPushPermissionDialog(),message=dialog.querySelector('[data-push-message]');
    const allow=dialog.querySelector('[data-push-allow]');
    dialog.style.display='flex';
    if(pushActivationInProgress)return;
    pushActivationInProgress=true;
    allow.disabled=true;
    message.textContent='Preparando OneSignal…';
    clearTimeout(pushActivationTimer);
    pushActivationTimer=setTimeout(()=>pushError('La activación no respondió. Comprueba la conexión y vuelve a intentarlo.'),45000);
    try{
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent||'');
      const standalone=navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
      if(ios&&!standalone)throw Error('En iPhone/iPad, abre la aplicación desde el ícono agregado a la pantalla de inicio para recibir notificaciones.');
      await Promise.race([ensurePush(),new Promise((_,reject)=>setTimeout(()=>reject(Error('OneSignal no inició. Cierra la aplicación y vuelve a abrirla.')),15000))]);
      if(!pushActivationInProgress)return;
      if(!oneSignal.Notifications.isPushSupported())throw Error('Este navegador no admite notificaciones push en el modo actual.');
      if(typeof Notification!=='undefined'&&Notification.permission==='denied'){
        throw Error('Las notificaciones están bloqueadas. Habilítalas en Ajustes > Notificaciones del dispositivo.');
      }
      message.textContent='Pulsa «Permitir notificaciones». El permiso se solicitará directamente desde esta aplicación.';
      allow.disabled=false;
      allow.focus();
    }catch(e){pushError(e.message||'No fue posible preparar las notificaciones.');}
  }

  window.addEventListener('message',async event=>{
    const d=event.data;
    if(!d||typeof d!=='object'||d.channel!==channel||d.app!==appId||!trustedOrigin(event.origin)||!event.source)return;
    if(!source){
      if(d.type!=='apps-bridge-ready'||d.version!==1)return;
      // A nonce unique to this iframe load binds the inner Google frame; origin alone is insufficient.
      source=event.source;sourceOrigin=event.origin;transition('BRIDGE_READY');
      send({type:'apps-bridge-ack',signedOut:localStorage.getItem(logoutKey)==='1'});return;
    }
    if(event.source!==source||event.origin!==sourceOrigin)return;
    if(d.type==='apps-bridge-state'){
      const allowed=['DEVICE_RECEIVED','DEVICE_CHECK','DEVICE_TRUSTED','RESUME_SESSION','SESSION_RESUMED','GOOGLE_VERIFYING','GOOGLE_VALIDATED','TRUST_DEVICE','LOGIN_READY','APP_READY','ERROR'];
      if(allowed.includes(d.state))transition(d.state,typeof d.detail==='string'?d.detail.slice(0,250):'');
    }else if(d.type==='apps-bridge-signout'){
      if(d.value===true)localStorage.setItem(logoutKey,'1');else localStorage.removeItem(logoutKey);
    }else if(d.type==='apps-admin-google-required'||d.type==='escalafon-google-login'){
      if(d.type==='escalafon-google-login'&&!d.visible){googleLayer.hidden=true;return;}await showGoogle();
    }else if(d.type==='apps-admin-google-result'||d.type==='escalafon-google-result'){
      if(d.ok===true){googleLayer.hidden=true;}else{transition('GOOGLE_REQUIRED');googleLayer.hidden=false;status.textContent='Google no pudo validar el acceso. Revisa el mensaje de la aplicación.';}
    }else if(d.type===prefix+'owner-session'){
      owner=d.owner===true;if(owner)ensurePush().catch(e=>pushError(e.message||'No fue posible preparar las notificaciones.'));else{pushRegistrationId='';clearTimeout(pushRegistrationTimer);}
    }else if(d.type===prefix+'push-registration-result'&&owner){
      if(d.subscriptionId!==pushRegistrationId)return;
      pushActivationInProgress=false;clearTimeout(pushActivationTimer);closePushPermissionDialog();
      clearTimeout(pushRegistrationTimer);
      if(d.ok&&d.apiConfigurada){send({type:prefix+'push-status',enabled:true});}
      else{pushRegistrationId='';pushError(d.error||(d.apiConfigurada===false?'Falta configurar la App API Key de OneSignal en esta aplicación.':'El servidor no confirmó el dispositivo.'),d.ok===true&&d.apiConfigurada===false);}
    }else if(d.type===prefix+'enable-push'&&owner){
      void beginPushPermission();
    }
  });
  document.getElementById('retry').onclick=()=>location.reload();
  app.addEventListener('load',()=>log('IFRAME_LOADED'));
  log('LAUNCHER_LOADED');
  try{
    const device=stableDevice();
    const url=new URL(app.dataset.src);
    url.searchParams.set('device',device);
    channel=hex();
    url.searchParams.set('bridge',channel);
    transition('OPENING');
    app.src=url.href;
  }catch(e){fail(e.message||'Habilita el almacenamiento del navegador para identificar este dispositivo.');}
})();

