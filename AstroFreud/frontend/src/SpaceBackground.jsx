import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* Radial glow texture */
function makeGlowTex(hex, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d'), h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0.00, hex + 'cc');
  g.addColorStop(0.30, hex + '55');
  g.addColorStop(0.65, hex + '1a');
  g.addColorStop(1.00, hex + '00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/* Planet surface texture  */
function makePlanetTex(base, detail, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = detail;
    ctx.fillRect(0, (size / 8) * i, size, size / 16);
  }
  ctx.globalAlpha = 0.48;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, Math.random()*22+5, 0, Math.PI*2);
    ctx.fillStyle = detail; ctx.fill();
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

/*  Procedural spaceship  */
function makeShip(accent) {
  const grp = new THREE.Group();
  const mat = (hex, op=1) => new THREE.MeshBasicMaterial({ color:hex, transparent:op<1, opacity:op });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.55,3.2,8), mat(0x172554));
  body.rotation.z = Math.PI/2; grp.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22,1.4,8), mat(accent));
  nose.rotation.z = -Math.PI/2; nose.position.x = 2.3; grp.add(nose);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.38,0.7,8), mat(0x0f172a));
  tail.rotation.z = Math.PI/2; tail.position.x = -1.95; grp.add(tail);
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([0,0,0,-1.8,0,-1.6,-1.8,0,0, 0,0,0,-1.8,0,0,0.2,0,0.2]), 3));
  const wL = new THREE.Mesh(wGeo, mat(accent, 0.82));
  wL.position.set(-0.5,0,0); grp.add(wL);
  const wR = wL.clone(); wR.scale.z=-1; grp.add(wR);
  [-0.28,0.28].forEach(oz => {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.13,10), mat(0x22d3ee,0.9));
    e.position.set(-1.95,0,oz); e.rotation.y=Math.PI/2; grp.add(e);
  });
  const cock = new THREE.Mesh(new THREE.SphereGeometry(0.18,8,6), mat(0x93c5fd,0.78));
  cock.position.set(1.5,0.22,0); grp.add(cock);
  return grp;
}


   //SpaceBackground

export default function SpaceBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    let W = window.innerWidth, H = window.innerHeight;

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    renderer.setSize(W, H);
    renderer.setClearColor(0x020617, 1);   // #020617 base

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, W/H, 0.1, 3000);
    camera.position.z = 420;


    // We paint a full screen plane behind everything using a ShaderMaterial
    const bgGeo = new THREE.PlaneGeometry(2, 2);
    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        void main() { gl_Position = vec4(position.xy, 1.0, 1.0); }
      `,
      fragmentShader: `
        uniform float uTime;
        void main() {
          vec2 uv = gl_FragCoord.xy / vec2(${W}.0, ${H}.0);
          // Base deep midnight
          vec3 base = vec3(0.008, 0.024, 0.090);            // #020617
          // Teal glow top-left — #0D9488 at 15% opacity
          float teal = exp(-dot(uv - vec2(0.0,1.0), uv - vec2(0.0,1.0)) * 3.5);
          vec3 tealCol = vec3(0.051, 0.584, 0.533) * 0.15;
          // Indigo glow bottom-right — #1E1B4B at 20% opacity
          float ind = exp(-dot(uv - vec2(1.0,0.0), uv - vec2(1.0,0.0)) * 2.8);
          vec3 indCol = vec3(0.118, 0.106, 0.294) * 0.20;
          // Subtle slow pulse
          float pulse = 0.92 + 0.08 * sin(uTime * 0.18);
          vec3 col = base + tealCol * teal * pulse + indCol * ind * pulse;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.renderOrder = -1;
    scene.add(bgMesh);

    /* Starfield  */
    const N=2800;
    const sPos=new Float32Array(N*3), sCol=new Float32Array(N*3), sPh=new Float32Array(N);
    const pal=[
      new THREE.Color('#e2e8f0'),
      new THREE.Color('#93c5fd'),   
      new THREE.Color('#22d3ee'),  
      new THREE.Color('#818cf8'),  
      new THREE.Color('#38bdf8'),   
      new THREE.Color('#c7d2fe'),   
    ];
    for(let i=0;i<N;i++){
      const i3=i*3;
      sPos[i3]  =(Math.random()-.5)*1800;
      sPos[i3+1]=(Math.random()-.5)*1400;
      sPos[i3+2]=(Math.random()-.5)*1400-200;
      const c=pal[Math.floor(Math.random()*pal.length)];
      sCol[i3]=c.r; sCol[i3+1]=c.g; sCol[i3+2]=c.b;
      sPh[i]=Math.random()*Math.PI*2;
    }
    const sGeo=new THREE.BufferGeometry();
    sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
    sGeo.setAttribute('color',   new THREE.BufferAttribute(sCol,3));
    const sMat=new THREE.PointsMaterial({
      size:1.8, sizeAttenuation:true, vertexColors:true,
      transparent:true, opacity:0.90,
      blending:THREE.AdditiveBlending, depthWrite:false,
    });
    const stars=new THREE.Points(sGeo,sMat);
    scene.add(stars);

    /* ── Planets ── */
    const pDefs=[
      {base:'#1e1b4b',detail:'#4f46e5',ring:'#818cf8',r:40,x:-340,y:165,z:-900,hasRing:true, rot:0.0007},
      {base:'#0c4a6e',detail:'#0ea5e9',ring:null,      r:24,x: 360,y:-130,z:-700,hasRing:false,rot:0.0011},
      {base:'#064e3b',detail:'#10b981',ring:'#34d399', r:17,x: 125,y: 240,z:-600,hasRing:false,rot:0.002 },
      {base:'#0f172a',detail:'#38bdf8',ring:null,      r:54,x:-190,y:-265,z:-1100,hasRing:false,rot:0.0005},
      {base:'#431407',detail:'#f97316',ring:'#fb923c', r:13,x: 445,y: 205,z:-500,hasRing:true, rot:0.003 },
    ];
    const planets=pDefs.map(d=>{
      const g=new THREE.Group(); g.position.set(d.x,d.y,d.z);
      const sp=new THREE.Mesh(
        new THREE.SphereGeometry(d.r,32,24),
        new THREE.MeshBasicMaterial({map:makePlanetTex(d.base,d.detail)})
      ); g.add(sp);
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({
        map:makeGlowTex(d.base,128), transparent:true, opacity:0.28,
        blending:THREE.AdditiveBlending, depthWrite:false,
      })); halo.scale.setScalar(d.r*3.4); g.add(halo);
      if(d.hasRing){
        const ring=new THREE.Mesh(
          new THREE.TorusGeometry(d.r*1.65,d.r*0.22,4,64),
          new THREE.MeshBasicMaterial({color:d.ring||'#ffffff',transparent:true,opacity:0.42,side:THREE.DoubleSide})
        ); ring.rotation.x=Math.PI/3.5; g.add(ring);
      }
      g._rot=d.rot; scene.add(g); return g;
    });

    /*  Spaceships */
    const sDefs=[
      {col:0x22d3ee,x:-65, y:92, z:-180,sc:5,  rotZ: 0.15,ph:0.0},
      {col:0x818cf8,x: 205,y:-62,z:-260,sc:3.5,rotZ:-0.08,ph:1.2},
      {col:0x38bdf8,x: 82, y:52, z:-140,sc:2.8,rotZ: 0.06,ph:2.6},
    ];
    const ships=sDefs.map(d=>{
      const s=makeShip(d.col);
      s.position.set(d.x,d.y,d.z); s.scale.setScalar(d.sc); s.rotation.z=d.rotZ;
      s._home={x:d.x,y:d.y}; s._ph=d.ph; s._rotZ=d.rotZ;
      const eg=new THREE.Sprite(new THREE.SpriteMaterial({
        map:makeGlowTex('#22d3ee',64), transparent:true, opacity:0.65,
        blending:THREE.AdditiveBlending, depthWrite:false,
      })); eg.scale.setScalar(d.sc*3.2); eg.position.set(-d.sc*2,0,0);
      s.add(eg); s._eg=eg; scene.add(s); return s;
    });

    /* Nebulas */
    const nDefs=[
      {hex:'#0d9488',x:-390,y:-230,z:-800,sc:720,op:0.16},  
      {hex:'#1e1b4b',x: 370,y: 210,z:-600,sc:580,op:0.18},  
      {hex:'#0c4a6e',x:-120,y: 290,z:-500,sc:440,op:0.12},  
      {hex:'#172554',x:  30,y:  40,z:-900,sc:840,op:0.14},  
      {hex:'#0f172a',x: 310,y:-290,z:-700,sc:480,op:0.11},  
    ];
    const nebs=nDefs.map(d=>{
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({
        map:makeGlowTex(d.hex,512), transparent:true, opacity:d.op,
        blending:THREE.AdditiveBlending, depthWrite:false,
      })); sp.position.set(d.x,d.y,d.z); sp.scale.setScalar(d.sc);
      sp._b={x:d.x,y:d.y,op:d.op}; scene.add(sp); return sp;
    });

    /* Mouse parallax */
    const mouse={x:0,y:0}, smooth={x:0,y:0};
    const onMove=e=>{ mouse.x=(e.clientX/W-.5)*2; mouse.y=(e.clientY/H-.5)*2; };
    window.addEventListener('mousemove',onMove);

    const onResize=()=>{
      W=window.innerWidth; H=window.innerHeight;
      camera.aspect=W/H; camera.updateProjectionMatrix();
      renderer.setSize(W,H);
    };
    window.addEventListener('resize',onResize);

    /* Animate  */
    let raf; const clock=new THREE.Clock();
    const animate=()=>{
      raf=requestAnimationFrame(animate);
      const t=clock.getElapsedTime();
      bgMat.uniforms.uTime.value=t;

      /* Twinkle */
      const ca=sGeo.attributes.color;
      for(let i=0;i<N;i++){
        const i3=i*3, br=0.5+0.5*(0.5+0.5*Math.sin(t*0.85+sPh[i]));
        const bc=pal[i%pal.length];
        ca.array[i3]=bc.r*br; ca.array[i3+1]=bc.g*br; ca.array[i3+2]=bc.b*br;
      }
      ca.needsUpdate=true;

      /* Stars drift */
      stars.position.z=(t*3.5)%200;
      stars.rotation.y=t*0.005; stars.rotation.x=t*0.002;

      /* Planets rotate */
      planets.forEach(p=>{ p.rotation.y+=p._rot; });

      /* Ships patrol */
      ships.forEach((s,i)=>{
        const f=0.18+i*0.07;
        s.position.x=s._home.x+Math.sin(t*f+s._ph)*62;
        s.position.y=s._home.y+Math.cos(t*f*.6+s._ph)*32;
        s.rotation.z=Math.sin(t*f+s._ph)*0.18+s._rotZ;
        if(s._eg) s._eg.material.opacity=0.45+0.45*Math.abs(Math.sin(t*4+i));
      });

      /* Smooth parallax */
      smooth.x+=(mouse.x-smooth.x)*0.035;
      smooth.y+=(mouse.y-smooth.y)*0.035;
      stars.position.x=smooth.x*22; stars.position.y=-smooth.y*14;

      nebs.forEach((sp,i)=>{
        const d=0.5+i*0.18;
        sp.position.x=sp._b.x+smooth.x*28*d;
        sp.position.y=sp._b.y-smooth.y*18*d;
        sp.material.opacity=sp._b.op*(0.8+0.2*Math.sin(t*0.2+i));
      });
      planets.forEach((p,i)=>{
        p.position.x=pDefs[i].x+smooth.x*14*(0.3+i*0.12);
        p.position.y=pDefs[i].y-smooth.y*9*(0.3+i*0.12);
      });
      ships.forEach(s=>{ s.position.x+=smooth.x*5; s.position.y-=smooth.y*3.5; });

      renderer.render(scene,camera);
    };
    animate();

    return ()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('resize',onResize);
      renderer.dispose();
      sGeo.dispose(); sMat.dispose(); bgGeo.dispose(); bgMat.dispose();
      nebs.forEach(s=>{s.material.map?.dispose();s.material.dispose();});
      planets.forEach(g=>g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}));
      ships.forEach(g=>g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}));
    };
  }, []);

  return (
    <canvas ref={ref} style={{
      position:'fixed',inset:0,width:'100vw',height:'100vh',
      zIndex:0,display:'block',pointerEvents:'none',
    }}/>
  );
}