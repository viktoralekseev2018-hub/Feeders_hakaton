import * as THREE from 'three';
import {layout,doorProgress,doorBlocks,walkable,roomAt} from '../interior/DeckLayout.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const unit = new THREE.Vector3(1, 1, 1);
const roomCenters = [[-16, 0], [0, 0], [17, 0], [-16, -17]];

// The server owns objects/settings. Crowd motion is a cheap, deterministic visual
// simulation: these residents never call an agent or modify mission resources.
export class LivingWorld {
  constructor(ship) {
    this.ship = ship;
    this.root = new THREE.Group();
    this.root.name = 'Живая палуба';
    ship.scene.add(this.root);
    this.objects = new Map();
    this.materials = new Map();
    this.geometries = new Map();
    this.npcs = [];
    this.parts = [];
    this.state = null;
    this.time = 0;
    this.speechUntil = 0;
    this.speechPosition = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
    this.matrix = new THREE.Matrix4();
    this.localMatrix = new THREE.Matrix4();
    this.rotation = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.scale = new THREE.Vector3();
    this.partPosition = new THREE.Vector3();
    this.npcPosition = new THREE.Vector3();
  }

  material(color, emissive = false) {
    const key = `${color}:${emissive}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({
      color, roughness: .63, metalness: .24,
      ...(emissive ? {emissive: color, emissiveIntensity: .7} : {})
    }));
    return this.materials.get(key);
  }

  geometry(kind) {
    if (!this.geometries.has(kind)) {
      const geo = kind === 'sphere' ? new THREE.SphereGeometry(1, 10, 8)
        : kind === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 1, 10)
        : kind === 'ring' ? new THREE.TorusGeometry(1, .06, 5, 24)
        : new THREE.BoxGeometry(1, 1, 1);
      this.geometries.set(kind, geo);
    }
    return this.geometries.get(kind);
  }

  piece(parent, kind, color, position, scale, emissive = false) {
    const mesh = new THREE.Mesh(this.geometry(kind), this.material(color, emissive));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
    return mesh;
  }

  setState(state, selfId) {
    this.selfId = selfId || this.selfId;
    this.state = state;
    this.speed = clamp(Number(state?.settings?.simulation_speed ?? 1), 0, 3);
    const count = clamp(Math.round(Number(state?.settings?.npc_count ?? 0)), 0, 160);
    if (count !== this.npcs.length) this.buildCrowd(count);
    const present = new Set();
    for (const data of state?.objects || []) {
      present.add(data.id);
      let object = this.objects.get(data.id);
      if (object && object.data.kind !== data.kind) {
        this.root.remove(object.group);
        this.objects.delete(data.id);
        object = null;
      }
      if (!object) {
        object = this.makeObject(data);
        this.objects.set(data.id, object);
        this.root.add(object.group);
      }
      if (object.data?.held_by && !data.held_by) object.dropTime = this.time;
      object.data = {...data};
      if(data.kind==='door')object.progress=doorProgress(data,Date.now()+(this.ship.serverOffset||0));
      object.target.set(data.x, data.y || 0, data.z);
      object.group.rotation.y = data.rotation || 0;
    }
    for (const [id, object] of this.objects) if (!present.has(id)) {
      this.root.remove(object.group);
      this.objects.delete(id);
    }
  }

  makeObject(data) {
    const group = new THREE.Group();
    group.name = data.name;
    group.position.set(data.x, data.y || 0, data.z);
    const item = {group, target: group.position.clone(), data: {...data}, dropTime: -100};
    if (data.kind === 'door') {
      // Leaves disappear into opaque wall pockets, on both sides of a thick frame.
      item.progress=doorProgress(data,Date.now()+(this.ship.serverOffset||0));
      for(const side of [-1,1]) {
       this.piece(group,'box',0x748897,[0,1.44,side*1.48],[.64,2.88,.32]);
       this.piece(group,'box',0xe5e9e8,[0,1.5,side*2.12],[.5,3,1.1]);
       for(const face of [-1,1]) {
        this.piece(group,'box',0x152734,[face*.34,1.44,side*1.35],[.04,2.82,.06]);
        this.piece(group,'box',0x9bd9ff,[face*.37,1.45,side*1.5],[.025,2.25,.035],true);
        this.piece(group,'box',0x26415c,[face*.3,1.3,side*1.9],[.08,.38,.23]);
        this.piece(group,'box',0x80c6ed,[face*.35,1.36,side*1.9],[.025,.14,.16],true);
       }
      }
      this.piece(group,'box',0xcfd8de,[0,3.04,0],[.72,.33,3.3]);
      this.piece(group,'box',0x1b2d3b,[0,2.84,0],[.58,.055,2.62]);
      this.piece(group,'box',0x7c8e99,[0,.008,0],[.7,.016,2.6]);
      item.leaves=[];
      for(const side of [-1,1]) {
       const leaf=new THREE.Group();leaf.position.z=side*(.65+item.progress*1.34);group.add(leaf);
       this.piece(leaf,'box',0xdce2e5,[0,1.4,0],[.22,2.8,1.3]);
       for(const face of [-1,1]) {
        this.piece(leaf,'box',0xf0f0eb,[face*.12,1.64,0],[.035,2.16,1.16]);
        this.piece(leaf,'box',0x24599b,[face*.144,.51,0],[.018,.11,1.17]);
        this.piece(leaf,'box',0x788c9b,[face*.15,1.4,-side*.48],[.045,.54,.055]);
        for(let j=0;j<4;j++)this.piece(leaf,'box',0x354755,[face*.146,.22+j*.04,0],[.015,.014,.65]);
       }
       this.piece(leaf,'box',0x152330,[0,1.4,-side*.64],[.25,2.8,.025]);item.leaves.push(leaf);
      }
      item.light=this.piece(group,'box',0x7fc7ff,[-.38,3.05,0],[.025,.055,.8],true);
      if(this.ship.interior)for(const side of [-1,1])this.ship.interior.label(group,data.name,side*.38,3.05,0,2.45,.18,side*Math.PI/2);
    } else if (data.kind === 'crate') {
      this.piece(group, 'box', 0xd3dde2, [0, .38, 0], [.8, .72, .68]);
      this.piece(group, 'box', 0x728799, [0, .77, 0], [.86, .09, .74]);
      for (const x of [-.32, .32]) for (const z of [-.26, .26]) this.piece(group, 'box', 0xb2bfc5, [x, .39, z], [.09, .76, .09]);
      for (const side of [-1, 1]) this.piece(group, 'box', 0x1c2b36, [side * .43, .52, 0], [.07, .11, .3]);
      this.piece(group, 'box', 0xe0b972, [0, .4, -.35], [.27, .18, .02]);
      this.piece(group, 'box', 0x344653, [0, .4, -.365], [.15, .03, .012]);
    } else if (data.kind === 'plant') {
      this.piece(group, 'cylinder', 0x536977, [0, .23, 0], [.38, .46, .38]);
      this.piece(group, 'cylinder', 0x273b33, [0, .47, 0], [.34, .035, .34]);
      this.piece(group, 'cylinder', 0x5b805a, [0, .95, 0], [.035, .95, .035]);
      item.leaves = [];
      for (let i = 0; i < 8; i++) {
        const angle = i * 2.4, height = .65 + i * .09;
        const leaf = this.piece(group, 'sphere', i % 2 ? 0x79a67a : 0x4d886e,
          [Math.cos(angle) * .19, height, Math.sin(angle) * .19], [.28, .07, .13]);
        leaf.rotation.set(.25, -angle, .3);
        item.leaves.push(leaf);
      }
    } else {
      this.piece(group, 'cylinder', 0x3b5264, [0, .12, 0], [.47, .24, .47]);
      this.piece(group, 'cylinder', 0xa2b6bc, [0, .7, 0], [.07, 1.1, .07]);
      const rotor = new THREE.Group();
      rotor.position.y = 1.3;
      group.add(rotor);
      this.piece(rotor, 'sphere', 0x78dfd5, [0, 0, 0], [.17, .17, .17], true);
      const ring = this.piece(rotor, 'ring', 0xa5ece5, [0, 0, 0], [.38, .38, .38], true);
      ring.rotation.x = .45;
      item.rotor = rotor;
    }
    if(data.kind==='door'&&this.ship.interior&&!this.ship.renderer.isSoftware){
      const frame=new THREE.Group();group.add(frame);for(const child of [...group.children])if(child!==frame&&child!==item.light&&!item.leaves.includes(child))frame.add(child);
      this.ship.interior.batch(frame);for(const leaf of item.leaves)this.ship.interior.batch(leaf);
    }
    group.traverse(node => { node.userData.worldObjectID = data.id; });
    return item;
  }

  buildCrowd(count) {
    if (this.crowd) this.root.remove(this.crowd);
    for (const part of this.parts) part.mesh?.dispose?.();
    this.crowd = new THREE.Group();
    this.crowd.name = 'Жители станции · простые NPC';
    this.root.add(this.crowd);
    this.parts = [];
    this.npcs = Array.from({length: count}, (_, i) => {
      const [x, z] = roomCenters[i % 4];
      const n = Math.floor(i / 4), side = n % 2 ? 1 : -1;
      let bx=x+side*(3.5+(n%3)*.45),bz=z-4+(Math.floor(n/2)%9);
      if(!walkable(bx,bz)){bx=x+side*3;bz=z+3.5;}
      return {id: i, baseX: bx, baseZ: bz, x: bx, z: bz, phase: i * 2.399,
        yaw: 0, height: .86 + (i % 5) * .035, walking: true};
    });
    // Twelve articulated batches render up to 160 residents in twelve draw calls.
    // Canvas fallback uses ordinary meshes with the same geometry and transforms.
    const definitions = [
      ['torso', 'box', 0xe1e5e5, [0, 1.11, 0], [.45, .56, .28]],
      ['vest', 'box', 0x32659c, [0, 1.18, -.151], [.33, .3, .035]],
      ['head', 'sphere', 0xc6a18a, [0, 1.63, 0], [.17, .22, .17]],
      ['hair', 'sphere', 0x45545a, [0, 1.77, .025], [.174, .095, .17]],
      ['face', 'box', 0x2c3e47, [0, 1.66, -.16], [.2, .027, .024]],
      ['pelvis', 'box', 0x354b59, [0, .78, 0], [.38, .17, .28]],
      ['armL', 'cylinder', 0xe1e5e5, [-.3, 1.02, 0], [.075, .58, .075]],
      ['armR', 'cylinder', 0xe1e5e5, [.3, 1.02, 0], [.075, .58, .075]],
      ['legL', 'cylinder', 0x354b59, [-.12, .43, 0], [.095, .6, .095]],
      ['legR', 'cylinder', 0x354b59, [.12, .43, 0], [.095, .6, .095]],
      ['bootL', 'box', 0x1f303b, [-.12, .1, -.06], [.19, .17, .3]],
      ['bootR', 'box', 0x1f303b, [.12, .1, -.06], [.19, .17, .3]]
    ];
    for (const [name, kind, color, position, scale] of definitions) {
      const material = this.material(color), geometry = this.geometry(kind);
      if (!this.ship.renderer.isSoftware && count) {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        if (name === 'torso' || name.startsWith('arm')) {
          for (let i = 0; i < count; i++) mesh.setColorAt(i, new THREE.Color([0xe5e7e4, 0xd7dfe5, 0xe5e2d9, 0xdce5df][i % 4]));
        }
        this.crowd.add(mesh);
        this.parts.push({name, position, scale, mesh});
      } else {
        const meshes = this.npcs.map(() => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.matrixAutoUpdate = false;
          this.crowd.add(mesh);
          return mesh;
        });
        this.parts.push({name, position, scale, meshes});
      }
    }
  }

  reactToSpeech(position = this.ship.player) {
    this.speechPosition.copy(position);
    this.speechUntil = performance.now() + 5000;
  }

  nearest(position) {
    const held = this.selfId && [...this.objects.values()].find(item => item.data.held_by === this.selfId);
    let nearest = null, distance = 3.5;
    for (const item of this.objects.values()) {
      if (!['door', 'crate'].includes(item.data.kind) || item.data.held_by || (held && item.data.kind!=='door')) continue;
      const d = Math.hypot(item.data.x - position.x, item.data.z - position.z);
      if (d < distance && (item.data.kind==='door' || roomAt(position.x,position.z)?.id===roomAt(item.data.x,item.data.z)?.id)) { nearest = item; distance = d; }
    }
    return nearest ? this.interaction(nearest) : held ? this.interaction(held) : null;
  }

  interaction(item) {
    const data = item.data;
    const action = data.kind === 'door' ? 'toggle' : data.held_by && data.held_by === this.selfId ? 'drop' : 'pickup';
    const progress=item.progress??doorProgress(data);
    const motion=progress>0.001&&progress<.999;
    const verb = data.locked?'Заблокирована: '+data.locked:motion?(data.open?'Открывается…':'Закрывается…'):action === 'drop' ? 'Положить' : action === 'pickup' ? 'Взять' : data.open ? 'Закрыть' : 'Открыть';
    return {type: 'world', object_id: data.id, action, disabled:!!data.locked||motion, label: `${verb} · ${data.name}`};
  }

  pick(event, canvas, camera) {
    const rect = canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hits = this.ray.intersectObjects([...this.objects.values()].filter(x => ['door', 'crate'].includes(x.data.kind)).map(x => x.group), true);
    const item = this.objects.get(hits[0]?.object.userData.worldObjectID);
    return item ? this.interaction(item) : null;
  }

  walkable(x,z) {
    for(const item of this.objects.values()) {
      const d=item.data;
      if(d.kind==='door'&&doorBlocks(d,x,z,item.progress??doorProgress(d)))return false;
      if(d.kind==='crate'&&!d.held_by&&Math.abs(x-d.x)<.67&&Math.abs(z-d.z)<.61)return false;
    }
    return true;
  }

  animate(dt, reducedMotion = false) {
    this.time += dt * (this.speed ?? 1);
    const t = this.time, player = this.ship.player;
    for (const item of this.objects.values()) {
      const data = item.data;
      const visible=this.ship.interior?.visibleRooms;
      const gate=layout.gates.find(g=>g.id===data.id);
      item.group.visible=!visible||data.held_by|| (gate?gate.areas.some(id=>visible.has(id)):visible.has(roomAt(data.x,data.z)?.id));
      if (data.held_by) {
        const local = data.held_by === this.selfId, carrier = local ? player : this.ship.remote.get(data.held_by)?.mesh.position;
        if (carrier) {
          const yaw = local ? this.ship.yaw : this.ship.remote.get(data.held_by).mesh.rotation.y;
          item.target.set(carrier.x - Math.sin(yaw) * .85, .9, carrier.z - Math.cos(yaw) * .85);
        }
      } else item.target.set(data.x, data.y || 0, data.z);
      item.group.position.lerp(item.target, reducedMotion ? 1 : 1 - Math.exp(-dt * 13));
      if (!reducedMotion && !data.held_by && t - item.dropTime < 1.2) item.group.position.y += Math.abs(Math.sin((t - item.dropTime) * 12)) * .045 * Math.exp(-(t - item.dropTime) * 3);
      if(data.kind==='door') {
        const now=Date.now()+(this.ship.serverOffset||0);
        item.progress=doorProgress(data,now);
        // Local safety holds the leaves while the authoritative reopen arrives.
        const occupied=[player,...[...this.ship.remote.values()].map(v=>v.mesh.position)].some(p=>{const dx=p.x-data.x,dz=p.z-data.z,a=data.rotation||0;return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<.75&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<1.6;});
        if(!data.open&&occupied&&item.lastProgress>0)item.progress=Math.max(item.lastProgress,item.progress);
        item.lastProgress=item.progress;
        item.light.material=this.material(data.locked?0xe6998b:item.progress>.999?0x9de2c3:item.progress>.001?0xf3c58a:0x7fc7ff,true);
        item.leaves.forEach((leaf,i)=>leaf.position.z=(i?1:-1)*(.65+item.progress*1.34));
      }
      if (!reducedMotion && item.rotor) item.rotor.rotation.y = t * 1.4;
      if (!reducedMotion && data.kind === 'plant') item.leaves.forEach((leaf, i) => {leaf.rotation.z = .3 + Math.sin(t * 1.3 + i) * .08;});
    }
    const listening = performance.now() < this.speechUntil;
    const users = [player, ...[...this.ship.remote.values()].map(remote => remote.mesh.position)];
    for (const npc of this.npcs) {
      const nearby = users.find(position => Math.hypot(position.x - npc.x, position.z - npc.z) < 2);
      const near = Boolean(nearby);
      const hears = listening && Math.hypot(this.speechPosition.x - npc.x, this.speechPosition.z - npc.z) < 8;
      npc.walking = !near && !hears && this.speed > 0;
      if (npc.walking && !reducedMotion) {
        const a = t * .27 + npc.phase;
        const nx = npc.baseX + Math.cos(a) * .55, nz = npc.baseZ + Math.sin(a) * .65;
        npc.yaw = Math.atan2(npc.x - nx, npc.z - nz);
        if(walkable(nx,nz)&&this.walkable(nx,nz)){npc.x+=(nx-npc.x)*Math.min(1,dt*2);npc.z+=(nz-npc.z)*Math.min(1,dt*2);}
      } else if (near || hears) {
        const target = hears ? this.speechPosition : nearby;
        npc.yaw = Math.atan2(npc.x - target.x, npc.z - target.z);
      }
      this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, npc.yaw);
      this.matrix.compose(this.npcPosition.set(npc.x, 0, npc.z), this.rotation, unit);
      const step = !reducedMotion && npc.walking ? Math.sin(t * 5 + npc.phase) * .3 : 0;
      for (const part of this.parts) {
        const side = part.name.endsWith('L') ? -1 : 1;
        const arm = part.name.startsWith('arm'), leg = part.name.startsWith('leg'), boot = part.name.startsWith('boot');
        this.partPosition.set(...part.position).multiplyScalar(npc.height);
        if (arm || leg || boot) this.partPosition.z += side * step * (arm ? -.3 : boot ? .5 : .23);
        this.scale.set(...part.scale).multiplyScalar(npc.height);
        if(this.ship.interior?.visibleRooms&&!this.ship.interior.visibleRooms.has(roomAt(npc.x,npc.z)?.id))this.scale.set(0,0,0);
        this.euler.set((arm ? -1 : leg ? 1 : 0) * side * step, 0, 0);
        this.rotation.setFromEuler(this.euler);
        this.localMatrix.compose(this.partPosition, this.rotation, this.scale).premultiply(this.matrix);
        if (part.mesh) part.mesh.setMatrixAt(npc.id, this.localMatrix);
        else {
          part.meshes[npc.id].matrix.copy(this.localMatrix);
          // Software renderer has no instancing; hide distant details only.
          part.meshes[npc.id].visible = !['face', 'hair', 'vest'].includes(part.name) || this.ship.camera.position.distanceToSquared(this.partPosition.set(npc.x, 0, npc.z)) < 625;
        }
      }
    }
    for (const part of this.parts) if (part.mesh) part.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.setState({settings: {npc_count: 0, simulation_speed: 1}, objects: []});
    this.selfId = null;
  }

  dispose() {
    this.clear();
    this.ship.scene.remove(this.root);
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
  }
}
