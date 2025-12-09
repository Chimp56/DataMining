# do iuu vessels diable ais near the same areas?

library(ggplot2)
library(dplyr)

# start lat lon
ggplot(ais_disabling, aes(x = ais_disabling$gap_start_lon, y = ais_disabling$gap_start_lat)) +
  geom_point(alpha = 0.1) +
  theme_minimal() +
  labs(title = "AIS Disabling Events of Vessels",
       x = "Longitude",
       y = "Latitude")

ggplot(iuu_ais_disabling, aes(x = gap_start_lon, y = gap_start_lat)) +
  geom_point(alpha = 0.5, color = "red") +
  theme_minimal() +
  labs(title = "AIS Disabling Events of IUU Vessels",
       x = "Longitude",
       y = "Latitude")

# end lat lon
ggplot(ais_disabling, aes(x = ais_disabling$gap_end_lon, y = ais_disabling$gap_end_lat)) +
  geom_point(alpha = 0.1) +
  theme_minimal() +
  labs(title = "AIS Disabling Events of Vessels (End Locations)",
       x = "Longitude",
       y = "Latitude")

ggplot(iuu_ais_disabling, aes(x = gap_end_lon, y = gap_end_lat)) +
  geom_point(alpha = 0.5, color = "red") +
  theme_minimal() +
  labs(title = "AIS Disabling Events of IUU Vessels (End Locations)",
       x = "Longitude",
       y = "Latitude")

# histogram of gap duration
ggplot(ais_disabling, aes(x = gap_hours)) +
  geom_histogram(bins = 50, fill = "blue", alpha = 0.5) +
  theme_minimal() +
  labs(title = "Histogram of AIS Disabling Event Durations",
       x = "Duration (hours)",
       y = "Count")

ggplot(iuu_ais_disabling, aes(x = gap_hours)) +
  geom_histogram(bins = 50, fill = "red", alpha = 0.5) +
  theme_minimal() +
  labs(title = "Histogram of AIS Disabling Event Durations for IUU Vessels",
       x = "Duration (hours)",
       y = "Count")

summary(ais_disabling$gap_hours)
summary(iuu_ais_disabling$gap_hours)

# compare box plots
boxplot(ais_disabling$gap_hours, main = "Boxplot of AIS Disabling Event Durations", ylab = "Duration (hours)")
boxplot(iuu_ais_disabling$gap_hours, main = "Boxplot of AIS Disabling Event Durations for IUU Vessels", ylab = "Duration (hours)")

# remove outliers using iqr for better visualization
Q1_ais <- quantile(ais_disabling$gap_hours, 0.25, na.rm = TRUE)
Q3_ais <- quantile(ais_disabling$gap_hours, 0.75
, na.rm = TRUE)
IQR_ais <- Q3_ais - Q1_ais
ais_disabling_filtered <- ais_disabling %>%
  filter(gap_hours >= (Q1_ais - 1.5 * IQR_ais) & gap_hours <= (Q3_ais + 1.5 * IQR_ais))

Q1_iuu <- quantile(iuu_ais_disabling$gap_hours, 0.25, na.rm = TRUE)
Q3_iuu <- quantile(iuu_ais_disabling$gap_hours, 0.75, na.rm = TRUE)
IQR_iuu <- Q3_iuu - Q1_iuu
iuu_ais_disabling_filtered <- iuu_ais_disabling %>%
  filter(gap_hours >= (Q1_iuu - 1.5 * IQR_iuu) & gap_hours <= (Q3_iuu + 1.5 * IQR_iuu))

boxplot(ais_disabling_filtered$gap_hours, main = "Boxplot of AIS Disabling Event Durations (Filtered)", ylab = "Duration (hours)")
boxplot(iuu_ais_disabling_filtered$gap_hours, main = "Boxplot of AIS Disabling Event Durations for IUU Vessels (Filtered)", ylab = "Duration")


summary(ais_disabling)
summary(iuu_ais_disabling)

# explore by flag

ggplot(ais_disabling, aes(x = flag)) +
  geom_bar(fill = "blue", alpha = 0.5) +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 90, hjust = 1)) +
  labs(title = "AIS Disabling Events by Flag",
       x = "Flag",
       y = "Count")

ggplot(iuu_ais_disabling, aes(x = flag)) +
  geom_bar(fill = "red", alpha = 0.5) +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 90, hjust = 1)) +
  labs(title = "AIS Disabling Events of IUU Vessels by Flag",
       x = "Flag",
       y = "Count")

ggplot(ais_disabling_filtered, aes(x = flag)) +
  geom_bar(fill = "blue", alpha = 0.5) +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 90, hjust = 1)) +
  labs(title = "AIS Disabling Events by Flag (Filtered)",
       x = "Flag",
       y = "Count")

ggplot(iuu_ais_disabling_filtered, aes(x = flag)) +
  geom_bar(fill = "red", alpha = 0.5) +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 90, hjust = 1)) +
  labs(title = "AIS Disabling Events of IUU Vessels by Flag (Filtered)",
       x = "Flag",
       y = "Count")

