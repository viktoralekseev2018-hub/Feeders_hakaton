import * as THREE from 'three';
import {layout,walls,roomAt} from './DeckLayout.js';

// All geometry is real, reusable 3D. Static parts are batched by room/material;
// ceilings remain physical and are removed only in the tactical cutaway view.
export class ShipInterior {
 constructor(ship) {
  this.ship=ship;this.root=new THREE.Group();this.root.name='HORIZON 7 • LIGHT INTERIOR';ship.scene.add(this.root);
  this.materials=new Map();this.geometries=new Map();this.rooms=new Map();this.ceilings=[];this.textures=[];this.systems=[];
  this.boxGeo=new THREE.BoxGeometry(1,1,1);this.cylinderGeo=new THREE.CylinderGeometry(1,1,1,24);this.sphereGeo=new THREE.SphereGeometry(1,32,20);
  const shape=new THREE.Shape();shape.moveTo(-.46,-.46);shape.lineTo(.46,-.46);shape.lineTo(.46,.46);shape.lineTo(-.46,.46);shape.closePath();
  this.bevelGeo=new THREE.ExtrudeGeometry(shape,{depth:.92,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2,steps:1,curveSegments:1});this.bevelGeo.translate(0,0,-.46);this.bevelGeo.computeVertexNormals();
  for(const [id,color,roughness,metalness] of [['pearl',0xdde3e6,.48,.22],['white',0xf0f1ec,.62,.12],['floor',0x9caab2,.47,.42],['metal',0x718491,.32,.72],['dark',0x23313f,.62,.35],['rubber',0x111e29,.93,.02],['blue',0x23589c,.39,.4],['fabric',0x384d63,.96,0],['green',0x6d9b7e,.8,0],['warm',0xa58c68,.7,.1]]) this.materials.set(id,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  for(const [id,color] of [['light',0xd9efff],['cyan',0x4fb8ff],['amber',0xf3c58a],['mint',0x9de2c3]]) this.materials.set(id,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:id==='light'?1.1:.65,roughness:.4}));
  this.materials.set('reactor',this.mat('cyan').clone());this.materials.set('cooling',this.mat('cyan').clone());this.materials.set('plant',this.mat('green').clone());this.materials.set('grow',this.mat('light').clone());
  this.materials.set('glass',new THREE.MeshPhysicalMaterial({color:0xaccfea,transparent:true,opacity:.12,roughness:.08,metalness:.1,depthWrite:false}));
  for(const a of layout.areas){const g=new THREE.Group();g.name=a.name;this.root.add(g);this.rooms.set(a.id,g);this.shell(a,g);}
  if(!ship.renderer.isSoftware&&typeof document!=='undefined'){
   const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d'),grad=ctx.createLinearGradient(0,0,0,128);grad.addColorStop(0,'#c7d4e0');grad.addColorStop(.35,'#edf0ec');grad.addColorStop(.55,'#73808b');grad.addColorStop(1,'#263441');ctx.fillStyle=grad;ctx.fillRect(0,0,256,128);ctx.fillStyle='#ffffff';for(const x of [25,110,195])ctx.fillRect(x,25,35,5);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.mapping=THREE.EquirectangularReflectionMapping;const generator=new THREE.PMREMGenerator(ship.renderer);this.environment=generator.fromEquirectangular(tex);ship.scene.environment=this.environment.texture;generator.dispose();tex.dispose();
  }
  this.bridge();this.cryo();this.engineering();this.bio();this.habitat();this.research();this.cargo();this.corridor();this.space();
  for(const roof of this.ceilings)this.batch(roof);
  for(const group of this.rooms.values())this.batch(group);
  // One shadow caster follows the room, never the camera. No lamp shines through a wall.
  this.workLight=new THREE.SpotLight(0xe7f0ff,65,32,1.32,.7,1.4);this.workLight.castShadow=true;this.workLight.shadow.mapSize.set(1024,1024);this.workLight.shadow.bias=-.0002;this.workLight.shadow.normalBias=.03;this.workLight.shadow.camera.near=.1;this.workLight.shadow.camera.far=30;this.root.add(this.workLight,this.workLight.target);
 }
 mat(id){return typeof id==='string'?this.materials.get(id):id;}
 part(g,geo,mat,x,y,z,w,h,d,rotation){const m=new THREE.Mesh(geo,this.mat(mat));m.position.set(x,y,z);m.scale.set(w,h,d);if(rotation)m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 box(g,mat,x,y,z,w,h,d,rotation){return this.part(g,this.boxGeo,mat,x,y,z,w,h,d,rotation);}
 bevel(g,mat,x,y,z,w,h,d,rotation){return this.part(g,this.bevelGeo,mat,x,y,z,w,h,d,rotation);}
 cylinder(g,mat,x,y,z,r,h,rotation){return this.part(g,this.cylinderGeo,mat,x,y,z,r,h,r,rotation);}
 group(id,x=0,z=0,angle=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;(this.rooms.get(id)||this.root).add(g);return g;}
 label(g,text,x,y,z,w=.9,h=.22,rotation=0,dark=false){
  if(typeof document==='undefined')return;
  const key='text:'+text+':'+dark+':'+w/h;let mat=this.materials.get(key);
  if(!mat){const c=document.createElement('canvas');c.width=1024;c.height=Math.max(64,Math.round(1024*h/w));const ctx=c.getContext('2d');ctx.fillStyle=dark?'#132839':'#dbe3e6';ctx.fillRect(0,0,1024,c.height);ctx.fillStyle=dark?'#bde4fa':'#28465f';ctx.font='500 '+Math.round(c.height*.54)+'px sans-serif';ctx.textBaseline='middle';ctx.fillText(text,32,c.height/2,960);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);mat=new THREE.MeshStandardMaterial({map:t,roughness:.65,emissive:dark?0x7bbedc:0x000000,emissiveMap:dark?t:null,emissiveIntensity:.25});this.materials.set(key,mat);}
  const m=this.box(g,mat,x,y,z,w,h,.012);m.rotation.y=rotation;return m;
 }
 screen(g,x,y,z,w=1.7,h=.88,title='FLIGHT / NAVIGATION',angle=-.16){
  const frame=new THREE.Group();frame.position.set(x,y,z);frame.rotation.x=angle;g.add(frame);
  this.bevel(frame,'metal',0,0,0,w+.14,h+.14,.15);this.bevel(frame,'rubber',0,0,.084,w+.06,h+.06,.035);
  const key='screen:'+title;let mat=this.materials.get(key);
  if(!mat&&typeof document!=='undefined'){
   const c=document.createElement('canvas');c.width=768;c.height=384;const ctx=c.getContext('2d');ctx.fillStyle='#061828';ctx.fillRect(0,0,768,384);ctx.strokeStyle='#193d59';ctx.lineWidth=1;
   for(let i=20;i<768;i+=32){ctx.beginPath();ctx.moveTo(i,45);ctx.lineTo(i,365);ctx.stroke();}for(let i=45;i<384;i+=32){ctx.beginPath();ctx.moveTo(20,i);ctx.lineTo(748,i);ctx.stroke();}
   ctx.fillStyle='#a4dcf7';ctx.font='20px monospace';ctx.fillText(title,25,30);ctx.font='12px monospace';ctx.fillText('HORIZON–7    /    SYSTEM LINK ACTIVE',25,370);
   ctx.strokeStyle='#75bedf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(190,214);ctx.lineTo(310,180);ctx.lineTo(355,92);ctx.lineTo(385,180);ctx.lineTo(540,210);ctx.lineTo(392,227);ctx.lineTo(355,292);ctx.lineTo(320,228);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.ellipse(355,204,130,66,0,0,Math.PI*2);ctx.stroke();
   for(let i=0;i<8;i++){ctx.fillStyle=i%3?'#588ca7':'#a9dbf1';ctx.fillRect(605,75+i*28,95-(i*17)%60,5);ctx.fillRect(28,100+i*26,65-(i*7)%30,3);}ctx.strokeStyle='#add4e7';ctx.strokeRect(18,48,730,290);
   const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);mat=new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.5,roughness:.35});this.materials.set(key,mat);
  }
  this.box(frame,mat||'dark',0,0,.108,w,h,.012);for(const side of [-1,1])this.cylinder(frame,'metal',side*(w/2+.03),-h/2-.025,.1,.016,.02,[Math.PI/2,0,0]);return frame;
 }
 shell(a,g){
  this.box(g,'rubber',a.x,-.16,a.z,a.w,.32,a.d);
  // Broad calm floor panels, narrow recessed seams, peripheral service grilles.
  const nx=Math.ceil(a.w/2.2),nz=Math.ceil(a.d/2.2),tw=a.w/nx,td=a.d/nz;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)this.box(g,'floor',a.x-a.w/2+(i+.5)*tw,-.035,a.z-a.d/2+(j+.5)*td,tw-.012,.07,td-.012);
  const roof=new THREE.Group();roof.name='ceiling';g.add(roof);this.ceilings.push(roof);this.box(roof,'pearl',a.x,layout.height+.14,a.z,a.w+.28,.28,a.d+.28);
  for(const b of walls.filter(b=>b.area===a.id)){
   const window=a.id==='bridge'&&Math.abs(b.z+7)<.01&&b.x>0;
   if(window){this.box(g,'pearl',b.x,.62,b.z,b.w,1.24,.28);this.box(g,'pearl',b.x,3.58,b.z,b.w,.44,.28);for(const side of [-1,1])this.box(g,'pearl',b.x+side*(b.w/2-.2),2.3,b.z,.4,2.15,.28);this.window(g,b.x,2.3,b.z,b.w-.65,1.95);}
   else this.box(g,'pearl',b.x,1.9,b.z,b.w,3.8,b.d);
   const horizontal=b.w>b.d,len=horizontal?b.w:b.d;
   this.box(g,'dark',b.x,.12,b.z,horizontal?b.w:.32,.24,horizontal?.32:b.d);
   this.box(g,'metal',b.x,3.5,b.z,horizontal?b.w:.42,.18,horizontal?.42:b.d);
   if(!window&&len>1.5){const n=Math.ceil(len/2.7);for(let i=0;i<n;i++){
    const x=horizontal?b.x-len/2+(i+.5)*len/n:b.x,z=horizontal?b.z:b.z-len/2+(i+.5)*len/n;
    this.bevel(g,'white',x,1.88,z,horizontal?len/n-.055:.31,2.75,horizontal?.31:len/n-.055);
    this.box(g,'blue',x,.43,z,horizontal?len/n-.06:.325,.055,horizontal?.325:len/n-.06);
    for(const side of [-1,1])for(const y of [.64,3.05])this.box(g,'metal',horizontal?x+side*(len/n/2-.16):x,y,horizontal?z:z+side*(len/n/2-.16),horizontal?.045:.326,.045,horizontal?.326:.045);
    if(i%3===1)for(let j=0;j<5;j++)this.box(g,'dark',x,.8+j*.045,z,horizontal?.58:.326,.018,horizontal?.326:.58);
   }}
  }
  for(const gate of layout.gates.filter(p=>p.areas.includes(a.id)))this.box(g,'pearl',gate.x,3.3,gate.z,gate.rotation?2.6:.28,1,gate.rotation?.28:2.6);
  for(const side of [-1,1]){
   this.box(roof,'dark',a.x+side*Math.max(.4,a.w/2-.8),3.72,a.z,.3,.12,Math.max(.4,a.d-.7));
   this.box(roof,'light',a.x+side*Math.max(.4,a.w/2-.8),3.64,a.z,.12,.045,Math.max(.3,a.d-1));
  }
  if(a.kind!=='corridor')for(let z=a.z-a.d/2+1;z<a.z+a.d/2;z+=3){this.bevel(roof,'metal',a.x,3.55,z,a.w-.35,.12,.2);for(const side of [-1,1])this.bevel(roof,'pearl',a.x+side*(a.w/2-.34),3.3,z,.2,.95,.23,[0,0,side*Math.PI/4]);}
 }
 window(g,x,y,z,w,h){
  const key=`window:${w}:${h}`;
  if(!this.geometries.has(key)){
   const outline=(path,width,height,r)=>{path.moveTo(-width/2+r,-height/2);path.lineTo(width/2-r,-height/2);path.quadraticCurveTo(width/2,-height/2,width/2,-height/2+r);path.lineTo(width/2,height/2-r);path.quadraticCurveTo(width/2,height/2,width/2-r,height/2);path.lineTo(-width/2+r,height/2);path.quadraticCurveTo(-width/2,height/2,-width/2,height/2-r);path.lineTo(-width/2,-height/2+r);path.quadraticCurveTo(-width/2,-height/2,-width/2+r,-height/2);};
   const shape=new THREE.Shape();outline(shape,w+.65,h+.6,.38);const hole=new THREE.Path();outline(hole,w,h,.22);shape.holes.push(hole);
   const geometry=new THREE.ExtrudeGeometry(shape,{depth:.54,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:10});geometry.translate(0,0,-.27);this.geometries.set(key,geometry);
  }
  this.part(g,this.geometries.get(key),'pearl',x,y,z,1,1,1);
  for(const side of [-1,1]){
   this.box(g,'rubber',x+side*(w/2-.015),y,z+.02,.055,h-.4,.42);
   this.box(g,'rubber',x,y+side*(h/2-.015),z+.02,w-.4,.055,.42);
   for(const sy of [-1,1])this.cylinder(g,'metal',x+side*(w/2+.12),y+sy*(h/2+.1),z+.3,.038,.025,[Math.PI/2,0,0]);
  }
  this.box(g,'glass',x,y,z,w,h,.05);
  this.box(g,'cyan',x,y-h/2-.16,z+.33,w-.2,.025,.035);
 }
 console(g,x,z,title,angle=0){const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=angle;g.add(c);
  for(const side of [-1,1]){this.bevel(c,'metal',side*.99,.55,0,.23,1.1,.8);this.bevel(c,'dark',side*.99,.07,.05,.7,.14,1.2);}
  this.bevel(c,'pearl',0,1.12,0,3,.38,1.25);this.bevel(c,'dark',0,1.34,.13,2.8,.09,.9,[-.13,0,0]);
  this.screen(c,0,1.95,-.3,1.65,.86,title);this.screen(c,-1.12,1.89,-.23,.44,.75,'SYS');this.screen(c,1.12,1.89,-.23,.44,.75,'LINK');
  for(let i=0;i<11;i++)for(let j=0;j<3;j++)this.box(c,i%4?'metal':'blue',-.7+i*.13,1.4,.12+j*.12,.09,.035,.07);
  for(const x of [-1.15,1.15]){this.cylinder(c,'metal',x,1.42,.4,.075,.1);this.cylinder(c,'rubber',x,1.49,.4,.05,.075);}
  for(let i=0;i<10;i++)this.box(c,'rubber',-.7+i*.16,.96,.637,.09,.07,.015);
  this.box(c,'blue',0,.85,-.64,2.8,.065,.02);this.label(c,'FLIGHT SYSTEMS / 07',0,1.11,.65,.85,.12);
 }
 chair(g,x,z,angle=0){const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=angle;g.add(c);
  this.cylinder(c,'metal',0,.08,0,.46,.16);this.cylinder(c,'dark',0,.38,0,.13,.56);this.cylinder(c,'metal',0,.43,0,.18,.16);
  this.bevel(c,'pearl',0,.68,0,.86,.18,.86);this.bevel(c,'fabric',0,.8,-.04,.72,.16,.71);
  this.bevel(c,'pearl',0,1.26,.32,.84,1.15,.18,[-.1,0,0]);this.bevel(c,'fabric',0,1.3,.2,.69,.95,.17,[-.1,0,0]);this.bevel(c,'fabric',0,1.85,.26,.51,.27,.22);
  for(const s of [-1,1]){this.box(c,'metal',s*.46,.99,.1,.07,.5,.12);this.bevel(c,'dark',s*.45,1.21,-.05,.18,.13,.62);this.box(c,'blue',s*.433,1.5,.36,.06,.35,.03);}
  this.box(c,'metal',0,1.2,.44,.18,.8,.04);
 }
 locker(g,x,z,w=2.7,angle=0){const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=angle;g.add(c);this.bevel(c,'metal',0,1.3,0,w,2.6,.75);
  for(let i=0;i<3;i++){const xx=(i-1)*w/3;this.bevel(c,'white',xx,1.32,.4,w/3-.045,2.45,.07);this.box(c,'blue',xx,2.25,.445,w/3-.06,.08,.015);this.bevel(c,'rubber',xx+w/8,1.27,.46,.065,.28,.06);for(let j=0;j<4;j++)this.box(c,'dark',xx,.37+j*.05,.445,w/4,.012,.015);this.label(c,'0'+(i+1),xx,1.95,.45,.22,.12);}
 }
 crate(g,x,z,w=2.3,d=1.8,y=0){const c=new THREE.Group();c.position.set(x,y,z);g.add(c);this.bevel(c,'pearl',0,.63,0,w,1.2,d);this.bevel(c,'dark',0,1.24,0,w+.025,.08,d+.025);this.bevel(c,'white',0,1.32,0,w+.03,.12,d+.03);
  for(const sx of [-1,1])for(const sz of [-1,1]){this.bevel(c,'metal',sx*(w/2-.09),.67,sz*(d/2-.08),.17,1.35,.18);this.box(c,'dark',sx*w/2,.12,sz*(d/2-.14),.035,.15,.3);}
  for(const side of [-1,1]){for(const xx of [-w*.3,w*.3]){this.bevel(c,'rubber',xx,1.04,side*(d/2+.025),.17,.35,.07);this.bevel(c,'metal',xx,1.08,side*(d/2+.07),.1,.17,.05);}this.box(c,'blue',0,.37,side*(d/2+.02),w-.3,.065,.025);this.bevel(c,'dark',0,.8,side*(d/2+.04),.55,.17,.07);this.box(c,'metal',0,.8,side*(d/2+.085),.4,.05,.035);}
  this.label(c,'H7 / LOGISTICS',0,.56,d/2+.04,.75,.15);return c;
 }
 bridge(){const g=this.rooms.get('bridge');for(const [i,x]of [-5,0,5].entries()){this.console(g,x,-4.8,['ARCHIVE / COMMS','ORBIT / FLIGHT','TRAJECTORY / CONTROL'][i]);this.chair(g,x,-2.9);}
  this.bevel(g,'metal',0,.55,1.5,1.7,1.1,1);this.bevel(g,'pearl',0,1.12,1.5,3.2,.24,1.6);this.screen(g,0,1.26,1.5,2.6,1.15,'HORIZON / MISSION',-Math.PI/2);
  this.label(g,'ГОРИЗОНТ–7   /   МОСТИК',-4.5,2.9,-6.81,5,.45);
  this.label(g,'02',7.81,2.8,3,1,.7,-Math.PI/2);
 }
 cryo(){const g=this.rooms.get('cryo');for(let i=0;i<3;i++){const z=-3+i*3;this.bevel(g,'metal',-20,.3,z,2.5,.6,1.7);this.bevel(g,'white',-20,.76,z,2.4,.45,1.5);this.bevel(g,'fabric',-20,1.03,z,1.9,.14,1.2);this.bevel(g,'white',-20.7,1.15,z,.45,.23,1.1);for(const s of [-1,1]){this.bevel(g,'pearl',-20,1.3,z+s*.76,2.4,.2,.1);this.box(g,'mint',-20,1.42,z+s*.76,2.1,.025,.06);}this.screen(g,-20,1.6,z-.71,.55,.32,'VITALS');}this.locker(g,-12,-4.6);this.label(g,'01 / CRYO • MEDICAL',-16,2.8,-5.81,5,.4);}
 engineering(){const g=this.rooms.get('reactor');this.cylinder(g,'dark',17,.16,0,2.1,.32);this.cylinder(g,'metal',17,1.6,0,1.45,2.9);this.cylinder(g,'dark',17,1.7,0,1.12,2.9);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;this.cylinder(g,'metal',17+Math.sin(a)*1.5,1.75,Math.cos(a)*1.5,.11,3.2);this.box(g,'reactor',17+Math.sin(a)*1.13,1.6,Math.cos(a)*1.13,.12,2.1,.12);}
  for(const y of [.35,.65,2.8,3.15])this.cylinder(g,'pearl',17,y,0,1.67,.18);
  this.screen(g,17,1.65,1.58,1.2,.62,'REACTOR / COOLANT',0);
  for(let i=0;i<3;i++){this.cylinder(g,'metal',21.5,1.4,-4+i,.32,2.8);this.cylinder(g,'cooling',21.5,1.4,-4+i,.335,.16);}
  this.label(g,'03 / ENGINEERING',17,2.9,-5.81,5,.4);this.label(g,'THERMAL CONTROL',21.5,2.7,-2.5,1.5,.2);
 }
 bio(){const g=this.rooms.get('bio');for(const x of [-20,-16,-12]){this.bevel(g,'white',x,.55,-18,1.6,1.1,5);this.box(g,'rubber',x,1.12,-18,1.45,.12,4.8);for(let j=0;j<8;j++){const z=-20.1+j*.6;this.cylinder(g,'green',x,1.4,z,.04,.65);for(let i=0;i<4;i++)this.part(g,this.sphereGeo,'plant',x+Math.cos(i*2.4)*.28,1.5+i*.12,z+Math.sin(i*2.4)*.2,.4,.07,.18,[0,i*2.4,.4]);}for(const s of [-1,1])this.box(g,'metal',x+s*.75,2,-18,.05,2,4.8);this.box(g,'grow',x,2.8,-18,1.1,.07,4.7);}
 this.label(g,'04 / BIO • LIFE SUPPORT',-16,2.9,-22.81,5,.4);}
 habitat(){const g=this.rooms.get('habitat');for(const z of [14,18])for(const y of [.52,1.9]){this.bevel(g,'pearl',-20,y,z,2.7,.24,2);this.bevel(g,'fabric',-20,y+.22,z,2.5,.2,1.7);this.bevel(g,'white',-20.9,y+.38,z,.5,.18,1.5);this.box(g,'blue',-20,y-.12,z+1,.9,.055,.03);this.box(g,'light',-21.2,y+.7,z,.055,.06,1.3);}for(const z of [13,15,17,19])this.box(g,'metal',-21.3,1.5,z,.08,3,.08);
 this.locker(g,-10,13,2.5,Math.PI/2);this.bevel(g,'pearl',-10,.4,18,2.8,.8,1);this.bevel(g,'fabric',-10,.88,18,2.6,.18,.9);this.bevel(g,'fabric',-10,1.15,18.46,2.6,.65,.18);this.label(g,'05 / CREW QUARTERS',-15,2.9,20.81,5,.4,Math.PI);
 }
 research(){const g=this.rooms.get('research');this.bevel(g,'metal',-5,.45,17,1.3,.9,2.6);this.bevel(g,'white',-5,1,17,2.2,.25,3);this.bevel(g,'fabric',-5,1.2,17,1.7,.15,2.6);this.bevel(g,'white',-5,1.35,18,.8,.2,.5);this.screen(g,-5,1.8,15.65,.95,.6,'SCAN / ANALYSIS');this.locker(g,5,13,3);
 this.console(g,4,18,'RESEARCH / SPECTRUM',Math.PI);this.label(g,'06 / RESEARCH LAB',0,2.9,20.81,5,.4,Math.PI);}
 cargo(){const g=this.rooms.get('cargo');for(const [x,z]of [[11,14],[11,18],[20,14],[20,18]]){this.crate(g,x,z);for(const side of [-1,1])this.box(g,'blue',x+side*.7,1.43,z,.09,.035,1.85);if(z===18)this.crate(g,x,z,2.1,1.65,1.43);}
  for(const z of [12.5,19.5]){this.box(g,'metal',15.5,3.3,z,13,.16,.18);this.box(g,'amber',15.5,3.19,z,12,.035,.035);}this.label(g,'07 / CARGO • SECURE LOAD',15.5,2.9,20.81,6,.4,Math.PI);
 }
 corridor(){const g=this.rooms.get('corridor');for(let x=-20;x<23;x+=3){this.box(g,'dark',x,.008,9,.07,.015,3.5);for(const z of [7.65,10.35]){this.box(g,'blue',x, .012,z,2.7,.02,.11);this.box(g,'light',x,.018,z,1,.025,.035);}}
 for(const x of [-9,8]){this.label(g,'← КРИО   /   МОСТИК ↑   /   РЕАКТОР →',x,2.5,7.18,6,.36);this.label(g,'ЖИЛОЙ ←   /   ЛАБОРАТОРИЯ   /   ГРУЗ →',x,2.5,10.82,6,.36,Math.PI);}
 }
 space(){
  this.ship.scene.background=new THREE.Color(0x071323);
  const planet=new THREE.Mesh(new THREE.SphereGeometry(42,64,48),new THREE.MeshBasicMaterial({color:0x769fbe}));planet.position.set(22,-18,-86);planet.rotation.set(.2,.2,-.3);
  if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d'),img=ctx.createImageData(1024,512);for(let y=0;y<512;y++)for(let x=0;x<1024;x++){const u=x/1024*Math.PI*2,v=y/512*Math.PI;const sx=Math.sin(v)*Math.cos(u),sy=Math.cos(v),sz=Math.sin(v)*Math.sin(u);const n=Math.sin(sx*8+Math.cos(sz*6))*Math.cos(sy*9+Math.sin(sx*4))+.32*Math.sin(sz*25+sy*19)+.12*Math.cos(sx*71-sy*56);const cloud=Math.sin(u*12+v*25+Math.sin(u*6+v*8)*2)+.4*Math.sin(u*48-v*37)+.17*Math.sin(u*124+v*136);const land=Math.max(0,Math.min(1,(n-.18)*5)),snow=Math.max(0,(Math.abs(sy)-.88)*8);let col=[22+land*72,69+land*43,119-land*34];const cover=Math.max(snow,Math.min(.95,Math.max(0,(cloud-.32)*.8)));col=col.map((c,i)=>c*(1-cover)+[224,235,239][i]*cover);const shade=.65+.35*Math.sin(v);const k=(y*1024+x)*4;for(let j=0;j<3;j++)img.data[k+j]=col[j]*shade;img.data[k+3]=255;}ctx.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);planet.material.map=t;planet.material.color.set(0xffffff);}
  this.spaceGroup=new THREE.Group();this.spaceGroup.add(planet);this.root.add(this.spaceGroup);this.planet=planet;
  const haze=new THREE.Mesh(new THREE.SphereGeometry(42.5,48,32),new THREE.MeshBasicMaterial({color:0x75bfff,transparent:true,opacity:.085,side:THREE.BackSide}));haze.position.copy(planet.position);this.spaceGroup.add(haze);
  const positions=[];let seed=5;for(let i=0;i<1000;i++){seed=(seed*1664525+1013904223)>>>0;const x=(seed/4294967296-.5)*400;seed=(seed*1664525+1013904223)>>>0;const y=(seed/4294967296-.5)*220;positions.push(x,y,-160);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.spaceGroup.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xd9eafa,size:.18})));
 }
 batch(group){
  if(this.ship.renderer.isSoftware)return;
  group.updateMatrixWorld(true);const batches=new Map(),inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
  group.traverse(o=>{if(!o.isMesh||o.material.transparent||o.material.map)return;let p=o.parent,roof=false;while(p&&p!==group){if(p.name==='ceiling')roof=true;p=p.parent;}if(roof)return;const key=o.geometry.uuid+o.material.uuid;const list=batches.get(key)||[];list.push(o);batches.set(key,list);});
  for(const list of batches.values()){if(list.length<3)continue;const mesh=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.castShadow=true;mesh.receiveShadow=true;for(const [i,o]of list.entries()){mesh.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));o.parent.remove(o);}mesh.computeBoundingSphere();group.add(mesh);}
 }
 update(mode,position){const area=roomAt(position.x,position.z);
  const visible=new Set(mode==='overview'?layout.areas.map(a=>a.id):[area?.id]);
  if(mode!=='overview'){let changed=true;while(changed){changed=false;for(const g of layout.gates){const door=this.ship.livingWorld?.objects.get(g.id);if(g.door&&(!door||door.progress<.02))continue;if(g.areas.some(id=>visible.has(id)))for(const id of g.areas)if(!visible.has(id)){visible.add(id);changed=true;}}}}
  this.visibleRooms=visible;for(const [id,g]of this.rooms)g.visible=visible.has(id);
  for(const roof of this.ceilings)roof.visible=mode!=='overview';
  if(area&&this.litRoom!==area.id){this.litRoom=area.id;this.workLight.position.set(area.x,3.4,area.z);this.workLight.target.position.set(area.x,0,area.z);this.workLight.intensity=area.kind==='corridor'?30:75;}
  this.workLight.visible=mode==='explore';if(this.ship.sunLight)this.ship.sunLight.visible=mode==='overview';
 }
 updateState(s){const reactor=this.mat('reactor'),cooling=this.mat('cooling');reactor.emissiveIntensity=s.reactor_active?.85:.16;reactor.color.set(s.cooling_repaired?0x8fcbdc:0xc9a47c);reactor.emissive.copy(reactor.color);cooling.color.set(s.cooling_repaired?0x7fc6cc:0xd8b076);cooling.emissive.copy(cooling.color);this.mat('plant').color.set(s.greenhouse_active?0x6d9b7e:0x71856a);this.mat('grow').emissiveIntensity=s.greenhouse_active?1:.18;}
 dispose(){this.ship.scene.remove(this.root);for(const m of this.materials.values())m.dispose();for(const t of this.textures)t.dispose();for(const g of [this.boxGeo,this.bevelGeo,this.cylinderGeo,this.sphereGeo,...this.geometries.values()])g.dispose();this.workLight.dispose();this.environment?.dispose();}
}
