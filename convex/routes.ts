// convex/routes.ts
import { mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai"; // Keep the import

// Interfaces (RouteDataInfo, FlightDataInfo, VisaRequirementsInfo) remain the same
// ... (your interface definitions) ...
interface RouteDataInfo {
  distance: number;
  duration: number;
  transportMethods: Array<string>;
  borderCrossings?: Array<{ name: string; coordinates: { lat: number; lng: number } }>;
  source: 'live' | 'fallback' | 'error';
  error?: string;
}

interface FlightDataInfo {
  segments: Array<{
    departure: string;
    arrival: string;
    price: number;
    duration: string;
    airline: string;
  }>;
  totalPrice: number;
  source: 'live' | 'fallback' | 'error';
  error?: string;
}

interface VisaRequirementsInfo {
  required: boolean;
  type?: string;
  processingTime?: string;
  documents: Array<string>;
  notes?: string;
  source: 'mock' | 'live' | 'error';
  error?: string;
}


// REMOVE the top-level OpenAI client initialization:
// const openaiClient = new OpenAI({ ... }); 

export const saveRoute = mutation({
  // ... (args and handler for saveRoute remain the same as your last version)
  args: {
    citizenship: v.string(),
    residencyVisa: v.string(),
    departureLocation: v.string(),
    destinationLocation: v.string(),
    transportMode: v.string(), 
    aiResponse: v.optional(v.string()),
    routeData: v.optional(v.object({
      distance: v.number(),
      duration: v.number(),
      transportMethods: v.array(v.string()),
      borderCrossings: v.optional(v.array(v.object({
        name: v.string(),
        coordinates: v.object({ lat: v.number(), lng: v.number() })
      }))),
      source: v.union(v.literal('live'), v.literal('fallback'), v.literal('error')),
      error: v.optional(v.string())
    })),
    flightData: v.optional(v.object({
      segments: v.array(v.object({
        departure: v.string(),
        arrival: v.string(),
        price: v.number(),
        duration: v.string(),
        airline: v.string()
      })),
      totalPrice: v.number(),
      source: v.union(v.literal('live'), v.literal('fallback'), v.literal('error')),
      error: v.optional(v.string())
    })),
    visaRequirements: v.optional(v.object({
      required: v.boolean(),
      type: v.optional(v.string()),
      processingTime: v.optional(v.string()),
      documents: v.array(v.string()),
      notes: v.optional(v.string()),
      source: v.union(v.literal('mock'), v.literal('live'), v.literal('error')),
      error: v.optional(v.string())
    })),
    totalEstimatedCost: v.optional(v.number()),
    planStatusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"routes">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const routeId = await ctx.db.insert("routes", {
      userId,
      citizenship: args.citizenship,
      residencyVisa: args.residencyVisa,
      departureLocation: args.departureLocation,
      destinationLocation: args.destinationLocation,
      transportMode: args.transportMode,
      aiResponse: args.aiResponse,
      routeData: args.routeData,
      flightData: args.flightData,
      visaRequirements: args.visaRequirements,
      totalEstimatedCost: args.totalEstimatedCost,
      planStatusMessage: args.planStatusMessage,
    });
    return routeId;
  },
});

export const generateTravelPlan = action({
  args: {
    citizenship: v.string(),
    residencyVisa: v.string(),
    departureLocation: v.string(),
    destinationLocation: v.string(),
    transportMode: v.string(),
  },
  handler: async (ctx, args): Promise<{ 
    routeId: Id<"routes">; 
    aiResponse: string;
    routeData: RouteDataInfo;
    flightData: FlightDataInfo;
    visaRequirements: VisaRequirementsInfo;
    totalEstimatedCost: number;
    planStatusMessage?: string;
  }> => {
    // Initialize OpenAI client INSIDE the action handler
    const openaiClient = new OpenAI({
      // baseURL: process.env.CONVEX_OPENAI_BASE_URL, // You mentioned removing this worked better
      apiKey: process.env.CONVEX_OPENAI_API_KEY, // This will be resolved at action runtime
    });
    
    let planStatusMessage = ""; 
    let finalRouteData: RouteDataInfo | undefined;
    let finalFlightData: FlightDataInfo | undefined;
    let finalVisaRequirements: VisaRequirementsInfo | undefined;
    let finalAiResponse: string;
    let finalTotalEstimatedCost: number = 500; 

    try {
      // ... (rest of your try block: geocoding, routing, flights, visa, cost calculation, prompt construction)
      // (Ensure this logic is complete as per your last working version of the try block)
      const departureGeoResult = await ctx.runAction(internal.travel_apis.getCoordinatesForLocation, {
        locationQuery: args.departureLocation
      });
      const destinationGeoResult = await ctx.runAction(internal.travel_apis.getCoordinatesForLocation, {
        locationQuery: args.destinationLocation
      });

      if (departureGeoResult.success && departureGeoResult.data && 
          destinationGeoResult.success && destinationGeoResult.data) {
        const hereRouteResult = await ctx.runAction(internal.travel_apis.getHereRoute, {
          originCoords: departureGeoResult.data,
          destinationCoords: destinationGeoResult.data,
          transportMode: args.transportMode,
        });
        if (hereRouteResult.success && hereRouteResult.data) {
            finalRouteData = { ...hereRouteResult.data, source: hereRouteResult.source as 'live' | 'error', error: hereRouteResult.error, borderCrossings: [] };
        } else {
            let routeErrorMsg = hereRouteResult.error || 'Could not fetch live route data.';
            if (routeErrorMsg.includes("No route found")) {
                routeErrorMsg = `Destination may be inaccessible by the selected mode of transport (${args.transportMode}). Route details N/A.`;
            }
            planStatusMessage += `Route information error: ${routeErrorMsg} `;
            finalRouteData = { distance: 0, duration: 0, transportMethods: [args.transportMode], source: 'error', error: routeErrorMsg, borderCrossings: [] };
        }
      } else {
        let geoErrorMsg = "Geocoding failed: ";
        if (!departureGeoResult.success) geoErrorMsg += `Departure: ${departureGeoResult.error || 'Unknown error'}. `;
        if (!destinationGeoResult.success) geoErrorMsg += `Destination: ${destinationGeoResult.error || 'Unknown error'}.`;
        planStatusMessage += geoErrorMsg;
        finalRouteData = { distance: 0, duration: 0, transportMethods: [args.transportMode], source: 'error', error: geoErrorMsg.trim() || 'Geocoding for routing failed.', borderCrossings: [] };
      }

      const departureDate = new Date();
      departureDate.setDate(departureDate.getDate() + 7);
      const flightResult = await ctx.runAction(internal.travel_apis.searchFlights, {
        origin: args.departureLocation, 
        destination: args.destinationLocation,
        departureDate: departureDate.toISOString().split('T')[0]
      });
      if (flightResult.success && flightResult.data) {
          finalFlightData = { ...flightResult.data, source: flightResult.source as 'live' | 'error', error: flightResult.error };
          if (flightResult.error && flightResult.source === 'live') {
              planStatusMessage += `Flight information note: ${flightResult.error} `;
          }
      } else {
          planStatusMessage += `Flight information error: ${flightResult.error || 'Could not fetch live flight data.'} `;
          finalFlightData = { segments: [], totalPrice: 0, source: 'error', error: flightResult.error || 'Unknown flight error' };
      }
      
      const visaResult = await ctx.runAction(internal.travel_apis.getVisaRequirements, {
        citizenship: args.citizenship,
        destination: args.destinationLocation
      });
      finalVisaRequirements = { ...(visaResult.data!), source: visaResult.source as 'mock' | 'live' | 'error', error: visaResult.error };
      if (visaResult.source === 'mock' && visaResult.data?.notes) {
          planStatusMessage += `${visaResult.data.notes} `;
      }

      const baseMiscCost = 500; 
      finalTotalEstimatedCost = baseMiscCost;
      if (finalFlightData.source === 'live' && finalFlightData.totalPrice > 0) {
          finalTotalEstimatedCost += finalFlightData.totalPrice;
      } else if (finalFlightData.source !== 'live') {
          planStatusMessage += "Total cost is an estimate as live flight prices were unavailable. ";
      }
      
      planStatusMessage = planStatusMessage.trim();
      let prompt = `You're a border-crossing and travel planning expert...`; // Your full prompt construction
      // (Ensure the prompt is constructed correctly as per your last version)

      const completion = await openaiClient.chat.completions.create({ // Use openaiClient here
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: "You are a knowledgeable travel advisor..." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500, temperature: 0.7,
      });
      finalAiResponse = completion.choices[0]?.message?.content || "AI could not generate a response.";

    } catch (error: any) {
      console.error("Overall travel plan generation error:", error);
      planStatusMessage = `Overall plan generation failed: ${error.message}. ${planStatusMessage}`.trim();
      finalAiResponse = "There was a critical issue generating the travel plan...";
      
      finalRouteData = finalRouteData ?? { distance: 0, duration: 0, transportMethods: [args.transportMode], source: 'error', error: 'Overall plan generation failed', borderCrossings: [] };
      finalFlightData = finalFlightData ?? { segments: [], totalPrice: 0, source: 'error', error: 'Overall plan generation failed' };
      finalVisaRequirements = finalVisaRequirements ?? { required: true, documents: ['Valid passport'], source: 'error', error: 'Overall plan generation failed', notes: "Visa info unavailable due to error." };
      finalTotalEstimatedCost = finalTotalEstimatedCost === 500 && (finalFlightData.source !== 'live' || finalFlightData.totalPrice === 0) ? 500 : finalTotalEstimatedCost;
    }
    
    const routeId: Id<"routes"> = await ctx.runMutation(api.routes.saveRoute, {
      citizenship: args.citizenship,
      residencyVisa: args.residencyVisa,
      departureLocation: args.departureLocation,
      destinationLocation: args.destinationLocation,
      transportMode: args.transportMode,
      aiResponse: finalAiResponse,
      routeData: finalRouteData,
      flightData: finalFlightData,
      visaRequirements: finalVisaRequirements,
      totalEstimatedCost: finalTotalEstimatedCost,
      planStatusMessage: planStatusMessage || undefined
    });

    return { 
      routeId, 
      aiResponse: finalAiResponse,
      routeData: finalRouteData,
      flightData: finalFlightData,
      visaRequirements: finalVisaRequirements,
      totalEstimatedCost: finalTotalEstimatedCost,
      planStatusMessage: planStatusMessage || undefined
    };
  },
});