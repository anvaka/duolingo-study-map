#!/bin/bash

# Download all flag images from flagcdn.com for local use
# Run this script once to populate the flags/ directory

mkdir -p flags

# All country codes used in languageToFlag.js
CODES=(
  "sa"  # Arabic
  "cn"  # Chinese
  "dk"  # Danish
  "gb"  # English
  "fi"  # Finnish
  "fr"  # French
  "de"  # German
  "py"  # Guarani
  "il"  # Hebrew
  "in"  # Hindi
  "ie"  # Irish
  "it"  # Italian
  "jp"  # Japanese
  "kr"  # Korean
  "no"  # Norwegian
  "pt"  # Portuguese
  "ru"  # Russian
  "es"  # Spanish
  "ke"  # Swahili
  "se"  # Swedish
  "tr"  # Turkish
)

echo "Downloading flags..."

for code in "${CODES[@]}"; do
  url="https://flagcdn.com/w640/${code}.png"
  output="flags/${code}.png"
  
  if [ -f "$output" ]; then
    echo "  ✓ ${code}.png already exists"
  else
    echo "  ↓ Downloading ${code}.png..."
    curl -s -o "$output" "$url"
    
    if [ $? -eq 0 ]; then
      echo "    ✓ Done"
    else
      echo "    ✗ Failed to download ${code}.png"
    fi
  fi
done

echo ""
echo "All flags downloaded to ./flags/"
