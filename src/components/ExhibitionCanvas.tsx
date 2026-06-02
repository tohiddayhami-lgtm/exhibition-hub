import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, PointerLockControls, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Hall, Booth } from '../types';
import { Eye, Glasses } from 'lucide-react';

const HUMAN_EYE_HEIGHT = 1.65;
const VISITOR_BODY_HEIGHT = 0.8;
const VR_SESSION_MODE = 'immersive-vr';

type XRSessionLike = {
  end: () => Promise<void>;
  addEventListener: (type: 'end', listener: () => void) => void;
  removeEventListener: (type: 'end', listener: () => void) => void;
};

type XRSystemLike = {
  isSessionSupported: (mode: typeof VR_SESSION_MODE) => Promise<boolean>;
  requestSession: (
    mode: typeof VR_SESSION_MODE,
    options?: { optionalFeatures?: string[] }
  ) => Promise<XRSessionLike>;
};

function getNavigatorXR() {
  return (navigator as Navigator & { xr?: XRSystemLike }).xr;
}

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

// Professional exhibition floor with marble tiles and decorative borders
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
      {/* Outer floor (dark surround outside hall) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[hall.width + 40, hall.depth + 40]} />
        <meshStandardMaterial color="#1a1c1e" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Main exhibition hall floor — polished light marble */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.005, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.point) onFloorClick(e.point);
        }}
      >
        <planeGeometry args={[hall.width, hall.depth]} />
        <meshStandardMaterial
          color="#e8e4de"
          roughness={0.08}
          metalness={0.05}
          envMapIntensity={0.4}
        />
      </mesh>

      {/* Floor tile grid lines (light stone grout) */}
      <gridHelper
        args={[Math.max(hall.width, hall.depth), Math.max(hall.width, hall.depth) * 2, '#c8c4be', '#d4d0ca']}
        position={[0, 0.001, 0]}
      />

      {/* Decorative carpet runner — center aisle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <planeGeometry args={[2.5, hall.depth * 0.88]} />
        <meshStandardMaterial color="#1a2744" roughness={0.85} metalness={0} />
      </mesh>

      {/* Gold trim borders along carpet edges */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.3, 0.004, 0]}>
        <planeGeometry args={[0.08, hall.depth * 0.88]} />
        <meshStandardMaterial color="#c9a84c" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.3, 0.004, 0]}>
        <planeGeometry args={[0.08, hall.depth * 0.88]} />
        <meshStandardMaterial color="#c9a84c" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Hall border gold trim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[hall.width, hall.depth]} />
        <meshBasicMaterial color="#b09a5a" wireframe />
      </mesh>

      {/* Interactive teleport indicator portal ring */}
      {teleportTarget && (
        <mesh
          ref={ringRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[teleportTarget[0], 0.015, teleportTarget[2]]}
        >
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.9} />
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

      {/* 5. SIGNBOARD — WebGL Text so it renders inside the VR headset */}
      <group position={[0, booth.height - 0.5, booth.depth / 2 - 0.05]}>
        {/* Dark glass backing plate */}
        <mesh>
          <boxGeometry args={[booth.width * 0.85, 0.55, 0.05]} />
          <meshStandardMaterial color="#111" roughness={0.01} metalness={0.95} transparent opacity={0.9} />
        </mesh>
        {/* Colored accent trim */}
        <mesh position={[0, 0, 0.032]}>
          <boxGeometry args={[booth.width * 0.87, 0.04, 0.01]} />
          <meshStandardMaterial color={colColor} emissive={colColor} emissiveIntensity={0.4} />
        </mesh>
        {/* Booth number badge */}
        <Text
          position={[-(booth.width * 0.3), 0, 0.04]}
          fontSize={0.11}
          color={colColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor="#000"
        >
          {`[${booth.boothNumber}]`}
        </Text>
        {/* Company name */}
        <Text
          position={[booth.width * 0.08, 0, 0.04]}
          fontSize={0.13}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={booth.width * 0.55}
          outlineWidth={0.005}
          outlineColor="#000"
        >
          {booth.companyName}
        </Text>
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
        {/* Small desk sign (WebGL text) */}
        <Text
          position={[0, 0.65, 0.12]}
          fontSize={0.07}
          color="#c9a84c"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.003}
          outlineColor="#000"
        >
          INFO
        </Text>
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

      {/* Floating company name — Billboard so it always faces the visitor, visible in VR */}
      <Billboard position={[0, booth.height + 0.55, 0]}>
        {/* Background card */}
        <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <planeGeometry args={[booth.width * 0.75, 0.38]} />
          <meshStandardMaterial
            color={active ? colColor : '#111827'}
            transparent
            opacity={0.88}
            roughness={0.1}
            metalness={0.5}
          />
        </mesh>
        {/* Company name text */}
        <Text
          position={[0, 0, 0.02]}
          fontSize={0.15}
          color={active ? '#000' : 'white'}
          anchorX="center"
          anchorY="middle"
          maxWidth={booth.width * 0.7}
          outlineWidth={0.004}
          outlineColor={active ? '#fff' : '#000'}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          {booth.companyName}
        </Text>
      </Billboard>
    </group>
  );
}

// Frame core to handle smoothly interpolating camera and controls states
function SceneCameraController({ visitorPos, teleportTarget, setTeleportTarget, povEnabled }: {
  visitorPos: [number, number, number];
  teleportTarget: [number, number, number] | null;
  setTeleportTarget: (pos: [number, number, number] | null) => void;
  povEnabled: boolean;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!povEnabled) return;

    camera.position.set(visitorPos[0], HUMAN_EYE_HEIGHT, visitorPos[2]);
    camera.lookAt(visitorPos[0], HUMAN_EYE_HEIGHT, visitorPos[2] - 1);
  }, [camera, povEnabled]);

  useFrame(() => {
    // When XR headset is active, the XR system controls camera pose — don't override it
    if (gl.xr.isPresenting) return;

    if (povEnabled) {
      camera.position.set(visitorPos[0], HUMAN_EYE_HEIGHT, visitorPos[2]);
      if (teleportTarget) setTeleportTarget(null);
      return;
    }

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

// Quest 3 / WebXR controller locomotion: left stick walk, right stick snap-turn, right trigger select
function XRLocomotionController({
  hall,
  booths,
  setVisitorPos,
  onSelectBooth,
}: {
  hall: Hall;
  booths: Booth[];
  setVisitorPos: (pos: [number, number, number]) => void;
  onSelectBooth: (booth: Booth) => void;
}) {
  const { gl, camera } = useThree();
  const baseRefSpaceRef = useRef<XRReferenceSpace | null>(null);
  const playerX = useRef(0);
  const playerZ = useRef(0);
  const playerYaw = useRef(0);        // accumulated snap-turn yaw (radians)
  const snapLocked = useRef(false);   // prevent rapid repeated snaps
  const triggerWasPressed = useRef(false);

  useFrame((_, delta) => {
    if (!gl.xr.isPresenting) {
      if (baseRefSpaceRef.current) {
        baseRefSpaceRef.current = null;
        playerX.current = 0;
        playerZ.current = 0;
        playerYaw.current = 0;
      }
      return;
    }

    // Capture base reference space once per session (before any locomotion offsets)
    if (!baseRefSpaceRef.current) {
      const refSpace = gl.xr.getReferenceSpace();
      if (!refSpace) return;
      baseRefSpaceRef.current = refSpace as XRReferenceSpace;
    }

    const session = gl.xr.getSession();
    if (!session) return;

    let dx = 0;
    let dz = 0;
    const speed = 3.0 * Math.min(delta, 0.05);
    let didSnapTurn = false;
    let triggerPressed = false;

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;
      const axes = source.gamepad.axes;

      if (source.handedness === 'left') {
        // Left thumbstick → smooth locomotion relative to headset direction
        const thumbX = axes.length >= 4 ? axes[2] : 0;
        const thumbY = axes.length >= 4 ? axes[3] : 0;
        if (Math.abs(thumbX) > 0.15 || Math.abs(thumbY) > 0.15) {
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          forward.y = 0;
          if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
          forward.normalize();
          const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
          // thumbY negative = pushed forward = move forward
          dx += (forward.x * -thumbY + right.x * thumbX) * speed;
          dz += (forward.z * -thumbY + right.z * thumbX) * speed;
        }
      }

      if (source.handedness === 'right') {
        // Right thumbstick X → 45° snap turn
        const turnX = axes.length >= 4 ? axes[2] : 0;
        if (Math.abs(turnX) > 0.65 && !snapLocked.current) {
          playerYaw.current += turnX > 0 ? -Math.PI / 4 : Math.PI / 4;
          snapLocked.current = true;
          didSnapTurn = true;
        } else if (Math.abs(turnX) < 0.3) {
          snapLocked.current = false;
        }

        // Right index trigger (button index 0) → select nearest booth within reach
        const trigger = source.gamepad.buttons[0];
        if (trigger?.pressed) triggerPressed = true;
      }
    }

    // Trigger: select closest booth within 5 m
    if (triggerPressed && !triggerWasPressed.current) {
      let closest: Booth | null = null;
      let minDist = 5;
      for (const booth of booths) {
        const ddx = booth.posX - playerX.current;
        const ddz = booth.posZ - playerZ.current;
        const dist = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dist < minDist) { minDist = dist; closest = booth; }
      }
      if (closest) onSelectBooth(closest);
    }
    triggerWasPressed.current = triggerPressed;

    // Update position
    if (dx !== 0 || dz !== 0) {
      const halfW = hall.width / 2 - 2;
      const halfD = hall.depth / 2 - 2;
      playerX.current = Math.max(-halfW, Math.min(halfW, playerX.current + dx));
      playerZ.current = Math.max(-halfD, Math.min(halfD, playerZ.current + dz));
      setVisitorPos([playerX.current, VISITOR_BODY_HEIGHT, playerZ.current]);
    }

    // Apply combined position + yaw as reference space transform
    if (dx !== 0 || dz !== 0 || didSnapTurn) {
      try {
        const XRT = (window as unknown as { XRRigidTransform?: typeof XRRigidTransform }).XRRigidTransform;
        if (XRT && baseRefSpaceRef.current) {
          // Build player matrix: rotateY(yaw) then translate(px, 0, pz)
          const playerMatrix = new THREE.Matrix4();
          playerMatrix.makeRotationY(playerYaw.current);
          playerMatrix.setPosition(playerX.current, 0, playerZ.current);

          // Reference space = inverse of player matrix
          const refMatrix = playerMatrix.clone().invert();
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          refMatrix.decompose(pos, quat, scale);

          const transform = new XRT(
            { x: pos.x, y: pos.y, z: pos.z, w: 1 },
            { x: quat.x, y: quat.y, z: quat.z, w: quat.w }
          );
          const offsetSpace = baseRefSpaceRef.current.getOffsetReferenceSpace(transform);
          gl.xr.setReferenceSpace(offsetSpace);
        }
      } catch (e) {
        console.warn('XR locomotion reference space update failed:', e);
      }
    }
  });

  return null;
}

function KeyboardMovementController({
  hall,
  visitorPos,
  setVisitorPos,
  setTeleportTarget,
  povEnabled
}: {
  hall: Hall;
  visitorPos: [number, number, number];
  setVisitorPos: (pos: [number, number, number]) => void;
  setTeleportTarget: (pos: [number, number, number] | null) => void;
  povEnabled: boolean;
}) {
  const { camera } = useThree();
  const keysPressed = useRef<Set<string>>(new Set());
  const latestVisitorPos = useRef(visitorPos);

  useEffect(() => {
    latestVisitorPos.current = visitorPos;
  }, [visitorPos]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.current.add(key);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (keysPressed.current.size === 0) return;

    const step = (povEnabled ? 3.2 : 4.5) * Math.min(delta, 0.05);
    let dx = 0;
    let dz = 0;

    if (povEnabled) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() === 0) {
        forward.set(0, 0, -1);
      } else {
        forward.normalize();
      }

      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) {
        dx += forward.x * step;
        dz += forward.z * step;
      }
      if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) {
        dx -= forward.x * step;
        dz -= forward.z * step;
      }
      if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
        dx += right.x * step;
        dz += right.z * step;
      }
      if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) {
        dx -= right.x * step;
        dz -= right.z * step;
      }
    } else {
      if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) dz -= step;
      if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) dz += step;
      if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) dx -= step;
      if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) dx += step;
    }

    if (dx === 0 && dz === 0) return;

    const [x, , z] = latestVisitorPos.current;
    const nextX = Math.max(-hall.width / 2 + 2, Math.min(hall.width / 2 - 2, x + dx));
    const nextZ = Math.max(-hall.depth / 2 + 2, Math.min(hall.depth / 2 - 2, z + dz));
    const nextPos: [number, number, number] = [nextX, VISITOR_BODY_HEIGHT, nextZ];

    latestVisitorPos.current = nextPos;
    setVisitorPos(nextPos);

    if (!povEnabled) {
      setTeleportTarget([nextX, 0, nextZ]);
    }
  });

  return null;
}

function HumanPOVXRButton({
  visitorPos,
  povEnabled,
  setPovEnabled,
  setTeleportTarget,
  xrActive,
  setXrActive,
}: {
  visitorPos: [number, number, number];
  povEnabled: boolean;
  setPovEnabled: (enabled: boolean) => void;
  setTeleportTarget: (pos: [number, number, number] | null) => void;
  xrActive: boolean;
  setXrActive: (active: boolean) => void;
}) {
  const { gl, camera } = useThree();
  const [xrSupported, setXrSupported] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Desktop human POV');

  useEffect(() => {
    let cancelled = false;
    const xr = getNavigatorXR();

    if (!xr) {
      setStatusMessage('Desktop human POV');
      return;
    }

    xr.isSessionSupported(VR_SESSION_MODE)
      .then((supported) => {
        if (cancelled) return;
        setXrSupported(supported);
        setStatusMessage(supported ? 'Meta Quest / VR ready' : 'Desktop human POV');
      })
      .catch(() => {
        if (cancelled) return;
        setStatusMessage('Desktop human POV');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePOV = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const currentSession = gl.xr.getSession();
    if (currentSession || xrActive) {
      await currentSession?.end();
      setXrActive(false);
      setPovEnabled(false);
      setStatusMessage(xrSupported ? 'Meta Quest / VR ready' : 'Desktop human POV');
      return;
    }

    if (povEnabled) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      setPovEnabled(false);
      setStatusMessage(xrSupported ? 'Meta Quest / VR ready' : 'Desktop human POV');
      return;
    }

    setPovEnabled(true);
    setTeleportTarget(null);
    camera.position.set(visitorPos[0], HUMAN_EYE_HEIGHT, visitorPos[2]);
    camera.lookAt(visitorPos[0], HUMAN_EYE_HEIGHT, visitorPos[2] - 1);

    const xr = getNavigatorXR();
    let canStartXR = xrSupported;
    if (xr && !canStartXR) {
      try {
        canStartXR = await xr.isSessionSupported(VR_SESSION_MODE);
        setXrSupported(canStartXR);
      } catch {
        canStartXR = false;
      }
    }

    if (!xr || !canStartXR) {
      setStatusMessage('Click the hall to look around');
      return;
    }

    try {
      gl.xr.enabled = true;
      gl.xr.setReferenceSpaceType('local-floor');

      const session = await xr.requestSession(VR_SESSION_MODE, {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      });

      const handleSessionEnd = () => {
        session.removeEventListener('end', handleSessionEnd);
        setXrActive(false);
        setPovEnabled(false);
        setStatusMessage('Meta Quest / VR ready');
      };

      session.addEventListener('end', handleSessionEnd);
      await gl.xr.setSession(session as never);
      setXrActive(true);
      setStatusMessage('Rendering from headset');
    } catch (error) {
      console.warn('Could not start immersive VR session:', error);
      setStatusMessage('VR blocked, using desktop POV');
    }
  };

  return (
    <Html fullscreen>
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none select-none">
        <button
          id="human-pov-vr-toggle"
          type="button"
          onClick={handleTogglePOV}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-mono font-black uppercase tracking-wider shadow-lg backdrop-blur-md transition-all cursor-pointer ${
            povEnabled || xrActive
              ? 'bg-cyan-400 text-neutral-950 border-cyan-200'
              : 'bg-neutral-950/90 text-white border-neutral-700 hover:bg-neutral-900'
          }`}
        >
          {xrSupported ? <Glasses className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span>{xrActive ? 'Exit VR' : povEnabled ? 'Exit Human POV' : 'Human POV / VR'}</span>
        </button>
        <div className="pointer-events-none bg-neutral-950/80 text-neutral-300 border border-neutral-800 px-3 py-1.5 rounded-md text-[10px] font-mono shadow-lg">
          {statusMessage}
        </div>
      </div>
    </Html>
  );
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
  const [povEnabled, setPovEnabled] = useState(false);
  const [xrActive, setXrActive] = useState(false);

  // Walk on floor click trigger
  const handleFloorClick = (point: THREE.Vector3) => {
    // Keep visitor strictly inside limits of hall margins
    const margin = 2; // bound limits
    const targetX = Math.max(-hall.width / 2 + margin, Math.min(hall.width / 2 - margin, point.x));
    const targetZ = Math.max(-hall.depth / 2 + margin, Math.min(hall.depth / 2 - margin, point.z));
    
    if (povEnabled) {
      setTeleportTarget(null);
    } else {
      setTeleportTarget([targetX, 0, targetZ]);
    }
    setVisitorPos([targetX, VISITOR_BODY_HEIGHT, targetZ]);
  };

  // Synchronize when a custom booth model selection is clicked outside or requested
  useEffect(() => {
    if (activeBoothId) {
      const activeBooth = booths.find(b => b.id === activeBoothId);
      if (activeBooth) {
        const target: [number, number, number] = [activeBooth.posX, 0, activeBooth.posZ + 3.4];
        setVisitorPos([target[0], VISITOR_BODY_HEIGHT, target[2]]);
        setTeleportTarget(povEnabled ? null : target);
      }
    }
  }, [activeBoothId, booths, povEnabled, setVisitorPos]);

  return (
    <div id="exhibition-render-container" className="w-full h-full relative bg-neutral-950">
      <Canvas 
        shadows
        camera={{ position: [0, 8, 16], fov: 50 }}
        className="w-full h-full"
      >
        <color attach="background" args={['#12151a']} />

        {/* Bright professional exhibition ambient — fills shadows */}
        <ambientLight intensity={2.2} color="#f8f4ee" />

        {/* Sky hemisphere — warm ceiling / cool floor bounce */}
        <hemisphereLight color="#fff8f0" groundColor="#d0ccc4" intensity={1.8} />

        {/* Primary overhead directional (hall-wide fill) */}
        <directionalLight
          castShadow
          position={[0, 18, 6]}
          intensity={3.5}
          color="#ffffff"
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />

        {/* Front-fill directional to eliminate harsh back-shadows on booth faces */}
        <directionalLight position={[0, 8, 14]} intensity={2.0} color="#fff8f0" />

        {/* Professional exhibition overhead spotlights — warm white halogen */}
        <pointLight position={[-8, 9, -8]}  intensity={4.0} distance={18} color="#fff6e8" />
        <pointLight position={[8,  9, -8]}  intensity={4.0} distance={18} color="#fff6e8" />
        <pointLight position={[-8, 9,  0]}  intensity={4.0} distance={18} color="#fff6e8" />
        <pointLight position={[8,  9,  0]}  intensity={4.0} distance={18} color="#fff6e8" />
        <pointLight position={[-8, 9,  8]}  intensity={4.0} distance={18} color="#fff6e8" />
        <pointLight position={[8,  9,  8]}  intensity={4.0} distance={18} color="#fff6e8" />
        <pointLight position={[0,  9, -8]}  intensity={3.5} distance={18} color="#fff6e8" />
        <pointLight position={[0,  9,  8]}  intensity={3.5} distance={18} color="#fff6e8" />

        {/* Centre aisle accent lights — blue-white display lighting */}
        <pointLight position={[0, 6, -4]} intensity={2.5} distance={10} color="#e8f4ff" />
        <pointLight position={[0, 6,  4]} intensity={2.5} distance={10} color="#e8f4ff" />

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
          povEnabled={povEnabled}
        />

        <KeyboardMovementController
          hall={hall}
          visitorPos={visitorPos}
          setVisitorPos={setVisitorPos}
          setTeleportTarget={setTeleportTarget}
          povEnabled={povEnabled}
        />

        <HumanPOVXRButton
          visitorPos={visitorPos}
          povEnabled={povEnabled}
          setPovEnabled={setPovEnabled}
          setTeleportTarget={setTeleportTarget}
          xrActive={xrActive}
          setXrActive={setXrActive}
        />

        {/* Quest 3 thumbstick locomotion + snap turn + trigger selection */}
        {xrActive && (
          <XRLocomotionController
            hall={hall}
            booths={booths}
            setVisitorPos={setVisitorPos}
            onSelectBooth={onSelectBooth}
          />
        )}

        {/* Desktop camera controls — disabled while XR headset is presenting */}
        {!xrActive && (
          povEnabled ? (
            <PointerLockControls />
          ) : (
            <OrbitControls
              enableDamping
              dampingFactor={0.08}
              minDistance={3}
              maxDistance={28}
              maxPolarAngle={Math.PI / 2.1}
              target={[visitorPos[0], 1.2, visitorPos[2]]}
            />
          )
        )}
      </Canvas>

      {/* Floating HUD — shows Quest controls in XR, keyboard guide on desktop */}
      <div className="absolute bottom-4 left-4 bg-neutral-950/90 text-neutral-300 border border-neutral-800/80 p-3 rounded-lg text-[10px] space-y-1.5 font-mono z-10 shadow-lg hidden md:block">
        {xrActive ? (
          <>
            <p className="font-bold text-cyan-400 tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Quest 3 Controls
            </p>
            <p className="opacity-80">🕹️ Left Thumbstick : Walk / Strafe</p>
            <p className="opacity-80">🕹️ Right Thumbstick : Snap Turn</p>
            <p className="opacity-80">👆 Right Trigger : Select Booth</p>
            <p className="opacity-80">🔲 B / Y Button : Exit VR</p>
          </>
        ) : (
          <>
            <p className="font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              Virtual Controls GUIDE
            </p>
            <p className="opacity-80">🖱️ Left Click + Drag : Rotate Camera View</p>
            <p className="opacity-80">🖱️ Right Click + Drag : Pan Camera</p>
            <p className="opacity-80">📍 Click on Floor : Smooth Teleport walk</p>
            <p className="opacity-80">🎹 Keyboard WASD / Arrows : Slide position</p>
            <p className="opacity-80">👓 Human POV / VR : Eye-height headset view</p>
          </>
        )}
      </div>
    </div>
  );
}
