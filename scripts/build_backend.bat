@echo off
echo Building backend.exe with PyInstaller...
pip install pyinstaller
pyinstaller backend.spec --clean --noconfirm
echo Done. Output in dist\backend.exe
