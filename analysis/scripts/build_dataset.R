library(dplyr)
library(tidyr)
library(data.table)
library(sf)
library(lubridate)
library(purrr)
# install isotree first
library(isotree)

load("data/fishing_vessels_metadata.RData") # one row per vessel
load("data/iuu_list.RData") # one row per vessel

# behavior data
load("data/ais_disabling.RData") # one row per disabling event
load("data/mmsi_daily.RData") # one row per vessel and date
load("data/eez_boundaries.RData") # one row per eez boundary line
load("data/eez.RData") # one row per eez
load("data/mpa.RData") # one row per marine protected area

# > names(fishing_vessels_metadata)
#  [1] "mmsi"                         "year"                         "flag_ais"
#  [4] "flag_registry"                "flag_gfw"                     "vessel_class_inferred"
#  [7] "vessel_class_inferred_score"  "vessel_class_registry"        "vessel_class_gfw"
# [10] "self_reported_fishing_vessel" "length_m_inferred"            "length_m_registry"
# [13] "length_m_gfw"                 "engine_power_kw_inferred"     "engine_power_kw_registry"
# [16] "engine_power_kw_gfw"          "tonnage_gt_inferred"          "tonnage_gt_registry"
# [19] "tonnage_gt_gfw"               "registries_listed"            "active_hours"
# [22] "fishing_hours"

# > iuu_list
# # A tibble: 368 × 45
# CurrentlyListed Name    RFMOName     IMO NNR   VesselType GearType Flag  IRCS  MMSI  GT    DWT   Length YearOfBuild
# <lgl>           <chr>   <chr>      <dbl> <chr> <chr>      <chr>    <chr> <chr> <chr> <chr> <chr> <chr>  <chr>
#   1 TRUE            LU RON… Unknown       NA NA    Fishing V… NA       NA    NA    NA    NA    NA    NA     NA
# 2 TRUE            ABDI B… Sharon 1 8692299 NA    Fishing V… Purse s… Unkn… NA    NA    143.… NA    28.780 197401
# 3 TRUE            ABISHA… NA            NA NA    NA         NA       NA    4SFX… 4170… NA    NA    NA     NA
# 4 TRUE            ABUNDA… ABUNDAN…      NA NA    NA         NA       NA    CPA … NA    NA    NA    NA     NA
# 5 TRUE            ABUNDA… ABUNDAN…      NA NA    NA         NA       NA    CPA2… NA    NA    NA    NA     NA
# 6 TRUE            ABUNDA… ABUNDAN…      NA NA    NA         NA       NA    CPA2… NA    NA    NA    NA     NA
# 7 TRUE            ABUNDA… ABUNDAN…      NA NA    Fishing V… Longline NA    CPA2… NA    NA    NA    NA     NA
# 8 TRUE            ABUNDA… ABUNDAN…      NA NA    NA         NA       NA    CPA2… NA    NA    NA    NA     NA
# 9 TRUE            ACROS … Acros N… 7379345 NA    Fishing V… NA       Hond… NA    NA    284.… 343   48.240 197403
# 10 TRUE            AKASH   NA            NA IND-… Fishing V… NA       India NA    NA    NA    NA    NA     NA
# # ℹ 358 more rows
# # ℹ 31 more variables: Depth <chr>, BuiltIn <chr>, OwnerName <chr>, OperatorName <chr>, VesselStatus <chr>,
# #   IOTC <chr>, Reason...21 <chr>, ICCAT <chr>, Reason...23 <chr>, IATTC <chr>, Reason...25 <chr>, CCAMLR <chr>,
# #   Reason...27 <chr>, WCPFC <chr>, Reason...29 <chr>, SEAFO <chr>, Reason...31 <chr>, NEAFC <chr>,
# #   Reason...33 <chr>, NAFO <chr>, Reason...35 <chr>, SPRFMO <chr>, Reason...37 <chr>, CCSBT <chr>,
# #   Reason...39 <chr>, GFCM <chr>, Reason...41 <chr>, NPFC <chr>, Reason...43 <chr>, SIOFA <chr>, Reason...45 <chr>
# # ℹ Use `print(n = ...)` to see more rows

# > names(mmsi_daily)
# [1] "date"          "cell_ll_lat"   "cell_ll_lon"   "mmsi"
# [5] "hours"         "fishing_hours"
# > names(ais_disabling)
# [1] "gap_id"                          "mmsi"
# [3] "vessel_class"                    "flag"
# [5] "vessel_length_m"                 "vessel_tonnage_gt"
# [7] "gap_start_timestamp"             "gap_start_lat"
# [9] "gap_start_lon"                   "gap_start_distance_from_shore_m"
# [11] "gap_end_timestamp"               "gap_end_lat"
# [13] "gap_end_lon"                     "gap_end_distance_from_shore_m"
# [15] "gap_hours"
# > names(fishing_vessels_metadata)
# [1] "mmsi"                         "year"
# [3] "flag_ais"                     "flag_registry"
# [5] "flag_gfw"                     "vessel_class_inferred"
# [7] "vessel_class_inferred_score"  "vessel_class_registry"
# [9] "vessel_class_gfw"             "self_reported_fishing_vessel"
# [11] "length_m_inferred"            "length_m_registry"
# [13] "length_m_gfw"                 "engine_power_kw_inferred"
# [15] "engine_power_kw_registry"     "engine_power_kw_gfw"
# [17] "tonnage_gt_inferred"          "tonnage_gt_registry"
# [19] "tonnage_gt_gfw"               "registries_listed"
# [21] "active_hours"                 "fishing_hours"
# > names(iuu_list)
# [1] "CurrentlyListed" "Name"            "RFMOName"        "IMO"
# [5] "NNR"             "VesselType"      "GearType"        "Flag"
# [9] "IRCS"            "MMSI"            "GT"              "DWT"
# [13] "Length"          "YearOfBuild"     "Depth"           "BuiltIn"
# [17] "OwnerName"       "OperatorName"    "VesselStatus"    "IOTC"
# [21] "Reason...21"     "ICCAT"           "Reason...23"     "IATTC"
# [25] "Reason...25"     "CCAMLR"          "Reason...27"     "WCPFC"
# [29] "Reason...29"     "SEAFO"           "Reason...31"     "NEAFC"
# [33] "Reason...33"     "NAFO"            "Reason...35"     "SPRFMO"
# [37] "Reason...37"     "CCSBT"           "Reason...39"     "GFCM"
# [41] "Reason...41"     "NPFC"            "Reason...43"     "SIOFA"
# [45] "Reason...45"
# > names(eez_boundaries)
# [1] "LINE_ID"    "LINE_NAME"  "LINE_TYPE"  "MRGID_SOV1" "MRGID_TER1"
# [6] "TERRITORY1" "SOVEREIGN1" "MRGID_TER2" "TERRITORY2" "MRGID_SOV2"
# [11] "SOVEREIGN2" "MRGID_EEZ1" "EEZ1"       "MRGID_EEZ2" "EEZ2"
# [16] "SOURCE1"    "URL1"       "SOURCE2"    "URL2"       "SOURCE3"
# [21] "URL3"       "ORIGIN"     "DOC_DATE"   "MRGID_JREG" "JOINT_REG"
# [26] "LENGTH_KM"  "MRGID_EEZ3" "EEZ3"       "TERRITORY3" "MRGID_TER3"
# [31] "SOVEREIGN3" "MRGID_SOV3" "geometry"
# > names(eez)
# [1] "MRGID"      "GEONAME"    "MRGID_TER1" "POL_TYPE"   "MRGID_SOV1"
# [6] "TERRITORY1" "ISO_TER1"   "SOVEREIGN1" "MRGID_TER2" "MRGID_SOV2"
# [11] "TERRITORY2" "ISO_TER2"   "SOVEREIGN2" "MRGID_TER3" "MRGID_SOV3"
# [16] "TERRITORY3" "ISO_TER3"   "SOVEREIGN3" "X_1"        "Y_1"
# [21] "MRGID_EEZ"  "AREA_KM2"   "ISO_SOV1"   "ISO_SOV2"   "ISO_SOV3"
# [26] "UN_SOV1"    "UN_SOV2"    "UN_SOV3"    "UN_TER1"    "UN_TER2"
# [31] "UN_TER3"    "geometry"
# > names(mpa)
# [1] "WDPAID"     "WDPA_PID"   "PA_DEF"     "NAME"       "ORIG_NAME"
# [6] "DESIG"      "DESIG_ENG"  "DESIG_TYPE" "IUCN_CAT"   "INT_CRIT"
# [11] "MARINE"     "REP_M_AREA" "GIS_M_AREA" "REP_AREA"   "GIS_AREA"
# [16] "NO_TAKE"    "NO_TK_AREA" "STATUS"     "STATUS_YR"  "GOV_TYPE"
# [21] "OWN_TYPE"   "MANG_AUTH"  "MANG_PLAN"  "VERIF"      "METADATAID"
# [26] "SUB_LOC"    "PARENT_ISO" "ISO3"       "SUPP_INFO"  "CONS_OBJ"
# [31] "geometry"


# merge iuu_list with fishing_vessels_metadata by mmsi
iuu_fishing_vessels <- merge(iuu_list, fishing_vessels_metadata, by.x = "MMSI", by.y = "mmsi", all.x = FALSE, all.y = TRUE)

length(unique(iuu_fishing_vessels$MMSI)) # = 192582
# iuu vessels where currently listed is TRUE
length(unique(iuu_fishing_vessels$MMSI[iuu_fishing_vessels$CurrentlyListed == TRUE])) # = 12
# num currently listed iuu vessels where currently listed is FALSE
length(unique(iuu_fishing_vessels$MMSI[iuu_fishing_vessels$CurrentlyListed == FALSE])) # = 17

# The number of vessels in fishing vessels metadata that was recorded as IUU fishing is 29 out of a total of 192582 vessels (0.015%).
# This is very sparse data. It wouldn't make sense to perform supervised classification on this dataset.


# check for outliers in mmsi_daily

setDTthreads(0)  # auto-detect # threads (data.table)
setDT(mmsi_daily)
setDT(ais_disabling)
setDT(fishing_vessels_metadata)
setDT(iuu_list)

# Ensure columns exist and cast types
mmsi_daily <- as.data.table(mmsi_daily)
ais_disabling <- as.data.table(ais_disabling)
fishing_vessels_metadata <- as.data.table(fishing_vessels_metadata)
iuu_list <- as.data.table(iuu_list)

# MMSI always should be character
if ("mmsi" %in% names(mmsi_daily)) mmsi_daily[, mmsi := as.character(mmsi)]
if ("mmsi" %in% names(ais_disabling)) ais_disabling[, mmsi := as.character(mmsi)]
if ("mmsi" %in% names(fishing_vessels_metadata)) fishing_vessels_metadata[, mmsi := as.character(mmsi)]
if ("MMSI" %in% names(iuu_list)) iuu_list[, MMSI := as.character(MMSI)]

# date column
if (!"date" %in% names(mmsi_daily)) {
  if ("timestamp" %in% names(mmsi_daily)) {
    mmsi_daily[, date := as.IDate(as.POSIXct(timestamp, tz = "UTC"))]
  } else {
    stop("mmsi_daily must contain 'date' or 'timestamp'")
  }
} else {
  mmsi_daily[, date := as.IDate(date)]
}

# rename lat/lon fields (your table uses cell_ll_lat, cell_ll_lon)
if ("cell_ll_lat" %in% names(mmsi_daily) && "cell_ll_lon" %in% names(mmsi_daily)) {
  setnames(mmsi_daily, c("cell_ll_lon", "cell_ll_lat"), c("lon", "lat"))
} else {
  if (!("lon" %in% names(mmsi_daily) && "lat" %in% names(mmsi_daily))) {
    stop("No lat/lon columns found in mmsi_daily (expected 'cell_ll_lat'/'cell_ll_lon' or 'lat'/'lon')")
  }
}

# Make sure lon/lat numeric
mmsi_daily[, lon := as.numeric(lon)]
mmsi_daily[, lat := as.numeric(lat)]

# If hours/fishing_hours present, coerce numeric
if ("hours" %in% names(mmsi_daily)) mmsi_daily[, hours := as.numeric(hours)]
if ("fishing_hours" %in% names(mmsi_daily)) mmsi_daily[, fishing_hours := as.numeric(fishing_hours)]

# ---------------------------
# 1) Reduce: compute daily centroids (vessel x date)
#    This collapses many pings per day -> 1 point/day per vessel (or you can choose weekly)
# ---------------------------
message("STEP 1: Computing daily centroids (mmsi x date)...")
# try loading "data/centroids_mmsi_daily.csv" if it exists
if (file.exists("data/centroids_mmsi_daily.csv")) {
  centroids <- fread("data/centroids_mmsi_daily.csv")
} else {
  # Keep some columns needed for feature engineering (hours, fishing_hours)
  centroids <- mmsi_daily[, .(
    n_points_day = .N,
    lon = mean(lon, na.rm = TRUE),
    lat = mean(lat, na.rm = TRUE),
    day_hours = sum(hours, na.rm = TRUE),                   # total broadcast hours that day
    day_fishing_hours = sum(fishing_hours, na.rm = TRUE)    # sum of fishing_hours indicator/duration if exists
  ), by = .(mmsi, date)]

  # Remove rows with NA centroid (no valid coords)
  centroids <- centroids[!is.na(lon) & !is.na(lat)]

  # Save intermediate
  fwrite(centroids, "data/centroids_mmsi_daily.csv")  # checkpoint to disk if needed
}




# ---------------------------
# 2) Convert centroids to sf (small) and perform spatial joins with EEZ/MPA
# ---------------------------
message("STEP 2: Spatial joins (centroids -> EEZ & MPA). Using sf now on much smaller table...")
# Ensure eeZ/mpa are sf and in correct CRS
if (!inherits(eez, "sf")) stop("eez is not an sf object")
if (!inherits(mpa, "sf")) stop("mpa is not an sf object")

# Use s2 geometry engine (faster and robust for global data)
sf::sf_use_s2(TRUE)

# convert centroids to sf (WGS84)
centroids_sf <- st_as_sf(centroids, coords = c("lon", "lat"), crs = 4326, remove = FALSE)

# Project to a common CRS for distance calculations — use EPSG:3857 (meters) for simplicity
eez_proj <- st_transform(eez, 3857)
eez_boundaries_proj <- st_transform(eez_boundaries, 3857)
mpa_proj <- st_transform(mpa, 3857)
centroids_proj <- st_transform(centroids_sf, 3857)

# 2a: point-in-polygon: EEZ membership (this will add EEZ attributes if needed)
message("  Joining centroids with EEZ polygons (point-in-polygon)...")
# Keep only necessary columns from eez to save memory
eez_keep <- names(eez_proj)[names(eez_proj) %in% c("MRGID_EEZ", "GEONAME", "ISO_SOV1", "geometry")]
eez_small <- eez_proj[, eez_keep]

# try loading "data/centroids_joined_eez.RData" if it exists
if (file.exists("data/centroids_joined_eez.RData")) {
  load("data/centroids_joined_eez.RData")
} else {
  # Use spatial join (st_intersects via st_join which uses spatial index)
  centroids_joined_eez <- st_join(centroids_proj, eez_small, left = TRUE, join = st_within)
  save(centroids_joined_eez, file = "data/centroids_joined_eez.RData")
}


# Create simple boolean flag and store EEZ id/name
centroids_joined_eez$in_eez <- !is.na(centroids_joined_eez$MRGID_EEZ)
centroids_joined_eez$eez_name <- centroids_joined_eez$GEONAME

# 2b: MPA join
message("  Joining centroids with MPA polygons (point-in-polygon)...")
# try loading "data/centroids_joined_mpa.RData" if it exists
if (file.exists("data/centroids_joined_mpa.RData")) {
  load("data/centroids_joined_mpa.RData")
} else {
  mpa_small <- mpa_proj[, names(mpa_proj) %in% c("WDPAID", "NAME", "MARINE", "geometry")]
  centroids_joined_mpa <- st_join(centroids_joined_eez, mpa_small, left = TRUE, join = st_within)
  centroids_joined_mpa$in_mpa <- !is.na(centroids_joined_mpa$WDPAID)
  centroids_joined_mpa$mpa_name <- centroids_joined_mpa$NAME

  save(centroids_joined_mpa, file = "data/centroids_joined_mpa.RData")
}

# 2c: distance to nearest EEZ polygon and to EEZ boundary
message("  Computing distance to nearest EEZ polygon and nearest EEZ boundary (meters) — using st_nearest_feature + st_distance...")
# Ensure both layers share identical CRS
if (st_crs(centroids_joined_mpa) != st_crs(eez_proj)) {
  message("  Reprojecting EEZ to match centroid CRS...")
  eez_proj <- st_transform(eez_proj, st_crs(centroids_joined_mpa))
}

# Fix invalid geometries (common in EEZ datasets)
eez_proj <- st_make_valid(eez_proj)
centroids_joined_mpa <- st_make_valid(centroids_joined_mpa)

# Check if cached distance file exists
library(nngeo)
if (file.exists("data/dist_to_eez_m.RData")) {
  message("  Loading cached distance table...")
  load("data/dist_to_eez_m.RData")    # loads dist_to_eez_m
} else {

  message("  Computing nearest EEZ polygon index...")
  nearest_idx <- st_nn(
    centroids_joined_mpa,
    eez_proj,
    k = 1,          # nearest neighbor only
    progress = TRUE,
    returnDist = FALSE
  )

  # nngeo returns a list of integer vectors, convert to integer vector
  message("Converting nearest index to integer vector...")
  nearest_idx <- vapply(nearest_idx, `[`, integer(1), 1)

  message("  Computing distances in chunks to avoid memory crash...")

  N <- nrow(centroids_joined_mpa)
  chunk_size <- 5000
  dist_to_eez_m <- numeric(N)

  for (i in seq(1, N, by = chunk_size)) {
    i_end <- min(i + chunk_size - 1, N)
    message(paste("   Processing rows", i, "to", i_end, "..."))

    dist_to_eez_m[i:i_end] <-
      as.numeric(st_distance(
        centroids_joined_mpa[i:i_end, ],
        eez_proj[nearest_idx[i:i_end], ],
        by_element = TRUE
      ))
  }

  save(dist_to_eez_m, file = "data/dist_to_eez_m.RData")
}

# nearest boundary index
# try loading "data/dist_to_boundary_m.RData" if it exists
if (file.exists("data/dist_to_boundary_m.RData")) {
  dist_to_boundary_m <- load("data/dist_to_boundary_m.RData")
} else {
  nearest_bidx <- st_nearest_feature(centroids_joined_mpa, eez_boundaries_proj)
  dist_to_boundary_m <- st_distance(centroids_joined_mpa, eez_boundaries_proj[nearest_bidx, ], by_element = TRUE)

  save(dist_to_boundary_m, file = "data/dist_to_boundary_m.RData")
}

# attach numeric distances
centroids_joined_mpa$dist_to_eez_m <- as.numeric(dist_to_eez_m)
centroids_joined_mpa$dist_to_boundary_m <- as.numeric(dist_to_boundary_m)

# Convert back to data.table for fast aggregation
centroids_dt <- as.data.table(st_drop_geometry(centroids_joined_mpa))
# ensure mmsi is character
centroids_dt[, mmsi := as.character(mmsi)]

# Save small checkpoint
fwrite(centroids_dt, "data/centroids_joined.csv")

# ---------------------------
# 3) Compute disabling-event summaries (fast)
# ---------------------------
message("STEP 3: Aggregate AIS disabling events (per-vessel summaries)...")
# ais_disabling expected to have gap_hours or gap_hours-like fields (you had gap_hours)
if (!"gap_hours" %in% names(ais_disabling)) {
  if ("gap_end_timestamp" %in% names(ais_disabling) && "gap_start_timestamp" %in% names(ais_disabling)) {
    ais_disabling[, gap_hours := as.numeric(difftime(as.POSIXct(gap_end_timestamp), as.POSIXct(gap_start_timestamp), units = "hours"))]
  } else if ("gap_hours" %in% names(ais_disabling)) {
    ais_disabling[, gap_hours := as.numeric(gap_hours)]
  } else {
    ais_disabling[, gap_hours := NA_real_]
  }
}
# Summarize
disable_summary <- ais_disabling[, .(
  n_disable_events = .N,
  total_disable_hours = sum(gap_hours, na.rm = TRUE),
  mean_disable_hours = mean(gap_hours, na.rm = TRUE),
  max_disable_hours = max(gap_hours, na.rm = TRUE)
), by = .(mmsi)]

# Replace NA with zeros for vessels without events later via join
fwrite(disable_summary, "data/disable_summary.csv")

# ---------------------------
# 4) Vessel-level feature aggregation
#    Compute features from centroids_dt (daily-level) into vessel-level features
# ---------------------------
message("STEP 4: Aggregating vessel-level features from daily centroids (fast data.table operations)...")

# Compute per-vessel aggregates in a single data.table call
vessel_features_dt <- centroids_dt[, .(
  n_days = uniqueN(date),
  n_daily_points = .N,
  mean_day_hours = mean(day_hours, na.rm = TRUE),
  mean_day_fishing_hours = mean(day_fishing_hours, na.rm = TRUE),
  pct_in_eez = mean(in_eez, na.rm = TRUE),
  pct_in_mpa = mean(in_mpa, na.rm = TRUE),
  mean_dist_to_eez_km = mean(dist_to_eez_m, na.rm = TRUE) / 1000,
  mean_dist_to_boundary_km = mean(dist_to_boundary_m, na.rm = TRUE) / 1000,
  sd_lon = sd(lon, na.rm = TRUE),
  sd_lat = sd(lat, na.rm = TRUE)
), by = mmsi]

# For EEZ crossings and MPA crossings — need temporal ordering to count flips
message("  Counting EEZ / MPA crossings per vessel...")
setorder(centroids_dt, mmsi, date)
# compute flips per vessel: sum(abs(diff(in_eez)))
crossings_dt <- centroids_dt[, .(
  eez_crossings = if (.N <= 1) 0 else sum(abs(diff(as.integer(in_eez))), na.rm = TRUE),
  mpa_crossings = if (.N <= 1) 0 else sum(abs(diff(as.integer(in_mpa))), na.rm = TRUE)
), by = mmsi]

# Path tortuosity & step distances: compute approximate total path length from centroids
message("  Computing path lengths (approx) and tortuosity from daily centroids...")
# compute distances between consecutive centroids per vessel using st_distance on centroids_proj (faster to reuse geometry)
# We'll compute by grouping per vessel and using geometry list to compute vectorised differences
# Create a helper table with geometry by mmsi
centroids_geom <- centroids_joined_mpa[, c("mmsi", "geometry")]
# convert to data.table and ensure ordering
centroids_geom_dt <- as.data.table(centroids_geom)
setkey(centroids_geom_dt, mmsi)

# Function to compute path stats for one vessel (vectorized)
compute_path_stats <- function(geoms) {
  n <- length(geoms)
  if (n <= 1) return(list(total_path_m = 0, net_disp_m = 0, avg_step_m = 0, tortuosity = NA_real_))
  # pairwise distances
  d <- as.numeric(st_distance(geoms[-1], geoms[-n], by_element = TRUE))
  total_path_m <- sum(d, na.rm = TRUE)
  net_disp_m <- as.numeric(st_distance(geoms[1], geoms[n], by_element = TRUE))
  avg_step_m <- mean(d, na.rm = TRUE)
  tort <- ifelse(net_disp_m > 0, total_path_m / net_disp_m, NA_real_)
  return(list(total_path_m = total_path_m, net_disp_m = net_disp_m, avg_step_m = avg_step_m, tortuosity = tort))
}

# We'll loop per vessel for geometry (centroids geometries are much smaller than original pings)
unique_mmsi <- unique(centroids_geom_dt$mmsi)
# Pre-allocate result lists
path_res_list <- vector("list", length(unique_mmsi))
names(path_res_list) <- unique_mmsi
# iterate with progress message
pb <- txtProgressBar(min = 0, max = length(unique_mmsi), style = 3)
for (i in seq_along(unique_mmsi)) {
  m <- unique_mmsi[i]
  geom_vec <- centroids_geom_dt[J(m), geometry]
  # compute stats
  res <- compute_path_stats(geom_vec)
  path_res_list[[i]] <- data.table(
    mmsi = m,
    total_path_m = res$total_path_m,
    net_disp_m = res$net_disp_m,
    avg_step_m = res$avg_step_m,
    path_tortuosity = res$tortuosity
  )
  if (i %% 1000 == 0) setTxtProgressBar(pb, i)
}
close(pb)
path_stats_dt <- rbindlist(path_res_list)

# join all vessel-level pieces
vessel_features_dt <- merge(vessel_features_dt, crossings_dt, by = "mmsi", all.x = TRUE)
vessel_features_dt <- merge(vessel_features_dt, path_stats_dt, by = "mmsi", all.x = TRUE)
vessel_features_dt <- merge(vessel_features_dt, disable_summary, by = "mmsi", all.x = TRUE)

# Replace NA disable with 0
vessel_features_dt[is.na(n_disable_events), n_disable_events := 0]
vessel_features_dt[is.na(total_disable_hours), total_disable_hours := 0]
vessel_features_dt[is.na(mean_disable_hours), mean_disable_hours := 0]
vessel_features_dt[is.na(max_disable_hours), max_disable_hours := 0]

# ---------------------------
# 5) Monthly delta features (optional, but useful)
# ---------------------------
message("STEP 5: Computing monthly delta features (optional but useful)...")
# Build monthly summary per vessel from centroids_dt
centroids_dt[, month := floor_date(as.IDate(date), "month")]
monthly_dt <- centroids_dt[, .(
  month_mean_dist_to_boundary_km = mean(dist_to_boundary_m, na.rm = TRUE) / 1000,
  month_mean_fishing = mean(day_fishing_hours, na.rm = TRUE),
  month_pct_in_eez = mean(in_eez, na.rm = TRUE),
  month_disable_events = 0  # placeholder: disabling events often timestamped separately
), by = .(mmsi, month)]

# For disabling events per month
if ("gap_hours" %in% names(ais_disabling)) {
  ais_disabling[, month := floor_date(as.IDate(as.IDate(gap_start_timestamp)), "month")]
  disable_monthly <- ais_disabling[, .(month_disable_events = .N, month_total_gap_hours = sum(gap_hours, na.rm = TRUE)), by = .(mmsi, month)]
  monthly_dt <- merge(monthly_dt, disable_monthly, by = c("mmsi", "month"), all.x = TRUE)
  monthly_dt[is.na(month_total_gap_hours), month_total_gap_hours := 0]
}

# Compute month-to-month deltas per vessel (mean of deltas)
monthly_delta <- monthly_dt[order(mmsi, month), .(
  avg_delta_dist_to_boundary = mean(diff(month_mean_dist_to_boundary_km), na.rm = TRUE),
  avg_delta_fishing = mean(diff(month_mean_fishing), na.rm = TRUE),
  avg_delta_pct_in_eez = mean(diff(month_pct_in_eez), na.rm = TRUE),
  avg_monthly_disable_events = mean(month_disable_events, na.rm = TRUE),
  avg_monthly_gap_hours = mean(month_total_gap_hours, na.rm = TRUE)
), by = mmsi]

# merge delta features
vessel_features_dt <- merge(vessel_features_dt, monthly_delta, by = "mmsi", all.x = TRUE)
# replace NA deltas with 0
for (col in c("avg_delta_dist_to_boundary", "avg_delta_fishing", "avg_delta_pct_in_eez", "avg_monthly_disable_events", "avg_monthly_gap_hours")) {
  if (!(col %in% names(vessel_features_dt))) next
  vessel_features_dt[is.na(get(col)), (col) := 0]
}

# ---------------------------
# 6) Add static metadata fields (optional)
# ---------------------------
message("STEP 6: Merging vessel registry metadata (flag, inferred class, length, tonnage)...")
# Select small set of metadata fields to attach (avoid huge joins)
meta_keep <- c("mmsi", "flag_ais", "flag_registry", "flag_gfw", "vessel_class_inferred", "length_m_gfw", "tonnage_gt_gfw")
meta_small <- fishing_vessels_metadata[, intersect(names(fishing_vessels_metadata), meta_keep), with = FALSE]
setnames(meta_small, old = names(meta_small)[1], new = "mmsi")  # ensure mmsi name is correct
vessel_features_dt <- merge(vessel_features_dt, meta_small, by = "mmsi", all.x = TRUE)

# Add known IUU label for validation
message("STEP 7: Adding known IUU labels (for validation only)")
known_iuu_mmsi <- unique(iuu_list$MMSI)
vessel_features_dt[, is_known_iuu := mmsi %in% known_iuu_mmsi]

# ---------------------------
# 7) Final cleaning & transformations
# ---------------------------
message("STEP 8: Final cleaning, NA handling, transformations")
# Replace inf with NA and then impute numeric NAs by median (safe)
num_cols <- names(vessel_features_dt)[sapply(vessel_features_dt, is.numeric)]
for (col in num_cols) {
  set(vessel_features_dt, i = which(is.infinite(vessel_features_dt[[col]])), j = col, value = NA)
  med <- vessel_features_dt[, median(get(col), na.rm = TRUE)]
  if (is.na(med)) med <- 0
  vessel_features_dt[is.na(get(col)), (col) := med]
}

# Save final vessel feature table to disk
message("Saving vessel_features_all.RData and CSV")
save(vessel_features_dt, file = "data/vessel_features_all.RData")
fwrite(vessel_features_dt, "data/vessel_features_all.csv")



library(dplyr)

# Drop non-feature columns (keep only numeric features)
vessel_features_numeric <- vessel_features_all %>%
  select(where(is.numeric)) %>%
  mutate(across(everything(), ~ ifelse(is.na(.), 0, .)))  # replace NA with 0 or impute as needed

# Scale numeric features (Isolation Forest works better with scaled data)
vessel_features_scaled <- scale(vessel_features_numeric)

# ---- Fit Isolation Forest ----
# Run Isolation Forest on engineered behavior features
# install.packages("isotree")
library(isotree)
set.seed(42)
iso_model <- isolation.forest(
  vessel_features_scaled,
  ntrees = 500,          # number of trees
  sample_size = 256,     # subsample size per tree
  ndim = 3,              # number of random splits per node
  ntry = 3,              # number of candidate features per split
  prob_pick_avg_gain = 0.5,
  prob_pick_pooled_gain = 0.5,
  missing_action = "impute",
  seed = 42
)

# ---- Compute anomaly scores ----
scores <- predict(iso_model, vessel_features_scaled, type = "score")

# Higher score = more anomalous
vessel_risk <- vessel_features_all %>%
  mutate(anomaly_score = scores) %>%
  arrange(desc(anomaly_score))

# ---- Identify top suspected IUU vessels ----
top_suspected <- vessel_risk %>%
  top_n(50, wt = anomaly_score) %>%
  select(mmsi, anomaly_score)

# ---- Optional: visualize distribution ----
hist(vessel_risk$anomaly_score,
     breaks = 50,
     main = "Isolation Forest Anomaly Scores",
     xlab = "Anomaly Score")

# ---- Optional: threshold ----
threshold <- quantile(vessel_risk$anomaly_score, 0.99)  # top 1% most anomalous
suspected_iuu <- vessel_risk %>%
  filter(anomaly_score >= threshold)

# ---- Results ----
cat("Top 50 suspected IUU vessels:\n")
print(top_suspected)

cat("\nNumber of suspected IUU vessels above 99th percentile:", nrow(suspected_iuu), "\n")



# compute behavior features and trains an Isolation Forest + PU hybrid to score vessels for IUU likelihood

# Metrics:
#     Precision-Recall curve
#     AUC ROC
#     F1 Score

