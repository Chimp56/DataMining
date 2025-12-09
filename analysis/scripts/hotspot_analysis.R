# Hotspot Analysis Functions for API Integration
# These functions are sourced by deploy.R to provide hotspot analysis endpoints

# Load required libraries (if not already loaded)
if (!requireNamespace("duckdb", quietly = TRUE)) {
  stop("duckdb package required for hotspot analysis")
}

# =============================================
# Helper Functions
# =============================================

# Find peak month with most fishing activity and AIS events
find_peak_month <- function(con, start_year = 2017, end_year = 2019) {
  temporal <- DBI::dbGetQuery(con, glue::glue("
    SELECT year, month, SUM(fishing_hours) AS hrs
    FROM fleet_monthly_all
    WHERE year BETWEEN {start_year} AND {end_year}
    GROUP BY year, month
    ORDER BY hrs DESC
  "))
  
  # Load AIS events if available
  ais_path <- "data/ais_disabling_events.csv"
  if (file.exists(ais_path)) {
    ais <- read.csv(ais_path, stringsAsFactors = FALSE)
    if ("gap_start_timestamp" %in% names(ais)) {
      ais$ts <- lubridate::ymd_hms(ais$gap_start_timestamp, tz = "UTC")
      ais$year <- lubridate::year(ais$ts)
      ais$month <- lubridate::month(ais$ts)
      ais <- ais %>% dplyr::filter(year >= start_year & year <= end_year)
      ais_counts <- ais %>% dplyr::count(year, month, name = "ais_events")
      temporal <- temporal %>%
        dplyr::left_join(ais_counts, by = c("year", "month")) %>%
        tidyr::replace_na(list(ais_events = 0)) %>%
        dplyr::arrange(dplyr::desc(hrs), dplyr::desc(ais_events))
    }
  }
  
  if (nrow(temporal) == 0) {
    stop("No data found for the specified year range")
  }
  
  temporal[1, ]
}

# Get fishing cells for a specific month
get_fishing_cells <- function(con, year, month) {
  DBI::dbGetQuery(con, glue::glue("
    SELECT (cell_ll_lat + 0.05) AS lat,
           (cell_ll_lon + 0.05) AS lon,
           fishing_hours
    FROM fleet_monthly_all
    WHERE year = {year} AND month = {month} AND fishing_hours > 0
  "))
}

# Get AIS disabling events for a specific month or year range
get_ais_events <- function(year = NULL, month = NULL, start_year = NULL, end_year = NULL, mmsi = NULL) {
  ais_path <- "data/ais_disabling_events.csv"
  if (!file.exists(ais_path)) {
    return(data.frame())
  }
  
  ais <- read.csv(ais_path, stringsAsFactors = FALSE)
  if (!"gap_start_timestamp" %in% names(ais)) {
    return(data.frame())
  }
  
  ais$ts <- lubridate::ymd_hms(ais$gap_start_timestamp, tz = "UTC")
  ais$year <- lubridate::year(ais$ts)
  ais$month <- lubridate::month(ais$ts)
  
  result <- ais
  
  # Filter by year/month if specified
  if (!is.null(year) && !is.null(month)) {
    result <- result %>% dplyr::filter(year == !!year, month == !!month)
  } else if (!is.null(start_year) && !is.null(end_year)) {
    result <- result %>% dplyr::filter(year >= !!start_year & year <= !!end_year)
  } else if (!is.null(year)) {
    result <- result %>% dplyr::filter(year == !!year)
  }
  
  # Filter by MMSI if specified
  if (!is.null(mmsi)) {
    mmsi_col <- if ("mmsi" %in% names(result)) "mmsi" else if ("MMSI" %in% names(result)) "MMSI" else NULL
    if (!is.null(mmsi_col)) {
      result <- result %>% dplyr::filter(.data[[mmsi_col]] == as.character(mmsi))
    }
  }
  
  result
}

# =============================================
# From-Scratch DBSCAN Implementation
# =============================================

# Haversine distance function (calculates distance in km between two lat/lon points)
haversine <- function(lon1, lat1, lon2, lat2) {
  to_rad <- pi / 180
  lon1r <- lon1 * to_rad
  lat1r <- lat1 * to_rad
  lon2r <- lon2 * to_rad
  lat2r <- lat2 * to_rad
  dlon <- lon2r - lon1r
  dlat <- lat2r - lat1r
  a <- sin(dlat/2)^2 + cos(lat1r) * cos(lat2r) * sin(dlon/2)^2
  6371 * 2 * atan2(sqrt(a), sqrt(1 - a))  # Returns distance in km
}

# From-scratch DBSCAN implementation
dbscan_scratch <- function(df, eps_km = 200, minPts = 6) {
  if (nrow(df) == 0) {
    return(list(cluster = integer(0), centers = data.frame()))
  }
  
  n <- nrow(df)
  cluster <- rep(0, n)
  visited <- rep(FALSE, n)
  cid <- 0
  
  for (i in 1:n) {
    if (visited[i]) next
    visited[i] <- TRUE
    
    # Calculate distances to all other points
    dists <- mapply(function(x, y) haversine(df$lon[i], df$lat[i], x, y), 
                    df$lon, df$lat)
    neigh <- which(dists <= eps_km)
    
    if (length(neigh) < minPts) {
      cluster[i] <- -1  # Noise point
      next
    }
    
    # Start new cluster
    cid <- cid + 1
    cluster[i] <- cid
    
    # Expand cluster
    k <- 1
    while (k <= length(neigh)) {
      j <- neigh[k]
      if (!visited[j]) {
        visited[j] <- TRUE
        new_dists <- mapply(function(x, y) haversine(df$lon[j], df$lat[j], x, y), 
                           df$lon, df$lat)
        new_neigh <- which(new_dists <= eps_km)
        if (length(new_neigh) >= minPts) {
          neigh <- unique(c(neigh, new_neigh))
        }
      }
      if (cluster[j] <= 0) {
        cluster[j] <- cid
      }
      k <- k + 1
    }
  }
  
  # Calculate cluster centers
  df_with_cluster <- df
  df_with_cluster$cluster <- cluster
  centers <- df_with_cluster %>%
    dplyr::filter(cluster > 0) %>%
    dplyr::group_by(cluster) %>%
    dplyr::summarise(
      lon = mean(lon),
      lat = mean(lat),
      count = dplyr::n(),
      .groups = "drop"
    )
  
  list(cluster = cluster, centers = centers)
}

# DBSCAN clustering for hotspots
cluster_hotspots <- function(df, eps_km = 200, minPts = 6, top_fraction = 0.05) {
  if (nrow(df) == 0) {
    return(list(clusters = data.frame(), centers = data.frame()))
  }
  
  # Subsample top fraction for speed
  if (top_fraction < 1 && "fishing_hours" %in% names(df)) {
    thresh <- quantile(df$fishing_hours, 1 - top_fraction)
    df_sub <- df %>% dplyr::filter(fishing_hours >= thresh)
  } else {
    df_sub <- df
  }
  
  if (nrow(df_sub) == 0) {
    return(list(clusters = data.frame(), centers = data.frame()))
  }
  
  # Run from-scratch DBSCAN
  result <- dbscan_scratch(df_sub, eps_km = eps_km, minPts = minPts)
  
  df_sub$cluster <- result$cluster
  
  list(
    clusters = df_sub,
    centers = result$centers
  )
}

# Get global hotspot data
get_global_hotspots <- function(start_year = 2017, end_year = 2019) {
  # Connect to database
  db_path <- "data/iuu_hotspots.duckdb"
  if (!file.exists(db_path)) {
    stop("Database file not found: ", db_path)
  }
  
  con <- DBI::dbConnect(duckdb::duckdb(db_path))
  on.exit(DBI::dbDisconnect(con, shutdown = TRUE), add = TRUE)
  
  # Find peak month
  peak <- find_peak_month(con, start_year, end_year)
  year <- peak$year
  month <- peak$month
  
  # Get fishing cells
  fishing_cells <- get_fishing_cells(con, year, month)
  
  # Get AIS events
  ais_events <- get_ais_events(year, month)
  
  # Cluster fishing hotspots
  fish_clusters <- cluster_hotspots(fishing_cells, eps_km = 200, minPts = 6)
  
  # Cluster AIS hotspots
  ais_clusters <- NULL
  if (nrow(ais_events) > 0 && "gap_start_lon" %in% names(ais_events) && "gap_start_lat" %in% names(ais_events)) {
    ais_pts <- ais_events %>%
      dplyr::transmute(lon = gap_start_lon, lat = gap_start_lat) %>%
      dplyr::distinct()
    
    if (nrow(ais_pts) > 0) {
      ais_clusters <- cluster_hotspots(ais_pts, eps_km = 150, minPts = 3, top_fraction = 1)
    }
  }
  
  # Return JSON-serializable data
  list(
    year = year,
    month = month,
    fishing_cells = fishing_cells,
    fishing_hotspots = fish_clusters$centers,
    ais_events = ais_events,
    ais_hotspots = if (!is.null(ais_clusters)) ais_clusters$centers else data.frame(),
    summary = list(
      total_fishing_cells = nrow(fishing_cells),
      total_ais_events = nrow(ais_events),
      fishing_hotspot_count = nrow(fish_clusters$centers),
      ais_hotspot_count = if (!is.null(ais_clusters)) nrow(ais_clusters$centers) else 0
    )
  )
}

# Get individual vessel hotspot data
get_vessel_hotspots <- function(mmsi, start_year = 2017, end_year = 2019) {
  # Load vessel fishing positions from database or CSV files
  # This is a simplified version - you may need to adapt based on your data structure
  
  # Try to load from database first
  db_path <- "data/iuu_hotspots.duckdb"
  vessel_data <- data.frame()
  
  if (file.exists(db_path)) {
    con <- DBI::dbConnect(duckdb::duckdb(db_path))
    on.exit(DBI::dbDisconnect(con, shutdown = TRUE), add = TRUE)
    
    # Query vessel data (adjust table/column names as needed)
    query <- glue::glue("
      SELECT cell_ll_lat AS lat, cell_ll_lon AS lon, fishing_hours, date
      FROM mmsi_daily_all
      WHERE mmsi = '{mmsi}' AND fishing_hours > 0
      AND year BETWEEN {start_year} AND {end_year}
    ")
    
    tryCatch({
      vessel_data <- DBI::dbGetQuery(con, query)
    }, error = function(e) {
      # Fallback: try alternative table/column names
      message("Database query failed, trying alternative...")
    })
  }
  
  # If no database data, try CSV files
  if (nrow(vessel_data) == 0) {
    folders <- c(
      "data/mmsi-daily-csvs-10-v3-2017",
      "data/mmsi-daily-csvs-10-v3-2018",
      "data/mmsi-daily-csvs-10-v3-2019"
    )
    
    for (folder in folders) {
      if (dir.exists(folder)) {
        files <- list.files(folder, pattern = "\\.csv$", full.names = TRUE)
        for (f in files) {
          temp <- read.csv(f, stringsAsFactors = FALSE)
          if ("mmsi" %in% names(temp)) {
            temp <- temp %>%
              dplyr::filter(mmsi == !!as.character(mmsi), fishing_hours > 0) %>%
              dplyr::select(lat = cell_ll_lat, lon = cell_ll_lon, fishing_hours, date)
            if (nrow(temp) > 0) {
              vessel_data <- rbind(vessel_data, temp)
            }
          }
        }
      }
    }
  }
  
  if (nrow(vessel_data) == 0) {
    stop("No fishing data found for MMSI: ", mmsi)
  }
  
  # Get AIS events for this vessel
  ais_events <- get_ais_events(start_year = start_year, end_year = end_year, mmsi = mmsi)
  
  # Cluster vessel hotspots
  vessel_clusters <- cluster_hotspots(vessel_data, eps_km = 100, minPts = 5, top_fraction = 0.02)
  
  list(
    mmsi = mmsi,
    fishing_positions = vessel_data,
    fishing_hotspots = vessel_clusters$centers,
    ais_events = ais_events,
    summary = list(
      total_positions = nrow(vessel_data),
      total_ais_events = nrow(ais_events),
      hotspot_count = nrow(vessel_clusters$centers)
    )
  )
}

