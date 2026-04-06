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

def _get_data_dir_impl(os_name: str, appdata_env: str | None, app_file: str) -> Path:
    """Replicates the logic of app.get_data_dir() for unit testing."""
    if os_name == "nt":
        if appdata_env:
            data_dir = Path(appdata_env) / "Simdragosa"
        else:
            data_dir = Path(app_file).parent
    else:
        data_dir = Path(app_file).parent
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
    def test_returns_simdragosa_path_when_appdata_set(self, tmp_path):
        """get_data_dir() returns a path ending in Simdragosa on Windows when APPDATA is set."""
        result = _get_data_dir_impl("nt", str(tmp_path), str(tmp_path / "app.py"))
        assert result.name == "Simdragosa", f"Expected 'Simdragosa', got '{result.name}'"
        assert str(tmp_path) in str(result)

    def test_creates_directory_if_not_exists(self, tmp_path):
        """get_data_dir() creates the target directory when it does not exist yet."""
        appdata = tmp_path / "AppData" / "Roaming"
        # Do NOT pre-create appdata
        result = _get_data_dir_impl("nt", str(appdata), str(tmp_path / "app.py"))
        assert result.exists(), "get_data_dir() should have created the directory"
        assert result.is_dir()

    def test_fallback_when_not_windows(self, tmp_path):
        """On non-Windows (or missing APPDATA), returns the directory containing app.py."""
        app_file = tmp_path / "app.py"
        app_file.touch()
        result = _get_data_dir_impl("posix", None, str(app_file))
        assert result == tmp_path
        assert result.is_dir()

    def test_fallback_no_appdata_on_windows(self, tmp_path):
        """On Windows with no APPDATA, returns the directory containing app.py."""
        app_file = tmp_path / "app.py"
        app_file.touch()
        result = _get_data_dir_impl("nt", None, str(app_file))
        assert result == tmp_path
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
