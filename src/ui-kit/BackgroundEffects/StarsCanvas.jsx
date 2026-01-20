import { useRef, useEffect } from 'react';

const MIN_FPS_THRESHOLD = 15;
const BENCHMARK_DURATION_MS = 1000;

// Vertex shader - replicates Three.js PointsMaterial with sizeAttenuation
const vertexShaderSource = `
  attribute vec3 aPosition;
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  uniform float uPointSize;
  uniform float uPixelRatio;
  
  void main() {
    vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * mvPosition;
    
    // Size attenuation: size decreases with distance (matches Three.js sizeAttenuation: true)
    // Three.js uses: size * (scale / -mvPosition.z) where scale is related to canvas height
    // For a canvas height of ~900px at 75deg FOV, scale ≈ 450
    float scale = 450.0 * uPixelRatio;
    gl_PointSize = uPointSize * (scale / -mvPosition.z);
  }
`;

// Fragment shader - circular points with smooth edges
const fragmentShaderSource = `
  precision mediump float;
  uniform vec3 uColor;
  
  void main() {
    // Create circular points (discard corners to make circles)
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Smooth edge for anti-aliasing
    float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(uColor, alpha);
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

// Create a 4x4 identity matrix
const createIdentityMatrix = () => {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
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

// Parse hex color to RGB (0-1 range)
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ]
    : [1, 1, 1];
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
    const uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    const uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    const uPointSize = gl.getUniformLocation(program, 'uPointSize');
    const uPixelRatio = gl.getUniformLocation(program, 'uPixelRatio');
    const uColor = gl.getUniformLocation(program, 'uColor');

    // Generate points
    const positions = generateSpherePoints(1000, 1.2);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Setup attribute
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

    // Set static uniforms
    const color = hexToRgb('#f272c8');
    gl.uniform3fv(uColor, color);

    // Point size: Three.js uses 0.002 which is in world units
    // With our scale factor of 450 and camera at z=1, this translates to screen pixels
    gl.uniform1f(uPointSize, 0.004);
    gl.uniform1f(uPixelRatio, 1); // Fixed DPR for performance (matches Three.js dpr={1})

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

      // Points rotation (matches Three.js: rotation.x and rotation.y on the points object)
      const rotationX = createRotationXMatrix(-timeRef.current / 10);
      const rotationY = createRotationYMatrix(-timeRef.current / 15);

      // Combine transformations: view * groupRotation * pointsRotation
      // Order matters: first rotate points, then apply group rotation, then view
      let modelViewMatrix = multiplyMatrices(rotationY, rotationX); // Points rotation
      modelViewMatrix = multiplyMatrices(groupRotationZ, modelViewMatrix); // Group rotation
      modelViewMatrix = multiplyMatrices(viewMatrix, modelViewMatrix); // View/camera

      gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);

      // Clear and draw
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, 1000);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      gl.deleteBuffer(positionBuffer);
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
