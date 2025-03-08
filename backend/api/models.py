from django.db import models
from django.contrib.auth.models import AbstractUser


class CustomUser(AbstractUser):
    home_address = models.CharField(max_length=255, blank=True, null=True)  # Address field
    office_address = models.CharField(max_length=255, blank=True, null=True)  # OfficeAddress field
    fullname = models.CharField(max_length=255, blank=True, null=True)  # Fullname field
    carrier = models.CharField(max_length=255, blank=True, null=True)  # Carrier field
    
    

    def __str__(self):
        return self.username


class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    current_latitude = models.FloatField(null=True, blank=True)
    current_longitude = models.FloatField(null=True, blank=True)

    pickup_location = models.CharField(max_length=255)
    pickup_latitude = models.FloatField(null=True, blank=True)
    pickup_longitude = models.FloatField(null=True, blank=True)

    dropoff_location = models.CharField(max_length=255)
    dropoff_latitude = models.FloatField(null=True, blank=True)
    dropoff_longitude = models.FloatField(null=True, blank=True)

    current_cycle_used = models.FloatField(help_text="Hours already used in the current driving cycle")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    user = models.ForeignKey('api.CustomUser', on_delete=models.CASCADE, default=1)

    def __str__(self):
        return f"Trip from {self.current_location} to {self.dropoff_location}"
