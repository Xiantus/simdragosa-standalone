"""Tests for auth removal (Issue #4)."""

import sys
import types
import unittest.mock as mock
from pathlib import Path
import pytest


def _make_flask_app():
    """Import app.py with all deps stubbed and return (app, db_module)."""
    import importlib.util

    stub_names = [
        "flask", "requests",
        "droptimizer", "payload_builder", "raidbots_session",
        "sim_router", "job_state", "db",
    ]
    for name in stub_names:
        if name not in sys.modules:
            sys.modules[name] = types.ModuleType(name)

    flask_mod = sys.modules["flask"]

    # We need a real Flask-like test client. Use Flask itself if available.
    try:
        import flask as real_flask
        flask_mod.Flask = real_flask.Flask
        flask_mod.jsonify = real_flask.jsonify
        flask_mod.request = real_flask.request
        flask_mod.render_template = mock.MagicMock(return_value="<html/>")
        flask_mod.Response = real_flask.Response
    except ImportError:
        flask_mod.Flask = mock.MagicMock(return_value=mock.MagicMock())
        flask_mod.jsonify = mock.MagicMock()
        flask_mod.request = mock.MagicMock()
        flask_mod.render_template = mock.MagicMock()
        flask_mod.Response = mock.MagicMock()

    dr = sys.modules["droptimizer"]
    dr.RAIDBOTS_BASE = "https://www.raidbots.com"
    dr.apply_talent = mock.MagicMock()
    dr.fetch_character = mock.MagicMock()
    dr.fetch_static_data = mock.MagicMock()
    dr.find_talent_builds = mock.MagicMock()

    pb = sys.modules["payload_builder"]
    pb.CharacterIdentity = mock.MagicMock()
    pb.DIFFICULTY_MAP = {}
    pb.SimTarget = mock.MagicMock()

    db_mod = sys.modules["db"]
    db_mod.init_db = mock.MagicMock()
    db_mod.get_all_users = mock.MagicMock(return_value=[])
    db_mod.load_characters = mock.MagicMock(return_value=[])
    db_mod.get_raidsid = mock.MagicMock(return_value=None)
    db_mod.load_tooltip_data_for_user = mock.MagicMock(return_value={})

    sr = sys.modules["sim_router"]
    sr.diff_label = mock.MagicMock(return_value="")
    sr.is_healer = mock.MagicMock(return_value=False)
    sr.run_qe_sim = mock.MagicMock()
    sr.run_raidbots_sim = mock.MagicMock()

    sys.modules["raidbots_session"].make_raidbots_session = mock.MagicMock()

    js = sys.modules["job_state"]
    js.Job = mock.MagicMock()
    js.JobStatus = mock.MagicMock()

    snap_mock = mock.MagicMock()
    snap_mock.snapshot.return_value = {"results": []}
    snap_mock.append_log = mock.MagicMock()
    js.SimRunnerState = mock.MagicMock(return_value=snap_mock)

    app_path = Path(__file__).parent.parent / "app.py"
    spec = importlib.util.spec_from_file_location("app_module_auth", app_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestNoAuth:
    def test_auth_py_deleted(self):
        """auth.py must not exist in the project."""
        auth_file = Path(__file__).parent.parent / "auth.py"
        assert not auth_file.exists(), "auth.py should have been deleted"

    def test_login_template_deleted(self):
        """templates/login.html must not exist."""
        login_tmpl = Path(__file__).parent.parent / "templates" / "login.html"
        assert not login_tmpl.exists(), "templates/login.html should have been deleted"

    def test_register_template_deleted(self):
        """templates/register.html must not exist."""
        reg_tmpl = Path(__file__).parent.parent / "templates" / "register.html"
        assert not reg_tmpl.exists(), "templates/register.html should have been deleted"

    def test_app_py_has_no_require_login(self):
        """app.py must not contain @require_login or require_login references."""
        app_file = Path(__file__).parent.parent / "app.py"
        content = app_file.read_text(encoding="utf-8")
        assert "require_login" not in content, "app.py should not reference require_login"

    def test_app_py_has_no_auth_import(self):
        """app.py must not import from auth."""
        app_file = Path(__file__).parent.parent / "app.py"
        content = app_file.read_text(encoding="utf-8")
        assert "from auth import" not in content
        assert "auth_bp" not in content

    def test_no_login_route_registered(self):
        """The /login route must not be registered in app.py."""
        app_file = Path(__file__).parent.parent / "app.py"
        content = app_file.read_text(encoding="utf-8")
        # /login should only appear as commented text at most, not as a route
        assert '"/login"' not in content

    def test_db_has_no_users_table(self):
        """db.py must not create a users table."""
        db_file = Path(__file__).parent.parent / "db.py"
        content = db_file.read_text(encoding="utf-8")
        assert "CREATE TABLE IF NOT EXISTS users" not in content

    def test_db_functions_do_not_require_user_id(self):
        """db.py functions must not have user_id as a required (positional) parameter."""
        import ast
        db_file = Path(__file__).parent.parent / "db.py"
        tree = ast.parse(db_file.read_text(encoding="utf-8"))

        violations = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef):
                continue
            args = node.args
            # Check positional (non-default) arguments
            n_defaults = len(args.defaults)
            n_args = len(args.args)
            required_args = args.args[:n_args - n_defaults]
            for arg in required_args:
                if arg.arg == "user_id":
                    violations.append(node.name)

        assert violations == [], (
            f"These db.py functions still have user_id as a required param: {violations}"
        )
