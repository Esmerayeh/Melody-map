import * as THREE from 'three'
import { extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'

const plasmaVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vLocalPosition = position;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const plasmaFragmentShader = `
  uniform float uTime;
  uniform float uPulse;
  uniform float uStateMix;
  uniform vec3 uCoreColor;
  uniform vec3 uAuraColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uShadowColor;
  uniform float uNoiseScale;
  uniform float uNoiseSpeed;
  uniform float uFocusIntensity;
  uniform float uDegradedFactor;
  uniform float uDuality;
  uniform float uCoreGlow;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.52;
    }
    return value;
  }

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.4);
    float depthMask = smoothstep(1.04, 0.1, length(vLocalPosition));

    vec3 flow = vLocalPosition * uNoiseScale;
    flow += vec3(uTime * uNoiseSpeed * 0.12, -uTime * uNoiseSpeed * 0.09, uTime * uNoiseSpeed * 0.06);
    flow.xy += vec2(sin(uTime * 0.11 + vLocalPosition.z * 2.0), cos(uTime * 0.09 + vLocalPosition.x * 2.2)) * (0.1 + uStateMix * 0.07);

    // Layered FBM = drifting dust. Soft, hazy, no hard surface.
    float primary = fbm(flow);
    float secondary = fbm(flow * (1.64 + uDuality * 0.35) + vec3(2.3, 0.8, -1.4));
    float tertiary = fbm(flow * 0.72 - vec3(1.6, 0.9, 2.1));
    float dust = mix(primary, secondary, 0.38 + uDuality * 0.12);
    float coherence = smoothstep(0.12 - uDegradedFactor * 0.05, 0.92, dust);
    float shadowField = smoothstep(0.1, 0.84, tertiary);

    // Radial falloff toward the surface — interior dense, edge thins to haze.
    float radius = length(vLocalPosition);
    float coreMask = smoothstep(1.0, 0.14, radius);
    float pulse = 0.68 + uPulse * 0.28;
    float energy = mix(primary * secondary, coherence, 0.58) * pulse;

    // Inner-lit heart: a warm glow that bleeds OUTWARD through the dust, its
    // reach and brightness driven by uCoreGlow (mood/brightness). This is what
    // makes the orb read as lit from within rather than a flat gradient ball.
    float innerLight = smoothstep(0.62, 0.0, radius);
    float heart = smoothstep(0.4, 0.98, energy + coreMask * 0.42 + innerLight * (0.2 + uCoreGlow * 0.5));

    // Base haze: shadow → aura through the dust field.
    vec3 color = mix(uShadowColor, uAuraColor, smoothstep(0.04, 0.86, energy + depthMask * 0.2));
    // Dust pockets carve soft shadow so it never reads as a solid sphere.
    color = mix(color, uShadowColor, shadowField * (0.34 + uDegradedFactor * 0.18));
    // Warm core bleeds through.
    color = mix(color, uCoreColor, heart * (0.6 + uFocusIntensity * 0.18));
    // Inner light glow added on top — strongest at the heart, fading outward.
    color += uCoreColor * innerLight * (0.18 + uCoreGlow * 0.5) * (0.6 + uPulse * 0.4);
    color += uAuraColor * innerLight * uCoreGlow * 0.16;
    // Soft rim atmosphere (fresnel) — gentle, never a hard ring.
    color = mix(color, uEdgeColor, fresnel * (0.06 + uFocusIntensity * 0.12));

    // Hazier alpha: thicker in the lit interior, thinning to a soft edge so the
    // orb reads as volumetric dust with no crisp silhouette.
    float density = mix(0.18, 0.66, coherence);
    float alpha = density * (0.42 + coreMask * 0.3 + innerLight * 0.22 + depthMask * 0.08) * (1.0 - uDegradedFactor * 0.2);
    gl_FragColor = vec4(color, alpha);
  }
`

const shellVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const shellFragmentShader = `
  uniform float uTime;
  uniform float uPulse;
  uniform vec3 uShellColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uShadowColor;
  uniform float uOpacity;
  uniform float uFocusIntensity;
  uniform float uDegradedFactor;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.3);
    float sheen = 0.5 + 0.5 * sin(uTime * 0.13 + vWorldPosition.y * 1.6 + vWorldPosition.x * 1.1);
    float rim = smoothstep(0.24, 0.98, fresnel);
    vec3 base = mix(uShadowColor, uShellColor, 0.42 + sheen * 0.12);
    vec3 color = mix(base, uEdgeColor, rim * (0.16 + uFocusIntensity * 0.12));
    float alpha = (uOpacity + rim * 0.18 + uPulse * 0.03) * (1.0 - uDegradedFactor * 0.18);
    gl_FragColor = vec4(color, alpha);
  }
`

export const SoulOrbPlasmaMaterial = shaderMaterial(
  {
    uTime: 0,
    uPulse: 0.5,
    uStateMix: 0.5,
    // Warm filmic defaults — NEVER purple. Real signal overrides these every
    // frame; these only show for the first paint before data resolves.
    uCoreColor: new THREE.Color('#ffba93'),
    uAuraColor: new THREE.Color('#ffd0a8'),
    uEdgeColor: new THREE.Color('#fff0dc'),
    uShadowColor: new THREE.Color('#1a1008'),
    uNoiseScale: 2.2,
    uNoiseSpeed: 0.32,
    uFocusIntensity: 0.5,
    uDegradedFactor: 0,
    uDuality: 0,
    uCoreGlow: 0.5,
  },
  plasmaVertexShader,
  plasmaFragmentShader,
)

export const SoulOrbShellMaterial = shaderMaterial(
  {
    uTime: 0,
    uPulse: 0.5,
    uShellColor: new THREE.Color('#ffc69b'),
    uEdgeColor: new THREE.Color('#fff3e2'),
    uShadowColor: new THREE.Color('#160d07'),
    uOpacity: 0.28,
    uFocusIntensity: 0.5,
    uDegradedFactor: 0,
  },
  shellVertexShader,
  shellFragmentShader,
)

extend({ SoulOrbPlasmaMaterial, SoulOrbShellMaterial })
