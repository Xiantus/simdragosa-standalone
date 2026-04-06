# Test that simulation_runner has no discord imports
def test_no_discord_import_in_simulation_runner():
    with open("simulation_runner.py") as f:
        content = f.read()
    assert "discord" not in content.lower()

# Test that app.py has no discord imports
def test_no_discord_import_in_app():
    with open("app.py") as f:
        content = f.read()
    assert "discord" not in content.lower()

# Test that discord_bot.py is deleted
def test_discord_bot_file_deleted():
    import os
    assert not os.path.exists("discord_bot.py")

# Test that discord is not in requirements.txt
def test_discord_not_in_requirements():
    with open("requirements.txt") as f:
        content = f.read().lower()
    assert "discord" not in content
