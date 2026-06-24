import requests

# GPS Coordinates for Partur, Maharashtra
lat = 19.5931
lon = 76.2132

print(f"📡 Connecting to Open-Meteo Satellite for Coordinates: {lat}, {lon}...")
url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"

try:
    # Attempt to ping the satellite
    response = requests.get(url)
    print(f"🛰️ API Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ Raw Satellite Data Received:")
        print(data['current_weather'])
        
        weather_code = data['current_weather']['weathercode']
        print(f"\n🎯 Extracted Weather Code: {weather_code}")
        
        if weather_code >= 50:
            print("🌧️ Conclusion: It is RAINING.")
        else:
            print("☀️ Conclusion: It is CLEAR.")
            
    else:
        print(f"\n❌ Satellite rejected the request. Error details:")
        print(response.text)

except Exception as e:
    print(f"\n❌ Massive System/Network Error:")
    print(e)