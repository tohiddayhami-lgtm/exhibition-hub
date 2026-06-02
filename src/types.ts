export interface Hall {
  id: string;
  name: string;
  width: number; // in meters (e.g. 30)
  depth: number; // in meters (e.g. 20)
  height: number; // in meters (e.g. 6)
  description?: string;
  coverImageUrl?: string;
  boothCount?: number;
  createdAt: any;
  updatedAt: any;
}

export interface Booth {
  id: string;
  hallId: string;
  boothNumber: string;
  companyName: string;
  category: string;
  description: string;
  width: number;  // in meters (e.g. 4)
  depth: number;  // in meters (e.g. 3)
  height: number; // in meters (e.g. 3)
  posX: number;   // X-coordinate in 3D scene (meters from center)
  posZ: number;   // Z-coordinate in 3D scene (meters from center)
  themeColor: string; // Hex color for booth trim
  logoUrl: string; // Data URL or Web link
  bannerUrl: string; // Banner background
  productImageUrl: string; // Featured product image
  websiteUrl: string;
  whatsapp: string; // Phone number for chat
  videoUrl: string; // Direct MP4 URL played on the in-booth LCD screen
  catalogUrl?: string; // Left-side PDF/catalog URL shown in the in-hall viewer
  pdfRightUrl?: string; // Right-side PDF/catalog URL shown in the in-hall viewer
  pdfLeftX?: number; // Left PDF local X offset inside booth
  pdfLeftY?: number; // Left PDF height from floor
  pdfLeftZ?: number; // Left PDF local Z offset inside booth
  pdfLeftYaw?: number; // Left PDF rotation in degrees
  pdfRightX?: number; // Right PDF local X offset inside booth
  pdfRightY?: number; // Right PDF height from floor
  pdfRightZ?: number; // Right PDF local Z offset inside booth
  pdfRightYaw?: number; // Right PDF rotation in degrees
  stylePreset: 'classic' | 'modern' | 'minimalist' | 'futuristic';
  modelUrl?: string; // Optional custom loaded GLB/GLTF file URL
  modelScale?: number; // Scale multiplier for GLB
  createdAt: any;
  updatedAt: any;
}

export interface VisitorState {
  posX: number;
  posZ: number;
  rotationY: number;
  activeView: 'explore' | 'map' | 'editor';
}
