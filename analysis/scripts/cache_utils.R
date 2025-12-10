# Cache Utilities for R API
# Provides file-based caching for expensive computations (hotspots, predictions)

# Find cache directory
get_cache_dir <- function() {
  candidates <- c(
    "data/cache",
    file.path(getwd(), "data", "cache"),
    file.path(dirname(getwd()), "data", "cache"),
    "E:/Quantara Drive/DataMining/analysis/data/cache"
  )
  
  for (candidate in candidates) {
    if (dir.exists(candidate)) {
      return(normalizePath(candidate))
    }
  }
  
  # Create cache directory if it doesn't exist
  cache_dir <- "data/cache"
  if (!dir.exists(cache_dir)) {
    dir.create(cache_dir, recursive = TRUE)
  }
  return(normalizePath(cache_dir))
}

# Generate cache key from parameters
make_cache_key <- function(prefix, ...) {
  params <- list(...)
  # Remove NULL values and sort for consistent keys
  params <- params[!sapply(params, is.null)]
  params <- params[order(names(params))]
  
  # Create hash-like string from parameters
  param_str <- paste(names(params), params, sep = "=", collapse = "_")
  # Sanitize for filename (remove special chars)
  param_str <- gsub("[^A-Za-z0-9_=.-]", "", param_str)
  
  paste0(prefix, "_", param_str, ".RData")
}

# Check if cache exists and is valid
cache_exists <- function(cache_key, max_age_hours = NULL) {
  cache_dir <- get_cache_dir()
  cache_path <- file.path(cache_dir, cache_key)
  
  if (!file.exists(cache_path)) {
    return(FALSE)
  }
  
  # Check age if specified
  if (!is.null(max_age_hours)) {
    file_age <- as.numeric(difftime(Sys.time(), file.mtime(cache_path), units = "hours"))
    if (file_age > max_age_hours) {
      return(FALSE)  # Cache expired
    }
  }
  
  return(TRUE)
}

# Load from cache
load_cache <- function(cache_key) {
  cache_dir <- get_cache_dir()
  cache_path <- file.path(cache_dir, cache_key)
  
  if (!file.exists(cache_path)) {
    return(NULL)
  }
  
  tryCatch({
    env <- new.env()
    load(cache_path, envir = env)
    # Return all objects from the environment as a list
    as.list(env)
  }, error = function(e) {
    message("Error loading cache: ", e$message)
    return(NULL)
  })
}

# Save to cache
save_cache <- function(cache_key, ...) {
  cache_dir <- get_cache_dir()
  if (!dir.exists(cache_dir)) {
    dir.create(cache_dir, recursive = TRUE)
  }
  
  cache_path <- file.path(cache_dir, cache_key)
  
  tryCatch({
    # Save all objects passed as arguments
    save(..., file = cache_path)
    message("Cache saved: ", cache_key)
    return(TRUE)
  }, error = function(e) {
    message("Error saving cache: ", e$message)
    return(FALSE)
  })
}

# Clear old cache files (older than max_age_hours)
clear_old_cache <- function(prefix = NULL, max_age_hours = 168) {  # Default: 1 week
  cache_dir <- get_cache_dir()
  if (!dir.exists(cache_dir)) {
    return(0)
  }
  
  files <- list.files(cache_dir, pattern = if (!is.null(prefix)) paste0("^", prefix) else ".*", 
                      full.names = TRUE)
  
  deleted <- 0
  for (file in files) {
    file_age <- as.numeric(difftime(Sys.time(), file.mtime(file), units = "hours"))
    if (file_age > max_age_hours) {
      file.remove(file)
      deleted <- deleted + 1
    }
  }
  
  return(deleted)
}

# Get cache info (size, count, etc.)
get_cache_info <- function(prefix = NULL) {
  cache_dir <- get_cache_dir()
  if (!dir.exists(cache_dir)) {
    return(list(count = 0, size_mb = 0, files = list()))
  }
  
  pattern <- if (!is.null(prefix)) paste0("^", prefix) else ".*"
  files <- list.files(cache_dir, pattern = pattern, full.names = TRUE)
  
  if (length(files) == 0) {
    return(list(count = 0, size_mb = 0, files = list()))
  }
  
  file_sizes <- file.info(files)$size
  total_size_mb <- sum(file_sizes, na.rm = TRUE) / (1024 * 1024)
  
  file_info <- lapply(files, function(f) {
    list(
      name = basename(f),
      size_mb = file.info(f)$size / (1024 * 1024),
      age_hours = as.numeric(difftime(Sys.time(), file.mtime(f), units = "hours"))
    )
  })
  
  list(
    count = length(files),
    size_mb = total_size_mb,
    files = file_info
  )
}

