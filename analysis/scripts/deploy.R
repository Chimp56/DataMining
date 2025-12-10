## Plumber API for R functions
## Start with: library(plumber); plumber::pr("scripts/deploy.R") |> pr_run(port = 8001)

suppressPackageStartupMessages({
  library(plumber)
  library(data.table)
  library(dplyr)
  library(duckdb)
  library(DBI)
  library(glue)
  library(lubridate)
  library(tidyr)
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

# ---------- Load cache utilities ----------
cache_utils_path <- NULL
if (file.exists("scripts/cache_utils.R")) {
  cache_utils_path <- normalizePath("scripts/cache_utils.R")
} else if (file.exists("cache_utils.R")) {
  cache_utils_path <- normalizePath("cache_utils.R")
} else {
  base_dir <- getwd()
  if (file.exists(file.path(base_dir, "scripts", "cache_utils.R"))) {
    cache_utils_path <- normalizePath(file.path(base_dir, "scripts", "cache_utils.R"))
  } else if (file.exists(file.path(base_dir, "cache_utils.R"))) {
    cache_utils_path <- normalizePath(file.path(base_dir, "cache_utils.R"))
  } else {
    parent_dir <- dirname(base_dir)
    if (file.exists(file.path(parent_dir, "scripts", "cache_utils.R"))) {
      cache_utils_path <- normalizePath(file.path(parent_dir, "scripts", "cache_utils.R"))
    }
  }
}

if (!is.null(cache_utils_path) && file.exists(cache_utils_path)) {
  source(cache_utils_path, local = TRUE)
  message("Cache utilities loaded")
} else {
  message("Warning: cache_utils.R not found. Caching will be disabled.")
}

# ---------- Load hotspot analysis functions ----------
hotspot_analysis_path <- NULL
if (file.exists("scripts/hotspot_analysis.R")) {
  hotspot_analysis_path <- normalizePath("scripts/hotspot_analysis.R")
} else if (file.exists("hotspot_analysis.R")) {
  hotspot_analysis_path <- normalizePath("hotspot_analysis.R")
} else {
  base_dir <- getwd()
  if (file.exists(file.path(base_dir, "scripts", "hotspot_analysis.R"))) {
    hotspot_analysis_path <- normalizePath(file.path(base_dir, "scripts", "hotspot_analysis.R"))
  } else if (file.exists(file.path(base_dir, "hotspot_analysis.R"))) {
    hotspot_analysis_path <- normalizePath(file.path(base_dir, "hotspot_analysis.R"))
  } else {
    parent_dir <- dirname(base_dir)
    if (file.exists(file.path(parent_dir, "scripts", "hotspot_analysis.R"))) {
      hotspot_analysis_path <- normalizePath(file.path(parent_dir, "scripts", "hotspot_analysis.R"))
    }
  }
}

if (!is.null(hotspot_analysis_path) && file.exists(hotspot_analysis_path)) {
  source(hotspot_analysis_path, local = TRUE)
  message("Hotspot analysis functions loaded")
} else {
  message("Warning: hotspot_analysis.R not found. Hotspot endpoints will not be available.")
}

# ---------- Load vessel prediction functions ----------
vessel_prediction_path <- NULL
if (file.exists("scripts/vessel_prediction.R")) {
  vessel_prediction_path <- normalizePath("scripts/vessel_prediction.R")
} else if (file.exists("vessel_prediction.R")) {
  vessel_prediction_path <- normalizePath("vessel_prediction.R")
} else {
  base_dir <- getwd()
  if (file.exists(file.path(base_dir, "scripts", "vessel_prediction.R"))) {
    vessel_prediction_path <- normalizePath(file.path(base_dir, "scripts", "vessel_prediction.R"))
  } else if (file.exists(file.path(base_dir, "vessel_prediction.R"))) {
    vessel_prediction_path <- normalizePath(file.path(base_dir, "vessel_prediction.R"))
  } else {
    parent_dir <- dirname(base_dir)
    if (file.exists(file.path(parent_dir, "scripts", "vessel_prediction.R"))) {
      vessel_prediction_path <- normalizePath(file.path(parent_dir, "scripts", "vessel_prediction.R"))
    }
  }
}

if (!is.null(vessel_prediction_path) && file.exists(vessel_prediction_path)) {
  source(vessel_prediction_path, local = TRUE)
  message("Vessel prediction functions loaded")
} else {
  message("Warning: vessel_prediction.R not found. Prediction endpoints will not be available.")
}

# ---------- Helper functions ----------
load_vessel_features <- function() {
  # Try multiple paths to find the data file
  data_path <- NULL
  
  # Try paths in order of likelihood
  if (file.exists("data/vessel_features_all.RData")) {
    data_path <- normalizePath("data/vessel_features_all.RData")
  } else if (file.exists("vessel_features_all.RData")) {
    data_path <- normalizePath("vessel_features_all.RData")
  } else {
    base_dir <- getwd()
    if (file.exists(file.path(base_dir, "data", "vessel_features_all.RData"))) {
      data_path <- normalizePath(file.path(base_dir, "data", "vessel_features_all.RData"))
    } else if (file.exists(file.path(base_dir, "vessel_features_all.RData"))) {
      data_path <- normalizePath(file.path(base_dir, "vessel_features_all.RData"))
    } else {
      # Last resort: try parent directory
      parent_dir <- dirname(base_dir)
      if (file.exists(file.path(parent_dir, "data", "vessel_features_all.RData"))) {
        data_path <- normalizePath(file.path(parent_dir, "data", "vessel_features_all.RData"))
      }
    }
  }
  
  if (is.null(data_path) || !file.exists(data_path)) {
    # Provide detailed error with paths checked
    checked_paths <- c(
      "data/vessel_features_all.RData",
      "vessel_features_all.RData",
      file.path(getwd(), "data", "vessel_features_all.RData"),
      file.path(getwd(), "vessel_features_all.RData"),
      file.path(dirname(getwd()), "data", "vessel_features_all.RData")
    )
    stop("Missing data/vessel_features_all.RData.\n",
         "Current working directory: ", getwd(), "\n",
         "Checked paths:\n  - ", paste(checked_paths, collapse = "\n  - "), "\n",
         "Please ensure you're running from the analysis/ directory or run build_dataset.R first.")
  }
  
  # Load the file
  load(data_path)
  obj_name <- if (exists("vessel_features_all")) {
    "vessel_features_all"
  } else if (exists("vessel_features_dt")) {
    "vessel_features_dt"
  } else {
    stop("No vessel feature object found in RData file: ", data_path)
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
  
  # Check if saved model and scores exist
  # Use same robust path resolution as load_vessel_features
  model_path <- NULL
  scores_path <- NULL
  
  # Try multiple paths to find model file
  base_dir <- getwd()
  parent_dir <- dirname(base_dir)
  
  model_candidates <- c(
    "data/iso_forest_model.RData",
    "iso_forest_model.RData",
    file.path(base_dir, "data", "iso_forest_model.RData"),
    file.path(base_dir, "iso_forest_model.RData"),
    file.path(parent_dir, "data", "iso_forest_model.RData"),
    "E:/Quantara Drive/DataMining/analysis/data/iso_forest_model.RData"  # Known absolute path
  )
  
  for (candidate in model_candidates) {
    if (file.exists(candidate)) {
      model_path <- normalizePath(candidate)
      break
    }
  }
  
  # Try multiple paths to find scores file
  scores_candidates <- c(
    "data/mmsi_anomaly_scores.RData",
    "mmsi_anomaly_scores.RData",
    file.path(base_dir, "data", "mmsi_anomaly_scores.RData"),
    file.path(base_dir, "mmsi_anomaly_scores.RData"),
    file.path(parent_dir, "data", "mmsi_anomaly_scores.RData"),
    "E:/Quantara Drive/DataMining/analysis/data/mmsi_anomaly_scores.RData"  # Known absolute path
  )
  
  for (candidate in scores_candidates) {
    if (file.exists(candidate)) {
      scores_path <- normalizePath(candidate)
      break
    }
  }
  
  message("Current working directory: ", getwd())
  message("Model file search (first match will be used):")
  for (candidate in model_candidates) {
    exists <- file.exists(candidate)
    message("  ", candidate, ": ", if (exists) "Found" else "not found")
  }
  message("Selected model_path: ", if (is.null(model_path)) "NULL" else model_path)
  
  message("Scores file search (first match will be used):")
  for (candidate in scores_candidates) {
    exists <- file.exists(candidate)
    message("  ", candidate, ": ", if (exists) "Found" else "not found")
  }
  message("Selected scores_path: ", if (is.null(scores_path)) "NULL" else scores_path)
  
  # Load existing model if available and not forcing retrain
  if (!force_retrain && !is.null(model_path) && file.exists(model_path) && 
      !is.null(scores_path) && file.exists(scores_path)) {
    message("Attempting to load existing model from: ", model_path)
    message("Attempting to load existing scores from: ", scores_path)
    
    # Load model into a temporary environment to avoid overwriting
    temp_env <- new.env()
    model_loaded <- FALSE
    scores_loaded <- FALSE
    
    # Try to load model
    tryCatch({
      load(model_path, envir = temp_env)
      # List all objects in the environment for debugging
      obj_names <- ls(envir = temp_env)
      message("Objects in model file: ", paste(obj_names, collapse = ", "))
      
      # Check if model object exists (could be named 'model' or 'iso_model')
      if (exists("model", envir = temp_env)) {
        iso_model <<- get("model", envir = temp_env)
        model_loaded <- TRUE
        message("Loaded model object 'model'")
      } else if (exists("iso_model", envir = temp_env)) {
        iso_model <<- get("iso_model", envir = temp_env)
        model_loaded <- TRUE
        message("Loaded model object 'iso_model'")
      } else {
        message("Warning: Model object not found in RData file. Available objects: ", paste(obj_names, collapse = ", "))
      }
    }, error = function(e) {
      message("Error loading model file: ", e$message)
    })
    
    # Try to load scores (use separate environment to avoid conflicts)
    if (model_loaded) {
      tryCatch({
        scores_env <- new.env()
        load(scores_path, envir = scores_env)
        obj_names <- ls(envir = scores_env)
        message("Objects in scores file: ", paste(obj_names, collapse = ", "))
        
        # Check if scores object exists (could be named 'df_out' or 'scores_dt')
        if (exists("df_out", envir = scores_env)) {
          df_loaded <- get("df_out", envir = scores_env)
          # Convert to data.table format if needed
          if (!inherits(df_loaded, "data.table")) {
            scores_dt <<- data.table::as.data.table(df_loaded)
          } else {
            scores_dt <<- df_loaded
          }
          # Ensure it has the right columns
          if (!"mmsi" %in% names(scores_dt) || !"anomaly_score" %in% names(scores_dt)) {
            message("Warning: Scores file missing required columns. Available: ", paste(names(scores_dt), collapse = ", "))
          } else {
            # Ensure mmsi is numeric
            scores_dt$mmsi <<- as.numeric(scores_dt$mmsi)
            setorder(scores_dt, -anomaly_score)
            scores_loaded <- TRUE
            message("Loaded scores object 'df_out' with ", nrow(scores_dt), " rows")
          }
        } else if (exists("scores_dt", envir = scores_env)) {
          scores_dt <<- get("scores_dt", envir = scores_env)
          if (!inherits(scores_dt, "data.table")) {
            scores_dt <<- data.table::as.data.table(scores_dt)
          }
          setorder(scores_dt, -anomaly_score)
          scores_loaded <- TRUE
          message("Loaded scores object 'scores_dt' with ", nrow(scores_dt), " rows")
        } else {
          message("Warning: Scores object not found in RData file. Available objects: ", paste(obj_names, collapse = ", "))
        }
      }, error = function(e) {
        message("Error loading scores file: ", e$message)
      })
    }
    
    # If both loaded successfully, we're done
    if (model_loaded && scores_loaded) {
      # Also load vessel_df for other operations (if needed)
      tryCatch({
        vessel_df <<- load_vessel_features()
        features_df <<- prepare_feature_matrix(vessel_df, exclude_cols = c("mmsi", "is_known_iuu"))
      }, error = function(e) {
        message("Note: Could not load vessel features, but model and scores are available.")
      })
      
      model_initialized <<- TRUE
      message("Model and scores loaded successfully. Vessels: ", nrow(scores_dt))
      return(invisible(NULL))
    } else {
      message("Failed to load model or scores. Will retrain.")
      force_retrain <- TRUE
    }
  } else {
    if (force_retrain) {
      message("Force retrain requested, will train new model")
    } else {
      message("Model or scores file not found:")
      message("  model_path: ", if (is.null(model_path)) "NULL" else model_path)
      message("  model exists: ", if (!is.null(model_path)) file.exists(model_path) else "N/A")
      message("  scores_path: ", if (is.null(scores_path)) "NULL" else scores_path)
      message("  scores exists: ", if (!is.null(scores_path)) file.exists(scores_path) else "N/A")
    }
  }
  
  # Train new model if no saved model exists or force_retrain is TRUE
  if (force_retrain || is.null(model_path) || !file.exists(model_path)) {
    message("Training new Isolation Forest model...")
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
    
    # Save model and scores
    if (!dir.exists("data")) {
      dir.create("data", recursive = TRUE)
    }
    save(iso_model, file = "data/iso_forest_model.RData")
    save(scoring, file = "data/iso_forest_scoring.RData")
    data.table::fwrite(scores_dt, file = "data/mmsi_anomaly_scores.csv")
    save(scores_dt, file = "data/mmsi_anomaly_scores.RData")
    message("Model trained and saved. Vessels: ", nrow(scores_dt))
  }
  
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
  # Check if data file exists
  data_found <- FALSE
  if (file.exists("data/vessel_features_all.RData")) {
    data_found <- TRUE
  } else if (file.exists("vessel_features_all.RData")) {
    data_found <- TRUE
  } else {
    base_dir <- getwd()
    if (file.exists(file.path(base_dir, "data", "vessel_features_all.RData")) ||
        file.exists(file.path(base_dir, "vessel_features_all.RData"))) {
      data_found <- TRUE
    } else {
      parent_dir <- dirname(base_dir)
      if (file.exists(file.path(parent_dir, "data", "vessel_features_all.RData"))) {
        data_found <- TRUE
      }
    }
  }
  
  if (data_found) {
    initialize_model()
  } else {
    message("Note: vessel_features_all.RData not found in current directory: ", getwd(), 
            ". Model will initialize on first request.")
  }
}, error = function(e) {
  message("Model initialization deferred: ", e$message, 
          ". Will initialize on first request.")
})

# ---------- Plumber endpoints ----------

#* Health check
#* @get /health
function() {
  # Try to initialize model
  init_result <- tryCatch({
    initialize_model()
    list(
      status = "ok",
      vessels = nrow(vessel_df),
      features = ncol(features_df),
      model_ready = TRUE
    )
  }, error = function(e) {
    # Check what paths exist for debugging
    wd <- getwd()
    paths_checked <- list(
      current_wd = wd,
      relative_data = file.exists("data/vessel_features_all.RData"),
      relative_root = file.exists("vessel_features_all.RData"),
      absolute_data = file.exists(file.path(wd, "data", "vessel_features_all.RData")),
      absolute_root = file.exists(file.path(wd, "vessel_features_all.RData")),
      parent_data = file.exists(file.path(dirname(wd), "data", "vessel_features_all.RData"))
    )
    
    list(
      status = "ok",
      model_ready = FALSE,
      message = "Model not initialized. Data file may be missing.",
      error = e$message,
      debug = paths_checked
    )
  })
  init_result
}

#* Get top-N anomaly scores (sorted desc)
#* @param top_n:int Number of rows to return (default 50)
#* @get /scores
function(top_n = 50) {
  tryCatch({
    initialize_model()
    top_n <- as.integer(top_n)
    top_n <- max(1, min(top_n, nrow(scores_dt)))
    head(scores_dt, top_n)
  }, error = function(e) {
    list(error = paste("Failed to load scores:", e$message))
  })
}

#* Get anomaly score for a specific MMSI
#* @param mmsi MMSI identifier (character or numeric)
#* @get /score/<mmsi>
function(mmsi) {
  tryCatch({
    initialize_model()
    mmsi_num <- as.numeric(mmsi)
    res <- scores_dt[mmsi == mmsi_num]
    if (nrow(res) == 0) {
      return(list(error = "mmsi not found"))
    }
    as.list(res[1])  # Return first match as list
  }, error = function(e) {
    list(error = paste("Failed to load score:", e$message))
  })
}

#* Train/retrain the model and save latest scores to file
#* @param retrain:logical Force retrain even if model exists (default: TRUE)
#* @post /train
function(retrain = TRUE) {
  retrain <- as.logical(retrain)
  if (is.na(retrain)) retrain <- TRUE
  
  tryCatch({
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
  }, error = function(e) {
    list(
      status = "error",
      message = paste("Failed to train model:", e$message),
      suggestion = "Please ensure data/vessel_features_all.RData exists. Run build_dataset.R to generate it."
    )
  })
}

# ==================== Hotspot Analysis Endpoints ====================

#* Get global spatial-temporal hotspots
#* @param start_year:int Start year (default: 2017)
#* @param end_year:int End year (default: 2019)
#* @get /hotspots/global
function(start_year = 2017, end_year = 2019) {
  if (!exists("get_global_hotspots")) {
    return(list(error = "Hotspot analysis functions not loaded"))
  }
  
  tryCatch({
    start_year <- as.integer(start_year)
    end_year <- as.integer(end_year)
    
    result <- get_global_hotspots(start_year, end_year)
    
    # Convert data.frames to lists for JSON serialization
    list(
      status = "success",
      year = result$year,
      month = result$month,
      fishing_cells = lapply(1:nrow(result$fishing_cells), function(i) {
        as.list(result$fishing_cells[i, ])
      }),
      fishing_hotspots = lapply(1:nrow(result$fishing_hotspots), function(i) {
        as.list(result$fishing_hotspots[i, ])
      }),
      ais_events = if (nrow(result$ais_events) > 0) {
        lapply(1:min(1000, nrow(result$ais_events)), function(i) {  # Limit to 1000 for performance
          as.list(result$ais_events[i, ])
        })
      } else {
        list()
      },
      ais_hotspots = if (nrow(result$ais_hotspots) > 0) {
        lapply(1:nrow(result$ais_hotspots), function(i) {
          as.list(result$ais_hotspots[i, ])
        })
      } else {
        list()
      },
      summary = result$summary
    )
  }, error = function(e) {
    list(
      status = "error",
      error = e$message
    )
  })
}

#* Get individual vessel hotspots
#* @param mmsi MMSI identifier
#* @param start_year:int Start year (default: 2017)
#* @param end_year:int End year (default: 2019)
#* @param use_cache:logical Use cached results if available (default: TRUE)
#* @get /hotspots/vessel/<mmsi>
function(mmsi, start_year = 2017, end_year = 2019, use_cache = TRUE) {
  if (!exists("get_vessel_hotspots")) {
    return(list(error = "Hotspot analysis functions not loaded"))
  }
  
  tryCatch({
    mmsi_num <- as.character(mmsi)
    start_year <- as.integer(start_year)
    end_year <- as.integer(end_year)
    use_cache <- as.logical(use_cache)
    if (is.na(use_cache)) use_cache <- TRUE
    
    # Check cache
    cache_key <- make_cache_key("vessel_hotspots", mmsi = mmsi_num, start_year = start_year, end_year = end_year)
    if (use_cache && exists("cache_exists") && cache_exists(cache_key)) {
      cached <- load_cache(cache_key)
      if (!is.null(cached) && "result" %in% names(cached)) {
        message("Returning cached vessel hotspots for MMSI ", mmsi_num, " (", start_year, "-", end_year, ")")
        result <- cached$result
      } else {
        result <- get_vessel_hotspots(mmsi_num, start_year, end_year)
        if (exists("save_cache")) {
          save_cache(cache_key, result = result)
        }
      }
    } else {
      result <- get_vessel_hotspots(mmsi_num, start_year, end_year)
      if (exists("save_cache")) {
        save_cache(cache_key, result = result)
      }
    }
    
    # Convert data.frames to lists for JSON serialization
    list(
      status = "success",
      mmsi = result$mmsi,
      fishing_positions = lapply(1:min(5000, nrow(result$fishing_positions)), function(i) {  # Limit for performance
        as.list(result$fishing_positions[i, ])
      }),
      fishing_hotspots = if (nrow(result$fishing_hotspots) > 0) {
        lapply(1:nrow(result$fishing_hotspots), function(i) {
          as.list(result$fishing_hotspots[i, ])
        })
      } else {
        list()
      },
      ais_events = if (nrow(result$ais_events) > 0) {
        lapply(1:nrow(result$ais_events), function(i) {
          as.list(result$ais_events[i, ])
        })
      } else {
        list()
      },
      summary = result$summary
    )
  }, error = function(e) {
    list(
      status = "error",
      error = e$message
    )
  })
}

# ==================== Vessel Prediction Endpoints ====================

#* Predict vessel location for next N days
#* @param mmsi MMSI identifier
#* @param days_ahead:int Number of days to predict ahead (default: 5)
#* @param start_year:int Start year for training data (default: 2017)
#* @param end_year:int End year for training data (default: 2019)
#* @param use_cache:logical Use cached results if available (default: TRUE)
#* @get /predict/<mmsi>
function(mmsi, days_ahead = 5, start_year = 2017, end_year = 2019, use_cache = TRUE) {
  if (!exists("predict_vessel_location")) {
    return(list(error = "Vessel prediction functions not loaded"))
  }
  
  tryCatch({
    mmsi_num <- as.character(mmsi)
    days_ahead <- as.integer(days_ahead)
    start_year <- as.integer(start_year)
    end_year <- as.integer(end_year)
    use_cache <- as.logical(use_cache)
    if (is.na(use_cache)) use_cache <- TRUE
    
    # Check cache for prediction result
    cache_key <- make_cache_key("vessel_prediction", mmsi = mmsi_num, days_ahead = days_ahead, 
                                 start_year = start_year, end_year = end_year)
    if (use_cache && exists("cache_exists") && cache_exists(cache_key)) {
      cached <- load_cache(cache_key)
      if (!is.null(cached) && "result" %in% names(cached)) {
        message("Returning cached prediction for MMSI ", mmsi_num, " (", days_ahead, " days, ", 
                start_year, "-", end_year, ")")
        result <- cached$result
      } else {
        result <- predict_vessel_location(mmsi_num, days_ahead, start_year, end_year)
        if (exists("save_cache")) {
          save_cache(cache_key, result = result)
        }
      }
    } else {
      result <- predict_vessel_location(mmsi_num, days_ahead, start_year, end_year)
      if (exists("save_cache")) {
        save_cache(cache_key, result = result)
      }
    }
    
    # Convert data.frames to lists for JSON serialization
    list(
      status = result$status,
      mmsi = result$mmsi,
      observed = lapply(1:nrow(result$observed), function(i) {
        as.list(result$observed[i, ])
      }),
      predictions = lapply(1:nrow(result$predictions), function(i) {
        as.list(result$predictions[i, ])
      }),
      model_metrics = result$model_metrics,
      last_known_position = result$last_known_position
    )
  }, error = function(e) {
    list(
      status = "error",
      error = e$message
    )
  })
}

# ==================== Cache Management Endpoints ====================

#* Get cache information
#* @param prefix Filter by cache prefix (e.g., "global_hotspots", "vessel_prediction")
#* @get /cache/info
function(prefix = NULL) {
  if (!exists("get_cache_info")) {
    return(list(error = "Cache utilities not loaded"))
  }
  
  tryCatch({
    info <- get_cache_info(prefix = prefix)
    list(
      status = "success",
      cache_info = info
    )
  }, error = function(e) {
    list(
      status = "error",
      error = e$message
    )
  })
}

#* Clear old cache files
#* @param prefix Filter by cache prefix
#* @param max_age_hours Maximum age in hours (default: 168 = 1 week)
#* @post /cache/clear
function(prefix = NULL, max_age_hours = 168) {
  if (!exists("clear_old_cache")) {
    return(list(error = "Cache utilities not loaded"))
  }
  
  tryCatch({
    max_age_hours <- as.numeric(max_age_hours)
    if (is.na(max_age_hours)) max_age_hours <- 168
    
    deleted <- clear_old_cache(prefix = prefix, max_age_hours = max_age_hours)
    list(
      status = "success",
      deleted_count = deleted,
      message = paste("Deleted", deleted, "cache files")
    )
  }, error = function(e) {
    list(
      status = "error",
      error = e$message
    )
  })
}
