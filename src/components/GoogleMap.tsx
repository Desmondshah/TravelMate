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

// Simple geocoding fallback for common cities - used if API key is missing
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
  const [isLoading, setIsLoading] = useState(true); // Start true, map loading is async
  const [error, setError] = useState<string | null>(null);
  
  // This ref tracks if the effect instance is still "active".
  // If the component unmounts or deps change, cleanup sets it to false.
  const effectIsActive = useRef(false);

  useEffect(() => {
    effectIsActive.current = true; // Mark this effect run as active
    console.log(`GoogleMap useEffect triggered. Departure: "${departure}", Destination: "${destination}", mapRef: ${mapRef.current ? 'exists' : 'null'}`);

    if (!mapRef.current) {
      console.warn("GoogleMap: mapRef.current is null at the start of useEffect. Map initialization will be deferred or might fail if ref doesn't populate.");
      // Don't set error if it's just initial render and ref isn't attached yet.
      // If props are valid, we expect a re-run once ref is attached.
      // If props are invalid, the next block handles it.
      setIsLoading(false); // Prevent stuck loading state if ref isn't resolving
      return; // Exit, wait for ref to be attached.
    }

    // Clear previous map content for a fresh initialization.
    mapRef.current.innerHTML = ''; 
    setIsLoading(true);
    setError(null);

    if (!departure || !destination) {
      const msg = "Departure or destination location is missing.";
      console.log(`GoogleMap: ${msg}`);
      if (effectIsActive.current) { // Check before setting state
        setError(msg);
        if (mapRef.current) {
            mapRef.current.innerHTML = `<div class="h-full w-full bg-gray-100 rounded-lg flex items-center justify-center p-4"><p class="text-sm text-gray-600">${msg}</p></div>`;
        }
        setIsLoading(false);
      }
      return;
    }

    const initMap = async () => {
      if (!effectIsActive.current) {
        console.log("GoogleMap initMap: Effect became inactive. Aborting map initialization.");
        return;
      }
      if (!mapRef.current) {
          console.error("GoogleMap initMap: mapRef.current is null. Aborting (this indicates the DOM element was removed).");
          if(effectIsActive.current) {
            setError("Map container became unavailable before API load.");
            setIsLoading(false);
          }
          return;
      }

      try {
        const apiKey = import.meta.env.VITE_Maps_API_KEY; 
        
        if (!apiKey) {
          console.log("GoogleMap: Google Maps API key is missing.");
          if (!effectIsActive.current || !mapRef.current) return;
          setError('Google Maps API key not configured. Displaying basic overview.');
          // Fallback static map display
          const departureCoords = getCityCoordinates(departure);
          const destinationCoords = getCityCoordinates(destination);
          if (mapRef.current) { // Check ref again before manipulating
            if (!departureCoords || !destinationCoords) {
                 mapRef.current.innerHTML = `
                    <div class="h-full w-full bg-gray-100 rounded-lg flex items-center justify-center p-4">
                        <p class="text-sm text-gray-600 text-center">Map display requires API key.<br/>Could not determine coordinates for fallback map.</p>
                    </div>`;
            } else {
                mapRef.current.innerHTML = `
                <div class="h-full w-full bg-gradient-to-br from-blue-100 to-green-100 rounded-lg flex flex-col items-center justify-center p-6">
                  <div class="text-center space-y-4">
                    <div class="text-lg font-semibold text-gray-800">Route Overview (Fallback)</div>
                    <div class="space-y-2">
                      <div class="flex items-center justify-center space-x-2"><div class="w-3 h-3 bg-green-500 rounded-full"></div><span class="text-sm text-gray-700">${departure}</span></div>
                      <div class="text-gray-400">↓</div>
                      <div class="flex items-center justify-center space-x-2"><div class="w-3 h-3 bg-red-500 rounded-full"></div><span class="text-sm text-gray-700">${destination}</span></div>
                    </div>
                    <div class="text-xs text-gray-500 mt-4">Interactive map requires API key.</div>
                  </div>
                </div>`;
            }
          }
          if(effectIsActive.current) setIsLoading(false);
          return; 
        }

        console.log("GoogleMap: Loading Google Maps JS API...");
        const { Loader } = await import('@googlemaps/js-api-loader');
        const loader = new Loader({
          apiKey: apiKey,
          version: 'weekly',
          libraries: ['places', 'routes', 'geocoding', 'marker'] 
        });
        const google = await loader.load();
        console.log("GoogleMap: Google Maps JS API loaded.");

        if (!effectIsActive.current || !mapRef.current) {
          console.error("GoogleMap initMap: mapRef.current became null or component unmounted AFTER Google API load. Aborting map display.");
          if (effectIsActive.current) {
            setError("Map container disappeared after API load.");
            setIsLoading(false);
          }
          return;
        }
        mapRef.current.innerHTML = ''; // Ensure map div is clean right before new map instance

        console.log("GoogleMap: Geocoding addresses...");
        const geocoder = new google.maps.Geocoder();
        const geocodeAddress = (address: string): Promise<Coordinates> => 
            new Promise((resolve, reject) => {
                if (!effectIsActive.current) { reject(new Error("Component unmounted during geocode.")); return; }
                geocoder.geocode({ address }, (results, status) => {
                    if (!effectIsActive.current) { reject(new Error("Component unmounted during geocode callback.")); return; }
                    if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                        const location = results[0].geometry.location;
                        console.log(`GoogleMap: Geocoded "${address}" successfully.`);
                        resolve({ lat: location.lat(), lng: location.lng() });
                    } else {
                        console.error(`GoogleMap: Geocoding failed for "${address}": ${status}`);
                        reject(new Error(`Geocoding failed for "${address}": ${status}`));
                    }
                });
            });

        const [departureResult, destinationResult] = await Promise.all([
            geocodeAddress(departure),
            geocodeAddress(destination)
        ]);
        console.log("GoogleMap: Geocoding successful for both addresses.");

        if (!effectIsActive.current || !mapRef.current) {
            console.error("GoogleMap initMap: mapRef.current is null or component unmounted before map instance creation.");
             if(effectIsActive.current) setIsLoading(false);
            return;
        }

        const centerLat = (departureResult.lat + destinationResult.lat) / 2;
        const centerLng = (departureResult.lng + destinationResult.lng) / 2;
        
        console.log("GoogleMap: Initializing map instance...");
        const mapInstance = new google.maps.Map(mapRef.current!, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 5,
          mapId: 'TRAVELMATE_ROUTE_MAP_V7' // Increment mapId to help bust any caching
        });
        console.log("GoogleMap: Map instance initialized.");
        
        new google.maps.marker.AdvancedMarkerElement({
          position: departureResult, map: mapInstance, title: `Departure: ${departure}`,
        });
        new google.maps.marker.AdvancedMarkerElement({
          position: destinationResult, map: mapInstance, title: `Destination: ${destination}`,
        });
        console.log("GoogleMap: Markers added.");

        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          suppressMarkers: true, 
          polylineOptions: { strokeColor: '#1D4ED8', strokeWeight: 5, strokeOpacity: 0.8 }
        });
        directionsRenderer.setMap(mapInstance);

        console.log("GoogleMap: Requesting directions...");
        directionsService.route({
          origin: departureResult,
          destination: destinationResult,
          travelMode: google.maps.TravelMode.DRIVING 
        }, (result, status) => {
          if (!effectIsActive.current) {
            console.log("GoogleMap directions callback: Component unmounted.");
            return;
          }
          if (status === google.maps.DirectionsStatus.OK && result) {
            console.log("GoogleMap: Directions received, rendering route.");
            directionsRenderer.setDirections(result);
            setError(null);
          } else {
            console.error(`GoogleMap: Directions request failed: ${status}`);
            setError(`Could not display route (${status}). Check locations or API permissions.`);
          }
        });

      } catch (err: any) {
        if (effectIsActive.current) {
          console.error('GoogleMap initMap full catch block error:', err);
          setError(err.message || 'Failed to load map. Check console for full details.');
        }
      } finally {
        if (effectIsActive.current) {
          console.log("GoogleMap initMap finally block, setting isLoading to false.");
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      effectIsActive.current = false; // Cleanup: mark effect as inactive
      console.log("GoogleMap useEffect CLEANUP. effectIsActive set to false for dep:", departure, destination);
    };
  }, [departure, destination]); // Dependencies: re-run if these change


  // --- Render Logic ---
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

  let showErrorOverlay = !!error;
  if (mapRef.current && showErrorOverlay) { // Only refine showErrorOverlay if mapRef.current exists
      const mapContent = mapRef.current.innerHTML;
      // Check if the div already contains a specific fallback message that we don't want to hide with a generic error
      if (mapContent.includes("API key not configured") || 
          mapContent.includes("Set departure and destination") ||
          mapContent.includes("Route Overview (Fallback)") ||
          mapContent.includes("Map display requires API key")) {
          // If mapRef.current already shows one of these specific fallbacks,
          // then the 'error' state might be related to that (e.g. "API key not configured"),
          // and we might not want to show the generic "Map Unavailable" overlay.
          // However, if 'error' is set for a *different* reason (e.g. geocoding failed after key was found), we DO want to show it.
          // This logic might need refinement based on what specific error messages are set.
          // For now, if mapRef.current has any children (meaning google maps tried or fallback is there), let the div display it.
          // Only show the dedicated error div if mapRef.current is empty AND there's an error.
          if(mapRef.current.hasChildNodes() && !mapRef.current.innerHTML.includes(error || "___dummy_string_to_fail_includes___")) {
            // If it has children, and the error state is different from what's displayed, maybe don't show overlay
            // This logic is tricky. Simpler: if an error state is set, we show it, unless it's the API key missing one which already renders.
          }
      }
  }


  if (showErrorOverlay && (!mapRef.current || !mapRef.current.hasChildNodes())) { 
    // Show error overlay only if error is present AND map container is empty
    // (meaning no specific fallback like "API key missing" was rendered into mapRef.current.innerHTML)
    return (
      <div className={`flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="text-center text-red-700">
          <p className="font-semibold">Map Unavailable</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }
  
  return <div ref={mapRef} className={`rounded-lg shadow-md ${className}`} />;
}