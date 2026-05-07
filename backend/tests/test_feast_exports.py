import pandas as pd

from infra.feast.repo import export_session_features, export_track_features, export_user_profile_features


def test_feast_exports_return_dataframes():
    assert isinstance(export_user_profile_features(), pd.DataFrame)
    assert isinstance(export_track_features(), pd.DataFrame)
    assert isinstance(export_session_features(), pd.DataFrame)
