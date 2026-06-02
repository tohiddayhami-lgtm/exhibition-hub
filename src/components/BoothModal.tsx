import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, MessageSquare, Tag, FileText, Video, Play, Award, CheckCircle } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, PresentationControls } from '@react-three/drei';
import { Booth } from '../types';

interface BoothModalProps {
  booth: Booth | null;
  isOpen: boolean;
  onClose: () => void;
}

// Interactive 3D Product mesh for the showroom based on the exhibitor theme or category
function ProductShowcaseMesh({ stylePreset }: { stylePreset: string }) {
  if (stylePreset === 'futuristic') {
    return (
      <mesh castShadow receiveShadow>
        <torusKnotGeometry args={[1, 0.35, 120, 16]} />
        <meshStandardMaterial 
          color="#38bdf8" 
          roughness={0.1} 
          metalness={0.8}
          emissive="#0284c7"
          emissiveIntensity={0.2}
        />
      </mesh>
    );
  } else if (stylePreset === 'modern') {
    return (
      <mesh castShadow receiveShadow>
        <octahedronGeometry args={[1.3, 0]} />
        <meshStandardMaterial 
          color="#a855f7" 
          roughness={0.2} 
          metalness={0.9} 
          wireframe={false}
        />
      </mesh>
    );
  } else if (stylePreset === 'minimalist') {
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial 
          color="#22c55e" 
          roughness={0.4} 
          metalness={0.2} 
        />
      </mesh>
    );
  } else {
    return (
      <mesh castShadow receiveShadow>
        <coneGeometry args={[1.1, 2.2, 32]} />
        <meshStandardMaterial 
          color="#f59e0b" 
          roughness={0.15} 
          metalness={0.7} 
        />
      </mesh>
    );
  }
}

export default function BoothModal({ booth, isOpen, onClose }: BoothModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'showroom' | 'media'>('overview');
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  if (!booth) return null;

  const styleColors: Record<string, string> = {
    futuristic: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    modern: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    minimalist: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    classic: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  };

  const formattedWhatsapp = booth.whatsapp ? booth.whatsapp.replace(/\+/g, '') : '';
  const waLink = `https://api.whatsapp.com/send?phone=${formattedWhatsapp}&text=Hello+${encodeURIComponent(booth.companyName)},+I+am+visiting+your+virtual+exhibition+booth+${booth.boothNumber}.+I+would+like+more+information.`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-50 transition-all duration-300"
          />

          {/* Drawer / Modal Container */}
          <motion.div
            id={`booth-modal-${booth.id}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 225 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] lg:w-[650px] bg-white border-l border-[#E0E4E8] text-[#1A1D21] flex flex-col z-50 shadow-2xl overflow-hidden"
          >
            {/* Top Masthead with Brand Banner Image */}
            <div className="relative h-48 bg-[#F8F9FA] overflow-hidden shrink-0 border-b border-[#E0E4E8]">
              {booth.bannerUrl ? (
                <img
                  src={booth.bannerUrl}
                  alt={booth.companyName}
                  className="w-full h-full object-cover opacity-90"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div 
                  className="w-full h-full opacity-80" 
                  style={{ backgroundColor: booth.themeColor || '#E0E4E8' }}
                />
              )}
              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent/45" />

              {/* Close Button */}
              <button
                id="close-booth-modal-btn"
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-white/95 border border-[#E0E4E8] hover:bg-neutral-50 text-[#1A1D21] transition-all hover:scale-105 shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Brand Floating Metadata */}
              <div className="absolute bottom-4 left-6 right-6 flex items-end gap-4">
                {booth.logoUrl && (
                  <img
                    src={booth.logoUrl}
                    alt={`${booth.companyName} logo`}
                    className="w-16 h-16 rounded-md bg-white p-1 object-contain shadow-md ring-1 ring-[#E0E4E8] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/95 text-[#1A1D21] text-[9px] font-mono tracking-widest font-bold uppercase px-2 py-0.5 rounded border border-[#E0E4E8]">
                      Booth {booth.boothNumber}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${styleColors[booth.stylePreset] || styleColors.classic}`}>
                      Preset: {booth.stylePreset}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight text-[#1A1D21] mt-1.5 truncate">
                    {booth.companyName}
                  </h2>
                </div>
              </div>
            </div>

            {/* Sticky Navigation Tabs */}
            <div className="flex bg-[#F8F9FA] border-b border-[#E0E4E8] text-xs font-mono font-bold tracking-widest uppercase px-6 shrink-0 select-none">
              <button
                id="tab-overview"
                onClick={() => setActiveTab('overview')}
                className={`py-3.5 px-3 border-b-2 font-bold transition-all mr-4 cursor-pointer ${
                  activeTab === 'overview'
                    ? 'border-[#1A1D21] text-[#1A1D21]'
                    : 'border-transparent text-neutral-450 hover:text-neutral-600'
                }`}
              >
                Overview
              </button>
              <button
                id="tab-showroom"
                onClick={() => setActiveTab('showroom')}
                className={`py-3.5 px-3 border-b-2 font-bold transition-all mr-4 cursor-pointer ${
                  activeTab === 'showroom'
                    ? 'border-[#1A1D21] text-[#1A1D21]'
                    : 'border-transparent text-neutral-450 hover:text-neutral-600'
                }`}
              >
                3D Showroom
              </button>
              <button
                id="tab-media"
                onClick={() => setActiveTab('media')}
                className={`py-3.5 px-3 border-b-2 font-bold transition-all cursor-pointer ${
                  activeTab === 'media'
                    ? 'border-[#1A1D21] text-[#1A1D21]'
                    : 'border-transparent text-neutral-450 hover:text-neutral-600'
                }`}
              >
                Media & Video
              </button>
            </div>

            {/* Scrollable Content Engine */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-white">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Category Banner */}
                  <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#E0E4E8] px-4 py-3 rounded text-[#1A1D21]">
                    <Tag className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span className="text-[10px] font-mono tracking-widest font-bold uppercase text-neutral-500">Industry:</span>
                    <span className="text-sm font-bold ml-1">{booth.category}</span>
                  </div>

                  {/* Profile Description */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">About Company</h3>
                    <p className="text-sm text-neutral-750 leading-relaxed font-sans font-medium">
                      {booth.description || 'Welcome to our virtual booth slot! We are exhibiting our high quality commercial catalog. Connect with our partner links below.'}
                    </p>
                  </div>

                  {/* Highlight Specs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#F8F9FA] p-3.5 rounded border border-[#E0E4E8]">
                      <h4 className="text-[10px] font-mono text-neutral-450 uppercase tracking-widest font-bold">Booth Area</h4>
                      <p className="text-lg font-bold text-[#1A1D21] mt-1">{(booth.width * booth.depth).toFixed(1)} sqm</p>
                      <p className="text-[10px] font-mono text-neutral-400 mt-0.5 font-bold uppercase">{booth.width}m × {booth.depth}m</p>
                    </div>
                    <div className="bg-[#F8F9FA] p-3.5 rounded border border-[#E0E4E8]">
                      <h4 className="text-[10px] font-mono text-neutral-450 uppercase tracking-widest font-bold">Height Clearance</h4>
                      <p className="text-lg font-bold text-[#1A1D21] mt-1">{booth.height}m</p>
                      <p className="text-[10px] font-mono text-neutral-400 mt-0.5 font-bold uppercase">High Ceiling Stand</p>
                    </div>
                  </div>

                  {/* Main Product Feature Section */}
                  {booth.productImageUrl && (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1A1D21]">Featured Innovation</h3>
                      <div className="relative rounded overflow-hidden border border-[#E0E4E8] bg-[#F8F9FA] group">
                        <img
                          src={booth.productImageUrl}
                          alt="Company Showcase"
                          className="w-full max-h-[220px] object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-transparent" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* showroom Tab with full ThreeJS interactive Canvas */}
              {activeTab === 'showroom' && (
                <div className="space-y-5 flex flex-col h-full min-h-[350px]">
                  <div className="flex-1 min-h-[280px] bg-[#F8F9FA] rounded relative border border-[#E0E4E8] overflow-hidden flex flex-col">
                    <div className="absolute top-3 left-3 bg-white/95 text-[#1A1D21] border border-[#E0E4E8] px-2.5 py-1 rounded text-[10px] z-10 font-mono tracking-wide font-bold">
                      Drag to rotate • Pinch to zoom
                    </div>

                    <div className="w-full h-full flex-1">
                      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 4.5], fov: 45 }}>
                        <ambientLight intensity={0.6} />
                        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
                        <directionalLight position={[-8, 12, 8]} intensity={1.0} castShadow />
                        
                        <Stage intensity={0.5} environment="city" adjustCamera={false}>
                          <ProductShowcaseMesh stylePreset={booth.stylePreset} />
                        </Stage>
                        <OrbitControls 
                          enableZoom={true} 
                          enablePan={false} 
                          autoRotate 
                          autoRotateSpeed={1.5}
                        />
                      </Canvas>
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold font-sans text-[#1A1D21]">
                      Product Architecture Showpiece
                    </h4>
                    <p className="text-xs text-neutral-400 font-mono">
                      Interactive 3D model representing {booth.companyName}&apos;s catalog design suite.
                    </p>
                  </div>
                </div>
              )}

              {/* Media Tab containing Custom Video Playback and Catalogs */}
              {activeTab === 'media' && (
                <div className="space-y-6">
                  {/* Video Block */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1A1D21]">Introduction Video Screen</h3>
                    <div className="relative rounded overflow-hidden border border-[#E0E4E8] bg-neutral-100 aspect-video">
                      {isPlayingVideo && booth.videoUrl ? (
                        <video
                          src={booth.videoUrl}
                          controls
                          autoPlay
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-6 group">
                          {booth.bannerUrl && (
                            <img
                              src={booth.bannerUrl}
                              alt="Poster background"
                              className="absolute inset-0 w-full h-full object-cover opacity-40"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="absolute inset-0 bg-white/20" />

                          <button
                            id="play-video-btn"
                            className="relative z-10 w-16 h-16 rounded-full bg-[#1A1D21] hover:bg-[#2C3036] text-white flex items-center justify-center shadow transition-all hover:scale-105 cursor-pointer"
                            onClick={() => setIsPlayingVideo(true)}
                          >
                            <Play className="w-6 h-6 fill-white ml-1 text-white" />
                          </button>
                          <span className="relative z-10 mt-3 text-xs font-bold text-[#1A1D21] tracking-wide font-sans">
                            Play Digital Showcase Screen
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Catalog Button */}
                  <div className="p-4 bg-[#F8F9FA] border border-[#E0E4E8] rounded-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-white border border-[#E0E4E8] text-[#1A1D21]">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Product Catalog</h4>
                        <p className="text-sm font-bold text-[#1A1D21] truncate mt-0.5">Exhibition_Portfolio.pdf</p>
                      </div>
                    </div>
                    <a
                      id="view-catalog-link"
                      href={booth.websiteUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white border border-[#E0E4E8] hover:bg-neutral-50 text-[#1A1D21] font-bold text-xs py-2 px-4 rounded transition-all font-sans cursor-pointer whitespace-nowrap"
                    >
                      Open PDF Catalog
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Contact actions block */}
            <div className="p-6 bg-[#F8F9FA] border-t border-[#E0E4E8] grid grid-cols-2 gap-4 shrink-0 font-sans">
              <a
                id="booth-modal-website-btn"
                href={booth.websiteUrl || 'https://google.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white hover:bg-neutral-50 text-[#1A1D21] font-bold py-3 px-4 rounded border border-[#E0E4E8] cursor-pointer transition-all hover:border-neutral-400 focus:outline-none text-xs"
              >
                <Globe className="w-4 h-4 text-neutral-450" />
                <span>Visit Booth Website</span>
              </a>

              <a
                id="booth-modal-whatsapp-btn"
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#1A1D21] hover:bg-[#2C3036] text-white font-bold py-3 px-4 rounded cursor-pointer transition-all shadow-sm focus:outline-none text-xs"
              >
                <MessageSquare className="w-4 h-4 fill-white text-white" />
                <span>Connect via Chat</span>
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
