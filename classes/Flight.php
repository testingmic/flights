<?php

class Flight {
    private $conn;
    private $logFile = __DIR__ . '/../logs/flight_errors.log';

    public function __construct() {
        try {
            $this->conn = new PDO(
                "mysql:host=127.0.0.1;dbname=flight_tracker", 
                "root", 
                "",
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch (PDOException $e) {
            $this->logError("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed");
        }
    }

    private function logError($message) {
        if (!is_dir(dirname($this->logFile))) {
            mkdir(dirname($this->logFile), 0755, true);
        }
        $timestamp = date('Y-m-d H:i:s');
        error_log("[$timestamp] $message\n", 3, $this->logFile);
    }

    public function saveFlightData($flights) {
        if (!is_array($flights) || empty($flights)) {
            $this->logError("Invalid flight data provided");
            return false;
        }

        try {
            $this->conn->beginTransaction();

            $query = "INSERT INTO flights (
                icao24, callsign, origin_country, time_position, last_contact,
                longitude, latitude, baro_altitude, on_ground, velocity,
                true_track, vertical_rate, sensors, geo_altitude, squawk,
                spi, position_source, category
            ) VALUES (
                :icao24, :callsign, :origin_country, :time_position, NOW(),
                :longitude, :latitude, :baro_altitude, :on_ground, :velocity,
                :true_track, :vertical_rate, :sensors, :geo_altitude, :squawk,
                :spi, :position_source, :category
            ) ON DUPLICATE KEY UPDATE 
                callsign = VALUES(callsign),
                origin_country = VALUES(origin_country),
                time_position = VALUES(time_position),
                last_contact = NOW(),
                longitude = VALUES(longitude),
                latitude = VALUES(latitude),
                baro_altitude = VALUES(baro_altitude),
                on_ground = VALUES(on_ground),
                velocity = VALUES(velocity),
                true_track = VALUES(true_track),
                vertical_rate = VALUES(vertical_rate),
                sensors = VALUES(sensors),
                geo_altitude = VALUES(geo_altitude),
                squawk = VALUES(squawk),
                spi = VALUES(spi),
                position_source = VALUES(position_source),
                category = VALUES(category)";

            $stmt = $this->conn->prepare($query);

            foreach ($flights as $flight) {
                if (!$this->validateFlightData($flight)) {
                    $this->logError("Invalid flight data: " . json_encode($flight));
                    continue;
                }

                $stmt->execute([
                    ':icao24' => $flight['icao24'],
                    ':callsign' => $flight['callsign'] ?? null,
                    ':origin_country' => $flight['origin_country'] ?? null,
                    ':time_position' => $flight['time_position'] ?? null,
                    ':longitude' => $flight['longitude'] ?? null,
                    ':latitude' => $flight['latitude'] ?? null,
                    ':baro_altitude' => $flight['baro_altitude'] ?? null,
                    ':on_ground' => $flight['on_ground'] ?? null,
                    ':velocity' => $flight['velocity'] ?? null,
                    ':true_track' => $flight['true_track'] ?? null,
                    ':vertical_rate' => $flight['vertical_rate'] ?? null,
                    ':sensors' => $flight['sensors'] ?? null,
                    ':geo_altitude' => $flight['geo_altitude'] ?? null,
                    ':squawk' => $flight['squawk'] ?? null,
                    ':spi' => $flight['spi'] ?? null,
                    ':position_source' => $flight['position_source'] ?? null,
                    ':category' => $flight['category'] ?? null
                ]);
            }

            $this->conn->commit();
            return true;
        } catch (PDOException $e) {
            $this->conn->rollBack();
            $this->logError("Error saving flight data: " . $e->getMessage());
            return false;
        }
    }

    private function validateFlightData($flight) {
        return isset($flight['icao24']) && 
               isset($flight['longitude']) && 
               isset($flight['latitude']) &&
               is_numeric($flight['longitude']) &&
               is_numeric($flight['latitude']);
    }
    
    public function getFlights($searchTerm = "") {
        try {
            $query = "SELECT • FROM flights WHERE last_contact >= NOW() - INTERVAL 30 MINUTE";
        
            if (!empty($searchTerm)) {
                $query .= " AND (callsign LIKE '%{$searchTerm}%' OR origin_country LIKE '%{$searchTerm}%')";
            }
            $stmt = $this->conn->prepare($query);
        
            $stmt->execute();
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            $this->logError("Error fetching flights: " . $e->getMessage());
            return [];
        }
    }

    public function searchFlights($searchTerm) {
        try {
            // Search in both callsign and origin_country with better matching
            $query = "SELECT • FROM flights WHERE callsign LIKE '%{$searchTerm}%' OR origin_country LIKE '%{$searchTerm}%'";
            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return array_values($results); // Reindex array
            
        } catch (PDOException $e) {
            $this->logError("Error searching flights: " . $e->getMessage());
            return [];
        }
    }

    public function __destruct() {
        $this->conn = null;
    }
}
