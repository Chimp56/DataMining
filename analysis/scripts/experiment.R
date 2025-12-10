# ============================================================
# EXPERIMENT FRAMEWORK: Test different parameter combinations
# ============================================================

library(dplyr)

# Prepare data
df_all <- vessel_features_all
features_df <- prepare_feature_matrix(df_all, exclude_cols = c("mmsi", "is_known_iuu"))
X <- as.matrix(features_df)

# Define experiment parameters
ntree_values <- c(50, 100, 200, 500)  # 4 different ntree sizes
sample_size_values <- c(128, 256, 512, min(1024, nrow(X)))  # Different sample sizes
percentile_values <- c(0.95, 0.99, 0.995, 0.999)  # Different percentiles for thresholding

# Store results
experiment_results <- list()
experiment_summary <- data.frame()

message("Starting experiments with ",
        length(ntree_values), " ntree values, ",
        length(sample_size_values), " sample_size values, ",
        length(percentile_values), " percentile values")
message("Total combinations: ",
        length(ntree_values) * length(sample_size_values) * length(percentile_values))

exp_counter <- 0
total_experiments <- length(ntree_values) * length(sample_size_values) * length(percentile_values)

# Run experiments
for (ntree in ntree_values) {
  for (sample_size in sample_size_values) {
    # Ensure sample_size doesn't exceed data size
    actual_sample_size <- min(sample_size, nrow(X))

    exp_counter <- exp_counter + 1
    message(sprintf("\n[Experiment %d/%d] ntree=%d, sample_size=%d",
                    exp_counter, total_experiments, ntree, actual_sample_size))

    # Train model
    model <- iForest_train(X, ntree = ntree, sample_size = actual_sample_size, seed = 8)

    # Score all data
    scoring <- iForest_score(model, X)

    # Create output dataframe
    df_out <- data.frame(
      mmsi = df_all$mmsi,
      anomaly_score = scoring$score,
      avg_path = scoring$avg_path
    )

    # Sort by anomaly score
    df_out <- df_out[order(-df_out$anomaly_score), ]

    # Test each percentile threshold
    for (percentile in percentile_values) {
      threshold <- quantile(df_out$anomaly_score, percentile)
      suspected_iuu <- df_out[df_out$anomaly_score >= threshold, ]

      # Calculate metrics
      n_suspected <- nrow(suspected_iuu)
      pct_suspected <- n_suspected / nrow(df_out) * 100

      # Check if we have known IUU labels to evaluate
      if ("is_known_iuu" %in% names(df_all)) {
        # Merge with known IUU labels
        df_eval <- merge(df_out,
                        df_all[, c("mmsi", "is_known_iuu"), drop = FALSE],
                        by = "mmsi", all.x = TRUE)
        df_eval$is_known_iuu[is.na(df_eval$is_known_iuu)] <- FALSE

        # Calculate precision metrics
        suspected_with_labels <- df_eval[df_eval$anomaly_score >= threshold, ]
        true_positives <- sum(suspected_with_labels$is_known_iuu, na.rm = TRUE)
        precision <- ifelse(n_suspected > 0, true_positives / n_suspected, 0)
        recall <- ifelse(sum(df_eval$is_known_iuu, na.rm = TRUE) > 0,
                        true_positives / sum(df_eval$is_known_iuu, na.rm = TRUE), 0)
      } else {
        precision <- NA
        recall <- NA
      }

      # Store results
      result_key <- sprintf("ntree_%d_sample_%d_percentile_%.3f",
                           ntree, actual_sample_size, percentile)

      experiment_results[[result_key]] <- list(
        ntree = ntree,
        sample_size = actual_sample_size,
        percentile = percentile,
        threshold = threshold,
        n_suspected = n_suspected,
        pct_suspected = pct_suspected,
        precision = precision,
        recall = recall,
        top_scores = head(df_out, 30),
        all_scores = df_out,  # Store full score distribution for plotting
        suspected_vessels = suspected_iuu
      )

      # Add to summary
      experiment_summary <- rbind(experiment_summary, data.frame(
        ntree = ntree,
        sample_size = actual_sample_size,
        percentile = percentile,
        threshold = threshold,
        n_suspected = n_suspected,
        pct_suspected = pct_suspected,
        precision = precision,
        recall = recall,
        mean_score = mean(df_out$anomaly_score),
        median_score = median(df_out$anomaly_score),
        max_score = max(df_out$anomaly_score),
        min_score = min(df_out$anomaly_score)
      ))
    }
  }
}

# ============================================================
# RESULTS SUMMARY AND VISUALIZATION
# ============================================================

message("\n\n=== EXPERIMENT SUMMARY ===")
print(experiment_summary)

# Save results
save(experiment_results, experiment_summary, file = "data/isolation_forest_experiments.RData")
write.csv(experiment_summary, "data/isolation_forest_experiments_summary.csv", row.names = FALSE)

# Create directory for plots
plot_dir <- "data/experiment_plots"
if (!dir.exists(plot_dir)) {
  dir.create(plot_dir, recursive = TRUE)
  message("Created plot directory: ", plot_dir)
}

# Visualize score distributions for different parameter combinations
message("\n=== GENERATING AND SAVING PLOTS ===")

if (requireNamespace("ggplot2", quietly = TRUE)) {
  library(ggplot2)

  # Create plots for all parameter combinations
  plot_counter <- 0
  for (ntree in ntree_values) {
    for (sample_size in sample_size_values) {
      actual_sample_size <- min(sample_size, nrow(X))
      
      # Get full score distribution (not just top 30)
      result_key_base <- sprintf("ntree_%d_sample_%d", ntree, actual_sample_size)
      
      # Find any result with these parameters to get full df_out
      matching_keys <- grep(paste0("^", result_key_base), names(experiment_results), value = TRUE)
      if (length(matching_keys) > 0) {
        # Get full score distribution from first matching result
        df_full <- experiment_results[[matching_keys[1]]]$all_scores
        
        # Create histogram of all scores
        plot_counter <- plot_counter + 1
        
        p <- ggplot(df_full, aes(x = anomaly_score)) +
          geom_histogram(bins = 50, fill = "steelblue", alpha = 0.7, color = "black") +
          labs(title = sprintf("Anomaly Score Distribution\n(ntree=%d, sample_size=%d, n=%d)",
                              ntree, actual_sample_size, nrow(df_full)),
               x = "Anomaly Score",
               y = "Frequency") +
          theme_minimal() +
          theme(plot.title = element_text(hjust = 0.5))
        
        filename <- file.path(plot_dir, sprintf("hist_ntree_%d_sample_%d.png", 
                                                 ntree, actual_sample_size))
        ggsave(filename, plot = p, width = 8, height = 6, dpi = 300)
        message(sprintf("Saved plot %d: %s", plot_counter, filename))
      }
      
      # Create plots for each percentile threshold
      for (percentile in percentile_values) {
        result_key <- sprintf("ntree_%d_sample_%d_percentile_%.3f",
                             ntree, actual_sample_size, percentile)
        
        if (result_key %in% names(experiment_results)) {
          df_plot <- experiment_results[[result_key]]$suspected_vessels
          
          if (nrow(df_plot) > 0) {
            p2 <- ggplot(df_plot, aes(x = anomaly_score)) +
              geom_histogram(bins = 30, fill = "coral", alpha = 0.7, color = "black") +
              geom_vline(aes(xintercept = experiment_results[[result_key]]$threshold),
                        linetype = "dashed", color = "red", linewidth = 1) +
              labs(title = sprintf("Suspected Vessels (ntree=%d, sample_size=%d, percentile=%.1f%%)\nThreshold: %.4f, N=%d",
                                  ntree, actual_sample_size, percentile*100,
                                  experiment_results[[result_key]]$threshold,
                                  nrow(df_plot)),
                   x = "Anomaly Score",
                   y = "Frequency") +
              theme_minimal() +
              theme(plot.title = element_text(hjust = 0.5, size = 9))
            
            filename2 <- file.path(plot_dir, sprintf("suspected_ntree_%d_sample_%d_percentile_%.3f.png",
                                                     ntree, actual_sample_size, percentile))
            ggsave(filename2, plot = p2, width = 8, height = 6, dpi = 300)
          }
        }
      }
    }
  }
  
  # Create comparison plots showing parameter effects
  message("\n=== CREATING COMPARISON PLOTS ===")
  
  # Plot 1: Effect of ntree on mean anomaly score
  p_ntree <- ggplot(experiment_summary, aes(x = factor(ntree), y = mean_score, fill = factor(sample_size))) +
    geom_boxplot() +
    labs(title = "Effect of ntree on Mean Anomaly Score",
         x = "Number of Trees (ntree)",
         y = "Mean Anomaly Score",
         fill = "Sample Size") +
    theme_minimal() +
    theme(plot.title = element_text(hjust = 0.5))
  ggsave(file.path(plot_dir, "comparison_ntree_effect.png"), plot = p_ntree, width = 10, height = 6, dpi = 300)
  message("Saved: comparison_ntree_effect.png")
  
  # Plot 2: Effect of sample_size on mean anomaly score
  p_sample <- ggplot(experiment_summary, aes(x = factor(sample_size), y = mean_score, fill = factor(ntree))) +
    geom_boxplot() +
    labs(title = "Effect of Sample Size on Mean Anomaly Score",
         x = "Sample Size",
         y = "Mean Anomaly Score",
         fill = "Number of Trees") +
    theme_minimal() +
    theme(plot.title = element_text(hjust = 0.5))
  ggsave(file.path(plot_dir, "comparison_sample_size_effect.png"), plot = p_sample, width = 10, height = 6, dpi = 300)
  message("Saved: comparison_sample_size_effect.png")
  
  # Plot 3: Precision vs Recall (if available)
  if (!all(is.na(experiment_summary$precision))) {
    p_pr <- ggplot(experiment_summary, aes(x = recall, y = precision, 
                                          color = factor(ntree), size = factor(sample_size))) +
      geom_point(alpha = 0.7) +
      labs(title = "Precision vs Recall by Parameter Settings",
           x = "Recall",
           y = "Precision",
           color = "Number of Trees",
           size = "Sample Size") +
      theme_minimal() +
      theme(plot.title = element_text(hjust = 0.5))
    ggsave(file.path(plot_dir, "comparison_precision_recall.png"), plot = p_pr, width = 10, height = 6, dpi = 300)
    message("Saved: comparison_precision_recall.png")
  }
  
  # Plot 4: Number of suspected vessels by percentile
  p_percentile <- ggplot(experiment_summary, aes(x = factor(percentile), y = n_suspected, 
                                                 fill = factor(ntree))) +
    geom_boxplot() +
    labs(title = "Number of Suspected Vessels by Percentile Threshold",
         x = "Percentile Threshold",
         y = "Number of Suspected Vessels",
         fill = "Number of Trees") +
    theme_minimal() +
    theme(plot.title = element_text(hjust = 0.5))
  ggsave(file.path(plot_dir, "comparison_percentile_effect.png"), plot = p_percentile, width = 10, height = 6, dpi = 300)
  message("Saved: comparison_percentile_effect.png")
  
} else {
  # Fallback to base R plots - save as PNG
  message("ggplot2 not available, using base R graphics")
  
  for (ntree in ntree_values) {
    for (sample_size in sample_size_values) {
      actual_sample_size <- min(sample_size, nrow(X))
      result_key <- sprintf("ntree_%d_sample_%d_percentile_0.990",
                           ntree, actual_sample_size)

      if (result_key %in% names(experiment_results)) {
        df_plot <- experiment_results[[result_key]]$top_scores
        
        filename <- file.path(plot_dir, sprintf("hist_ntree_%d_sample_%d.png",
                                                ntree, actual_sample_size))
        png(filename, width = 800, height = 600, res = 150)
        hist(df_plot$anomaly_score,
             breaks = 50,
             main = sprintf("Anomaly Scores (ntree=%d, sample_size=%d)",
                           ntree, actual_sample_size),
             xlab = "Anomaly Score",
             col = "steelblue",
             border = "black")
        dev.off()
        message("Saved: ", filename)
      }
    }
  }
}

# Print top experiments by different metrics
message("\n=== TOP EXPERIMENTS BY PRECISION (if labels available) ===")
if (!all(is.na(experiment_summary$precision))) {
  top_precision <- experiment_summary[order(-experiment_summary$precision), ][1:10, ]
  print(top_precision[, c("ntree", "sample_size", "percentile", "precision", "recall", "n_suspected")])
}

message("\n=== TOP EXPERIMENTS BY NUMBER OF SUSPECTED VESSELS ===")
top_suspected <- experiment_summary[order(-experiment_summary$n_suspected), ][1:10, ]
print(top_suspected[, c("ntree", "sample_size", "percentile", "n_suspected", "pct_suspected")])

message("\n=== EXPERIMENTS COMPLETE ===")
message("Results saved to:")
message("  - data/isolation_forest_experiments.RData (full results)")
message("  - data/isolation_forest_experiments_summary.csv (summary table)")
message("  - data/experiment_plots/ (all plots saved as PNG files)")
message("\nPlot files include:")
message("  - Individual histograms for each parameter combination")
message("  - Suspected vessels plots for each percentile threshold")
message("  - Comparison plots showing parameter effects")



# what number of mmsi in iuu_list also in df_out (mmsi_anomaly_scores)
length(unique(mmsi_daily$mmsi))
length(unique(fishing_vessels_metadata$mmsi))
length(unique(vessel_features_all$mmsi))
length(unique(df_out$mmsi))
length(unique(iuu_list$MMSI))

# list of mmsi in iuu_list that are also in df_out
mmsi_in_iuu_list_and_df_out <- intersect(iuu_list$MMSI, df_out$mmsi)
length(mmsi_in_iuu_list_and_df_out)

# Get anomaly scores for MMSIs in iuu_list that are also in df_out
iuu_anomaly_scores <- df_out[df_out$mmsi %in% mmsi_in_iuu_list_and_df_out, ]
print(paste("Number of IUU vessels with anomaly scores:", nrow(iuu_anomaly_scores)))
print(paste("Mean anomaly score for IUU vessels:", round(mean(iuu_anomaly_scores$anomaly_score, na.rm = TRUE), 4)))
print(paste("Median anomaly score for IUU vessels:", round(median(iuu_anomaly_scores$anomaly_score, na.rm = TRUE), 4)))
print(paste("Max anomaly score for IUU vessels:", round(max(iuu_anomaly_scores$anomaly_score, na.rm = TRUE), 4)))
print(paste("Min anomaly score for IUU vessels:", round(min(iuu_anomaly_scores$anomaly_score, na.rm = TRUE), 4)))

# Show top IUU vessels by anomaly score
iuu_anomaly_scores_sorted <- iuu_anomaly_scores[order(-iuu_anomaly_scores$anomaly_score), ]
print("\nTop 20 IUU vessels by anomaly score:")
print(head(iuu_anomaly_scores_sorted[, c("mmsi", "anomaly_score", "avg_path")], 20))


