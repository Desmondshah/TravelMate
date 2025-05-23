import { mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai";

export const saveRoute = mutation({
  args: {
    citizenship: v.string(),
    residencyVisa: v.string(),
    departureLocation: v.string(),
    destinationLocation: v.string(),
    aiResponse: v.optional(v.string()),
    routeData: v.optional(v.object({
      distance: v.number(),
      duration: v.number(),
      transportMethods: v.array(v.string()),
      borderCrossings: v.array(v.object({
        name: v.string(),
        coordinates: v.object({
          lat: v.number(),
          lng: v.number()
        })
      }))
    })),
    flightData: v.optional(v.object({
      segments: v.array(v.object({
        departure: v.string(),
        arrival: v.string(),
        price: v.number(),
        duration: v.string(),
        airline: v.string()
      })),
      totalPrice: v.number()
    })),
    visaRequirements: v.optional(v.object({
      required: v.boolean(),
      type: v.optional(v.string()),
      processingTime: v.optional(v.string()),
      documents: v.array(v.string())
    })),
    totalEstimatedCost: v.optional(v.number())
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
      aiResponse: args.aiResponse,
      routeData: args.routeData,
      flightData: args.flightData,
      visaRequirements: args.visaRequirements,
      totalEstimatedCost: args.totalEstimatedCost
    });

    return routeId;
  },
});

export const addTripLeg = mutation({
  args: {
    routeId: v.id("routes"),
    legNumber: v.number(),
    departure: v.string(),
    arrival: v.string(),
    transportMethod: v.string(),
    estimatedCost: v.number(),
    duration: v.string(),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    return await ctx.db.insert("tripLegs", {
      routeId: args.routeId,
      legNumber: args.legNumber,
      departure: args.departure,
      arrival: args.arrival,
      transportMethod: args.transportMethod,
      estimatedCost: args.estimatedCost,
      duration: args.duration,
      notes: args.notes
    });
  }
});

export const getTripLegs = mutation({
  args: {
    routeId: v.id("routes")
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    return await ctx.db
      .query("tripLegs")
      .withIndex("by_routeId", (q) => q.eq("routeId", args.routeId))
      .collect();
  }
});

export const generateTravelPlan = action({
  args: {
    citizenship: v.string(),
    residencyVisa: v.string(),
    departureLocation: v.string(),
    destinationLocation: v.string(),
  },
  handler: async (ctx, args): Promise<{ 
    routeId: Id<"routes">; 
    aiResponse: string;
    routeData: {
      distance: number;
      duration: number;
      transportMethods: Array<string>;
    };
    flightData: {
      segments: Array<{
        departure: string;
        arrival: string;
        price: number;
        duration: string;
        airline: string;
      }>;
      totalPrice: number;
    };
    visaRequirements: {
      required: boolean;
      type?: string;
      processingTime?: string;
      documents: Array<string>;
    };
    totalEstimatedCost: number;
  }> => {
    const openai = new OpenAI({
      baseURL: process.env.CONVEX_OPENAI_BASE_URL,
      apiKey: process.env.CONVEX_OPENAI_API_KEY,
    });

    const prompt = `You're a border-crossing expert. A ${args.citizenship} citizen with ${args.residencyVisa} wants to travel from ${args.departureLocation} to ${args.destinationLocation}. Provide a personalized travel plan detailing crossing methods, required documents, and key considerations. Format your response in clear sections with practical, actionable advice.`;

    try {
      // Get route data from HERE Maps
      const routeData = await ctx.runAction(internal.travel_apis.getHereRoute, {
        origin: args.departureLocation,
        destination: args.destinationLocation
      });

      // Get flight data from Amadeus
      const departureDate = new Date();
      departureDate.setDate(departureDate.getDate() + 7); // 7 days from now
      const flightData = await ctx.runAction(internal.travel_apis.searchFlights, {
        origin: args.departureLocation.slice(0, 3).toUpperCase(), // Assume first 3 chars are airport code
        destination: args.destinationLocation.slice(0, 3).toUpperCase(),
        departureDate: departureDate.toISOString().split('T')[0]
      });

      // Get visa requirements
      const visaRequirements = await ctx.runAction(internal.travel_apis.getVisaRequirements, {
        citizenship: args.citizenship,
        destination: args.destinationLocation
      });

      // Calculate total estimated cost
      const totalEstimatedCost = flightData.totalPrice + 500; // Add estimated accommodation/food costs

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: "You are a knowledgeable travel advisor specializing in international border crossings, visa requirements, and travel documentation. Provide clear, accurate, and up-to-date information."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0]?.message?.content || "Unable to generate travel plan at this time.";

      // Save the route with all data - add borderCrossings to match schema
      const routeDataWithBorders = {
        ...routeData,
        borderCrossings: [] // Empty array for now
      };

      const routeId: Id<"routes"> = await ctx.runMutation(api.routes.saveRoute, {
        ...args,
        aiResponse,
        routeData: routeDataWithBorders,
        flightData,
        visaRequirements,
        totalEstimatedCost
      });

      return { 
        routeId, 
        aiResponse,
        routeData,
        flightData,
        visaRequirements,
        totalEstimatedCost
      };
    } catch (error) {
      console.error("Travel plan generation error:", error);
      
      // Fallback data
      const fallbackRouteData = {
        distance: 0,
        duration: 0,
        transportMethods: ['car'],
        borderCrossings: [] // Add borderCrossings to match schema
      };
      
      const fallbackFlightData = {
        segments: [],
        totalPrice: 0
      };
      
      const fallbackVisaRequirements = {
        required: true,
        documents: ['Valid passport', 'Visa application']
      };

      const routeId: Id<"routes"> = await ctx.runMutation(api.routes.saveRoute, {
        ...args,
        aiResponse: "Unable to generate AI travel plan at this time. Please check with relevant authorities for travel requirements.",
        routeData: fallbackRouteData,
        flightData: fallbackFlightData,
        visaRequirements: fallbackVisaRequirements,
        totalEstimatedCost: 500
      });

      return { 
        routeId, 
        aiResponse: "Unable to generate AI travel plan at this time. Please check with relevant authorities for travel requirements.",
        routeData: {
          distance: 0,
          duration: 0,
          transportMethods: ['car']
        },
        flightData: fallbackFlightData,
        visaRequirements: fallbackVisaRequirements,
        totalEstimatedCost: 500
      };
    }
  },
});
