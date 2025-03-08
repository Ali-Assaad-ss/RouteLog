import React, { useState, useEffect } from "react";
import api from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPin, Navigation, Clock, FileText,Map, Pencil, Trash2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import LocationPicker from "@/components/LocationPicker";

export interface Trip {
  id: number;
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used: number;
  created_at: string;
  updated_at: string;
  user: number;
  current_latitude?: number;
  current_longitude?: number;
  pickup_latitude?: number;
  pickup_longitude?: number;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// Trip Card component
const TripCard = ({ trip, onEdit, onDelete }: any) => {
  return (
    <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow mt-4">
      <div className="flex justify-between items-start w-full">
        <CardHeader className="pb-2 pr-2 flex-1 min-w-0">
          <CardTitle className="text-lg font-bold truncate">
            {trip.dropoff_location.split(",")[0]}
          </CardTitle>
        </CardHeader>
        <div className="pt-3 pr-3 flex-shrink-0 flex space-x-1">
          <Button
            onClick={() => onEdit(trip)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            onClick={() => onDelete(trip.id)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>
      <CardContent className="space-y-3 pb-4 pt-0">
        <div className="flex items-start space-x-2">
          <Navigation className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Current Location</p>
            <p className="text-sm font-medium truncate">{trip.current_location}</p>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <MapPin className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Pickup</p>
            <p className="text-sm font-medium truncate">{trip.pickup_location}</p>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <MapPin className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Destination</p>
            <p className="text-sm font-medium truncate">{trip.dropoff_location}</p>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <Clock className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Cycle Hours</p>
            <p className="text-sm font-medium truncate">
              {trip.current_cycle_used} hours
            </p>
          </div>
        </div>
      </CardContent>
      <div className="px-6 pb-4 grid grid-cols-2 gap-2">
        <a
          href={`/directions/${trip.id}`}
          className="flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          <Map className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">Directions</span>
        </a>
        <a
          href={`/eld/${trip.id}`}
          className="flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">ELD Logs</span>
        </a>
      </div>
    </Card>
  );
};

// Main component
const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Location states
  const [activeLocationType, setActiveLocationType] = useState<
    "current" | "pickup" | "dropoff"
  >("current");

  // Coordinate states
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(
    null
  );
  const [pickupPosition, setPickupPosition] = useState<Coordinates | null>(
    null
  );
  const [dropoffPosition, setDropoffPosition] = useState<Coordinates | null>(
    null
  );

  // Address states
  const [currentLocationAddress, setCurrentLocationAddress] = useState("");
  const [pickupLocationAddress, setPickupLocationAddress] = useState("");
  const [dropoffLocationAddress, setDropoffLocationAddress] = useState("");

  // Trip form state
  const [cycleHours, setCycleHours] = useState(0);

  // Edit state
  const [editingTripId, setEditingTripId] = useState<number | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/api/trips/");
      setTrips(response.data);
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTrip = (trip: Trip) => {
    setEditingTripId(trip.id);
    setCycleHours(trip.current_cycle_used);

    // Convert coordinates from the trip to position objects
    if (trip.current_latitude && trip.current_longitude) {
      setCurrentPosition({
        lat: trip.current_latitude,
        lng: trip.current_longitude,
      });
    }

    if (trip.pickup_latitude && trip.pickup_longitude) {
      setPickupPosition({
        lat: trip.pickup_latitude,
        lng: trip.pickup_longitude,
      });
    }

    if (trip.dropoff_latitude && trip.dropoff_longitude) {
      setDropoffPosition({
        lat: trip.dropoff_latitude,
        lng: trip.dropoff_longitude,
      });
    }

    // Set addresses
    setCurrentLocationAddress(trip.current_location);
    setPickupLocationAddress(trip.pickup_location);
    setDropoffLocationAddress(trip.dropoff_location);

    setIsModalOpen(true);
  };

  const handleDeleteTrip = async (id: number) => {
    if (!confirm("Are you sure you want to delete this trip?")) return;

    setIsLoading(true);
    try {
      await api.delete(`/api/trips/${id}/`);
      setTrips(trips.filter((trip) => trip.id !== id));
    } catch (error) {
      console.error("Error deleting trip:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingTripId(null);
    setCurrentPosition(null);
    setPickupPosition(null);
    setDropoffPosition(null);
    setCurrentLocationAddress("");
    setPickupLocationAddress("");
    setDropoffLocationAddress("");
    setCycleHours(0);
    setActiveLocationType("current");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const tripData = {
        current_location: currentLocationAddress,
        pickup_location: pickupLocationAddress,
        dropoff_location: dropoffLocationAddress,
        current_cycle_used: cycleHours,
        current_latitude: currentPosition?.lat || null,
        current_longitude: currentPosition?.lng || null,
        pickup_latitude: pickupPosition?.lat || null,
        pickup_longitude: pickupPosition?.lng || null,
        dropoff_latitude: dropoffPosition?.lat || null,
        dropoff_longitude: dropoffPosition?.lng || null,
      };

      let response: any;

      if (editingTripId) {
        response = await api.put(`/api/trips/${editingTripId}/`, tripData);
        setTrips(
          trips.map((trip) =>
            trip.id === editingTripId ? response.data : trip
          )
        );
      } else {
        response = await api.post("/api/trips/", tripData);
        setTrips([...trips, response.data]);
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving trip:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          My Trips
        </h1>
        <Button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
        >
          New Trip
        </Button>
      </div>

      {isLoading && trips.length === 0 ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            No trips found
          </h3>
          <p className="text-gray-500 mb-4">
            Start by creating your first trip
          </p>
          <Button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
          >
            Create New Trip
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onEdit={handleEditTrip}
              onDelete={handleDeleteTrip}
            />
          ))}
        </div>
      )}

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setIsModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[95vw] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTripId ? "Edit Trip" : "Create New Trip"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <LocationPicker
                currentPosition={currentPosition}
                setCurrentPosition={setCurrentPosition}
                pickupPosition={pickupPosition}
                setPickupPosition={setPickupPosition}
                dropoffPosition={dropoffPosition}
                setDropoffPosition={setDropoffPosition}
                activeLocationType={activeLocationType}
                setActiveLocationType={setActiveLocationType}
                currentLocationAddress={currentLocationAddress}
                setCurrentLocationAddress={setCurrentLocationAddress}
                pickupLocationAddress={pickupLocationAddress}
                setPickupLocationAddress={setPickupLocationAddress}
                dropoffLocationAddress={dropoffLocationAddress}
                setDropoffLocationAddress={setDropoffLocationAddress}
              />
            </div>

            <div>
              <Label htmlFor="cycle_used">Cycle Hours Used</Label>
              <Input
                id="cycle_used"
                type="number"
                min="0"
                step="0.1"
                value={cycleHours}
                onChange={(e) => setCycleHours(parseFloat(e.target.value))}
                required
                className="mt-1"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  !currentPosition ||
                  !pickupPosition ||
                  !dropoffPosition ||
                  !currentLocationAddress ||
                  !pickupLocationAddress ||
                  !dropoffLocationAddress
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="h-4 w-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    {editingTripId ? "Updating..." : "Creating..."}
                  </div>
                ) : editingTripId ? (
                  "Update Trip"
                ) : (
                  "Create Trip"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TripsPage;
