from django.urls import path, include
from . import views

urlpatterns = [
    path('trips/', views.TripViewSet.as_view({'get': 'list', 'post': 'create'}), name='trip-list'),
    path('trips/<int:pk>/', views.TripViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='trip-detail'),
    path('trip-details/<int:trip_id>/', views.trip_details, name='trip-details'),
    path('reverse-geocode/', views.reverse_coordinates, name='reverse-geocode'),
]
