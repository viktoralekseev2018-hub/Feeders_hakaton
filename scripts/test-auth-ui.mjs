// Dependency-free DOM fixture. Tests interaction logic, not browser layout.
import assert from 'node:assert/strict';
import {AuthScreen} from '../web/src/ui/AuthScreen.js';
class Element {
 constructor(){this.value='';this.type='text';this.hidden=false;this.disabled=false;this.attrs={};this.listeners={};this.children=[];this.classList={toggle(){}};}
 setAttribute(k,v){this.attrs[k]=v;} removeAttribute(k){delete this.attrs[k];}
 addEventListener(k,v){this.listeners[k]=v;} closest(){return this;}
 focus(){globalThis.focused=this;} querySelectorAll(){return this.children;}
}
const nodes=new Map();
globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}};
const $=document.getElementById;
globalThis.location={pathname:'/register',search:'?room=ABC123'};
globalThis.history={replaceState(a,b,path){this.path=path;}};
globalThis.window={addEventListener(){}};
$('password').type='password';$('password-strength').dataset={};$('password-strength').children=Array.from({length:4},()=>new Element());
let calls=0,result=null,complete;
const network={authenticate:()=>{calls++;return new Promise(resolve=>complete=resolve);}};
const ui=new AuthScreen(network,u=>result=u);
assert.equal($('confirm-field').hidden,false);
$('username').value='bad name';$('password').value='secret123';$('password-confirm').value='secret123';
await ui.submit();assert.equal(calls,0);assert.equal($('username').attrs['aria-invalid'],'true');
$('username').value='navigator';$('password-confirm').value='typo';
await ui.submit();assert.equal(calls,0);assert.equal($('password-confirm').attrs['aria-invalid'],'true');
$('password-confirm').value='secret123';const first=ui.submit();await ui.submit();assert.equal(calls,1);assert.equal($('auth-submit').disabled,true);
ui.setMode(false);assert.equal(ui.register,true,'cannot change operation while request is in flight');
complete({username:'navigator'});await first;assert.deepEqual(result,{username:'navigator'});assert.equal($('password').value,'');assert.equal($('password-confirm').value,'');assert.equal($('auth-submit').disabled,false);
ui.setMode(false);assert.equal(history.path,'/login?room=ABC123');assert.equal($('confirm-field').hidden,true);
$('password-toggle').onclick();assert.equal($('password').type,'text');assert.equal($('password-toggle').attrs['aria-pressed'],'true');
$('password-toggle').onclick();assert.equal($('password').type,'password');
$('password').value='😀'.repeat(20);await ui.submit();assert.equal(calls,1,'reject passwords longer than bcrypt limit');
$('password').value='validPassword';network.authenticate=async()=>{throw Object.assign(new Error('duplicate'),{status:409});};await ui.submit();assert.match($('username-error').textContent,/занят/);assert.equal($('auth-submit').disabled,false);
network.authenticate=async()=>{throw Object.assign(new Error('unauthorized'),{status:401});};await ui.submit();assert.match($('auth-error').textContent,/не совпали/);
network.authenticate=async()=>{throw new TypeError('Failed to fetch');};await ui.submit();assert.match($('auth-error').textContent,/Нет связи/);
console.log(JSON.stringify({passed:true,checks:['invalid callsign','confirmation mismatch','duplicate submit prevented','mode change blocked while submitting','credentials cleared','invitation preserved','password visibility','bcrypt byte limit','duplicate callsign feedback','wrong credentials feedback','offline feedback'],scope:'DOM fixture; no browser layout or rendering assertions'}));
