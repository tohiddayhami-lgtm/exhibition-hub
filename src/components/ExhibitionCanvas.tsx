import React, { useRef, useEffect, useState, Suspense, useMemo } from 'react';
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
  onCloseBooth: () => void;
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
    return () => { document.body.style.cursor = 'auto'; };
  }, [hovered]);

  const col = booth.themeColor || '#2563eb';
  const isLit = hovered || active;

  return (
    <group
      position={[booth.posX, 0, booth.posZ]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 1. CARPET PLATFORM */}
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[booth.width, 0.05, booth.depth]} />
        <meshStandardMaterial color="#1c2130" roughness={0.7} metalness={0} />
      </mesh>

      {/* LED edge glow strip around carpet */}
      <mesh position={[0, 0.052, 0]}>
        <boxGeometry args={[booth.width + 0.06, 0.018, booth.depth + 0.06]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={isLit ? 1.2 : 0.35}
          roughness={0.05}
          metalness={0.9}
        />
      </mesh>

      {/* 2. BACK WALL — white with theme-color top band */}
      <mesh position={[0, booth.height / 2, -booth.depth / 2 + 0.06]} castShadow receiveShadow>
        <boxGeometry args={[booth.width, booth.height, 0.12]} />
        <meshStandardMaterial color="#f7f7f7" roughness={0.85} />
      </mesh>
      {/* Theme-color top accent band */}
      <mesh position={[0, booth.height - 0.18, -booth.depth / 2 + 0.13]}>
        <boxGeometry args={[booth.width * 0.96, 0.36, 0.02]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.5} roughness={0.1} metalness={0.6} />
      </mesh>
      {/* Inner graphic panel */}
      <mesh position={[0, booth.height * 0.44, -booth.depth / 2 + 0.14]}>
        <boxGeometry args={[booth.width * 0.88, booth.height * 0.62, 0.015]} />
        <meshStandardMaterial color={active ? '#eef2ff' : '#f0f0f0'} roughness={0.9} />
      </mesh>

      {/* 3. SIDE PILLARS — dark body + LED strip */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (booth.width / 2 - 0.12), booth.height / 2, booth.depth / 2 - 0.12]}>
          {/* Pillar body */}
          <mesh castShadow>
            <boxGeometry args={[0.22, booth.height, 0.22]} />
            <meshStandardMaterial color="#1a1e26" roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Front face LED strip */}
          <mesh position={[side * -0.11, 0, 0.115]}>
            <boxGeometry args={[0.03, booth.height * 0.85, 0.01]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={isLit ? 1.5 : 0.5} roughness={0} metalness={1} />
          </mesh>
        </group>
      ))}

      {/* 4. OVERHEAD TRUSS — brushed aluminium */}
      <mesh position={[0, booth.height + 0.06, 0]}>
        <boxGeometry args={[booth.width, 0.14, booth.depth]} />
        <meshStandardMaterial color="#4a4e58" roughness={0.25} metalness={0.92} />
      </mesh>
      {/* Truss front beam with LED underlight */}
      <mesh position={[0, booth.height, booth.depth / 2 - 0.12]}>
        <boxGeometry args={[booth.width, 0.06, 0.06]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={isLit ? 1.0 : 0.3} roughness={0} metalness={1} />
      </mesh>

      {/* 5. SIGNBOARD — always-visible WebGL text, high-contrast design */}
      <group position={[0, booth.height - 0.42, booth.depth / 2 + 0.01]}>
        {/* Full-width dark glass panel */}
        <mesh>
          <boxGeometry args={[booth.width * 0.96, 0.6, 0.055]} />
          <meshStandardMaterial color="#0d111a" roughness={0.02} metalness={0.98} transparent opacity={0.95} />
        </mesh>
        {/* Bottom glow trim */}
        <mesh position={[0, -0.31, 0.035]}>
          <boxGeometry args={[booth.width * 0.96, 0.025, 0.01]} />
          <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.8} />
        </mesh>

        {/* ── BOOTH NUMBER BADGE (always white-on-color for visibility) ── */}
        <mesh position={[-(booth.width * 0.32), 0.02, 0.04]}>
          <boxGeometry args={[0.42, 0.42, 0.01]} />
          <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.6} roughness={0.05} metalness={0.8} />
        </mesh>
        <Text
          position={[-(booth.width * 0.32), 0.02, 0.052]}
          fontSize={0.14}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {booth.boothNumber}
        </Text>

        {/* ── COMPANY NAME — white, large, readable ── */}
        <Text
          position={[booth.width * 0.1, 0.02, 0.048]}
          fontSize={0.14}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={booth.width * 0.52}
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {booth.companyName}
        </Text>
      </group>

      {/* 6. RECEPTION DESK */}
      <group position={[booth.width / 3.2, 0.45, booth.depth / 4.2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.9, 0.48]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.2} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.47, 0]}>
          <boxGeometry args={[0.98, 0.055, 0.56]} />
          <meshStandardMaterial color={col} roughness={0.08} metalness={0.7} />
        </mesh>
        <Text
          position={[0, 0.66, 0.13]}
          fontSize={0.065}
          color="#e8c85a"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.002}
          outlineColor="#000"
        >
          INFO
        </Text>
      </group>

      {/* 7. PRODUCT DISPLAY */}
      <group position={[0, 0.05, 0]}>
        {booth.modelUrl ? (
          <Suspense fallback={<PlaceholderProductStyle themeColor={col} style={booth.stylePreset} />}>
            <GLTFModelLoader url={booth.modelUrl} scale={booth.modelScale || 1} />
          </Suspense>
        ) : (
          <PlaceholderProductStyle themeColor={col} style={booth.stylePreset} />
        )}
      </group>

      {/* 8. FLOATING BILLBOARD — always faces visitor, large & clickable, visible in VR */}
      <Billboard position={[0, booth.height + 0.72, 0]}>
        {/* Outer glow ring (active state) */}
        {active && (
          <mesh>
            <planeGeometry args={[booth.width * 0.88, 0.58]} />
            <meshBasicMaterial color={col} transparent opacity={0.22} />
          </mesh>
        )}
        {/* Card */}
        <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <planeGeometry args={[booth.width * 0.82, 0.48]} />
          <meshStandardMaterial
            color={active ? col : '#0d111a'}
            transparent opacity={0.93}
            roughness={0.05} metalness={0.85}
          />
        </mesh>
        {/* Booth number on billboard */}
        <Text
          position={[-(booth.width * 0.28), 0, 0.005]}
          fontSize={0.13}
          color={active ? '#000' : col}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor={active ? '#fff' : '#000'}
        >
          {booth.boothNumber}
        </Text>
        {/* Company name on billboard */}
        <Text
          position={[booth.width * 0.08, 0, 0.005]}
          fontSize={0.15}
          color={active ? '#000' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          maxWidth={booth.width * 0.55}
          outlineWidth={0.005}
          outlineColor={active ? '#fff' : '#000'}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          {booth.companyName}
        </Text>
      </Billboard>
    </group>
  );
}

// Memoised — only re-renders when this booth's data or active state changes.
// With 100 booths, without memo every camera/visitor move would re-render all 100.
const MemoBoothStructure = React.memo(BoothStructure, (prev, next) =>
  prev.active === next.active && prev.booth === next.booth
);

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

// Quest 3: left stick = walk, right stick X = 45° snap turn
function XRLocomotionController({
  hall,
  setVisitorPos,
}: {
  hall: Hall;
  setVisitorPos: (pos: [number, number, number]) => void;
}) {
  const { gl, camera } = useThree();
  const baseRefSpaceRef = useRef<XRReferenceSpace | null>(null);
  const playerX = useRef(0);
  const playerZ = useRef(0);
  const playerYaw = useRef(0);
  const snapLocked = useRef(false);

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

    if (!baseRefSpaceRef.current) {
      const refSpace = gl.xr.getReferenceSpace();
      if (!refSpace) return;
      baseRefSpaceRef.current = refSpace as XRReferenceSpace;
    }

    const session = gl.xr.getSession();
    if (!session) return;

    let dx = 0, dz = 0;
    const speed = 3.0 * Math.min(delta, 0.05);
    let didSnapTurn = false;

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;
      const axes = source.gamepad.axes;

      if (source.handedness === 'left') {
        const thumbX = axes.length >= 4 ? axes[2] : 0;
        const thumbY = axes.length >= 4 ? axes[3] : 0;
        if (Math.abs(thumbX) > 0.15 || Math.abs(thumbY) > 0.15) {
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          forward.y = 0;
          if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
          forward.normalize();
          const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
          dx += (forward.x * -thumbY + right.x * thumbX) * speed;
          dz += (forward.z * -thumbY + right.z * thumbX) * speed;
        }
      }

      if (source.handedness === 'right') {
        const turnX = axes.length >= 4 ? axes[2] : 0;
        if (Math.abs(turnX) > 0.65 && !snapLocked.current) {
          playerYaw.current += turnX > 0 ? -Math.PI / 4 : Math.PI / 4;
          snapLocked.current = true;
          didSnapTurn = true;
        } else if (Math.abs(turnX) < 0.3) {
          snapLocked.current = false;
        }
      }
    }

    if (dx !== 0 || dz !== 0) {
      const halfW = hall.width / 2 - 2;
      const halfD = hall.depth / 2 - 2;
      playerX.current = Math.max(-halfW, Math.min(halfW, playerX.current + dx));
      playerZ.current = Math.max(-halfD, Math.min(halfD, playerZ.current + dz));
      setVisitorPos([playerX.current, VISITOR_BODY_HEIGHT, playerZ.current]);
    }

    if (dx !== 0 || dz !== 0 || didSnapTurn) {
      try {
        const XRT = (window as unknown as { XRRigidTransform?: typeof XRRigidTransform }).XRRigidTransform;
        if (XRT && baseRefSpaceRef.current) {
          const playerMatrix = new THREE.Matrix4();
          playerMatrix.makeRotationY(playerYaw.current);
          playerMatrix.setPosition(playerX.current, 0, playerZ.current);
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
        console.warn('XR locomotion failed:', e);
      }
    }
  });

  return null;
}

// Combined VR interaction: laser ray from right controller + in-world info panel with clickable buttons
// DOM modals are invisible in WebXR — this renders everything in WebGL so the headset can see it
function XRInteractionSystem({
  booths,
  selectedBooth,
  onSelectBooth,
  onCloseBooth,
}: {
  booths: Booth[];
  selectedBooth: Booth | null;
  onSelectBooth: (booth: Booth) => void;
  onCloseBooth: () => void;
}) {
  const { gl } = useThree();

  // Laser beam refs
  const beamGroupRef = useRef<THREE.Group>(null);
  const beamMeshRef  = useRef<THREE.Mesh>(null);
  const dotRef       = useRef<THREE.Mesh>(null);

  // Panel interactive button mesh refs (world-space, Billboard-rotated)
  const websiteBtnRef   = useRef<THREE.Mesh>(null);
  const whatsappBtnRef  = useRef<THREE.Mesh>(null);
  const closeBtnRef     = useRef<THREE.Mesh>(null);

  const triggerWasDown  = useRef(false);
  const hitActionRef    = useRef<(() => void) | null>(null);
  const raycasterRef    = useRef(new THREE.Raycaster());

  // Booth AABBs (world-space, axis-aligned)
  const boothBoxes = useMemo(() =>
    booths.map(b => ({
      booth: b,
      box: new THREE.Box3(
        new THREE.Vector3(b.posX - b.width / 2, 0,          b.posZ - b.depth / 2),
        new THREE.Vector3(b.posX + b.width / 2, b.height + 1.2, b.posZ + b.depth / 2)
      ),
    })),
    [booths]
  );

  useFrame(() => {
    if (!gl.xr.isPresenting) {
      if (beamGroupRef.current) beamGroupRef.current.visible = false;
      if (dotRef.current)       dotRef.current.visible = false;
      return;
    }

    const controller = gl.xr.getController(1); // right controller
    if (!controller) return;

    const cPos = new THREE.Vector3();
    const cQuat = new THREE.Quaternion();
    controller.getWorldPosition(cPos);
    controller.getWorldQuaternion(cQuat);
    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cQuat).normalize();

    if (beamGroupRef.current) {
      beamGroupRef.current.visible = true;
      beamGroupRef.current.position.copy(cPos);
      beamGroupRef.current.quaternion.copy(cQuat);
    }

    raycasterRef.current.set(cPos, rayDir);
    const ray = new THREE.Ray(cPos, rayDir);
    const aabbTarget = new THREE.Vector3();

    let closestDist = Infinity;
    let closestPoint: THREE.Vector3 | null = null;
    hitActionRef.current = null;

    // ── When panel is OPEN: test button meshes via full raycaster (handles Billboard rotation)
    if (selectedBooth) {
      const wa = (selectedBooth.whatsapp || '').replace(/\+/g, '');
      const waLink = `https://api.whatsapp.com/send?phone=${wa}&text=Hello+${encodeURIComponent(selectedBooth.companyName)},+I+am+at+your+virtual+booth.`;

      const panelButtons: { mesh: THREE.Mesh | null; action: () => void }[] = [
        { mesh: websiteBtnRef.current,  action: () => window.open(selectedBooth.websiteUrl || '#', '_blank') },
        { mesh: whatsappBtnRef.current, action: () => window.open(waLink, '_blank') },
        { mesh: closeBtnRef.current,    action: onCloseBooth },
      ];

      for (const { mesh, action } of panelButtons) {
        if (!mesh) continue;
        const hits = raycasterRef.current.intersectObject(mesh, false);
        if (hits.length > 0 && hits[0].distance < closestDist) {
          closestDist = hits[0].distance;
          closestPoint = hits[0].point.clone();
          hitActionRef.current = action;
        }
      }
    }

    // ── When panel is CLOSED: test booth AABBs
    if (!selectedBooth) {
      for (const { booth, box } of boothBoxes) {
        if (ray.intersectBox(box, aabbTarget)) {
          const dist = cPos.distanceTo(aabbTarget);
          if (dist < closestDist) {
            closestDist = dist;
            closestPoint = aabbTarget.clone();
            hitActionRef.current = () => onSelectBooth(booth);
          }
        }
      }
    }

    // Update beam visual
    const beamLen = Math.min(closestPoint ? closestDist : 10, 14);
    if (beamMeshRef.current) {
      beamMeshRef.current.scale.set(1, 1, beamLen);
      beamMeshRef.current.position.set(0, 0, -beamLen / 2);
      const mat = beamMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(closestPoint ? 0x00e5ff : 0xffffff);
      mat.opacity = closestPoint ? 0.95 : 0.4;
    }
    if (dotRef.current) {
      if (closestPoint) { dotRef.current.visible = true; dotRef.current.position.copy(closestPoint); }
      else              { dotRef.current.visible = false; }
    }

    // Trigger → fire action
    const session = gl.xr.getSession();
    if (session) {
      let trigDown = false;
      for (const src of session.inputSources) {
        if (src.handedness === 'right' && src.gamepad) {
          trigDown = src.gamepad.buttons[0]?.pressed ?? false;
        }
      }
      if (trigDown && !triggerWasDown.current && hitActionRef.current) {
        hitActionRef.current();
      }
      triggerWasDown.current = trigDown;
    }
  });

  const booth = selectedBooth;
  const PW = 2.2; // panel width (meters)
  const PH = 1.65; // panel height

  return (
    <>
      {/* ── LASER BEAM (controller -Z direction) */}
      <group ref={beamGroupRef} visible={false}>
        <mesh ref={beamMeshRef}>
          <boxGeometry args={[0.006, 0.006, 1]} />
          <meshBasicMaterial color="white" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>
      {/* Hit dot */}
      <mesh ref={dotRef} visible={false}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color="#00e5ff" />
      </mesh>

      {/* ── VR INFO PANEL — full WebGL, visible inside Quest headset */}
      {booth && (
        <Billboard position={[booth.posX, 1.8, booth.posZ + booth.depth / 2 + 2.2]}>

          {/* Panel shadow/glow halo */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[PW + 0.18, PH + 0.18]} />
            <meshBasicMaterial color={booth.themeColor || '#2563eb'} transparent opacity={0.12} />
          </mesh>

          {/* Main dark glass background */}
          <mesh>
            <planeGeometry args={[PW, PH]} />
            <meshStandardMaterial color="#080c14" transparent opacity={0.97} roughness={0.02} metalness={0.95} />
          </mesh>

          {/* ── HEADER BAND (theme color) */}
          <mesh position={[0, PH / 2 - 0.22, 0.006]}>
            <planeGeometry args={[PW, 0.44]} />
            <meshStandardMaterial
              color={booth.themeColor || '#2563eb'}
              emissive={booth.themeColor || '#2563eb'}
              emissiveIntensity={0.45}
              roughness={0.08} metalness={0.8}
            />
          </mesh>

          {/* Booth number badge in header */}
          <mesh position={[-PW / 2 + 0.34, PH / 2 - 0.22, 0.012]}>
            <planeGeometry args={[0.5, 0.3]} />
            <meshBasicMaterial color="#00000066" transparent opacity={0.5} />
          </mesh>
          <Text position={[-PW / 2 + 0.34, PH / 2 - 0.22, 0.018]} fontSize={0.13} color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.004} outlineColor="#000">
            {booth.boothNumber}
          </Text>

          {/* Company name */}
          <Text position={[0.12, PH / 2 - 0.22, 0.014]} fontSize={0.17} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={PW - 0.75} outlineWidth={0.005} outlineColor="#000">
            {booth.companyName}
          </Text>

          {/* ── CLOSE BUTTON (red X, top-right) */}
          <mesh ref={closeBtnRef} position={[PW / 2 - 0.24, PH / 2 - 0.22, 0.013]}>
            <planeGeometry args={[0.34, 0.34]} />
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.5} roughness={0.1} metalness={0.6} />
          </mesh>
          <Text position={[PW / 2 - 0.24, PH / 2 - 0.22, 0.02]} fontSize={0.18} color="white" anchorX="center" anchorY="middle">X</Text>

          {/* ── DIVIDER */}
          <mesh position={[0, PH / 2 - 0.46, 0.007]}>
            <planeGeometry args={[PW * 0.95, 0.008]} />
            <meshBasicMaterial color={booth.themeColor || '#2563eb'} />
          </mesh>

          {/* Category pill */}
          <Text position={[0, PH / 2 - 0.6, 0.008]} fontSize={0.09} color={booth.themeColor || '#60a5fa'} anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor="#000">
            {`[ ${booth.category} ]`}
          </Text>

          {/* Description */}
          <Text
            position={[0, 0.04, 0.008]}
            fontSize={0.095}
            color="#c8d0e0"
            anchorX="center"
            anchorY="middle"
            maxWidth={PW - 0.28}
            lineHeight={1.45}
            textAlign="center"
            outlineWidth={0.002}
            outlineColor="#000"
          >
            {(booth.description || 'Welcome to our virtual exhibition stand. We are happy to connect with you.').substring(0, 200)}
          </Text>

          {/* ── WEBSITE BUTTON */}
          <mesh ref={websiteBtnRef} position={[-0.6, -PH / 2 + 0.3, 0.01]}>
            <planeGeometry args={[0.92, 0.38]} />
            <meshStandardMaterial color="#1d4ed8" emissive="#1d4ed8" emissiveIntensity={0.4} roughness={0.05} metalness={0.7} />
          </mesh>
          <Text position={[-0.6, -PH / 2 + 0.3, 0.018]} fontSize={0.105} color="white" anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor="#000">
            Visit Website
          </Text>

          {/* ── WHATSAPP BUTTON */}
          <mesh ref={whatsappBtnRef} position={[0.6, -PH / 2 + 0.3, 0.01]}>
            <planeGeometry args={[0.92, 0.38]} />
            <meshStandardMaterial color="#15803d" emissive="#15803d" emissiveIntensity={0.4} roughness={0.05} metalness={0.7} />
          </mesh>
          <Text position={[0.6, -PH / 2 + 0.3, 0.018]} fontSize={0.105} color="white" anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor="#000">
            WhatsApp Chat
          </Text>

        </Billboard>
      )}
    </>
  );
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
  onCloseBooth,
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
        // Adaptive DPR: cap at 1.5× so mobile/Quest doesn't over-render
        dpr={[1, 1.5]}
        // Adaptive performance: automatically lowers resolution if fps drops
        performance={{ min: 0.5 }}
        // Prefer high-performance GPU on dual-GPU laptops/tablets
        gl={{ antialias: true, powerPreference: 'high-performance' }}
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
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={50}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-bias={-0.0005}
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

          {/* Symmetrical positioned trade stalls — memoised to skip re-renders */}
          {booths.map((booth) => (
            <MemoBoothStructure
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

        {/* Quest 3: left stick walk + right stick snap turn */}
        {xrActive && (
          <XRLocomotionController
            hall={hall}
            setVisitorPos={setVisitorPos}
          />
        )}

        {/* Quest 3: right-controller ray + in-world info panel (replaces DOM modal in VR) */}
        {xrActive && (
          <XRInteractionSystem
            booths={booths}
            selectedBooth={activeBoothId ? (booths.find(b => b.id === activeBoothId) ?? null) : null}
            onSelectBooth={onSelectBooth}
            onCloseBooth={onCloseBooth}
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
