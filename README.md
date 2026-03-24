# RushHR - Restaurant Wait Time App

Skip the wait! Get real-time restaurant wait times instantly.

## Features

### Core Functionality
- ✅ **Real-time Wait Times**: View current wait times for restaurants
- ✅ **Request Updates**: Trigger phone calls to restaurants to get fresh wait time data
- ✅ **Live Updates**: Server-Sent Events (SSE) for real-time wait time updates
- ✅ **Smart Cooldowns**: Prevents spam requests with intelligent cooldown timers
- ✅ **Search**: Debounced search by restaurant name or cuisine type
- ✅ **Push Notifications**: Get notified when wait times are ready (1-2 minutes)
- ✅ **Location Tracking**: Find nearby restaurants with distance calculations
- ✅ **Filters**: Filter by cuisine type, price level, and distance

### User Experience
- ✅ **Loading States**: Skeleton loaders and inline spinners throughout the app
- ✅ **Pull-to-Refresh**: Swipe down to refresh restaurant list and location
- ✅ **Empty States**: Context-aware messages (loading, no results, location disabled)
- ✅ **Error Handling**: User-friendly error messages with toast notifications
- ✅ **Haptic Feedback**: Tactile feedback on button presses and actions
- ✅ **Accessibility**: VoiceOver/TalkBack support with proper labels
- ✅ **Nearby Badge**: Visual indicator for restaurants within 1 mile
- ✅ **Distance Display**: Shows distance in miles for each restaurant
- ✅ **Smart Recommendations**: Get similar nearby restaurants when requesting wait times

### Developer Experience
- ✅ **TypeScript**: Full type safety
- ✅ **Environment Detection**: Auto-detects simulator vs device
- ✅ **Smart API Config**: Uses localhost for simulator, production URL for devices
- ✅ **Production Ready**: Optimized builds with conditional logging

## Tech Stack

- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: React Hooks
- **Real-time**: EventSource (SSE)
- **Toast Notifications**: react-native-toast-message
- **Push Notifications**: expo-notifications
- **Location**: expo-location
- **Storage**: @react-native-async-storage/async-storage
- **Haptics**: expo-haptics
- **Device Info**: expo-device

## Prerequisites

- Node.js 18+ and npm
- iOS Simulator (macOS) or Android Emulator
- Expo CLI: `npm install -g expo-cli`
- Optional: EAS CLI for builds: `npm install -g eas-cli`

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd restaurant-mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your API URL.

## Development

### Running on Simulator/Emulator

The app will automatically use `localhost:5001` for API calls:

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Web
npm run web
```

### Running on Physical Device

For physical device testing, you need to:

1. Set `EXPO_PUBLIC_API_URL` in your environment to your ngrok or network URL
2. OR update `utils/config.ts` with your backend URL
3. Run: `npm start` and scan QR code

### Backend Setup

Make sure your Flask backend is running:
```bash
cd ../backend
python app.py  # Should run on port 5001
```

## Environment Configuration

The app intelligently detects your environment:

| Environment | Device Type | API URL Used |
|------------|-------------|--------------|
| Development | iOS Simulator | `http://localhost:5001` |
| Development | Android Emulator | `http://10.0.2.2:5001` |
| Development | Physical Device | `EXPO_PUBLIC_API_URL` or production URL |
| Production | Any | Production URL from env |

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
EXPO_PUBLIC_API_URL=https://your-backend.com
```

## Building for Production

### Using EAS Build (Recommended)

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to Expo:
   ```bash
   eas login
   ```

3. Configure your project:
   ```bash
   eas build:configure
   ```

4. Build for iOS:
   ```bash
   eas build --platform ios --profile production
   ```

5. Build for Android:
   ```bash
   eas build --platform android --profile production
   ```

### Local Builds

For iOS (macOS only):
```bash
npm run ios --configuration Release
```

For Android:
```bash
npm run android --variant=release
```

## Project Structure

```
restaurant-mobile/
├── app/
│   └── (tabs)/
│       └── index.tsx          # Main home screen with filters & location
├── components/
│   ├── RestaurantCard.tsx     # Restaurant list item with distance
│   └── RequestModal.tsx       # Success modal with recommendations
├── utils/
│   ├── api.ts                 # API functions with location support
│   ├── config.ts              # Environment-aware configuration
│   ├── notifications.ts       # Push notification setup & handlers
│   ├── location.ts            # Location permission & tracking
│   ├── time.ts                # Time formatting utilities
│   ├── toast.ts               # Toast notification helpers
│   └── types.ts               # TypeScript type definitions
├── app.json                   # Expo configuration with permissions
├── eas.json                   # EAS Build configuration
├── package.json
└── tsconfig.json
```

## API Integration

### Backend Endpoints

The app expects these endpoints:

1. **GET /restaurants** (with optional location params)
   - Query params: `?lat=&lng=&radius=` (optional)
   - Returns array of restaurants with wait times and distances
   - Response format:
     ```json
     [{
       "id": 1,
       "name": "Restaurant Name",
       "cuisine": "Italian",
       "wait_minutes": 30,
       "last_updated_at": 1234567890,
       "last_called_at": "2024-01-01T12:00:00Z",
       "cooldown_minutes": 30,
       "is_closed": false,
       "open_hour": 11,
       "close_hour": 22,
       "image": "https://...",
       "phone": "+1234567890",
       "timezone": "America/New_York",
       "latitude": 40.7128,
       "longitude": -74.0060,
       "address": "123 Main St",
       "city": "New York",
       "state": "NY",
       "rating": 4.5,
       "price_level": 2,
       "distance_miles": 0.5
     }]
     ```

2. **POST /call**
   - Triggers Twilio call to restaurant and sends push notification
   - Request body:
     ```json
     {
       "restaurant_id": 1,
       "party_size": 2,
       "phone": "+1234567890",
       "device_id": "ios-1234567890-abc",
       "push_token": "ExponentPushToken[...]"
     }
     ```
   - Response includes recommendations:
     ```json
     {
       "success": true,
       "skipped": false,
       "recommendations": [...]
     }
     ```

3. **POST /register-push-token** (new)
   - Registers device for push notifications
   - Request body:
     ```json
     {
       "device_id": "ios-1234567890-abc",
       "push_token": "ExponentPushToken[...]"
     }
     ```

3. **GET /restaurants/:id**
   - Returns single restaurant data
   - Same format as array item above

4. **GET /stream** (Optional)
   - Server-Sent Events endpoint
   - Sends live updates for wait times

## Features in Detail

### Push Notifications

- Requests notification permission on first launch
- Generates unique device ID stored in AsyncStorage
- Registers push token with backend
- Receives notifications when wait times are ready (1-2 minutes)
- Tapping notification scrolls to that restaurant in the list
- In-app toast shown when notification received while app is open
- Works on physical devices only (not simulators)

### Location Tracking

- Requests location permission on first launch
- Gets current location and updates every 5 minutes
- Passes location to `/restaurants` endpoint for distance calculations
- Shows banner when location permission is denied
- "Settings" button opens device settings
- Distance displayed in miles next to restaurant name
- "Nearby" badge for restaurants within 1 mile
- Defaults to "Nearby Only" filter when location is enabled
- Pull-to-refresh updates location

### Filters

- **Nearby Toggle**: Show All vs Nearby Only (within 5 miles)
- **Cuisine Filter**: Horizontal scrollable chips (All, Italian, Mexican, etc.)
- **Price Filter**: Horizontal scrollable chips (All, $, $$, $$$, $$$$)
- Active filter count badge
- "Clear X filters" button
- Filters combine with search

### Smart Recommendations

- Modal shows 2-3 similar restaurants after requesting wait time
- Prioritizes same cuisine type
- Sorts by distance if location available
- Shows distance, cuisine, and wait time
- Tappable cards scroll to that restaurant
- Fallback message: "No similar restaurants nearby"

### Cooldown System

- Prevents spam by tracking `last_called_at` timestamp
- Default cooldown: 30 minutes (configurable per restaurant)
- Shows countdown: "Available in X min"
- Button disabled during cooldown

### Error Handling

- Network errors → "Network error. Please check your connection."
- API errors → "Failed to load restaurants. Please try again."
- Call failures → "Failed to request wait time. Please try again."
- All errors shown via toast notifications

### Loading States

1. **Initial Load**: Context-aware message ("Finding restaurants near you..." or "Loading restaurants...")
2. **Button Loading**: Inline spinner with "Calling..." text, button disabled
3. **Pull-to-Refresh**: Native refresh indicator, updates location and restaurants
4. **Background Refresh**: Silent, no UI blocking

### Search Functionality

- 300ms debounce delay (no search on every keystroke)
- Searches name and cuisine fields
- Case-insensitive
- Shows empty state if no results

## Troubleshooting

### "Failed to load restaurants"

1. Check if backend is running: `curl http://localhost:5001/restaurants`
2. For simulator: backend must be on `localhost:5001`
3. For device: use ngrok or set correct `EXPO_PUBLIC_API_URL`

### SSE Connection Errors

EventSource may fail with ngrok's browser warning page. The app gracefully degrades:
- Exponential backoff reconnection (5s → 60s max)
- Falls back to periodic polling (every 5 min)
- Doesn't block the app

### Build Errors

1. Clear cache: `npm start --clear`
2. Reinstall: `rm -rf node_modules && npm install`
3. Check iOS pods: `cd ios && pod install`

## Configuration

### Update Bundle Identifier

Edit `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.rushhour"
    },
    "android": {
      "package": "com.yourcompany.rushhour"
    }
  }
}
```

### Update App Name

Edit `app.json`:
```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug"
  }
}
```

## Deployment Checklist

- [ ] Update `EXPO_PUBLIC_API_URL` in `eas.json` production profile
- [ ] Update `EAS_PROJECT_ID` in `app.json`
- [ ] Update Expo project ID in `utils/notifications.ts` (line 55)
- [ ] Update bundle identifiers in `app.json`
- [ ] Add app icons and splash screen
- [ ] Add notification icon for Android (`assets/images/notification-icon.png`)
- [ ] Test on physical devices (iOS and Android) - notifications only work on devices
- [ ] Test location permissions on both platforms
- [ ] Set up app store accounts (Apple Developer, Google Play)
- [ ] Review privacy policy requirements (location and notifications)
- [ ] Submit builds via EAS Submit

## Performance Optimizations

- ✅ Debounced search (300ms)
- ✅ Memoized filtered list with multiple filter combinations
- ✅ Memoized cuisine and filter options
- ✅ Conditional logging (dev only)
- ✅ Optimistic UI updates
- ✅ Silent background refreshes
- ✅ Exponential backoff for SSE
- ✅ Location caching with 5-minute refresh interval
- ✅ Async storage for device ID (single generation)

## Accessibility

- All interactive elements have accessibility labels
- Proper semantic roles (button, text, image)
- VoiceOver/TalkBack support
- High contrast text
- Touch target sizes meet guidelines (44x44pt)

## License

MIT

## Support

For issues or questions:
- Open an issue on GitHub
- Contact: your-email@example.com

---

Built with ❤️ using React Native and Expo
