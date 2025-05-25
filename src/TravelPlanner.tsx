import React, { useState, FormEvent, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { GoogleMap } from "./components/GoogleMap";
import { TravelBrief } from "./components/TravelBrief";
import { Id } from "../convex/_generated/dataModel";

// Shared Interfaces (consider moving to a types.ts file if used across more components)
interface FormData {
  citizenship: string;
  residencyVisa: string;
  departureLocation: string;
  destinationLocation: string;
  transportMode: string; // Added transportMode
}

interface RouteDataInfo {
  distance: number;
  duration: number;
  transportMethods: Array<string>;
  source: 'live' | 'fallback' | 'error';
  error?: string;
  borderCrossings?: Array<{ name: string; coordinates: { lat: number; lng: number } }>;
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

interface TravelPlanResult {
  formData: FormData;
  aiResponse: string;
  routeId: Id<"routes">;
  routeData: RouteDataInfo;
  flightData: FlightDataInfo;
  visaRequirements: VisaRequirementsInfo;
  totalEstimatedCost: number;
  planStatusMessage?: string;
}

const initialFormData: FormData = {
  citizenship: "",
  residencyVisa: "",
  departureLocation: "",
  destinationLocation: "",
  transportMode: "car", // Default transport mode
};

const citizenshipOptions = [
  "American", "British", "Canadian", "Nigerian", "Indian", "Chinese",
  "German", "French", "Australian", "South African", "Other",
];

const residencyVisaOptions = [
  "Citizen/Permanent Resident", "Work Visa", "Student Visa",
  "Tourist Visa", "Transit Visa", "Other",
];

const transportModeOptions = [
  { value: "car", label: "Car" },
  { value: "truck", label: "Truck" },
  { value: "pedestrian", label: "Pedestrian" },
  { value: "bicycle", label: "Bicycle" },
  { value: "scooter", label: "Scooter" },
  // Note: Public transport often requires different API endpoints or parameters with HERE.
  // Add more if your backend/HERE API key supports them well (e.g., 'bus').
];

// Helper function to extract document checklist (from original code)
const extractDocumentChecklist = (aiResponse: string): string[] => {
  const documentKeywords = [
    "passport", "visa", "id card", "driver's license", "birth certificate",
    "travel insurance", "customs declaration", "health certificate",
    "vaccination certificate", "entry permit", "exit permit",
    "invitation letter", "proof of funds", "hotel reservation", "return ticket",
  ];
  const checklist: Set<string> = new Set();
  const lines = aiResponse.toLowerCase().split('\n');
  let inDocumentSection = false;

  for (const line of lines) {
    if (line.includes("required documents") || line.includes("document checklist") || line.includes("documents needed")) {
      inDocumentSection = true;
      continue;
    }
    if (inDocumentSection && (line.startsWith("section") || line.startsWith("part ") || (line.match(/^[A-Z][^:\n]*:/) && !line.toLowerCase().includes("document")))) {
        inDocumentSection = false;
    }

    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ") || /^\d+\.\s/.test(trimmedLine)) {
      const item = trimmedLine.substring(trimmedLine.indexOf(" ") + 1).trim();
      if (inDocumentSection || documentKeywords.some(keyword => item.includes(keyword))) {
         checklist.add(item.charAt(0).toUpperCase() + item.slice(1));
      }
    } else {
        documentKeywords.forEach(keyword => {
            if (trimmedLine.includes(keyword)) {
                const sentences = trimmedLine.split('.');
                for (const sentence of sentences) {
                    if (sentence.includes(keyword)) {
                        const foundItem = sentence.trim();
                        if (foundItem.length > 5 && foundItem.length < 100) {
                             checklist.add(foundItem.charAt(0).toUpperCase() + foundItem.slice(1));
                        }
                        break; 
                    }
                }
            }
        });
    }
  }
  if (checklist.size === 0) {
    aiResponse.toLowerCase().split('.').forEach(sentence => {
        documentKeywords.forEach(keyword => {
            if (sentence.includes(keyword)) {
                const item = sentence.trim();
                if (item.length > 5 && item.length < 100) {
                    checklist.add(item.charAt(0).toUpperCase() + item.slice(1));
                }
            }
        });
    });
  }
  return Array.from(checklist);
};

export function TravelPlanner() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [travelPlan, setTravelPlan] = useState<TravelPlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'brief'>('overview');
  const generateTravelPlanAction = useAction(api.routes.generateTravelPlan);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerateSubmit = async (currentFormData: FormData) => {
    if (
      !currentFormData.citizenship ||
      !currentFormData.residencyVisa ||
      !currentFormData.departureLocation ||
      !currentFormData.destinationLocation ||
      !currentFormData.transportMode
    ) {
      toast.error("Please fill out all fields, including mode of transport.");
      return;
    }

    setIsLoading(!travelPlan);
    setIsRegenerating(!!travelPlan);

    try {
      // The generateTravelPlanAction now expects transportMode
      const result = await generateTravelPlanAction(currentFormData);
      setTravelPlan({
        formData: { ...currentFormData }, // Store current form data including transportMode
        aiResponse: result.aiResponse,
        routeId: result.routeId,
        routeData: result.routeData,
        flightData: result.flightData,
        visaRequirements: result.visaRequirements,
        totalEstimatedCost: result.totalEstimatedCost,
        planStatusMessage: result.planStatusMessage
      });
      
      const successMessage = travelPlan ? "Travel plan regenerated!" : "Travel plan generated successfully!";
      if (result.planStatusMessage) {
        toast.info(result.planStatusMessage, { duration: 10000, closeButton: true });
      }
      toast.success(successMessage);

    } catch (error: any) {
      console.error("Failed to generate travel plan:", error);
      toast.error(error.message || "Failed to generate travel plan. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleGenerateSubmit(formData);
  };

  const handleRegenerate = () => {
    handleGenerateSubmit(formData);
  };

  const handleCopyToClipboard = () => {
    if (!travelPlan) return;
    const planText = `
Travel Plan For: ${travelPlan.formData.departureLocation} to ${travelPlan.formData.destinationLocation}
Mode of Transport: ${travelPlan.formData.transportMode}
Citizenship: ${travelPlan.formData.citizenship}
Residency/Visa Status: ${travelPlan.formData.residencyVisa}

Total Estimated Cost: ${travelPlan.totalEstimatedCost ? `$${travelPlan.totalEstimatedCost}` : 'N/A (Estimation error)'}
Distance: ${travelPlan.routeData?.source === 'live' && travelPlan.routeData.distance > 0 ? `${travelPlan.routeData.distance} km` : 'N/A'}
Duration: ${travelPlan.routeData?.source === 'live' && travelPlan.routeData.duration > 0 ? `${Math.floor(travelPlan.routeData.duration / 60)}h ${travelPlan.routeData.duration % 60}m` : 'N/A'}
${travelPlan.planStatusMessage ? `\nStatus: ${travelPlan.planStatusMessage}\n` : ''}
AI Recommendations:
${travelPlan.aiResponse}
    `;
    navigator.clipboard.writeText(planText.trim())
      .then(() => toast.success("Travel plan copied to clipboard!"))
      .catch(() => toast.error("Failed to copy plan."));
  };

  const formatAIResponse = (response: string) => {
    const sections = response.split(/(?=\n(?:[A-Z][^:\n]*:|[0-9]+\.|• |\* |- ))/);
    return sections.map((section, index) => {
      const trimmed = section.trim();
      if (!trimmed) return null;
      const isHeaderLine = /^[A-Z][^:\n]*:/.test(trimmed.split('\n')[0]);
      if (isHeaderLine) {
        const [headerPart, ...contentPartsArray] = trimmed.split(':');
        const content = contentPartsArray.join(':').trim();
        return (
          <div key={index} className="mb-4">
            <h4 className="font-semibold text-gray-800 mb-1 text-lg">{headerPart.trim()}</h4>
            {content && <p className="text-gray-600 leading-relaxed whitespace-pre-line">{content}</p>}
          </div>
        );
      }
      const lines = trimmed.split('\n').map((line, lineIdx) => {
        if (line.match(/^(\* |- |• |[0-9]+\.) /)) {
          return <li key={`${index}-${lineIdx}`} className="ml-5 list-item text-gray-600 leading-relaxed">{line.substring(line.indexOf(" ") + 1)}</li>;
        }
        return <span key={`${index}-${lineIdx}`} className="block text-gray-600 leading-relaxed whitespace-pre-line">{line}</span>;
      });
      if (trimmed.match(/^(\* |- |• |[0-9]+\.) /)) {
        const isOrdered = /^[0-9]+\./.test(trimmed);
        return isOrdered ? <ol key={index} className="list-decimal mb-3">{lines}</ol> : <ul key={index} className="list-disc mb-3">{lines}</ul>;
      }
      return <div key={index} className="mb-3">{lines}</div>;
    }).filter(Boolean);
  };

  const documentChecklist = useMemo(() => {
    if (travelPlan) {
      return extractDocumentChecklist(travelPlan.aiResponse);
    }
    return [];
  }, [travelPlan]);
  
  if (travelPlan) {
    const { routeData, flightData, visaRequirements, totalEstimatedCost } = travelPlan;

    return (
      <div className="bg-white rounded-container shadow-xl w-full max-w-6xl mx-auto overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-6">
          <h2 className="text-3xl font-bold text-center mb-1">
            Your Personalized Travel Plan
          </h2>
          <p className="text-blue-100 text-center text-sm mb-2">
            For travel from {travelPlan.formData.departureLocation} to {travelPlan.formData.destinationLocation} via {travelPlan.formData.transportMode}.
          </p>
          {travelPlan.planStatusMessage && (
            <div className="mt-2 p-3 bg-primary bg-opacity-80 text-white text-xs rounded-md text-center shadow">
              <strong>Plan Status:</strong> {travelPlan.planStatusMessage}
            </div>
          )}
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 sm:space-x-4 px-4 sm:px-6 justify-center sm:justify-start">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'map', label: 'Route Map', icon: '🗺️' },
              { id: 'brief', label: 'Travel Brief', icon: '💼' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'map' | 'brief')}
                className={`py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-1 sm:mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 sm:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Trip Summary
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm sm:text-base">
                  <div className="space-y-2">
                    <div><span className="font-medium text-gray-700">Citizenship:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.citizenship}</span></div>
                    <div><span className="font-medium text-gray-700">Status:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.residencyVisa}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div><span className="font-medium text-gray-700">From:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.departureLocation}</span></div>
                    <div><span className="font-medium text-gray-700">To:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.destinationLocation}</span></div>
                    <div><span className="font-medium text-gray-700">Mode:</span> <span className="ml-2 text-gray-600 capitalize">{travelPlan.formData.transportMode}</span></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-3 sm:p-4 rounded-lg text-center ${flightData.source === 'error' || totalEstimatedCost <= 500 ? 'bg-yellow-50 border-yellow-200 border' : 'bg-blue-50'}`}>
                  <div className={`text-xl sm:text-2xl font-bold ${flightData.source === 'error' || totalEstimatedCost <= 500 ? 'text-yellow-700' : 'text-blue-700'}`}>
                    ${totalEstimatedCost > 0 ? totalEstimatedCost : 'N/A'}
                  </div>
                  <div className={`text-xs sm:text-sm ${flightData.source === 'error' || totalEstimatedCost <= 500 ? 'text-yellow-600' : 'text-blue-600'}`}>
                    Total Cost {flightData.source !== 'live' && totalEstimatedCost > 0 ? '(Est.)' : ''}
                  </div>
                </div>
                <div className={`p-3 sm:p-4 rounded-lg text-center ${routeData.source === 'error' ? 'bg-yellow-50 border-yellow-200 border' : 'bg-green-50'}`}>
                  <div className={`text-xl sm:text-2xl font-bold ${routeData.source === 'error' ? 'text-yellow-700' : 'text-green-700'}`}>
                    {routeData.source === 'live' && routeData.distance > 0 ? `${routeData.distance} km` : 'N/A'}
                  </div>
                  <div className={`text-xs sm:text-sm ${routeData.source === 'error' ? 'text-yellow-600' : 'text-green-600'}`}>Distance</div>
                </div>
                <div className={`p-3 sm:p-4 rounded-lg text-center ${routeData.source === 'error' ? 'bg-yellow-50 border-yellow-200 border' : 'bg-purple-50'}`}>
                  <div className={`text-xl sm:text-2xl font-bold ${routeData.source === 'error' ? 'text-yellow-700' : 'text-purple-700'}`}>
                    {routeData.source === 'live' && routeData.duration > 0 ? `${Math.floor(routeData.duration / 60)}h ${routeData.duration % 60}m` : 'N/A'}
                  </div>
                  <div className={`text-xs sm:text-sm ${routeData.source === 'error' ? 'text-yellow-600' : 'text-purple-600'}`}>Duration</div>
                </div>
                <div className={`p-3 sm:p-4 rounded-lg text-center ${visaRequirements.source === 'error' ? 'bg-yellow-50 border-yellow-200 border' : 'bg-orange-50'}`}>
                   <div className={`text-xl sm:text-2xl font-bold ${visaRequirements.source === 'error' ? 'text-yellow-700' : 'text-orange-700'}`}>
                    {visaRequirements.source !== 'error' ? (visaRequirements.required ? 'Yes' : 'No') : 'N/A'}
                  </div>
                  <div className={`text-xs sm:text-sm ${visaRequirements.source === 'error' ? 'text-yellow-600' : 'text-orange-600'}`}>
                    Visa Req. {visaRequirements.source === 'mock' ? '(Example)' : ''}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20"><path d="M9.75 17L3 10.25V7.5h4.5h1.5L13.5 2l3 4.5l-3 1.5L15 6.5l-1.5-1L9.75 8l2.25 2.25L9.75 17zM6 8.5H4.5v.75H6V8.5z" /></svg>
                  AI Travel Recommendations
                </h3>
                <div className="prose prose-sm sm:prose-base max-w-none">
                  {formatAIResponse(travelPlan.aiResponse)}
                </div>
              </div>

              {documentChecklist.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    Document Checklist (AI Suggested)
                  </h3>
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {documentChecklist.map((doc, index) => (
                      <div key={index} className="flex items-center">
                        <input type="checkbox" id={`doc-${index}`} className="mr-2 h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500" />
                        <label htmlFor={`doc-${index}`} className="text-yellow-700">{doc}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'map' && travelPlan.formData && ( // Ensure formData exists for map
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-800 mb-1">Route Visualization ({travelPlan.formData.transportMode})</h3>
               {routeData.error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">Map data may be limited: {routeData.error}</p>}
              <GoogleMap 
                departure={travelPlan.formData.departureLocation}
                destination={travelPlan.formData.destinationLocation}
                className="h-80 sm:h-96 w-full"
              />
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800 text-sm sm:text-base">
                  <strong>Route Details ({travelPlan.formData.transportMode}):</strong> 
                  {routeData.source === 'live' && routeData.distance > 0 ? 
                    `${routeData.distance} km, Estimated ${Math.floor(routeData.duration / 60)}h ${routeData.duration % 60}m` :
                    `Route details unavailable or estimated. ${routeData.error || 'Map cannot display route if locations are invalid or too far for typical visualization.'}` // Added more context
                  }
                </p>
              </div>
            </div>
          )}

          {activeTab === 'brief' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-800 mb-1">Comprehensive Travel Brief</h3>
              {travelPlan.planStatusMessage && <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md">Note: {travelPlan.planStatusMessage}</p>}
              <TravelBrief 
                routeData={routeData}
                flightData={flightData}
                visaRequirements={visaRequirements}
                totalEstimatedCost={totalEstimatedCost}
              />
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 sm:px-8 py-6 border-t border-gray-200 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-between items-center">
          <div className="flex gap-3 sm:gap-4">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating || isLoading}
              className="button button-primary px-4 py-2 sm:px-6 sm:py-2.5 text-sm sm:text-base flex items-center"
            >
              {isRegenerating ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Regenerating...</>
              ) : (
                <><svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>Regenerate Plan</>
              )}
            </button>
            <button
              onClick={() => { setTravelPlan(null); setFormData(initialFormData); setActiveTab('overview');}}
              className="button bg-gray-600 text-white hover:bg-gray-700 px-4 py-2 sm:px-6 sm:py-2.5 text-sm sm:text-base flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
              New Plan
            </button>
          </div>
          <button
            onClick={handleCopyToClipboard}
            className="button bg-green-600 text-white hover:bg-green-700 px-4 py-2 sm:px-6 sm:py-2.5 text-sm sm:text-base flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" /><path d="M3 5a2 2 0 012-2 3 3 0 003 3h6a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L14.586 13H19v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11.586V9a1 1 0 00-1-1H9.414l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 10H14a1 1 0 001 1v.586z" /></svg>
            Copy Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-container shadow-xl p-6 sm:p-8 w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
          Plan Your International Journey
        </h2>
        <p className="text-gray-600 text-sm sm:text-base">
          Get AI-powered travel recommendations, visa info, and route planning.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="citizenship" className="block text-sm font-medium text-gray-700 mb-1">
              Citizenship
            </label>
            <select
              id="citizenship"
              name="citizenship"
              value={formData.citizenship}
              onChange={handleChange}
              className="input-field"
              required
            >
              <option value="">Select your citizenship</option>
              {citizenshipOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="residencyVisa" className="block text-sm font-medium text-gray-700 mb-1">
              Current Status (in departure country)
            </label>
            <select
              id="residencyVisa"
              name="residencyVisa"
              value={formData.residencyVisa}
              onChange={handleChange}
              className="input-field"
              required
            >
              <option value="">Select your status</option>
              {residencyVisaOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="departureLocation" className="block text-sm font-medium text-gray-700 mb-1">
              Departure Location
            </label>
            <input
              type="text"
              id="departureLocation"
              name="departureLocation"
              value={formData.departureLocation}
              onChange={handleChange}
              placeholder="e.g., City, State/Country or Airport Code"
              className="input-field"
              required
            />
          </div>

          <div>
            <label htmlFor="destinationLocation" className="block text-sm font-medium text-gray-700 mb-1">
              Destination Location
            </label>
            <input
              type="text"
              id="destinationLocation"
              name="destinationLocation"
              value={formData.destinationLocation}
              onChange={handleChange}
              placeholder="e.g., City, State/Country or Airport Code"
              className="input-field"
              required
            />
          </div>
        </div>

        <div>
            <label htmlFor="transportMode" className="block text-sm font-medium text-gray-700 mb-1">
              Mode of Transport
            </label>
            <select
              id="transportMode"
              name="transportMode"
              value={formData.transportMode}
              onChange={handleChange}
              className="input-field"
              required
            >
              {transportModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
        </div>

        <button
          type="submit"
          disabled={isLoading || isRegenerating}
          className="w-full button button-primary py-3 text-base flex items-center justify-center"
        >
          {isLoading ? (
            <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>Generating Plan...</>
          ) : isRegenerating ? (
             <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>Regenerating Plan...</>
          ) : (
            <><svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9.75 17L3 10.25V7.5h4.5h1.5L13.5 2l3 4.5l-3 1.5L15 6.5l-1.5-1L9.75 8l2.25 2.25L9.75 17zM6 8.5H4.5v.75H6V8.5z" /></svg>Generate Travel Plan</>
          )}
        </button>
      </form>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200 text-sm">
        <h3 className="font-semibold text-blue-800 mb-2">What you'll get:</h3>
        <ul className="text-blue-700 space-y-1 list-disc list-inside">
          <li>AI-powered travel recommendations</li>
          <li>Visa requirement examples (always verify officially)</li>
          <li>Route planning (subject to API availability & selected mode)</li>
          <li>Flight option examples (subject to API availability)</li>
          <li>Interactive map visualization (requires Maps API Key)</li>
          <li>Border crossing guidance</li>
        </ul>
         <p className="mt-3 text-xs text-blue-600">Note: Accuracy of live data (flights, routes) depends on API key configuration and service availability. Visa information is for example purposes only.</p>
      </div>
    </div>
  );
}