# Location Features Added ✅

## What Was Added

Full location tracking integration with distance calculation, nearby filtering, and visual indicators.

### Features:

1. **Location Permission Request**
   - Automatically requests on app launch
   - Handles permission denied gracefully
   - Shows helpful banner when denied

2. **Location Tracking**
   - Gets current location on mount
   - Auto-refreshes every 5 minutes
   - Refreshes on pull-to-refresh

3. **Backend Integration**
   - Sends `?lat=&lng=&radius=50` to all restaurant endpoints
   - Backend calculates distances
   - Backend sorts by distance

4. **Nearby Toggle**
   - "Show All" vs "Nearby Only" (within 5 miles)
   - Only appears when location is available
   - Haptic feedback on tap
   - Defaults to "Nearby Only" when location is enabled

5. **Distance Display**
   - Shows distance in miles next to restaurant name
   - Format: "0.3 mi", "1.5 mi", etc.
   - Falls back to "City, State" if no distance available

6. **Nearby Badge**
   - Green "Nearby" badge for restaurants < 1 mile
   - Only shows when distance is available
   - Prominent visual indicator

7. **Dynamic Subtitle**
   - With location: "What's nearby?"
   - Without location: "Find a restaurant near you"

8. **Location Permission Banner**
   - Yellow banner when permission denied
   - "Enable location to see nearby restaurants"
   - "Settings" button opens device settings

## How It Works

### State Management:
```typescript
const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
const [showNearbyOnly, setShowNearbyOnly] = useState(false);
```

### Permission Request (on mount):
```typescript
useEffect(() => {
  async function setupLocation() {
    const hasPermission = await requestLocationPermission();
    if (hasPermission) {
      const location = await getCurrentLocation();
      if (location) {
        setUserLocation(location);
        setShowNearbyOnly(true); // Default to nearby
      }
    } else {
      setLocationPermissionDenied(true);
    }
  }
  setupLocation();

  // Refresh every 5 minutes
  const interval = setInterval(async () => {
    const location = await getCurrentLocation();
    if (location) setUserLocation(location);
  }, 5 * 60 * 1000);

  return () => clearInterval(interval);
}, []);
```

### API Integration:
```typescript
// Fetch with location
let url = `${API_BASE_URL}/restaurants`;
if (userLocation) {
  url += `?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius=50`;
}
const res = await fetch(url);
```

### Nearby Filter:
```typescript
// Filter restaurants within 5 miles
if (showNearbyOnly && userLocation) {
  result = result.filter((r) =>
    r.distance_miles !== undefined && r.distance_miles <= 5
  );
}
```

## UI Design

### Nearby Toggle:
```
[Show All] [Nearby Only]  ← 2 buttons, one active (red)
```

### Restaurant Card:
```
[Restaurant Name] [Nearby]  ← Green badge if < 1 mile
Italian • 0.3 mi            ← Distance in gray
20 min wait • 5 mins ago
[Request Wait Time]
```

### Location Banner (when denied):
```
⚠️ Enable location to see nearby restaurants [Settings]
```

## Backend Response Format

The backend now returns:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Restaurant",
      "cuisine": "Italian",
      "wait_minutes": 20,
      "latitude": 37.7749,
      "longitude": -122.4194,
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "distance_miles": 0.3,  // ← Calculated by backend
      ...
    }
  ]
}
```

## How to Test

### 1. Grant Location Permission
```bash
npm start
# Should see:
# - "What's nearby?" subtitle
# - Nearby toggle: [Show All] [Nearby Only]
# - Distances on restaurant cards
# - "Nearby" badges for restaurants < 1 mile
```

### 2. Deny Location Permission
- Decline when prompted
- Should see yellow banner: "Enable location..."
- Tap "Settings" → Opens device settings
- No distance information shown
- Falls back to "City, State" if available

### 3. Nearby Toggle
- Tap "Show All" → Shows all restaurants
- Tap "Nearby Only" → Shows only restaurants within 5 miles
- Feel haptic feedback on each tap

### 4. Distance Display
- Restaurants should show distance: "0.3 mi", "1.5 mi", etc.
- Restaurants < 1 mile show green "Nearby" badge
- Restaurants without distance show "City, State"

### 5. Pull-to-Refresh
- Pull down → Refreshes location AND restaurants
- Distance values update
- Restaurant order may change (sorted by distance)

### 6. Location Updates
- Wait 5 minutes → Location auto-refreshes
- Restaurants re-fetch with new location
- Distance values update

## Expected Behavior

### With Location Permission:
1. App requests permission → User grants
2. Gets current location
3. Fetches restaurants with `?lat=&lng=&radius=50`
4. Backend returns restaurants sorted by distance
5. UI shows distances and "Nearby" badges
6. "Nearby Only" filter is active by default
7. Shows restaurants within 5 miles

### Without Location Permission:
1. App requests permission → User denies
2. Shows yellow banner
3. Fetches restaurants without location params
4. Backend returns all restaurants (not sorted by distance)
5. No distance information shown
6. Falls back to "City, State" if available
7. No nearby toggle shown

### Pull-to-Refresh:
1. User pulls down
2. Gets fresh location
3. Fetches restaurants with updated location
4. Distances recalculate
5. List updates

## Files Modified

### App:
- `app/(tabs)/index.tsx`
  - Added location state
  - Added location permission request
  - Added location refresh (5 min interval)
  - Added location params to API calls
  - Added nearby filter logic
  - Added location banner UI
  - Added nearby toggle UI
  - Updated subtitle dynamically
  - Updated empty states

### Components:
- `components/RestaurantCard.tsx` (already had location features)
  - Distance display
  - Nearby badge
  - City/State fallback

### Utils:
- `utils/location.ts` (already created)
  - Permission request
  - Get current location
  - Settings opener

- `utils/types.ts` (already updated)
  - Location fields in Restaurant type

## Dependencies

Already installed:
- `expo-location` - Location tracking
- `expo-haptics` - Haptic feedback

## Next Steps

All core features are now complete! The only remaining feature is:

**Push Notifications** (Requires physical device + backend support)
- Device registration
- Push token management
- Notification handling when wait time is ready

Would you like to add push notifications next, or is the app ready for testing/deployment?
