import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../audio/SoundEngine';
import { CrystallineIceShader, CryoGridShader } from '../shaders/CryogenicShaders';

export interface MonolithData {
  id: string;
  title: string;
  subtitle: string;
  specs: string[];
  color: string;
  position: [number, number, number];
  rotationSpeed: number;
}

export const MONOLITHS: MonolithData[] = [
  {
    id: 'execution',
    title: '01 // EXECUTION TERMINAL',
    subtitle: 'Direct DMA Routing & Sub-Millisecond Paper Simulator',
    specs: ['Latency: 1.2ms', 'Slippage Model: 5bps', 'Order Types: Market / Limit / Trailing'],
    color: '#7df9ff',
    position: [-10, -8, -18],
    rotationSpeed: 0.008,
  },
  {
    id: 'guardrails',
    title: '02 // RISK GUARDRAILS',
    subtitle: 'Cryogenic Protocol Lockout Against Revenge Trading',
    specs: ['Daily Drawdown Cap: -2.5%', 'Mandatory Stop-Loss', 'Auto Kill-Switch'],
    color: '#ff3366',
    position: [10, -18, -35],
    rotationSpeed: 0.007,
  },
  {
    id: 'edge_plan',
    title: '03 // EDGE TRADE PLAN',
    subtitle: 'Quantitative Multi-Factor Entry & Exit Architect',
    specs: ['Min R:R: 1.5:1', 'Volatility Regime Filter', 'Kelly Criterion Sizing'],
    color: '#00f5a0',
    position: [-9, -28, -52],
    rotationSpeed: 0.009,
  },
  {
    id: 'journal',
    title: '04 // AUTOMATED JOURNAL',
    subtitle: 'Zero-Effort Execution Audit & Trade DNA Mapping',
    specs: ['Tick-by-Tick Playback', 'MFE / MAE Analytics', 'Emotion State Log'],
    color: '#7df9ff',
    position: [9, -38, -70],
    rotationSpeed: 0.007,
  },
  {
    id: 'flo_ai',
    title: '05 // FLOAI QUANT COACH',
    subtitle: 'Autonomous LLM Trade Analysis & Behavioral Sentry',
    specs: ['Gemini API Core', 'Deterministic Fallback', 'Live Market Reasoning'],
    color: '#38bdf8',
    position: [-8, -48, -88],
    rotationSpeed: 0.01,
  },
  {
    id: 'analytics',
    title: '06 // PERFORMANCE MATRIX',
    subtitle: 'Monte Carlo 95% Confidence & Sortino Diagnostics',
    specs: ['Sharpe / Sortino Ratios', 'Max Drawdown Duration', 'Profit Factor Matrix'],
    color: '#00f5a0',
    position: [8, -58, -106],
    rotationSpeed: 0.008,
  },
];

interface Candle3DData {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  wickMesh: THREE.Mesh;
  volMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  baseY: number;
  open: number;
  close: number;
  high: number;
  low: number;
  isUp: boolean;
  lane: number;
  speed: number;
  phase: number;
}

interface CryoSceneProps {
  scrollProgress: number;
  onSelectMonolith: (monolith: MonolithData) => void;
  onIntroComplete?: () => void;
}

export const CryoScene: React.FC<CryoSceneProps> = ({
  scrollProgress,
  onSelectMonolith,
  onIntroComplete,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [bootProgress, setBootProgress] = useState(0);
  const [isBooted, setIsBooted] = useState(false);
  const [hoveredMonolith, setHoveredMonolith] = useState<MonolithData | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Atmospheric Fog Setup
    const scene = new THREE.Scene();
    const fogColor = new THREE.Color(0x04060c);
    scene.fog = new THREE.FogExp2(fogColor, 0.009);

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      600
    );
    camera.position.set(0, 8, 38);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. High-Tech Cyber-Trading Lighting
    const ambientLight = new THREE.AmbientLight(0x0a101f, 1.8);
    scene.add(ambientLight);

    const cyanLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    cyanLight.position.set(25, 45, 30);
    scene.add(cyanLight);

    const emeraldLight = new THREE.PointLight(0x00f5a0, 3.5, 120);
    emeraldLight.position.set(-35, 15, 10);
    scene.add(emeraldLight);

    const crimsonLight = new THREE.PointLight(0xff3366, 3.2, 120);
    crimsonLight.position.set(35, 10, -20);
    scene.add(crimsonLight);

    // 3. High-Tech Perspective Cyber-Grid Floor
    const gridGeo = new THREE.PlaneGeometry(240, 240);
    const gridMat = new THREE.ShaderMaterial({
      ...CryoGridShader,
      transparent: true,
      depthWrite: false,
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = -14;
    scene.add(gridMesh);

    // 4. Moving 3D Candlesticks Background System
    const candleWidth = 1.8;
    const candleDepth = 1.8;
    const bodyUnitGeo = new THREE.BoxGeometry(candleWidth, 1.0, candleDepth);
    const wickUnitGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
    const volUnitGeo = new THREE.BoxGeometry(candleWidth * 0.9, 1.0, candleDepth * 1.5);

    const bullColor = new THREE.Color(0x00f5a0);
    const bearColor = new THREE.Color(0xff3366);

    const bullBodyMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      emissive: bullColor,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9,
    });

    const bearBodyMat = new THREE.MeshStandardMaterial({
      color: 0xbe123c,
      emissive: bearColor,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9,
    });

    const bullWickMat = new THREE.MeshBasicMaterial({ color: 0x00f5a0 });
    const bearWickMat = new THREE.MeshBasicMaterial({ color: 0xff3366 });
    const volMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.4,
      roughness: 0.4,
    });

    const candles3D: Candle3DData[] = [];
    const LANES = [
      { z: 12, baseY: 6, count: 26, speed: 0.08, scale: 1.15 },
      { z: -8, baseY: 2, count: 30, speed: 0.06, scale: 0.95 },
      { z: -32, baseY: -3, count: 34, speed: 0.045, scale: 0.8 },
      { z: -58, baseY: 8, count: 28, speed: 0.03, scale: 0.65 },
    ];

    LANES.forEach((laneConfig, lIdx) => {
      const spacing = 4.2 * laneConfig.scale;
      const startX = -((laneConfig.count * spacing) / 2);
      let runningPrice = laneConfig.baseY;

      for (let i = 0; i < laneConfig.count; i++) {
        const delta = (Math.random() - 0.48) * 5.0;
        const open = runningPrice;
        const close = open + delta;
        const high = Math.max(open, close) + Math.random() * 2.8 + 0.6;
        const low = Math.min(open, close) - (Math.random() * 2.8 + 0.6);
        const isUp = close >= open;

        runningPrice = close;
        if (runningPrice < laneConfig.baseY - 12) runningPrice += 5;
        if (runningPrice > laneConfig.baseY + 12) runningPrice -= 5;

        const bodyHeight = Math.max(0.5, Math.abs(close - open));
        const wickHeight = Math.max(1.2, high - low);
        const volHeight = Math.random() * 3.8 + 0.8;

        const group = new THREE.Group();
        group.scale.set(laneConfig.scale, 1, laneConfig.scale);

        const bodyMesh = new THREE.Mesh(bodyUnitGeo, isUp ? bullBodyMat : bearBodyMat);
        bodyMesh.scale.set(1, bodyHeight, 1);
        group.add(bodyMesh);

        const wickMesh = new THREE.Mesh(wickUnitGeo, isUp ? bullWickMat : bearWickMat);
        wickMesh.scale.set(1, wickHeight, 1);
        group.add(wickMesh);

        const volMesh = new THREE.Mesh(volUnitGeo, volMat);
        volMesh.scale.set(1, volHeight, 1);
        volMesh.position.y = -bodyHeight / 2 - volHeight / 2 - 1.2;
        group.add(volMesh);

        const x = startX + i * spacing;
        const y = (open + close) / 2;
        const z = laneConfig.z;

        group.position.set(x, y, z);
        scene.add(group);

        candles3D.push({
          group,
          bodyMesh,
          wickMesh,
          volMesh,
          x,
          y,
          z,
          baseY: laneConfig.baseY,
          open,
          close,
          high,
          low,
          isUp,
          lane: lIdx,
          speed: laneConfig.speed,
          phase: Math.random() * Math.PI * 2,
        });
      }
    });

    // 5. Undulating 3D Exponential Moving Average (EMA Ribbon)
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i < 40; i++) {
      const u = (i / 40) * 160 - 80;
      curvePoints.push(new THREE.Vector3(u, Math.sin(i * 0.35) * 5 + 4, -4));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.22, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tubeMesh);

    // 6. Floating Volumetric Dust & Liquidity Particles (1,200 Particles)
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 180;
      particlePositions[i * 3 + 1] = Math.random() * 40 - 15;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 120 - 20;
      particleSpeeds[i] = Math.random() * 0.05 + 0.02;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.7,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 7. Sleek Crystalline Trading Monolith Artifacts
    const monolithMeshes: {
      group: THREE.Group;
      mesh: THREE.Mesh;
      ringMesh?: THREE.Mesh;
      data: MonolithData;
      shaderMat: THREE.ShaderMaterial;
    }[] = [];

    MONOLITHS.forEach((m) => {
      const monolithGroup = new THREE.Group();
      monolithGroup.position.set(...m.position);

      let geo: THREE.BufferGeometry;
      if (m.id === 'execution') {
        // Crystalline Candlestick Prism
        geo = new THREE.BoxGeometry(3.6, 6.5, 3.6);
      } else if (m.id === 'guardrails') {
        // Cryogenic Shield Octahedron
        geo = new THREE.OctahedronGeometry(3.8, 0);
      } else if (m.id === 'edge_plan') {
        // Dodecahedron Matrix
        geo = new THREE.DodecahedronGeometry(3.6, 0);
      } else if (m.id === 'journal') {
        // Faceted Data Cylinder
        geo = new THREE.CylinderGeometry(2.8, 2.8, 6.0, 6);
      } else if (m.id === 'flo_ai') {
        // Neural Icosahedron Core
        geo = new THREE.IcosahedronGeometry(3.6, 0);
      } else {
        // Torus Knot Equity Helix
        geo = new THREE.TorusKnotGeometry(2.4, 0.75, 64, 16);
      }

      const shaderMat = new THREE.ShaderMaterial({
        ...CrystallineIceShader,
        uniforms: THREE.UniformsUtils.clone(CrystallineIceShader.uniforms),
        transparent: true,
        side: THREE.DoubleSide,
      });
      shaderMat.uniforms.uRimColor.value = new THREE.Color(m.color);
      shaderMat.uniforms.uFresnelPower.value = 2.2;

      const crystalMesh = new THREE.Mesh(geo, shaderMat);
      (crystalMesh as any).__monolithData = m;
      monolithGroup.add(crystalMesh);

      // Inner Glowing Wireframe Lattice
      const wireMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(m.color),
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      const wireMesh = new THREE.Mesh(geo.clone(), wireMat);
      wireMesh.scale.set(0.94, 0.94, 0.94);
      monolithGroup.add(wireMesh);

      // Orbiting Holographic Telemetry Ring
      const ringGeo = new THREE.TorusGeometry(4.8, 0.08, 8, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(m.color),
        transparent: true,
        opacity: 0.45,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2.8;
      monolithGroup.add(ringMesh);

      scene.add(monolithGroup);
      monolithMeshes.push({ group: monolithGroup, mesh: crystalMesh, ringMesh, data: m, shaderMat });
    });

    // 8. Raycaster for Hover & Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let targetMouse = new THREE.Vector2(0, 0);

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      targetMouse.set(x, y);
      mouse.set(x, y);
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(monolithMeshes.map((x) => x.mesh));
      if (intersects.length > 0) {
        const hit = (intersects[0].object as any).__monolithData as MonolithData;
        if (hit) {
          soundEngine.playSubDrop();
          onSelectMonolith(hit);
        }
      }
    };

    container.addEventListener('mousemove', onPointerMove, { passive: true });
    container.addEventListener('click', onClick);

    // Boot counter simulation (0s to 2.0s)
    let bootVal = 0;
    const bootInterval = setInterval(() => {
      bootVal += 5;
      setBootProgress(Math.min(100, bootVal));
      if (bootVal >= 100) {
        clearInterval(bootInterval);
        setIsBooted(true);
        if (onIntroComplete) onIntroComplete();
      }
    }, 40);

    // 9. Camera Flight Spline along the Scroll Journey
    const splinePoints = [
      new THREE.Vector3(0, 8, 38),     // Hero View
      new THREE.Vector3(-4, 0, 16),     // Transition
      new THREE.Vector3(3, -10, -5),    // Monolith 1 & 2
      new THREE.Vector3(-4, -22, -26),  // Monolith 3 & 4
      new THREE.Vector3(3, -34, -46),   // Monolith 5 & 6
      new THREE.Vector3(0, -48, -70),   // Guardrail Simulation Card
      new THREE.Vector3(0, -60, -96),   // Volumetric Liquidity Finale
    ];
    const cameraSpline = new THREE.CatmullRomCurve3(splinePoints);

    // 10. 60FPS High-Performance Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      gridMat.uniforms.uTime.value = time;

      // Undulate Trend Ribbon gently
      tubeMesh.rotation.z = Math.sin(time * 0.4) * 0.02;
      tubeMesh.position.y = Math.sin(time * 0.8) * 0.5;

      // Drift floating liquidity particles
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] -= particleSpeeds[i];
        if (positions[i * 3] < -90) {
          positions[i * 3] = 90;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Continuous Smooth Motion Movement for 3D Candlesticks
      candles3D.forEach((c) => {
        c.x -= c.speed;

        const waveY = Math.sin(time * 1.3 + c.phase) * 0.35;
        c.group.position.x = c.x;
        c.group.position.y = c.y + waveY;
        c.group.rotation.y = Math.sin(time * 0.7 + c.phase) * 0.1;

        const laneBounds = LANES[c.lane];
        const span = laneBounds.count * 4.2 * laneBounds.scale;
        const minX = -(span / 2) - 8;
        const maxX = span / 2 + 8;

        if (c.x < minX) {
          c.x = maxX;
          const step = (Math.random() - 0.48) * 5.2;
          c.open = c.close;
          c.close = c.open + step;
          c.high = Math.max(c.open, c.close) + Math.random() * 2.8 + 0.6;
          c.low = Math.min(c.open, c.close) - (Math.random() * 2.8 + 0.6);
          c.isUp = c.close >= c.open;
          c.y = (c.open + c.close) / 2;

          const newBodyH = Math.max(0.5, Math.abs(c.close - c.open));
          const newWickH = Math.max(1.2, c.high - c.low);
          const newVolH = Math.random() * 3.8 + 0.8;

          c.bodyMesh.scale.set(1, newBodyH, 1);
          c.wickMesh.scale.set(1, newWickH, 1);
          c.volMesh.scale.set(1, newVolH, 1);
          c.volMesh.position.y = -newBodyH / 2 - newVolH / 2 - 1.2;

          c.bodyMesh.material = c.isUp ? bullBodyMat : bearBodyMat;
          c.wickMesh.material = c.isUp ? bullWickMat : bearWickMat;
        }
      });

      // Smooth Camera Scrubbing along Spline with Cursor Parallax
      const currentScroll = Math.max(0, Math.min(1, (container as any).__scrollProgress ?? 0));
      const targetPos = cameraSpline.getPointAt(currentScroll);
      const lookAtPos = cameraSpline.getPointAt(Math.min(1, currentScroll + 0.08));

      const parallaxX = targetMouse.x * 2.5;
      const parallaxY = targetMouse.y * 1.8;

      camera.position.x += (targetPos.x + parallaxX - camera.position.x) * 0.08;
      camera.position.y += (targetPos.y + parallaxY - camera.position.y) * 0.08;
      camera.position.z += (targetPos.z - camera.position.z) * 0.08;

      camera.lookAt(lookAtPos.x, lookAtPos.y, lookAtPos.z);

      // Raycasting for Monolith Hover & Audio Ticks
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(monolithMeshes.map((x) => x.mesh));
      let currentHit: MonolithData | null = null;

      monolithMeshes.forEach(({ group, mesh, ringMesh, data, shaderMat }) => {
        mesh.rotation.y += data.rotationSpeed;
        mesh.rotation.x = Math.sin(time * 0.6 + data.position[2]) * 0.12;

        if (ringMesh) {
          ringMesh.rotation.z += 0.012;
        }

        shaderMat.uniforms.uTime.value = time;

        const isIntersected =
          intersects.length > 0 &&
          (intersects[0].object as any).__monolithData?.id === data.id;

        if (isIntersected) {
          currentHit = data;
          group.scale.lerp(new THREE.Vector3(1.15, 1.15, 1.15), 0.12);
          shaderMat.uniforms.uScanProgress.value = (time * 1.8) % 1.0;
        } else {
          group.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.08);
          shaderMat.uniforms.uScanProgress.value = 0.0;
        }
      });

      if (currentHit !== hoveredMonolith) {
        if (currentHit) {
          soundEngine.playHoverTick();
        }
        setHoveredMonolith(currentHit);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(bootInterval);
      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
      gridGeo.dispose();
      gridMat.dispose();
      bodyUnitGeo.dispose();
      wickUnitGeo.dispose();
      volUnitGeo.dispose();
      bullBodyMat.dispose();
      bearBodyMat.dispose();
      bullWickMat.dispose();
      bearWickMat.dispose();
      volMat.dispose();
      tubeGeo.dispose();
      tubeMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [isBooted]);

  // Keep scrollProgress updated on container instance
  useEffect(() => {
    if (mountRef.current) {
      (mountRef.current as any).__scrollProgress = scrollProgress;
      soundEngine.updateAmbientDepth(scrollProgress);
    }
  }, [scrollProgress]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Real-Time Technical Intro Sequence Overlay (0s - 2.0s) */}
      {!isBooted && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#04060c] backdrop-blur-2xl transition-opacity duration-700">
          <div className="text-center space-y-4 max-w-md px-6">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(125,249,255,0.4)] text-cyan-300 font-mono font-black text-xl animate-pulse">
              ⚡
            </div>

            <div>
              <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                SYS.INIT // DISCIPLINE-FIRST SUPERAPP
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
                CRYOGENIC QUANT // CALIBRATING
              </h2>
            </div>

            {/* Calibration Progress Bar */}
            <div className="space-y-1.5 font-mono">
              <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-75 shadow-[0_0_12px_#7df9ff]"
                  style={{ width: `${bootProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>RISK ENGINE ONLINE</span>
                <span className="text-cyan-300 font-bold">{bootProgress}%</span>
              </div>
            </div>

            <p className="text-[11px] font-mono text-slate-500">
              Mounting 3D Candlestick Streams • Arming Guardrails • Initializing Sound Engine
            </p>
          </div>
        </div>
      )}

      {/* Floating 3D Hover Telemetry HUD Callout */}
      {hoveredMonolith && isBooted && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-slate-950/90 backdrop-blur-xl border border-cyan-400/40 rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(125,249,255,0.25)] max-w-md w-[90%] text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="text-[10px] font-mono font-bold text-cyan-400 tracking-widest uppercase">
            CLICK TO INSPECT MODULE
          </div>
          <h4 className="text-base font-extrabold text-white mt-0.5 tracking-tight">
            {hoveredMonolith.title}
          </h4>
          <p className="text-xs text-slate-300 font-mono mt-1">
            {hoveredMonolith.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-2.5 border-t border-white/10 text-[11px] font-mono text-slate-400">
            {hoveredMonolith.specs.map((s, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-200">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Three.js WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 cursor-default" />
    </div>
  );
};
