<?php
header('Content-Type: application/json');

require_once "../classes/Flight.php";

try {
    // Validate input
    $searchTerm = trim($_GET['query'] ?? "");
    
    if (empty($searchTerm)) {
        throw new Exception("Search term cannot be empty");
    }

    // Sanitize input - remove any potentially harmful characters
    $searchTerm = preg_replace('/[^a-zA-Z0-9\s\-]/', '', $searchTerm);
    
    if (strlen($searchTerm) < 2) {
        throw new Exception("Search term must be at least 2 characters long");
    }

    $flightObj = new Flight();
    $results = $flightObj->searchFlights($searchTerm);

    if (empty($results)) {
        echo json_encode([]);
    } else {
        // Sort results alphabetically
        sort($results);
        echo json_encode($results);
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => $e->getMessage()
    ]);
}
?>
