<?php
require_once "../classes/Flight.php";
$flightObj = new Flight();
$searchTerm = $_GET['search'] ?? "";
echo json_encode($flightObj->getFlights($searchTerm));
?>
