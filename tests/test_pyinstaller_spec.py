import ast
import os

def test_spec_file_exists():
    assert os.path.exists('backend.spec'), "backend.spec must exist"

def test_spec_references_app_py():
    with open('backend.spec') as f:
        content = f.read()
    assert 'app.py' in content

def test_spec_excludes_discord():
    with open('backend.spec') as f:
        content = f.read()
    assert 'discord' in content  # in excludes list

def test_spec_includes_templates_and_static():
    with open('backend.spec') as f:
        content = f.read()
    assert 'templates' in content
    assert 'static' in content

def test_spec_console_is_false():
    with open('backend.spec') as f:
        content = f.read()
    assert 'console=False' in content

def test_build_script_exists():
    assert os.path.exists('scripts/build_backend.bat')
