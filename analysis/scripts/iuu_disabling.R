iuu_list <- readxl::read_xls(path = "data/IUUVessels/IUUList-20250915.xls", sheet = 2)
ais_disabling <- read.csv("data/AISDisablingEvents/ais_disabling_events.csv")

# mmsi for ais identificaiton
# IMO number (a permanent seven-digit number assigned by the International Maritime Organization)

length(iuu_list$CurrentlyListed) # 368 rows 45 columns
length(unique(iuu_list$MMSI)) # 64 unique mmsi
length(unique(iuu_list$IMO)) # 168 unique vessel IMO

length(ais_disabling) # 55368 rows 15 columns
length(unique(ais_disabling$mmsi)) # 5269 unique mmsi
length(unique(ais_disabling$Name)) # 15393 unique vessel names

iuu_disabling <- merge(ais_disabling, iuu_list, by.x = "mmsi", by.y = "MMSI", all.x = FALSE, all.y = TRUE)

length(unique(iuu_disabling$mmsi)) # 64 unique IUU vessels with AIS disabling events
length(unique(iuu_disabling$Name)) # 367 unique IUU vessel names with AIS disabling events

# mmsi with more than one name where mmsi not null
library(dplyr)
iuu_disabling %>%
  filter(!is.na(mmsi)) %>%
  group_by(mmsi) %>%
  summarize(n = n_distinct(Name)) %>%
  filter(n > 1) %>%
  nrow() # 0 mmsi with more than one name


vessel_identities <- read.csv("data/IndentitySwitching/identity_core_v20220701.csv")
length(vessel_identities$vessel_record_id) # 44300 rows 19 columns
length(unique(vessel_identities$imo)) # 19030 unique imo

# merge iuu_disabling with vessel_identities by imo
iuu_disabling_identities <- merge(iuu_disabling, vessel_identities, by.x = "IMO", by.y = "imo", all.x = TRUE, all.y = FALSE)
# 392 rows
length(unique(iuu_disabling_identities$IMO)) # 168 unique imo

# imo with more than one identity where imo not null
iuu_disabling_identities %>%
  filter(!is.na(IMO)) %>%
  group_by(IMO) %>%
  summarize(n = n_distinct(vessel_record_id)) %>%
  filter(n > 1) %>%
  nrow() # 0 imo with more than one identity
