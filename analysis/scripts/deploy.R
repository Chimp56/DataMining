## Plumber API for anomaly scoring using Isolation Forest
## Start with: plumber::pr("scripts/deploy.R") |> pr_run(port = 8001)

suppressPackageStartupMessages({
  library(plumber)
  library(data.table)
  library(dplyr)
})

# ---------- Helper function to find and source isolation_forest_iuu.R ----------
load_isolation_forest <- function() {
  iso_forest_path <- NULL
  
  # Try paths in order of likelihood
  if (file.exists("scripts/isolation_forest_iuu.R")) {
    iso_forest_path <- normalizePath("scripts/isolation_forest_iuu.R")
  } else if (file.exists("isolation_forest_iuu.R")) {
    iso_forest_path <- normalizePath("isolation_forest_iuu.R")
  } else {
    base_dir <- getwd()
    if (file.exists(file.path(base_dir, "scripts", "isolation_forest_iuu.R"))) {
      iso_forest_path <- normalizePath(file.path(base_dir, "scripts", "isolation_forest_iuu.R"))
    } else if (file.exists(file.path(base_dir, "isolation_forest_iuu.R"))) {
      iso_forest_path <- normalizePath(file.path(base_dir, "isolation_forest_iuu.R"))
    } else {
      parent_dir <- dirname(base_dir)
      if (file.exists(file.path(parent_dir, "scripts", "isolation_forest_iuu.R"))) {
        iso_forest_path <- normalizePath(file.path(parent_dir, "scripts", "isolation_forest_iuu.R"))
      }
    }
  }
  
  if (is.null(iso_forest_path) || !file.exists(iso_forest_path)) {
    stop("Cannot find isolation_forest_iuu.R. Current working directory: ", getwd())
  }
  
  # Set flag to prevent usage code from running
  RUN_AS_LIBRARY <- TRUE
  source(iso_forest_path, local = TRUE)
  return(TRUE)
}

load_isolation_forest()

# ---------- Helper functions ----------
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

# ---------- Initialize model (lazy loading) ----------
model_initialized <- FALSE
vessel_df <- NULL
features_df <- NULL
iso_model <- NULL
scores_dt <- NULL

initialize_model <- function(force_retrain = FALSE, save_results = FALSE) {
  if (model_initialized && !force_retrain) return(invisible(NULL))
  
  vessel_df <<- load_vessel_features()
  features_df <<- prepare_feature_matrix(vessel_df, exclude_cols = c("mmsi", "is_known_iuu"))
  X <- as.matrix(features_df)
  
  # Set forest parameters
  ntree <- 100
  sample_size <- min(256, nrow(X))
  iso_model <<- iForest_train(X, ntree = ntree, sample_size = sample_size, seed = 8)
  
  # Score all vessels
  scoring <- iForest_score(iso_model, X)
  scores_dt <<- data.table(
    mmsi = vessel_df$mmsi,
    anomaly_score = scoring$score,
    avg_path = scoring$avg_path
  )
  setorder(scores_dt, -anomaly_score)
  model_initialized <<- TRUE
  
  # Save results if requested
  if (save_results) {
    save_latest_scores(scores_dt)
  }
  
  return(invisible(NULL))
}

# Function to save latest scores to file
save_latest_scores <- function(scores_data) {
  # Ensure data directory exists
  if (!dir.exists("data")) {
    dir.create("data", recursive = TRUE)
  }
  
  # Save as CSV
  csv_path <- "data/latest_scores.csv"
  data.table::fwrite(scores_data, file = csv_path)
  
  # Save as RData
  rdata_path <- "data/latest_scores.RData"
  save(scores_data, file = rdata_path)
  
  return(list(
    csv_path = normalizePath(csv_path),
    rdata_path = normalizePath(rdata_path),
    rows = nrow(scores_data),
    timestamp = Sys.time()
  ))
}

# Initialize on startup
tryCatch({
  initialize_model()
}, error = function(e) {
  warning("Model initialization failed: ", e$message, 
          ". Will retry on first request.")
})

# ---------- Plumber endpoints ----------

#* Health check
#* @get /health
function() {
  initialize_model()
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
  initialize_model()
  top_n <- as.integer(top_n)
  top_n <- max(1, min(top_n, nrow(scores_dt)))
  head(scores_dt, top_n)
}

#* Get anomaly score for a specific MMSI
#* @param mmsi MMSI identifier (character or numeric)
#* @get /score/<mmsi>
function(mmsi) {
  initialize_model()
  mmsi_num <- as.numeric(mmsi)
  res <- scores_dt[mmsi == mmsi_num]
  if (nrow(res) == 0) {
    return(list(error = "mmsi not found"))
  }
  as.list(res[1])  # Return first match as list
}

#* Train/retrain the model and save latest scores to file
#* @param retrain:logical Force retrain even if model exists (default: TRUE)
#* @post /train
function(retrain = TRUE) {
  retrain <- as.logical(retrain)
  if (is.na(retrain)) retrain <- TRUE
  
  # Train model and save results
  initialize_model(force_retrain = retrain, save_results = TRUE)
  
  # Get file info
  file_info <- save_latest_scores(scores_dt)
  
  list(
    status = "success",
    message = "Model trained and scores saved",
    files = file_info,
    model_info = list(
      vessels = nrow(vessel_df),
      features = ncol(features_df),
      top_10_scores = head(scores_dt[, .(mmsi, anomaly_score)], 10)
    )
  )
}
