from rest_framework import serializers
from api.models import CustomUser
from .models import CustomUser, Trip

# Serializer for User registration
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'password', 'home_address', 'office_address', 'fullname', 'carrier']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)
        return user

class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            'id', 
            'current_location', 'current_latitude', 'current_longitude',
            'pickup_location', 'pickup_latitude', 'pickup_longitude',
            'dropoff_location', 'dropoff_latitude', 'dropoff_longitude',
            'current_cycle_used', 
            'created_at', 'updated_at', 'user'
        ]