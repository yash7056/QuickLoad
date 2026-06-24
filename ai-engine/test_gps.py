from geopy.geocoders import Nominatim
import requests

# We use a more unique user-agent to avoid being blocked by free APIs
geolocator = Nominatim(user_agent="yash_cargo_app_testing_v1") 

pickup = "Pune"
dropoff = "Mumbai"

print(f"🔍 Searching GPS for: {pickup}...")
loc1 = geolocator.geocode(pickup)
if loc1:
    print(f"✅ Found {pickup}: {loc1.latitude}, {loc1.longitude}")
else:
    print(f"❌ Failed to find {pickup}")

print(f"\n🔍 Searching GPS for: {dropoff}...")
loc2 = geolocator.geocode(dropoff)
if loc2:
    print(f"✅ Found {dropoff}: {loc2.latitude}, {loc2.longitude}")
else:
    print(f"❌ Failed to find {dropoff}")

if loc1 and loc2:
    print("\n🛰️ Connecting to OSRM Satellites...")
    url = f"http://router.project-osrm.org/route/v1/driving/{loc1.longitude},{loc1.latitude};{loc2.longitude},{loc2.latitude}?overview=false"
    
    try:
        response = requests.get(url)
        print(f"📡 API Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            distance_km = data['routes'][0]['distance'] / 1000
            print(f"🎉 SUCCESS! Exact Driving Distance: {round(distance_km, 2)} km")
        else:
            print(f"❌ OSRM Error: {response.text}")
    except Exception as e:
        print(f"❌ Network Error connecting to OSRM: {e}")