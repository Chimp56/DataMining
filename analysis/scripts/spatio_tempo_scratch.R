# =============================================
# FINAL HOTSPOT MAP — ONLY 2017–2019 (AIS events visible!)
# From-scratch DBSCAN + Full heatmap
# Runs in ~60 seconds total
# =============================================
library(duckdb); library(DBI); library(dplyr); library(glue)
library(leaflet); library(leaflet.extras); library(htmlwidgets)
library(lubridate)

# --- Paths ---
db_path <- "C:/Users/Ravi/Desktop/IUU_hotspots_data/iuu_hotspots.duckdb"
ais_path <- "C:/Users/Ravi/Desktop/IUU_hotspots_data/ais_disabling_events.csv"
out_html <- "C:/Users/Ravi/Desktop/IUU_hotspots_data/final_hotspot_2017_2019.html"

# --- Force 2017–2019 only ---
con <- dbConnect(duckdb(db_path))
ais <- read.csv(ais_path, stringsAsFactors = FALSE)
ais$ts <- ymd_hms(ais$gap_start_timestamp, tz = "UTC")
ais$year <- year(ais$ts)
ais$month <- month(ais$ts)
ais <- ais %>% filter(year >= 2017 & year <= 2019)

# --- Find month with most fishing + at least one AIS event ---
temporal <- dbGetQuery(con, "
  SELECT year, month, SUM(fishing_hours) AS hrs 
  FROM fleet_monthly_all 
  WHERE year BETWEEN 2017 AND 2019 
  GROUP BY year, month 
  ORDER BY hrs DESC
")

# Join with AIS counts
ais_counts <- ais %>% count(year, month, name = "ais_events")
temporal <- temporal %>% left_join(ais_counts, by = c("year", "month")) %>%
  replace_na(list(ais_events = 0)) %>%
  arrange(desc(hrs), desc(ais_events))

peak <- temporal[1, ]
yr <- peak$year; mo <- peak$month
cat("Selected month with AIS events:", yr, sprintf("%02d", mo), 
    "| Fishing hours:", peak$hrs, "| AIS events:", peak$ais_events, "\n")

# --- Load full fishing cells for heatmap ---
fishing_cells <- dbGetQuery(con, glue("
  SELECT (cell_ll_lat + 0.05) AS lat, 
         (cell_ll_lon + 0.05) AS lon, 
         fishing_hours
  FROM fleet_monthly_all
  WHERE year = {yr} AND month = {mo} AND fishing_hours > 0
"))

# --- Load AIS events ---
ais_month <- ais %>% filter(year == yr, month == mo)

# --- Subsample top 2% fishing cells for fast DBSCAN ---
top_thresh <- quantile(fishing_cells$fishing_hours, 0.98)
fishing_sub <- fishing_cells %>% filter(fishing_hours >= top_thresh)
cat("DBSCAN on top 2% →", nrow(fishing_sub), "points (fast!)\n")

# --- From-scratch Haversine ---
haversine <- function(lon1, lat1, lon2, lat2) {
  lon1 <- lon1 * pi/180; lat1 <- lat1 * pi/180
  lon2 <- lon2 * pi/180; lat2 <- lat2 * pi/180
  dlon <- lon2 - lon1; dlat <- lat2 - lat1
  a <- sin(dlat/2)^2 + cos(lat1) * cos(lat2) * sin(dlon/2)^2
  6371 * 2 * atan2(sqrt(a), sqrt(1 - a))
}

# --- From-scratch DBSCAN ---
dbscan_scratch <- function(df, eps_km = 200, minPts = 6) {
  n <- nrow(df); cluster <- rep(0, n); visited <- rep(FALSE, n); cid <- 0
  for (i in 1:n) {
    if (visited[i]) next
    visited[i] <- TRUE
    dists <- mapply(function(x, y) haversine(df$lon[i], df$lat[i], x, y), df$lon, df$lat)
    neigh <- which(dists <= eps_km)
    if (length(neigh) < minPts) { cluster[i] <- -1; next }
    cid <- cid + 1; cluster[i] <- cid
    k <- 1
    while (k <= length(neigh)) {
      j <- neigh[k]
      if (!visited[j]) {
        visited[j] <- TRUE
        new_dists <- mapply(function(x,y) haversine(df$lon[j], df$lat[j], x, y), df$lon, df$lat)
        new_neigh <- which(new_dists <= eps_km)
        if (length(new_neigh) >= minPts) neigh <- unique(c(neigh, new_neigh))
      }
      if (cluster[j] <= 0) cluster[j] <- cid
      k <- k + 1
    }
  }
  centers <- df %>% mutate(cluster = cluster) %>% filter(cluster > 0) %>%
    group_by(cluster) %>% summarise(lon = mean(lon), lat = mean(lat))
  list(cluster = cluster, centers = centers)
}

# Run DBSCAN
cat("Running from-scratch DBSCAN...\n")
fish_clust <- dbscan_scratch(fishing_sub %>% select(lon, lat))
fishing_sub$cluster <- fish_clust$cluster
cat("Found", max(fish_clust$cluster), "fishing hotspot clusters\n")

# AIS clusters (few points → instant)
if (nrow(ais_month) > 0) {
  ais_pts <- ais_month %>% transmute(lon = gap_start_lon, lat = gap_start_lat) %>% distinct()
  ais_clust <- dbscan_scratch(ais_pts, eps_km = 150, minPts = 3)
  ais_pts$cluster <- ais_clust$cluster
  cat("Found", max(ais_clust$cluster), "AIS disabling clusters\n")
}

# --- Build final map ---
m <- leaflet() %>% addTiles() %>% setView(20, 0, 2) %>%
  addControl(html = paste0("<b>2017–2019 Only</b><br>Year: ", yr, " Month: ", mo, 
                           "<br>Fishing cells: ", nrow(fishing_cells),
                           "<br>AIS events: ", nrow(ais_month)), position = "topleft")

# Full fishing heatmap (100% data)
m <- m %>% addHeatmap(data = fishing_cells, lng = ~lon, lat = ~lat, intensity = ~fishing_hours,
                      radius = 10, blur = 8, max = 1, gradient = c("yellow","orange","red"),
                      group = "Fishing Effort") %>%
  addLegend(pal = colorNumeric(c("yellow","red"), domain = fishing_cells$fishing_hours),
            values = fishing_cells$fishing_hours, title = "Fishing Hours")

# Fishing clusters
if (nrow(fish_clust$centers) > 0) {
  pal_f <- colorFactor("Set1", domain = 1:max(fish_clust$cluster))
  m <- m %>% addCircles(data = fishing_sub %>% filter(cluster > 0),
                        lng = ~lon, lat = ~lat, color = ~pal_f(cluster),
                        radius = 80000, fillOpacity = 0.3, stroke = FALSE,
                        group = "Fishing Hotspots")
}

# AIS heatmap + clusters
if (nrow(ais_month) > 0) {
  m <- m %>% addHeatmap(data = ais_month, lng = ~gap_start_lon, lat = ~gap_start_lat,
                        intensity = 3, radius = 12, blur = 10,
                        gradient = c("cyan","blue","purple"), group = "AIS Disabling Events")
  if (nrow(ais_clust$centers) > 0) {
    pal_a <- colorFactor("Set2", domain = 1:max(ais_clust$cluster))
    m <- m %>% addCircles(data = ais_pts %>% filter(cluster > 0),
                          lng = ~lon, lat = ~lat, color = ~pal_a(cluster),
                          radius = 60000, fillOpacity = 0.5, group = "AIS Clusters")
  }
}

m <- m %>% addLayersControl(
  overlayGroups = c("Fishing Effort", "Fishing Hotspots", "AIS Disabling Events", "AIS Clusters"),
  options = layersControlOptions(collapsed = FALSE)
)

saveWidget(m, out_html, selfcontained = TRUE)
browseURL(out_html)
cat("FINAL MAP READY — 2017–2019 ONLY WITH AIS EVENTS!\n")
dbDisconnect(con, shutdown = TRUE)