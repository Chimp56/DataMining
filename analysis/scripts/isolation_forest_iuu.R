# Isolation Forest implemented from scratch in R

# ---------- Utilities ----------
harmonic_number <- function(n) {
  if (n <= 0) return(0)
  # H_n = 1 + 1/2 + ... + 1/n
  sum(1 / seq_len(n))
}

c_factor <- function(n) {
  # Correction factor c(n) for expected path length of unsuccessful search
  if (n <= 1) return(0)
  return(2 * harmonic_number(n - 1) - 2 * (n - 1) / n)
}

# ---------- Build isolation tree (recursive) ----------
build_iTree <- function(X, current_height = 0, height_limit = 0) {
  # X: numeric matrix or data.frame of rows = instances, cols = features
  n <- nrow(X)
  # external node conditions: n <= 1 or current_height >= height_limit or all features constant
  if (n <= 1 || current_height >= height_limit) {
    return(list(node_type = "external", size = n))
  }
  # choose a random attribute with non-zero range
  ranges <- apply(X, 2, function(col) max(col, na.rm = TRUE) - min(col, na.rm = TRUE))
  candidate_cols <- which(ranges > 0)
  if (length(candidate_cols) == 0) {
    return(list(node_type = "external", size = n))
  }
  # random attribute
  attr_idx <- sample(candidate_cols, 1)
  col_vals <- X[, attr_idx]
  min_v <- min(col_vals, na.rm = TRUE)
  max_v <- max(col_vals, na.rm = TRUE)
  # pick random split uniformly between min and max
  split_val <- runif(1, min_v, max_v)
  # partition
  left_idx <- which(col_vals < split_val)
  right_idx <- which(col_vals >= split_val)
  # handle degenerate split (all right or all left): force an internal node to be external instead
  if (length(left_idx) == 0 || length(right_idx) == 0) {
    return(list(node_type = "external", size = n))
  }
  left_tree <- build_iTree(X[left_idx, , drop = FALSE], current_height + 1, height_limit)
  right_tree <- build_iTree(X[right_idx, , drop = FALSE], current_height + 1, height_limit)
  return(list(
    node_type = "internal",
    split_attr = attr_idx,
    split_val = split_val,
    left = left_tree,
    right = right_tree
  ))
}

# ---------- Path length for one instance in one iTree ----------
path_length_single <- function(tree, x, current_height = 0) {
  # tree: node built by build_iTree
  # x: numeric vector (named or unnamed), length = ncol used in training
  if (tree$node_type == "external") {
    # return current height + c(size)
    return(current_height + c_factor(tree$size))
  } else {
    # internal node: branch according to split attribute
    attr_idx <- tree$split_attr
    split_val <- tree$split_val
    if (is.na(x[attr_idx])) {
      # if feature missing, choose average of both branches' path lengths (or choose left)
      # here we take mean of both children
      left_h <- path_length_single(tree$left, x, current_height + 1)
      right_h <- path_length_single(tree$right, x, current_height + 1)
      return((left_h + right_h) / 2)
    } else {
      if (x[attr_idx] < split_val) {
        return(path_length_single(tree$left, x, current_height + 1))
      } else {
        return(path_length_single(tree$right, x, current_height + 1))
      }
    }
  }
}

# ---------- Build forest ----------
iForest_train <- function(X, ntree = 100, sample_size = 256, seed = NULL) {
  # X: numeric matrix/data.frame (rows: instances, cols: features)
  # returns list of trees and parameters
  if (!is.null(seed)) set.seed(seed)
  n <- nrow(X)
  height_limit <- ceiling(log2(sample_size))
  forest <- vector("list", ntree)
  for (i in seq_len(ntree)) {
    # sample without replacement if possible, else with replacement
    if (n <= sample_size) {
      samp_idx <- sample(n, n, replace = FALSE)
    } else {
      samp_idx <- sample(n, sample_size, replace = FALSE)
    }
    Xs <- as.matrix(X[samp_idx, , drop = FALSE])
    # Build tree on subsample
    forest[[i]] <- list(
      tree = build_iTree(Xs, current_height = 0, height_limit = height_limit),
      n_subsample = nrow(Xs)
    )
    # (optional) print progress
    if (i %% 20 == 0) message(sprintf("Built tree %d / %d", i, ntree))
  }
  return(list(forest = forest, sample_size = sample_size, ntree = ntree))
}

# ---------- Score dataset (compute average path length and anomaly score) ----------
iForest_score <- function(model, X) {
  # model: output from iForest_train
  # X: numeric matrix/data.frame to score (rows correspond to instances)
  forest <- model$forest
  ntree <- model$ntree
  sample_size <- model$sample_size
  n <- nrow(X)
  Xm <- as.matrix(X)
  # For each instance, compute path length across all trees
  all_paths <- matrix(0, nrow = n, ncol = ntree)
  for (t in seq_len(ntree)) {
    tree <- forest[[t]]$tree
    # For speed, we'll loop over rows (could be vectorized but tree traversal is recursive)
    for (i in seq_len(n)) {
      all_paths[i, t] <- path_length_single(tree, Xm[i, ])
    }
  }
  avg_paths <- rowMeans(all_paths)
  c_n <- c_factor(sample_size)
  # avoid division by zero
  scores <- sapply(avg_paths, function(h) {
    if (c_n == 0) return(0.5) # fallback
    # anomaly score s = 2^{-E(h)/c(n)}
    s <- 2^(-h / c_n)
    return(s)
  })
  return(list(paths = all_paths, avg_path = avg_paths, score = scores))
}

# ---------- usage with vessel_features_all from build_data.R ----------

# load("data/vessel_features_all.RData")  # if you saved it previously

# Prepare numeric feature matrix: drop id and any non-numeric columns
prepare_feature_matrix <- function(df, exclude_cols = c("mmsi", "is_known_iuu")) {
  # Ensure plain data.frame for predictable subsetting
  df <- as.data.frame(df)
  num_flags <- sapply(df, is.numeric)
  # ensure we exclude identifiers even if numeric
  num_flags[intersect(names(df), exclude_cols)] <- FALSE
  if (!any(num_flags)) stop("No numeric features to train on.")
  mat <- as.data.frame(df[, num_flags, drop = FALSE])
  # simple imputation: replace NA with column median
  for (j in seq_len(ncol(mat))) {
    if (any(is.na(mat[[j]]))) {
      med <- median(mat[[j]], na.rm = TRUE)
      if (is.na(med)) med <- 0
      mat[[j]][is.na(mat[[j]])] <- med
    }
  }
  return(as.data.frame(mat))
}

# Run pipeline:

df_all <- vessel_features_all 
features_df <- prepare_feature_matrix(df_all, exclude_cols = c("mmsi", "is_known_iuu"))
X <- as.matrix(features_df)

# Set forest parameters
ntree <- 100
sample_size <- min(256, nrow(X))  # subsample size
model <- iForest_train(X, ntree = ntree, sample_size = sample_size, seed = 8)

scoring <- iForest_score(model, X)
df_out <- data.frame(
 mmsi = df_all$mmsi,
 anomaly_score = scoring$score,
 avg_path = scoring$avg_path
)
df_out <- df_out[order(-df_out$anomaly_score), S]

# ---- Identify top suspected IUU vessels ----
n_count <- 30
top_suspected <- vessel_risk %>%
  top_n(n_count, wt = anomaly_score) %>%
  select(mmsi, anomaly_score)

# ---- visualize distribution ----
hist(df_out$anomaly_score,
     breaks = 50,
     main = "Isolation Forest Anomaly Scores",
     xlab = "Anomaly Score")

# ---- threshold ----
threshold <- quantile(df_out$anomaly_score, 0.99)  # top 1% most anomalous
suspected_iuu <- df_out %>%
  filter(anomaly_score >= threshold)

# ---- results ----
cat("Top 30 suspected IUU vessels:\n")
print(top_suspected)

cat("\nNumber of suspected IUU vessels above 99th percentile:", nrow(suspected_iuu), "\n")

# ---- save results ----
save(df_out, file = "data/mmsi_anomaly_scores.RData")
# df_out to csv
fwrite(df_out, file = "data/mmsi_anomaly_scores.csv")
save(model, file = "data/iso_forest_model.RData")
save(scoring, file = "data/iso_forest_scoring.RData")
