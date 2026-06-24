from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import requests
from geopy.geocoders import Nominatim
from datetime import datetime

app = FastAPI()

print("🧠 Loading Linear Regression ML Model...")
model = joblib.load('pricing_model.pkl')
geolocator = Nominatim(user_agent="yash_cargo_app_testing_v1")
print("✅ AI Brain, GPS, & Weather Systems Online!")

class RideRequest(BaseModel):
    pickup: str
    dropoff: str

# ==========================================
# 1. NAVIGATION ENGINE
# ==========================================
def get_route_data(pickup: str, dropoff: str):
    try:
        loc1 = geolocator.geocode(pickup)
        loc2 = geolocator.geocode(dropoff)

        if not loc1 or not loc2:
            return None

        url = f"http://router.project-osrm.org/route/v1/driving/{loc1.longitude},{loc1.latitude};{loc2.longitude},{loc2.latitude}?overview=false"
        response = requests.get(url).json()

        distance_meters = response['routes'][0]['distance']
        real_distance_km = round(distance_meters / 1000, 2)
        
        # Return distance AND GPS coordinates for the weather radar
        return real_distance_km, loc1.latitude, loc1.longitude
    except Exception as e:
        print(f"⚠️ Navigation API Error: {e}")
        return None

# ==========================================
# 2. LIVE WEATHER RADAR
# ==========================================
# Update this specific function in main.py
def get_live_weather(lat, lon):
    try:
        # We add 'hourly=precipitation' to get the absolute latest moisture levels
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=precipitation&hourly=precipitation"
        response = requests.get(url).json()
        
        # This fetches the actual precipitation in millimeters for the current hour
        current_precipitation = response['current']['precipitation']
        
        # If precipitation is > 0, it is actively raining in real-time
        if current_precipitation > 0:
            print(f"🌧️ REAL-TIME WEATHER: {current_precipitation}mm rain detected!")
            return 1 
        else:
            print(f"☀️ REAL-TIME WEATHER: Clear skies.")
            return 0
            
    except Exception as e:
        print(f"⚠️ Weather API Error: {e}")
        return 0

# ==========================================
# 3. CORE AI PRICING ROUTE
# ==========================================
@app.post("/calculate-price")
def calculate_dynamic_price(ride: RideRequest):
    print(f"\n🌍 Connecting to Satellites for route: {ride.pickup} to {ride.dropoff}...")
    
    route_data = get_route_data(ride.pickup, ride.dropoff)
    
    if route_data:
        real_distance, pickup_lat, pickup_lon = route_data
        is_raining = get_live_weather(pickup_lat, pickup_lon)
    else:
        print("❌ Location not found. Using safe estimates.")
        real_distance = 15.0 
        is_raining = 0

    current_hour = datetime.now().hour
    is_rush_hour = 1 if current_hour in [8, 9, 10, 17, 18, 19, 20] else 0
    
    features = pd.DataFrame([{
        'distance_km': real_distance,
        'hour_of_day': current_hour,
        'is_rush_hour': is_rush_hour,
        'is_raining': is_raining
    }])
    
    predicted_price = model.predict(features)[0]
    
    print(f"📍 Distance: {real_distance} km | ⏰ Hour: {current_hour} | 🌧️ Rain: {bool(is_raining)}")
    print(f"💰 AI Predicted Fare: ₹{predicted_price:.2f}")

    # FIXED: Keys now perfectly match the Node.js backend expectation!
    return {
        "distance": real_distance, 
        "price": round(predicted_price, 2), 
        "is_rush_hour": bool(is_rush_hour),
        "is_raining": bool(is_raining),
        "currency": "INR"
    }