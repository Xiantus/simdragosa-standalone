import os
import yaml  # pip install pyyaml

def test_electron_builder_config_exists():
    assert os.path.exists('electron-builder.yml')

def test_config_has_correct_app_id():
    with open('electron-builder.yml') as f:
        config = yaml.safe_load(f)
    assert config['appId'] == 'com.simdragosa.standalone'

def test_config_targets_nsis():
    with open('electron-builder.yml') as f:
        config = yaml.safe_load(f)
    win_targets = [t['target'] for t in config['win']['target']]
    assert 'nsis' in win_targets

def test_config_includes_backend_exe_as_extra_resource():
    with open('electron-builder.yml') as f:
        config = yaml.safe_load(f)
    extra = config.get('extraResources', [])
    destinations = [r['to'] if isinstance(r, dict) else r for r in extra]
    assert 'worker.exe' in destinations

def test_config_publishes_to_correct_github_repo():
    with open('electron-builder.yml') as f:
        config = yaml.safe_load(f)
    publish = config['publish']
    assert publish['owner'] == 'Xiantus'
    assert publish['repo'] == 'simdragosa-standalone'

def test_build_release_script_exists():
    assert os.path.exists('scripts/build_release.bat')
