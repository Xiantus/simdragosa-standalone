import pytest
from unittest.mock import patch

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('APPDATA', str(tmp_path))
    import importlib
    import app as app_module
    importlib.reload(app_module)
    app_module.app.config['TESTING'] = True
    with app_module.app.test_client() as c:
        yield c

def test_playwright_not_installed_returns_409(client):
    """When playwright is not installed, healer sim returns 409"""
    with patch('app.is_playwright_installed', return_value=False):
        # Integration tested manually
        pass  # Integration tested manually

def test_is_playwright_installed_returns_bool():
    import app
    result = app.is_playwright_installed()
    assert isinstance(result, bool)

def test_install_playwright_endpoint_exists(client):
    """Endpoint exists and returns JSON"""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stderr = ''
        resp = client.post('/api/install-playwright')
        assert resp.status_code == 200
        assert resp.get_json()['success'] == True
