import React, { useState, FormEvent, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { GoogleMap } from "./components/GoogleMap";
import { TravelBrief } from "./components/TravelBrief";

interface FormData {
  citizenship: string;
  residencyVisa: string;
  departureLocation: string;
  destinationLocation: string;
}

interface TravelPlanResult {
  formData: FormData;
  aiResponse: string;
  routeId: string;
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
}

const initialFormData: FormData = {
  citizenship: "",
  residencyVisa: "",
  departureLocation: "",
  destinationLocation: "",
};

const citizenshipOptions = [
  "American",
  "British",
  "Canadian",
  "Nigerian",
  "Indian",
  "Chinese",
  "German",
  "French",
  "Australian",
  "South African",
  "Other",
];

const residencyVisaOptions = [
  "Citizen/Permanent Resident",
  "Work Visa",
  "Student Visa",
  "Tourist Visa",
  "Transit Visa",
  "Other",
];

// Helper function to extract document checklist
const extractDocumentChecklist = (aiResponse: string): string[] => {
  const documentKeywords = [
    "passport",
    "visa",
    "id card",
    "driver's license",
    "birth certificate",
    "travel insurance",
    "customs declaration",
    "health certificate",
    "vaccination certificate",
    "entry permit",
    "exit permit",
    "invitation letter",
    "proof of funds",
    "hotel reservation",
    "return ticket",
  ];

  const checklist: Set<string> = new Set();
  const lines = aiResponse.toLowerCase().split('\n');

  let inDocumentSection = false;

  for (const line of lines) {
    if (line.includes("required documents") || line.includes("document checklist") || line.includes("documents needed")) {
      inDocumentSection = true;
      continue;
    }
    if (inDocumentSection && (line.startsWith("section") || line.startsWith("part ") || line.match(/^[A-Z][^:\n]*:/) && !line.toLowerCase().includes("document"))) {
        // Heuristic: if we encounter a new major section header that's not about documents, exit document section
        inDocumentSection = false;
    }

    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ") || /^\d+\.\s/.test(trimmedLine)) {
      const item = trimmedLine.substring(trimmedLine.indexOf(" ") + 1).trim();
      if (inDocumentSection) {
         // Capitalize first letter
        checklist.add(item.charAt(0).toUpperCase() + item.slice(1));
      } else {
        // Check keywords even outside a specific section
        documentKeywords.forEach(keyword => {
          if (item.includes(keyword)) {
            checklist.add(item.charAt(0).toUpperCase() + item.slice(1));
          }
        });
      }
    } else {
       // Check keywords in paragraph text
        documentKeywords.forEach(keyword => {
            if (trimmedLine.includes(keyword)) {
                // Attempt to extract a phrase around the keyword
                const sentences = trimmedLine.split('.');
                for (const sentence of sentences) {
                    if (sentence.includes(keyword)) {
                        // A simple heuristic: take the sentence. Could be improved.
                        const foundItem = sentence.trim();
                        if (foundItem.length > 5 && foundItem.length < 100) { // Avoid very short/long items
                             checklist.add(foundItem.charAt(0).toUpperCase() + foundItem.slice(1));
                        }
                        break; 
                    }
                }
            }
        });
    }
  }
  // If checklist is empty after parsing sections, do a broader keyword search
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
      !currentFormData.destinationLocation
    ) {
      toast.error("Please fill out all fields.");
      return;
    }

    if (travelPlan) setIsRegenerating(true); else setIsLoading(true);

    try {
      const result = await generateTravelPlanAction(currentFormData);
      setTravelPlan({
        formData: { ...currentFormData },
        aiResponse: result.aiResponse,
        routeId: result.routeId.toString(),
        routeData: result.routeData,
        flightData: result.flightData,
        visaRequirements: result.visaRequirements,
        totalEstimatedCost: result.totalEstimatedCost
      });
      toast.success(travelPlan ? "Travel plan regenerated!" : "Travel plan generated successfully!");
      if (!travelPlan) setFormData(initialFormData);
    } catch (error) {
      console.error("Failed to generate travel plan:", error);
      toast.error("Failed to generate travel plan. Please try again.");
    } finally {
      if (travelPlan) setIsRegenerating(false); else setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleGenerateSubmit(formData);
  };

  const handleRegenerate = () => {
    if (travelPlan) {
      handleGenerateSubmit(travelPlan.formData);
    }
  };

  const handleCopyToClipboard = () => {
    if (!travelPlan) return;
    const planText = `
Travel Plan:
Citizenship: ${travelPlan.formData.citizenship}
Residency/Visa: ${travelPlan.formData.residencyVisa}
Departure: ${travelPlan.formData.departureLocation}
Destination: ${travelPlan.formData.destinationLocation}

Total Estimated Cost: $${travelPlan.totalEstimatedCost}
Distance: ${travelPlan.routeData?.distance || 0} km
Duration: ${Math.floor((travelPlan.routeData?.duration || 0) / 60)}h ${(travelPlan.routeData?.duration || 0) % 60}m

AI Recommendations:
${travelPlan.aiResponse}
    `;
    navigator.clipboard.writeText(planText.trim())
      .then(() => toast.success("Travel plan copied to clipboard!"))
      .catch(() => toast.error("Failed to copy plan."));
  };

  const formatAIResponse = (response: string) => {
    const sections = response.split(/(?=\n(?:[A-Z][^:\n]*:|[0-9]+\.))/);
    return sections.map((section, index) => {
      const trimmed = section.trim();
      if (!trimmed) return null;
      
      const isHeader = /^[A-Z][^:\n]*:/.test(trimmed);
      
      if (isHeader) {
        const [header, ...contentParts] = trimmed.split(':');
        return (
          <div key={index} className="mb-4">
            <h4 className="font-semibold text-gray-800 mb-2 text-lg">
              {header.trim()}
            </h4>
            {contentParts.length > 0 && (
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {contentParts.join(':').trim()}
              </p>
            )}
          </div>
        );
      }
      
      return (
        <p key={index} className="text-gray-600 leading-relaxed mb-3 whitespace-pre-line">
          {trimmed}
        </p>
      );
    }).filter(Boolean);
  };

  const documentChecklist = useMemo(() => {
    if (travelPlan) {
      return extractDocumentChecklist(travelPlan.aiResponse);
    }
    return [];
  }, [travelPlan]);

  // Default values for when data might be missing
  const safeRouteData = travelPlan?.routeData || {
    distance: 0,
    duration: 0,
    transportMethods: []
  };

  const safeFlightData = travelPlan?.flightData || {
    segments: [],
    totalPrice: 0
  };

  const safeVisaRequirements = travelPlan?.visaRequirements || {
    required: false,
    documents: []
  };

  if (travelPlan) {
    return (
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl mx-auto overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-6">
          <h2 className="text-3xl font-bold text-center mb-2">
            Your Personalized Travel Plan
          </h2>
          <p className="text-blue-100 text-center">
            AI-generated recommendations with routing, flights, and visa information
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'map', label: 'Route Map', icon: '🗺️' },
              { id: 'brief', label: 'Travel Brief', icon: '💼' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Trip Summary
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div><span className="font-medium text-gray-700">Citizenship:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.citizenship}</span></div>
                    <div><span className="font-medium text-gray-700">Status:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.residencyVisa}</span></div>
                  </div>
                  <div className="space-y-3">
                    <div><span className="font-medium text-gray-700">From:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.departureLocation}</span></div>
                    <div><span className="font-medium text-gray-700">To:</span> <span className="ml-2 text-gray-600">{travelPlan.formData.destinationLocation}</span></div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-700">${travelPlan.totalEstimatedCost || 0}</div>
                  <div className="text-sm text-blue-600">Total Cost</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-700">{safeRouteData.distance} km</div>
                  <div className="text-sm text-green-600">Distance</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-700">{Math.floor(safeRouteData.duration / 60)}h {safeRouteData.duration % 60}m</div>
                  <div className="text-sm text-purple-600">Duration</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-orange-700">{safeVisaRequirements.required ? 'Yes' : 'No'}</div>
                  <div className="text-sm text-orange-600">Visa Required</div>
                </div>
              </div>

              {/* AI Response */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  AI Travel Recommendations
                </h3>
                <div className="prose max-w-none">
                  {formatAIResponse(travelPlan.aiResponse)}
                </div>
              </div>

              {/* Document Checklist */}
              {documentChecklist.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    Document Checklist
                  </h3>
                  <div className="grid md:grid-cols-2 gap-2">
                    {documentChecklist.map((doc, index) => (
                      <div key={index} className="flex items-center">
                        <input type="checkbox" className="mr-2 h-4 w-4 text-yellow-600 rounded" />
                        <span className="text-yellow-700">{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'map' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">Route Visualization</h3>
              <GoogleMap 
                departure={travelPlan.formData.departureLocation}
                destination={travelPlan.formData.destinationLocation}
                className="h-96 w-full"
              />
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  <strong>Route Details:</strong> {safeRouteData.distance} km via {safeRouteData.transportMethods.join(', ') || 'Unknown transport'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'brief' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">Comprehensive Travel Brief</h3>
              <TravelBrief 
                routeData={safeRouteData}
                flightData={safeFlightData}
                visaRequirements={safeVisaRequirements}
                totalEstimatedCost={travelPlan.totalEstimatedCost || 0}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 px-8 py-6 border-t border-gray-200 flex flex-wrap gap-4 justify-between">
          <div className="flex gap-4">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isRegenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Regenerating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Regenerate Plan
                </>
              )}
            </button>
            <button
              onClick={() => setTravelPlan(null)}
              className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              New Plan
            </button>
          </div>
          <button
            onClick={handleCopyToClipboard}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M3 5a2 2 0 012-2 3 3 0 003 3h6a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L14.586 13H19v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11.586V9a1 1 0 00-1-1H9.414l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 10H14a1 1 0 001 1v.586z" />
            </svg>
            Copy Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary mb-2">
          Plan Your International Journey
        </h2>
        <p className="text-gray-600">
          Get AI-powered travel recommendations, visa requirements, and route planning
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="citizenship" className="block text-sm font-medium text-gray-700 mb-2">
              Citizenship
            </label>
            <select
              id="citizenship"
              name="citizenship"
              value={formData.citizenship}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-md bg-gray-50 border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
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
            <label htmlFor="residencyVisa" className="block text-sm font-medium text-gray-700 mb-2">
              Current Status
            </label>
            <select
              id="residencyVisa"
              name="residencyVisa"
              value={formData.residencyVisa}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-md bg-gray-50 border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
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
            <label htmlFor="departureLocation" className="block text-sm font-medium text-gray-700 mb-2">
              Departure Location
            </label>
            <input
              type="text"
              id="departureLocation"
              name="departureLocation"
              value={formData.departureLocation}
              onChange={handleChange}
              placeholder="e.g., New York, USA"
              className="w-full px-4 py-3 rounded-md bg-gray-50 border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
              required
            />
          </div>

          <div>
            <label htmlFor="destinationLocation" className="block text-sm font-medium text-gray-700 mb-2">
              Destination
            </label>
            <input
              type="text"
              id="destinationLocation"
              name="destinationLocation"
              value={formData.destinationLocation}
              onChange={handleChange}
              placeholder="e.g., London, UK"
              className="w-full px-4 py-3 rounded-md bg-gray-50 border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary text-white py-3 px-6 rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Generating Your Travel Plan...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Generate Travel Plan
            </>
          )}
        </button>
      </form>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">What you'll get:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• AI-powered travel recommendations</li>
          <li>• Visa requirements and documentation</li>
          <li>• Route planning with multiple transport options</li>
          <li>• Flight options and cost estimates</li>
          <li>• Interactive map visualization</li>
          <li>• Border crossing guidance</li>
        </ul>
      </div>
    </div>
  );
}
