# ============================================================
# 0) Load packages
# ============================================================
library(data.table)
library(sf)
library(dplyr)
library(lubridate)
library(nngeo)

# ============================================================
# 1) Load data
# ============================================================
load("data/fishing_vessels_metadata.RData")
load("data/iuu_list.RData")
load("data/ais_disabling.RData")
load("data/mmsi_daily.RData")
load("data/eez_boundaries.RData")
load("data/eez.RData")
load("data/mpa.RData")

# Ensure consistent types
mmsi_daily$mmsi <- as.character(mmsi_daily$mmsi)
ais_disabling$mmsi <- as.character(ais_disabling$mmsi)
fishing_vessels_metadata$mmsi <- as.character(fishing_vessels_metadata$mmsi)

# sample 20k vessels from mmsi_daily
set.seed(8)
vessels_20k <- sample(unique(mmsi_daily$mmsi), 20000)

mmsi_daily_sample <- mmsi_daily[mmsi_daily$mmsi %in% vessels_20k, ]
ais_disabling_sample <- ais_disabling[ais_disabling$mmsi %in% vessels_20k, ]
ais_disabling <- ais_disabling_sample

length(unique(mmsi_daily_sample$mmsi))

# per-vessel-per-month AIS subsampling
dt <- data.table(mmsi_daily_sample)
dt[, month := floor_date(as.Date(date), "month")]
# sample 30 AIS points per vessel per month
ais_sampled <- dt[, .SD[sample(.N, min(.N, 30))],
                  by = .(mmsi, month)]

mmsi_daily <- ais_sampled

# ============================================================
# 2) Convert AIS points to sf
# ============================================================
message("Converting AIS daily data to sf points...")

mmsi_daily$lon <- mmsi_daily$cell_ll_lon
mmsi_daily$lat <- mmsi_daily$cell_ll_lat

ais_pts <- st_as_sf(
  mmsi_daily,
  coords = c("lon", "lat"),
  crs = 4326,
  remove = FALSE
)

# Project everything to metric CRS (Web Mercator)
ais_pts_proj <- st_transform(ais_pts, 3857)
eez_proj       <- st_transform(eez, 3857)
mpa_proj       <- st_transform(mpa, 3857)

# ============================================================
# 3) Centroid sampling
# ============================================================
message("Generating subsampled EEZ + MPA centroids...")

# EEZs are small (285 polygons)
eez_centroids <- st_centroid(eez_proj)

# MPAs are large (16520 polygons)
mpa_centroids <- st_centroid(mpa_proj)

# Subsample MPAs 
eez_centroids_sample <- eez_centroids
mpa_centroids_sample <- mpa_centroids %>% slice_sample(prop = 0.05)

message(sprintf(
  "EEZ centroids: %d  |  MPA centroids sampled: %d",
  nrow(eez_centroids_sample),
  nrow(mpa_centroids_sample)
))

# ============================================================
# 4) Fast NN distances using st_nn
# ============================================================
message("Computing nearest EEZ centroid index...")
# Other methods were consuming too much memory
eez_nn <- st_nn(
  ais_pts_proj,
  eez_centroids_sample,
  k = 1,
  progress = TRUE
)

eez_nn <- vapply(eez_nn, `[`, integer(1), 1)

message("Computing distances to EEZ centroids...")

dist_to_eez_m <- as.numeric(st_distance(
  ais_pts_proj,
  eez_centroids_sample[eez_nn, ],
  by_element = TRUE
))

# MPA distance
message("Computing nearest MPA centroid index...")

mpa_nn <- st_nn(
  ais_pts_proj,
  mpa_centroids_sample,
  k = 1,
  progress = TRUE
)

mpa_nn <- vapply(mpa_nn, `[`, integer(1), 1)

message("Computing distances to MPA centroids...")

dist_to_mpa_m <- as.numeric(st_distance(
  ais_pts_proj,
  mpa_centroids_sample[mpa_nn, ],
  by_element = TRUE
))

# Attach distances
ais_pts_proj$dist_to_eez_km <- dist_to_eez_m / 1000
ais_pts_proj$dist_to_mpa_km <- dist_to_mpa_m / 1000

# ============================================================
# 5) EEZ / MPA membership (boolean)
# ============================================================

message("Computing in-EEZ and in-MPA flags...")

ais_pts_proj$in_eez <- lengths(st_within(ais_pts_proj, eez_proj)) > 0
ais_pts_proj$in_mpa <- lengths(st_within(ais_pts_proj, mpa_proj)) > 0

# ============================================================
# 6) Per-vessel feature aggregation
# ============================================================
message("Aggregating vessel behavior features...")

# Convert to data.table
ais_dt <- as.data.table(st_drop_geometry(ais_pts_proj))

# Compute basic vessel features
vessel_basic <- ais_dt[, .(
  n_days                = uniqueN(date),
  n_points              = .N,
  mean_speed            = mean(hours, na.rm = TRUE),
  total_fishing_hours   = sum(fishing_hours, na.rm = TRUE),
  pct_in_eez            = mean(in_eez),
  pct_in_mpa            = mean(in_mpa),
  mean_dist_eez_km      = mean(dist_to_eez_km),
  mean_dist_mpa_km      = mean(dist_to_mpa_km)
), by = mmsi]

# ============================================================
# 7) EEZ / MPA crossings
# ============================================================
message("Computing boundary crossings...")

ais_dt <- ais_dt[order(mmsi, date)]

vessel_crossings <- ais_dt[, .(
  eez_crossings = sum(abs(diff(as.numeric(in_eez))), na.rm = TRUE),
  mpa_crossings = sum(abs(diff(as.numeric(in_mpa))), na.rm = TRUE)
), by = mmsi]

# ============================================================
# 8) AIS disabling summaries
# ============================================================
ais_disabling_dt <- as.data.table(ais_disabling)

disabling_summary <- ais_disabling_dt[, .(
  n_disabling_events = .N,
  total_disable_hours = sum(gap_hours, na.rm = TRUE),
  max_disable_hours   = max(gap_hours, na.rm = TRUE)
), by = mmsi]

# ============================================================
# 9) Combine all vessel features
# ============================================================
message("Combining all vessel-level features...")

vessel_features_all <- Reduce(function(x, y) merge(x, y, by = "mmsi", all = TRUE), list(
  vessel_basic,
  vessel_crossings,
  disabling_summary,
  fishing_vessels_metadata
))

# Replace NAs
num_cols <- names(vessel_features_all)[sapply(vessel_features_all, is.numeric)]
vessel_features_all[, (num_cols) := lapply(.SD, function(x) fifelse(is.na(x), 0, x)), .SDcols = num_cols]

# Add known IUU label
vessel_features_all$is_known_iuu <- vessel_features_all$mmsi %in% as.character(iuu_list$MMSI)

# ============================================================
# 10) Save output
# ============================================================
save(vessel_features_all, file = "data/vessel_features_all.RData")
fwrite(vessel_features_all, "data/vessel_features_all.csv")

message("DONE. Built vessel_features_all with ", nrow(vessel_features_all), " vessels.")
