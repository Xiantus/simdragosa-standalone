# worker.spec — PyInstaller spec for the Simdragosa v2 sim worker.
# Produces dist/worker.exe — a single stateless executable that reads a JSON
# job spec from stdin and emits line-delimited JSON to stdout.
#
# Build: pyinstaller worker.spec --clean --noconfirm
# Output: dist/worker.exe

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Bundle playwright's driver binary so worker.exe can install Chromium
# without requiring system Python.  collect_data_files picks up the Node-based
# playwright.cmd / playwright driver directory shipped with the Python package.
try:
    _playwright_datas = collect_data_files('playwright', include_py_files=False)
except Exception:
    _playwright_datas = []

a = Analysis(
    ['python/worker.py'],
    pathex=['python'],
    binaries=[],
    datas=_playwright_datas,
    hiddenimports=[
        'requests',
        'requests.adapters',
        'requests.auth',
        'urllib3',
        'certifi',
        'charset_normalizer',
        'idna',
        'json',
        'logging',
        'pathlib',
        'dataclasses',
        # playwright is lazy-imported only for QE sims — include it so it works
        # when present but don't fail the build if it isn't installed
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'flask',
        'flask_cors',
        'jinja2',
        'werkzeug',
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'discord',
        'sqlite3',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='worker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,   # console=True so stdout/stderr are available to parent process
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
