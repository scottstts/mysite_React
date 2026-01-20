import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

const MIN_FPS_THRESHOLD = 15;
const BENCHMARK_DURATION_MS = 1000;

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

const StarField = ({ onBenchmarkComplete }) => {
  const pointsRef = useRef();
  const [positions] = useState(() => generateSpherePoints(1000, 1.2));
  const timeRef = useRef(0);

  // Benchmark state
  const benchmarkRef = useRef({
    isRunning: true,
    startTime: null,
    frameCount: 0,
    completed: false,
  });

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

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
        onBenchmarkComplete(fps >= MIN_FPS_THRESHOLD);
      }
    }

    // Always update rotation
    timeRef.current += delta;
    pointsRef.current.rotation.x = -timeRef.current / 10;
    pointsRef.current.rotation.y = -timeRef.current / 15;
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#f272c8"
          size={0.002}
          sizeAttenuation
          depthWrite={false}
          depthTest={false}
        />
      </points>
    </group>
  );
};

const StarsCanvas = ({ onBenchmarkComplete }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 1] }}
      dpr={1}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: false,
      }}
    >
      <StarField onBenchmarkComplete={onBenchmarkComplete} />
    </Canvas>
  );
};

export default StarsCanvas;
