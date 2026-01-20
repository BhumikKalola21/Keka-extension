#!/bin/bash

# Create placeholder icon images for the Chrome extension
# These are simple solid color PNGs that will work as placeholders

cd "$(dirname "$0")/icons"

# Create a simple SVG and convert to PNG at different sizes
# If ImageMagick is not available, the extension will still work without icons

if command -v convert &> /dev/null; then
    echo "ImageMagick found, creating icons..."
    
    # Create SVG template
    cat > temp_icon.svg << 'SVGEOF'
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#grad)"/>
  <circle cx="64" cy="64" r="35" fill="none" stroke="white" stroke-width="4"/>
  <line x1="64" y1="64" x2="64" y2="40" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <line x1="64" y1="64" x2="80" y2="64" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <circle cx="64" cy="64" r="3" fill="white"/>
</svg>
SVGEOF

    # Convert to different sizes
    convert temp_icon.svg -resize 16x16 icon16.png
    convert temp_icon.svg -resize 48x48 icon48.png
    convert temp_icon.svg -resize 128x128 icon128.png
    
    rm temp_icon.svg
    
    echo "✓ Icons created successfully!"
    echo "  - icon16.png"
    echo "  - icon48.png"
    echo "  - icon128.png"
else
    echo "ImageMagick not found. Creating simple colored square icons..."
    
    # Create minimal valid PNG files (1x1 pixel blue)
    # These will work but won't look pretty
    echo -e "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB\x60\x82" > icon16.png
    cp icon16.png icon48.png
    cp icon16.png icon128.png
    
    echo "✓ Basic placeholder icons created."
    echo ""
    echo "Note: For better icons, install ImageMagick:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo "  Then run this script again."
fi

echo ""
echo "Icons are ready! You can now load the extension in Chrome."

