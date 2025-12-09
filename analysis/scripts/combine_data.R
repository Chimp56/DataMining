iuu_ais_disabling <- merge(ais_disabling, iuu_list, by.x = "mmsi", by.y = "MMSI", all.x = FALSE, all.y = TRUE)

library(ggplot2)
# histogram number of disabling events per mmsi in iuu_ais_disabling
disabling_events_per_mmsi <- iuu_ais_disabling %>%
    group_by(mmsi) %>%
    filter(!is.na(mmsi)) %>%
    summarize(n = n())

# histogram disabling events per mmsi in iuu_ais_disabling
ggplot(disabling_events_per_mmsi, aes(x = n)) +
    geom_histogram(binwidth = 1) +
    theme_minimal() +
    labs(title = "Number of disabling events per mmsi in iuu_ais_disabling",
         x = "Number of disabling events",
         y = "Frequency")

# save plot
ggsave("plots/iuu_ais_disabling_histogram.png", width = 10, height = 8)

# disabling events per imo in iuu_ais_disabling
disabling_events_per_imo <- iuu_ais_disabling %>%
    group_by(IMO) %>%
    filter(!is.na(IMO)) %>%
    summarize(n = n())

# histogram disabling events per imo in iuu_ais_disabling
ggplot(disabling_events_per_imo, aes(x = n)) +
    geom_histogram(binwidth = 1) +
    theme_minimal() +
    labs(title = "Number of disabling events per imo in iuu_ais_disabling",
         x = "Number of disabling events",
         y = "Frequency")

# save plot
ggsave("plots/iuu_ais_disabling_histogram_imo.png", width = 10, height = 8)