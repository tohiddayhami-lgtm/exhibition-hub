import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Helper } from '@react-three/drei';
import * as THREE from 'three';
import { Hall, Booth } from '../types';
import { Award, Eye, UserCheck, Star, HelpCircle } from 'lucide-react';

interface ExhibitionCanvasProps {
  hall: Hall;
  booths: Booth[];
  activeBoothId: string | null;
  onSelectBooth: (booth: Booth) => void;
  visitorPos: [number, number, number];
  setVisitorPos: (pos: [number, number, number]) => void;
}

// Safely attempts to load a custom GLB/GLTF model. If it fails or is loading, shows a sleek placeholder.
function GLTFModelLoader({ url, scale = 1 }: { url: string; scale?: number }) {
  try {
    const { scene } = useGLTF(url);
    // Auto center and scale model
    return (
      <primitive 
        object={scene.clone()} 
        scale={[scale, scale, scale]} 
        position={[0, 0.4, 0]}
      />
    );
  } catch (error) {
    console.error("Failed loading model", error);
    return <PlaceholderProductStyle themeColor="#777" />;
  }
}

// Fallback visual showpieces to enrich empty booths style-by-style
function PlaceholderProductStyle({ themeColor, style }: { themeColor?: string, style?: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.7;
    }
  });

  if (style === 'futuristic') {
    return (
      <group position={[0, 0.8, 0]}>
        <mesh ref={meshRef}>
          <octahedronGeometry args={[0.4, 1]} />
          <meshStandardMaterial color={themeColor || "#fff"} roughness={0.1} metalness={0.9} emissive={themeColor || "#fff"} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.5, 0.6, 0.2, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
        </mesh>
      </group>
    );
  } else if (style === 'modern') {
    return (
      <group position={[0, 0.8, 0]}>
        <mesh ref={meshRef}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color={themeColor || "#fff"} roughness={0.2} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.5, 0.6, 0.2, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
        </mesh>
      </group>
    );
  } else {
    return (
      <group position={[0, 0.8, 0]}>
        <mesh ref={meshRef}>
          <torusGeometry args={[0.35, 0.12, 16, 64]} />
          <meshStandardMaterial color={themeColor || "#fff"} roughness={0.15} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.5, 0.6, 0.2, 16]} />
          <meshStandardMaterial color="#2c2c2c" roughness={0.4} />
        </mesh>
      </group>
    );
  }
}

// Concrete floor layout exhibiting clean tile patterns
function GroundPlane({ hall, onFloorClick, teleportTarget }: { 
  hall: Hall; 
  onFloorClick: (point: THREE.Vector3) => void;
  teleportTarget: [number, number, number] | null;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(state.clock.getElapsedTime() * 6) * 0.15);
    }
  });

  return (
    <group>
      {/* Visual Tiled Ground (Polished Dark Concrete Style) */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]} 
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.point) onFloorClick(e.point);
        }}
      >
        <planeGeometry args={[hall.width + 40, hall.depth + 40]} />
        <meshStandardMaterial 
          color="#161819" 
          roughness={0.45} 
          metalness={0.2} 
        />
      </mesh>

      {/* Grid Guide Overlay for structural alignment */}
      <gridHelper 
        args={[Math.max(hall.width, hall.depth) + 12, Math.max(hall.width, hall.depth) + 12, '#353a3c', '#222526']} 
        position={[0, 0.001, 0]} 
      />

      {/* Safety Hall Border line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[hall.width, hall.depth]} />
        <meshBasicMaterial color="#1f2937" wireframe />
      </mesh>

      {/* Interactive Teleport indicator portal rings */}
      {teleportTarget && (
        <mesh 
          ref={ringRef}
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[teleportTarget[0], 0.015, teleportTarget[2]]}
        >
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// Industrial Overhead Scaffoldings and high ceiling structure support
function IndustrialCeiling({ hall }: { hall: Hall }) {
  return (
    <group>
      {/* Steel ceiling frames and beams layout */}
      <mesh position={[0, hall.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[hall.width + 10, hall.depth + 10]} />
        <meshStandardMaterial color="#2d3135" roughness={0.8} />
      </mesh>

      {/* Longitudinal scaffolding columns */}
      <mesh position={[-hall.width / 2, hall.height / 2, 0]}>
        <boxGeometry args={[0.4, hall.height, 0.4]} />
        <meshStandardMaterial color="#555" metalness={0.7} />
      </mesh>
      <mesh position={[hall.width / 2, hall.height / 2, 0]}>
        <boxGeometry args={[0.4, hall.height, 0.4]} />
        <meshStandardMaterial color="#555" metalness={0.7} />
      </mesh>

      {/* Simple lighting gantries hanging down */}
      <mesh position={[0, hall.height - 0.5, 0]}>
        <boxGeometry args={[hall.width, 0.1, 0.1]} />
        <meshStandardMaterial color="#1c1d1e" metalness={0.9} />
      </mesh>
    </group>
  );
}

// Side boundary walls resembling clean white trade fair layout drywalls
function ExhibitionWall({ hall }: { hall: Hall }) {
  return (
    <group>
      {/* Back Wall */}
      <mesh position={[0, hall.height / 2, -hall.depth / 2]}>
        <boxGeometry args={[hall.width, hall.height, 0.3]} />
        <meshStandardMaterial color="#e5e5e5" roughness={0.7} />
      </mesh>
      {/* Front Wall */}
      <mesh position={[0, hall.height / 2, hall.depth / 2]}>
        <boxGeometry args={[hall.width, hall.height, 0.3]} />
        <meshStandardMaterial color="#e5e5e5" roughness={0.7} />
      </mesh>
      {/* Left Wall */}
      <mesh position={[-hall.width / 2, hall.height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[hall.depth, hall.height, 0.3]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
      </mesh>
      {/* Right Wall */}
      <mesh position={[hall.width / 2, hall.height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[hall.depth, hall.height, 0.3]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
      </mesh>
    </group>
  );
}

// Individual realistic interactive trade fair booth model
function BoothStructure({ 
  booth, 
  active, 
  onSelect 
}: { 
  booth: Booth; 
  active: boolean; 
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered]);

  const cornerRadius = 0.15;
  const colColor = booth.themeColor || '#444';

  return (
    <group 
      position={[booth.posX, 0, booth.posZ]} 
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 1. SOLID FLOOR CARPET PLATFORM COMPONENT */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[booth.width, 0.04, booth.depth]} />
        <meshStandardMaterial 
          color={active ? '#1c1c1c' : '#2d3339'} 
          roughness={0.6} 
        />
      </mesh>

      {/* Carpet Border Highlights */}
      <mesh position={[0, 0.041, 0]}>
        <boxGeometry args={[booth.width + 0.04, 0.02, booth.depth + 0.04]} />
        <meshStandardMaterial 
          color={hovered || active ? colColor : '#666'} 
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* 2. EXCEEDING SOLID BACK WALL FOR COMMERCIAL SIGNBOARD */}
      <mesh position={[0, booth.height / 2, -booth.depth / 2 + 0.05]} castShadow receiveShadow>
        <boxGeometry args={[booth.width, booth.height, 0.1]} />
        <meshStandardMaterial color="#fafafa" roughness={0.8} />
      </mesh>

      {/* Backwall architectural graphic trim panel */}
      <mesh position={[0, booth.height / 2, -booth.depth / 2 + 0.11]}>
        <boxGeometry args={[booth.width * 0.9, booth.height * 0.8, 0.02]} />
        <meshStandardMaterial color={active ? '#f3f4f6' : '#eceef0'} roughness={0.9} />
      </mesh>

      {/* 3. SOLID GRAPHIC SIDE PILLARS AND POSTS */}
      <mesh position={[-booth.width / 2 + cornerRadius, booth.height / 2, booth.depth / 2 - cornerRadius]} castShadow>
        <boxGeometry args={[0.2, booth.height, 0.2]} />
        <meshStandardMaterial color={colColor} roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[booth.width / 2 - cornerRadius, booth.height / 2, booth.depth / 2 - cornerRadius]} castShadow>
        <boxGeometry args={[0.2, booth.height, 0.2]} />
        <meshStandardMaterial color={colColor} roughness={0.2} metalness={0.7} />
      </mesh>

      {/* 4. SOLID OVERHEAD TRUSS LINE */}
      <mesh position={[0, booth.height, 0]}>
        <boxGeometry args={[booth.width, 0.15, booth.depth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* 5. GENTLE BILLBOARD HEADER WITH GLASSY LOOK */}
      <group position={[0, booth.height - 0.5, booth.depth / 2 - 0.05]}>
        {/* Glass plate */}
        <mesh>
          <boxGeometry args={[booth.width * 0.8, 0.5, 0.05]} />
          <meshStandardMaterial 
            color="#222" 
            roughness={0.01} 
            metalness={0.95} 
            transparent 
            opacity={0.88} 
          />
        </mesh>
        
        {/* Signboard front thin trim */}
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[booth.width * 0.82, 0.04, 0.01]} />
          <meshStandardMaterial color={colColor} emissive={colColor} emissiveIntensity={0.1} />
        </mesh>

        {/* Dynamic Overhead Signboard HTML Render */}
        <Html 
          position={[0, 0, 0.06]} 
          center 
          distanceFactor={6} 
          transform 
          occlude
        >
          <div className="flex items-center gap-3 bg-neutral-950/90 text-white px-5 py-2.5 rounded-lg border border-neutral-800 whitespace-nowrap shadow-xl">
            <span className="bg-white text-neutral-950 text-[10px] font-mono tracking-widest font-black uppercase px-2 py-0.5 rounded shadow">
              {booth.boothNumber}
            </span>
            <span className="text-sm font-sans font-extrabold tracking-tight">
              {booth.companyName}
            </span>
            {active && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            )}
          </div>
        </Html>
      </group>

      {/* 6. FRONT COMMERCIAL RECEPTION DESK / INFORMATION COUNTER */}
      <group position={[booth.width / 3.2, 0.45, booth.depth / 4.2]}>
        {/* Counter structure */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.92, 0.9, 0.5]} />
          <meshStandardMaterial color="#fafafa" roughness={0.15} />
        </mesh>
        {/* Counter custom wood trim top */}
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[1.0, 0.06, 0.58]} />
          <meshStandardMaterial color={colColor} roughness={0.1} />
        </mesh>
        {/* Small desktop sign */}
        <Html 
          position={[0, 0.65, 0.1]} 
          center 
          distanceFactor={4} 
          transform 
          occlude
        >
          <div className="bg-neutral-950 text-[8px] font-mono border border-neutral-800 text-white px-2 py-0.5 rounded opacity-90">
            INFO PARTNER
          </div>
        </Html>
      </group>

      {/* 7. DISPLAY CORE: Render custom GLB model OR Fallback stylized 3D showroom shapes */}
      <group position={[0, 0.02, 0]}>
        {booth.modelUrl ? (
          <Suspense fallback={<PlaceholderProductStyle themeColor={colColor} style={booth.stylePreset} />}>
            <GLTFModelLoader url={booth.modelUrl} scale={booth.modelScale || 1} />
          </Suspense>
        ) : (
          <PlaceholderProductStyle themeColor={colColor} style={booth.stylePreset} />
        )}
      </group>

      {/* Floating Sparkle Sign / Interaction Portal Halo */}
      <group position={[0, 1.8, 0]}>
        <Html center distanceFactor={8}>
          <button 
            id={`open-booth-trigger-${booth.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`flex items-center gap-1.5 backdrop-blur-md border px-2.5 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase transition-all shadow-xl font-bold cursor-pointer hover:scale-105 ${
              hovered || active 
                ? 'bg-white text-neutral-950 border-white' 
                : 'bg-neutral-950/80 text-neutral-300 border-neutral-700'
            }`}
          >
            <span>Exhibition Stand</span>
          </button>
        </Html>
      </group>
    </group>
  );
}

// Frame core to handle smoothly interpolating camera and controls states
function SceneCameraController({ visitorPos, teleportTarget, setTeleportTarget }: {
  visitorPos: [number, number, number];
  teleportTarget: [number, number, number] | null;
  setTeleportTarget: (pos: [number, number, number] | null) => void;
}) {
  const { camera } = useThree();

  useFrame(() => {
    // Smooth camera teleporting slide
    if (teleportTarget) {
      const dx = teleportTarget[0] - camera.position.x;
      const dz = teleportTarget[2] + 8 - camera.position.z; // spacing offset
      const dy = 5.0 - camera.position.y; // visual height spacing

      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.1) {
        camera.position.x += dx * 0.12;
        camera.position.z += dz * 0.12;
        camera.position.y += dy * 0.12;
      } else {
        camera.position.set(teleportTarget[0], 5.0, teleportTarget[2] + 8);
        setTeleportTarget(null);
      }
    }
  });

  return null;
}

export default function ExhibitionCanvas({ 
  hall, 
  booths, 
  activeBoothId, 
  onSelectBooth,
  visitorPos,
  setVisitorPos
}: ExhibitionCanvasProps) {
  const [teleportTarget, setTeleportTarget] = useState<[number, number, number] | null>(null);

  // Walk on floor click trigger
  const handleFloorClick = (point: THREE.Vector3) => {
    // Keep visitor strictly inside limits of hall margins
    const margin = 2; // bound limits
    const targetX = Math.max(-hall.width / 2 + margin, Math.min(hall.width / 2 - margin, point.x));
    const targetZ = Math.max(-hall.depth / 2 + margin, Math.min(hall.depth / 2 - margin, point.z));
    
    setTeleportTarget([targetX, 0, targetZ]);
    setVisitorPos([targetX, 0.8, targetZ]);
  };

  // Keyboard controls WASD slider
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let dx = 0;
      let dz = 0;
      const speed = 0.5;

      switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          dz = -speed;
          break;
        case 's':
        case 'arrowdown':
          dz = speed;
          break;
        case 'a':
        case 'arrowleft':
          dx = -speed;
          break;
        case 'd':
        case 'arrowright':
          dx = speed;
          break;
      }

      if (dx !== 0 || dz !== 0) {
        setVisitorPos([
          Math.max(-hall.width/2 + 2, Math.min(hall.width/2 - 2, visitorPos[0] + dx)),
          visitorPos[1],
          Math.max(-hall.depth/2 + 2, Math.min(hall.depth/2 - 2, visitorPos[2] + dz))
        ]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visitorPos, hall]);

  // Synchronize when a custom booth model selection is clicked outside or requested
  useEffect(() => {
    if (activeBoothId) {
      const activeBooth = booths.find(b => b.id === activeBoothId);
      if (activeBooth) {
        setTeleportTarget([activeBooth.posX, 0, activeBooth.posZ + 3.4]);
      }
    }
  }, [activeBoothId, booths]);

  return (
    <div id="exhibition-render-container" className="w-full h-full relative bg-neutral-950">
      <Canvas 
        shadows
        camera={{ position: [0, 8, 16], fov: 50 }}
        className="w-full h-full"
      >
        <color attach="background" args={['#0e1012']} />
        
        {/* Realistic subtle ambient exposure */}
        <ambientLight intensity={0.45} />
        
        {/* Soft simulated Hemisphere sky glow */}
        <hemisphereLight 
          color="#ffffff" 
          groundColor="#111111" 
          intensity={0.6} 
        />

        {/* Dynamic primary spotlight to generate realistic structural shadows */}
        <directionalLight
          castShadow
          position={[0, 16, 8]}
          intensity={1.1}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={40}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />

        {/* Ceiling spotlights structure */}
        <pointLight position={[-10, 8, -6]} intensity={0.8} distance={15} color="#38bdf8" />
        <pointLight position={[10, 8, -6]} intensity={0.8} distance={15} color="#38bdf8" />
        <pointLight position={[-10, 8, 6]} intensity={0.8} distance={15} color="#38bdf8" />
        <pointLight position={[10, 8, 6]} intensity={0.8} distance={15} color="#38bdf8" />

        {/* 3D Exhibition Structure Geometries */}
        <Suspense fallback={null}>
          <GroundPlane hall={hall} onFloorClick={handleFloorClick} teleportTarget={teleportTarget} />
          <IndustrialCeiling hall={hall} />
          <ExhibitionWall hall={hall} />

          {/* Symmetrical positioned trade stalls */}
          {booths.map((booth) => (
            <BoothStructure 
              key={booth.id} 
              booth={booth} 
              active={activeBoothId === booth.id} 
              onSelect={() => onSelectBooth(booth)} 
            />
          ))}
        </Suspense>

        <SceneCameraController 
          visitorPos={visitorPos} 
          teleportTarget={teleportTarget} 
          setTeleportTarget={setTeleportTarget} 
        />

        {/* Easy Orbit camera controls allowing looking around */}
        <OrbitControls 
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={28}
          maxPolarAngle={Math.PI / 2.1} // Prevent looking through floor
          target={[visitorPos[0], 1.2, visitorPos[2]]}
        />
      </Canvas>

      {/* Floating HUD keyboard navigation assistance */}
      <div className="absolute bottom-4 left-4 bg-neutral-950/90 text-neutral-300 border border-neutral-800/80 p-3 rounded-lg text-[10px] space-y-1.5 font-mono z-10 shadow-lg hidden md:block">
        <p className="font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          Virtual Controls GUIDE
        </p>
        <p className="opacity-80">🖱️ Left Click + Drag : Rotate Camera View</p>
        <p className="opacity-80">🖱️ Right Click + Drag : Pan Camera</p>
        <p className="opacity-80">📍 Click on Floor : Smooth Teleport walk</p>
        <p className="opacity-80">🎹 Keyboard WASD / Arrows : Slide position</p>
      </div>
    </div>
  );
}
