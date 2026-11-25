import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  intensity?: number;
}

export const ThreeBackground: React.FC<ThreeBackgroundProps> = ({ intensity = 1.0 }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050811, 0.002);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      1,
      1000
    );
    camera.position.set(0, 75, 160);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Dynamic 3D Particle Grid Wave (Quant Matrix)
    const SEPARATION = 12;
    const AMOUNTX = 65;
    const AMOUNTY = 65;
    const numParticles = AMOUNTX * AMOUNTY;

    const positions = new Float32Array(numParticles * 3);
    const scales = new Float32Array(numParticles);
    const colors = new Float32Array(numParticles * 3);

    const color1 = new THREE.Color(0x0284c7); // Deep Sky Blue
    const color2 = new THREE.Color(0x38bdf8); // Cyan Glow
    const color3 = new THREE.Color(0x10b981); // Emerald Bullish Accent

    let i = 0, j = 0;
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        positions[i] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
        positions[i + 1] = 0; // y
        positions[i + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

        scales[j] = 1.5;

        // Gradient coloring
        const ratio = (ix + iy) / (AMOUNTX + AMOUNTY);
        const col = ratio < 0.6 ? color1.clone().lerp(color2, ratio) : color2.clone().lerp(color3, (ratio - 0.6) * 2.5);
        colors[i] = col.r;
        colors[i + 1] = col.g;
        colors[i + 2] = col.b;

        i += 3;
        j++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Material
    const material = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Glowing Geometric Quant Ring (Wireframe Icosahedron in horizon)
    const ringGeo = new THREE.IcosahedronGeometry(45, 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 30, -120);
    scene.add(ringMesh);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    const onPointerMove = (event: MouseEvent) => {
      mouseX = (event.clientX - windowHalfX) * 0.15;
      mouseY = (event.clientY - windowHalfY) * 0.15;
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });

    // Window Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let count = 0;
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Smooth camera follow
      targetX += (mouseX - targetX) * 0.03;
      targetY += (mouseY - targetY) * 0.03;
      camera.position.x = targetX;
      camera.position.y = 75 - targetY * 0.5;
      camera.lookAt(0, 0, 0);

      // Rotate horizon mesh
      ringMesh.rotation.x += 0.002;
      ringMesh.rotation.y += 0.003;

      // Animate 3D sine/cosine wave
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      let idx = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          posArray[idx + 1] =
            Math.sin((ix + count) * 0.3) * 12 * intensity +
            Math.sin((iy + count) * 0.5) * 12 * intensity;
          idx += 3;
        }
      }

      posAttr.needsUpdate = true;
      count += 0.04;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, [intensity]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-60"
      style={{
        maskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, black 50%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, black 50%, transparent 100%)',
      }}
    />
  );
};
