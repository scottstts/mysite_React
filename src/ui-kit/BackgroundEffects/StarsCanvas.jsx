import { useRef, useEffect } from 'react';

const MIN_FPS_THRESHOLD = 15;
const BENCHMARK_DURATION_MS = 1000;


// Vertex shader - passes per-petal random seed for shape/color variation
const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute float aSeed;
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  uniform float uPointSize;
  uniform float uPixelRatio;
  uniform float uTime;
  varying float vSeed;

  void main() {
    vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * mvPosition;
    vSeed = aSeed;

    float scale = 450.0 * uPixelRatio;
    // Wider size range for organic variety
    float sizeVariation = 0.6 + 0.8 * fract(aSeed * 7.31);
    gl_PointSize = uPointSize * sizeVariation * (scale / -mvPosition.z);
  }
`;

// Fragment shader - cherry blossom petals with 4 shape variants
const fragmentShaderSource = `
  precision mediump float;
  uniform float uTime;
  varying float vSeed;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);

    // Per-petal fixed rotation (spread across full 360) + slow drift
    float baseAngle = fract(vSeed * 47.13) * 6.2831;
    float drift = uTime * (0.15 + fract(vSeed * 2.71) * 0.25);
    float angle = baseAngle + drift;
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 ruv = vec2(ca * uv.x - sa * uv.y, sa * uv.x + ca * uv.y);

    // Slight asymmetry per petal
    float skew = 0.2 * (fract(vSeed * 11.3) - 0.5);
    ruv.x += skew * ruv.y;

    // Select shape variant (4 types based on seed)
    float shapeSelect = fract(vSeed * 29.7);
    float petal = 0.0;
    float d = 0.0;
    vec2 p;

    if (shapeSelect < 0.3) {
      // Shape A: Wide rounded petal (broad, almost circular with taper)
      p = vec2(ruv.x * 2.2, ruv.y * 2.0 - 0.02);
      float wm = 1.0 - 0.4 * smoothstep(-0.4, 0.5, p.y);
      float dx = p.x / wm;
      d = dx * dx + p.y * p.y;
      petal = 1.0 - smoothstep(0.18, 0.26, d);
      // Soft rounded tip notch
      float notch = smoothstep(0.0, 0.04, abs(p.x)) + smoothstep(0.35, 0.5, p.y);
      petal *= clamp(notch, 0.0, 1.0);

    } else if (shapeSelect < 0.55) {
      // Shape B: Narrow elongated petal (slender, pointed)
      p = vec2(ruv.x * 3.5, ruv.y * 1.6 - 0.03);
      float wm = 1.0 - 0.7 * smoothstep(-0.5, 0.4, p.y);
      float dx = p.x / wm;
      d = dx * dx + p.y * p.y;
      petal = 1.0 - smoothstep(0.14, 0.20, d);

    } else if (shapeSelect < 0.8) {
      // Shape C: Heart-tipped petal (classic sakura with visible notch)
      p = vec2(ruv.x * 2.6, ruv.y * 1.8 - 0.04);
      float wm = 1.0 - 0.55 * smoothstep(-0.5, 0.45, p.y);
      float dx = p.x / wm;
      d = dx * dx + p.y * p.y;
      petal = 1.0 - smoothstep(0.16, 0.23, d);
      // Deeper notch at tip
      float notch = smoothstep(0.0, 0.06, abs(p.x)) + smoothstep(0.25, 0.42, p.y);
      petal *= clamp(notch, 0.0, 1.0);

    } else {
      // Shape D: Curled petal (slightly off-center, organic)
      vec2 curled = ruv;
      curled.x += 0.04 * sin(ruv.y * 8.0);
      p = vec2(curled.x * 2.8, curled.y * 1.9 - 0.03);
      float wm = 1.0 - 0.5 * smoothstep(-0.45, 0.5, p.y);
      float dx = p.x / wm;
      d = dx * dx + p.y * p.y;
      petal = 1.0 - smoothstep(0.15, 0.22, d);
      float notch = smoothstep(0.0, 0.035, abs(p.x)) + smoothstep(0.32, 0.48, p.y);
      petal *= clamp(notch, 0.0, 1.0);
    }

    // Center vein highlight
    float vein = exp(-abs(p.x) * 25.0) * 0.2 * petal;

    float alpha = petal * 0.85;
    if (alpha < 0.02) discard;

    // Vibrant saturated pink palette
    vec3 hotPink = vec3(1.0, 0.25, 0.55);
    vec3 magenta = vec3(0.95, 0.30, 0.65);
    vec3 rosePink = vec3(1.0, 0.42, 0.62);
    vec3 sakuraPink = vec3(1.0, 0.55, 0.72);
    vec3 brightBlush = vec3(1.0, 0.65, 0.78);

    float colorPick = fract(vSeed * 13.37);
    vec3 petalColor;
    if (colorPick < 0.25) {
      petalColor = mix(hotPink, rosePink, fract(vSeed * 3.7));
    } else if (colorPick < 0.5) {
      petalColor = mix(magenta, sakuraPink, fract(vSeed * 5.1));
    } else if (colorPick < 0.75) {
      petalColor = mix(rosePink, brightBlush, fract(vSeed * 9.3));
    } else {
      petalColor = mix(sakuraPink, rosePink, fract(vSeed * 7.7));
    }

    // Edge-to-center gradient: edges deeper, center brighter
    float edgeFade = smoothstep(0.04, 0.2, d);
    petalColor = mix(petalColor + 0.08, petalColor * 0.88, edgeFade * 0.5);

    // Vein highlight (lighter streak)
    petalColor += vec3(vein);

    gl_FragColor = vec4(petalColor, alpha);
  }
`;

// Generate random points uniformly distributed inside a sphere
const generateSpherePoints = (count, radius) => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * Math.cbrt(Math.random());

    const i3 = i * 3;
    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);
  }
  return positions;
};

// Create a perspective projection matrix (matches Three.js PerspectiveCamera)
const createPerspectiveMatrix = (fovDegrees, aspect, near, far) => {
  const fovRad = (fovDegrees * Math.PI) / 180;
  const f = 1.0 / Math.tan(fovRad / 2);
  const rangeInv = 1.0 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
};

// Multiply two 4x4 matrices
const multiplyMatrices = (a, b) => {
  const result = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row + k * 4] * b[k + col * 4];
      }
      result[row + col * 4] = sum;
    }
  }
  return result;
};

// Create rotation matrix around X axis
const createRotationXMatrix = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
};

// Create rotation matrix around Y axis
const createRotationYMatrix = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
};

// Create rotation matrix around Z axis
const createRotationZMatrix = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
};

// Create translation matrix
const createTranslationMatrix = (x, y, z) => {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
};

// Compile a shader
const compileShader = (gl, source, type) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

// Create shader program
const createProgram = (gl, vertexSource, fragmentSource) => {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }

  // Clean up individual shaders
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
};


const StarsCanvas = ({ onBenchmarkComplete }) => {
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const timeRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Store callback in ref to avoid re-running effect when it changes
  const onBenchmarkCompleteRef = useRef(onBenchmarkComplete);
  onBenchmarkCompleteRef.current = onBenchmarkComplete;

  // Benchmark state
  const benchmarkRef = useRef({
    isRunning: true,
    startTime: null,
    frameCount: 0,
    completed: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get WebGL context
    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
    });

    if (!gl) {
      console.error('WebGL not supported');
      onBenchmarkCompleteRef.current(false);
      return;
    }
    glRef.current = gl;

    // Create shader program
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) {
      onBenchmarkCompleteRef.current(false);
      return;
    }
    programRef.current = program;
    gl.useProgram(program);

    // Get attribute and uniform locations
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aSeed = gl.getAttribLocation(program, 'aSeed');
    const uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    const uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    const uPointSize = gl.getUniformLocation(program, 'uPointSize');
    const uPixelRatio = gl.getUniformLocation(program, 'uPixelRatio');
    const uTime = gl.getUniformLocation(program, 'uTime');

    // Generate points
    const PETAL_COUNT = 800;
    const positions = generateSpherePoints(PETAL_COUNT, 1.2);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Setup position attribute
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

    // Per-petal random seed attribute (for shape/color variation)
    const seeds = new Float32Array(PETAL_COUNT);
    for (let i = 0; i < PETAL_COUNT; i++) {
      seeds[i] = Math.random();
    }
    const seedBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 0, 0);

    // Set static uniforms — larger point size for visible petal shapes
    gl.uniform1f(uPointSize, 0.02);
    gl.uniform1f(uPixelRatio, 1);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Resize handler
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);

      // Update projection matrix (75 degree FOV, matching Three.js default)
      const projectionMatrix = createPerspectiveMatrix(75, width / height, 0.1, 1000);
      gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
    };
    resize();
    window.addEventListener('resize', resize);

    // Camera position: [0, 0, 1] - we need view matrix that translates by -1 on Z
    const viewMatrix = createTranslationMatrix(0, 0, -1);

    // Group rotation: rotate 45 degrees (PI/4) on Z axis
    const groupRotationZ = createRotationZMatrix(Math.PI / 4);

    // Animation loop
    const animate = (currentTime) => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Calculate delta
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }
      const delta = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Run benchmark for first second
      const benchmark = benchmarkRef.current;
      if (benchmark.isRunning && !benchmark.completed) {
        if (benchmark.startTime === null) {
          benchmark.startTime = performance.now();
        }

        benchmark.frameCount++;
        const elapsed = performance.now() - benchmark.startTime;

        if (elapsed >= BENCHMARK_DURATION_MS) {
          benchmark.isRunning = false;
          benchmark.completed = true;
          const fps = (benchmark.frameCount / elapsed) * 1000;
          onBenchmarkCompleteRef.current(fps >= MIN_FPS_THRESHOLD);
        }
      }

      // Update time
      timeRef.current += delta;

      // Points rotation
      const rotationX = createRotationXMatrix(-timeRef.current / 10);
      const rotationY = createRotationYMatrix(-timeRef.current / 15);

      // Combine transformations: view * groupRotation * pointsRotation
      let modelViewMatrix = multiplyMatrices(rotationY, rotationX);
      modelViewMatrix = multiplyMatrices(groupRotationZ, modelViewMatrix);
      modelViewMatrix = multiplyMatrices(viewMatrix, modelViewMatrix);

      gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);
      gl.uniform1f(uTime, timeRef.current);

      // Clear and draw
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, PETAL_COUNT);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(seedBuffer);
      gl.deleteProgram(program);
    };
  }, []); // Empty deps - setup runs once, callback accessed via ref

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        display: 'block',
      }}
    />
  );
};

export default StarsCanvas;
