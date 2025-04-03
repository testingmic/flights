<?php
require_once "classes/Flight.php";

header('Content-Type: application/json');

// Rate limiting
$rateLimitFile = __DIR__ . '/../cache/rate_limit.txt';
$rateLimitWindow = 60; // 1 minute
$maxRequests = 10;

if (!is_dir(dirname($rateLimitFile))) {
    mkdir(dirname($rateLimitFile), 0755, true);
}

// Check rate limit
if (file_exists($rateLimitFile)) {
    $rateData = json_decode(file_get_contents($rateLimitFile), true);
    if ($rateData['timestamp'] > time() - $rateLimitWindow) {
        if ($rateData['count'] >= $maxRequests) {
            http_response_code(429);
            echo json_encode([
                "status" => "error",
                "message" => "Too many requests. Please try again later."
            ]);
            exit;
        }
        $rateData['count']++;
    } else {
        $rateData = ['timestamp' => time(), 'count' => 1];
    }
} else {
    $rateData = ['timestamp' => time(), 'count' => 1];
}

file_put_contents($rateLimitFile, json_encode($rateData));

try {
    $url = "https://opensky-network.org/api/states/all";
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'header' => "User-Agent: FlightTracker/1.0\r\n"
        ]
    ]);

    $response = file_get_contents($url, false, $context);
    
    if ($response === false) {
        throw new Exception("Failed to fetch data from OpenSky Network");
    }

    $data = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON response from OpenSky Network");
    }

    $tableStructure = "CREATE TABLE flights (
        icao24 VARCHAR(10) NOT NULL,
        callsign VARCHAR(10),
        origin_country VARCHAR(50),
        time_position BIGINT,
        last_contact TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        longitude VARCHAR(255),
        latitude VARCHAR(255),
        baro_altitude VARCHAR(255),
        on_ground VARCHAR(10),
        velocity VARCHAR(255),
        true_track VARCHAR(255),
        vertical_rate VARCHAR(255),
        sensors VARCHAR(255),
        geo_altitude VARCHAR(255),
        squawk VARCHAR(10),
        spi VARCHAR(10),
        position_source INT,
        category INT
    );";
    

    $flights = [];
    if (isset($data['states']) && is_array($data['states'])) {
        foreach ($data['states'] as $state) {
            // Only process if we have valid longitude and latitude
            if (isset($state[5], $state[6]) && is_numeric($state[5]) && is_numeric($state[6])) {
                $flights[] = [
                    'icao24' => $state[0] ?? '',                      // Index 0: ICAO24 address
                    'callsign' => isset($state[1]) ? trim($state[1]) : '',  // Index 1: Callsign
                    'origin_country' => $state[2] ?? '',              // Index 2: Origin country
                    'time_position' => $state[3] ?? null,             // Index 3: Time position
                    'longitude' => (float)$state[5],                  // Index 5: Longitude
                    'latitude' => (float)$state[6],                   // Index 6: Latitude
                    'baro_altitude' => $state[7] ?? null,             // Index 7: Barometric altitude
                    'on_ground' => $state[8] ?? '0',                  // Index 8: On ground status
                    'velocity' => $state[9] ?? null,                  // Index 9: Velocity
                    'true_track' => $state[10] ?? null,               // Index 10: True track
                    'vertical_rate' => $state[11] ?? null,            // Index 11: Vertical rate
                    'sensors' => isset($state[12]) ? json_encode($state[12]) : null,  // Index 12: Sensors
                    'geo_altitude' => $state[13] ?? null,             // Index 13: Geometric altitude
                    'squawk' => $state[14] ?? null,                   // Index 14: Squawk
                    'spi' => $state[15] ?? '0',                       // Index 15: Special purpose indicator
                    'position_source' => $state[16] ?? 0,             // Index 16: Position source
                    'category' => isset($state[17]) ? (int)$state[17] : null  // Index 17: Category (if available)
                ];
            }
        }
    }

    if (empty($flights)) {
        throw new Exception("No valid flight data received");
    }

    $flightObj = new Flight();
    if ($flightObj->saveFlightData($flights)) {
        echo json_encode([
            "status" => "success",
            "message" => count($flights) . " flights updated",
            "timestamp" => time()
        ]);
    } else {
        throw new Exception("Failed to save flight data");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
?>