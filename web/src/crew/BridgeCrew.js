import * as THREE from 'three';
export const CREW=[
{id:'savinykh',name:'Виктор Петрович Савиных',short:'Виктор Савиных',role:'Капитан · у штурвала',initials:'ВС',color:0xe6c799,position:[4.2,0,-3],hair:0xbec4c0,suit:0x33475e,height:1.02},
{id:'dzhanibekov',name:'Владимир Александрович Джанибеков',short:'Владимир Джанибеков',role:'Инженер · реактор',initials:'ВД',color:0xe5a779,position:[13,0,2],hair:0x645e59,suit:0x5d5b54,height:1.04},
{id:'ryazansky',name:'Сергей Николаевич Рязанский',short:'Сергей Рязанский',role:'Биолог · оранжерея',initials:'СР',color:0x94cba7,position:[-4,0,-16],hair:0x635b51,suit:0x3f665d,height:1.08},
{id:'krikalev',name:'Сергей Константинович Крикалёв',short:'Сергей Крикалёв',role:'Связь и навигация · мостик',initials:'СК',color:0xa5bfe8,position:[-5,0,-3],hair:0x3e4348,suit:0x49546b,height:1.03}];
export class BridgeCrew{
 constructor(scene){this.scene=scene;this.ray=new THREE.Raycaster();this.characters=CREW.map(profile=>{const group=new THREE.Group();group.position.set(...profile.position);return{profile,group,loaded:false,marker:null};});}
 register(root){root.traverse(o=>{const id=o.userData.npcRoot;if(!id)return;const entry=this.characters.find(x=>x.profile.id===id);if(entry){entry.group=o;entry.loaded=true;if(entry.marker)entry.marker.visible=false;}});}
 unregister(root){root.traverse(o=>{const id=o.userData.npcRoot;const entry=this.characters.find(x=>x.profile.id===id);if(entry){entry.group=new THREE.Group();entry.group.position.set(...entry.profile.position);entry.loaded=false;if(entry.marker)entry.marker.visible=true;}});}
 setTalking(id){this.talking=id;clearTimeout(this.timer);this.timer=setTimeout(()=>this.talking=null,10000);}
 pick(event,canvas,camera){const r=canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);return this.ray.intersectObjects(this.characters.flatMap(x=>[x.group,...(x.marker?[x.marker]:[])]),true)[0]?.object.userData.agentID||null;}
 nearest(position){let best=null,distance=3;for(const p of CREW){const d=Math.hypot(p.position[0]-position.x,p.position[2]-position.z);if(d<distance){distance=d;best=p.id;}}return best;}
 animate(t){for(let i=0;i<this.characters.length;i++){const c=this.characters[i];if(!c.loaded)continue;const selected=this.talking===c.profile.id;c.group.traverse(o=>{if(o.userData.rig==='body')o.position.y=Math.sin(t*1.4+i)*.008;if(o.userData.rig==='head'){o.rotation.y=Math.sin(t*.35+i)*.035;o.rotation.x=selected?Math.sin(t*3)*.04:Math.sin(t*.6+i)*.018;}if(o.userData.rig==='ring')o.material.opacity=selected?.8+Math.sin(t*4)*.15:.4;if(o.userData.rig==='arm1'&&c.profile.id!=='savinykh')o.rotation.x=selected?Math.sin(t*2)*.018:0;if(o.userData.rig==='wheel')o.rotation.z=Math.sin(t*.35)*.035;});}}
}
