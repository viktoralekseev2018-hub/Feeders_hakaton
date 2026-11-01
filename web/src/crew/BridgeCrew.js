import * as THREE from 'three';
export const CREW=[
{id:'savinykh',name:'Виктор Петрович Савиных',short:'Виктор Савиных',role:'Капитан · у штурвала',initials:'ВС',color:0xe6c799,position:[4.2,0,-3],hair:0xbec4c0,suit:0x33475e,height:1.02},
{id:'dzhanibekov',name:'Владимир Александрович Джанибеков',short:'Владимир Джанибеков',role:'Инженер · реактор',initials:'ВД',color:0xe5a779,position:[13,0,2],hair:0x645e59,suit:0x5d5b54,height:1.04},
{id:'ryazansky',name:'Сергей Николаевич Рязанский',short:'Сергей Рязанский',role:'Биолог · оранжерея',initials:'СР',color:0x94cba7,position:[-20,0,-14],hair:0x635b51,suit:0x3f665d,height:1.08},
{id:'krikalev',name:'Сергей Константинович Крикалёв',short:'Сергей Крикалёв',role:'Связь и навигация · мостик',initials:'СК',color:0xa5bfe8,position:[-6.7,0,-2],hair:0x3e4348,suit:0x49546b,height:1.03}];
export class BridgeCrew {
 constructor(scene) {
  this.scene=scene;this.ray=new THREE.Raycaster();this.materials=new Map();this.geometries=new Map();
  this.characters=CREW.map(profile=>{const group=new THREE.Group();group.position.set(...profile.position);return{profile,group,loaded:false,marker:null,behavior:'helpful'};});
 }
 material(color,emissive=false){const key=`${color}:${emissive}`;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,metalness:.24,roughness:.58,...(emissive?{emissive:color,emissiveIntensity:.4}:{})}));return this.materials.get(key);}
 piece(parent,shape,color,position,scale){if(!this.geometries.has(shape))this.geometries.set(shape,shape==='sphere'?new THREE.SphereGeometry(1,12,8):shape==='cylinder'?new THREE.CylinderGeometry(1,1,1,10):new THREE.BoxGeometry(1,1,1));const o=new THREE.Mesh(this.geometries.get(shape),this.material(color));o.position.set(...position);o.scale.set(...scale);parent.add(o);return o;}
 register(root){const found=[];root.traverse(o=>{if(o.userData.npcRoot)found.push(o);});for(const o of found){const entry=this.characters.find(x=>x.profile.id===o.userData.npcRoot);if(!entry)continue;entry.group=o;if(['ryazansky','krikalev'].includes(entry.profile.id))o.position.set(...entry.profile.position);entry.loaded=true;entry.baseRotation=o.rotation.y;entry.home=o.position.clone();entry.rig={};o.traverse(part=>{if(part.userData.rig)entry.rig[part.userData.rig]=part;});this.enhance(entry);if(entry.marker)entry.marker.visible=false;}}
 enhance(c){
  if(c.group.userData.enhanced)return;
  const {body,head}=c.rig;if(!body||!head)return;c.group.userData.enhanced=true;
  const p=c.profile,trim=0x32659c,skin=p.id==='ryazansky'?0xd3b49a:0xd4b39d;
  // Smooth the large facial and hair surfaces while retaining their authored shape.
  head.traverse(mesh=>{const params=mesh.geometry?.parameters;if(!mesh.isMesh||mesh.geometry.type!=='SphereGeometry'||!(params.radius>.09))return;const key='portrait:'+JSON.stringify(params);if(!this.geometries.has(key))this.geometries.set(key,new THREE.SphereGeometry(params.radius,24,18,params.phiStart,params.phiLength,params.thetaStart,params.thetaLength));mesh.geometry=this.geometries.get(key);const materialKey='portrait:'+mesh.material.uuid;if(!this.materials.has(materialKey)){const material=mesh.material.clone();material.flatShading=false;this.materials.set(materialKey,material);}mesh.material=this.materials.get(materialKey);});
  // Preserve the original rigs; recolor the authored suit surfaces only.
  body.traverse(o=>{if(o.isMesh&&o.material?.color?.getHex()===p.suit){const key='pearl-suit:'+o.material.uuid;if(!this.materials.has(key)){const m=o.material.clone();m.color.set(0xdce3e6);m.metalness=.12;m.roughness=.7;this.materials.set(key,m);}o.material=this.materials.get(key);}});
  // Uniform construction: quilted shoulder panels, rank bars, zip teeth,
  // belt fasteners, articulated knee pads and a life-support backpack.
  for(const side of [-1,1]){
   this.piece(body,'box',0x263745,[side*.267,1.29,.01],[.095,.2,.29]);
   this.piece(body,'box',trim,[side*.27,1.39,-.005],[.11,.023,.28]);
   for(let i=0;i<4;i++)this.piece(body,'box',0x8197a1,[side*.245,1.225+i*.035,-.155],[.05,.008,.018]);
   this.piece(body,'box',0x1a2a36,[side*.16,.83,-.18],[.075,.08,.07]);
   this.piece(body,'box',0x94aab3,[side*.16,.83,-.224],[.045,.05,.012]);
  }
  for(let i=0;i<10;i++)this.piece(body,'box',0xc6ced0,[0,.91+i*.035,-.243],[.027,.009,.012]);
  this.piece(body,'box',0x263a48,[0,1.12,.235],[.37,.46,.17]);
  this.piece(body,'box',0x82949d,[0,1.13,.33],[.26,.32,.035]);
  for(const x of [-.1,.1])this.piece(body,'cylinder',0x435b66,[x,1.14,.35],[.055,.36,.055]);
  const badge=this.piece(body,'box',trim,[-.15,1.34,-.26],[.095,.12,.02]);badge.rotation.z=-.04;
  for(let i=0;i<3;i++)this.piece(body,'box',0xd9e3e3,[-.15,1.365-i*.026,-.275],[.06,.008,.012]);
  // Face details remain geometry, so they also work offline in the Canvas renderer.
  this.piece(head,'sphere',0xb68f7e,[0,-.12,-.19],[.052,.012,.016]);
  this.piece(head,'sphere',skin,[0,-.16,-.14],[.073,.034,.045]);
  for(const side of [-1,1]){
   this.piece(head,'sphere',0xb28d7c,[side*.212,-.015,-.004],[.017,.037,.025]);
   this.piece(head,'box',0x927463,[side*.078,.01,-.211],[.07,.008,.009]);
   this.piece(head,'sphere',0xe7d1ba,[side*.09,-.043,-.183],[.057,.018,.014]);
  }
  // Reparent each arm to its shoulder; rotations now bend the actual joint.
  for(let i=0;i<2;i++){
   const arm=c.rig['arm'+i];if(!arm)continue;const side=i?1:-1;
   const pivot=new THREE.Vector3(side*.32,1.32,0);
   arm.position.copy(pivot);for(const child of arm.children)child.position.sub(pivot);
   this.piece(arm,'sphere',0x2e4350,[side*.07,-.23,-.12],[.088,.07,.08]);
   const hand=p.id==='savinykh'?[side*.43,1.12,-.59]:[side*.19,1.12,-.36];
   for(let f=0;f<4;f++)this.piece(arm,'cylinder',skin,[hand[0]-pivot.x-.038+f*.024,hand[1]-pivot.y-.035,hand[2]-.025],[.012,.068,.012]);
   this.piece(arm,'sphere',skin,[hand[0]-pivot.x+side*.064,hand[1]-pivot.y,hand[2]+.008],[.023,.043,.023]);
   if(i===0){this.piece(arm,'box',0x202d36,[-.065,-.2,-.16],[.12,.065,.11]);this.piece(arm,'box',0x8ed2cd,[-.065,-.16,-.165],[.073,.012,.07]);}
  }
  for(const side of [-1,1]){
   const leg=new THREE.Group();leg.position.set(side*.155,.79,0);body.add(leg);leg.userData.rig=side<0?'leg0':'leg1';c.rig[leg.userData.rig]=leg;
   const pieces=body.children.filter(o=>o!==leg&&o.isMesh&&Math.abs(o.position.x-side*.155)<.012&&o.position.y<.78);
   for(const o of pieces){body.remove(o);o.position.sub(leg.position);leg.add(o);}
   this.piece(leg,'box',0x2d414d,[0,-.29,-.115],[.17,.17,.05]);
   this.piece(leg,'box',trim,[0,-.29,-.146],[.12,.035,.013]);
   for(let j=0;j<3;j++)this.piece(leg,'box',0x82939b,[0,-.645+j*.025,-.2],[.17,.009,.012]);
  }
  c.group.traverse(o=>o.userData.agentID=p.id);
 }
 unregister(root){root.traverse(o=>{const entry=this.characters.find(x=>x.profile.id===o.userData.npcRoot);if(entry){entry.group=new THREE.Group();entry.group.position.set(...entry.profile.position);entry.loaded=false;entry.rig={};if(entry.marker)entry.marker.visible=true;}});}
 setBehaviors(agents=[]){for(const c of this.characters)c.behavior=agents.find(a=>a.id===c.profile.id)?.behavior||'helpful';}
 setTalking(id){this.talking=id;clearTimeout(this.timer);this.timer=setTimeout(()=>this.talking=null,10000);}
 pick(event,canvas,camera){const r=canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);return this.ray.intersectObjects(this.characters.flatMap(x=>[x.group,...(x.marker?[x.marker]:[])]),true)[0]?.object.userData.agentID||null;}
 nearest(position){let best=null,distance=3;for(const c of this.characters){const d=Math.hypot(c.group.position.x-position.x,c.group.position.z-position.z);if(d<distance){distance=d;best=c.profile.id;}}return best;}
 animate(t,player,reducedMotion=false){
  for(let i=0;i<this.characters.length;i++){
   const c=this.characters[i];if(!c.loaded)continue;const rig=c.rig,passive=c.behavior==='passive',selected=this.talking===c.profile.id&&!passive,patrol=c.behavior==='patrol'&&!selected;
   if(c.home){c.group.position.copy(c.home);if(patrol&&!reducedMotion){c.group.position.x+=Math.sin(t*.45+i)*.8;c.group.position.z+=Math.cos(t*.45+i)*.55;c.group.rotation.y=Math.atan2(-Math.cos(t*.45+i),Math.sin(t*.45+i))-.25;}else c.group.rotation.y=c.baseRotation;}
   if(rig.body)rig.body.position.y=reducedMotion?0:Math.sin(t*1.4+i)*.009;
   if(rig.head){rig.head.rotation.x=reducedMotion?0:selected?Math.sin(t*3)*.07:Math.sin(t*.6+i)*.018;let yaw=reducedMotion?0:Math.sin(t*.35+i)*.08;if(player&&c.behavior==='guard')yaw=THREE.MathUtils.clamp(Math.atan2(c.group.position.x-player.x,c.group.position.z-player.z)-c.group.rotation.y,-.8,.8);rig.head.rotation.y=yaw;}
   if(rig.ring)rig.ring.material.opacity=selected&&!reducedMotion?.8+Math.sin(t*4)*.15:.4;
   for(let j=0;j<2;j++){const arm=rig['arm'+j],leg=rig['leg'+j],side=j?1:-1;if(arm){arm.rotation.x=reducedMotion||passive?0:patrol?side*Math.sin(t*4)*.26:selected?-.12+Math.sin(t*2+j)*.16:Math.sin(t*.9+j)*.018;arm.rotation.z=selected&&!reducedMotion?side*(.04+Math.sin(t*1.4)*.055):0;}if(leg)leg.rotation.x=patrol&&!reducedMotion?-side*Math.sin(t*4)*.22:0;}
   if(rig.wheel)rig.wheel.rotation.z=reducedMotion?0:Math.sin(t*.45)*.1;
  }
 }
 dispose(){clearTimeout(this.timer);for(const g of this.geometries.values())g.dispose();for(const m of this.materials.values())m.dispose();this.geometries.clear();this.materials.clear();}
}
