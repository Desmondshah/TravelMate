// convex/travel_apis.ts
"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api"; // Ensure this is correctly generated/used if needed

// Generic API Result Structure
interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'live' | 'fallback' | 'error' | 'mock';
}

// Coordinate structure
interface Coordinates {
  lat: number;
  lng: number;
}

// HERE API Response Structures (for type safety)
interface HereRouteResponse {
  routes: Array<{
    sections: Array<{
      summary: {
        length: number; // in meters
        duration: number; // in seconds
      };
      transport: {
        mode: string;
      };
    }>;
  }>;
}

interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AmadeusFlightOffer {
  price: {
    total: string;
    currency: string;
  };
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: {
        iataCode: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        at: string;
      };
      carrierCode: string;
      duration: string;
    }>;
  }>;
}

interface HereGeocodeResponseItem {
  position: {
    lat: number;
    lng: number;
  };
  title: string; 
}

interface HereGeocodeResponse {
  items: HereGeocodeResponseItem[];
}


// --- AMADEUS TOKEN ---
export const getAmadeusToken = internalAction({
  args: {},
  handler: async (): Promise<ApiResult<string>> => {
    try {
      const clientId = process.env.AMADEUS_CLIENT_ID;
      const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return { success: false, error: 'Amadeus API credentials not configured', source: 'error' };
      }

      const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Amadeus auth failed: ${response.status} - ${errorBody}`, source: 'error' };
      }
      const data: AmadeusTokenResponse = await response.json();
      return { success: true, data: data.access_token, source: 'live' };
    } catch (error: any) {
      console.error('Failed to get Amadeus token:', error);
      return { success: false, error: error.message || 'Failed to authenticate with Amadeus API', source: 'error' };
    }
  }
});

// --- HERE GEOCODING ---
export const getCoordinatesForLocation = internalAction({
  args: { locationQuery: v.string() },
  handler: async (ctx, args): Promise<ApiResult<Coordinates>> => {
    const apiKey = process.env.HERE_API_KEY;
    if (!apiKey) {
      return { success: false, error: "HERE API key not configured for geocoding.", source: 'error' };
    }

    try {
      const response = await fetch(
        `https://geocode.search.hereapi.com/v1/geocode?` + new URLSearchParams({
          q: args.locationQuery,
          apikey: apiKey,
          limit: '1' 
        })
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`HERE Geocoding API error for "${args.locationQuery}": ${response.status}`, errorBody);
        return { success: false, error: `HERE Geocoding API error (${args.locationQuery}): ${response.status} - ${errorBody}`, source: 'error' };
      }

      const data: HereGeocodeResponse = await response.json();
      if (!data.items || data.items.length === 0) {
        return { success: false, error: `No coordinates found for "${args.locationQuery}".`, source: 'error' };
      }

      const { lat, lng } = data.items[0].position;
      console.log(`Geocoded "${args.locationQuery}" (Matched: "${data.items[0].title}") to: ${lat}, ${lng}`);
      return { success: true, data: { lat, lng }, source: 'live' };

    } catch (error: any) {
      console.error(`HERE Geocoding processing error for "${args.locationQuery}":`, error);
      return { success: false, error: error.message || `Failed to process HERE Geocoding for "${args.locationQuery}".`, source: 'error' };
    }
  }
});


// --- HERE ROUTING (expects coordinates) ---
export const getHereRoute = internalAction({
  args: {
    originCoords: v.object({ lat: v.number(), lng: v.number() }),
    destinationCoords: v.object({ lat: v.number(), lng: v.number() }),
    transportMode: v.string(), // <-- Add this
  },
  handler: async (ctx, args): Promise<ApiResult<{
    distance: number; // in km
    duration: number; // in minutes
    transportMethods: Array<string>;
  }>> => {
    const apiKey = process.env.HERE_API_KEY;
    if (!apiKey) {
      return { 
        success: false, 
        error: 'HERE API key not configured. Route data is unavailable.',
        source: 'error',
        data: { distance: 0, duration: 0, transportMethods: ['unknown'] }
      };
    }

    const originParam = `${args.originCoords.lat},${args.originCoords.lng}`;
    const destinationParam = `${args.destinationCoords.lat},${args.destinationCoords.lng}`;

    try {
      const response = await fetch(
      `https://router.hereapi.com/v8/routes?` + new URLSearchParams({
        transportMode: args.transportMode, // <-- Use the argument
        origin: originParam,
        destination: destinationParam,
        return: 'summary',
        apikey: apiKey
        })
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return { 
            success: false, 
            error: `HERE Routing API error: ${response.status} - ${errorBody}`, 
            source: 'error',
            data: { distance: 0, duration: 0, transportMethods: ['unknown'] }
        };
      }

      const data: HereRouteResponse = await response.json();
      const route = data.routes[0];
      
      if (!route || route.sections.length === 0) {
        return { 
            success: false, 
            error: 'No route found by HERE API with the given coordinates.', 
            source: 'error', // Technically live API call but no route is an error for planning
            data: { distance: 0, duration: 0, transportMethods: ['unknown'] }
        };
      }

      const totalDistanceMeters = route.sections.reduce((sum, section) => sum + section.summary.length, 0);
      const totalDurationSeconds = route.sections.reduce((sum, section) => sum + section.summary.duration, 0);
      const transportMethods = [...new Set(route.sections.map(section => section.transport.mode))];

      return {
        success: true,
        data: {
          distance: Math.round(totalDistanceMeters / 1000),
          duration: Math.round(totalDurationSeconds / 60),
          transportMethods
        },
        source: 'live'
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || 'Failed to process HERE Routing API response.', 
        source: 'error',
        data: { distance: 0, duration: 0, transportMethods: ['unknown'] }
      };
    }
  }
});

// --- AMADEUS FLIGHT SEARCH ---
export const searchFlights = internalAction({
  args: {
    origin: v.string(), 
    destination: v.string(),
    departureDate: v.string()
  },
  handler: async (ctx, args): Promise<ApiResult<{
    segments: Array<{ departure: string; arrival: string; price: number; duration: string; airline: string; }>;
    totalPrice: number;
  }>> => {
    const tokenResult = await ctx.runAction(internal.travel_apis.getAmadeusToken, {});
    if (!tokenResult.success || !tokenResult.data) {
      return { success: false, error: tokenResult.error || 'Amadeus token acquisition failed.', source: 'error', data: { segments: [], totalPrice: 0} };
    }
    const token = tokenResult.data;
      
    const getAirportCode = (location: string): string => {
        const directCodeMatch = location.match(/\b([A-Z]{3})\b/);
        if (directCodeMatch) return directCodeMatch[1];
        const commonCodes: Record<string, string> = {
          'new york': 'JFK', 'nyc': 'JFK', 'new york city': 'JFK',
          'london': 'LHR', 'lon': 'LHR',
          'paris': 'CDG', 'par': 'CDG',
          'tokyo': 'NRT', 'tyo': 'NRT',
          'sydney': 'SYD',
          'dubai': 'DXB',
          'singapore': 'SIN',
          'hong kong': 'HKG',
          'los angeles': 'LAX',
          'chicago': 'ORD',
          'frankfurt': 'FRA',
          'amsterdam': 'AMS',
          'madrid': 'MAD',
          'rome': 'FCO',
          'mumbai': 'BOM',
          'delhi': 'DEL',
          'beijing': 'PEK',
          'shanghai': 'PVG',
          'toronto': 'YYZ', // Common Toronto mapping
          'atlanta': 'ATL', // Common Atlanta mapping
          'vancouver': 'YVR'
        };
        const locationLower = location.toLowerCase();
        for (const [city, code] of Object.entries(commonCodes)) {
          if (locationLower.includes(city)) return code;
        }
        if (location.length === 3 && location === location.toUpperCase()) return location;
        console.warn(`Could not determine airport code for: ${location}. Using placeholder XXX.`);
        return "XXX"; 
    };

    const originCode = getAirportCode(args.origin);
    const destinationCode = getAirportCode(args.destination);

    if (originCode === "XXX" || destinationCode === "XXX") {
        let errorMsg = "Could not determine airport code for: ";
        if (originCode === "XXX") errorMsg += `origin "${args.origin}" `;
        if (destinationCode === "XXX") errorMsg += `destination "${args.destination}"`;
        return { success: false, error: errorMsg.trim() + ". Flight search cannot proceed.", source: 'error', data: { segments: [], totalPrice: 0} };
    }
      
    try {
      const response = await fetch(
        `https://test.api.amadeus.com/v2/shopping/flight-offers?` + new URLSearchParams({
          originLocationCode: originCode,
          destinationLocationCode: destinationCode,
          departureDate: args.departureDate,
          adults: '1',
          max: '1' 
        }), { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Amadeus Flight API error: ${response.status} - ${errorBody}`, source: 'error', data: { segments: [], totalPrice: 0} };
      }

      const data = await response.json();
      const offers = data.data as AmadeusFlightOffer[];
      
      if (!offers || offers.length === 0) {
        return { success: true, data: { segments: [], totalPrice: 0 }, error: 'No flight offers found for the given criteria.', source: 'live' };
      }

      const bestOffer = offers[0];
      const segments = bestOffer.itineraries[0].segments.map(segment => ({
        departure: segment.departure.iataCode,
        arrival: segment.arrival.iataCode,
        price: parseFloat(bestOffer.price.total) / bestOffer.itineraries[0].segments.length,
        duration: segment.duration,
        airline: segment.carrierCode
      }));

      return { success: true, data: { segments, totalPrice: parseFloat(bestOffer.price.total) }, source: 'live' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Amadeus Flight API processing error.', source: 'error', data: { segments: [], totalPrice: 0} };
    }
  }
});

// --- VISA REQUIREMENTS (Mock) ---
export const getVisaRequirements = internalAction({
  args: {
    citizenship: v.string(),
    destination: v.string()
  },
  handler: async (ctx, args): Promise<ApiResult<{
    required: boolean; type?: string; processingTime?: string; documents: Array<string>; notes?: string;
  }>> => {
    const visaFreeCountries: Record<string, string[]> = { /* ... same as before ... */ };
    const destinationCountry = args.destination.split(',').pop()?.trim().toLowerCase() || args.destination.toLowerCase();
    const citizenshipNormalized = args.citizenship;
    let isVisaFree = false;
    if (visaFreeCountries[citizenshipNormalized]) {
        isVisaFree = visaFreeCountries[citizenshipNormalized].some(country => 
            destinationCountry.includes(country.toLowerCase())
        );
    }
    const mockNote = "Note: This is example visa information. Always verify with official sources before travel.";
    if (isVisaFree) {
      return { success: true, data: { required: false, documents: [ /* ... */ ], notes: mockNote }, source: 'mock' };
    }
    return { success: true, data: { required: true, type: 'Tourist Visa (example)', processingTime: '5-15 business days (example)', documents: [ /* ... */ ], notes: mockNote }, source: 'mock' };
  }
});