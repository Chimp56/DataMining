iuu_list <- readxl::read_xls(path = "data/IUUVessels/IUUList-20250915.xls", sheet = 2)
ais_disabling <- read.csv("data/AISDisablingEvents/ais_disabling_events.csv")

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


# > ais_disabling
# # A tibble: 55,368 × 15
# gap_id    mmsi vessel_class flag  vessel_length_m vessel_tonnage_gt gap_start_timestamp gap_start_lat gap_start_lon
# <chr>    <dbl> <chr>        <chr>           <dbl>             <dbl> <dttm>                      <dbl>         <dbl>
#   1 40072d… 1.11e8 other        NA               32.1             140.  2018-03-22 08:59:22          11.8         -21.8
# 2 52dcbd… 1.50e8 other        CHN              55.0             904.  2019-01-31 04:09:19         -45.9         -60.6
# 3 22b6d4… 2.04e8 other        PRT              15.4              40.9 2018-05-27 04:47:20          37.8         -29.4
# 4 1abe46… 2.04e8 other        PRT              20                77.3 2019-06-21 12:17:01          32.2         -18.0
# 5 72d047… 2.04e8 other        PRT              20                87.4 2017-07-02 13:13:08          39.4         -29.2
# 6 87d873… 2.04e8 other        PRT              25.4             154   2017-12-10 20:05:37          38.7         -30.0
# 7 48d681… 2.04e8 other        PRT              24               147.  2018-03-19 01:52:26          24.8         -16.4
# 8 4fb88a… 2.05e8 other        PRT              28.0             215   2017-08-15 22:20:47          37.7         -29.5
# 9 c2270a… 2.24e8 other        ESP              33               162   2019-07-05 18:47:46          31.7         -17.5
# 10 a1f256… 2.24e8 other        ESP              28.2             176   2018-09-21 06:37:43          52.9         -12.4
# # ℹ 55,358 more rows
# # ℹ 6 more variables: gap_start_distance_from_shore_m <dbl>, gap_end_timestamp <dttm>, gap_end_lat <dbl>,
# #   gap_end_lon <dbl>, gap_end_distance_from_shore_m <dbl>, gap_hours <dbl>
# # ℹ Use `print(n = ...)` to see more rows


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
