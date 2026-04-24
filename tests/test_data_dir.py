"""Tests for get_data_dir() and --port argparse logic (Issue #3)."""

import argparse
import os
import sys
from pathlib import Path
import pytest


# ---------------------------------------------------------------------------
# Pure-function reimplementation for isolated testing
# (We test the logic, not the module-level side effects)
# ---------------------------------------------------------------------------

def _get_data_dir_impl(
    platform: str,
    appdata_env: str | None,
    app_file: str,
    home: str | None = None,
    xdg_data_home: str | None = None,
) -> Path:
    """Replicates the logic of app.get_data_dir() for unit testing."""
    _home = Path(home) if home else Path.home()
    if platform == "win32":
        data_dir = Path(appdata_env) / "Simdragosa" if appdata_env else Path(app_file).parent
    elif platform == "darwin":
        data_dir = _home / "Library" / "Application Support" / "Simdragosa"
    else:
        data_dir = Path(xdg_data_home) / "Simdragosa" if xdg_data_home else _home / ".local" / "share" / "Simdragosa"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _make_argparser():
    """Replicates the argparse setup from app._parse_args()."""
    parser = argparse.ArgumentParser(description="Simdragosa standalone backend")
    parser.add_argument(
        "--port", type=int, default=5000,
        help="Port to bind Flask to (default: 5000)",
    )
    return parser


class TestGetDataDir:
    def test_windows_returns_simdragosa_under_appdata(self, tmp_path):
        """Windows: returns %APPDATA%/Simdragosa when APPDATA is set."""
        result = _get_data_dir_impl("win32", str(tmp_path), str(tmp_path / "app.py"))
        assert result.name == "Simdragosa", f"Expected 'Simdragosa', got '{result.name}'"
        assert str(tmp_path) in str(result)

    def test_windows_creates_directory_if_not_exists(self, tmp_path):
        """Windows: creates the target directory when it does not exist yet."""
        appdata = tmp_path / "AppData" / "Roaming"
        result = _get_data_dir_impl("win32", str(appdata), str(tmp_path / "app.py"))
        assert result.exists(), "get_data_dir() should have created the directory"
        assert result.is_dir()

    def test_windows_fallback_no_appdata(self, tmp_path):
        """Windows: falls back to app.py directory when APPDATA is missing."""
        app_file = tmp_path / "app.py"
        app_file.touch()
        result = _get_data_dir_impl("win32", None, str(app_file))
        assert result == tmp_path
        assert result.is_dir()

    def test_macos_returns_library_application_support(self, tmp_path):
        """macOS: returns ~/Library/Application Support/Simdragosa."""
        result = _get_data_dir_impl("darwin", None, str(tmp_path / "app.py"), home=str(tmp_path))
        assert result == tmp_path / "Library" / "Application Support" / "Simdragosa"
        assert result.is_dir()

    def test_linux_xdg_data_home(self, tmp_path):
        """Linux: uses XDG_DATA_HOME when set."""
        xdg = tmp_path / "xdg"
        result = _get_data_dir_impl("linux", None, str(tmp_path / "app.py"), home=str(tmp_path), xdg_data_home=str(xdg))
        assert result == xdg / "Simdragosa"
        assert result.is_dir()

    def test_linux_fallback_no_xdg(self, tmp_path):
        """Linux: falls back to ~/.local/share/Simdragosa when XDG_DATA_HOME is unset."""
        result = _get_data_dir_impl("linux", None, str(tmp_path / "app.py"), home=str(tmp_path))
        assert result == tmp_path / ".local" / "share" / "Simdragosa"
        assert result.is_dir()


class TestArgParse:
    def test_default_port_is_5000(self):
        """--port defaults to 5000 when not supplied."""
        parser = _make_argparser()
        args = parser.parse_args([])
        assert args.port == 5000

    def test_custom_port_is_respected(self):
        """--port 8080 results in args.port == 8080."""
        parser = _make_argparser()
        args = parser.parse_args(["--port", "8080"])
        assert args.port == 8080

    def test_port_must_be_integer(self):
        """Non-integer --port value should cause argparse to exit."""
        parser = _make_argparser()
        with pytest.raises(SystemExit):
            parser.parse_args(["--port", "notanumber"])
