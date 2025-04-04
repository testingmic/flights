let map;
let markers = [];
let clusterer;
let infoWindow;
let loadingState = false;
let lastUpdateTime = null;
let searchTimeout = null;
let selectedFlight = null;
let visibleMarkers = new Set();
let updateInterval;
let allFlights = [];
let flightPath;
let trackedFlightInterval = null;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        maxZoom: 20,
        minZoom: 1,
        styles: [
            {
                "featureType": "all",
                "elementType": "geometry",
                "stylers": [{"color": "#242f3e"}]
            },
            {
                "featureType": "all",
                "elementType": "labels.text.stroke",
                "stylers": [{"lightness": -80}]
            },
            {
                "featureType": "administrative",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#746855"}]
            },
            {
                "featureType": "landscape",
                "elementType": "all",
                "stylers": [{"color": "#2b3544"}]
            },
            {
                "featureType": "poi",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#746855"}]
            },
            {
                "featureType": "poi",
                "elementType": "labels.text.stroke",
                "stylers": [{"lightness": -80}]
            },
            {
                "featureType": "poi",
                "elementType": "labels.icon",
                "stylers": [{"visibility": "off"}]
            },
            {
                "featureType": "poi.park",
                "elementType": "geometry",
                "stylers": [{"color": "#263c3f"}]
            },
            {
                "featureType": "poi.park",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#6b9a76"}]
            },
            {
                "featureType": "road",
                "elementType": "geometry",
                "stylers": [{"color": "#38414e"}]
            },
            {
                "featureType": "road",
                "elementType": "geometry.stroke",
                "stylers": [{"color": "#212a37"}]
            },
            {
                "featureType": "road",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#9ca5b3"}]
            },
            {
                "featureType": "road.highway",
                "elementType": "geometry",
                "stylers": [{"color": "#746855"}]
            },
            {
                "featureType": "road.highway",
                "elementType": "geometry.stroke",
                "stylers": [{"color": "#1f2835"}]
            },
            {
                "featureType": "road.highway",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#f3d19c"}]
            },
            {
                "featureType": "transit",
                "elementType": "geometry",
                "stylers": [{"color": "#2f3948"}]
            },
            {
                "featureType": "transit.station",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#d59563"}]
            },
            {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [{"color": "#17263c"}]
            },
            {
                "featureType": "water",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#515c6d"}]
            },
            {
                "featureType": "water",
                "elementType": "labels.text.stroke",
                "stylers": [{"lightness": -20}]
            }
        ]
    });

    // Initialize MarkerClusterer
    clusterer = new markerClusterer.MarkerClusterer({ 
        map,
        algorithm: new markerClusterer.SuperClusterAlgorithm({
            radius: 60,
            maxZoom: 8
        })
    });

    // Add custom controls
    addMapControls();
    
    infoWindow = new google.maps.InfoWindow({
        maxWidth: 300
    });
    
    // Add map event listeners for optimization
    map.addListener('idle', () => {
        updateVisibleMarkers();
    });

    // Initial load
    fetchFlights();

    // Set up periodic updates
    setupPeriodicUpdates();
}

function addMapControls() {
    // Add refresh button
    const refreshButton = document.createElement('button');
    refreshButton.className = 'map-control refresh-button';
    refreshButton.innerHTML = '🔄';
    refreshButton.title = 'Refresh Flights';
    refreshButton.onclick = () => fetchFlights();
    
    // Add zoom to world button
    const worldButton = document.createElement('button');
    worldButton.className = 'map-control world-button';
    worldButton.innerHTML = '🌍';
    worldButton.title = 'Show All Flights';
    worldButton.onclick = () => {
        map.setCenter({ lat: 20.0, lng: 0.0 });
        map.setZoom(2);
    };
    
    // Add controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'map-controls';
    controlsContainer.appendChild(refreshButton);
    controlsContainer.appendChild(worldButton);
    
    map.controls[google.maps.ControlPosition.RIGHT_TOP].push(controlsContainer);
}

function setupPeriodicUpdates() {
    // Clear existing interval if any
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    // Update flights every 30 seconds
    updateInterval = setInterval(() => {
        if (!document.hidden) {  // Only update if page is visible
            // fetchFlights(); // This will now maintain the current search filter
        }
    }, 30000);

    // Add visibility change listener
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // fetchFlights();  // This will now maintain the current search filter
        }
    });
}

function updateVisibleMarkers() {
    const bounds = map.getBounds();
    if (!bounds) return;

    visibleMarkers.clear();
    markers.forEach(marker => {
        if (bounds.contains(marker.getPosition())) {
            visibleMarkers.add(marker);
        }
    });
}

function clearMarkers() {
    if (clusterer) {
        clusterer.clearMarkers();
    }
    markers.forEach(marker => {
        marker.setMap(null);
        google.maps.event.clearInstanceListeners(marker);
    });
    markers = [];
    visibleMarkers.clear();
}

function startTrackingFlight(flight) {
    // Clear any existing interval
    if (trackedFlightInterval) {
        clearInterval(trackedFlightInterval);
    }

    // Find the marker for this flight
    const marker = markers.find(m => {
        const pos = m.getPosition();
        return pos.lat().toFixed(6) === parseFloat(flight.latitude).toFixed(6) && 
               pos.lng().toFixed(6) === parseFloat(flight.longitude).toFixed(6);
    });

    // Create new interval for this flight
    trackedFlightInterval = setInterval(() => {
        fetch(`./api/get_flight_details.php?icao24=${encodeURIComponent(flight.icao24)}`)
            .then(response => response.json())
            .then(data => {
                if (data.path && data.path.length > 0) {
                    // Update flight path
                    if (flightPath) {
                        flightPath.setMap(null);
                    }
                    
                    const path = data.path.map(point => ({
                        lat: point[1],
                        lng: point[2]
                    }));

                    flightPath = new google.maps.Polyline({
                        path: path,
                        geodesic: true,
                        strokeColor: '#FF0000',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        map: map
                    });

                    // Update marker position if it exists
                    if (marker && data.path.length > 0) {
                        const latestPoint = data.path[data.path.length - 1];
                        marker.setPosition({
                            lat: latestPoint[1],
                            lng: latestPoint[2]
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error updating flight path:', error);
            });
    }, 5000); // Update every 5 seconds
}

function stopTrackingFlight() {
    if (trackedFlightInterval) {
        clearInterval(trackedFlightInterval);
        trackedFlightInterval = null;
    }
}

function showFlightDetails(flight) {
    const modal = document.getElementById('flight-details-modal');
    
    // Remove selected class from all flight items
    document.querySelectorAll('.flight-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selected class to the clicked flight item
    const flightItems = document.querySelectorAll('.flight-item');
    const selectedItem = Array.from(flightItems).find(item => {
        const callsign = item.querySelector('.callsign').textContent.replace('✈ ', '');
        return callsign === (flight.callsign || 'Unknown');
    });
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // Update header
    modal.querySelector('.flight-callsign').textContent = flight.callsign || 'N/A';
    modal.querySelector('.flight-icao').textContent = flight.icao24;
    modal.querySelector('.flight-operator').textContent = flight.origin_country;

    // Load aircraft image with proper error handling
    const imgElement = modal.querySelector('.flight-image img');
    const defaultImage = 'https://www.flightradar24.com/static/images/aircraft-silhouettes/A320.png';
    
    // First set the default image and show loading state
    imgElement.style.opacity = '0';
    imgElement.src = defaultImage;

    // Try to load actual aircraft image if we have an ICAO24
    if (flight.icao24) {
        // Create a temporary image to test loading
        const tempImage = new Image();
        tempImage.onload = () => {
            imgElement.src = tempImage.src;
            imgElement.style.opacity = '1';
        };
        tempImage.onerror = () => {
            // If loading fails, ensure default image is shown
            imgElement.src = defaultImage;
            imgElement.style.opacity = '1';
        };
        
        // Attempt to load from aircraft database (using ICAO24)
        tempImage.src = `https://cdn.planespotters.net/media/photos/original/${flight.icao24.toLowerCase()}.jpg`;
    } else {
        // If no ICAO24, just show default image
        imgElement.src = defaultImage;
        imgElement.style.opacity = '1';
    }

    // Update Flight Status
    modal.querySelector('.flight-status').textContent = flight.on_ground === '1' ? 'On Ground' : 'In Air';
    modal.querySelector('.last-contact').textContent = new Date(flight.last_contact).toLocaleString();
    modal.querySelector('.origin-country').textContent = flight.origin_country || 'N/A';

    // Update Position Data
    modal.querySelector('.latitude').textContent = `${parseFloat(flight.latitude).toFixed(4)}°`;
    modal.querySelector('.longitude').textContent = `${parseFloat(flight.longitude).toFixed(4)}°`;
    modal.querySelector('.baro-altitude').textContent = flight.baro_altitude ? `${parseFloat(flight.baro_altitude).toFixed(1)} ft` : 'N/A';
    modal.querySelector('.geo-altitude').textContent = flight.geo_altitude ? `${parseFloat(flight.geo_altitude).toFixed(1)} ft` : 'N/A';

    // Update Flight Data
    modal.querySelector('.velocity').textContent = flight.velocity ? `${parseFloat(flight.velocity).toFixed(1)} knots` : 'N/A';
    modal.querySelector('.true-track').textContent = flight.true_track ? `${parseFloat(flight.true_track).toFixed(1)}°` : 'N/A';
    modal.querySelector('.vertical-rate').textContent = flight.vertical_rate ? `${parseFloat(flight.vertical_rate).toFixed(1)} ft/min` : 'N/A';
    modal.querySelector('.squawk').textContent = flight.squawk || 'N/A';

    // Update Technical Details
    const positionSources = {
        0: 'ADS-B',
        1: 'ASTERIX',
        2: 'MLAT',
        3: 'Other'
    };
    modal.querySelector('.position-source').textContent = positionSources[flight.position_source] || 'Unknown';
    
    const categories = {
        0: 'No information',
        1: 'No ADS-B Emitter Category Information',
        2: 'Light (< 15500 lbs)',
        3: 'Small (15500 to 75000 lbs)',
        4: 'Large (75000 to 300000 lbs)',
        5: 'High Vortex Large',
        6: 'Heavy (> 300000 lbs)',
        7: 'High Performance',
        8: 'Rotorcraft'
    };
    modal.querySelector('.category').textContent = flight.category ? categories[flight.category] : 'N/A';
    modal.querySelector('.spi').textContent = flight.spi === '1' ? 'Yes' : 'No';

    // Start tracking this flight
    startTrackingFlight(flight);

    // Show modal
    modal.classList.add('active');
}

// Modify the close modal functionality to remove the selected class
document.querySelector('.close-modal').addEventListener('click', () => {
    const modal = document.getElementById('flight-details-modal');
    // Remove selected class from all flight items
    document.querySelectorAll('.flight-item').forEach(item => {
        item.classList.remove('selected');
    });
    stopTrackingFlight();
    modal.classList.remove('active');
});

function addMarker(flight) {
    // Calculate rotation angle based on true track
    const rotation = flight.true_track ? parseFloat(flight.true_track) : 0;
    
    // Create SVG icon for airplane
    const svgIcon = {
        path: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
        fillColor: '#FFD700', // Yellow color
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: '#000000',
        scale: 1.5,
        rotation: rotation
    };
    
    const marker = new google.maps.Marker({
        position: { lat: parseFloat(flight.latitude), lng: parseFloat(flight.longitude) },
        icon: svgIcon,
        title: `${flight.callsign || "Unknown"} - ${flight.origin_country}`,
        optimized: true
    });

    // Add hover effect
    marker.addListener('mouseover', () => {
        marker.setIcon({
            ...svgIcon,
            fillColor: '#FFA500' // Lighter orange color on hover
        });
    });

    marker.addListener('mouseout', () => {
        marker.setIcon({
            ...svgIcon,
            fillColor: '#FFD700' // Back to yellow
        });
    });

    // Use closure to prevent memory leaks
    const clickHandler = () => {
        selectedFlight = flight;
        showFlightDetails(flight);
    };

    marker.addListener('click', clickHandler);
    markers.push(marker);
    return marker;
}

function setLoading(isLoading) {
    loadingState = isLoading;
    const flightList = document.getElementById("flight-list");
    const searchInput = document.getElementById("search-input");
    
    if (isLoading) {
        flightList.innerHTML = "<li class='loading'>Loading flights...</li>";
        searchInput.disabled = true;
    } else {
        searchInput.disabled = false;
    }
}

function fetchFlights(searchTerm = "") {
    if (loadingState) return;
    
    setLoading(true);
    
    fetch(`./api/get_flights.php?search=${encodeURIComponent(searchTerm)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Store all flights globally
            allFlights = data;
            
            // Update the summary with all flights
            updateFlightSummary(allFlights);

            // Get the current search input value
            const currentSearch = document.getElementById('search-input').value.trim();
            
            // If there's a current search term, use it to filter flights
            const displayFlights = currentSearch 
                ? allFlights.filter(flight => 
                    flight.origin_country.toLowerCase().includes(currentSearch.toLowerCase()) ||
                    (flight.callsign && flight.callsign.toLowerCase().includes(currentSearch.toLowerCase()))
                  )
                : allFlights;

            clearMarkers();
            updateFlightList(displayFlights);
            
            // Batch process markers for filtered flights
            const newMarkers = [];
            displayFlights.forEach(flight => {
                const marker = addMarker(flight);
                newMarkers.push(marker);
            });
            
            // Update marker clusterer with filtered markers
            clusterer.addMarkers(newMarkers);
            
            updateVisibleMarkers();
        })
        .catch(error => {
            console.error("Error fetching flights:", error);
            document.getElementById("flight-list").innerHTML = 
                `<li class="error">Error loading flights. Please try again later.</li>`;
        })
        .finally(() => {
            setLoading(false);
        });
}

function updateFlightSummary(flights) {
    // Update total flights count (always show total of all flights)
    const totalFlightsCount = document.getElementById('total-flights-count');
    totalFlightsCount.textContent = flights.length;

    // Group flights by country
    const countryGroups = flights.reduce((acc, flight) => {
        const country = flight.origin_country || 'Unknown';
        if (!acc[country]) {
            acc[country] = [];
        }
        acc[country].push(flight);
        return acc;
    }, {});

    // Sort countries alphabetically
    const sortedCountries = Object.entries(countryGroups)
        .sort(([a], [b]) => a.localeCompare(b));

    // Update country list
    const countryList = document.getElementById('country-list');
    countryList.innerHTML = '';

    sortedCountries.forEach(([country, countryFlights]) => {
        const countryItem = document.createElement('div');
        countryItem.className = 'country-item';
        countryItem.innerHTML = `
            <span class="country-name">${country}</span>
            <span class="flight-count">${countryFlights.length}</span>
        `;

        // Add click handler to filter flights by country
        countryItem.addEventListener('click', () => {
            const searchInput = document.getElementById('search-input');
            searchInput.value = country;
            
            // Filter flights for this country but keep summary unchanged
            const countryFlights = allFlights.filter(f => 
                f.origin_country.toLowerCase() === country.toLowerCase()
            );
            
            clearMarkers();
            updateFlightList(countryFlights);
            
            // Update markers for filtered flights
            const newMarkers = [];
            countryFlights.forEach(flight => {
                const marker = addMarker(flight);
                newMarkers.push(marker);
            });
            clusterer.addMarkers(newMarkers);
            updateVisibleMarkers();
        });

        countryList.appendChild(countryItem);
    });
}

function updateFlightList(flights) {
    const flightList = document.getElementById("flight-list");
    flightList.innerHTML = "";

    if (flights.length === 0) {
        flightList.innerHTML = "<li>No flights found</li>";
        return;
    }

    flights.forEach(flight => {
        const li = document.createElement("li");
        li.className = "flight-item";
        li.innerHTML = `
            <div class="flight-info">
                <span class="callsign">✈ ${flight.callsign || "Unknown"}</span>
                <span class="country">${flight.origin_country}</span>
            </div>
            <div class="flight-details">
                <span>Altitude: ${Math.round(flight.baro_altitude || 0)} ft</span>
                <span>Speed: ${Math.round(flight.velocity || 0)} knots</span>
            </div>
        `;
        
        li.addEventListener('click', () => {
            // Find the corresponding marker
            const marker = markers.find(m => {
                const pos = m.getPosition();
                return pos.lat().toFixed(6) === parseFloat(flight.latitude).toFixed(6) && 
                       pos.lng().toFixed(6) === parseFloat(flight.longitude).toFixed(6);
            });

            if (marker) {
                // Center the map on the marker
                map.setCenter(marker.getPosition());
                map.setZoom(6);
                
                // Show flight details
                selectedFlight = flight;
                showFlightDetails(flight);
            }
        });
        
        flightList.appendChild(li);
    });
}

/* Search Input with Debounce */
document.getElementById("search-input").addEventListener("input", function() {
    let query = this.value.trim();
    const suggestionsDiv = document.getElementById("suggestions");
    
    // Clear any existing timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Set a new timeout
    searchTimeout = setTimeout(() => {
        if (query.length > 2) {
            fetch(`./api/search_flights.php?query=${encodeURIComponent(query)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(suggestions => showSuggestions(suggestions))
                .catch(error => {
                    console.error("Error fetching suggestions:", error);
                    suggestionsDiv.style.display = "none";
                });
        } else {
            suggestionsDiv.style.display = "none";
            // Clear search results when input is less than 3 characters
            if (query.length === 0) {
                fetchFlights(); // Reload all flights when search is cleared
            }
        }
    }, 300); // 300ms debounce delay
});

function showSuggestions(suggestions) {
    let suggestionsDiv = document.getElementById("suggestions");
    suggestionsDiv.innerHTML = "";

    if (suggestions.length === 0) {
        suggestionsDiv.style.display = "none";
        return;
    }

    suggestions.forEach(suggestion => {
        let div = document.createElement("div");
        div.className = "suggestion-item";
        div.textContent = `${suggestion.callsign} - ${suggestion.origin_country}`;
        div.addEventListener("click", function() {
            document.getElementById("search-input").value = `${suggestion.callsign} - ${suggestion.origin_country}`;
            suggestionsDiv.style.display = "none";
            fetchFlights(`${suggestion.origin_country}`);
        });
        suggestionsDiv.appendChild(div);
    });

    suggestionsDiv.style.display = "block";
}

// Handle window resize
window.addEventListener('resize', () => {
    if (map) {
        google.maps.event.trigger(map, 'resize');
    }
});

// Add cleanup for tracked flights when the page unloads
window.addEventListener('unload', () => {
    stopTrackingFlight();
    clearMarkers();
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if Google Maps API is loaded
    if (window.google && window.google.maps) {
        initMap();
        // Initial load only
        fetchFlights();
    } else {
        // If not loaded, wait for it
        window.addEventListener('load', () => {
            if (window.google && window.google.maps) {
                initMap();
                // Initial load only
                fetchFlights();
            }
        });
    }
});