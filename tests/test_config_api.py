import pytest
import json
import os
import tempfile

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('APPDATA', str(tmp_path))
    import importlib
    import app as app_module
    importlib.reload(app_module)
    app_module.app.config['TESTING'] = True
    with app_module.app.test_client() as c:
        yield c

def test_get_config_returns_is_configured_false_when_no_raidsid(client):
    resp = client.get('/api/config')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['is_configured'] == False
    assert data['raidsid'] == ''

def test_post_config_saves_raidsid(client, tmp_path):
    resp = client.post('/api/config',
        data=json.dumps({'raidsid': 'test123', 'wow_path': ''}),
        content_type='application/json')
    assert resp.status_code == 200
    assert resp.get_json()['success'] == True

def test_post_config_rejects_empty_raidsid(client):
    resp = client.post('/api/config',
        data=json.dumps({'raidsid': '', 'wow_path': ''}),
        content_type='application/json')
    assert resp.status_code == 400

def test_get_config_returns_is_configured_true_after_save(client, tmp_path):
    client.post('/api/config',
        data=json.dumps({'raidsid': 'abc', 'wow_path': ''}),
        content_type='application/json')
    resp = client.get('/api/config')
    assert resp.get_json()['is_configured'] == True
