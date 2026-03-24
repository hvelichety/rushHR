# RushHR - Simplified & Fixed

## What Was Broken

1. **AsyncStorage errors** - Push notifications code was trying to access device storage
2. **Location query failures** - Backend doesn't support location params yet, causing 500 errors
3. **Complex filters** - Too many features added at once made debugging hard
4. **"No restaurants found"** - State updates weren't working due to errors

## What Was Fixed

### 1. Disabled Push Notifications (Temporarily)
- Commented out all push notification code
- Removed AsyncStorage imports
- Removed device ID and push token state
- No more AsyncStorage errors

### 2. Removed Location Features (Temporarily)
- Commented out location permission requests
- Removed location state
- Removed location-based API queries
- Backend doesn't need to support `?lat=&lng=` params

### 3. Simplified Fetch Logic
```typescript
// Before: Complex with location params and fallbacks
let url = `${API_BASE_URL}/restaurants`;
if (userLocation) {
  url += `?lat=...&lng=...&radius=50`;
}

// After: Simple basic fetch
const res = await fetch(`${API_BASE_URL}/restaurants`);
```

### 4. Removed All Filters
- No cuisine filter
- No price level filter
- No nearby/distance filter
- Only basic name/cuisine search

### 5. Simplified UI
- Removed location banner
- Removed filter chips
- Removed "Nearby Only" toggle
- Removed loading/empty state complexity
- Added debug text showing restaurant count

### 6. Simplified Request Handler
- No haptic feedback
- No toast notifications
- No loading state per restaurant
- No device_id or push_token in request body
- Back to basic `requestWaitTime()` function

## What Still Works

✅ **Fetch restaurants from backend**
✅ **Display restaurant list**
✅ **Search by name or cuisine**
✅ **Request wait time button**
✅ **Cooldown system**
✅ **SSE live updates**
✅ **Request modal with recommendations**
✅ **Periodic refresh (every 5 minutes)**

## How to Test

1. **Start your backend:**
   ```bash
   cd ../backend
   python app.py
   # Should run on http://localhost:5000
   ```

2. **Test the backend:**
   ```bash
   curl http://localhost:5000/restaurants
   # Should return JSON array of restaurants
   ```

3. **Start the app:**
   ```bash
   npm start
   ```

4. **Check the console:**
   - Should see: `✅ API configured: http://localhost:5000`
   - Should see: `📡 Fetching restaurant list from...`
   - Should see: `✅ Fetched restaurants: X items`
   - Should see: `✅ Setting restaurants state with X items`

5. **Check the UI:**
   - Should see debug text: "DEBUG: Restaurants loaded: X | Filtered: X"
   - Should see restaurant cards displayed
   - Should NOT see "No restaurants found"

## Expected Console Output

```
✅ API configured: http://localhost:5000
   Environment: Development
   Platform: ios (Simulator)
📡 Connecting to live stream...
📡 Fetching restaurant list from: http://localhost:5000/restaurants
✅ Fetched restaurants: 3 items
✅ Setting restaurants state with 3 items
🔁 Refreshing restaurant data...
```

## Debug Info

The app now shows a green debug banner at the top:
```
DEBUG: Restaurants loaded: 3 | Filtered: 3
```

This tells you:
- **Restaurants loaded** = Total from backend
- **Filtered** = After search filter

If you see `0 | 0`, the fetch failed.
If you see `3 | 0`, the search filter is hiding everything.

## Next Steps (After Basic Functionality Works)

Once you confirm restaurants are loading:

1. **Re-enable Push Notifications**
   - Uncomment notification code
   - Test on physical device (won't work in simulator)
   - Make sure backend has `/register-push-token` endpoint

2. **Re-enable Location**
   - Uncomment location code
   - Update backend to handle `?lat=&lng=&radius=` params
   - Test location permissions

3. **Re-add Filters**
   - Uncomment filter UI
   - Test cuisine/price filters

4. **Add Back UX Polish**
   - Uncomment Toast notifications
   - Uncomment Haptics
   - Re-add loading states

## Files Modified

- `app/(tabs)/index.tsx` - Simplified to bare minimum
- Created `SIMPLIFIED.md` - This file

## Quick Rollback

If you need the full version back, check git:
```bash
git diff app/(tabs)/index.tsx
git checkout app/(tabs)/index.tsx  # Restore original
```
