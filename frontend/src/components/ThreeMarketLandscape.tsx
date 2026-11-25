import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Candle } from '../types';
import { Eye, RotateCcw, Zap } from 'lucide-react';

interface ThreeMarketLandscapeProps {
  candles: Candle[];
  symbol: string;
  height?: number;
}

export const ThreeMarketLandscape: React.FC<ThreeMarketLandscapeProps> = ({
  candles,
  symbol,
  height = 360,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !candles || candles.length === 0) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x060913, 80, 260);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / height,
      1,
      1000
    );
    camera.position.set(0, 45, 95);
    camera.lookAt(0, 10, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dirLight.position.set(30, 60, 40);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x10b981, 2.0, 100);
    pointLight.position.set(-20, 20, 10);
    scene.add(pointLight);

    // 3D Grid Floor
    const gridHelper = new THREE.GridHelper(100, 30, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Candlestick 3D Group
    const group = new THREE.Group();
    scene.add(group);

    // Sample recent 35 candles
    const sampleCandles = candles.slice(-35);
    const prices = sampleCandles.flatMap((c) => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const candleWidth = 1.6;
    const spacing = 2.4;
    const startX = -((sampleCandles.length * spacing) / 2);

    sampleCandles.forEach((c, idx) => {
      const isBull = c.close >= c.open;
      const color = isBull ? 0x10b981 : 0xf43f5e;

      // Candle body height normalized to 3D units (0 to 30)
      const openY = ((c.open - minPrice) / priceRange) * 26 + 2;
      const closeY = ((c.close - minPrice) / priceRange) * 26 + 2;
      const highY = ((c.high - minPrice) / priceRange) * 26 + 2;
      const lowY = ((c.low - minPrice) / priceRange) * 26 + 2;

      const bodyHeight = Math.max(0.4, Math.abs(closeY - openY));
      const bodyCenterY = Math.min(openY, closeY) + bodyHeight / 2;

      // 3D Box for Candle Body with rounded specular material
      const bodyGeo = new THREE.BoxGeometry(candleWidth, bodyHeight, candleWidth);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.2,
        metalness: 0.4,
        emissive: color,
        emissiveIntensity: 0.25,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.set(startX + idx * spacing, bodyCenterY, 0);
      group.add(bodyMesh);

      // 3D Cylinder for Wick
      const wickHeight = Math.max(0.6, highY - lowY);
      const wickGeo = new THREE.CylinderGeometry(0.12, 0.12, wickHeight, 8);
      const wickMat = new THREE.MeshBasicMaterial({ color: color });
      const wickMesh = new THREE.Mesh(wickGeo, wickMat);
      wickMesh.position.set(startX + idx * spacing, lowY + wickHeight / 2, 0);
      group.add(wickMesh);

      // Volume Base Pedestal (3D Depth)
      const maxVol = Math.max(...sampleCandles.map((x) => x.volume)) || 1;
      const volHeight = (c.volume / maxVol) * 6 + 0.2;
      const volGeo = new THREE.BoxGeometry(candleWidth * 0.9, volHeight, candleWidth * 2.5);
      const volMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.4,
        roughness: 0.5,
      });
      const volMesh = new THREE.Mesh(volGeo, volMat);
      volMesh.position.set(startX + idx * spacing, volHeight / 2, -4);
      group.add(volMesh);
    });

    // Mouse Drag Rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      group.rotation.y += deltaX * 0.008;
      group.rotation.x += deltaY * 0.005;
      group.rotation.x = Math.max(-0.4, Math.min(0.6, group.rotation.x));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        group.rotation.y += 0.003;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [candles, height, autoRotate]);

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-[#0a0f1d] to-[#050811] border border-blue-500/30 overflow-hidden shadow-[0_0_40px_rgba(2,132,199,0.15)] group">
      {/* 3D Controls Bar */}
      <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-2.5 py-1 rounded-md bg-blue-500/20 border border-blue-500/40 text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5 shadow-sm">
            <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
            3D VOLATILITY &amp; DEPTH MATRIX ({symbol})
          </div>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            Drag to Rotate • Scroll to Zoom
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition border flex items-center gap-1 ${
              autoRotate
                ? 'bg-blue-600/30 border-blue-500/50 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <RotateCcw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            {autoRotate ? 'Auto-Orbit: ON' : 'Orbit: Paused'}
          </button>
        </div>
      </div>

      {/* WebGL Canvas Mount */}
      <div
        ref={mountRef}
        style={{ height }}
        className="w-full cursor-grab active:cursor-grabbing select-none"
      />

      {/* Floating 3D Depth Legend */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-[11px] font-mono text-slate-400 pointer-events-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            Bullish Pillar
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            Bearish Pillar
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400/60" />
            Volume Depth Block
          </span>
        </div>
        <div className="hidden sm:block text-[10px] text-slate-500">
          Rendered via WebGL Hardware Acceleration
        </div>
      </div>
    </div>
  );
};
