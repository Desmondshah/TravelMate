import React, { useEffect, useRef, useState } from 'react';

interface MapProps {
  departure: string;
  destination: string;
  className?: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// Simple geocoding fallback for common cities
const getCityCoordinates = (location: string): Coordinates | null => {
  const cityCoords: Record<string, Coordinates> = {
    'new york': { lat: 40.7128, lng: -74.0060 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'sydney': { lat: -33.8688, lng: 151.2093 },
    'dubai': { lat: 25.2048, lng: 55.2708 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'hong kong': { lat: 22.3193, lng: 114.1694 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'chicago': { lat: 41.8781, lng: -87.6298 },
    'frankfurt': { lat: 50.1109, lng: 8.6821 },
    'amsterdam': { lat: 52.3676, lng: 4.9041 },
    'madrid': { lat: 40.4168, lng: -3.7038 },
    'rome': { lat: 41.9028, lng: 12.4964 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'delhi': { lat: 28.7041, lng: 77.1025 },
    'beijing': { lat: 39.9042, lng: 116.4074 },
    'shanghai': { lat: 31.2304, lng: 121.4737 },
    'toronto': { lat: 43.6532, lng: -79.3832 },
    'vancouver': { lat: 49.2827, lng: -123.1207 }
  };
  
  const locationLower = location.toLowerCase();
  for (const [city, coords] of Object.entries(cityCoords)) {
    if (locationLower.includes(city)) {
      return coords;
    }
  }
  
  return null;
};

export function GoogleMap({ departure, destination, className = "" }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        // Check if Google Maps API key is configured
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          // Use fallback coordinates for demonstration
          const departureCoords = getCityCoordinates(departure);
          const destinationCoords = getCityCoordinates(destination);
          
          if (!departureCoords || !destinationCoords) {
            throw new Error('Unable to find coordinates for the specified locations');
          }
          
          // Create a simple static map representation
          if (mapRef.current) {
            mapRef.current.innerHTML = `
              <div class="h-full w-full bg-gradient-to-br from-blue-100 to-green-100 rounded-lg flex flex-col items-center justify-center p-6">
                <div class="text-center space-y-4">
                  <div class="text-lg font-semibold text-gray-800">Route Overview</div>
                  <div class="space-y-2">
                    <div class="flex items-center justify-center space-x-2">
                      <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span class="text-sm text-gray-700">${departure}</span>
                    </div>
                    <div class="text-gray-400">↓</div>
                    <div class="flex items-center justify-center space-x-2">
                      <div class="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span class="text-sm text-gray-700">${destination}</span>
                    </div>
                  </div>
                  <div class="text-xs text-gray-500 mt-4">
                    Interactive map requires Google Maps API key configuration
                  </div>
                </div>
              </div>
            `;
          }
          
          setIsLoading(false);
          return;
        }

        // If API key is available, load Google Maps
        const { Loader } = await import('@googlemaps/js-api-loader');
        
        const loader = new Loader({
          apiKey: apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry']
        });

        const { Map } = await loader.importLibrary('maps') as google.maps.MapsLibrary;
        const { Geocoder } = await loader.importLibrary('geocoding') as google.maps.GeocodingLibrary;
        const { DirectionsService, DirectionsRenderer } = await loader.importLibrary('routes') as google.maps.RoutesLibrary;

        if (!mapRef.current) return;

        const geocoder = new Geocoder();
        
        // Geocode departure and destination
        const [departureResult, destinationResult] = await Promise.all([
          new Promise<Coordinates>((resolve, reject) => {
            geocoder.geocode({ address: departure }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
              if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                resolve({ lat: location.lat(), lng: location.lng() });
              } else {
                reject(new Error(`Geocoding failed for departure: ${status}`));
              }
            });
          }),
          new Promise<Coordinates>((resolve, reject) => {
            geocoder.geocode({ address: destination }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
              if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                resolve({ lat: location.lat(), lng: location.lng() });
              } else {
                reject(new Error(`Geocoding failed for destination: ${status}`));
              }
            });
          })
        ]);

        // Create map centered between departure and destination
        const centerLat = (departureResult.lat + destinationResult.lat) / 2;
        const centerLng = (departureResult.lng + destinationResult.lng) / 2;

        const mapInstance = new Map(mapRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 6,
          mapTypeId: 'roadmap'
        });

        // Add markers
        const { Marker } = await loader.importLibrary('marker') as google.maps.MarkerLibrary;
        
        new Marker({
          position: departureResult,
          map: mapInstance,
          title: `Departure: ${departure}`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#22c55e"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(24, 24)
          }
        });

        new Marker({
          position: destinationResult,
          map: mapInstance,
          title: `Destination: ${destination}`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(24, 24)
          }
        });

        // Add route
        const directionsService = new DirectionsService();
        const directionsRenderer = new DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#3b82f6',
            strokeWeight: 4,
            strokeOpacity: 0.8
          }
        });

        directionsRenderer.setMap(mapInstance);

        directionsService.route({
          origin: departureResult,
          destination: destinationResult,
          travelMode: window.google.maps.TravelMode.DRIVING
        }, (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
          if (status === 'OK' && result) {
            directionsRenderer.setDirections(result);
          }
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Map initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
        setIsLoading(false);
      }
    };

    initMap();
  }, [departure, destination]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center text-red-600">
          <p>Map unavailable</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={`rounded-lg ${className}`} />;
}
