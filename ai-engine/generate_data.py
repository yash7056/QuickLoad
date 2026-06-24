import pandas as pd
import numpy as np
import random

print("🧬 Generating expanded historical ride data...")

np.random.seed(42)
num_rides = 10000 # Increased to 10,000 for better learning

# NEW: Train the AI on distances from 2 km all the way to 500 km!
distances = np.random.uniform(2.0, 500.0, num_rides)

hours = np.random.randint(0, 24, num_rides)
is_rush_hour = np.isin(hours, [8, 9, 10, 17, 18, 19, 20]).astype(int)
is_raining = np.random.choice([0, 1], p=[0.8, 0.2], size=num_rides)

# Base math for the historical data
base_fare = 150
per_km_rate = 18 # Lowered slightly for long-distance realism

prices = base_fare + (distances * per_km_rate)
prices = prices * (1 + (is_rush_hour * 0.3)) 
prices = prices * (1 + (is_raining * 0.2))   

# Add noise so the AI has to actually think
noise = np.random.normal(0, 100, num_rides)
prices = np.maximum(prices + noise, base_fare) 

df = pd.DataFrame({
    'distance_km': np.round(distances, 2),
    'hour_of_day': hours,
    'is_rush_hour': is_rush_hour,
    'is_raining': is_raining,
    'final_price': np.round(prices, 2)
})

df.to_csv('historical_rides.csv', index=False)
print("✅ Generated 'historical_rides.csv' with 10,000 long-distance records!")