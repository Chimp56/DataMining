# Load required libraries
library(duckdb)
library(dplyr)
library(purrr)
library(readr)
library(DBI)

# Initialize DuckDB connection and create database file
db_path <- "data/db.duckdb"
con <- dbConnect(duckdb(), db_path)

# Function to load small reference datasets into memory
load_reference_data <- function() {
  # Load IUU vessel list (small dataset)
  iuu_list <- read_csv("data/IUUVessels/IUUList-20250915.csv") %>%
    dplyr::collect()

  # Load AIS disabling events (small dataset)
  ais_disabling <- read_csv("data/AISDisablingEvents/ais_disabling_events.csv") %>%
    dplyr::collect()

  # Load fishing vessel metadata (small dataset)
  fishing_vessels_metadata <- read_csv("data/FishingVessels/fishing-vessels-v3.csv") %>%
    dplyr::collect()

  return(list(
    iuu_list = iuu_list,
    ais_disabling = ais_disabling,
    fishing_vessels_metadata = fishing_vessels_metadata
  ))
}

# Load reference datasets
reference_data <- load_reference_data()
iuu_list <- reference_data$iuu_list
ais_disabling <- reference_data$ais_disabling
fishing_vessels_metadata <- reference_data$fishing_vessels_metadata

# Function to load CSV files into DuckDB table (streaming, no memory loading)
load_csvs_to_duckdb <- function(directory_path, table_name, pattern = "*.csv") {
  file_paths <- list.files(directory_path, pattern = pattern, full.names = TRUE)

  if (length(file_paths) == 0) {
    warning(paste("No CSV files found in", directory_path))
    return(FALSE)
  }

  # Create table from first file to establish schema
  if (length(file_paths) > 0) {
    tryCatch({
      # Use DuckDB's COPY FROM to efficiently load CSV files
      # This creates a table without loading into R memory
      dbExecute(con, paste0("CREATE OR REPLACE TABLE ", table_name, " AS
                           SELECT * FROM read_csv_auto('", file_paths[1], "')"))

      # Append remaining files if any
      if (length(file_paths) > 1) {
        for (file_path in file_paths[-1]) {
          dbExecute(con, paste0("INSERT INTO ", table_name, "
                               SELECT * FROM read_csv_auto('", file_path, "')"))
        }
      }

      cat("Loaded", length(file_paths), "CSV files into table", table_name, "\n")
      return(TRUE)
    }, error = function(e) {
      warning(paste("Error loading CSV files into table", table_name, ":", e$message))
      return(FALSE)
    })
  }

  return(FALSE)
}

# Function to get table info from DuckDB
get_table_info <- function(table_name) {
  if (dbExistsTable(con, table_name)) {
    row_count <- dbGetQuery(con, paste0("SELECT COUNT(*) as count FROM ", table_name))$count
    col_info <- dbGetQuery(con, paste0("DESCRIBE ", table_name))
    return(list(
      row_count = row_count,
      columns = col_info
    ))
  }
  return(NULL)
}

# Function to load data for multiple years into DuckDB tables
load_yearly_data_to_duckdb <- function(data_type, years) {
  base_path <- "data/FishingVessels/"

  for (year in years) {
    if (data_type == "fleet_daily") {
      dir_path <- paste0(base_path, "fleet-daily-csvs-100-v3-", year, "/")
      table_name <- paste0("fleet_daily_", year)
    } else if (data_type == "fleet_monthly") {
      dir_path <- paste0(base_path, "fleet-monthly-csvs-10-v3-", year, "/")
      table_name <- paste0("fleet_monthly_", year)
    } else if (data_type == "mmsi_daily") {
      dir_path <- paste0(base_path, "mmsi-daily-csvs-10-v3-", year, "/")
      table_name <- paste0("mmsi_daily_", year)
    } else {
      stop("Invalid data_type. Use 'fleet_daily', 'fleet_monthly', or 'mmsi_daily'")
    }

    if (dir.exists(dir_path)) {
      success <- load_csvs_to_duckdb(dir_path, table_name)
      if (success) {
        # This will be in preprocessing later
        # Add year column to the table
        # dbExecute(con, paste0("ALTER TABLE ", table_name, " ADD COLUMN year INTEGER"))
        # dbExecute(con, paste0("UPDATE ", table_name, " SET year = ", year))

        # Get row count
        info <- get_table_info(table_name)
        if (!is.null(info)) {
          cat("Loaded", data_type, "for year", year, ":", info$row_count, "records\n")
        }
      }
    } else {
      cat("Directory not found:", dir_path, "\n")
    }
  }
}

# Function to create combined views for easier querying
create_combined_views <- function(data_types, years) {
  for (data_type in data_types) {
    view_name <- paste0(data_type, "_combined")

    # Create SQL to combine all year tables
    year_tables <- paste0(data_type, "_", years)
    existing_tables <- year_tables[year_tables %in% dbListTables(con)]

    if (length(existing_tables) > 0) {
      union_sql <- paste0("CREATE OR REPLACE VIEW ", view_name, " AS ",
                         paste0("SELECT * FROM ", existing_tables, collapse = " UNION ALL "))

      dbExecute(con, union_sql)
      cat("Created combined view:", view_name, "\n")
    }
  }
}

# Years of interest
years <- 2020:2024
data_types <- c("fleet_monthly", "mmsi_daily")

# Load data into DuckDB tables (no memory loading)
cat("\n=== LOADING DATA INTO DUCKDB ===\n")
for (data_type in data_types) {
  cat("Loading", data_type, "data...\n")
  load_yearly_data_to_duckdb(data_type, years)
}

# Create combined views for easier querying
cat("\n=== CREATING COMBINED VIEWS ===\n")
create_combined_views(data_types, years)

# Print summary of loaded data
cat("\n=== DATA LOADING SUMMARY ===\n")
cat("IUU vessels:", nrow(iuu_list), "records\n")
cat("AIS disabling events:", nrow(ais_disabling), "records\n")
cat("Fishing vessel metadata:", nrow(fishing_vessels_metadata), "records\n")

# Get table information from DuckDB
tables <- dbListTables(con)
for (table in tables) {
  info <- get_table_info(table)
  if (!is.null(info)) {
    cat("Table", table, ":", info$row_count, "records\n")
  }
}

# Quick data exploration using lazy evaluation
cat("\n=== DATA EXPLORATION (LAZY EVALUATION) ===\n")

# Create lazy connections for data exploration
if ("fleet_daily_2020" %in% tables) {
  fleet_daily_lazy <- tbl(con, "fleet_daily_2020")
  cat("Fleet daily 2020 columns:", paste(colnames(fleet_daily_lazy), collapse = ", "), "\n")
  cat("Fleet daily 2020 preview:\n")
  print(head(fleet_daily_lazy, 5))
}

if ("fleet_monthly_2020" %in% tables) {
  fleet_monthly_lazy <- tbl(con, "fleet_monthly_2020")
  cat("Fleet monthly 2020 columns:", paste(colnames(fleet_monthly_lazy), collapse = ", "), "\n")
  cat("Fleet monthly 2020 preview:\n")
  print(head(fleet_monthly_lazy, 5))
}

if ("mmsi_daily_2020" %in% tables) {
  mmsi_daily_lazy <- tbl(con, "mmsi_daily_2020")
  cat("MMSI daily 2020 columns:", paste(colnames(mmsi_daily_lazy), collapse = ", "), "\n")
  cat("MMSI daily 2020 preview:\n")
  print(head(mmsi_daily_lazy, 5))
}

# Query functions for working with large datasets
query_data <- function(sql_query, collect = FALSE, limit = NULL) {
  if (!is.null(limit)) {
    sql_query <- paste0("(", sql_query, ") LIMIT ", limit)
  }

  if (collect) {
    # Collect results into R memory
    return(dbGetQuery(con, sql_query))
  } else {
    # Return lazy query object
    return(tbl(con, sql(sql_query)))
  }
}

# Function to get sample data for analysis
get_sample_data <- function(table_name, sample_size = 10000, where_clause = NULL) {
  sql <- paste0("SELECT * FROM ", table_name)

  if (!is.null(where_clause)) {
    sql <- paste0(sql, " WHERE ", where_clause)
  }

  sql <- paste0(sql, " USING SAMPLE ", sample_size, " ROWS")

  return(query_data(sql, collect = TRUE))
}

# Function to perform aggregations without loading full data
aggregate_data <- function(table_name, group_by_cols, agg_functions, where_clause = NULL) {
  sql <- paste0("SELECT ",
                paste(group_by_cols, collapse = ", "), ", ",
                paste(agg_functions, collapse = ", "),
                " FROM ", table_name)

  if (!is.null(where_clause)) {
    sql <- paste0(sql, " WHERE ", where_clause)
  }

  sql <- paste0(sql, " GROUP BY ", paste(group_by_cols, collapse = ", "))

  return(query_data(sql, collect = TRUE))
}

# Function to close connection and cleanup
cleanup_duckdb <- function() {
  if (exists("con") && !is.null(con)) {
    dbDisconnect(con, shutdown = TRUE)
    cat("DuckDB connection closed and database saved to:", db_path, "\n")
  }
}

# Register cleanup function to be called on exit
on.exit(cleanup_duckdb())

cat("\n=== DUCKDB SETUP COMPLETE ===\n")
cat("Database file:", db_path, "\n")
cat("Available tables:", paste(dbListTables(con), collapse = ", "), "\n")
cat("\nUse query_data() function to execute SQL queries\n")
cat("Use get_sample_data() function to get sample data for analysis\n")
cat("Use aggregate_data() function for memory-efficient aggregations\n")
cat("Database will be automatically saved when script ends\n")


# load all mmsi daily into memory

mmsi_daily_2020 <- tbl(con, "mmsi_daily_2020") %>%
  collect()
mmsi_daily_2021 <- tbl(con, "mmsi_daily_2021") %>%
  collect()
mmsi_daily_2022 <- tbl(con, "mmsi_daily_2022") %>%
  collect()
mmsi_daily_2023 <- tbl(con, "mmsi_daily_2023") %>%
  collect()
mmsi_daily_2024 <- tbl(con, "mmsi_daily_2024") %>%
  collect()

mmsi_daily <- bind_rows(mmsi_daily_2020, mmsi_daily_2021, mmsi_daily_2022, mmsi_daily_2023, mmsi_daily_2024)


# delete mmsi daily tables from memory

rm(mmsi_daily_2020, mmsi_daily_2021, mmsi_daily_2022, mmsi_daily_2023, mmsi_daily_2024)




