import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

export const ThreeCandlestickBackground: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Atmospheric Fog Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04060b, 0.008);

    const camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      1,
      600
    );
    camera.position.set(0, 14, 52);
    camera.lookAt(0, 4, -20);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. High-Tech Cyber-Trading Lighting
    const ambientLight = new THREE.AmbientLight(0x0b1324, 1.8);
    scene.add(ambientLight);

    const cyanSpot = new THREE.PointLight(0x38bdf8, 3.5, 120);
    cyanSpot.position.set(20, 35, 25);
    scene.add(cyanSpot);

    const emeraldSpot = new THREE.PointLight(0x00f5a0, 3.0, 110);
    emeraldSpot.position.set(-40, 20, 5);
    scene.add(emeraldSpot);

    const crimsonSpot = new THREE.PointLight(0xff3366, 3.0, 110);
    crimsonSpot.position.set(40, 15, -25);
    scene.add(crimsonSpot);

    // 3. High-Tech 3D Perspective Floor Grid
    const gridHelper = new THREE.GridHelper(240, 60, 0x0284c7, 0x0f1d33);
    gridHelper.position.y = -14;
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.45;
    scene.add(gridHelper);

    // 4. Vibrant Neon Trading Materials (Bull = Emerald Neon, Bear = Crimson Razor)
    const bullColor = new THREE.Color(0x00f5a0);
    const bearColor = new THREE.Color(0xff3366);

    const bullBodyMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      emissive: bullColor,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9,
    });

    const bearBodyMat = new THREE.MeshStandardMaterial({
      color: 0xbe123c,
      emissive: bearColor,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9,
    });

    const bullWickMat = new THREE.MeshBasicMaterial({
      color: 0x00f5a0,
    });

    const bearWickMat = new THREE.MeshBasicMaterial({
      color: 0xff3366,
    });

    const volMaterial = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.35,
      roughness: 0.4,
    });

    // 5. Shared Unit Geometries (Height = 1.0 for accurate Three.js scale.y dynamic scaling)
    const candleWidth = 1.8;
    const candleDepth = 1.8;
    const bodyUnitGeo = new THREE.BoxGeometry(candleWidth, 1.0, candleDepth);
    const wickUnitGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
    const volUnitGeo = new THREE.BoxGeometry(candleWidth * 0.9, 1.0, candleDepth * 1.5);

    // 6. Generate 3D Candlestick Streams Across 4 Depth Lanes
    const candles3D: Candle3DData[] = [];
    const LANES = [
      { z: 5, baseY: 8, count: 26, speed: 0.085, scale: 1.15 },
      { z: -20, baseY: 4, count: 30, speed: 0.065, scale: 0.95 },
      { z: -45, baseY: -1, count: 34, speed: 0.045, scale: 0.8 },
      { z: -70, baseY: 11, count: 28, speed: 0.03, scale: 0.65 },
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

        // Body Mesh (Unit Box scaled along Y)
        const bodyMesh = new THREE.Mesh(bodyUnitGeo, isUp ? bullBodyMat : bearBodyMat);
        bodyMesh.scale.set(1, bodyHeight, 1);
        group.add(bodyMesh);

        // Wick Mesh (Unit Cylinder scaled along Y)
        const wickMesh = new THREE.Mesh(wickUnitGeo, isUp ? bullWickMat : bearWickMat);
        wickMesh.scale.set(1, wickHeight, 1);
        group.add(wickMesh);

        // Volume Pedestal Mesh (Unit Box scaled along Y)
        const volMesh = new THREE.Mesh(volUnitGeo, volMaterial);
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

    // 7. Undulating 3D Exponential Moving Average (EMA Ribbon)
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i < 40; i++) {
      const u = (i / 40) * 160 - 80;
      curvePoints.push(new THREE.Vector3(u, Math.sin(i * 0.35) * 5 + 6, -10));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.22, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tubeMesh);

    // 8. Glowing Floating Liquidity Dust Particles (1,200 Particles)
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 180;
      particlePositions[i * 3 + 1] = Math.random() * 35 - 10;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 100 - 20;
      particleSpeeds[i] = Math.random() * 0.05 + 0.02;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.65,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 9. Smooth Mouse Parallax Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onPointerMove = (e: MouseEvent) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.025;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.02;
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onResize);

    // 10. High-Performance 60FPS Smooth Motion Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth camera interpolation with mouse parallax
      targetX += (mouseX - targetX) * 0.04;
      targetY += (mouseY - targetY) * 0.04;

      camera.position.x = targetX;
      camera.position.y = 14 - targetY;
      camera.lookAt(targetX * 0.4, 4, -20);

      // Undulate Trend Ribbon gently
      tubeMesh.rotation.z = Math.sin(time * 0.4) * 0.025;
      tubeMesh.position.y = Math.sin(time * 0.8) * 0.6;

      // Drift floating liquidity particles
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] -= particleSpeeds[i];
        if (positions[i * 3] < -90) {
          positions[i * 3] = 90;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Smooth Motion Movement for 3D Candlesticks
      candles3D.forEach((c) => {
        // Continuous smooth horizontal drift
        c.x -= c.speed;

        // Gentle organic breathing wave
        const waveY = Math.sin(time * 1.4 + c.phase) * 0.35;
        c.group.position.x = c.x;
        c.group.position.y = c.y + waveY;

        // Micro 3D tilt
        c.group.rotation.y = Math.sin(time * 0.7 + c.phase) * 0.1;

        // Wrap around when candle moves past the left boundary
        const laneBounds = LANES[c.lane];
        const span = laneBounds.count * 4.2 * laneBounds.scale;
        const minX = -(span / 2) - 8;
        const maxX = span / 2 + 8;

        if (c.x < minX) {
          c.x = maxX;

          // Evolve price realistically
          const step = (Math.random() - 0.48) * 5.2;
          c.open = c.close;
          c.close = c.open + step;
          c.high = Math.max(c.open, c.close) + Math.random() * 2.8 + 0.6;
          c.low = Math.min(c.open, c.close) - (Math.random() * 2.8 + 0.6);
          c.isUp = c.close >= c.open;
          c.y = (c.open + c.close) / 2;

          // Re-scale body & wick without distortion
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

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
      gridHelper.dispose();
      bodyUnitGeo.dispose();
      wickUnitGeo.dispose();
      volUnitGeo.dispose();
      bullBodyMat.dispose();
      bearBodyMat.dispose();
      bullWickMat.dispose();
      bearWickMat.dispose();
      volMaterial.dispose();
      tubeGeo.dispose();
      tubeMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      style={{
        opacity: 0.95,
      }}
    />
  );
};
