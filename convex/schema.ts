import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  routes: defineTable({
    userId: v.id("users"),
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
  }).index("by_userId", ["userId"]),
  
  tripLegs: defineTable({
    routeId: v.id("routes"),
    legNumber: v.number(),
    departure: v.string(),
    arrival: v.string(),
    transportMethod: v.string(),
    estimatedCost: v.number(),
    duration: v.string(),
    notes: v.optional(v.string())
  }).index("by_routeId", ["routeId"])
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
