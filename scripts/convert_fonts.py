#!/usr/bin/env python3
"""
Script to convert woff2 fonts to otf/ttf format during build process.
This ensures fonts are available in Render environment for CAD annotation.
"""

import os
import sys
from pathlib import Path
from fontTools.ttLib import TTFont


def convert_woff2_to_otf():
    """Convert woff2 fonts to otf format for use in annotations."""
    
    # Define source and destination directories
    source_dir = Path(__file__).parent.parent / "node_modules" / "@fontsource" / "noto-sans-sc" / "files"
    dest_dir = Path(__file__).parent.parent / "assets" / "fonts"
    
    # Create destination directory if it doesn't exist
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    # Look for the best woff2 file to convert (prefer 400-normal for regular weight)
    woff2_files = list(source_dir.glob("*.woff2"))
    
    if not woff2_files:
        print("No woff2 files found in source directory.")
        return False
    
    # Find the best candidate - prioritize 400-normal (regular weight) and Chinese Simplified
    best_candidates = []
    for f in woff2_files:
        name = f.name.lower()
        score = 0
        
        # Prioritize regular weight
        if '400' in name or 'normal' in name:
            score += 10
        
        # Prioritize Chinese Simplified
        if 'chinese' in name or 'sc-' in name or '-sc.' in name:
            score += 5
            
        best_candidates.append((score, f))
    
    # Sort by score (highest first)
    best_candidates.sort(key=lambda x: x[0], reverse=True)
    
    if not best_candidates:
        print("No suitable woff2 files found for conversion.")
        return False
    
    # Take the best candidate
    _, best_file = best_candidates[0]
    
    print(f"Converting {best_file.name} to OTF format...")
    
    try:
        # Load the woff2 font
        font = TTFont(str(best_file))
        
        # Save as OTF
        otf_path = dest_dir / "NotoSansSC-Regular.otf"
        font.save(str(otf_path))
        
        print(f"Successfully converted and saved to {otf_path}")
        
        # Verify the file was created
        if otf_path.exists():
            print(f"Font file created successfully with size: {otf_path.stat().st_size} bytes")
            return True
        else:
            print("Failed to create font file.")
            return False
            
    except Exception as e:
        print(f"Error converting font: {e}")
        return False


def main():
    success = convert_woff2_to_otf()
    if not success:
        print("Font conversion failed. The annotation script will try alternative font sources.")
        # Don't exit with error code as this is not critical for the application to run
        return 0
    else:
        print("Font conversion completed successfully.")
        return 0


if __name__ == "__main__":
    sys.exit(main())