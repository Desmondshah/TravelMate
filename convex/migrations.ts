// convex/migrations.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Migration to add the 'source' field to flightData in existing 'routes' documents
 * where it is missing.
 */
export const addMissingFlightDataSource = mutation({
  args: {
    // You can pass a specific document ID to migrate one document
    docIdToMigrate: v.optional(v.id("routes")),
    // Or, you can add logic to migrate all documents that need it (more advanced)
  },
  handler: async (ctx, args) => {
    if (args.docIdToMigrate) {
      const route = await ctx.db.get(args.docIdToMigrate);
      if (!route) {
        return `Document with ID ${args.docIdToMigrate} not found.`;
      }

      // Check if migration is needed for this document
      // Type assertion to help TypeScript understand the structure before migration
      const currentFlightData = route.flightData as any; 

      if (currentFlightData && typeof currentFlightData === 'object' && currentFlightData.source === undefined) {
        // Determine a sensible default for 'source'
        // For old data where the source is unknown, 'fallback' or 'error' might be appropriate.
        // If flightData is {segments: [], totalPrice: 0.0}, it was likely a fallback from an error.
        let defaultSource: 'live' | 'fallback' | 'error' = 'fallback';
        let defaultError: string | undefined = "Source field added during migration; original source unknown.";

        if (Array.isArray(currentFlightData.segments) && currentFlightData.segments.length === 0 && currentFlightData.totalPrice === 0) {
            defaultSource = 'error'; // Or 'fallback' if it was an intentional empty state
            defaultError = "Source field added during migration; data appears to be a fallback due to a previous error or no data.";
        }
        
        console.log(`Migrating document ID: ${args.docIdToMigrate}. Adding 'source' to flightData.`);
        
        try {
          await ctx.db.patch(args.docIdToMigrate, {
            flightData: {
              ...currentFlightData, // Spread existing fields like segments, totalPrice
              source: defaultSource,
              error: currentFlightData.error ?? defaultError, // Preserve existing error or add default
            },
          });
          return `Document ${args.docIdToMigrate} migrated successfully. flightData.source set to '${defaultSource}'.`;
        } catch (e: any) {
          console.error(`Error patching document ${args.docIdToMigrate}:`, e.message);
          return `Error patching document ${args.docIdToMigrate}: ${e.message}`;
        }
      } else if (currentFlightData && currentFlightData.source !== undefined) {
        return `Document ${args.docIdToMigrate} already has flightData.source. No migration needed.`;
      } else {
        return `Document ${args.docIdToMigrate} does not have flightData or it's not an object. No migration needed.`;
      }
    } else {
      // Logic to migrate multiple documents (more complex):
      // 1. Query for documents that might need migration (e.g., all documents in "routes")
      // 2. Iterate and apply the patch logic for each.
      // Be careful with reads/writes to stay within Convex execution limits if migrating many docs.
      // Consider using pagination or recursive actions for very large datasets.
      // For now, this example focuses on a single document ID.
      const routesToPotentiallyMigrate = await ctx.db.query("routes").take(100); // Get a batch
      let migratedCount = 0;
      for (const route of routesToPotentiallyMigrate) {
        const currentFlightData = route.flightData as any;
         if (currentFlightData && typeof currentFlightData === 'object' && currentFlightData.source === undefined) {
            let defaultSource: 'live' | 'fallback' | 'error' = 'fallback';
            let defaultError: string | undefined = "Source field added during migration; original source unknown.";
             if (Array.isArray(currentFlightData.segments) && currentFlightData.segments.length === 0 && currentFlightData.totalPrice === 0) {
                defaultSource = 'error';
                defaultError = "Source field added during migration; data appears to be a fallback due to a previous error or no data.";
            }
            await ctx.db.patch(route._id, {
                flightData: { ...currentFlightData, source: defaultSource, error: currentFlightData.error ?? defaultError },
            });
            migratedCount++;
         }
      }
      return `Checked ${routesToPotentiallyMigrate.length} documents. Migrated ${migratedCount} documents by adding 'source' to flightData where missing. Run again if you have more than 100 routes.`;
    }
  },
});

// You might also want a migration for routeData.source and visaRequirements.source if they face similar issues.
// Example for routeData:
export const addMissingRouteDataSource = mutation({
  args: { docIdToMigrate: v.optional(v.id("routes")) },
  handler: async (ctx, args) => {
    // Similar logic as addMissingFlightDataSource, but for route.routeData
    // ... (implementation would be analogous)
    return "RouteData migration logic placeholder.";
  }
});