from utils.api import legacy_envelope


def test_legacy_envelope_preserves_data_fields():
    payload = {"alpha": 1, "beta": {"value": 2}}
    wrapped = legacy_envelope(payload, confidence={"overall": 0.7}, profileTier="medium")
    assert wrapped["success"] is True
    assert wrapped["data"] == payload
    assert wrapped["alpha"] == 1
    assert wrapped["beta"] == {"value": 2}
    assert wrapped["confidence"] == {"overall": 0.7}
    assert wrapped["profileTier"] == "medium"
