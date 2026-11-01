import * as THREE from 'three';

// Accessible fallback for devices where WebGL is unavailable. It projects the
// same scene geometry; it never replaces the multiplayer state or 3D controls.
export class SoftwareRenderer {
 constructor(canvas){this.domElement=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Canvas renderer unavailable');this.ratio=1;this.last=0;this.textureCanvases=new WeakMap();this.isSoftware=true;this.info={render:{triangles:0,calls:0},memory:{}};}
 setPixelRatio(){this.ratio=1;}
 setSize(w,h){this.width=Math.round(w);this.height=Math.round(h);this.domElement.width=this.width;this.domElement.height=this.height;}
 render(scene,camera){
  const now=performance.now();if(now-this.last<85||!this.width||!this.height)return;this.last=now;
  scene.updateMatrixWorld();camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);const w=this.width,h=this.height,ctx=this.ctx;ctx.clearRect(0,0,w,h);
  const faces=[],sprites=[],light=new THREE.Vector3(.3,.85,.5).normalize();const normalMatrix=new THREE.Matrix3();let calls=0;
  scene.traverseVisible(object=>{
   if(object.isSprite){sprites.push(object);return;}if(!object.isMesh||object.isSkinnedMesh)return;
   const geometry=object.geometry,position=geometry.attributes.position;if(!position)return;const mat=Array.isArray(object.material)?object.material[0]:object.material;if(!mat||mat.opacity===0)return;
   const projection=new THREE.Matrix4().multiplyMatrices(matrix,object.matrixWorld);const vertices=[];for(let i=0;i<position.count;i++){const v=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(projection);vertices.push(v);}
   normalMatrix.getNormalMatrix(object.matrixWorld);const normals=geometry.attributes.normal;const index=geometry.index;const count=index?index.count:position.count;const base=(mat.color||new THREE.Color(0x90a5ad)).clone();let colorKey='';
   for(let i=0;i<count;i+=3){const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;const a=vertices[ia],b=vertices[ib],c=vertices[ic];if(a.z< -1||b.z< -1||c.z< -1||a.z>1||b.z>1||c.z>1)continue;
    const ax=(a.x+1)*w/2,ay=(1-a.y)*h/2,bx=(b.x+1)*w/2,by=(1-b.y)*h/2,cx=(c.x+1)*w/2,cy=(1-c.y)*h/2;if(Math.max(ax,bx,cx)<0||Math.min(ax,bx,cx)>w||Math.max(ay,by,cy)<0||Math.min(ay,by,cy)>h)continue;
    const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(area>=0&&mat.side!==THREE.DoubleSide)continue;if(Math.abs(area)<.14)continue;
    const normal=normals?new THREE.Vector3().fromBufferAttribute(normals,ia).applyMatrix3(normalMatrix).normalize():light;const shade=mat.isMeshBasicMaterial?1:.62+.45*Math.max(0,normal.dot(light));const color=base.clone().multiplyScalar(shade);if(mat.emissive)color.add(mat.emissive.clone().multiplyScalar(Math.min(.4,(mat.emissiveIntensity||0)*.25)));color.convertLinearToSRGB();colorKey='#'+color.getHexString();faces.push({layer:object.matrixWorld.elements[13]<-.1?0:1,a:[ax,ay],b:[bx,by],c:[cx,cy],z:(a.z+b.z+c.z)/3,color:colorKey,alpha:mat.transparent?mat.opacity:1});
   }calls++;
  });
  faces.sort((a,b)=>a.layer-b.layer||b.z-a.z);ctx.lineWidth=.4;for(const f of faces){ctx.globalAlpha=f.alpha;ctx.fillStyle=f.color;ctx.strokeStyle=f.color;ctx.beginPath();ctx.moveTo(...f.a);ctx.lineTo(...f.b);ctx.lineTo(...f.c);ctx.closePath();ctx.fill();ctx.stroke();}ctx.globalAlpha=1;
  for(const sprite of sprites){let image=sprite.material.map?.image;if(!image)continue;if(image.data&&!image.getContext){let canvas=this.textureCanvases.get(image);if(!canvas){canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);this.textureCanvases.set(image,canvas);}image=canvas;}const pos=new THREE.Vector3();sprite.getWorldPosition(pos);const distance=pos.distanceTo(camera.position);const projected=pos.clone().applyMatrix4(matrix);if(projected.z< -1||projected.z>1)continue;const scale=new THREE.Vector3();sprite.getWorldScale(scale);const px=h/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))/Math.max(distance,1);if(scale.x*px<94){const factor=94/(scale.x*px);scale.multiplyScalar(factor);}ctx.globalAlpha=sprite.material.opacity;ctx.drawImage(image,(projected.x+1)*w/2-scale.x*px/2,(1-projected.y)*h/2-scale.y*px/2,scale.x*px,scale.y*px);}ctx.globalAlpha=1;this.info.render={triangles:faces.length,calls};
 }
}
