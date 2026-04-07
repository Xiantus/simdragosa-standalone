"""Tests for worker.spec — PyInstaller configuration for worker.py."""
import re
from pathlib import Path

SPEC_FILE = Path(__file__).parent.parent / "worker.spec"


def test_spec_file_exists():
    assert SPEC_FILE.exists(), "worker.spec must exist at repo root"


def test_spec_targets_worker_py():
    content = SPEC_FILE.read_text()
    assert "python/worker.py" in content, "spec must target python/worker.py"


def test_spec_output_name_is_worker():
    content = SPEC_FILE.read_text()
    assert "name='worker'" in content, "EXE name must be 'worker'"


def test_spec_excludes_flask():
    content = SPEC_FILE.read_text()
    assert "flask" in content.lower(), "spec must explicitly exclude flask"
    # Verify it's in the excludes list, not includes
    excludes_match = re.search(r"excludes\s*=\s*\[([^\]]+)\]", content, re.DOTALL)
    assert excludes_match, "spec must have an excludes list"
    excludes_text = excludes_match.group(1)
    assert "flask" in excludes_text.lower()


def test_spec_console_true():
    """worker.exe must run with console=True so stdout is piped by the parent."""
    content = SPEC_FILE.read_text()
    assert "console=True" in content, "EXE must have console=True"


def test_spec_includes_requests():
    content = SPEC_FILE.read_text()
    assert "requests" in content


def test_old_spec_still_exists_for_reference():
    """backend.spec (v1) should still exist as reference until v2 is stable."""
    old_spec = Path(__file__).parent.parent / "backend.spec"
    assert old_spec.exists(), "backend.spec (v1 reference) should still exist"
