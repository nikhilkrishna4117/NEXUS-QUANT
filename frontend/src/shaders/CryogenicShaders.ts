import * as THREE from 'three';

// 1. Procedural Crystalline Frosted Ice Glass Shader
export const CrystallineIceShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x0e1726) },
    uRimColor: { value: new THREE.Color(0x7df9ff) },
    uFresnelPower: { value: 2.8 },
    uRoughness: { value: 0.25 },
    uRefractionRatio: { value: 0.98 },
    uDispersion: { value: 0.04 },
    uScanProgress: { value: 0.0 }, // Wireframe sweep
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uRimColor;
    uniform float uFresnelPower;
    uniform float uRoughness;
    uniform float uDispersion;
    uniform float uScanProgress;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    // Pseudo-random noise for frosted micro-facets
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Micro-roughness jitter
      float noise = hash(vUv * 100.0 + sin(uTime * 0.1)) * uRoughness * 0.08;
      normal = normalize(normal + vec3(noise));

      // Fresnel Rim Reflection (Glacial Crystal)
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);

      // Internal chromatic dispersion along faceted edges
      vec3 colR = uColor * (1.0 + uDispersion);
      vec3 colG = uColor;
      vec3 colB = uColor * (1.0 - uDispersion);
      vec3 baseRefract = vec3(colR.r, colG.g, colB.b);

      // Specular highlight
      vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
      vec3 halfVector = normalize(lightDir + viewDir);
      float specular = pow(max(dot(normal, halfVector), 0.0), 32.0);

      vec3 finalColor = mix(baseRefract, uRimColor, fresnel * 0.85);
      finalColor += vec3(specular * 0.6);

      // High-tech wireframe scanline sweep
      if (uScanProgress > 0.0) {
        float scanDist = abs(vUv.y - uScanProgress);
        if (scanDist < 0.04) {
          float scanIntensity = smoothstep(0.04, 0.0, scanDist);
          finalColor += uRimColor * scanIntensity * 1.8;
        }
      }

      float alpha = clamp(0.45 + fresnel * 0.5, 0.0, 0.95);
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

// 2. High-Tech Holographic Grid Floor Shader
export const CryoGridShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x1a2638) },
    uLineColor: { value: new THREE.Color(0x38bdf8) },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uLineColor;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vec2 coord = vWorldPosition.xz * 0.25;
      vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
      float line = min(grid.x, grid.y);
      float gridVal = 1.0 - min(line, 1.0);

      // Radial fog fadeout
      float dist = length(vWorldPosition.xz);
      float fade = smoothstep(75.0, 15.0, dist);

      // Subtle pulse
      float pulse = 0.8 + 0.2 * sin(uTime * 1.5 - dist * 0.1);

      vec3 col = mix(uColor, uLineColor * pulse, gridVal * 0.7);
      float alpha = (gridVal * 0.6 + 0.05) * fade;

      gl_FragColor = vec4(col, alpha);
    }
  `,
};

// 3. Cryogenic Frost-Lock Screen Glitch & Dispersion
export const FrostLockShader = {
  uniforms: {
    uFrost: { value: 0.0 }, // 0.0 (off) -> 1.0 (frozen)
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uFrost;
    uniform float uTime;
    varying vec2 vUv;

    float rand(vec2 n) {
      return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }

    void main() {
      if (uFrost <= 0.01) discard;

      vec2 uv = vUv;
      float frostNoise = rand(uv * 120.0 + sin(uTime));

      // Creeping frost crystals from borders inwards
      float borderDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float frostThreshold = uFrost * 0.45;
      float frostAlpha = smoothstep(frostThreshold, 0.0, borderDist);

      vec3 frostColor = mix(vec3(0.5, 0.85, 1.0), vec3(1.0, 0.2, 0.3), uFrost * 0.7);

      gl_FragColor = vec4(frostColor, (frostAlpha * 0.7 + frostNoise * 0.15) * uFrost);
    }
  `,
};
