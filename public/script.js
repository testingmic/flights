let map;
let markers = [];
let infoWindow;
let loadingState = false;
let lastUpdateTime = null;
let searchTimeout = null;
let selectedFlight = null;

function initMap() {
    // Custom map style similar to Flightradar24
    const mapStyle = [
        {
            "featureType": "landscape",
            "elementType": "geometry",
            "stylers": [{"color": "#f5f5f5"}]
        },
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{"color": "#c9c9c9"}]
        },
        {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [{"visibility": "off"}]
        },
        {
            "featureType": "poi",
            "elementType": "all",
            "stylers": [{"visibility": "off"}]
        },
        {
            "featureType": "administrative",
            "elementType": "labels",
            "stylers": [{"visibility": "off"}]
        }
    ];

    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 20.0, lng: 0.0 },
        zoom: 2,
        minZoom: 2,
        maxZoom: 8,
        styles: mapStyle,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER
        },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        fullscreenControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
        }
    });

    // Add custom controls
    addMapControls();
    
    infoWindow = new google.maps.InfoWindow({
        maxWidth: 300
    });
    
    fetchFlights(); // Initial load
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

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

function showFlightDetails(flight) {
    const modal = document.getElementById('flight-details-modal');
    
    // Update header information
    modal.querySelector('.flight-callsign').textContent = flight.callsign || 'Unknown';
    modal.querySelector('.flight-icao').textContent = flight.icao24;
    modal.querySelector('.flight-operator').textContent = flight.origin_country;

    // Update aircraft image
    const aircraftImage = modal.querySelector('#aircraft-image');
    // Default image in case API fails
    const defaultImage = 'https://www.flightradar24.com/static/images/aircraft_generic.png';
    
    // Try to get aircraft image from registration number
    if (flight.icao24) {
        // First set default image while loading
        aircraftImage.src = defaultImage;
        
        // Attempt to load actual aircraft image
        const img = new Image();
        img.onload = function() {
            aircraftImage.src = this.src;
        };
        img.onerror = function() {
            // If loading fails, keep the default image
            aircraftImage.src = defaultImage;
        };
        // Try to load image from planespotters.net (you'll need to replace with actual API endpoint)
        img.src = `https://api.planespotters.net/pub/photos/reg/${flight.icao24}`;
    } else {
        aircraftImage.src = defaultImage;
    }
    
    // Update route information
    const departure = modal.querySelector('.departure');
    const arrival = modal.querySelector('.arrival');
    
    // Assuming we have departure and arrival data
    departure.querySelector('.airport-code').textContent = 'ORD';
    departure.querySelector('.airport-name').textContent = 'Chicago';
    departure.querySelector('.scheduled span').textContent = '5:50 PM';
    departure.querySelector('.actual span').textContent = '6:22 PM';
    
    arrival.querySelector('.airport-code').textContent = 'MIA';
    arrival.querySelector('.airport-name').textContent = 'Miami';
    arrival.querySelector('.scheduled span').textContent = '10:04 PM';
    arrival.querySelector('.estimated span').textContent = '9:53 PM';
    
    // Update aircraft information
    modal.querySelector('.aircraft-type').textContent = 'Boeing 737-823';
    modal.querySelector('.registration').textContent = flight.icao24;
    modal.querySelector('.aircraft-age').textContent = 'N/A';
    
    // Update flight data
    modal.querySelector('.altitude').textContent = `${Math.round(flight.altitude)}m`;
    modal.querySelector('.ground-speed').textContent = `${Math.round(flight.velocity * 3.6)} km/h`;
    modal.querySelector('.track').textContent = 'N/A';
    
    // Show modal
    modal.classList.add('active');
}

// Add close modal functionality
document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('flight-details-modal').classList.remove('active');
});

function addMarker(flight) {
    // Calculate rotation angle based on velocity
    const rotation = flight.velocity ? Math.atan2(flight.velocity, flight.velocity) * (180 / Math.PI) : 0;
    
    const marker = new google.maps.Marker({
        position: { lat: parseFloat(flight.latitude), lng: parseFloat(flight.longitude) },
        map: map,
        icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 2,
            rotation: rotation,
            fillColor: '#FF0000',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#000000'
        },
        title: `${flight.callsign || "Unknown"} - ${flight.origin_country}`
    });

    marker.addListener('click', () => {
        selectedFlight = flight;
        showFlightDetails(flight);
    });

    markers.push(marker);
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

function updateLastUpdateTime() {
    const now = new Date();
    lastUpdateTime = now;
    const timeString = now.toLocaleTimeString();
    document.querySelector('header').insertAdjacentHTML('beforeend', 
        `<div class="last-update">Last updated: ${timeString}</div>`);
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
            clearMarkers();
            updateFlightList(data);
            data.forEach(flight => {
                addMarker(flight);
            });
            updateLastUpdateTime();
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
                <span>Altitude: ${Math.round(flight.altitude)}m</span>
                <span>Speed: ${Math.round(flight.velocity * 3.6)} km/h</span>
            </div>
        `;
        
        li.addEventListener('click', () => {
            const marker = markers.find(m => 
                m.getPosition().lat() === parseFloat(flight.latitude) && 
                m.getPosition().lng() === parseFloat(flight.longitude)
            );
            if (marker) {
                google.maps.event.trigger(marker, 'click');
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

window.onload = initMap;