"""Tests for python/worker.py — stdin→stdout sim protocol.

Uses TDD: these tests define the contract worker.py must satisfy.
"""
import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

PYTHON_DIR = Path(__file__).parent.parent / "python"
WORKER_SCRIPT = PYTHON_DIR / "worker.py"


def _run_worker_raw(job_spec_str: str, timeout: int = 15) -> tuple[str, str, int]:
    """Spawn worker.py with raw stdin string. Returns (stdout, stderr, returncode)."""
    proc = subprocess.run(
        [sys.executable, str(WORKER_SCRIPT)],
        input=job_spec_str,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=str(PYTHON_DIR),
    )
    return proc.stdout, proc.stderr, proc.returncode


def _run_worker(job_spec: dict, timeout: int = 15) -> tuple[list[dict], int]:
    """Spawn worker.py with job_spec as stdin. Returns (parsed_lines, exit_code)."""
    stdout, _, code = _run_worker_raw(json.dumps(job_spec), timeout=timeout)
    lines = []
    for line in stdout.splitlines():
        line = line.strip()
        if line:
            try:
                lines.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return lines, code


def _raidbots_spec(**overrides) -> dict:
    base = {
        "type": "raidbots",
        "job_id": "test-job-1",
        "character": {
            "name": "Xiantus", "realm": "illidan", "region": "us",
            "spec": "Fire", "spec_id": 63, "loot_spec_id": 63,
            "simc_string": 'mage="Xiantus"\nspec=fire\ntalents=TEST123',
            "crafted_stats": "36/49",
        },
        "difficulty": "raid-heroic",
        "build_label": "Raid",
        "talent_code": "TEST123",
        "raidsid": "INVALID_SESSION_FORCE_FAILURE",
        "raidbots_api_key": None,
        "timeout_minutes": 1,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# find_talent_builds — pure function, no mocking needed
# ---------------------------------------------------------------------------

class TestFindTalentBuilds:
    @pytest.fixture(autouse=True)
    def _add_python_to_path(self):
        sys.path.insert(0, str(PYTHON_DIR))
        yield
        if str(PYTHON_DIR) in sys.path:
            sys.path.remove(str(PYTHON_DIR))

    def test_copy_block_extracts_raid_and_st(self):
        from droptimizer import find_talent_builds
        simc = (
            'mage="Xiage"\nspec=fire\ntalents=BASE\n\n'
            'copy="Xiage_Raid",Xiage\ntalents=RAID_CODE\n\n'
            'copy="Xiage_ST",Xiage\ntalents=ST_CODE\n'
        )
        result = find_talent_builds(simc)
        assert result.get("Raid") == "RAID_CODE"
        assert result.get("ST") == "ST_CODE"

    def test_empty_simc_returns_empty_dict(self):
        from droptimizer import find_talent_builds
        assert find_talent_builds("") == {}

    def test_single_build_no_named_builds_returns_empty(self):
        from droptimizer import find_talent_builds
        simc = 'mage="Xiage"\ntalents=ONLY_CODE\n'
        assert find_talent_builds(simc) == {}

    def test_section_header_format(self):
        from droptimizer import find_talent_builds
        simc = (
            'mage="Xiage"\nspec=fire\ntalents=BASE\n\n'
            '# --- Raid ---\ntalents=RAID_CODE\n\n'
            '# --- ST ---\ntalents=ST_CODE\n'
        )
        result = find_talent_builds(simc)
        assert result.get("Raid") == "RAID_CODE"
        assert result.get("ST") == "ST_CODE"


# ---------------------------------------------------------------------------
# Worker protocol tests
# ---------------------------------------------------------------------------

class TestWorkerProtocol:
    def test_invalid_json_stdin_exits_nonzero(self):
        """Worker must exit non-zero when stdin is not valid JSON."""
        _, _, code = _run_worker_raw("not valid json at all")
        assert code != 0, "Expected non-zero exit for invalid stdin JSON"

    def test_invalid_json_stdin_emits_error_line(self):
        """Worker must emit a type:error JSON line when stdin is not valid JSON."""
        stdout, _, _ = _run_worker_raw("not valid json at all")
        lines = [json.loads(l) for l in stdout.splitlines() if l.strip()]
        assert any(l.get("type") == "error" for l in lines), (
            f"Expected type:error line in output, got: {stdout!r}"
        )

    def test_all_stdout_lines_are_valid_json(self):
        """Every line on stdout must be parseable JSON."""
        spec = _raidbots_spec()
        stdout, _, _ = _run_worker_raw(json.dumps(spec), timeout=30)
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                json.loads(line)
            except json.JSONDecodeError as e:
                pytest.fail(f"Non-JSON stdout line: {line!r} — {e}")

    def test_first_event_is_fetching_for_raidbots_job(self):
        """First stdout event must be {type:progress, status:fetching}."""
        spec = _raidbots_spec()
        lines, _ = _run_worker(spec, timeout=30)
        assert len(lines) >= 1, "Worker produced no stdout output"
        assert lines[0].get("type") == "progress", f"First line type wrong: {lines[0]}"
        assert lines[0].get("status") == "fetching", f"First line status wrong: {lines[0]}"

    def test_network_failure_emits_error_not_traceback(self):
        """On network failure, worker emits type:error — not an unhandled exception."""
        spec = _raidbots_spec(raidsid="INVALID_SESSION_FORCE_FAILURE")
        lines, _ = _run_worker(spec, timeout=30)
        error_lines = [l for l in lines if l.get("type") == "error"]
        assert len(error_lines) >= 1, (
            f"Expected type:error line on network failure, got: {lines}"
        )
        msg = error_lines[0].get("message", "")
        assert isinstance(msg, str) and len(msg) > 0

    def test_error_message_is_string(self):
        """Error message field must be a non-empty string."""
        spec = _raidbots_spec(raidsid="INVALID")
        lines, _ = _run_worker(spec, timeout=30)
        for line in lines:
            if line.get("type") == "error":
                assert isinstance(line["message"], str)
                assert len(line["message"]) > 0
                return
        pytest.fail("No error line found")

    def test_unknown_job_type_emits_error(self):
        """Unsupported job type must emit type:error."""
        spec = _raidbots_spec()
        spec["type"] = "unsupported_type"
        lines, code = _run_worker(spec, timeout=10)
        error_lines = [l for l in lines if l.get("type") == "error"]
        assert len(error_lines) >= 1
        assert code != 0


class TestParseSimcSpec:
    """Unit tests for _parse_simc_spec helper."""

    def _parse(self, simc: str):
        import sys
        sys.path.insert(0, str(PYTHON_DIR))
        from worker import _parse_simc_spec
        return _parse_simc_spec(simc)

    def test_devourer_maps_to_havoc_577(self):
        simc = 'demonhunter="Xihuntus"\nspec=devourer\n'
        name, spec_id = self._parse(simc)
        assert spec_id == 577
        assert name == "Havoc"

    def test_havoc_maps_correctly(self):
        simc = 'demonhunter="Xihuntus"\nspec=havoc\n'
        name, spec_id = self._parse(simc)
        assert spec_id == 577
        assert name == "Havoc"

    def test_fire_mage(self):
        simc = 'mage="Pyronius"\nspec=fire\n'
        name, spec_id = self._parse(simc)
        assert spec_id == 63
        assert name == "Fire"

    def test_devastation_evoker(self):
        simc = 'evoker="Xiantu"\nspec=devastation\n'
        name, spec_id = self._parse(simc)
        assert spec_id == 1467
        assert name == "Devastation"

    def test_missing_spec_returns_unknown(self):
        simc = 'mage="Pyronius"\n# no spec line\n'
        name, spec_id = self._parse(simc)
        assert spec_id == 0
        assert name == "Unknown"

    def test_comments_ignored(self):
        simc = '# spec=fire\nmage="Pyronius"\nspec=arcane\n'
        name, spec_id = self._parse(simc)
        assert spec_id == 62
        assert name == "Arcane"
