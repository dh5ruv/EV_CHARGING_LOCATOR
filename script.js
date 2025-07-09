const map = L.map('map').setView([20.5937, 78.9629], 5); // Default India view

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

let userMarker;
let bikeMarker;
let currentCoords;

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchStationsFromAPI(lat, lng) {
  const url = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lng}&distance=25&maxresults=20&key=OCM-API-TEST`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error("API error:", response.status, response.statusText);
    return [];
  }

  const data = await response.json();
  console.log("Fetched stations:", data);
  return data;
}

async function showStationsNearby(lat, lng) {
  map.setView([lat, lng], 13);

  const stations = await fetchStationsFromAPI(lat, lng);

  stations.forEach(station => {
    const info = station.AddressInfo;
    if (info && info.Latitude && info.Longitude) {
      L.marker([info.Latitude, info.Longitude])
        .addTo(map)
        .bindPopup(
          `<b>${info.Title}</b><br>${info.AddressLine1 || ''}<br><i>${station.Connections?.[0]?.ConnectionType?.Title || 'Unknown'}</i>`
        );
    }
  });
}

function animateBikeRoute(start, end) {
  const route = L.polyline([start, end], { color: 'blue' }).addTo(map);
  if (bikeMarker) map.removeLayer(bikeMarker);
  bikeMarker = L.marker(start, {
    icon: L.divIcon({ className: 'bike' })
  }).addTo(map);

  let i = 0;
  const steps = 100;
  const latStep = (end[0] - start[0]) / steps;
  const lngStep = (end[1] - start[1]) / steps;

  const interval = setInterval(() => {
    const newLat = start[0] + latStep * i;
    const newLng = start[1] + lngStep * i;
    bikeMarker.setLatLng([newLat, newLng]);
    i++;
    if (i > steps) clearInterval(interval);
  }, 30);
}

async function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      currentCoords = [lat, lng];
      document.getElementById("locationInfo").innerText = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;

      userMarker = L.marker([lat, lng]).addTo(map).bindPopup("You are here").openPopup();

      await showStationsNearby(lat, lng);

      const stations = await fetchStationsFromAPI(lat, lng);
      if (stations.length > 0) {
        stations.sort((a, b) => {
          const d1 = getDistance(lat, lng, a.AddressInfo.Latitude, a.AddressInfo.Longitude);
          const d2 = getDistance(lat, lng, b.AddressInfo.Latitude, b.AddressInfo.Longitude);
          return d1 - d2;
        });

        const nearest = stations[0];
        animateBikeRoute([lat, lng], [nearest.AddressInfo.Latitude, nearest.AddressInfo.Longitude]);
      }
    }, () => {
      document.getElementById("locationInfo").innerText = "Permission denied.";
    });
  } else {
    document.getElementById("locationInfo").innerText = "Geolocation not supported.";
  }
}

function getBatteryStatus() {
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      const level = Math.round(battery.level * 100);
      document.getElementById("batteryStatus").innerText = `Battery: ${level}%`;
    });
  } else {
    document.getElementById("batteryStatus").innerText = "Battery API not supported.";
  }
}

function searchCity() {
  const query = document.getElementById("searchInput").value;
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
    .then(res => res.json())
    .then(async data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        map.setView([lat, lon], 13);
        await showStationsNearby(lat, lon);
      } else {
        alert("Location not found");
      }
    });
}

getLocation();
getBatteryStatus();
