"""Guards on how a Droptimizer submission is sent and how its failures surface.

A batch of sims for one character used to fail with a bare "403 Client Error:
Forbidden".  The body said why — {"error":"armory_fetch_failed"} — but nothing
read it: the payload named the character, so Raidbots looked it up on the
armory for every submission, and that lookup fails under a burst.
"""

from unittest.mock import MagicMock

import pytest
import requests

import droptimizer
import payload_builder as pb
from tests.test_season_config import _build


def _response(status: int, body) -> MagicMock:
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status
    resp.ok = status < 400
    if isinstance(body, dict):
        resp.json.return_value = body
        resp.text = str(body)
    else:
        resp.json.side_effect = ValueError("not json")
        resp.text = body
    return resp


def _session(*responses) -> MagicMock:
    session = MagicMock()
    session.post.side_effect = list(responses)
    return session


@pytest.fixture(autouse=True)
def _no_side_effects(monkeypatch, tmp_path):
    """No real sleeping between retries, no payload dump in the source tree."""
    monkeypatch.setattr(droptimizer.time, "sleep", lambda _s: None)
    monkeypatch.setattr(droptimizer, "__file__", str(tmp_path / "droptimizer.py"))


PAYLOAD = {"droptimizer": {"difficulty": "raid-heroic", "instance": -102, "upgradeLevel": 1}}
ARMORY_FAILED = {"error": "armory_fetch_failed"}


def test_payload_does_not_ask_raidbots_to_fetch_the_armory():
    assert _build()["armory"] is None


def test_armory_fetch_failed_is_retried():
    session = _session(_response(403, ARMORY_FAILED), _response(200, {"simId": "abc"}))
    assert droptimizer.submit_job(session, PAYLOAD, None) == ("abc", "abc")
    assert session.post.call_count == 2


def test_other_403s_are_not_retried():
    session = _session(_response(403, {"error": "not_allowed"}))
    with pytest.raises(requests.HTTPError, match="403 not_allowed"):
        droptimizer.submit_job(session, PAYLOAD, None)
    assert session.post.call_count == 1


def test_error_names_the_reason_after_retries_run_out():
    session = _session(*[_response(403, ARMORY_FAILED) for _ in range(4)])
    with pytest.raises(requests.HTTPError, match="403 armory_fetch_failed"):
        droptimizer.submit_job(session, PAYLOAD, None)
    assert session.post.call_count == 4


def test_error_falls_back_to_the_raw_body_when_it_is_not_json():
    session = _session(_response(500, "upstream exploded"))
    with pytest.raises(requests.HTTPError, match="500 upstream exploded"):
        droptimizer.submit_job(session, PAYLOAD, None)
