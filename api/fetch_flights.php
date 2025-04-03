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

    $flights = [];
    if (isset($data['states']) && is_array($data['states'])) {
        foreach ($data['states'] as $state) {
            if (isset($state[5], $state[6]) && is_numeric($state[5]) && is_numeric($state[6])) {
                $flights[] = [
                    'icao24' => $state[0] ?? '',
                    'callsign' => isset($state[1]) ? trim($state[1]) : '',
                    'origin_country' => $state[2] ?? '',
                    'longitude' => (float)$state[5],
                    'latitude' => (float)$state[6],
                    'altitude' => isset($state[7]) ? (float)$state[7] : 0,
                    'velocity' => isset($state[9]) ? (float)$state[9] : 0
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