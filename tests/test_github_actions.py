import os
import yaml

def test_release_workflow_exists():
    assert os.path.exists('.github/workflows/release.yml')

def test_ci_workflow_exists():
    assert os.path.exists('.github/workflows/ci.yml')

def test_release_triggers_on_version_tags():
    with open('.github/workflows/release.yml') as f:
        config = yaml.safe_load(f)
    tags = config['on']['push']['tags']
    assert 'v*' in tags

def test_release_uses_windows_runner():
    with open('.github/workflows/release.yml') as f:
        config = yaml.safe_load(f)
    jobs = config['jobs']
    for job in jobs.values():
        assert 'windows' in job['runs-on']

def test_release_has_pyinstaller_step():
    with open('.github/workflows/release.yml') as f:
        content = f.read()
    assert 'pyinstaller' in content.lower()

def test_release_has_electron_builder_step():
    with open('.github/workflows/release.yml') as f:
        content = f.read()
    assert 'npm run publish' in content

def test_release_has_github_token():
    with open('.github/workflows/release.yml') as f:
        content = f.read()
    assert 'GITHUB_TOKEN' in content

def test_ci_runs_python_tests():
    with open('.github/workflows/ci.yml') as f:
        content = f.read()
    assert 'pytest' in content

def test_ci_runs_electron_tests():
    with open('.github/workflows/ci.yml') as f:
        content = f.read()
    assert 'npm test' in content
