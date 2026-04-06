@echo off
echo === Simdragosa Standalone Release Build ===

echo [1/3] Building Python backend with PyInstaller...
cd ..
pip install pyinstaller -q
pyinstaller backend.spec --clean --noconfirm
if errorlevel 1 ( echo PyInstaller failed & exit /b 1 )

echo [2/3] Installing Node dependencies...
cd electron
npm install
if errorlevel 1 ( echo npm install failed & exit /b 1 )

echo [3/3] Building NSIS installer with electron-builder...
npm run build
if errorlevel 1 ( echo electron-builder failed & exit /b 1 )

echo === Build complete. Installer in release/ ===
