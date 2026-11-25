import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../audio/SoundEngine';
import { Sparkles, Shield, Globe, Activity } from 'lucide-react';

export type FormationType = 'wave' | 'globe' | 'shield';

interface ParticleFieldProps {
  height?: number;
}

const PARTICLE_COUNT = 15000;

export const ParticleField: React.FC<ParticleFieldProps> = ({ height = 500 }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [currentFormation, setCurrentFormation] = useState<FormationType>('wave');
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090b0f, 0.005);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / height,
      1,
      1000
    );
    camera.position.set(0, 15, 65);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Buffers for 15,000 particles
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const targetPositions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    const cyan = new THREE.Color(0x7df9ff);
    const emerald = new THREE.Color(0x00f5a0);
    const crimson = new THREE.Color(0xff3366);

    // Generator 1: Order-Book Bull/Bear Wave Formation
    const generateWave = () => {
      let idx = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const u = (i % 150) / 150 - 0.5; // -0.5 to 0.5
        const v = Math.floor(i / 150) / 100 - 0.5; // -0.5 to 0.5

        const x = u * 75;
        const z = v * 50;
        // Bull bids (left, emerald) vs Bear asks (right, crimson)
        const isBull = x < 0;
        const wave = Math.sin(u * 12 + v * 8) * 6 + Math.cos(v * 10) * 4;
        const y = wave + (Math.random() - 0.5) * 2.5;

        targetPositions[idx] = x;
        targetPositions[idx + 1] = y;
        targetPositions[idx + 2] = z;

        const col = isBull ? emerald.clone().lerp(cyan, Math.random() * 0.4) : crimson.clone().lerp(cyan, Math.random() * 0.3);
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;

        sizes[i] = Math.random() * 2.2 + 0.8;
        idx += 3;
      }
    };

    // Generator 2: Quantum Market Globe Formation
    const generateGlobe = () => {
      let idx = 0;
      const radius = 22;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
        const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;

        const jitter = (Math.random() - 0.5) * 1.5;
        const r = radius + jitter;

        targetPositions[idx] = r * Math.cos(theta) * Math.sin(phi);
        targetPositions[idx + 1] = r * Math.sin(theta) * Math.sin(phi);
        targetPositions[idx + 2] = r * Math.cos(phi);

        const ratio = (targetPositions[idx + 1] + radius) / (radius * 2);
        const col = cyan.clone().lerp(emerald, ratio);
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;

        sizes[i] = Math.random() * 2.0 + 0.9;
        idx += 3;
      }
    };

    // Generator 3: Precision Risk Shield Formation
    const generateShield = () => {
      let idx = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const u = (Math.random() - 0.5) * 36;
        const v = (Math.random() - 0.5) * 44;

        // Shield contour formula: y = top curve, tapering to bottom point
        const widthAtV = (22 - Math.max(0, -v) * 0.7);
        const clampedU = Math.max(-widthAtV, Math.min(widthAtV, u));

        targetPositions[idx] = clampedU;
        targetPositions[idx + 1] = v;
        targetPositions[idx + 2] = -Math.abs(clampedU) * 0.25 + (Math.random() - 0.5) * 2;

        const isEdge = Math.abs(clampedU) > widthAtV - 2.5;
        const col = isEdge ? crimson : cyan.clone().lerp(emerald, (v + 22) / 44);
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;

        sizes[i] = isEdge ? 2.8 : 1.2;
        idx += 3;
      }
    };

    // Initial populate
    generateWave();
    for (let k = 0; k < positions.length; k++) {
      positions[k] = targetPositions[k];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom Shader Material for glow particles
    const particleMaterial = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (250.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist);
          gl_FragColor = vec4(vColor, alpha * 0.85);
        }
      `,
    });

    const particleSystem = new THREE.Points(geometry, particleMaterial);
    scene.add(particleSystem);

    // Mouse Interaction
    let mouse = new THREE.Vector2(0, 0);
    let targetMouse = new THREE.Vector2(0, 0);
    let isMouseDown = false;
    let shockwave = 0;

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      targetMouse.set(x, y);

      // Play spatial granular audio chime as cursor moves
      if (Math.random() > 0.8) {
        soundEngine.playParticleChime(1.0 + Math.abs(y) * 0.5, x);
      }
    };

    const onPointerDown = () => {
      isMouseDown = true;
      setIsHolding(true);
      soundEngine.playHoverTick();
    };

    const onPointerUp = () => {
      if (isMouseDown) {
        isMouseDown = false;
        setIsHolding(false);
        shockwave = 1.0; // Trigger shockwave explosion
        soundEngine.playSubDrop();
      }
    };

    container.addEventListener('mousemove', onPointerMove, { passive: true });
    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);

    // Expose formation switcher
    (container as any).__switchFormation = (type: FormationType) => {
      if (type === 'wave') generateWave();
      if (type === 'globe') generateGlobe();
      if (type === 'shield') generateShield();
      soundEngine.playSubDrop();
    };

    // Animation Loop
    let animId: number;
    let time = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      time += 0.02;

      mouse.lerp(targetMouse, 0.05);

      particleMaterial.uniforms.uTime.value = time;
      particleSystem.rotation.y = time * 0.08 + mouse.x * 0.4;
      particleSystem.rotation.x = -mouse.y * 0.3;

      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const colAttr = geometry.attributes.color as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;

      // Mouse world vector
      const mouseWorld = new THREE.Vector3(mouse.x * 35, mouse.y * 25, 0);

      let idx = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Morph interpolation towards target positions
        posArr[idx] += (targetPositions[idx] - posArr[idx]) * 0.06;
        posArr[idx + 1] += (targetPositions[idx + 1] - posArr[idx + 1]) * 0.06;
        posArr[idx + 2] += (targetPositions[idx + 2] - posArr[idx + 2]) * 0.06;

        // Subtle curl-noise breathing
        posArr[idx + 1] += Math.sin(time * 2.0 + posArr[idx] * 0.2) * 0.04;

        // Magnetic repulsion & vortex pull
        const dx = posArr[idx] - mouseWorld.x;
        const dy = posArr[idx + 1] - mouseWorld.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < 180) {
          if (isMouseDown) {
            // Vortex suction towards cursor
            posArr[idx] -= dx * 0.12;
            posArr[idx + 1] -= dy * 0.12;
          } else {
            // Magnetic repulsion
            const force = (180 - distSq) / 180;
            posArr[idx] += dx * force * 0.04;
            posArr[idx + 1] += dy * force * 0.04;
          }
        }

        // Shockwave expansion on release
        if (shockwave > 0.01) {
          posArr[idx] += dx * shockwave * 0.05;
          posArr[idx + 1] += dy * shockwave * 0.05;
          posArr[idx + 2] += (Math.random() - 0.5) * shockwave * 2.0;
        }

        idx += 3;
      }

      if (shockwave > 0.01) {
        shockwave *= 0.92;
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, [height]);

  const handleSelectFormation = (type: FormationType) => {
    setCurrentFormation(type);
    if (mountRef.current && (mountRef.current as any).__switchFormation) {
      (mountRef.current as any).__switchFormation(type);
    }
  };

  return (
    <div className="relative rounded-3xl bg-gradient-to-b from-[#090d18] via-[#060911] to-[#03060c] border border-cyan-500/20 overflow-hidden shadow-[0_0_60px_rgba(125,249,255,0.08)]">
      {/* HUD Header Bar */}
      <div className="absolute top-4 left-6 right-6 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none select-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest">
              VOLUMETRIC LIQUIDITY SANDBOX (15,000+ GPU PARTICLES)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            {isHolding ? '⚡ VORTEX CHARGING // RELEASE FOR SHOCKWAVE' : 'Hover to Repel • Click & Hold for Vortex Swirl'}
          </p>
        </div>

        {/* Formation Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800 backdrop-blur-md pointer-events-auto">
          <button
            onClick={() => handleSelectFormation('wave')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
              currentFormation === 'wave'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(125,249,255,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Order-Book Wave
          </button>
          <button
            onClick={() => handleSelectFormation('globe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
              currentFormation === 'globe'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(125,249,255,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            Quantum Globe
          </button>
          <button
            onClick={() => handleSelectFormation('shield')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
              currentFormation === 'shield'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(125,249,255,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            Risk Shield
          </button>
        </div>
      </div>

      {/* WebGL Canvas Mount */}
      <div
        ref={mountRef}
        style={{ height }}
        className="w-full cursor-crosshair select-none"
      />

      {/* Bottom Telemetry Footer */}
      <div className="absolute bottom-4 left-6 right-6 z-10 flex items-center justify-between text-[11px] font-mono text-slate-500 pointer-events-none select-none">
        <div>GPU_MEM: 15.0K_INSTANCES // BLEND: ADDITIVE</div>
        <div className="hidden sm:block">INTERACTIVE HARMONIC SOUND SYNTH ACTIVE</div>
      </div>
    </div>
  );
};
