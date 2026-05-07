from ml.serving.ranking_service import RankingService


def test_ranking_service_ranks_candidates():
    service = RankingService("ranker-v1")
    ranked = service.rank_candidates("u1", [{"track_key": "t1", "score": 0.9}, {"track_key": "t2", "score": 0.4}])
    assert ranked[0]["final_score"] >= ranked[1]["final_score"]
