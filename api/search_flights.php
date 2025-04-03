<?php
require_once "../classes/Flight.php";
$flightObj = new Flight();
$searchTerm = $_GET['query'] ?? "";
echo json_encode($flightObj->searchFlights($searchTerm));
?>
