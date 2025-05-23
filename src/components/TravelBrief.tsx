import React from 'react';

interface TravelBriefProps {
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

export function TravelBrief({ routeData, flightData, visaRequirements, totalEstimatedCost }: TravelBriefProps) {
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Cost Overview */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-green-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
          </svg>
          Total Estimated Cost
        </h3>
        <div className="text-3xl font-bold text-green-700 mb-2">
          {formatCurrency(totalEstimatedCost)}
        </div>
        <div className="text-sm text-green-600">
          Includes flights, accommodation estimates, and miscellaneous expenses
        </div>
      </div>

      {/* Route Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-blue-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
          </svg>
          Route Details
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700">{routeData.distance} km</div>
            <div className="text-sm text-blue-600">Total Distance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700">{formatDuration(routeData.duration)}</div>
            <div className="text-sm text-blue-600">Travel Time</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-700 font-medium">
              {routeData.transportMethods.join(', ')}
            </div>
            <div className="text-sm text-blue-600">Transport Methods</div>
          </div>
        </div>
      </div>

      {/* Flight Information */}
      {flightData.segments.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-purple-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            Flight Options
          </h3>
          <div className="space-y-3">
            {flightData.segments.map((segment, index) => (
              <div key={index} className="flex justify-between items-center bg-white p-3 rounded border">
                <div>
                  <div className="font-medium text-purple-800">
                    {segment.departure} → {segment.arrival}
                  </div>
                  <div className="text-sm text-purple-600">
                    {segment.airline} • {segment.duration}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-purple-700">
                    {formatCurrency(segment.price)}
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between items-center font-bold text-purple-800">
              <span>Total Flight Cost:</span>
              <span>{formatCurrency(flightData.totalPrice)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Visa Requirements */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          Visa & Documentation
        </h3>
        
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <span className="font-medium text-orange-700">Visa Required:</span>
            <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
              visaRequirements.required 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {visaRequirements.required ? 'Yes' : 'No'}
            </span>
          </div>
          
          {visaRequirements.type && (
            <div className="mb-2">
              <span className="font-medium text-orange-700">Visa Type:</span>
              <span className="ml-2 text-orange-600">{visaRequirements.type}</span>
            </div>
          )}
          
          {visaRequirements.processingTime && (
            <div className="mb-4">
              <span className="font-medium text-orange-700">Processing Time:</span>
              <span className="ml-2 text-orange-600">{visaRequirements.processingTime}</span>
            </div>
          )}
        </div>

        <div>
          <h4 className="font-medium text-orange-800 mb-2">Required Documents:</h4>
          <ul className="list-disc list-inside space-y-1 text-orange-700">
            {visaRequirements.documents.map((doc, index) => (
              <li key={index}>{doc}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Border Crossing Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Border Crossing Tips
        </h3>
        <ul className="space-y-2 text-yellow-700">
          <li className="flex items-start">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
            Arrive at border crossings during business hours when possible
          </li>
          <li className="flex items-start">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
            Have all documents organized and easily accessible
          </li>
          <li className="flex items-start">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
            Carry sufficient cash for border fees and unexpected expenses
          </li>
          <li className="flex items-start">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
            Check current border status and any COVID-19 restrictions
          </li>
        </ul>
      </div>
    </div>
  );
}
