let map;
let markers = [];
let infoWindow;
let loadingState = false;
let lastUpdateTime = null;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 20.0, lng: 0.0 },
        zoom: 2,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    infoWindow = new google.maps.InfoWindow();
    fetchFlights();
    setInterval(fetchFlights, 10000);
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

function addMarker(flight) {
    const marker = new google.maps.Marker({
        position: { lat: parseFloat(flight.latitude), lng: parseFloat(flight.longitude) },
        map: map,
        title: `Callsign: ${flight.callsign || "Unknown"}\nCountry: ${flight.origin_country}`
    });

    marker.addListener('click', () => {
        const content = `
            <div class="info-window">
                <h3>${flight.callsign || "Unknown"}</h3>
                <p><strong>Country:</strong> ${flight.origin_country}</p>
                <p><strong>Altitude:</strong> ${Math.round(flight.altitude)}m</p>
                <p><strong>Speed:</strong> ${Math.round(flight.velocity * 3.6)} km/h</p>
            </div>
        `;
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
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
                map.panTo(marker.getPosition());
            }
        });
        
        flightList.appendChild(li);
    });
}

/* Search Input */
document.getElementById("search-input").addEventListener("input", function() {
    let query = this.value.trim();
    const suggestionsDiv = document.getElementById("suggestions");
    
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
    }
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
        div.textContent = suggestion;
        div.addEventListener("click", function() {
            document.getElementById("search-input").value = suggestion;
            suggestionsDiv.style.display = "none";
            fetchFlights(suggestion);
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