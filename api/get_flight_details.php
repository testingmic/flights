<?php
header('Content-Type: application/json');

if (!isset($_GET['icao24'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No ICAO24 identifier provided']);
    exit;
}

$icao24 = $_GET['icao24'];

// Set cache time to 1 minute
$cache_time = 60; // 1 minute in seconds

// Check if we have a cached response
$cache_file = "cache/flight_path_{$icao24}.json";
if (file_exists($cache_file) && (time() - filemtime($cache_file) < $cache_time)) {
    // Return cached data
    echo file_get_contents($cache_file);
    exit;
}

// Create cache directory if it doesn't exist
if (!is_dir(dirname($cache_file))) {
    mkdir(dirname($cache_file), 0755, true);
}

// Prepare API URL
$api_url = "https://opensky-network.org/api/tracks/all";
$params = [
    'icao24' => $icao24,
    'time' => 0 // Get the most recent track
];

$url = $api_url . '?' . http_build_query($params);

try {
    $response = file_get_contents($url);
    
    if ($response === false) {
        throw new Exception("Failed to fetch data from OpenSky Network");
    }

    $data = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON response from OpenSky Network");
    }

    // Cache the response
    file_put_contents($cache_file, $response);

    // Return the data
    echo $response;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}
?> 