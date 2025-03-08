import { useEffect } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { MapPin, Navigation } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";


const pickupIcon = new L.Icon({
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    shadowSize: [41, 41],
    className: "pickup-marker",
  });
  


// Map click handler component
const MapClickHandler = ({
    activeLocationType,
    setCurrentPosition,
    setPickupPosition,
    setDropoffPosition,
  }: any) => {
    useMapEvents({
      click: (e) => {
        const { latlng } = e;
        if (activeLocationType === "current") {
          setCurrentPosition(latlng);
        } else if (activeLocationType === "pickup") {
          setPickupPosition(latlng);
        } else if (activeLocationType === "dropoff") {
          setDropoffPosition(latlng);
        }
      },
    });
    return null;
  };


const LocationPicker = ({
    currentPosition,
    setCurrentPosition,
    pickupPosition,
    setPickupPosition,
    dropoffPosition,
    setDropoffPosition,
    activeLocationType,
    setActiveLocationType,
    currentLocationAddress,
    setCurrentLocationAddress,
    pickupLocationAddress,
    setPickupLocationAddress,
    dropoffLocationAddress,
    setDropoffLocationAddress,
  }: any) => {
    const handleReverseGeocode = async (position: any, locationType: any) => {
      try {
        // Using Nominatim for reverse geocoding
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
  
        if (data && data.display_name) {
          const address = data.display_name;
          if (locationType === "current") {
            setCurrentLocationAddress(address);
          } else if (locationType === "pickup") {
            setPickupLocationAddress(address);
          } else if (locationType === "dropoff") {
            setDropoffLocationAddress(address);
          }
        }
      } catch (error) {
        console.error("Error with reverse geocoding:", error);
      }
    };
  
    // Update address when position changes
    useEffect(() => {
      if (currentPosition) {
        handleReverseGeocode(currentPosition, "current");
      }
    }, [currentPosition]);
  
    useEffect(() => {
      if (pickupPosition) {
        handleReverseGeocode(pickupPosition, "pickup");
      }
    }, [pickupPosition]);
  
    useEffect(() => {
      if (dropoffPosition) {
        handleReverseGeocode(dropoffPosition, "dropoff");
      }
    }, [dropoffPosition]);
  
    const formatCoordinates = (position: any) => {
      if (!position) return "Not selected";
      return `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
    };
  
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            variant={activeLocationType === "current" ? "default" : "outline"}
            onClick={() => setActiveLocationType("current")}
            className="flex items-center gap-2"
            size="sm"
          >
            <Navigation className="h-4 w-4" />
            Current Location
          </Button>
  
          <Button
            type="button"
            variant={activeLocationType === "pickup" ? "default" : "outline"}
            onClick={() => setActiveLocationType("pickup")}
            className="flex items-center gap-2"
            size="sm"
          >
            <MapPin className="h-4 w-4" />
            Pickup Point
          </Button>
  
          <Button
            type="button"
            variant={activeLocationType === "dropoff" ? "default" : "outline"}
            onClick={() => setActiveLocationType("dropoff")}
            className="flex items-center gap-2"
            size="sm"
          >
            <MapPin className="h-4 w-4" />
            Dropoff Point
          </Button>
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <div>
            <div className="text-xs font-medium mb-1">Current Location:</div>
            <Badge
              variant="outline"
              className={currentPosition ? "text-green-600" : "text-gray-400"}
            >
              {formatCoordinates(currentPosition)}
            </Badge>
            {currentLocationAddress && (
              <div className="text-xs mt-1 text-gray-600 truncate max-w-48">
                {currentLocationAddress}
              </div>
            )}
          </div>
  
          <div>
            <div className="text-xs font-medium mb-1">Pickup Location:</div>
            <Badge
              variant="outline"
              className={pickupPosition ? "text-blue-600" : "text-gray-400"}
            >
              {formatCoordinates(pickupPosition)}
            </Badge>
            {pickupLocationAddress && (
              <div className="text-xs mt-1 text-gray-600 truncate max-w-48">
                {pickupLocationAddress}
              </div>
            )}
          </div>
  
          <div>
            <div className="text-xs font-medium mb-1">Dropoff Location:</div>
            <Badge
              variant="outline"
              className={dropoffPosition ? "text-blue-600" : "text-gray-400"}
            >
              {formatCoordinates(dropoffPosition)}
            </Badge>
            {dropoffLocationAddress && (
              <div className="text-xs mt-1 text-gray-600 truncate max-w-48">
                {dropoffLocationAddress}
              </div>
            )}
          </div>
        </div>
  
        <div
          className="border rounded-md overflow-hidden"
          style={{ height: "300px" }}
        >
          <MapContainer
            center={[40.7128, -74.006]} // Default to NYC
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler
              activeLocationType={activeLocationType}
              setCurrentPosition={setCurrentPosition}
              setPickupPosition={setPickupPosition}
              setDropoffPosition={setDropoffPosition}
            />
            {currentPosition && (
              <Marker position={currentPosition} icon={pickupIcon} />
            )}
            {pickupPosition && (
              <Marker position={pickupPosition} icon={pickupIcon} />
            )}
            {dropoffPosition && (
              <Marker position={dropoffPosition} icon={pickupIcon} />
            )}
          </MapContainer>
        </div>
  
        <div className="text-xs text-gray-500 mt-2">
          Click on the map to set {activeLocationType} location
        </div>
      </div>
    );
  };

export default LocationPicker;