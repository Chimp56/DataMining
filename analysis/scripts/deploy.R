## Plumber API for anomaly scoring using Isolation Forest
## Start with: plumber::pr("scripts/deploy.R") |> pr_run(port = 8000)

suppressPackageStartupMessages({
  library(plumber)
  library(data.table)
  library(dplyr)
  library(isotree)
})

# ---------- Helpers ----------
prepare_feature_matrix <- function(df, exclude_cols = c("mmsi", "is_known_iuu")) {
  df <- as.data.frame(df)
  num_flags <- sapply(df, is.numeric)
  num_flags[intersect(names(df), exclude_cols)] <- FALSE
  if (!any(num_flags)) stop("No numeric features to train on.")
  mat <- as.data.frame(df[, num_flags, drop = FALSE])
  for (j in seq_len(ncol(mat))) {
    if (any(is.na(mat[[j]]))) {
      med <- median(mat[[j]], na.rm = TRUE)
      if (is.na(med)) med <- 0
      mat[[j]][is.na(mat[[j]])] <- med
    }
  }
  mat
}

load_vessel_features <- function() {
  if (!file.exists("data/vessel_features_all.RData")) {
    stop("Missing data/vessel_features_all.RData. Please run build_dataset.R first.")
  }
  load("data/vessel_features_all.RData")
  obj_name <- if (exists("vessel_features_all")) {
    "vessel_features_all"
  } else if (exists("vessel_features_dt")) {
    "vessel_features_dt"
  } else {
    stop("No vessel feature object found in RData.")
  }
  get(obj_name)
}

# ---------- Model bootstrap (done once at startup) ----------
vessel_df <- load_vessel_features()
features_df <- prepare_feature_matrix(vessel_df, exclude_cols = c("mmsi", "is_known_iuu"))
sample_size <- min(256, nrow(features_df))
iso_model <- isolation.forest(
  features_df,
  ntrees = 300,
  sample_size = sample_size,
  ndim = 3,
  missing_action = "impute",
  seed = 42
)
scores_vec <- predict(iso_model, features_df, type = "score")
scores_dt <- data.table(mmsi = vessel_df$mmsi, anomaly_score = scores_vec)
setorder(scores_dt, -anomaly_score)

# ---------- Plumber endpoints ----------

#* Health check
#* @get /health
function() {
  list(
    status = "ok",
    vessels = nrow(vessel_df),
    features = ncol(features_df)
  )
}

#* Get top-N anomaly scores (sorted desc)
#* @param top_n:int Number of rows to return (default 50)
#* @get /scores
function(top_n = 50) {
  top_n <- as.integer(top_n)
  top_n <- max(1, min(top_n, nrow(scores_dt)))
  head(scores_dt, top_n)
}

#* Get anomaly score for a specific MMSI
#* @param mmsi MMSI identifier (character or numeric)
#* @get /score/<mmsi>
function(mmsi) {
  res <- scores_dt[mmsi == scores_dt$mmsi]
  if (nrow(res) == 0) {
    return(list(error = "mmsi not found"))
  }
  res
}
