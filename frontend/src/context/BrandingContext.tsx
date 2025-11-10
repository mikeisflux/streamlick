import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '../services/api';

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  platformName: string;
  tagline: string;
}

interface BrandingSettings {
  config: BrandingConfig;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroUrl: string | null;
}

interface BrandingContextType {
  branding: BrandingSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const response = await api.get('/branding');
      setBranding(response.data);

      // Update favicon if available
      if (response.data.faviconUrl) {
        updateFavicon(response.data.faviconUrl);
      }

      // Update document title with platform name
      if (response.data.config?.platformName) {
        document.title = response.data.config.platformName;
      }
    } catch (error: any) {
      console.log('Branding not available, using defaults');
      // Use defaults if API fails (normal for public pages)
      setBranding({
        config: {
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          accentColor: '#ec4899',
          platformName: 'Streamlick',
          tagline: 'Browser-based Live Streaming Studio',
        },
        logoUrl: null,
        faviconUrl: null,
        heroUrl: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFavicon = (faviconUrl: string) => {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());

    // Add new favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = faviconUrl.startsWith('http') ? faviconUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${faviconUrl}`;
    document.head.appendChild(link);
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const refresh = async () => {
    setLoading(true);
    await fetchBranding();
  };

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
