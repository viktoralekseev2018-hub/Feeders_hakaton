import * as THREE from 'three';
import {SoftwareRenderer} from './render/SoftwareRenderer.js';
import {BridgeCrew} from './crew/BridgeCrew.js';
import {PlayerControls} from './controls/PlayerControls.js';
import {StreamingWorld} from './world/StreamingWorld.js';
import {ShipInterior} from './interior/ShipInterior.js';
import {layout,walkable,slideMove,roomAt} from './interior/DeckLayout.js';
import {LivingWorld} from './world/LivingWorld.js';
const stations=[
 {id:'reactor',label:'Пульт реактора',action:'operations',position:[17,1.5,0],radius:5},
 {id:'greenhouse',label:'Контур оранжереи',action:'operations',position:[-16,1,-17],radius:3},
 {id:'archive',label:'Терминал архива',action:'operations',position:[-5,1.5,-5],radius:2.5},
 {id:'laboratory',label:'Научный стол',action:'laboratory',position:[4,1,18],radius:3.5},
 {id:'cryo',label:'Записи пробуждения',action:'journal',position:[-16,1,-3],radius:3.5}
];
export class ShipScene{
 constructor(container){this.abortController=new AbortController();this.listen=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:this.abortController.signal});this.container=container;this.canvas=container.querySelector('canvas');this.player=new THREE.Vector3(-15,1.7,0);this.yaw=0;this.mode='overview';this.target=new THREE.Vector3();this.azimuth=.8;this.overviewRadius=58;this.overviewHeight=38;this.remote=new Map();this.clock=new THREE.Clock();this.active=false;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(43,1,.1,500);
 try{const context=this.canvas.getContext('webgl2',{antialias:true,alpha:true});if(!context)throw new Error('WebGL unavailable');this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,context,antialias:true,alpha:true});}catch{this.renderer=new SoftwareRenderer(this.canvas);const label=document.createElement('span');label.className='render-mode';label.textContent='Совместимый режим';container.append(label);}
 this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
 if(!this.renderer.isSoftware){this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;};
 this.ambientLight=new THREE.HemisphereLight(0xe4edf8,0x687582,1.5);this.scene.add(this.ambientLight);const sun=this.sunLight=new THREE.DirectionalLight(0xdbe6ff,.45);sun.position.set(20,40,15);this.scene.add(sun);this.crew=new BridgeCrew(this.scene);this.controls=new PlayerControls(this.camera,this.canvas);this.controls.walkSpeed=5;this.controls.sprintSpeed=9;this.streamWorld=new StreamingWorld(this);this.interior=new ShipInterior(this);this.livingWorld=new LivingWorld(this);this.schematicGroup=new THREE.Group();this.scene.add(this.schematicGroup);this.avatar=this.makeAvatar(0x7de6df);this.scene.add(this.avatar);
 this.listen(this.canvas,'click',e=>{if(this.mode==='explore'&&this.active)this.controls.lock();if(this.mode==='overview'&&this.active&&!this.didDrag){const worldTarget=this.livingWorld.pick(e,this.canvas,this.camera);if(worldTarget){this.interactWorld(worldTarget);return;}const id=this.crew.pick(e,this.canvas,this.camera);if(id)window.dispatchEvent(new CustomEvent('crew-select',{detail:{agentID:id}}));else if(this.hoveredStation)window.dispatchEvent(new CustomEvent('ship-object',{detail:this.hoveredStation}));}});
 this.listen(this.canvas,'pointermove',e=>{if(this.mode!=='overview')return;const now=performance.now();if(now-(this.lastPick||0)<100)return;this.lastPick=now;const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hit=ray.intersectObjects([...this.interior.rooms.values()],true)[0];this.hoveredStation=this.livingWorld.pick(e,this.canvas,this.camera)||(hit?stations.find(x=>hit.point.distanceTo(new THREE.Vector3(...x.position))<x.radius):null);this.canvas.style.cursor=this.hoveredStation?'pointer':'grab';});this.listen(this.canvas,'pointerleave',()=>{this.hoveredStation=null;});
 let drag=null;this.listen(this.canvas,'pointerdown',e=>{if(this.mode==='overview'){this.didDrag=false;drag={x:e.clientX,a:this.azimuth};this.canvas.setPointerCapture(e.pointerId);}});this.listen(this.canvas,'pointermove',e=>{if(drag){if(Math.abs(e.clientX-drag.x)>5)this.didDrag=true;this.azimuth=drag.a+(e.clientX-drag.x)*.006;}});this.listen(this.canvas,'pointerup',()=>drag=null);this.listen(this.canvas,'pointercancel',()=>drag=null);
 this.listen(this.canvas,'wheel',e=>{if(!this.active||this.mode!=='overview')return;e.preventDefault();const factor=Math.exp(Math.sign(e.deltaY)*.12);this.overviewRadius=THREE.MathUtils.clamp(this.overviewRadius*factor,5,85);this.overviewHeight=THREE.MathUtils.clamp(this.overviewHeight*factor,3,58);},{passive:false});
 this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();this.frames=0;this.fps=0;this.lastFps=performance.now();this.frame=()=>this.animate();this.frame();
 }
 canReach(x,z){const n=Math.ceil(Math.hypot(x-this.player.x,z-this.player.z)/.1);for(let i=1;i<n;i++){const t=i/n;if(!walkable(this.player.x+(x-this.player.x)*t,this.player.z+(z-this.player.z)*t,.02))return false;}return true;}
 nearestInteraction(){const world=this.livingWorld.nearest(this.player);if(world)return world;const npc=this.crew.nearest(this.player);if(npc&&roomAt(this.player.x,this.player.z)?.id===roomAt(...[this.crew.characters.find(c=>c.profile.id===npc).group.position.x,this.crew.characters.find(c=>c.profile.id===npc).group.position.z])?.id)return{type:'npc',id:npc,label:'Поговорить · '+this.crew.characters.find(x=>x.profile.id===npc).profile.short};const station=stations.find(x=>Math.hypot(this.player.x-x.position[0],this.player.z-x.position[2])<x.radius && roomAt(this.player.x,this.player.z)?.id===roomAt(x.position[0],x.position[2])?.id);return station?{type:'object',...station}:null;}
 schematic(){ }
 installSchematic(group){this.scene.remove(this.schematicGroup);this.schematicGroup=group;this.crew.characters.forEach(c=>{group.traverse(o=>{if(o.userData.proxyFor===c.profile.id){c.marker=o;c.marker.visible=!c.loaded;}})});}
 installAvatarTemplate(template){this.avatarTemplate=template;template.parent?.remove(template);this.scene.remove(this.avatar);this.avatar=this.makeAvatar(0x7de6df);this.scene.add(this.avatar);for(const item of this.remote.values()){const old=item.mesh;item.mesh=this.makeAvatar(0xb9a7ef);item.mesh.position.copy(old.position);this.scene.remove(old);this.scene.add(item.mesh);}}
 makeAvatar(color){if(!this.avatarTemplate)return new THREE.Group();const g=this.avatarTemplate.clone(true);if(!this.avatarMaterials)this.avatarMaterials=new Map();g.traverse(o=>{if(o.isMesh){const key=o.material.uuid+':'+color;if(!this.avatarMaterials.has(key)){const mat=o.material.clone();mat.color.set(0xdfe4e6);this.avatarMaterials.set(key,mat);}o.material=this.avatarMaterials.get(key);}});return g;}
 spawn(state){this.controls.resetKeys();this.player.set(state.position.x,state.position.y,state.position.z);this.yaw=state.yaw||0;if(this.mode==='explore'){this.camera.position.copy(this.player);this.camera.rotation.set(0,this.yaw,0);}this.streamWorld.update(this.player,true);}
 setMode(mode){this.controls.unlock();this.mode=mode;this.schematicGroup.visible=mode==='overview';if(mode==='explore'){this.camera.fov=70;this.camera.position.copy(this.player);this.camera.rotation.set(0,this.yaw,0);if(this.active)this.controls.lock();}else this.camera.fov=43;this.camera.updateProjectionMatrix();}
 focus(room){this.initialFocus=true;const p={cryo:[-16,0],bridge:[0,0],reactor:[17,0],bio:[-16,-17],habitat:[-15,16],research:[0,16],cargo:[15.5,16],corridor:[.5,9]}[room];this.target.set(p[0],0,p[1]);this.overviewRadius=22;this.overviewHeight=18;if(this.mode!=='overview')this.setMode('overview');}
 focusCrew(id){this.initialFocus=true;const p=this.crew.characters.find(x=>x.profile.id===id);if(!p)return;this.setMode('overview');this.target.copy(p.group.position).add(new THREE.Vector3(0,1,-.4));this.overviewRadius=5.5;this.overviewHeight=3.2;this.azimuth=3.7;}
 resetOverview(){this.target.set(0,0,-4);this.overviewRadius=58;this.overviewHeight=38;this.azimuth=.8;}
 setActive(value){this.active=value;if(!value){this.controls.unlock();this.controls.resetKeys();}else this.streamWorld.update(this.player,true);}
 snapshots(players,self,serverTime){if(serverTime)this.serverOffset=serverTime-Date.now();const present=new Set();for(const p of players){if(p.id===self)continue;present.add(p.id);let item=this.remote.get(p.id);if(!item){const mesh=this.makeAvatar(0xb9a7ef);this.scene.add(mesh);item={mesh,target:new THREE.Vector3()};this.remote.set(p.id,item);}item.target.set(p.x,.15,p.z);item.mesh.rotation.y=p.yaw;}for(const[id,item]of this.remote)if(!present.has(id)){this.scene.remove(item.mesh);this.remote.delete(id);}}
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 updateState(s){
  this.lastState=s;this.interior?.updateState(s);
  for(const root of this.streamWorld?.objects.values()||[]){root.traverse(o=>{
   if(!o.isMesh||!o.material?.isMeshStandardMaterial)return;
   const type=o.userData.system,m=o.material;
   if(type==='reactor'){const color=s.cooling_repaired?0x84dcc5:0xeab17c;m.color.set(color);m.emissive.set(color);m.emissiveIntensity=s.reactor_active?1.5:.22;}
   if(type==='cooling'){const color=s.cooling_repaired?0x80d9c3:0xe4a073;m.color.set(color);m.emissive.set(color);m.emissiveIntensity=s.cooling_repaired?.7:.25;}
   if(type==='greenhouse')m.color.set(s.greenhouse_active?0x8ec79b:0x687358);
   if(type==='grow-lamp')m.emissiveIntensity=s.greenhouse_active?1.5:.12;
   if(type==='power')m.emissiveIntensity=s.reactor_active?1.1:.12;
  });}
 }

 setUniverse(state,selfId){
  this.universe=state;this.selfId=selfId||this.selfId;
  if(!state){this.livingWorld.clear();this.crew.setBehaviors([]);this.ambientLight.color.set(0xc6e1f6);this.ambientLight.intensity=1.5;this.sunLight.intensity=.45;return;}
  this.livingWorld.setState(state,this.selfId);this.crew.setBehaviors(state.agents);
  this.ambientLight.color.set(state.settings?.ambient_color||'#c6e1f6');
  const intensity=Number(state.settings?.light_intensity??1);
  this.ambientLight.intensity=1.5*intensity;this.sunLight.intensity=.45*intensity;
 }
 interactWorld(target){if(target?.type==='world')this.onWorldInteract?.({object_id:target.object_id,action:target.action});}
 reactToSpeech(position=this.player){this.livingWorld.reactToSpeech(position);}
 focusWorldObject(id){const item=this.livingWorld.objects.get(id);if(!item)return;this.initialFocus=true;this.setMode('overview');this.target.copy(item.group.position).add(new THREE.Vector3(0,.8,0));this.overviewRadius=6;this.overviewHeight=4.2;this.azimuth=.9;}
 getMetrics(){const active=this.active&&!document.hidden;const info=this.renderer.info?.render||{};return{fps:active?this.fps:0,frame_ms:active&&this.fps>0?Math.round(10000/this.fps)/10:0,draw_calls:info.calls||0,triangles:info.triangles||0,renderer:this.renderer.isSoftware?'canvas':'webgl',npc_count:this.livingWorld.npcs.length};}
 animate(){
  if(this.disposed)return;this.raf=requestAnimationFrame(this.frame);
  const dt=Math.min(this.clock.getDelta(),.05),now=performance.now();
  if(this.mode==='overview'){const fit=Math.max(1,1.6/this.camera.aspect),r=this.overviewRadius*fit;this.camera.position.set(Math.sin(this.azimuth)*r+this.target.x,this.overviewHeight*fit,Math.cos(this.azimuth)*r+this.target.z);this.camera.lookAt(this.target);this.avatar.visible=true;}
  else{const previous=this.camera.position.clone();if(this.active)this.controls.update(dt);const next=slideMove(previous,this.camera.position,(x,z)=>walkable(x,z)&&this.livingWorld.walkable(x,z));this.camera.position.set(next.x,1.7,next.z);this.player.copy(this.camera.position);this.yaw=this.camera.rotation.y;this.avatar.visible=false;}
  this.interior.update(this.mode,this.player);
  this.avatar.position.set(this.player.x,.15,this.player.z);this.avatar.rotation.y=this.yaw;
  for(const item of this.remote.values())item.mesh.position.lerp(item.target,1-Math.exp(-dt*12));
  if(this.active&&!document.hidden){
   const reduced=document.documentElement.dataset.motion==='reduce'||matchMedia('(prefers-reduced-motion: reduce)').matches;
   this.livingWorld.animate(dt,reduced);
   this.crew.animate(this.livingWorld.time,this.player,reduced);
   for(const c of this.crew.characters)if(c.loaded)c.group.visible=this.mode==='overview'||this.interior.visibleRooms.has(roomAt(c.group.position.x,c.group.position.z)?.id);
   const before=this.renderer.last;this.renderer.render(this.scene,this.camera);
   if(!this.renderer.isSoftware||this.renderer.last!==before)this.frames++;
  }
  if(now-this.lastFps>=1000){this.fps=Math.round(this.frames*1000/(now-this.lastFps));this.frames=0;this.lastFps=now;}
 }
 dispose(){this.disposed=true;this.active=false;cancelAnimationFrame(this.raf);this.abortController.abort();this.observer.disconnect();this.controls.unlock();this.controls.controls.dispose();this.interior.dispose();this.livingWorld.dispose();this.crew.dispose();for(const group of this.streamWorld.objects.values())this.scene.remove(group);for(const kind of ['geometries','materials','textures'])for(const asset of Object.values(this.streamWorld.parsed[kind]))asset.dispose?.();for(const material of this.avatarMaterials?.values()||[])material.dispose();this.renderer.dispose?.();}
}
