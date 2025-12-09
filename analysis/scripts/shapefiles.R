install.packages("sf")
library(sf)

# explore shape files
eez_boundaries <- st_read("data/World_EEZ_v12_20231025/eez_boundaries_v12.shp")
plot(eez_boundaries, max.plot = 32)
save(eez_boundaries, file = "data/eez_boundaries.RData")

eez_boundaries <- st_transform(eez_boundaries, crs = 4326)

# > eez_boundaries
# Simple feature collection with 2349 features and 32 fields
# Geometry type: MULTILINESTRING
# Dimension:     XY
# Bounding box:  xmin: -180 ymin: -62.78834 xmax: 180 ymax: 86.99401
# Geodetic CRS:  WGS 84
# First 10 features:
#   LINE_ID                               LINE_NAME                    LINE_TYPE MRGID_SOV1 MRGID_TER1 TERRITORY1 SOVEREIGN1
# 1     3570                Morocco - Western Sahara Unsettled median line (land)       2221       2221    Morocco    Morocco
# 2     3571 Sudan - Overlapping claim Sudan / Egypt Unsettled median line (land)       2183       2183      Sudan      Sudan
# 3      123                         Albania - Italy                       Treaty       2153       2153    Albania    Albania
# 4      124                        Belgium - France                       Treaty         14         14    Belgium    Belgium
# 5      125                        Belgium - France                       Treaty         14         14    Belgium    Belgium
# 6      126                   Belgium - Netherlands                       Treaty         14         14    Belgium    Belgium
# 7      127                   Belgium - Netherlands                       Treaty         14         14    Belgium    Belgium
# 8      128                Belgium - United Kingdom                       Treaty         14         14    Belgium    Belgium
# 9      129            Greenland (Denmark) - Canada                       Treaty       2157       2260  Greenland    Denmark
# 10     130            Greenland (Denmark) - Canada                       Treaty       2157       2260  Greenland    Denmark
# MRGID_TER2     TERRITORY2 MRGID_SOV2     SOVEREIGN2 MRGID_EEZ1                                       EEZ1 MRGID_EEZ2
# 1        8617 Western Sahara       8617 Western Sahara       8367           Moroccan Exclusive Economic Zone       8368
# 2          NA          Egypt       3868          Egypt       8355           Sudanese Exclusive Economic Zone       8490
# 3        2133          Italy       2133          Italy       5670           Albanian Exclusive Economic Zone       5682
# 4          17         France         17         France       3293            Belgian Exclusive Economic Zone       5677
# 5          17         France         17         France       3293            Belgian Exclusive Economic Zone       5677
# 6          15    Netherlands         15    Netherlands       3293            Belgian Exclusive Economic Zone       5668
# 7          15    Netherlands         15    Netherlands       3293            Belgian Exclusive Economic Zone       5668
# 8        2208 United Kingdom       2208 United Kingdom       3293            Belgian Exclusive Economic Zone       5696
# 9        2169         Canada       2169         Canada       8438 Danish Exclusive Economic Zone (Greenland)       8493
# 10       2169         Canada       2169         Canada       8438 Danish Exclusive Economic Zone (Greenland)       8493
# EEZ2
# 1  Overlapping claim Western Sahara: Western Sahara / Morocco
# 2                            Egyptian Exclusive Economic Zone
# 3                             Italian Exclusive Economic Zone
# 4                              French Exclusive Economic Zone
# 5                              French Exclusive Economic Zone
# 6                               Dutch Exclusive Economic Zone
# 7                               Dutch Exclusive Economic Zone
# 8                             British Exclusive Economic Zone
# 9                            Canadian Exclusive Economic Zone
# 10                           Canadian Exclusive Economic Zone
# SOURCE1
# 1                                                                                      Letter dated 29 January 2002 from the Under-Secretary-Generalfor Legal Affairs, the Legal Counsel, addressed to the President ofthe Security Council
# 2                                                                                              Note verbale dated 20 June 2016 from the Permanent Mission of Egypt to the United Nations addressed to the President of the Security Council
# 3                                                                                                         Agreement between Albania and Italy for the determination of the continental shelf of each of the two countries, 18 December 1992
# 4                                                                           Agreement between the Government of the French Republic and the Government of the Kingdom of Belgium on the delimitation of the territorial sea, 8 October 1990
# 5                                                                         Agreement between the Government of the French Republic and the Government of the Kingdom of Belgium on the delimitation of the continental shelf, 8 October 1990
# 6                                                                                                     Treaty between the Kingdom of the Netherlands and the Kingdom of Belgium on the Delimitation of the Territorial Sea, 18 december 1996
# 7                                                                                                   Treaty between the Kingdom of the Netherlands and the Kingdom of Belgium on the Delimitation of the Continental Shelf, 18 December 1996
# 8  Agreement between the Government of the United Kingdom of Great Britain and Northern Ireland and the Government of the Kingdom of Belgium relating to the delimitation of the continental shelf between the two countries 29 May 1991(1)
# 9                                             Agreement between the Government of the Kingdom of Denmark and the Government of Canada relating to the Delimitation of the Continental Shelf between Greenland and Canada (17 December 1973)
# 10                                            Agreement between the Government of the Kingdom of Denmark and the Government of Canada relating to the Delimitation of the Continental Shelf between Greenland and Canada (17 December 1973)
# URL1
# 1       https://www.marineregions.org/documents/N0224987.pdf
# 2       https://www.marineregions.org/documents/N1618823.pdf
# 3  https://www.marineregions.org/documents/ALB-ITA1992CS.pdf
# 4  https://www.marineregions.org/documents/FRA-BEL1990TS.PDF
# 5  https://www.marineregions.org/documents/FRA-BEL1990CS.PDF
# 6  https://www.marineregions.org/documents/NLD-BEL1996TS.PDF
# 7          https://www.marineregions.org/documents/v2051.pdf
# 8  https://www.marineregions.org/documents/GBR-BEL1991CS.PDF
# 9  https://www.marineregions.org/documents/DNK-CAN1973CS.PDF
# 10 https://www.marineregions.org/documents/DNK-CAN1973CS.PDF
# SOURCE2
# 1                                                                                                                                                               <NA>
#   2                                                                                                                                                               <NA>
#   3                                                                                                                                                               <NA>
#   4                                                   Agreement relating to the delimitation of the territorial sea (with chart). Signed at Brussels on 8 October 1990
# 5  Agreement between the Government of the French Republic and the Government of the Kingdom of Belgium on the delimitation of the continental shelf, 8 October 1990
# 6                              Treaty between the Kingdom of the Netherlands and the Kingdom of Belgium on the Delimitation of the Territorial Sea, 18 december 1996
# 7                            Treaty between the Kingdom of the Netherlands and the Kingdom of Belgium on the Delimitation of the Continental Shelf, 18 December 1996
# 8                                                                                                                                                               <NA>
#   9                                                                                                                      Canada - Greenland Continental Shelf Boundary
# 10                                                                                                                     Canada - Greenland Continental Shelf Boundary
# URL2 SOURCE3 URL3   ORIGIN   DOC_DATE MRGID_JREG JOINT_REG
# 1                                                                     <NA>    <NA> <NA>   Median 2002-01-20         NA      <NA>
#   2                                                                     <NA>    <NA> <NA>   Median 2016-06-20         NA      <NA>
#   3                                                                     <NA>    <NA> <NA> Database 1992-12-18         NA      <NA>
#   4  https://www.marineregions.org/documents/volume-1728-I-30173-English.pdf    <NA> <NA> Database 1990-10-08         NA      <NA>
#   5                        https://www.marineregions.org/documents/v1728.pdf    <NA> <NA> Database 1990-10-08         NA      <NA>
#   6                        https://www.marineregions.org/documents/v2051.pdf    <NA> <NA> Database 1996-12-18         NA      <NA>
#   7                https://www.marineregions.org/documents/NLD-BEL1996CS.PDF    <NA> <NA> Database 1996-12-18         NA      <NA>
#   8                                                                     <NA>    <NA> <NA> Database 1991-05-29         NA      <NA>
#   9                         https://www.marineregions.org/documents/ls72.jpg    <NA> <NA> Database 1973-12-17         NA      <NA>
#   10                        https://www.marineregions.org/documents/ls72.jpg    <NA> <NA> Database 1973-12-17         NA      <NA>
#   LENGTH_KM MRGID_EEZ3 EEZ3 TERRITORY3 MRGID_TER3 SOVEREIGN3 MRGID_SOV3                       geometry
# 1      51.90         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((-13.66475...
#                                                                                            2      98.18         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((36.88085 ...
#                                                                                                                                                                                       3     135.55         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((18.46194 ...
#                                                                                                                                                                                                                                                                                  4      22.28         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((2.543611 ...
#                                                                                                                                                                                                                                                                                                                                                                             5      33.81         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((2.390278 ...
#                                                                                                                                                                                                                                                                                                                                                                                                                                                                        6      28.55         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((3.364583 ...
#                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   7      52.03         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((3.081389 ...
#                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              8      41.65         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((2.238333 ...
#                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         9    1950.86         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((-57.21694...
#                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    10    699.37         NA <NA>       <NA>         NA       <NA>         NA MULTILINESTRING ((-75 76.68...

eez <- st_read("data/World_EEZ_v12_20231025/eez_v12.shp")
save(eez, file = "data/eez.RData")

# > eez
# Simple feature collection with 285 features and 31 fields
# Geometry type: MULTIPOLYGON
# Dimension:     XY
# Bounding box:  xmin: -180 ymin: -62.78834 xmax: 180 ymax: 86.99401
# Geodetic CRS:  WGS 84
# First 10 features:
#    MRGID                                                                   GEONAME MRGID_TER1          POL_TYPE MRGID_SOV1
# 1   8444                    United States Exclusive Economic Zone (American Samoa)       8670             200NM       2204
# 2   8379                               British Exclusive Economic Zone (Ascension)       8620             200NM       2208
# 3   8446                        New Zealand Exclusive Economic Zone (Cook Islands)       8672             200NM       2227
# 4   8389 Overlapping claim Falkland / Malvinas Islands: United Kingdom / Argentina       8623 Overlapping claim       2208
# 5   8440                         French Exclusive Economic Zone (French Polynesia)       8656             200NM         17
# 6   8439                                British Exclusive Economic Zone (Pitcairn)       2259             200NM       2208
# 7   8380                            British Exclusive Economic Zone (Saint Helena)       8619             200NM       2208
# 8   8445                                            Samoan Exclusive Economic Zone       8671             200NM       8671
# 9   8448                                            Tongan Exclusive Economic Zone       8674             200NM       8674
# 10  8382                        British Exclusive Economic Zone (Tristan da Cunha)       8621             200NM       2208
#                     TERRITORY1 ISO_TER1     SOVEREIGN1 MRGID_TER2 MRGID_SOV2                  TERRITORY2 ISO_TER2 SOVEREIGN2
# 1               American Samoa      ASM  United States         NA         NA                        <NA>     <NA>       <NA>
# 2                    Ascension      SHN United Kingdom         NA         NA                        <NA>     <NA>       <NA>
# 3                 Cook Islands      COK    New Zealand         NA         NA                        <NA>     <NA>       <NA>
# 4  Falkland / Malvinas Islands      FLK United Kingdom       8623       2149 Falkland / Malvinas Islands      FLK  Argentina
# 5             French Polynesia      PYF         France         NA         NA                        <NA>     <NA>       <NA>
# 6                     Pitcairn      PCN United Kingdom         NA         NA                        <NA>     <NA>       <NA>
# 7                 Saint Helena      SHN United Kingdom         NA         NA                        <NA>     <NA>       <NA>
# 8                        Samoa      WSM          Samoa         NA         NA                        <NA>     <NA>       <NA>
# 9                        Tonga      TON          Tonga         NA         NA                        <NA>     <NA>       <NA>
# 10            Tristan da Cunha      SHN United Kingdom         NA         NA                        <NA>     <NA>       <NA>
#    MRGID_TER3 MRGID_SOV3 TERRITORY3 ISO_TER3 SOVEREIGN3        X_1       Y_1 MRGID_EEZ AREA_KM2 ISO_SOV1 ISO_SOV2 ISO_SOV3 UN_SOV1
# 1          NA         NA       <NA>     <NA>       <NA> -169.06347 -13.85484      8444   405830      USA     <NA>     <NA>     840
# 2          NA         NA       <NA>     <NA>       <NA>  -14.36337  -7.94747      8379   446005      GBR     <NA>     <NA>     826
# 3          NA         NA       <NA>     <NA>       <NA> -161.30341 -15.01891      8446  1969553      NZL     <NA>     <NA>     554
# 4          NA         NA       <NA>     <NA>       <NA>  -58.32237 -51.66703      8389   550566      GBR      ARG     <NA>     826
# 5          NA         NA       <NA>     <NA>       <NA> -144.00327 -18.73634      8440  4766689      FRA     <NA>     <NA>     250
# 6          NA         NA       <NA>     <NA>       <NA> -127.42131 -24.60623      8439   842291      GBR     <NA>     <NA>     826
# 7          NA         NA       <NA>     <NA>       <NA>   -5.70869 -15.97278      8380   449215      GBR     <NA>     <NA>     826
# 8          NA         NA       <NA>     <NA>       <NA> -172.75372 -13.29687      8445   130480      WSM     <NA>     <NA>     882
# 9          NA         NA       <NA>     <NA>       <NA> -174.76586 -20.22175      8448   666052      TON     <NA>     <NA>     776
# 10         NA         NA       <NA>     <NA>       <NA>  -11.20987 -38.76190      8382   758168      GBR     <NA>     <NA>     826
#    UN_SOV2 UN_SOV3 UN_TER1 UN_TER2 UN_TER3                       geometry
# 1       NA      NA      16      NA      NA MULTIPOLYGON (((-166.6411 -...
# 2       NA      NA     654      NA      NA MULTIPOLYGON (((-10.93328 -...
# 3       NA      NA     184      NA      NA MULTIPOLYGON (((-159.2758 -...
# 4       32      NA     238     238      NA MULTIPOLYGON (((-58.54196 -...
# 5       NA      NA     258      NA      NA MULTIPOLYGON (((-135.9282 -...
# 6       NA      NA     612      NA      NA MULTIPOLYGON (((-133.4327 -...
# 7       NA      NA     654      NA      NA MULTIPOLYGON (((-2.168887 -...
# 8       NA      NA     882      NA      NA MULTIPOLYGON (((-173.7747 -...
# 9       NA      NA     776      NA      NA MULTIPOLYGON (((-171.8475 -...
# 10      NA      NA     654      NA      NA MULTIPOLYGON (((-12.29053 -...

plot(eez)

mpa0 <- st_read("data/WDPA_WDOECM_Oct2025_Public_marine_shp_0/WDPA_WDOECM_Oct2025_Public_marine_shp-polygons.shp")
mpa1 <- st_read("data/WDPA_WDOECM_Oct2025_Public_marine_shp_1/WDPA_WDOECM_Oct2025_Public_marine_shp-polygons.shp")
mpa2 <- st_read("data/WDPA_WDOECM_Oct2025_Public_marine_shp_2/WDPA_WDOECM_Oct2025_Public_marine_shp-polygons.shp")
mpa <- rbind(mpa0, mpa1, mpa2)
mpa
rm(mpa0, mpa1, mpa2)
save(mpa, file = "data/mpa.RData")

# > mpa
# Simple feature collection with 16531 features and 30 fields
# Geometry type: MULTIPOLYGON
# Dimension:     XY
# Bounding box:  xmin: -180 ymin: -85.41189 xmax: 180 ymax: 86.45371
# Geodetic CRS:  WGS 84
# First 10 features:
#    WDPAID WDPA_PID PA_DEF                                 NAME                        ORIG_NAME                      DESIG
# 1       1        1      1 Diamond Reef and Salt Fish Tail Reef                     Diamond Reef             Marine Reserve
# 2       2        2      1                        Palaster Reef                    Palaster Reef             Marine Reserve
# 3      27       27      1                            Folkstone                        Folkstone             Marine Reserve
# 4      46       46      1     Reserva Biológica Atol Das Rocas Reserva Biológica Atol Das Rocas          Reserva Biológica
# 5      57       57      1       Parque Nacional Do Cabo Orange   Parque Nacional Do Cabo Orange                     Parque
# 6      78       78      1                            RMS Rhone               Wreck of the Rhone                Marine Park
# 7      80       80      1                             West Dog                  West Dog Island              National Park
# 8      97       97      1           Archipielago Juan Fernadez      Archipiélago Juan Fernández            Parque Nacional
# 9     121      121      1          Archipielago Juan Fernández      Archipielago Juan Fernández           Reserva Biósfera
# 10    126      126      1                        Los Flamencos                    Los Flamencos Santuario de Fauna y Flora
#                       DESIG_ENG    DESIG_TYPE       IUCN_CAT       INT_CRIT MARINE   REP_M_AREA   GIS_M_AREA     REP_AREA
# 1                Marine Reserve      National             Ia Not Applicable      2   14.5724870 1.458781e+01 1.458147e+01
# 2                Marine Reserve      National             Ia Not Applicable      2    3.8291070 3.833094e+00 3.831674e+00
# 3                Marine Reserve      National             II Not Applicable      1    2.3000000 1.082191e+01 9.307778e-01
# 4            Biological Reserve      National             Ia Not Applicable      2  344.7169840 3.514267e+02 3.518702e+02
# 5                          Park      National             II Not Applicable      1 2143.2230120 2.277056e+03 6.573370e+03
# 6                   Marine Park      National             II Not Applicable      2    0.0000000 2.630339e+00 2.707469e+00
# 7                 National Park      National             II Not Applicable      1    0.0000000 1.899828e-02 1.022475e-01
# 8                 National Park      National   Not Reported Not Applicable      1    0.0000000 2.175950e+01 9.570550e+01
# 9  UNESCO-MAB Biosphere Reserve International Not Applicable Not Applicable      2    0.0000000 1.210344e+04 1.218558e+04
# 10    Fauna and Flora Sanctuary      National             Ib Not Applicable      1    0.5274404 2.337480e+01 7.052405e+01
#        GIS_AREA      NO_TAKE NO_TK_AREA     STATUS STATUS_YR                               GOV_TYPE                 OWN_TYPE
# 1  1.458781e+01          All 14.5724870 Designated      1973 Federal or national ministry or agency                    State
# 2  3.833094e+00          All  3.8291070 Designated      1973 Federal or national ministry or agency                    State
# 3  1.346180e+01          All  2.0000000 Designated      1980 Federal or national ministry or agency             Not Reported
# 4  3.518677e+02 Not Reported  0.0000000 Designated      1979        Sub-national ministry or agency             Not Reported
# 5  6.573314e+03 Not Reported  0.0000000 Designated      1980        Sub-national ministry or agency             Not Reported
# 6  2.692926e+00          All  2.7074689 Designated      1980                           Not Reported Non-profit organisations
# 7  1.016998e-01         None  0.0000000 Designated      1974                           Not Reported Non-profit organisations
# 8  9.766938e+01 Not Reported  0.0000000 Designated      1935                           Not Reported                    State
# 9  1.220795e+04 Not Reported  0.0000000 Designated      1977                           Not Reported             Not Reported
# 10 7.063703e+01          All  0.5274404 Designated      1977 Federal or national ministry or agency             Not Reported
#                                                  MANG_AUTH
# 1                                       Fisheries Division
# 2                                       Fisheries Division
# 3                   National Conservation Commission (NCC)
# 4  Instituto Chico Mendes De Conservação Da Biodiversidade
# 5  Instituto Chico Mendes De Conservação Da Biodiversidade
# 6               National Parks Trust of the Virgin Islands
# 7               National Parks Trust of the Virgin Islands
# 8                    Corporación Nacional Forestal (CONAF)
# 9                    Corporación Nacional Forestal (CONAF)
# 10                Parques Nacionales Naturales de Colombia
#                                                                                     MANG_PLAN          VERIF METADATAID      SUB_LOC
# 1                                                                                Not Reported State Verified       1807        AG-04
# 2                                                                                Not Reported State Verified       1807        AG-10
# 3                                                                                Not Reported   Not Reported       1867 Not Reported
# 4                                                                                Not Reported State Verified       1802       BRA-RN
# 5                                                                                Not Reported State Verified       1802       BRA-AP
# 6                                                                                Not Reported State Verified       1907 Not Reported
# 7                                                                                Not Reported State Verified       1907 Not Reported
# 8  http://bdrnap.mma.gob.cl/recursos/SINIA/PlandeManejo/PM_PN_Archipielago_Juan_Fernandez.pdf State Verified       1808        CL-VS
# 9                                                                                Not Reported State Verified       1808        CL-VS
# 10                                   https://runap.parquesnacionales.gov.co/area-protegida/92 State Verified       1861       CO-LAG
#    PARENT_ISO ISO3      SUPP_INFO       CONS_OBJ                       geometry
# 1         ATG  ATG Not Applicable Not Applicable MULTIPOLYGON (((-61.82494 1...
# 2         ATG  ATG Not Applicable Not Applicable MULTIPOLYGON (((-61.74007 1...
# 3         BRB  BRB Not Applicable Not Applicable MULTIPOLYGON (((-59.63212 1...
# 4         BRA  BRA Not Applicable Not Applicable MULTIPOLYGON (((-33.64137 -...
# 5         BRA  BRA Not Applicable Not Applicable MULTIPOLYGON (((-50.85381 2...
# 6         GBR  VGB Not Applicable Not Applicable MULTIPOLYGON (((-64.56774 1...
# 7         GBR  VGB Not Applicable Not Applicable MULTIPOLYGON (((-64.47137 1...
# 8         CHL  CHL Not Applicable Not Applicable MULTIPOLYGON (((-80.72931 -...
# 9         CHL  CHL Not Applicable Not Applicable MULTIPOLYGON (((-78.92205 -...
# 10        COL  COL Not Applicable Not Applicable MULTIPOLYGON (((-73.07579 1...


# Try computing is in eez or distance from eez, nationality of closest eez
vessel <- head(mmsi_daily, 1)
# Convert AIS positions to sf points
vessel_sf <- st_as_sf(vessel, coords = c("cell_ll_lon", "cell_ll_lat"), crs = 4326)
# Spatial join: adds EEZ attributes to vessels if they fall inside
vessels_in_eez <- st_join(vessel_sf, eez_boundaries, join = st_within)

print(vessels_in_eez)
# Check results
vessels_in_eez %>%
  select(mmsi, geometry)

# Calculate distance to every EEZ polygon
distances <- st_distance(vessel_sf, eez_boundaries)

# Get minimum distance per vessel (in meters)
vessel_sf$dist_to_nearest_eez_m <- apply(distances, 1, min) |> as.numeric()

# Identify the nearest EEZ polygon
nearest_index <- apply(distances, 1, which.min)
vessel_sf$nearest_eez_name <- eez_boundaries$GEONAME[nearest_index]

vessel_sf %>%
  st_drop_geometry() %>%
  select(mmsi, dist_to_nearest_eez_m, nearest_eez_name)

# write eez and mpa to csvs (drop geometry column as fwrite cannot handle list columns)
library(data.table)
fwrite(st_drop_geometry(eez), "data/eez.csv")
fwrite(st_drop_geometry(eez_boundaries), "data/eez_boundaries.csv")
fwrite(st_drop_geometry(mpa), "data/mpa.csv")
