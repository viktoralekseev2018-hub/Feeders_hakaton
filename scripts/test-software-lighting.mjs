import assert from 'node:assert/strict';
import {registerHooks,createRequire} from 'node:module';
const root=new URL('../',import.meta.url);
registerHooks({resolve(specifier,context,next){if(specifier==='three')return{url:new URL('web/vendor/three.module.js',root).href,shortCircuit:true};return next(specifier,context);}});
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json':import.meta.url);
const {createCanvas}=require('@napi-rs/canvas');
const THREE=await import('../web/vendor/three.module.js');
const {SoftwareRenderer}=await import('../web/src/render/SoftwareRenderer.js');
const canvas=createCanvas(160,160),renderer=new SoftwareRenderer(canvas);renderer.setSize(160,160);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.z=3;
const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshStandardMaterial({color:0x506070}));scene.add(plane);
function sample(){renderer.last=-1e9;renderer.render(scene,camera);const p=canvas.getContext('2d').getImageData(77,81,1,1).data;assert.equal(p[3],255);return Array.from(p).slice(0,3);}
const unlit=sample();const light=new THREE.HemisphereLight(0xff0000,0xff0000,2.6);scene.add(light);const red=sample();light.color.set(0x0000ff);light.groundColor.set(0x0000ff);const blue=sample();
assert.ok(red[0]>blue[0]+15,'red ambient changes actual red pixel channel');assert.ok(blue[2]>red[2]+15,'blue ambient changes actual blue pixel channel');
light.intensity=.26;const dim=sample();assert.ok(dim.reduce((a,b)=>a+b,0)<blue.reduce((a,b)=>a+b,0)*.8,'lower intensity visibly dims geometry');
scene.remove(light);assert.deepEqual(sample(),unlit,'no-light legacy shading retained');
plane.material=new THREE.MeshBasicMaterial({color:0x506070});const basic=sample();scene.add(light);light.intensity=0;assert.deepEqual(sample(),basic,'unlit UI-style geometry unaffected');
plane.material=new THREE.MeshStandardMaterial({color:0x506070,emissive:0x00ff00,emissiveIntensity:.5});const emission=sample();assert.ok(emission[1]>0&&emission[0]===0&&emission[2]===0,'emissive equipment remains visible at zero ambient');
console.log(JSON.stringify({passed:true,checks:['ambient color changes rendered pixels','ambient intensity dims rendered pixels','legacy scene without light retained','basic material independent of light','emission persists in darkness'],pixels:{unlit,red,blue,dim}}));

// Actual pixels, not an implementation mirror: the camera cuts through a large
// triangle. The visible remainder must survive clipping and occlude the blue rear.
scene.clear();camera.position.set(0,0,0);camera.lookAt(0,0,-1);
const rear=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:0x0000ff}));rear.position.z=-3;scene.add(rear);
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-2,-2,-2,2,-2,-2,0,2,.1],3));geometry.computeVertexNormals();scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xff0000,side:THREE.DoubleSide})));
const clipped=sample();assert.ok(clipped[0]>200&&clipped[2]<20,'near-clipped foreground must occlude rear geometry');
console.log('Canvas near-plane clipping and depth occlusion — passed');
