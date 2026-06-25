import * as THREE from 'three'
import { extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'

const plasmaVertexShader = `
  uniform float uTime;
  uniform float uFormation;   // 0 = exploded dust cloud, 1 = condensed sphere

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec2 vScreenUV;      // screen-aligned coord (kept for reference)
  varying vec3 vLocalNormal;   // object-space normal → halftone wraps the SURFACE (3D)

  // Compact value noise (vertex-side) — only used to scatter vertices during the
  // forming process, so it is kept cheap (no FBM here).
  float vHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(vHash(i + vec3(0,0,0)), vHash(i + vec3(1,0,0)), f.x),
          mix(vHash(i + vec3(0,1,0)), vHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(vHash(i + vec3(0,0,1)), vHash(i + vec3(1,0,1)), f.x),
          mix(vHash(i + vec3(0,1,1)), vHash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocalPosition = position;
    vLocalNormal = normalize(normal);

    // ── Forming displacement ────────────────────────────────────────────────
    // At uFormation=0 the surface is blown out into a turbulent dust cloud
    // (vertices pushed along their normal + jittered by noise); it settles back
    // onto the smooth sphere as uFormation→1. This is the 3D "assembly" — the
    // orb literally coalesces out of scattered matter into a formed entity.
    // Eased so most of the visible travel happens in the back half of the form.
    float scatter = 1.0 - clamp(uFormation, 0.0, 1.0);
    scatter = scatter * scatter;                       // ease — slow, dramatic settle
    float n = vNoise(position * 3.0 + uTime * 0.25);
    vec3 jitter = vec3(
      vNoise(position * 1.7 + 11.0) - 0.5,
      vNoise(position * 1.9 + 23.0) - 0.5,
      vNoise(position * 2.1 + 31.0) - 0.5
    );
    // Swirl the cloud as it condenses (rotate the jitter about Y by formation) so
    // the dust spirals in rather than just puffing straight out → reads as forming.
    float sw = scatter * 3.0;
    float cs = cos(sw), sn = sin(sw);
    jitter.xz = mat2(cs, -sn, sn, cs) * jitter.xz;
    vec3 displaced = position
      + normal * (n - 0.25) * scatter * 1.25
      + jitter * scatter * 0.95;

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPosition.xyz;
    vec4 clip = projectionMatrix * viewMatrix * worldPosition;
    vScreenUV = clip.xy / clip.w;   // NDC −1..1 (canvas is square → no aspect fix)
    gl_Position = clip;
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
  uniform float uFormation;     // 0..1 forming progress (dust → orb)
  uniform float uHalftone;      // 0..1 strength of the printed dot-screen
  uniform float uHalftoneScale; // dot grid density across the orb

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec2 vScreenUV;
  varying vec3 vLocalNormal;

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
    // Wider reach (0.78) so the warm light fills more of the orb.
    float innerLight = smoothstep(0.78, 0.0, radius);
    float heart = smoothstep(0.3, 0.96, energy + coreMask * 0.5 + innerLight * (0.3 + uCoreGlow * 0.7));

    // Base haze: bias hard toward the warm aura (not shadow) so the core holds
    // saturated color instead of washing to grey. Shadow only at the far edge.
    vec3 color = mix(uShadowColor, uAuraColor, smoothstep(-0.1, 0.7, energy + depthMask * 0.28 + innerLight * 0.4));
    // Dust pockets carve soft shadow — reduced so it never greys the core out.
    color = mix(color, uShadowColor, shadowField * (0.24 + uDegradedFactor * 0.18) * (1.0 - innerLight * 0.6));
    // Warm core bleeds through, stronger.
    color = mix(color, uCoreColor, heart * (0.78 + uFocusIntensity * 0.16));
    // Inner light glow — kept MODEST so the orb reads as lit glass, not a glowing
    // bulb that blooms into a blob (the old high values + bloom were the blowout).
    color += uCoreColor * innerLight * (0.12 + uCoreGlow * 0.30) * (0.6 + uPulse * 0.25);
    color += uAuraColor * innerLight * uCoreGlow * 0.12;
    // Soft rim atmosphere (fresnel) — gentle, never a hard ring.
    color = mix(color, uEdgeColor, fresnel * (0.06 + uFocusIntensity * 0.12));

    // Saturation + contrast lift: pull colour off its luminance so the hue reads
    // as bold suspended pigment (reference), not faint grey haze.
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, 1.5);
    // Bolder swirl structure for the alpha/dot density (sharper than the colour
    // coherence so the dotted bands read as distinct swirls, like the reference).
    float swirl = smoothstep(0.3, 0.82, dust);

    // ── Glass focal lens ──────────────────────────────────────────────────────
    // The bright clear "bead" a real glass marble focuses near its centre (a hair
    // below middle, as in the reference). Stays smooth (no dots) and bright — this
    // is the single biggest cue that the orb is a refractive 3D sphere, not a disc.
    vec2 lensP = vLocalPosition.xy - vec2(0.0, -0.1);
    float lens = smoothstep(0.3, 0.0, length(lensP)) * coreMask;
    color += (uCoreColor * 0.6 + vec3(0.32)) * lens * (0.4 + uPulse * 0.15);

    // ── Halftone screen (wraps the SURFACE → 3D) ──────────────────────────────
    // The dot-screen is laid out in the sphere's OWN surface coordinates (from the
    // object-space normal), so the dots curve over the marble and compress toward
    // the silhouette — reading as 3D — and turn with the core like pigment
    // suspended in glass. Dot SIZE tracks local brightness (bright = filled, dim =
    // small dots). While forming, the dots "develop" small/sparse → resolved.
    float devel = mix(0.4, 1.0, clamp(uFormation, 0.0, 1.0));
    vec3 ln = normalize(vLocalNormal);
    vec2 sph = vec2(atan(ln.z, ln.x), acos(clamp(ln.y, -1.0, 1.0)));
    vec2 cell = fract(sph * uHalftoneScale * 0.5) - 0.5;
    float cellDist = length(cell);
    float fill = clamp(energy * 0.6 + heart * 0.7 + innerLight * 0.5, 0.0, 1.0);
    float dotRad = mix(0.18, 0.5, fill) * devel;
    float dotShape = smoothstep(dotRad, dotRad - 0.16, cellDist);
    // Heart + focal lens stay solid; dots only texture the cloudy regions.
    float pattern = mix(dotShape, 1.0, clamp(heart * 0.9 + lens, 0.0, 1.0));

    // Alpha: dense through the lit core, thinning to a soft hazy edge.
    float density = mix(0.34, 0.9, swirl);
    float alpha = density * (0.5 + coreMask * 0.42 + innerLight * 0.5 + lens * 0.4 + depthMask * 0.08) * (1.0 - uDegradedFactor * 0.2);
    // Dots read as BRIGHTNESS modulation (bright cores over a dimmer field) so the
    // body persists; alpha is dotted with a floor so the silhouette stays whole.
    color *= mix(1.0, 0.42 + dotShape * 1.05, uHalftone * (1.0 - max(heart * 0.6, lens)));
    alpha *= mix(1.0, 0.5 + 0.5 * pattern, uHalftone);
    // Forming: dust condenses + brightens into the finished orb.
    alpha *= 0.24 + 0.76 * clamp(uFormation, 0.0, 1.0);
    alpha = clamp(alpha, 0.0, 0.97);
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
  uniform float uFormation;   // 0..1 — shell refracts in as the orb forms

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 N = normalize(vNormal);
    float ndv = max(dot(N, V), 0.0);
    // Sharper fresnel → a clear glass envelope: nearly invisible across the facing
    // centre (so the dotted plasma reads as suspended INSIDE the glass), brightening
    // to a crisp luminous rim at the silhouette.
    float fresnel = pow(1.0 - ndv, 3.0);
    float rim = smoothstep(0.16, 0.95, fresnel);
    vec3 color = mix(uShellColor, uEdgeColor, rim);

    // Two specular glints — a tight bright key (upper-left) + a softer fill
    // (lower-right) — give the hard, rounded, refractive glass read of the ref.
    vec3 keyDir = normalize(vec3(-0.5, 0.7, 0.85));
    float spec = pow(max(dot(reflect(-V, N), keyDir), 0.0), 64.0);
    color += vec3(1.0) * spec;
    vec3 fillDir = normalize(vec3(0.45, -0.4, 0.8));
    float spec2 = pow(max(dot(reflect(-V, N), fillDir), 0.0), 26.0);
    color += uEdgeColor * spec2 * 0.5;

    // Alpha: clear through the facing centre (uOpacity kept low so plasma shows
    // through), opaque-bright at the rim + glints → a hard glass shell, not a
    // glowing fog ball.
    float alpha = uOpacity * 0.45 + rim * 0.72 + spec * 0.95 + spec2 * 0.28 + uPulse * 0.02;
    alpha *= (1.0 - uDegradedFactor * 0.18);
    alpha *= 0.2 + 0.8 * clamp(uFormation, 0.0, 1.0);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
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
    uFormation: 1,        // 1 = fully formed (the JS driver ramps 0→1 on mount)
    uHalftone: 0.9,       // printed dot-screen strength
    uHalftoneScale: 14,   // dot grid density
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
    uFormation: 1,
  },
  shellVertexShader,
  shellFragmentShader,
)

extend({ SoulOrbPlasmaMaterial, SoulOrbShellMaterial })
