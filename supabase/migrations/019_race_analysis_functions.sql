-- Race Analysis RPC Functions
-- Migration 019: Server-side aggregation functions for fast race analysis
--
-- These replace JS-side aggregation that loaded all competitors into memory.
-- All functions accept athlete_id as a parameter for query logic.
-- RLS on the underlying tables is still enforced.

-- ============================================================
-- get_race_analysis_summary
-- Replaces: getRaceStatistics + getRacesByForm + getPerformanceByRaceType
-- Returns stats, form analysis (TSB buckets), and terrain analysis in one query.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_race_analysis_summary(
  p_athlete_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_race_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH filtered_races AS (
    SELECT *
    FROM public.race_results
    WHERE athlete_id = p_athlete_id
      AND (p_start_date IS NULL OR race_date >= p_start_date)
      AND (p_category IS NULL OR category = p_category)
      AND (p_race_type IS NULL OR race_type = p_race_type)
  ),
  stats AS (
    SELECT
      COUNT(*)::INT AS total_races,
      ROUND(AVG(placement) FILTER (WHERE placement IS NOT NULL))::INT AS avg_placement,
      ROUND(AVG(
        CASE WHEN placement IS NOT NULL AND total_in_category IS NOT NULL AND total_in_category > 0
          THEN (placement::DECIMAL / total_in_category) * 100
        END
      ))::INT AS avg_placement_percent,
      MIN(placement) FILTER (WHERE placement IS NOT NULL) AS best_placement,
      jsonb_object_agg(
        COALESCE(cat, '_none'),
        cat_count
      ) FILTER (WHERE cat IS NOT NULL) AS category_counts,
      jsonb_object_agg(
        COALESCE(rt, '_none'),
        rt_count
      ) FILTER (WHERE rt IS NOT NULL) AS race_type_counts
    FROM filtered_races,
    LATERAL (
      SELECT category AS cat, COUNT(*) OVER (PARTITION BY category)::INT AS cat_count
    ) cat_agg,
    LATERAL (
      SELECT race_type AS rt, COUNT(*) OVER (PARTITION BY race_type)::INT AS rt_count
    ) rt_agg
  ),
  -- Simpler stats query
  basic_stats AS (
    SELECT
      COUNT(*)::INT AS total_races,
      ROUND(AVG(placement) FILTER (WHERE placement IS NOT NULL))::INT AS avg_placement,
      ROUND(AVG(
        CASE WHEN placement IS NOT NULL AND total_in_category IS NOT NULL AND total_in_category > 0
          THEN (placement::DECIMAL / total_in_category) * 100
        END
      ))::INT AS avg_placement_percent,
      MIN(placement) FILTER (WHERE placement IS NOT NULL) AS best_placement
    FROM filtered_races
  ),
  cat_counts AS (
    SELECT jsonb_object_agg(category, cnt) AS counts
    FROM (
      SELECT category, COUNT(*)::INT AS cnt
      FROM filtered_races
      WHERE category IS NOT NULL
      GROUP BY category
    ) sub
  ),
  rt_counts AS (
    SELECT jsonb_object_agg(race_type, cnt) AS counts
    FROM (
      SELECT race_type, COUNT(*)::INT AS cnt
      FROM filtered_races
      WHERE race_type IS NOT NULL
      GROUP BY race_type
    ) sub
  ),
  form_analysis AS (
    SELECT jsonb_agg(row_to_json(fa)::JSONB) AS data
    FROM (
      SELECT
        CASE
          WHEN tsb_at_race < -20 THEN 'Very Fatigued (<-20)'
          WHEN tsb_at_race >= -20 AND tsb_at_race < -10 THEN 'Fatigued (-20 to -10)'
          WHEN tsb_at_race >= -10 AND tsb_at_race < 5 THEN 'Neutral (-10 to 5)'
          WHEN tsb_at_race >= 5 AND tsb_at_race < 15 THEN 'Fresh (5 to 15)'
          WHEN tsb_at_race >= 15 THEN 'Very Fresh (>15)'
        END AS tsb_range,
        COUNT(*)::INT AS races,
        ROUND(AVG(placement) FILTER (WHERE placement IS NOT NULL))::INT AS avg_placement,
        ROUND(AVG(
          CASE WHEN placement IS NOT NULL AND total_in_category IS NOT NULL AND total_in_category > 0
            THEN (placement::DECIMAL / total_in_category) * 100
          END
        ))::INT AS avg_placement_percent
      FROM filtered_races
      WHERE tsb_at_race IS NOT NULL AND placement IS NOT NULL
      GROUP BY 1
      ORDER BY MIN(tsb_at_race)
    ) fa
  ),
  terrain_analysis AS (
    SELECT jsonb_agg(row_to_json(ta)::JSONB) AS data
    FROM (
      SELECT
        race_type,
        COUNT(*)::INT AS races,
        ROUND(AVG(placement) FILTER (WHERE placement IS NOT NULL))::INT AS avg_placement,
        ROUND(AVG(
          CASE WHEN placement IS NOT NULL AND total_in_category IS NOT NULL AND total_in_category > 0
            THEN (placement::DECIMAL / total_in_category) * 100
          END
        ))::INT AS avg_placement_percent,
        ROUND(AVG(avg_wkg) FILTER (WHERE avg_wkg IS NOT NULL), 2) AS avg_wkg
      FROM filtered_races
      WHERE race_type IS NOT NULL
      GROUP BY race_type
      ORDER BY COUNT(*) DESC
    ) ta
  )
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'totalRaces', bs.total_races,
      'avgPlacement', bs.avg_placement,
      'avgPlacementPercent', bs.avg_placement_percent,
      'bestPlacement', bs.best_placement,
      'categoryCounts', COALESCE(cc.counts, '{}'::JSONB),
      'raceTypeCounts', COALESCE(rc.counts, '{}'::JSONB)
    ),
    'formAnalysis', COALESCE(fa.data, '[]'::JSONB),
    'terrainAnalysis', COALESCE(ta.data, '[]'::JSONB)
  ) INTO result
  FROM basic_stats bs
  CROSS JOIN cat_counts cc
  CROSS JOIN rt_counts rc
  CROSS JOIN form_analysis fa
  CROSS JOIN terrain_analysis ta;

  RETURN COALESCE(result, '{}'::JSONB);
END;
$$;

-- ============================================================
-- get_frequent_opponents
-- Replaces: getFrequentOpponents (the worst bottleneck — loaded ALL competitors into JS)
-- Single SQL: JOIN race_results → race_competitors, GROUP BY zwift_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_frequent_opponents(
  p_athlete_id UUID,
  p_min_races INT DEFAULT 2,
  p_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(opponents)::JSONB), '[]'::JSONB) INTO result
  FROM (
    SELECT
      rc.zwift_id,
      rc.rider_name,
      COUNT(*)::INT AS races_together,
      COUNT(*) FILTER (WHERE rc.position_delta > 0)::INT AS wins_against,
      COUNT(*) FILTER (WHERE rc.position_delta < 0)::INT AS losses_against,
      ROUND(AVG(rc.power_delta) FILTER (WHERE rc.power_delta IS NOT NULL))::INT AS avg_power_gap,
      ROUND(AVG(rc.position_delta) FILTER (WHERE rc.position_delta IS NOT NULL)::NUMERIC, 1) AS avg_position_gap
    FROM public.race_competitors rc
    INNER JOIN public.race_results rr ON rr.id = rc.race_result_id
    WHERE rr.athlete_id = p_athlete_id
      AND rc.zwift_id IS NOT NULL
    GROUP BY rc.zwift_id, rc.rider_name
    HAVING COUNT(*) >= p_min_races
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) opponents;

  RETURN result;
END;
$$;

-- ============================================================
-- get_near_finishers_summary
-- Replaces: getNearFinishersAnalysis
-- Single aggregation: competitors who finished just ahead (position_delta between -range and 0)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_near_finishers_summary(
  p_athlete_id UUID,
  p_position_range INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'avgPowerGapToNextPlace', ROUND(AVG(ABS(rc.power_delta)) FILTER (
      WHERE rc.position_delta = -1 AND rc.power_delta IS NOT NULL
    ))::INT,
    'avgTimeGapToNextPlace', ROUND(AVG(ABS(rc.time_delta_seconds)) FILTER (
      WHERE rc.position_delta = -1 AND rc.time_delta_seconds IS NOT NULL
    ))::INT,
    'racesAnalyzed', COUNT(DISTINCT rc.race_result_id)::INT,
    'potentialPositionGain', ROUND(
      COUNT(*) FILTER (
        WHERE rc.power_delta IS NOT NULL AND rc.power_delta < 0 AND ABS(rc.power_delta) <= 10
      )::DECIMAL / NULLIF(COUNT(DISTINCT rc.race_result_id), 0)
    )::INT
  ) INTO result
  FROM public.race_competitors rc
  INNER JOIN public.race_results rr ON rr.id = rc.race_result_id
  WHERE rr.athlete_id = p_athlete_id
    AND rc.position_delta >= -p_position_range
    AND rc.position_delta < 0;

  RETURN COALESCE(result, jsonb_build_object(
    'avgPowerGapToNextPlace', NULL,
    'avgTimeGapToNextPlace', NULL,
    'racesAnalyzed', 0,
    'potentialPositionGain', NULL
  ));
END;
$$;

-- ============================================================
-- get_category_comparison
-- Replaces: getCategoryComparison (N+1 query pattern)
-- Single query joining race_results with race_competitors, GROUP BY category
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_category_comparison(
  p_athlete_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(comparisons)::JSONB ORDER BY comparisons.races DESC), '[]'::JSONB) INTO result
  FROM (
    SELECT
      rr.category,
      COUNT(DISTINCT rr.id)::INT AS races,
      ROUND(AVG(rr.avg_power) FILTER (WHERE rr.avg_power IS NOT NULL))::INT AS user_avg_power,
      ROUND(AVG(rc.avg_power) FILTER (WHERE rc.avg_power IS NOT NULL AND rc.category = rr.category))::INT AS category_avg_power,
      ROUND(AVG(rr.avg_power) FILTER (WHERE rr.avg_power IS NOT NULL))::INT
        - ROUND(AVG(rc.avg_power) FILTER (WHERE rc.avg_power IS NOT NULL AND rc.category = rr.category))::INT AS power_difference,
      ROUND(AVG(rr.avg_wkg) FILTER (WHERE rr.avg_wkg IS NOT NULL), 2) AS user_avg_wkg,
      ROUND(AVG(rc.avg_wkg) FILTER (WHERE rc.avg_wkg IS NOT NULL AND rc.category = rr.category), 2) AS category_avg_wkg,
      ROUND(
        AVG(rr.avg_wkg) FILTER (WHERE rr.avg_wkg IS NOT NULL)
        - AVG(rc.avg_wkg) FILTER (WHERE rc.avg_wkg IS NOT NULL AND rc.category = rr.category),
        2
      ) AS wkg_difference
    FROM public.race_results rr
    LEFT JOIN public.race_competitors rc ON rc.race_result_id = rr.id
    WHERE rr.athlete_id = p_athlete_id
      AND rr.category IS NOT NULL
    GROUP BY rr.category
  ) comparisons;

  RETURN result;
END;
$$;

-- Comments
COMMENT ON FUNCTION public.get_race_analysis_summary IS 'Aggregated race stats, form analysis (TSB buckets), and terrain analysis in one call';
COMMENT ON FUNCTION public.get_frequent_opponents IS 'Top N frequent opponents with head-to-head records, computed in SQL';
COMMENT ON FUNCTION public.get_near_finishers_summary IS 'Power and time gaps to nearest finishers ahead';
COMMENT ON FUNCTION public.get_category_comparison IS 'User vs category average power and W/kg comparison';
