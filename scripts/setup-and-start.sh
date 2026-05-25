#!/bin/bash
# Install Pillow at runtime (Render build/runtime environments are separate)
echo "[setup] Installing Pillow..."
pip3 install --user Pillow 2>/dev/null

# Get user site-packages path and export it
export PYTHONPATH=$(python3 -c "import site; print(site.getusersitepackages())" 2>/dev/null)
echo "[setup] PYTHONPATH=$PYTHONPATH"

# Verify Pillow is available
python3 -c "from PIL import Image; print('[setup] Pillow OK')" 2>/dev/null || echo "[setup] WARNING: Pillow not available"

# Start the server
echo "[setup] Starting server..."
exec node server.js
