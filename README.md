# Keka Attendance Tracker Extension v2.0

A powerful browser extension that provides real-time attendance tracking for Keka HR system with API-based data fetching, navbar integration, and intelligent time calculations.

## 🎯 Key Features

### ⚡ Real-Time Tracking
- **API-Based Fetching**: Direct integration with Keka's internal APIs for accurate data
- **Live Updates**: Navbar chip updates every second automatically
- **Smart Caching**: 5-minute cache with manual refresh option

### 📊 Navbar Chip Display
- **Glass-morphism Design**: Beautiful translucent chip in the navigation bar
- **Comprehensive Metrics**: Check-in time, Effective hours, Gross hours, Break time, Expected checkout
- **Manual Refresh**: Force-sync attendance data with one click
- **Theme Adaptive**: Automatically adapts to Keka's dark/light theme

### 👤 Profile Badge Indicator
- **Visual Status**: Green dot when clocked IN, Red dot when clocked OUT
- **Smooth Animations**: Pulsing effect for better visibility
- **Always Visible**: Positioned on profile picture for quick reference

### 🕐 Improved Expected Checkout Time
- **Dynamic Calculation**: Shows different times based on clock-in/out status
  - **When Clocked IN**: Current time + remaining work (accounts for breaks)
  - **When Clocked OUT**: First check-in + target hours (reference time)
- **Custom Shift Support**: Set your own work duration (hours + minutes)
- **Real-Time Updates**: Automatically recalculates as you work

### 🔔 Desktop Notifications
- **Shift Completion Alert**: Get notified when your target hours are reached
- **One-Time Notification**: Shows once per session to avoid spam
- **Customizable**: Works with your custom shift settings

### ⚙️ Flexible Settings
- **Custom Work Duration**: Set hours and minutes (e.g., 9h 30m)
- **Easy Access**: Click extension icon to open settings popup
- **Instant Sync**: Changes apply immediately across all Keka tabs
- **Persistent Storage**: Settings saved via Chrome Sync Storage

## 📦 Installation

### Quick Install (Chrome/Edge)

1. **Download/Clone** this repository
2. Open **Chrome** or **Edge** browser
3. Navigate to extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked**
6. Select the `keka_extension` folder
7. Grant permissions when prompted
8. Navigate to your Keka page and enjoy!

📖 **Detailed Instructions:** See [INSTALLATION.md](./INSTALLATION.md)

## 🚀 Usage

### First Time Setup

1. **Navigate to Keka**: Open your company's Keka attendance page
2. **Wait for Initialization**: The navbar chip will appear in 2-3 seconds
3. **Configure Settings** (optional):
   - Click the extension icon in your browser toolbar
   - Check "Use custom work duration" if needed
   - Set your work hours and minutes
   - Click "Save Settings"

### Daily Usage

**Navbar Chip Shows:**
- ⏰ **Checkin**: Your first check-in time of the day
- ⏱️ **Eff**: Effective work hours (excludes breaks)
- 📊 **Gross**: Total time from first check-in
- ☕ **Break**: Total break duration
- 🚪 **Checkout**: Expected checkout time (dynamic)
- 🔄 **Refresh**: Click to force-sync attendance data

**Profile Badge:**
- 🟢 **Green Dot**: Currently clocked IN
- 🔴 **Red Dot**: Currently clocked OUT

### Manual Refresh

Click the 🔄 button in the navbar chip to:
- Force-fetch latest attendance data
- Clear cached data
- Recalculate all metrics
- Update all displays

## 🎨 Visual Design

### Navbar Chip
- **Glass-morphism Effect**: Frosted glass appearance with blur
- **Smooth Animations**: Hover effects and transitions
- **Responsive Layout**: Adapts to different screen sizes
- **Icon Indicators**: Emojis for quick metric identification

### Profile Badge
- **Minimal Design**: Small, non-intrusive indicator
- **Pulse Animation**: Gentle breathing effect
- **Color Coded**: Instant status recognition

### Theme Support
- **Auto-Detection**: Reads Keka's theme preference
- **Seamless Adaptation**: All UI elements match the theme
- **Real-Time Switching**: Updates when you change Keka's theme

## 🔧 Technical Details

### Architecture

```
Extension Flow:
Browser → Background Worker → Content Script → Keka APIs → Cache → UI Updates
```

### API Endpoints Used

1. **Attendance Summary API**
   ```
   GET /k/attendance/api/mytime/attendance/summary
   - Fetches today's attendance logs
   - Returns all clock-in/out entries
   ```

2. **Clock-In Status API**
   ```
   GET /k/default/api/me/clockInDetailsForToday
   - Checks current punch status
   - Returns 0 (IN) or 1 (OUT)
   ```

### Time Calculations

#### Effective Hours (Work Time)
```
Sum of all (Clock-Out - Clock-In) pairs
+ If clocked in: (Current Time - Last Clock-In)
```

#### Gross Hours (Total Time)
```
(Current Time OR Last Clock-Out) - First Clock-In
```

#### Break Time
```
Gross Hours - Effective Hours
```

#### Expected Checkout (IMPROVED ✨)
```
IF CLOCKED IN:
  Expected = Current Time + (Target Hours - Effective Hours)
  → Shows when you'll actually finish

IF CLOCKED OUT:
  Expected = First Check-In + Target Hours
  → Shows ideal target completion time
```

### File Structure

```
keka_extension/
├── manifest.json          # Extension config (v2.0.0)
├── background.js          # Background service worker
├── popup.html            # Settings popup UI
├── popup.js              # Settings logic
├── content.js            # Main content script (API-based)
├── styles.css            # All UI styles
├── utils/
│   ├── time.js          # Time utilities
│   └── calculator.js    # Attendance calculations
├── icons/               # Extension icons
├── INSTALLATION.md      # Detailed install guide
├── UPGRADE_V2_NOTES.md  # Complete v2.0 documentation
└── README.md            # This file
```

## 🔐 Permissions & Privacy

### Required Permissions
- ✅ **activeTab**: Access current Keka tab
- ✅ **storage**: Save your settings
- ✅ **tabs**: Manage multiple Keka tabs
- ✅ **notifications**: Alert on shift completion

### Privacy Commitment
- 🔒 **100% Local**: All processing happens in your browser
- 🚫 **No External Servers**: Zero data sent outside
- 🔐 **No Tracking**: We don't collect or store personal data
- ✅ **Open Source**: Code is transparent and reviewable

## 🐛 Troubleshooting

### Navbar chip not appearing
1. Refresh the Keka page (F5)
2. Wait 2-3 seconds for initialization
3. Check browser console (F12) for errors
4. Verify you're on a *.keka.com domain

### Expected checkout shows "N/A"
1. Ensure you've clocked in today
2. Click the 🔄 refresh button
3. Check your custom settings are valid
4. Verify attendance logs are accessible

### Notification not working
1. Check browser notification permissions
2. Ensure you're clocked in
3. Verify target hours are reached
4. Notification shows only once per session

### Settings not saving
1. Check storage permission is granted
2. Verify values are in valid range (0-12 hours, 0-59 minutes)
3. Try saving again after a few seconds

📖 **More Help:** See [UPGRADE_V2_NOTES.md](./UPGRADE_V2_NOTES.md) for detailed troubleshooting

## 📈 What's New in v2.0

### Major Upgrades
✅ **API-Based Fetching** - No more DOM parsing  
✅ **Navbar Chip Display** - Real-time metrics in navigation  
✅ **Profile Badge** - Visual punch status indicator  
✅ **Dynamic Checkout Time** - Intelligent calculation based on status  
✅ **Theme Support** - Auto-adapts to dark/light mode  
✅ **Desktop Notifications** - Shift completion alerts  
✅ **Background Worker** - Auto-fetch and tab management  
✅ **Settings Popup** - Easy configuration via extension icon  
✅ **Smart Caching** - 5-minute cache with manual refresh  
✅ **Performance Optimized** - Faster and more reliable

### Breaking Changes from v1.0
- DOM-based parsing removed
- New permissions required
- API access required

📖 **Migration Guide:** See [UPGRADE_V2_NOTES.md](./UPGRADE_V2_NOTES.md)

## 🌐 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 88+ | ✅ Fully Supported |
| Edge | 88+ | ✅ Fully Supported |
| Brave | Latest | ✅ Fully Supported |
| Opera | Latest | ⚠️ Untested |
| Firefox | N/A | ❌ Not Compatible (Manifest V3) |

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd keka_extension

# Load in browser
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select keka_extension folder

# Test on Keka
# Navigate to your Keka attendance page
# Check browser console for [Keka Tracker] logs
```

## 🗺️ Roadmap

### Planned Features
- [ ] Historical attendance view (weekly/monthly)
- [ ] Overtime tracking and alerts
- [ ] Multiple shift templates
- [ ] Export attendance reports (CSV/PDF)
- [ ] Keyboard shortcuts
- [ ] Custom notification triggers
- [ ] Team view (if permitted by Keka)

## 📄 License

This extension is for personal and educational use.  
**Not affiliated with or endorsed by Keka.**

## 🙏 Credits

**Original Concept**: DOM-based parsing approach  
**v2.0 Upgrade**: API-based real-time tracking system  
**Inspired By**: keka-extension-06-01-2026

## 📞 Support

- 📖 **Documentation**: Check [UPGRADE_V2_NOTES.md](./UPGRADE_V2_NOTES.md)
- 🐛 **Issues**: Open an issue on the repository
- 💡 **Feature Requests**: Open an issue with [Feature Request] tag
- 📧 **Questions**: Check troubleshooting section first

## Changelog

### v2.0.0 (January 19, 2026)
- ✨ **NEW**: API-based attendance fetching
- ✨ **NEW**: Navbar chip display with glass-morphism design
- ✨ **NEW**: Profile badge indicator (green/red dot)
- ✨ **NEW**: Dynamic expected checkout time calculation
- ✨ **NEW**: Theme support (dark/light auto-detection)
- ✨ **NEW**: Desktop notifications for shift completion
- ✨ **NEW**: Background service worker for auto-fetch
- ✨ **NEW**: Settings popup for custom work duration
- ✨ **NEW**: Smart caching with manual refresh
- ⚡ **IMPROVED**: Performance optimization
- ⚡ **IMPROVED**: More accurate time calculations
- ⚡ **IMPROVED**: Better error handling
- 🔧 **CHANGED**: Removed DOM-based parsing
- 🔧 **CHANGED**: Updated manifest to v2.0.0
- 🔧 **CHANGED**: Added new permissions (storage, notifications)

### v1.0.0 (Initial Release)
- Live attendance tracking
- Multiple clock-in/out support
- Break time calculation
- Expected checkout time
- Dark theme UI
- Real-time updates
- MutationObserver integration
- SPA navigation support

---

**Version**: 2.0.0  
**Release Date**: January 19, 2026  
**Status**: Production Ready ✅  
**Last Updated**: 2026-01-19

Made with ❤️ for Keka users
