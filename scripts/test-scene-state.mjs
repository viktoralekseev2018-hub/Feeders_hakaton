import fs from 'node:fs';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const root=new URL('../',import.meta.url);
registerHooks({resolve(specifier,context,next){
 if(specifier==='three') return {url:new URL('web/vendor/three.module.js',root).href,shortCircuit:true};
 if(specifier.startsWith('three/addons/')) return {url:new URL('web/vendor/'+specifier.slice('three/addons/'.length),root).href,shortCircuit:true};
 return next(specifier,context);
}});
const THREE=await import('../web/vendor/three.module.js');
const {ShipScene}=await import('../web/src/scene.js');
const manifest=JSON.parse(fs.readFileSync(new URL('world/manifest.json',root)));
const raw={images:[],textures:[],materials:[],geometries:[],object:new Map()};
for(const r of manifest.resources){const d=JSON.parse(fs.readFileSync(new URL('world/'+r.id+'.json',root)));if(d.kind==='object')raw.object.set(r.id,d.body);else raw[d.kind].push(d.body);}
const loader=new THREE.ObjectLoader(),images=loader.parseImages(raw.images,()=>{}),textures=loader.parseTextures(raw.textures,images),materials=loader.parseMaterials(raw.materials,textures),geometries=loader.parseGeometries(raw.geometries,{});
const roots=new Map();for(const c of manifest.chunks)roots.set(c.low.object,loader.parseObject(raw.object.get(c.low.object),geometries,materials,textures,{}));
const context={streamWorld:{objects:roots}};
const sample=type=>{let found;for(const o of roots.values())o.traverse(m=>{if(m.userData.system===type)found=m;});assert.ok(found,type);return found;};
const reactor=sample('reactor'),cooling=sample('cooling'),plant=sample('greenhouse'),lamp=sample('grow-lamp'),power=sample('power');
ShipScene.prototype.updateState.call(context,{reactor_active:false,cooling_repaired:false,greenhouse_active:false});
assert.equal(reactor.material.emissiveIntensity,.22);assert.equal(plant.material.color.getHex(),0x687358);assert.equal(lamp.material.emissiveIntensity,.12);
ShipScene.prototype.updateState.call(context,{reactor_active:true,cooling_repaired:true,greenhouse_active:true});
assert.equal(reactor.material.emissiveIntensity,1.5);assert.equal(reactor.material.color.getHex(),0x84dcc5);assert.equal(cooling.material.color.getHex(),0x80d9c3);assert.equal(plant.material.color.getHex(),0x8ec79b);assert.equal(lamp.material.emissiveIntensity,1.5);assert.equal(power.material.emissiveIntensity,1.1);
const sizes=[[1366,698],[1920,1010],[390,784]];
for(const[w,h]of sizes){let actual;const c={container:{clientWidth:w,clientHeight:h},renderer:{setSize(...args){actual=args}},camera:new THREE.PerspectiveCamera()};ShipScene.prototype.resize.call(c);assert.deepEqual(actual,[w,h,false]);assert.equal(c.camera.aspect,w/h);}
console.log(JSON.stringify({passed:true,checks:['reactor power and cooling colors','greenhouse recovery','grow lamps','deck lighting','canvas resize and camera aspect at three sizes'],note:'geometry/material and sizing logic only; not visual browser QA'}));
