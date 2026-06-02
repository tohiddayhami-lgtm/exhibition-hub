import React, { useRef, useEffect, useState, Suspense, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, PointerLockControls, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import * as pdfjsLib from 'pdfjs-dist';
import { Hall, Booth } from '../types';
import { Eye, Glasses } from 'lucide-react';

const HUMAN_EYE_HEIGHT = 1.65;
const VISITOR_BODY_HEIGHT = 0.8;
const VR_SESSION_MODE = 'immersive-vr';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

type XRSessionLike = {
  end: () => Promise<void>;
  addEventListener: (type: 'end', listener: () => void) => void;
  removeEventListener: (type: 'end', listener: () => void) => void;
};

type XRSystemLike = {
  isSessionSupported: (mode: typeof VR_SESSION_MODE) => Promise<boolean>;
  requestSession: (
    mode: typeof VR_SESSION_MODE,
    options?: {
      optionalFeatures?: string[];
      domOverlay?: { root: Element };
    }
  ) => Promise<XRSessionLike>;
};

type PdfPanelSide = 'left' | 'right';
type PdfPanelState = {
  page: number;
  zoom: number;
};
type YouTubeLCDCommand = {
  type: 'toggle' | 'seek';
  deltaSeconds?: number;
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

// Professional exhibition floor with marble tiles and decorative borders
function GroundPlane({ hall, onFloorClick }: {
  hall: Hall;
  onFloorClick: (point: THREE.Vector3) => void;
}) {
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
    </group>
  );
}

// In-booth LCD screen — shows video texture or product image on the back wall
// ── YouTube helpers ──────────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function openLinkInNewWindow(url: string) {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return;

  const popup = window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  if (popup) {
    popup.opener = null;
  }
}

function toYouTubeEmbed(id: string) {
  const origin = encodeURIComponent(window.location.origin);
  return `https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${origin}`;
}

function dispatchYouTubeLCDCommand(command: YouTubeLCDCommand) {
  window.dispatchEvent(new CustomEvent<YouTubeLCDCommand>('exhibition-youtube-command', { detail: command }));
}

function getBoothPdfUrl(booth: Booth, side: PdfPanelSide) {
  return side === 'left' ? booth.catalogUrl || '' : booth.pdfRightUrl || '';
}

function getPdfViewerUrl(url: string, page: number, zoom: number) {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return '';
  return `${normalizedUrl}#page=${page}&zoom=${zoom}`;
}

function getGoogleDriveFileId(url: string) {
  const normalizedUrl = normalizeExternalUrl(url);
  const fileMatch = normalizedUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];

  const queryMatch = normalizedUrl.match(/[?&]id=([^&]+)/i);
  if (normalizedUrl.includes('drive.google.com') && queryMatch?.[1]) {
    return queryMatch[1];
  }

  return null;
}

function getPdfDownloadUrlFromHtml(html: string, baseUrl: string) {
  const htmlDecoded = html.replace(/&amp;/g, '&');
  const hrefMatch = htmlDecoded.match(/href="([^"]*(?:uc\?export=download|drive\.usercontent\.google\.com\/download)[^"]*)"/i);
  if (hrefMatch?.[1]) {
    return new URL(hrefMatch[1], baseUrl).toString();
  }

  const jsonUrlMatch = htmlDecoded.match(/https:\\\/\\\/drive\.usercontent\.google\.com\\\/download[^"]+/i);
  if (jsonUrlMatch?.[0]) {
    return jsonUrlMatch[0].replace(/\\\//g, '/').replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
  }

  return null;
}

async function fetchPdfBytes(candidateUrl: string, redirectDepth = 0): Promise<Uint8Array> {
  const response = await fetch(candidateUrl, {
    mode: 'cors',
    credentials: 'omit',
    headers: {
      accept: 'application/pdf,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const bytes = new Uint8Array(await response.arrayBuffer());
  const header = new TextDecoder('ascii').decode(bytes.slice(0, 5));

  if (!header.startsWith('%PDF')) {
    const html = new TextDecoder('utf-8').decode(bytes);
    const downloadUrl = redirectDepth < 2 ? getPdfDownloadUrlFromHtml(html, candidateUrl) : null;
    if (downloadUrl) {
      return fetchPdfBytes(downloadUrl, redirectDepth + 1);
    }

    throw new Error(contentType.includes('html') ? 'Link opens an HTML page, not a PDF file' : 'Response is not a PDF file');
  }

  return bytes;
}

function getSpatialPdfUrlCandidates(url: string) {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return [];

  const rawCandidates = new Set<string>();
  rawCandidates.add(normalizedUrl);

  const googleDriveId = getGoogleDriveFileId(normalizedUrl);
  if (googleDriveId) {
    rawCandidates.add(`https://drive.google.com/uc?export=download&id=${googleDriveId}`);
    rawCandidates.add(`https://drive.google.com/uc?id=${googleDriveId}&export=download`);
    rawCandidates.add(`https://drive.usercontent.google.com/download?id=${googleDriveId}&export=download&confirm=t`);
  }

  if (normalizedUrl.includes('dropbox.com')) {
    rawCandidates.add(normalizedUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/i, ''));
    rawCandidates.add(normalizedUrl.replace(/[?&]dl=0/i, '?dl=1'));
  }

  if (normalizedUrl.includes('github.com') && normalizedUrl.includes('/blob/')) {
    rawCandidates.add(normalizedUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'));
  }

  const candidates = new Set<string>();
  Array.from(rawCandidates).forEach((candidate) => {
    candidates.add(candidate);
    candidates.add(`https://api.allorigins.win/raw?url=${encodeURIComponent(candidate)}`);
    candidates.add(`https://corsproxy.io/?${encodeURIComponent(candidate)}`);
    candidates.add(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(candidate)}`);
    candidates.add(`/api/pdf-proxy?url=${encodeURIComponent(candidate)}`);
  });

  return Array.from(candidates);
}

// ── Control button helper (3D clickable button, works in VR) ─────────────────
function LCDButton({
  label, color, textColor = 'white', x, y, w, h, onClick,
}: {
  label: string; color: string; textColor?: string;
  x: number; y: number; w: number; h: number;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <group position={[x, y, 0]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHov(true)}
        onPointerOut={() => setHov(false)}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={hov ? '#334155' : color} roughness={0.1} metalness={0.6} />
      </mesh>
      <Text position={[0, 0, 0.008]} fontSize={h * 0.38} color={textColor} anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor="#000">
        {label}
      </Text>
    </group>
  );
}

// ── YouTube LCD — thumbnail + red play button → opens overlay/panel ───────────
function YouTubeLCDScreen({
  booth,
  ytId,
  isPlaying,
  onToggleVideo,
  onSeekVideo,
}: {
  booth: Booth;
  ytId: string;
  isPlaying: boolean;
  onToggleVideo: () => void;
  onSeekVideo: (deltaSeconds: number) => void;
}) {
  const [thumbTex, setThumbTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, t => setThumbTex(t), undefined, () => {});
    return () => { thumbTex?.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId]);

  const screenW = Math.min(booth.width * 0.72, 3.2);
  const screenH = screenW * (9 / 16);
  const posY = booth.height * 0.42;
  const barH = 0.3;
  const btnW = screenW * 0.28;
  const btnH = barH * 0.78;
  const btnY = -(screenH / 2 + barH / 2 + 0.04);
  const toggle = (e?: { stopPropagation: () => void }) => {
    e?.stopPropagation();
    onToggleVideo();
  };

  return (
    <group position={[0, posY, -booth.depth / 2 + 0.22]}>
      <mesh>
        <boxGeometry args={[screenW + 0.1, screenH + 0.08, 0.06]} />
        <meshStandardMaterial
          color="#0a0a0a"
          roughness={0.1}
          metalness={0.95}
          emissive={isPlaying ? booth.themeColor || '#0ea5e9' : '#000000'}
          emissiveIntensity={isPlaying ? 0.35 : 0}
        />
      </mesh>
      {/* Thumbnail */}
      <mesh position={[0, 0, 0.04]} onClick={toggle}>
        <planeGeometry args={[screenW, screenH]} />
        {thumbTex
          ? <meshBasicMaterial map={thumbTex} />
          : <meshStandardMaterial color="#0d1117" emissive={booth.themeColor || '#111'} emissiveIntensity={0.1} />
        }
      </mesh>
      {/* Play / pause circle */}
      <mesh position={[0, 0, 0.06]} onClick={toggle}>
        <circleGeometry args={[Math.min(screenW, screenH) * 0.2, 32]} />
        <meshBasicMaterial color={isPlaying ? '#16a34a' : '#ff0000'} transparent opacity={0.88} />
      </mesh>
      <Text position={[0.04, 0, 0.075]} fontSize={Math.min(screenW, screenH) * 0.18} color="white" anchorX="center" anchorY="middle">
        {isPlaying ? 'Ⅱ' : '▶'}
      </Text>
      <Text position={[0, -(screenH * 0.4), 0.06]} fontSize={0.085} color="#94a3b8" anchorX="center" anchorY="middle">
        {isPlaying ? 'Tap LCD again to pause' : 'Tap LCD to play YouTube'}
      </Text>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[screenW + 0.06, screenH + 0.05]} />
        <meshBasicMaterial color={isPlaying ? '#16a34a' : booth.themeColor || '#334155'} transparent opacity={isPlaying ? 0.35 : 0.2} />
      </mesh>
      <mesh position={[0, btnY, 0.042]}>
        <planeGeometry args={[screenW, barH]} />
        <meshStandardMaterial color="#0d1117" roughness={0} metalness={0.6} transparent opacity={0.95} />
      </mesh>
      <LCDButton
        label="-30s"
        color="#1e293b"
        textColor="#94a3b8"
        x={-(btnW + 0.08)}
        y={btnY}
        w={btnW}
        h={btnH}
        onClick={() => onSeekVideo(-30)}
      />
      <LCDButton
        label={isPlaying ? 'Pause' : 'Play'}
        color={isPlaying ? '#14532d' : '#1e293b'}
        textColor={isPlaying ? '#4ade80' : '#e2e8f0'}
        x={0}
        y={btnY}
        w={btnW}
        h={btnH}
        onClick={onToggleVideo}
      />
      <LCDButton
        label="+30s"
        color="#1e293b"
        textColor="#94a3b8"
        x={btnW + 0.08}
        y={btnY}
        w={btnW}
        h={btnH}
        onClick={() => onSeekVideo(30)}
      />
    </group>
  );
}

// ── Direct MP4/WebM LCD — VideoTexture + full controls bar ───────────────────
function DirectVideoLCDScreen({ booth }: { booth: Booth }) {
  const [videoTex, setVideoTex] = useState<THREE.VideoTexture | null>(null);
  const [imgTex, setImgTex]     = useState<THREE.Texture | null>(null);
  const [playing, setPlaying]   = useState(false);
  const [muted, setMuted]       = useState(true);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!booth.videoUrl) return;
    const v = document.createElement('video');
    v.src = booth.videoUrl;
    v.crossOrigin = 'anonymous';
    v.loop = true;
    v.muted = true;     // starts muted — user must unmute via Sound button
    v.playsInline = true;
    const tex = new THREE.VideoTexture(v);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    v.play().then(() => setPlaying(true)).catch(() => {});
    videoElRef.current = v;
    setVideoTex(tex);
    return () => { v.pause(); v.src = ''; tex.dispose(); setVideoTex(null); };
  }, [booth.videoUrl]);

  useEffect(() => {
    if (booth.videoUrl || !booth.productImageUrl) return;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(booth.productImageUrl, t => setImgTex(t), undefined, () => {});
  }, [booth.productImageUrl, booth.videoUrl]);

  const togglePlay = () => {
    const v = videoElRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };
  const toggleMute = () => {
    const v = videoElRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const seek = (s: number) => {
    const v = videoElRef.current;
    if (v) v.currentTime = Math.max(0, v.currentTime + s);
  };

  const screenW = Math.min(booth.width * 0.72, 3.2);
  const screenH = screenW * (9 / 16);
  const posY = booth.height * 0.42;

  // Control bar dimensions
  const barH = 0.3;
  const btnW = screenW * 0.21;
  const btnH = barH * 0.78;
  const gap  = (screenW - btnW * 4) / 5;
  const btnY = -(screenH / 2 + barH / 2 + 0.04);

  return (
    <group position={[0, posY, -booth.depth / 2 + 0.22]}>
      {/* Bezel */}
      <mesh>
        <boxGeometry args={[screenW + 0.1, screenH + 0.08 + barH + 0.12, 0.06]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.95} />
      </mesh>

      {/* Screen */}
      <mesh position={[0, 0, 0.04]} onClick={togglePlay}>
        <planeGeometry args={[screenW, screenH]} />
        {videoTex
          ? <meshBasicMaterial map={videoTex} toneMapped={false} />
          : imgTex
            ? <meshBasicMaterial map={imgTex} />
            : <meshStandardMaterial color="#0d1117" emissive={booth.themeColor || '#1a2744'} emissiveIntensity={0.12} />
        }
      </mesh>

      {/* LED border */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[screenW + 0.06, screenH + 0.05]} />
        <meshBasicMaterial color={booth.themeColor || '#334155'} transparent opacity={0.2} />
      </mesh>

      {/* Control bar background */}
      <mesh position={[0, btnY, 0.042]}>
        <planeGeometry args={[screenW, barH]} />
        <meshStandardMaterial color="#0d1117" roughness={0} metalness={0.6} transparent opacity={0.95} />
      </mesh>

      {/* ← -30s */}
      <LCDButton
        label="-30s" color="#1e293b" textColor="#94a3b8"
        x={-(gap * 1.5 + btnW * 1.5)} y={btnY} w={btnW} h={btnH}
        onClick={() => seek(-30)}
      />
      {/* Play / Pause */}
      <LCDButton
        label={playing ? 'Pause' : 'Play'} color={playing ? '#14532d' : '#1e293b'} textColor={playing ? '#4ade80' : '#e2e8f0'}
        x={-(gap * 0.5 + btnW * 0.5)} y={btnY} w={btnW} h={btnH}
        onClick={togglePlay}
      />
      {/* Sound / Muted */}
      <LCDButton
        label={muted ? 'Muted' : 'Sound'} color={muted ? '#450a0a' : '#14532d'} textColor={muted ? '#f87171' : '#4ade80'}
        x={(gap * 0.5 + btnW * 0.5)} y={btnY} w={btnW} h={btnH}
        onClick={toggleMute}
      />
      {/* +30s */}
      <LCDButton
        label="+30s" color="#1e293b" textColor="#94a3b8"
        x={(gap * 1.5 + btnW * 1.5)} y={btnY} w={btnW} h={btnH}
        onClick={() => seek(30)}
      />
    </group>
  );
}

// ── VideoLCDScreen — routes to YouTube or direct video player ─────────────────
function VideoLCDScreen({
  booth,
  isYoutubePlaying,
  onToggleYoutubeVideo,
  onSeekYoutubeVideo,
}: {
  booth: Booth;
  isYoutubePlaying: boolean;
  onToggleYoutubeVideo: () => void;
  onSeekYoutubeVideo: (deltaSeconds: number) => void;
}) {
  const url = booth.videoUrl;

  if (!url) {
    // No video: show product image or dark standby screen
    return <DirectVideoLCDScreen booth={booth} />;
  }

  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <YouTubeLCDScreen
        booth={booth}
        ytId={ytId}
        isPlaying={isYoutubePlaying}
        onToggleVideo={onToggleYoutubeVideo}
        onSeekVideo={onSeekYoutubeVideo}
      />
    );
  }

  return <DirectVideoLCDScreen booth={booth} />;
}

function PdfPanelButton({
  label,
  x,
  y,
  onClick,
}: {
  label: string;
  x: number;
  y: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[x, y, 0.035]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[0.32, 0.18]} />
        <meshStandardMaterial color={hovered ? '#facc15' : '#111827'} roughness={0.12} metalness={0.55} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.07} color={hovered ? '#111827' : '#e5e7eb'} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

function BoothPdfPanel({
  booth,
  side,
  url,
  page,
  zoom,
  shouldRender,
  onPageChange,
  onZoomChange,
}: {
  booth: Booth;
  side: PdfPanelSide;
  url: string;
  page: number;
  zoom: number;
  shouldRender: boolean;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const [pageCount, setPageCount] = useState(1);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  const col = booth.themeColor || '#2563eb';
  const sideSign = side === 'left' ? -1 : 1;
  const panelW = Math.min(1.25, Math.max(0.95, booth.depth * 0.32));
  const panelH = panelW * 1.414; // A4 portrait ratio
  const panelY = Math.min(booth.height * 0.52, 1.85);

  useEffect(() => {
    if (!url) return;
    if (!shouldRender) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');

    const renderPdfPage = async () => {
      const candidates = getSpatialPdfUrlCandidates(url);
      let lastError: unknown = null;

      try {
        for (const candidateUrl of candidates) {
          try {
            const pdfBytes = await fetchPdfBytes(candidateUrl);
            const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
            const pdf = await loadingTask.promise;
            if (cancelled) return;

            const safePage = Math.max(1, Math.min(page, pdf.numPages));
            setPageCount(pdf.numPages);
            if (safePage !== page) {
              onPageChange(safePage);
              return;
            }

            const pdfPage = await pdf.getPage(safePage);
            if (cancelled) return;

            const desiredScale = Math.max(0.55, Math.min(1.35, zoom / 120));
            const rawViewport = pdfPage.getViewport({ scale: desiredScale });
            const maxTextureSide = 900;
            const fitScale = Math.min(1, maxTextureSide / Math.max(rawViewport.width, rawViewport.height));
            const viewport = pdfPage.getViewport({ scale: desiredScale * fitScale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas 2D context is unavailable');

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
            if (cancelled) return;

            const nextTexture = new THREE.CanvasTexture(canvas);
            nextTexture.colorSpace = THREE.SRGBColorSpace;
            nextTexture.anisotropy = 4;
            nextTexture.needsUpdate = true;

            textureRef.current?.dispose();
            textureRef.current = nextTexture;
            setTexture(nextTexture);
            setStatus('ready');
            return;
          } catch (error) {
            lastError = error;
          }
        }

        throw lastError ?? new Error('No PDF source candidates available');
      } catch (error) {
        if (cancelled) return;
        console.warn('Failed to render spatial PDF panel:', error);
        setErrorMessage(error instanceof Error ? error.message : 'PDF source blocked or invalid');
        setStatus('error');
      }
    };

    renderPdfPage();

    return () => {
      cancelled = true;
    };
  }, [url, page, zoom, shouldRender]);

  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
    };
  }, []);

  if (!url) return null;

  const updatePage = (nextPage: number) => onPageChange(Math.max(1, Math.min(pageCount, nextPage)));
  const updateZoom = (nextZoom: number) => onZoomChange(Math.max(60, Math.min(220, nextZoom)));

  return (
    <group
      position={[sideSign * (booth.width / 2 - 0.035), panelY, 0]}
      rotation={[0, side === 'left' ? Math.PI / 2 : -Math.PI / 2, 0]}
    >
      <mesh onClick={(e) => e.stopPropagation()}>
        <boxGeometry args={[panelW + 0.1, panelH + 0.42, 0.06]} />
        <meshStandardMaterial color="#0a0f1a" roughness={0.08} metalness={0.85} emissive={col} emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 0.12, 0.04]} onClick={(e) => e.stopPropagation()}>
        <planeGeometry args={[panelW, panelH]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.02} />
        )}
      </mesh>
      <Text
        position={[0, panelH / 2 - 0.08, 0.07]}
        fontSize={0.055}
        color={status === 'error' ? '#ef4444' : '#111827'}
        anchorX="center"
        anchorY="middle"
        maxWidth={panelW * 0.9}
      >
        {status === 'loading'
          ? 'Loading PDF...'
          : status === 'idle'
            ? 'Loading PDF...'
          : status === 'error'
            ? `PDF cannot be rendered\n${errorMessage || 'Use a direct public PDF URL'}`
            : `${side === 'left' ? 'Left' : 'Right'} PDF | Page ${page}/${pageCount} | Zoom ${zoom}%`}
      </Text>

      <PdfPanelButton label="Prev" x={-0.48} y={-(panelH / 2 + 0.12)} onClick={() => updatePage(page - 1)} />
      <PdfPanelButton label="Next" x={-0.16} y={-(panelH / 2 + 0.12)} onClick={() => updatePage(page + 1)} />
      <PdfPanelButton label="-" x={0.18} y={-(panelH / 2 + 0.12)} onClick={() => updateZoom(zoom - 20)} />
      <PdfPanelButton label="+" x={0.5} y={-(panelH / 2 + 0.12)} onClick={() => updateZoom(zoom + 20)} />
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
  onSelect,
  isYoutubePlaying,
  onToggleYoutubeVideo,
  onSeekYoutubeVideo,
  leftPdfState,
  rightPdfState,
  updatePdfPanel,
}: {
  booth: Booth;
  active: boolean;
  onSelect: () => void;
  isYoutubePlaying: boolean;
  onToggleYoutubeVideo: (booth: Booth) => void;
  onSeekYoutubeVideo: (booth: Booth, deltaSeconds: number) => void;
  leftPdfState: PdfPanelState;
  rightPdfState: PdfPanelState;
  updatePdfPanel: (boothId: string, side: PdfPanelSide, patch: Partial<PdfPanelState>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [infoHovered, setInfoHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => { document.body.style.cursor = 'auto'; };
  }, [hovered]);

  const col = booth.themeColor || '#2563eb';
  const isLit = hovered || active;

  return (
    <group
      position={[booth.posX, 0, booth.posZ]}
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
        <group
          position={[0, 0.66, 0.13]}
          onClick={(e) => {
            e.stopPropagation();
            if (booth.websiteUrl) {
              openLinkInNewWindow(booth.websiteUrl);
            }
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setInfoHovered(true);
          }}
          onPointerOut={() => setInfoHovered(false)}
        >
          <mesh position={[0, 0, -0.004]}>
            <planeGeometry args={[0.42, 0.16]} />
            <meshStandardMaterial
              color={infoHovered ? '#facc15' : '#111827'}
              emissive={infoHovered ? '#facc15' : col}
              emissiveIntensity={infoHovered ? 0.45 : 0.16}
              roughness={0.15}
              metalness={0.65}
            />
          </mesh>
          <Text
            position={[0, 0, 0.004]}
            fontSize={0.065}
            color={infoHovered ? '#111827' : '#e8c85a'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.002}
            outlineColor="#000"
          >
            INFO
          </Text>
        </group>
      </group>

      {/* 7. LCD SCREEN — video/image texture on back wall */}
      <VideoLCDScreen
        booth={booth}
        isYoutubePlaying={isYoutubePlaying}
        onToggleYoutubeVideo={() => onToggleYoutubeVideo(booth)}
        onSeekYoutubeVideo={(deltaSeconds) => onSeekYoutubeVideo(booth, deltaSeconds)}
      />

      {/* 8. SIDE PDF PANELS — replaces the old center placeholder object */}
      <BoothPdfPanel
        booth={booth}
        side="left"
        url={getBoothPdfUrl(booth, 'left')}
        page={leftPdfState.page}
        zoom={leftPdfState.zoom}
        shouldRender
        onPageChange={(page) => updatePdfPanel(booth.id, 'left', { page })}
        onZoomChange={(zoom) => updatePdfPanel(booth.id, 'left', { zoom })}
      />
      <BoothPdfPanel
        booth={booth}
        side="right"
        url={getBoothPdfUrl(booth, 'right')}
        page={rightPdfState.page}
        zoom={rightPdfState.zoom}
        shouldRender
        onPageChange={(page) => updatePdfPanel(booth.id, 'right', { page })}
        onZoomChange={(zoom) => updatePdfPanel(booth.id, 'right', { zoom })}
      />

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
// onOpenMedia is stable (useCallback in ExhibitionCanvas), so excluded from comparison
const MemoBoothStructure = React.memo(BoothStructure, (prev, next) =>
  prev.active === next.active &&
  prev.booth === next.booth &&
  prev.isYoutubePlaying === next.isYoutubePlaying &&
  prev.leftPdfState.page === next.leftPdfState.page &&
  prev.leftPdfState.zoom === next.leftPdfState.zoom &&
  prev.rightPdfState.page === next.rightPdfState.page &&
  prev.rightPdfState.zoom === next.rightPdfState.zoom
);

// Frame core to handle smoothly interpolating camera and controls states
function SceneCameraController({ visitorPos, povEnabled }: {
  visitorPos: [number, number, number];
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
      return;
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
  onCloseBooth,
  onOpenOverlay,
  onToggleYoutubeVideo,
  onSeekYoutubeVideo,
  adjustPdfPanel,
}: {
  booths: Booth[];
  selectedBooth: Booth | null;
  onCloseBooth: () => void;
  onOpenOverlay: (url: string, title: string) => void;
  onToggleYoutubeVideo: (booth: Booth) => void;
  onSeekYoutubeVideo: (booth: Booth, deltaSeconds: number) => void;
  adjustPdfPanel: (boothId: string, side: PdfPanelSide, pageDelta: number, zoomDelta: number) => void;
}) {
  const { gl } = useThree();

  // Laser beam refs
  const beamGroupRef = useRef<THREE.Group>(null);
  const beamMeshRef  = useRef<THREE.Mesh>(null);
  const dotRef       = useRef<THREE.Mesh>(null);

  // Panel interactive button mesh refs (world-space, Billboard-rotated)
  const whatsappBtnRef  = useRef<THREE.Mesh>(null);
  const catalogBtnRef   = useRef<THREE.Mesh>(null);
  const closeBtnRef     = useRef<THREE.Mesh>(null);

  const triggerWasDown  = useRef(false);
  const hitActionRef    = useRef<(() => void) | null>(null);
  const raycasterRef    = useRef(new THREE.Raycaster());

  // Only the counter INFO plate and the LCD are interactive in XR.
  const boothHitZones = useMemo(() =>
    booths.flatMap((booth) => {
      const screenW = Math.min(booth.width * 0.72, 3.2);
      const screenH = screenW * (9 / 16);
      const lcdCenter = new THREE.Vector3(
        booth.posX,
        booth.height * 0.42,
        booth.posZ - booth.depth / 2 + 0.22
      );
      const infoCenter = new THREE.Vector3(
        booth.posX + booth.width / 3.2,
        1.11,
        booth.posZ + booth.depth / 4.2 + 0.13
      );
      const zones: {
        booth: Booth;
        kind:
          | 'info'
          | 'youtube-back'
          | 'youtube-toggle'
          | 'youtube-forward'
          | 'pdf-left-prev'
          | 'pdf-left-next'
          | 'pdf-left-zoom-out'
          | 'pdf-left-zoom-in'
          | 'pdf-right-prev'
          | 'pdf-right-next'
          | 'pdf-right-zoom-out'
          | 'pdf-right-zoom-in';
        box: THREE.Box3;
      }[] = [];

      if (booth.websiteUrl) {
        zones.push({
          booth,
          kind: 'info',
          box: new THREE.Box3(
            new THREE.Vector3(infoCenter.x - 0.7, infoCenter.y - 0.45, infoCenter.z - 0.35),
            new THREE.Vector3(infoCenter.x + 0.7, infoCenter.y + 0.45, infoCenter.z + 0.35)
          ),
        });
      }

      if (getYouTubeId(booth.videoUrl || '')) {
        const barH = 0.3;
        const btnW = screenW * 0.28;
        const btnH = barH * 0.78;
        const btnY = booth.height * 0.42 - (screenH / 2 + barH / 2 + 0.04);
        zones.push({
          booth,
          kind: 'youtube-toggle',
          box: new THREE.Box3(
            new THREE.Vector3(lcdCenter.x - screenW / 2, lcdCenter.y - screenH / 2, lcdCenter.z - 0.18),
            new THREE.Vector3(lcdCenter.x + screenW / 2, lcdCenter.y + screenH / 2, lcdCenter.z + 0.18)
          ),
        });

        const controls = [
          { kind: 'youtube-back', x: booth.posX - (btnW + 0.08) },
          { kind: 'youtube-toggle', x: booth.posX },
          { kind: 'youtube-forward', x: booth.posX + btnW + 0.08 },
        ] as const;

        controls.forEach((control) => {
          zones.push({
            booth,
            kind: control.kind,
            box: new THREE.Box3(
              new THREE.Vector3(control.x - btnW / 2 - 0.12, btnY - btnH / 2 - 0.1, lcdCenter.z - 0.22),
              new THREE.Vector3(control.x + btnW / 2 + 0.12, btnY + btnH / 2 + 0.1, lcdCenter.z + 0.22)
            ),
          });
        });
      }

      (['left', 'right'] as const).forEach((side) => {
        if (!getBoothPdfUrl(booth, side)) return;
        const sideSign = side === 'left' ? -1 : 1;
        const panelW = Math.min(1.25, Math.max(0.95, booth.depth * 0.32));
        const panelH = panelW * 1.414;
        const panelY = Math.min(booth.height * 0.52, 1.85);
        const panelX = booth.posX + sideSign * (booth.width / 2 - 0.035);
        const buttonY = panelY - (panelH / 2 + 0.12);
        const buttonKinds = [
          { localX: -0.48, suffix: 'prev' },
          { localX: -0.16, suffix: 'next' },
          { localX: 0.18, suffix: 'zoom-out' },
          { localX: 0.5, suffix: 'zoom-in' },
        ] as const;

        buttonKinds.forEach(({ localX, suffix }) => {
          const buttonZ = booth.posZ + sideSign * localX;
          zones.push({
            booth,
            kind: `pdf-${side}-${suffix}` as typeof zones[number]['kind'],
            box: new THREE.Box3(
              new THREE.Vector3(panelX - 0.38, buttonY - 0.2, buttonZ - 0.28),
              new THREE.Vector3(panelX + 0.38, buttonY + 0.2, buttonZ + 0.28)
            ),
          });
        });
      });

      return zones;
    }),
    [booths]
  );

  useFrame(() => {
    if (!gl.xr.isPresenting) {
      if (beamGroupRef.current) beamGroupRef.current.visible = false;
      if (dotRef.current) dotRef.current.visible = false;
      return;
    }

    const controllerHits: {
      controller: THREE.Group;
      position: THREE.Vector3;
      quaternion: THREE.Quaternion;
      point: THREE.Vector3 | null;
      distance: number;
      action: (() => void) | null;
    }[] = [];

    for (let controllerIndex = 0; controllerIndex < 2; controllerIndex += 1) {
      const controller = gl.xr.getController(controllerIndex);
      if (!controller) continue;

      const cPos = new THREE.Vector3();
      const cQuat = new THREE.Quaternion();
      controller.getWorldPosition(cPos);
      controller.getWorldQuaternion(cQuat);
      const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cQuat).normalize();

      raycasterRef.current.set(cPos, rayDir);
      const ray = new THREE.Ray(cPos, rayDir);
      const aabbTarget = new THREE.Vector3();

      let closestDist = Infinity;
      let closestPoint: THREE.Vector3 | null = null;
      let closestAction: (() => void) | null = null;

      // When the info panel is open, test real button meshes so Billboard rotation is handled correctly.
      if (selectedBooth) {
        const wa = (selectedBooth.whatsapp || '').replace(/\+/g, '');
        const waLink = `https://api.whatsapp.com/send?phone=${wa}&text=Hello+${encodeURIComponent(selectedBooth.companyName)},+I+am+at+your+virtual+booth.`;

        const panelButtons: { mesh: THREE.Mesh | null; action: () => void }[] = [
          { mesh: whatsappBtnRef.current, action: () => window.open(waLink, '_blank') },
          ...(selectedBooth.catalogUrl
            ? [{ mesh: catalogBtnRef.current, action: () => onOpenOverlay(selectedBooth.catalogUrl!, `${selectedBooth.companyName} — Catalog`) }]
            : []),
          { mesh: closeBtnRef.current, action: onCloseBooth },
        ];

        for (const { mesh, action } of panelButtons) {
          if (!mesh) continue;
          const hits = raycasterRef.current.intersectObject(mesh, false);
          if (hits.length > 0 && hits[0].distance < closestDist) {
            closestDist = hits[0].distance;
            closestPoint = hits[0].point.clone();
            closestAction = action;
          }
        }
      }

      for (const { booth, kind, box } of boothHitZones) {
        if (!ray.intersectBox(box, aabbTarget)) continue;

        const dist = cPos.distanceTo(aabbTarget);
        if (dist >= closestDist) continue;

        closestDist = dist;
        closestPoint = aabbTarget.clone();
        if (kind === 'info') {
          closestAction = () => openLinkInNewWindow(booth.websiteUrl);
        } else if (kind === 'youtube-toggle') {
          closestAction = () => onToggleYoutubeVideo(booth);
        } else if (kind === 'youtube-back') {
          closestAction = () => onSeekYoutubeVideo(booth, -30);
        } else if (kind === 'youtube-forward') {
          closestAction = () => onSeekYoutubeVideo(booth, 30);
        } else {
          const side: PdfPanelSide = kind.includes('left') ? 'left' : 'right';
          if (kind.endsWith('prev')) {
            closestAction = () => adjustPdfPanel(booth.id, side, -1, 0);
          } else if (kind.endsWith('next')) {
            closestAction = () => adjustPdfPanel(booth.id, side, 1, 0);
          } else if (kind.endsWith('zoom-out')) {
            closestAction = () => adjustPdfPanel(booth.id, side, 0, -20);
          } else {
            closestAction = () => adjustPdfPanel(booth.id, side, 0, 20);
          }
        }
      }

      controllerHits.push({
        controller,
        position: cPos,
        quaternion: cQuat,
        point: closestPoint,
        distance: closestDist,
        action: closestAction,
      });
    }

    const bestHit =
      controllerHits
        .filter((hit) => hit.point && hit.action)
        .sort((a, b) => a.distance - b.distance)[0] ?? controllerHits[0];

    hitActionRef.current = bestHit?.action ?? null;

    if (bestHit) {
      const beamLen = Math.min(bestHit.point ? bestHit.distance : 10, 14);
      if (beamGroupRef.current) {
        beamGroupRef.current.visible = true;
        beamGroupRef.current.position.copy(bestHit.position);
        beamGroupRef.current.quaternion.copy(bestHit.quaternion);
      }
      if (beamMeshRef.current) {
        beamMeshRef.current.scale.set(1, 1, beamLen);
        beamMeshRef.current.position.set(0, 0, -beamLen / 2);
        const mat = beamMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.color.setHex(bestHit.point ? 0x00e5ff : 0xffffff);
        mat.opacity = bestHit.point ? 0.95 : 0.4;
      }
      if (dotRef.current) {
        if (bestHit.point) {
          dotRef.current.visible = true;
          dotRef.current.position.copy(bestHit.point);
        } else {
          dotRef.current.visible = false;
        }
      }
    }

    const session = gl.xr.getSession();
    if (session) {
      let trigDown = false;
      for (const src of session.inputSources) {
        if (src.gamepad?.buttons[0]?.pressed) {
          trigDown = true;
          break;
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

          {/* ── CATALOG BUTTON (only if catalogUrl exists) */}
          {booth.catalogUrl && (
            <>
              <mesh ref={catalogBtnRef} position={[-0.55, -PH / 2 + 0.3, 0.01]}>
                <planeGeometry args={[0.78, 0.38]} />
                <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.4} roughness={0.05} metalness={0.7} />
              </mesh>
              <Text position={[-0.55, -PH / 2 + 0.3, 0.018]} fontSize={0.095} color="white" anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor="#000">
                Catalog
              </Text>
            </>
          )}

          {/* ── WHATSAPP BUTTON */}
          <mesh ref={whatsappBtnRef} position={[booth.catalogUrl ? 0.55 : 0, -PH / 2 + 0.3, 0.01]}>
            <planeGeometry args={[0.92, 0.38]} />
            <meshStandardMaterial color="#15803d" emissive="#15803d" emissiveIntensity={0.4} roughness={0.05} metalness={0.7} />
          </mesh>
          <Text position={[booth.catalogUrl ? 0.55 : 0, -PH / 2 + 0.3, 0.018]} fontSize={0.105} color="white" anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor="#000">
            WhatsApp
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
    setTeleportTarget(null);
  });

  return null;
}

function DesktopOrbitControls({ visitorPos }: { visitorPos: [number, number, number] }) {
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls> | null>(null);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      isInteractingRef.current = true;
    };
    const handleEnd = () => {
      isInteractingRef.current = false;
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || isInteractingRef.current) return;

    controls.target.set(visitorPos[0], 1.2, visitorPos[2]);
    controls.update();
  }, [visitorPos]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      enableZoom
      enablePan
      screenSpacePanning
      zoomSpeed={0.9}
      panSpeed={0.8}
      rotateSpeed={0.75}
      minDistance={2}
      maxDistance={45}
      maxPolarAngle={Math.PI / 2.08}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}

function HumanPOVXRButton({
  visitorPos,
  povEnabled,
  setPovEnabled,
  setTeleportTarget,
  xrActive,
  setXrActive,
  overlayRef,
}: {
  visitorPos: [number, number, number];
  povEnabled: boolean;
  setPovEnabled: (enabled: boolean) => void;
  setTeleportTarget: (pos: [number, number, number] | null) => void;
  xrActive: boolean;
  setXrActive: (active: boolean) => void;
  overlayRef: React.RefObject<HTMLDivElement | null>;
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

      const optFeatures = ['local-floor', 'bounded-floor', 'hand-tracking'];
      const overlayEl = overlayRef.current;
      if (overlayEl) optFeatures.push('dom-overlay');

      const session = await xr.requestSession(VR_SESSION_MODE, {
        optionalFeatures: optFeatures,
        ...(overlayEl ? { domOverlay: { root: overlayEl } } : {}),
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

// ── VR Browser Panel — rendered into DOM overlay; visible as 2D layer inside Quest 3 headset
function VRBrowserPanel({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [iframeError, setIframeError] = useState(false);
  const [pdfPage, setPdfPage] = useState(() => {
    const pageMatch = url.match(/[?#&]page=(\d+)/i);
    return pageMatch ? Math.max(1, Number(pageMatch[1])) : 1;
  });
  const [pdfZoom, setPdfZoom] = useState(() => {
    const zoomMatch = url.match(/[?#&]zoom=(\d+)/i);
    return zoomMatch ? Math.max(60, Math.min(220, Number(zoomMatch[1]))) : 100;
  });
  const [youtubePlaying, setYoutubePlaying] = useState(true);
  const [youtubeSeconds, setYoutubeSeconds] = useState(0);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingYouTubeCommandRef = useRef<YouTubeLCDCommand | null>(null);
  const [youtubeFrameReady, setYoutubeFrameReady] = useState(false);
  const isVideo = /\.(mp4|webm|ogg)([?#].*)?$/i.test(url);
  const isPdf   = /\.(pdf)([?#].*)?$/i.test(url) || url.includes('drive.google.com');
  const isYouTube = url.includes('youtube.com/embed/');

  useEffect(() => {
    setYoutubeFrameReady(false);
    pendingYouTubeCommandRef.current = null;
  }, [url]);

  const sendYouTubeCommand = (func: string, args: unknown[] = []) => {
    youtubeIframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      'https://www.youtube.com'
    );
  };

  useEffect(() => {
    if (!isYouTube || !youtubePlaying) return;
    const timer = window.setInterval(() => {
      setYoutubeSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isYouTube, youtubePlaying]);

  const toggleYouTubePlayback = () => {
    if (youtubePlaying) {
      sendYouTubeCommand('pauseVideo');
      setYoutubePlaying(false);
    } else {
      sendYouTubeCommand('playVideo');
      setYoutubePlaying(true);
    }
  };

  const seekYouTube = (deltaSeconds: number) => {
    const nextSeconds = Math.max(0, youtubeSeconds + deltaSeconds);
    setYoutubeSeconds(nextSeconds);
    sendYouTubeCommand('seekTo', [nextSeconds, true]);
    if (!youtubePlaying) {
      sendYouTubeCommand('playVideo');
      setYoutubePlaying(true);
    }
  };

  useEffect(() => {
    if (!isYouTube) return;

    const handleLCDCommand = (event: Event) => {
      const command = (event as CustomEvent<YouTubeLCDCommand>).detail;
      if (!command) return;
      if (!youtubeFrameReady) {
        pendingYouTubeCommandRef.current = command;
        return;
      }

      if (command.type === 'toggle') {
        toggleYouTubePlayback();
      } else if (command.type === 'seek') {
        seekYouTube(command.deltaSeconds ?? 0);
      }
    };

    window.addEventListener('exhibition-youtube-command', handleLCDCommand);
    return () => window.removeEventListener('exhibition-youtube-command', handleLCDCommand);
  }, [isYouTube, youtubeFrameReady, youtubePlaying, youtubeSeconds]);

  useEffect(() => {
    if (!youtubeFrameReady || !pendingYouTubeCommandRef.current) return;

    const command = pendingYouTubeCommandRef.current;
    pendingYouTubeCommandRef.current = null;
    window.setTimeout(() => dispatchYouTubeLCDCommand(command), 150);
  }, [youtubeFrameReady]);

  const pdfBaseUrl = url.split('#')[0];
  const pdfViewerUrl = getPdfViewerUrl(pdfBaseUrl, pdfPage, pdfZoom);

  if (isYouTube) {
    return (
      <div style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 99999,
        width: 'min(560px, 46vw)',
        background: 'rgba(8,9,13,0.96)',
        border: '1px solid #1e2a3a',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '9px 12px',
          background: '#0d111a',
          borderBottom: '1px solid #1e2a3a',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, color: '#ef4444', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2 }}>
              YouTube LCD Playing
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </p>
          </div>
          <button
            onClick={toggleYouTubePlayback}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              background: youtubePlaying ? '#7f1d1d' : '#14532d',
              border: `1px solid ${youtubePlaying ? '#991b1b' : '#166534'}`,
              color: youtubePlaying ? '#fecaca' : '#bbf7d0',
              fontSize: 11,
              fontFamily: 'monospace',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {youtubePlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#1f2937',
              border: '1px solid #374151',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            X
          </button>
        </div>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000' }}>
          <iframe
            ref={youtubeIframeRef}
            src={url}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => setYoutubeFrameReady(true)}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          padding: 10,
          background: '#0a0e18',
          borderTop: '1px solid #1e2a3a',
        }}>
          {[
            { label: '-30s', action: () => seekYouTube(-30) },
            { label: '-10s', action: () => seekYouTube(-10) },
            { label: youtubePlaying ? 'Pause' : 'Play', action: toggleYouTubePlayback },
            { label: '+10s', action: () => seekYouTube(10) },
            { label: '+30s', action: () => seekYouTube(30) },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                padding: '9px 6px',
                borderRadius: 8,
                border: '1px solid #263244',
                background: '#111827',
                color: '#e5e7eb',
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(8,9,13,0.97)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', background: '#0d111a',
        borderBottom: '1px solid #1e2a3a', flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2 }}>
            VR Browser
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '6px 14px', background: '#1e2a3a', color: '#94a3b8',
            borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
            textDecoration: 'none', border: '1px solid #2d3f55',
          }}
        >
          Open Tab ↗
        </a>
        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#7f1d1d', border: 'none', color: '#fca5a5',
            fontSize: 18, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* URL bar */}
      <div style={{
        padding: '8px 16px', background: '#0a0e18',
        borderBottom: '1px solid #1e2a3a', flexShrink: 0,
      }}>
        <div style={{
          background: '#141824', border: '1px solid #1e2a3a', borderRadius: 6,
          padding: '6px 12px', color: '#64748b', fontSize: 11,
          fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {url}
        </div>
      </div>

      {isPdf && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          padding: '10px 16px',
          background: '#0d111a',
          borderBottom: '1px solid #1e2a3a',
          flexShrink: 0,
        }}>
          {[
            { label: 'Prev', action: () => setPdfPage((page) => Math.max(1, page - 1)) },
            { label: 'Next', action: () => setPdfPage((page) => page + 1) },
            { label: '-', action: () => setPdfZoom((zoom) => Math.max(60, zoom - 20)) },
            { label: '+', action: () => setPdfZoom((zoom) => Math.min(220, zoom + 20)) },
            { label: `P${pdfPage} ${pdfZoom}%`, action: () => undefined },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                padding: '9px 6px',
                borderRadius: 8,
                border: '1px solid #263244',
                background: '#111827',
                color: '#e5e7eb',
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <>
            {!iframeError ? (
              <iframe
                src={isPdf ? pdfViewerUrl : url}
                title={title}
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                onError={() => setIframeError(true)}
              />
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 16, color: '#94a3b8',
              }}>
                <div style={{ fontSize: 40 }}>🔒</div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  این سایت اجازه نمایش در iframe را نمی‌دهد
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 24px', background: '#0ea5e9', color: '#fff',
                    borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                  }}
                >
                  باز کردن در مرورگر ↗
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      {!isVideo && (
        <div style={{
          padding: '8px 16px', background: '#0a0e18',
          borderTop: '1px solid #1e2a3a', fontSize: 10,
          color: '#334155', fontFamily: 'monospace', textAlign: 'center', flexShrink: 0,
        }}>
          {isPdf ? 'PDF Catalog Viewer' : 'اگر صفحه لود نشد از دکمه "Open Tab" استفاده کنید'}
        </div>
      )}
    </div>
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
  const [activeYoutubeBoothId, setActiveYoutubeBoothId] = useState<string | null>(null);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [pdfPanelStates, setPdfPanelStates] = useState<Record<string, PdfPanelState>>({});

  // VR Browser Overlay state
  const vrOverlayRef  = useRef<HTMLDivElement | null>(null);
  const [vrOverlayUrl, setVrOverlayUrl]   = useState<string | null>(null);
  const [vrOverlayTitle, setVrOverlayTitle] = useState('');

  const getPdfPanelState = useCallback((boothId: string, side: PdfPanelSide): PdfPanelState => {
    return pdfPanelStates[`${boothId}:${side}`] ?? { page: 1, zoom: 100 };
  }, [pdfPanelStates]);

  const updatePdfPanel = useCallback((boothId: string, side: PdfPanelSide, patch: Partial<PdfPanelState>) => {
    setPdfPanelStates((current) => {
      const key = `${boothId}:${side}`;
      const previous = current[key] ?? { page: 1, zoom: 100 };
      return {
        ...current,
        [key]: {
          page: Math.max(1, patch.page ?? previous.page),
          zoom: Math.max(60, Math.min(220, patch.zoom ?? previous.zoom)),
        },
      };
    });
  }, []);

  const adjustPdfPanel = useCallback((boothId: string, side: PdfPanelSide, pageDelta: number, zoomDelta: number) => {
    setPdfPanelStates((current) => {
      const key = `${boothId}:${side}`;
      const previous = current[key] ?? { page: 1, zoom: 100 };
      return {
        ...current,
        [key]: {
          page: Math.max(1, previous.page + pageDelta),
          zoom: Math.max(60, Math.min(220, previous.zoom + zoomDelta)),
        },
      };
    });
  }, []);

  const handleOpenOverlay = useCallback((url: string, title: string) => {
    setActiveYoutubeBoothId(null);
    setYoutubePlaying(false);
    setVrOverlayUrl(url);
    setVrOverlayTitle(title);
  }, []);

  const handleToggleYoutubeVideo = useCallback((booth: Booth) => {
    const ytId = getYouTubeId(booth.videoUrl || '');
    if (!ytId) return;

    setActiveYoutubeBoothId((currentBoothId) => {
      if (currentBoothId === booth.id) {
        dispatchYouTubeLCDCommand({ type: 'toggle' });
        setYoutubePlaying((playing) => !playing);
        return currentBoothId;
      }

      setVrOverlayUrl(toYouTubeEmbed(ytId));
      setVrOverlayTitle(`${booth.companyName} - YouTube`);
      setYoutubePlaying(true);
      return booth.id;
    });
  }, []);

  const handleSeekYoutubeVideo = useCallback((booth: Booth, deltaSeconds: number) => {
    const ytId = getYouTubeId(booth.videoUrl || '');
    if (!ytId) return;

    setActiveYoutubeBoothId((currentBoothId) => {
      if (currentBoothId !== booth.id) {
        setVrOverlayUrl(toYouTubeEmbed(ytId));
        setVrOverlayTitle(`${booth.companyName} - YouTube`);
        window.setTimeout(() => dispatchYouTubeLCDCommand({ type: 'seek', deltaSeconds }), 250);
        return booth.id;
      }

      dispatchYouTubeLCDCommand({ type: 'seek', deltaSeconds });
      return currentBoothId;
    });
    setYoutubePlaying(true);
  }, []);

  // Walk on floor click trigger
  const handleFloorClick = (point: THREE.Vector3) => {
    // Keep visitor strictly inside limits of hall margins
    const margin = 2; // bound limits
    const targetX = Math.max(-hall.width / 2 + margin, Math.min(hall.width / 2 - margin, point.x));
    const targetZ = Math.max(-hall.depth / 2 + margin, Math.min(hall.depth / 2 - margin, point.z));
    
    setTeleportTarget(null);
    setVisitorPos([targetX, VISITOR_BODY_HEIGHT, targetZ]);
  };

  // Synchronize when a custom booth model selection is clicked outside or requested
  useEffect(() => {
    if (activeBoothId) {
      const activeBooth = booths.find(b => b.id === activeBoothId);
      if (activeBooth) {
        const target: [number, number, number] = [activeBooth.posX, 0, activeBooth.posZ + 3.4];
        setVisitorPos([target[0], VISITOR_BODY_HEIGHT, target[2]]);
        setTeleportTarget(null);
      }
    }
  }, [activeBoothId, booths, setVisitorPos]);

  return (
    <div id="exhibition-render-container" className="w-full h-full relative bg-neutral-950">

      {/* ── VR DOM Overlay root — must stay in the DOM at all times so Quest 3 can reference it.
           Content is injected via React portal when vrOverlayUrl is set. */}
      <div ref={vrOverlayRef} id="xr-dom-overlay" style={{ display: 'contents' }} />
      {vrOverlayUrl && vrOverlayRef.current && createPortal(
        <VRBrowserPanel
          url={vrOverlayUrl}
          title={vrOverlayTitle}
          onClose={() => {
            setVrOverlayUrl(null);
            setActiveYoutubeBoothId(null);
            setYoutubePlaying(false);
          }}
        />,
        vrOverlayRef.current
      )}
      <Canvas
        shadows={false}
        camera={{ position: [0, 8, 16], fov: 50 }}
        className="w-full h-full"
        // Keep laptop rendering light; users can still zoom in with the camera.
        dpr={[0.75, 1]}
        performance={{ min: 0.35 }}
        // Prefer high-performance GPU on dual-GPU laptops/tablets
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#12151a']} />

        {/* Bright professional exhibition ambient — fills shadows */}
        <ambientLight intensity={2.2} color="#f8f4ee" />

        {/* Sky hemisphere — warm ceiling / cool floor bounce */}
        <hemisphereLight color="#fff8f0" groundColor="#d0ccc4" intensity={1.8} />

        {/* Primary overhead directional (hall-wide fill) */}
        <directionalLight
          position={[0, 18, 6]}
          intensity={2.6}
          color="#ffffff"
        />

        {/* Front-fill directional to eliminate harsh back-shadows on booth faces */}
        <directionalLight position={[0, 8, 14]} intensity={1.4} color="#fff8f0" />

        {/* Lightweight exhibition accent lighting for laptop performance */}
        <pointLight position={[-9, 8, -7]} intensity={2.4} distance={18} color="#fff6e8" />
        <pointLight position={[9, 8, -7]} intensity={2.4} distance={18} color="#fff6e8" />
        <pointLight position={[-9, 8, 7]} intensity={2.2} distance={18} color="#fff6e8" />
        <pointLight position={[9, 8, 7]} intensity={2.2} distance={18} color="#fff6e8" />

        {/* Centre aisle accent lights — blue-white display lighting */}
        <pointLight position={[0, 6, 0]} intensity={1.8} distance={14} color="#e8f4ff" />

        {/* 3D Exhibition Structure Geometries */}
        <Suspense fallback={null}>
          <GroundPlane hall={hall} onFloorClick={handleFloorClick} />
          <IndustrialCeiling hall={hall} />
          <ExhibitionWall hall={hall} />

          {/* Symmetrical positioned trade stalls — memoised to skip re-renders */}
          {booths.map((booth) => (
            <MemoBoothStructure
              key={booth.id}
              booth={booth}
              active={activeBoothId === booth.id}
              onSelect={() => onSelectBooth(booth)}
              isYoutubePlaying={activeYoutubeBoothId === booth.id && youtubePlaying}
              onToggleYoutubeVideo={handleToggleYoutubeVideo}
              onSeekYoutubeVideo={handleSeekYoutubeVideo}
              leftPdfState={getPdfPanelState(booth.id, 'left')}
              rightPdfState={getPdfPanelState(booth.id, 'right')}
              updatePdfPanel={updatePdfPanel}
            />
          ))}
        </Suspense>

        <SceneCameraController 
          visitorPos={visitorPos} 
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
          overlayRef={vrOverlayRef}
        />

        {/* Quest 3: left stick walk + right stick snap turn */}
        {xrActive && (
          <XRLocomotionController
            hall={hall}
            setVisitorPos={setVisitorPos}
          />
        )}

        {/* Quest 3: right-controller ray + in-world info panel + VR overlay browser */}
        {xrActive && (
          <XRInteractionSystem
            booths={booths}
            selectedBooth={activeBoothId ? (booths.find(b => b.id === activeBoothId) ?? null) : null}
            onCloseBooth={onCloseBooth}
            onOpenOverlay={handleOpenOverlay}
            onToggleYoutubeVideo={handleToggleYoutubeVideo}
            onSeekYoutubeVideo={handleSeekYoutubeVideo}
            adjustPdfPanel={adjustPdfPanel}
          />
        )}

        {/* Desktop camera controls — disabled while XR headset is presenting */}
        {!xrActive && (
          povEnabled ? (
            <PointerLockControls />
          ) : (
            <DesktopOrbitControls visitorPos={visitorPos} />
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
