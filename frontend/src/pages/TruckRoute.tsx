import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  ZoomControl,
} from "react-leaflet";
import L, { LatLngBoundsLiteral, LatLngTuple } from "leaflet";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Clock,
  TrendingUp,
  Truck,
  UserCheck,
  Coffee,
  Moon,
  FlagTriangleRight,
  PackagePlus,
  MapPinCheckInside,
  Fuel,
} from "lucide-react";
import { useParams } from "react-router-dom";
import api from "@/api";

interface Location {
  lat: number;
  lon: number;
  name?: string;
}

interface Log {
  start_time: string;
  end_time?: string;
  status: string;
  notes?: string;
  location: Location;
  duration: number;
  miles: number;
}

interface DailySummary {
  date: string;
  drive_hours: number;
  on_duty_hours: number;
  miles: number;
  logs: Log[];
}

interface TripData {
  trip_id: number;
  daily_summaries: DailySummary[];
}

interface RouteSegment {
  points: [number, number][];
  color: string;
  weight: number;
  opacity: number;
  dashArray: string | null;
}


const createMarkerIcon = (color:string, log:Log) => {
  let iconElement;
  if (log.start_time.includes("07:00:00")) 
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';
  else if (log.notes === "Pickup Activity") 
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package-plus"><path d="M16 16h6"/><path d="M19 13v6"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>';
  else if (log.notes === "Dropoff Activity")
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin-check-inside"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><path d="m9 10 2 2 4-4"/></svg>';
  else if (log.notes === "Off duty until midnight (continues to next day)")
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  else if(log.notes==="Fuel stop")
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-fuel"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>';
  else if(log.notes==="Required 30-minute break after 8 hours of driving")
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coffee"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>';
  else if (log.notes==="Overnight rest period (continued from previous day)")
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  else if (log.status === "D")
    iconElement = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';
  else iconElement='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
  return L.divIcon({
    className: "custom-marker-icon",
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${iconElement}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};
const DriverRouteMap = () => {
  const { tripId } = useParams<{ tripId: string }>(); // Explicitly type useParams
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]|any>([]);
  const [fetchingRoute, setFetchingRoute] = useState<boolean>(false);
  const mapRef = useRef<L.Map | null>(null); // Type the ref
  const markerRefs = useRef<{[key: number]: L.Marker}>({});


  useEffect(() => {
    api.get(`api/trip-details/${tripId}/`)
      .then(res => {
        setTripData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching trip data:", err);
        setLoading(false);
      });
  }, [tripId]);

  const createRoutePairs = (logs:Log[]) => {
    const validLogs = logs.filter(hasValidLocation);
    const pairs = [];

    for (let i = 0; i < validLogs.length - 1; i++) {
      const currentLog = validLogs[i];
      const nextLog = validLogs[i + 1];

      const isCurrentRest = currentLog.notes && 
                          (currentLog.notes.includes("Overnight") || 
                           currentLog.notes.includes("Off duty until"));
      
      if (currentLog.status === "D" || isCurrentRest) {
        pairs.push([currentLog, nextLog]);
      }
    }
    
    return pairs;
  };

  useEffect(() => {
    if (!tripData) return;

    const fetchRoutes = async () => {
      setFetchingRoute(true);
      try {
        const dailyLogs = tripData.daily_summaries[selectedDay].logs;
        const routePairs = createRoutePairs(dailyLogs);
        
        if (routePairs.length === 0) {
          setRouteSegments([]);
          return;
        }
        const segments = [];
        
        for (const [startLog, endLog] of routePairs) {
          try {
            if (startLog.location.lat !== endLog.location.lat || 
                startLog.location.lon !== endLog.location.lon) {
              
              // Determine color based on the current log status
              const isOvernightRest = startLog.notes && 
                                    (startLog.notes.includes("Overnight") || 
                                     startLog.notes.includes("Off duty until"));
              const routeColor = isOvernightRest ? "#4f46e5" : "#3b82f6"; // Use indigo for overnight connections
              
              const response = await fetchOSRMRoute(
                [startLog.location.lon, startLog.location.lat],
                [endLog.location.lon, endLog.location.lat]
              );

              if (response && response.routes && response.routes[0]) {
                // Decode the polyline and add to segments
                const decodedRoute = decodePolyline(response.routes[0].geometry);
                segments.push({
                  points: decodedRoute,
                  color: routeColor,
                  weight: 4,
                  opacity: isOvernightRest ? 0.5 : 0.7, 
                  dashArray: isOvernightRest ? "5, 10" : null 
                });
              }
            }
          } catch (error) {
            console.error(`Error fetching route from ${startLog.location.lat},${startLog.location.lon} to ${endLog.location.lat},${endLog.location.lon}:`, error);
          }
        }

        setRouteSegments(segments);
      } catch (error) {
        console.error("Error fetching routes:", error);
      } finally {
        setFetchingRoute(false);
      }
    };

    fetchRoutes();
  }, [tripData, selectedDay]);

  useEffect(() => {
    if (selectedLogIndex !== null && mapRef.current) {
      const validLogs = getValidLocationLogs();
      if (validLogs[selectedLogIndex]) {
        const { lat, lon } = validLogs[selectedLogIndex].location;
        
        // Set view with better zoom level and ensure marker is centered
        mapRef.current.setView([lat, lon], 13, {
          animate: true,
          duration: 0.5,
          pan: {
            animate: true,
            duration: 0.5,
            easeLinearity: 0.5
          }
        });
        
        // Open the popup for the selected marker after centering is complete
        if (markerRefs.current[selectedLogIndex]) {
          setTimeout(() => {
            markerRefs.current[selectedLogIndex].openPopup();
          }, 600); // Increased timeout to ensure map panning is complete
        }
      }
    }
  }, [selectedLogIndex]);

  const fetchOSRMRoute = async (start:number[], end:number[]) => {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=polyline`
    );
    return await response.json();
  };

  const decodePolyline = (encoded: string) => {
    if (!encoded) return [];

    let index = 0;
    const len = encoded.length;
    let lat = 0,
      lng = 0;
    const points = [];

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  };

  // Format time in HH:MM format
  const formatTime = (isoString:string|any) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = (hours:number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };
  const getStatusIcon = (log:Log) => {
    if (log.start_time.includes("7:00:00")) 
      return <FlagTriangleRight className="text-green-500" />;
    else if (log.notes === "Pickup Activity") 
      return <PackagePlus className="text-blue-500" />;
    else if (log.notes === "Dropoff Activity")
      return <MapPinCheckInside className="text-purple-500" />;
    else if (log.notes && log.notes.includes("Off duty until midnight"))
      return <Moon className="text-indigo-500" />;
    else if (log.notes === "Fuel stop")
      return <Fuel className="text-red-500" />;
    else if (log.notes && log.notes.includes("Required 30-minute break"))
      return <Coffee className="text-amber-500" />;
    else if (log.notes && log.notes.includes("Overnight rest"))
      return <Moon className="text-indigo-500" />;
    else if (log.status === "D")
      return <Truck className="text-blue-600" />;
    else if (log.status === "ON")
      return <UserCheck className="text-green-600" />;
    else if (log.status === "OFF")
      return <Clock className="text-orange-500" />;
    return <Clock className="text-gray-500" />;
  };

  const getMarkerColor = (status:string, notes:string) => {
    if (notes === "Pickup Activity") return "#2563eb"; 
    if (notes === "Dropoff Activity") return "#7c3aed";
    if (notes === "Fuel stop") return "#dc2626"; 
    if (notes && notes.includes("break")) return "#d97706"; 
    if (notes && notes.includes("Overnight")) return "#4f46e5"; 
    
    switch (status) {
      case "D":
        return "#3b82f6"; 
      case "ON":
        return "#22c55e"; 
      case "OFF":
        return "#f97316"; 
      case "SB":
        return "#a855f7"; 
      default:
        return "#6b7280"; 
    }
  };


  const hasValidLocation = (log:Log) => {
    return log.location && log.location.lat && log.location.lon;
  };

  const getValidLocationLogs = () => {
    if (!tripData || !tripData.daily_summaries[selectedDay]) return [];
    return tripData.daily_summaries[selectedDay].logs.filter(hasValidLocation);
  };

  // Get a descriptive status label
  const getStatusLabel = (status:string) => {
    switch (status) {
      case "D": return "Driving";
      case "ON": return "On Duty";
      case "OFF": return "Off Duty";
      case "SB": return "Sleeper Berth";
      default: return status;
    }
  };

  const getMapBounds = () => {
    const validLogs = getValidLocationLogs();
    if (validLogs.length === 0) return { center: [39.8283, -98.5795], zoom: 4 }; 

    if (validLogs.length === 1) {
      return {
        center: [validLogs[0].location.lat, validLogs[0].location.lon],
        zoom: 12,
      };
    }


    let minLat = 90,
      maxLat = -90,
      minLon = 180,
      maxLon = -180;

    validLogs.forEach((log) => {
      minLat = Math.min(minLat, log.location.lat);
      maxLat = Math.max(maxLat, log.location.lat);
      minLon = Math.min(minLon, log.location.lon);
      maxLon = Math.max(maxLon, log.location.lon);
    });

    return {
      center: [(minLat + maxLat) / 2, (minLon + maxLon) / 2],
      bounds: [
        [minLat - 0.1, minLon - 0.1],
        [maxLat + 0.1, maxLon + 0.1],
      ],
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl font-semibold">Loading trip data...</div>
      </div>
    );
  }

  if (!tripData) {
    return <div className="text-red-500 p-4 font-semibold">Error loading trip data</div>;
  }

  const validLocationLogs = getValidLocationLogs();
  const mapSettings = getMapBounds();

  return (
    <div className="flex flex-col space-y-4 h-full">
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Driver Route Map - Trip #{tripData.trip_id}</span>
            <div className="flex space-x-2">
              {tripData.daily_summaries.map((day, index) => (
                <button
                  key={index}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    selectedDay === index
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}
                  onClick={() => {
                    setSelectedDay(index);
                    setSelectedLogIndex(null);
                  }}
                >
                  {day.date}
                </button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <div className="flex flex-col md:flex-row gap-4 h-full">
            <div className="w-full md:w-1/3 bg-gray-100 p-4 rounded-lg h-full">
              <h3 className="font-semibold mb-4">
                Day Summary - {tripData.daily_summaries[selectedDay].date}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded shadow flex items-center">
                  <Truck className="h-5 w-5 text-blue-500 mr-2" />
                  <div>
                    <div className="text-sm text-gray-500">Drive Hours</div>
                    <div className="font-medium">
                      {formatDuration(
                        tripData.daily_summaries[selectedDay].drive_hours
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded shadow flex items-center">
                  <UserCheck className="h-5 w-5 text-green-500 mr-2" />
                  <div>
                    <div className="text-sm text-gray-500">On Duty Hours</div>
                    <div className="font-medium">
                      {formatDuration(
                        tripData.daily_summaries[selectedDay].on_duty_hours
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded shadow flex items-center">
                  <TrendingUp className="h-5 w-5 text-orange-500 mr-2" />
                  <div>
                    <div className="text-sm text-gray-500">Miles</div>
                    <div className="font-medium">
                      {tripData.daily_summaries[selectedDay].miles.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold mt-6 mb-4">Waypoints</h3>
              <div className="flex flex-col space-y-2 max-h-96 overflow-y-auto">
                {validLocationLogs.map((log, index) => (
                  log.start_time.includes("00:00:00") ? null :
                  <button
                    key={index}
                    className={`flex items-center p-3 rounded hover:bg-gray-200 transition-colors ${
                      selectedLogIndex === index
                        ? "bg-blue-100 border border-blue-300"
                        : "bg-white"
                    }`}
                    onClick={() => setSelectedLogIndex(index)}
                  >
                    <div
                      className={`rounded-full p-2 mr-3`}
                      style={{ color: getMarkerColor(log.status, log.notes || '') }}
                    >
                      {getStatusIcon(log)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">
                        {log.notes || getStatusLabel(log.status)}
                      </div>
                      <div className="text-xs text-gray-500">
                        start: {formatTime(log.start_time)}
                        <br />
                        {log.end_time && `end: ${formatTime(log.end_time)}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full md:w-2/3 bg-gray-100 p-4 rounded-lg">
              <div className="bg-white p-4 rounded-lg shadow-md h-96 relative">
                {validLocationLogs.length > 0 ? (
                  <MapContainer
                    center={[mapSettings.center[0], mapSettings.center[1]] as LatLngTuple}
                    bounds={mapSettings.bounds as LatLngBoundsLiteral}
                    style={{ height: "100%", width: "100%" }}
                    zoomControl={false}
                    // @ts-ignore
                    whenReady={(event:any) => { mapRef.current = event.target; }}
                  >
                    <ZoomControl position="topright" />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {routeSegments.map((segment: RouteSegment, idx: number) => (
                      <Polyline
                        key={`route-${idx}`}
                        positions={segment.points}
                        color={segment.color}
                        weight={segment.weight}
                        opacity={segment.opacity}
                        dashArray={segment.dashArray || []}
                      />
                    ))}

  
                    {validLocationLogs.map((log, index) => (
                      log.start_time.includes("00:00:00") ? null :
                      <Marker
                        key={index}
                        position={[
                          log.location.lat,  // Removed the offset
                          log.location.lon
                        ]}
                        icon={createMarkerIcon(getMarkerColor(log.status, log.notes || ''), log)}
                        eventHandlers={{
                          click: () => {
                            setSelectedLogIndex(index);
                          },
                        }}
                        ref={(markerElement) => {
                          if (markerElement) {
                            markerRefs.current[index] = markerElement;
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <div className="font-bold">
                              {log.notes || getStatusLabel(log.status)}
                            </div>
                            <div className="text-sm">
                              {formatTime(log.start_time)}
                              {log.end_time && ` - ${formatTime(log.end_time)}`}
                            </div>
                            <div className="text-sm">
                              Status: {getStatusLabel(log.status)}
                            </div>
                            <div className="text-sm">
                              Duration: {formatDuration(log.duration)}
                            </div>
                            {log.miles > 0 && (
                              <div className="text-sm">
                                Distance: {log.miles.toFixed(1)} mi
                              </div>
                            )}
                            {log.location && log.location.name && (
                              <div className="text-sm mt-1">
                                <div className="text-xs font-bold">Location</div>
                                {log.location.name.replace("Location at ", "")}
                              </div>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p>No waypoints with valid locations for this day</p>
                  </div>
                )}

                {fetchingRoute && (
                  <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                    <div className="text-lg">Calculating route...</div>
                  </div>
                )}
              </div>

              {selectedLogIndex !== null && (
                <div className="mt-4 bg-white p-4 rounded-lg shadow-md">
                  <h3 className="font-semibold text-lg mb-2">
                    {validLocationLogs[selectedLogIndex].notes ||
                      getStatusLabel(validLocationLogs[selectedLogIndex].status)}
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="border rounded p-3">
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="flex items-center">
                        {getStatusIcon(
                          validLocationLogs[selectedLogIndex]
                        )}
                        <span className="ml-1 font-medium">
                          {getStatusLabel(validLocationLogs[selectedLogIndex].status)}
                        </span>
                      </div>
                    </div>

                    <div className="border rounded p-3">
                      <div className="text-xs text-gray-500">Location</div>
                      {validLocationLogs[
                        selectedLogIndex
                      ]?.location?.name?.replace("Location at ", "")}
                    </div>

                    <div className="border rounded p-3">
                      <div className="text-xs text-gray-500">Time</div>
                      <div className="font-medium">
                        {formatTime(
                          validLocationLogs[selectedLogIndex].start_time
                        )}
                        {validLocationLogs[selectedLogIndex].end_time && 
                          ` - ${formatTime(validLocationLogs[selectedLogIndex].end_time)}`}
                      </div>
                    </div>

                    <div className="border rounded p-3">
                      <div className="text-xs text-gray-500">
                        Duration
                      </div>
                      <div className="font-medium flex items-center">
                        <Clock className="h-4 w-4 text-blue-500 mr-1" />
                        {formatDuration(validLocationLogs[selectedLogIndex].duration)}
                        {validLocationLogs[selectedLogIndex].miles > 0 && (
                          <>
                            <span className="mx-1">•</span>
                            <TrendingUp className="h-4 w-4 text-orange-500 mr-1" />
                            {validLocationLogs[selectedLogIndex].miles.toFixed(1)} mi
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverRouteMap;