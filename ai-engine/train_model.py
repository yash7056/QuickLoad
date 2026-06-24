import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error
import joblib

print("📥 Loading historical data...")
df = pd.read_csv('historical_rides.csv')

# 1. Define Features and Target
X = df[['distance_km', 'hour_of_day', 'is_rush_hour', 'is_raining']]
y = df['final_price']

# 2. Split the data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 3. CRITICAL: Add the "Surge Weight" to the training logic
# We multiply the 'is_raining' feature by a factor of 2.0.
# This forces the Linear Regression model to place twice as much 
# mathematical importance on rain when calculating the final price.
X_train = X_train.copy()
X_train['is_raining'] = X_train['is_raining'] * 2.0

# 4. Train the Extrapolation Engine (Linear Regression)
print("⚙️ Training the AI model with high-weight weather sensitivity...")
model = LinearRegression()
model.fit(X_train, y_train)

# 5. Test the AI
print("🧪 Testing the model on hidden data...")
# Note: We must also apply the weight to the test data for consistent evaluation
X_test_weighted = X_test.copy()
X_test_weighted['is_raining'] = X_test_weighted['is_raining'] * 2.0

predictions = model.predict(X_test_weighted)
error = mean_absolute_error(y_test, predictions)

print(f"\n📊 AI Report Card:")
print(f"The model's price predictions are off by an average of just ₹{error:.2f}")

# 6. Save the new, highly-sensitive brain
joblib.dump(model, 'pricing_model.pkl')
print("✅ New 'Pricing Brain' saved successfully as 'pricing_model.pkl'")