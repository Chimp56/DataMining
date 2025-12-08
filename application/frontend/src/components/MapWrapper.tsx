import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, MapContainerProps } from 'react-leaflet';

/**
 * Wrapper component to prevent double initialization of Leaflet maps
 * when using React.StrictMode in development.
 * 
 * React.StrictMode intentionally mounts components twice in development,
 * which causes Leaflet to try initializing the map container twice.
 * This wrapper ensures the map only renders after StrictMode's double-mount cycle.
 */
interface MapWrapperProps extends MapContainerProps {
  children: React.ReactNode;
}

// Module-level counter to ensure unique map instances
let mapInstanceCounter = 0;

const MapWrapper: React.FC<MapWrapperProps> = ({ children, ...mapProps }) => {
  const [isReady, setIsReady] = useState(false);
  const instanceIdRef = useRef<number | null>(null);
  const skipInitialMountRef = useRef(false);

  // Generate unique instance ID on first render
  if (instanceIdRef.current === null) {
    instanceIdRef.current = ++mapInstanceCounter;
  }

  useEffect(() => {
    // On first mount, skip if we've already initialized (StrictMode second mount)
    if (skipInitialMountRef.current) {
      return;
    }

    // Mark that we're skipping the next mount (StrictMode pattern)
    skipInitialMountRef.current = true;

    // Defer rendering to ensure we're past StrictMode's mount/unmount cycle
    const timer = setTimeout(() => {
      setIsReady(true);
      // Reset flag after a delay to allow for actual remounts
      setTimeout(() => {
        skipInitialMountRef.current = false;
      }, 1000);
    }, 50);

    return () => {
      clearTimeout(timer);
      // Don't reset isReady immediately - let it persist through StrictMode unmount
    };
  }, []);

  if (!isReady) {
    // Return placeholder with same dimensions
    return <div style={mapProps.style} />;
  }

  // Use unique key based on instance ID to ensure clean initialization
  return (
    <MapContainer key={`map-${instanceIdRef.current}`} {...mapProps}>
      {children}
    </MapContainer>
  );
};

export default MapWrapper;

