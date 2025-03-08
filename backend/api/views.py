from api.models import CustomUser
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework import generics 
from .models import Trip
from .serializers import TripSerializer, UserSerializer
from rest_framework import permissions
from rest_framework.response import Response 
from rest_framework import status 
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse
from datetime import datetime, timedelta
import requests
from django.conf import settings

class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        # Handle user registration
        response = super().create(request, *args, **kwargs)
        # Create JWT token for the new user
        user = CustomUser.objects.get(username=request.data['username'])
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)
        

class GetUserView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # If the request is read-only, allow access.
        if request.method in permissions.SAFE_METHODS:
            return True
        # Otherwise, only the owner can edit
        return obj.user == request.user


# Trip ViewSet (Requires Authentication)
class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]  # Only authenticated users can access


MAX_DRIVE_HOURS_PER_DAY = 11
MAX_ON_DUTY_HOURS_PER_DAY = 14 
MAX_DRIVE_HOURS_BEFORE_BREAK = 8
MAX_WEEKLY_HOURS = 70 #(70-hour/8-day rule)
FUEL_STOP_DISTANCE = 1000         # Miles before requiring a fuel stop
PICKUP_DROPOFF_TIME = 60          # Minutes for pickup/dropoff activities

# ELD activity status codes
STATUS_DRIVING = "D"              # Driving
STATUS_ON_DUTY = "ON"             # On-duty not driving
STATUS_OFF_DUTY = "OFF"           # Off-duty
STATUS_SLEEPER = "SB"             # Sleeper berth

def get_route(start_lat, start_lon, end_lat, end_lon):
    """
    Get route details from OSRM API
    Returns structured route data including steps, distance, and duration
    """
    osrm_url = "http://router.project-osrm.org/route/v1/driving/"
    url = f"{osrm_url}{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&steps=true&annotations=true"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            route_data = response.json()
            
            # Check if routes are available
            if 'routes' in route_data and len(route_data['routes']) > 0:
                route = route_data['routes'][0]
                
                # Extract and structure the route information
                structured_route = {
                    'total_distance': route['distance'] / 1609.34,  # Convert meters to miles
                    'total_duration': route['duration'] / 60 / 60,  # Convert seconds to hours
                    'steps': []
                }
                
                # Process each step of the route
                if 'legs' in route and len(route['legs']) > 0:
                    for leg in route['legs']:
                        for step in leg['steps']:
                            structured_step = {
                                'distance': step['distance'] / 1609.34,  # miles
                                'duration': step['duration'] / 60 / 60,   # hours
                                'name': step.get('name', 'Unnamed Road'),
                                'start_location': {
                                    'lat': step['maneuver']['location'][1],
                                    'lon': step['maneuver']['location'][0]
                                },
                                'end_location': {
                                    'lat': step['maneuver']['location'][1],  # Will be updated below if available
                                    'lon': step['maneuver']['location'][0]
                                }
                            }
                            structured_route['steps'].append(structured_step)
                
                # Ensure each step has proper end locations (which become the start location of the next step)
                for i in range(len(structured_route['steps']) - 1):
                    structured_route['steps'][i]['end_location'] = structured_route['steps'][i + 1]['start_location']
                
                # Make sure the last step ends at the destination
                if structured_route['steps']:
                    structured_route['steps'][-1]['end_location'] = {
                        'lat': end_lat,
                        'lon': end_lon
                    }
                
                return structured_route
            else:
                raise ValueError("No routes found in the OSRM response.")
        else:
            raise ValueError(f"OSRM API request failed with status code {response.status_code}")
    except Exception as e:
        raise ValueError(f"Error fetching route: {str(e)}")

def get_location_details(lat, lon):
    """
    Returns a standardized location object
    """
    return {
        "name": f"Location at {lat:.4f}, {lon:.4f}",
        "lat": lat,
        "lon": lon
    }

def calculate_eld_logs(trip):
    """
    Calculate ELD logs for a trip with proper location tracking
    """
    base_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    shift_start_time = base_date.replace(hour=6, minute=30, second=0)
    
    # Initialize current location from trip data
    current_location = {
        "lat": trip['current_latitude'],
        "lon": trip['current_longitude'],
        "name": f"Location at {trip['current_latitude']:.4f}, {trip['current_longitude']:.4f}"
    }
    
    # Keep track of physical truck location separately from segment locations
    truck_location = current_location.copy()
    
    eld_logs_by_day = {}
    daily_log_key = shift_start_time.strftime("%Y-%m-%d")
    eld_logs_by_day[daily_log_key] = []
    
    if shift_start_time.hour > 0 or shift_start_time.minute > 0 or shift_start_time.second > 0:
        midnight = base_date
        eld_logs_by_day[daily_log_key].append({
            "status": STATUS_OFF_DUTY,
            "start_time": midnight.strftime("%Y-%m-%dT%H:%M:%S"),
            "end_time": shift_start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration": (shift_start_time - midnight).total_seconds() / 3600,
            "location": truck_location,  # Use truck's physical location
            "miles": 0,
            "notes": "Off duty - Before shift start"
        })
        # 30 minutes of pre-trip inspection
        eld_logs_by_day[daily_log_key].append({
            "status": STATUS_ON_DUTY,
            "start_time": shift_start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "end_time": (shift_start_time + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S"),
            "duration": 0.5,
            "location": truck_location,  # Use truck's physical location
            "miles": 0,
            "notes": "Pre-trip /TIV"
        })
    

    current_time = shift_start_time + timedelta(minutes=30)
    
    weekly_drive_hours = float(trip.get('accumulated_weekly_hours', 0))
    daily_drive_hours = 0.0
    daily_on_duty_hours = 0.0
    drive_hours_since_break = 0.0
    
    # Define trip segments more precisely
    pickup_location = {
        "lat": trip['pickup_latitude'],
        "lon": trip['pickup_longitude'],
        "name": trip.get('pickup_location', f"Pickup at {trip['pickup_latitude']:.4f}, {trip['pickup_longitude']:.4f}")
    }
    
    dropoff_location = {
        "lat": trip['dropoff_latitude'],
        "lon": trip['dropoff_longitude'],
        "name": trip.get('dropoff_location', f"Dropoff at {trip['dropoff_latitude']:.4f}, {trip['dropoff_longitude']:.4f}")
    }
    
    segments = [
        {
            "name": "Drive to Pickup",
            "start": truck_location,  # Start from truck's current location, not segment start
            "end": pickup_location,
            "type": "drive_to_pickup"
        },
        {
            "name": "Pickup Activity",
            "start": pickup_location,
            "end": pickup_location,
            "type": "pickup"
        },
        {
            "name": "Drive to Dropoff",
            "start": pickup_location,
            "end": dropoff_location,
            "type": "drive_to_dropoff"
        },
        {
            "name": "Dropoff Activity",
            "start": dropoff_location,
            "end": dropoff_location,
            "type": "dropoff"
        }
    ]
    
    total_miles = 0.0
    miles_since_fuel = 0.0
    current_day = shift_start_time.date()
    day_count = 1
    destination_reached = False
    
    current_status = None
    current_status_start = None
    current_status_miles = 0.0
    current_status_location = None
    current_activity_type = None
    current_status_notes = []
    
    def add_log_entry(status, start_time, end_time, location, miles, note):
        # If location is null, use the last known location
        if location is None and len(eld_logs_by_day) > 0:
            # Try to find the most recent log entry with a valid location
            for day_key in sorted(eld_logs_by_day.keys(), reverse=True):
                for log in reversed(eld_logs_by_day[day_key]):
                    if log["location"] is not None:
                        location = log["location"]
                        break
                if location is not None:
                    break
        
        # If still null, use truck's current location
        if location is None:
            location = truck_location
        
        duration = (end_time - start_time).total_seconds() / 3600
        day_key = start_time.strftime("%Y-%m-%d")
        end_day_key = end_time.strftime("%Y-%m-%d")
        # for edge case here it is not possible for a log to reach the next day on max duty hours around 14 hours and day starts at 6:30
        if day_key != end_day_key:
            midnight = start_time.replace(hour=23, minute=59, second=59)
            next_day = (midnight + timedelta(seconds=1)).replace(hour=0, minute=0, second=0)
            
            duration_first_day = (midnight - start_time).total_seconds() / 3600
            
            if day_key not in eld_logs_by_day:
                eld_logs_by_day[day_key] = []
            
            eld_logs_by_day[day_key].append({
                "status": status,
                "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "end_time": midnight.strftime("%Y-%m-%dT%H:%M:%S"),
                "duration": duration_first_day,
                "location": location,
                "miles": miles * (duration_first_day / duration) if duration > 0 else 0,
                "notes": note
            })
            
            if end_day_key not in eld_logs_by_day:
                eld_logs_by_day[end_day_key] = []
            
            eld_logs_by_day[end_day_key].append({
                "status": status,
                "start_time": next_day.strftime("%Y-%m-%dT%H:%M:%S"),
                "end_time": end_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "duration": duration - duration_first_day,
                "location": location,
                "miles": miles * ((duration - duration_first_day) / duration) if duration > 0 else 0,
                "notes": note + " (continued from previous day)"
            })
        else:
            if day_key not in eld_logs_by_day:
                eld_logs_by_day[day_key] = []
                
            eld_logs_by_day[day_key].append({
                "status": status,
                "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "end_time": end_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "duration": duration,
                "location": location,
                "miles": miles,
                "notes": note
            })
    
    def flush_current_status():
        nonlocal current_status, current_status_start, current_status_miles, current_status_location, current_status_notes, current_activity_type
        
        if current_status is not None:
            note = current_status_notes[0] if current_status_notes else "Unknown activity" 
            add_log_entry(
                current_status, 
                current_status_start, 
                current_time, 
                current_status_location, 
                current_status_miles, 
                note,
            )
            
            current_status = None
            current_status_start = None
            current_status_miles = 0.0
            current_status_location = None
            current_status_notes = []
            current_activity_type = None
    
    def handle_day_change(current_time):
        nonlocal daily_drive_hours, daily_on_duty_hours, current_day, day_count
        
        flush_current_status()
        
        standard_start_time = current_time.replace(hour=6, minute=30, second=0) + timedelta(days=1)
        # Add sleep period
        rest_status = STATUS_SLEEPER if not destination_reached else STATUS_OFF_DUTY
        rest_note = "Post-trip TIV/Overnight rest"
        
        # Use the location at the end of the day (truck's current location)
        add_log_entry(
            rest_status,
            current_time,
            standard_start_time,
            truck_location,  # Use truck's current location
            0,
            rest_note
        )
        # 30 minutes of pre-trip inspection
        add_log_entry(
            STATUS_ON_DUTY,
            standard_start_time,
            standard_start_time + timedelta(minutes=30),
            truck_location,  # Use truck's current location
            0,
            "Pre-trip /TIV"
        )
        
        daily_drive_hours = 0
        daily_on_duty_hours = 0
        current_day = standard_start_time.date()
        day_count += 1
        
        return standard_start_time + timedelta(minutes=30)
    
    
    
    # Process each segment
    for segment in segments:
        # We don't update truck_location here - it will only be updated when actual driving occurs
        
        if segment['type'] in ['drive_to_pickup', 'drive_to_dropoff']:
            activity_type = segment['type']
            primary_note = segment['name']
            
            try:
                route = get_route(
                    truck_location['lat'], truck_location['lon'],  # Start from truck's current location
                    segment['end']['lat'], segment['end']['lon']
                )
            except ValueError as e:
                flush_current_status()
                add_log_entry(
                    STATUS_ON_DUTY,
                    current_time,
                    current_time + timedelta(minutes=5),
                    truck_location,  # Use truck's current location
                    0,
                    f"Error fetching route: {str(e)}"
                )
                current_time += timedelta(minutes=5)
                daily_on_duty_hours += 0.083
                continue
            
            # If no steps are returned, create one step for the entire route
            if not route['steps'] or len(route['steps']) == 0:
                route['steps'] = [{
                    'distance': route['total_distance'],
                    'duration': route['total_duration'],
                    'name': 'Direct Route',
                    'start_location': {
                        'lat': truck_location['lat'],  # Use truck's current location
                        'lon': truck_location['lon']
                    },
                    'end_location': {
                        'lat': segment['end']['lat'],
                        'lon': segment['end']['lon']
                    }
                }]

            for step_index, step in enumerate(route['steps']):
                step_duration = step['duration']
                step_distance = step['distance']
                
                # Skip steps with negligible duration or distance
                if step_duration < 0.01 or step_distance < 0.1:
                    continue
                
                # Current location for the driving log is the truck's current location
                current_location = truck_location
                
                # Check if day change will happen
                step_end_time = current_time + timedelta(hours=step_duration)
                if step_end_time.date() > current_day:
                    current_time = handle_day_change(current_time)
                    continue
                
                # Calculate remaining time for each limit
                remaining_until_break = MAX_DRIVE_HOURS_BEFORE_BREAK - drive_hours_since_break
                remaining_until_daily_limit = MAX_DRIVE_HOURS_PER_DAY - daily_drive_hours
                remaining_until_weekly_limit = MAX_WEEKLY_HOURS - weekly_drive_hours
                
                # Calculate distance to fuel stop
                miles_to_fuel = FUEL_STOP_DISTANCE - miles_since_fuel
                hours_to_fuel = (miles_to_fuel / step_distance) * step_duration if step_distance > 0 else float('inf')
                
                # Determine which limit will be hit first
                limit_types = {
                    "break": remaining_until_break if remaining_until_break > 0 else float('inf'),
                    "daily": remaining_until_daily_limit if remaining_until_daily_limit > 0 else float('inf'),
                    "weekly": remaining_until_weekly_limit if remaining_until_weekly_limit > 0 else float('inf'),
                    "fuel": hours_to_fuel if hours_to_fuel > 0 else float('inf')
                }
                
                # Find the minimum positive remaining time
                next_limit = min(limit_types.items(), key=lambda x: x[1])
                limit_type, remaining_time = next_limit
                
                # If any limit would be hit during this step
                if remaining_time < step_duration:
                    # Calculate distance that can be covered in the remaining time
                    remaining_distance = (remaining_time / step_duration) * step_distance if step_duration > 0 else 0
                    
                    # Finish current driving up to limit point
                    if current_status == STATUS_DRIVING:
                        current_status_miles += remaining_distance
                    else:
                        flush_current_status()
                        current_status = STATUS_DRIVING
                        current_status_start = current_time
                        current_status_miles = remaining_distance
                        current_status_location = truck_location
                        current_status_notes = [primary_note]
                        current_activity_type = activity_type
                    
                    total_miles += remaining_distance
                    miles_since_fuel += remaining_distance
                    daily_drive_hours += remaining_time
                    daily_on_duty_hours += remaining_time
                    weekly_drive_hours += remaining_time
                    drive_hours_since_break += remaining_time
                    current_time += timedelta(hours=remaining_time)
                    
                    # Update truck location to where limit is hit
                    progress = remaining_time / step_duration if step_duration > 0 else 0
                    limit_lat = step['start_location']['lat'] + progress * (step['end_location']['lat'] - step['start_location']['lat'])
                    limit_lon = step['start_location']['lon'] + progress * (step['end_location']['lon'] - step['start_location']['lon'])
                    limit_location = get_location_details(limit_lat, limit_lon)
                    truck_location = limit_location  # Update truck_location to new physical location
                    
                    # Handle the specific limit that was hit
                    flush_current_status()
                    
                    if limit_type == "break":
                        # Add required break
                        add_log_entry(
                            STATUS_OFF_DUTY,
                            current_time,
                            current_time + timedelta(minutes=30),
                            truck_location,  # Use truck's current location
                            0,
                            "30-min break"
                        )
                        current_time += timedelta(minutes=30)
                        daily_on_duty_hours += 0.5
                        drive_hours_since_break = 0
                        
                    elif limit_type == "fuel":
                        # Add fuel stop
                        add_log_entry(
                            STATUS_ON_DUTY,
                            current_time,
                            current_time + timedelta(minutes=30),
                            truck_location,  # Use truck's current location
                            0,
                            "Fuel stop"
                        )
                        current_time += timedelta(minutes=30)
                        daily_on_duty_hours += 0.5
                        miles_since_fuel = 0
                        
                    elif limit_type == "daily":
                        # End the day
                        current_time = handle_day_change(current_time)
                        continue
                        
                    elif limit_type == "weekly":
                        # Add 34-hour restart
                        add_log_entry(
                            STATUS_OFF_DUTY,
                            current_time,
                            current_time + timedelta(hours=34),
                            truck_location,  # Use truck's current location
                            0,
                            "34-hr restart period"
                        )
                        current_time += timedelta(hours=34)
                        weekly_drive_hours = 0
                        daily_drive_hours = 0
                        daily_on_duty_hours = 0
                        drive_hours_since_break = 0
                        current_day = current_time.date()
                        day_count += 1
                    
                    # Skip the rest of this step since we've used all available time
                    continue
                
                # Normal driving for this step (no limits hit)
                if step_duration > 0:
                    if current_status == STATUS_DRIVING and current_activity_type == activity_type:
                        # Continue current driving session
                        current_status_miles += step_distance
                    else:
                        # Start a new driving session
                        flush_current_status()
                        current_status = STATUS_DRIVING
                        current_status_start = current_time
                        current_status_miles = step_distance
                        current_status_location = truck_location  # Use truck's current location
                        current_status_notes = [primary_note]
                        current_activity_type = activity_type
                    
                    total_miles += step_distance
                    miles_since_fuel += step_distance
                    daily_drive_hours += step_duration
                    daily_on_duty_hours += step_duration
                    weekly_drive_hours += step_duration
                    drive_hours_since_break += step_duration
                    current_time += timedelta(hours=step_duration)
                    
                    # Update truck location to the end of this step
                    truck_location = get_location_details(
                        step['end_location']['lat'],
                        step['end_location']['lon']
                    )
            
            # After all steps, update truck_location to segment end
            truck_location = {
                "lat": segment['end']['lat'],
                "lon": segment['end']['lon'],
                "name": segment['end'].get('name', f"Location at {segment['end']['lat']:.4f}, {segment['end']['lon']:.4f}")
            }
            
        elif segment['type'] in ['pickup', 'dropoff']:
            # For stationary activities, use the truck's current location (it should already be at pickup/dropoff)
            
            # Add pickup/dropoff activity
            flush_current_status()
            
            add_log_entry(
                STATUS_ON_DUTY,
                current_time,
                current_time + timedelta(minutes=PICKUP_DROPOFF_TIME),
                truck_location,  # Use truck's current location
                0,
                segment['name']
            )
            
            current_time += timedelta(minutes=PICKUP_DROPOFF_TIME)
            daily_on_duty_hours += PICKUP_DROPOFF_TIME / 60
            
            if segment['type'] == 'dropoff':
                destination_reached = True
    
    # Add any remaining activity
    flush_current_status()
    
    # Add off-duty period after destination is reached
    if destination_reached:
        midnight = current_time.replace(hour=23, minute=59, second=59)
        
        add_log_entry(
            STATUS_OFF_DUTY,
            current_time,
            midnight,
            truck_location,  # Use truck's current location
            0,
            "Post-trip TIV-5mins/Off duty"
        )
    
    # Generate summary
    summary_by_day = {}
    for day_key, logs in eld_logs_by_day.items():
        summary_by_day[day_key] = {
            "date": day_key,
            "drive_hours": round(sum(log['duration'] for log in logs if log['status'] == STATUS_DRIVING), 2),
            "on_duty_hours": round(sum(log['duration'] for log in logs if log['status'] in [STATUS_DRIVING, STATUS_ON_DUTY]), 2),
            "miles": round(sum(log['miles'] for log in logs), 2),
            "logs": logs
        }
    
    return {
        "trip_id": trip.get('id', 'unknown'),
        "start_time": shift_start_time.strftime("%Y-%m-%dT%H:%M:%S"),
        "end_time": current_time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total_miles": round(total_miles, 2),
        "total_drive_hours": round(sum(day_data["drive_hours"] for day_data in summary_by_day.values()), 2),
        "total_on_duty_hours": round(sum(day_data["on_duty_hours"] for day_data in summary_by_day.values()), 2),
        "total_days": day_count,
        "daily_summaries": list(summary_by_day.values())
    }

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trip_details(request, trip_id):
    try:
        # Retrieve the trip instance from the database
        trip = Trip.objects.get(id=trip_id)
        if trip.user.id != request.user.id:
            return JsonResponse({"error": "Unauthorized access"}, status=403)
        
        # Convert trip model to dictionary for processing
        trip_data = {
            "id": trip.id,
            "current_latitude": float(trip.current_latitude),
            "current_longitude": float(trip.current_longitude),
            "current_location": trip.current_location,
            "pickup_latitude": float(trip.pickup_latitude),
            "pickup_longitude": float(trip.pickup_longitude),
            "pickup_location": trip.pickup_location,
            "dropoff_latitude": float(trip.dropoff_latitude),
            "dropoff_longitude": float(trip.dropoff_longitude),
            "dropoff_location": trip.dropoff_location,
            "start_time": "06:30:00",  # Default start time
            "accumulated_weekly_hours": float(trip.current_cycle_used)
        }
        
        # Handle start_time attribute if it exists
        if hasattr(trip, 'start_time'):
            if isinstance(trip.start_time, datetime):
                trip_data["start_time"] = trip.start_time.strftime("%H:%M:%S")
            elif isinstance(trip.start_time, str):
                trip_data["start_time"] = trip.start_time
                
        # Handle accumulated weekly hours if it exists
        if hasattr(trip, 'accumulated_weekly_hours'):
            trip_data["accumulated_weekly_hours"] = float(trip.accumulated_weekly_hours)
        
        # Calculate ELD logs - with consolidated entries
        eld_data = calculate_eld_logs(trip_data)
        
        # Configure response for high-resolution output
        response = JsonResponse(eld_data)
        return response
    
    except Trip.DoesNotExist:
        return JsonResponse({"error": "Trip not found"}, status=404)
    except Exception as e:
        # Include more detailed error information
        import traceback
        return JsonResponse({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=500)
        

@api_view(['GET'])
@permission_classes([IsAuthenticated])        
def reverse_coordinates(request):
    if request.user.is_anonymous:
        return JsonResponse({"error": "Authentication required."}, status=403)
    lat = request.GET.get('lat')
    lon = request.GET.get('lon')
    api_key =settings.GEOCODE_API_KEY

    if not lat or not lon:
        return JsonResponse({"error": "Latitude and longitude are required."}, status=400)

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return JsonResponse({"error": "Invalid latitude or longitude values."}, status=400)

    url = f"https://geocode.maps.co/reverse?lat={lat}&lon={lon}&api_key={api_key}"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        location_name = "Unknown location"
        if data and "address" in data:
            address = data.get("address", {})
            location_name = (
                address.get("city") or
                address.get("village") or
                address.get("town") or
                address.get("hamlet") or
                address.get("suburb") or
                address.get("neighbourhood") or
                address.get("county") or
                f"Location at {lat:.4f}, {lon:.4f}"
            )

        result = {
            "name": location_name,
            "lat": lat,
            "lon": lon,
            "address": data.get("address", {}),
            "importance": data.get("importance"),
            "osm_type": data.get("osm_type"),
            "osm_id": data.get("osm_id")
        }
        return JsonResponse(result)

    except requests.exceptions.RequestException as e:
        # return JsonResponse({"error": f"API request failed: {e}"}, status=500)
        try:
            url=f'https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1'
            response = requests.get(url)
            data = response.json()
            print(data)
            location_name = "Unknown location"
            if data and "address" in data:
                address = data.get("address", {})
                location_name = (
                    address.get("city") or
                    address.get("village") or
                    address.get("town") or
                    address.get("hamlet") or
                    address.get("suburb") or
                    address.get("neighbourhood") or
                    address.get("county") or
                    f"Location at {lat:.4f}, {lon:.4f}"
                )
        except Exception as e:
            return JsonResponse({"error": f"API request failed: {e}"}, status=500)
    
            
            
    except ValueError:
        return JsonResponse({"error": "Invalid JSON response from API."}, status=500)