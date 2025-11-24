// ==========================================
// 1. LÓGICA DE LA INTERFAZ
// ==========================================
document.getElementById('btn-comenzar').addEventListener('click', function() {
    const landing = document.getElementById('landing-page');
    const app = document.getElementById('app-container');
    landing.style.opacity = '0'; landing.style.transition = 'opacity 0.5s ease';
    setTimeout(() => { landing.style.display = 'none'; app.style.display = 'block'; map.invalidateSize(); }, 500);
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.ui-layer').forEach(v => v.classList.remove('active'));
        const viewId = this.getAttribute('data-view');
        document.getElementById(viewId).classList.add('active');
        
        // GESTIÓN DE CAPAS
        if (viewId === 'ui-nom001') {
            if(geojsonLayer && !map.hasLayer(geojsonLayer)) map.addLayer(geojsonLayer);
            if(isRadiiVisible && !map.hasLayer(allRadiiLayer)) map.addLayer(allRadiiLayer);
            if(denueLayer && map.hasLayer(denueLayer)) map.removeLayer(denueLayer);
            setTimeout(() => map.invalidateSize(), 100);
        } else if (viewId === 'ui-nom002') {
            if(geojsonLayer && !map.hasLayer(geojsonLayer)) map.addLayer(geojsonLayer); 
            if(denueLayer && !map.hasLayer(denueLayer)) map.addLayer(denueLayer); 
            resetHighlight(); 
            if(map.hasLayer(allRadiiLayer)) map.removeLayer(allRadiiLayer);
            setTimeout(() => map.invalidateSize(), 100);
        } else {
            if(geojsonLayer) map.removeLayer(geojsonLayer);
            if(denueLayer) map.removeLayer(denueLayer);
        }
    });
});

const hamburgerBtn = document.getElementById('hamburger-btn');
const hamburgerDropdown = document.getElementById('hamburger-dropdown');
hamburgerBtn.addEventListener('click', (e) => { e.stopPropagation(); hamburgerDropdown.classList.toggle('show'); });
document.addEventListener('click', (e) => { if (!hamburgerBtn.contains(e.target) && !hamburgerDropdown.contains(e.target)) hamburgerDropdown.classList.remove('show'); });
document.querySelectorAll('.menu-item').forEach(btn => {
    btn.addEventListener('click', function() {
        var id = this.getAttribute('data-tab'); document.getElementById('modal-overlay').style.display = 'flex';
        document.querySelectorAll('.modal-tab-pane').forEach(p => p.classList.remove('active')); document.getElementById(id).classList.add('active'); hamburgerDropdown.classList.remove('show'); 
    });
});
document.getElementById('modal-close-btn').addEventListener('click', () => document.getElementById('modal-overlay').style.display = 'none');
document.getElementById('modal-overlay').addEventListener('click', (e) => { if(e.target === document.getElementById('modal-overlay')) document.getElementById('modal-overlay').style.display = 'none'; });

// ==========================================
// 2. LÓGICA DEL MAPA
// ==========================================

var centroMerida = [20.9754, -89.6169];
var map = L.map('map', { zoomControl: false }).setView(centroMerida, 11);
L.control.zoom({ position: 'topleft' }).addTo(map);

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' });
var cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CARTO' });
var cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CARTO' });
var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' });

cartoLight.addTo(map); 
L.control.layers({ "Claro": cartoLight, "Oscuro": cartoDark, "Calles": osm, "Satélite": satellite }, null, { position: 'bottomleft' }).addTo(map);

var espaciosData = null; var manzanasData = null; var limiteData = null; var zonaMetroData = null; var denueData = null;
var geojsonLayer; var denueLayer;
var manzanaHighlightLayer = L.layerGroup().addTo(map); 
var zonaMetroLayer = L.featureGroup().addTo(map); 
var limiteLayer = L.featureGroup().addTo(map); 
var allRadiiLayer = L.layerGroup();
var bufferLayer = null; var radiusLineLayer = null; var selectedLayer = null; var isRadiiVisible = false;

var infoDefault = document.getElementById('info-default'); var infoPanel = document.getElementById('info-panel');
var tituloEl = document.getElementById('dash-titulo'); var modulosEl = document.getElementById('dash-modulos');
var nomEl = document.getElementById('dash-nom'); var areaEl = document.getElementById('dash-area');
var pobTotalEl = document.getElementById('dash-pob-total'); var pob014El = document.getElementById('dash-pob-0-14');
var pob65El = document.getElementById('dash-pob-65'); var pobDiscEl = document.getElementById('dash-pob-disc');
var statPobBeneficiada = document.getElementById('stat-pob-beneficiada');
var filtersContainer = document.getElementById('category-filters'); var opacitySlider = document.getElementById('opacity-slider'); 

const categoryColors = { 'PARQUE': '#238b45', 'PLAZA': '#f39c12', 'AREA DEPORTIVA': '#3498db', 'AREA VERDE': '#2ecc71', 'CALLE': '#95a5a6', 'default': '#9b59b6' };
var availableCategories = new Set(); var activeFilters = new Set();

const denueColors = {
    "Económicas": "#e74c3c", "Sociales": "#d35400", "De Abasto": "#922b21", "Educativas": "#2980b9", "Culturales / Deportivas": "#5dade2", "De Traslado": "#f1c40f", "Otros / No Clasificado": "#95a5a6", "default": "#95a5a6" 
};
var denueSelection = {}; 

// --- FUNCIÓN CORRECCIÓN DE CARACTERES (VERSION FINAL) ---
function fixEncoding(str) {
    if (!str) return "No disponible";
    let fixed = str;
    
    // Expresiones regulares /gi (global, case-insensitive) para atrapar errores de mayúsculas/minúsculas
    fixed = fixed.replace(/EDUCACIN/gi, 'Educación');
    fixed = fixed.replace(/P.BLICA/gi, 'Pública'); // Atrapa PUBLICA, PBLICA, PBLICA
    fixed = fixed.replace(/P.BLICO/gi, 'Público'); // Atrapa PUBLICO, PBLICO, PBLICO
    fixed = fixed.replace(/JARDN/gi, 'Jardín');
    fixed = fixed.replace(/ALMACN/gi, 'Almacén');
    fixed = fixed.replace(/NERGA/gi, 'Energía');
    fixed = fixed.replace(/ASOCIACIN/gi, 'Asociación');
    fixed = fixed.replace(/PRODUCCIN/gi, 'Producción');
    fixed = fixed.replace(/CONSTRUCCIN/gi, 'Construcción');
    fixed = fixed.replace(/REPARACIN/gi, 'Reparación');
    fixed = fixed.replace(/INSTALACIN/gi, 'Instalación');
    fixed = fixed.replace(/COMERCIALIZACIN/gi, 'Comercialización');
    fixed = fixed.replace(/EDIFICACIN/gi, 'Edificación');
    fixed = fixed.replace(/SUPERVISIN/gi, 'Supervisión');
    fixed = fixed.replace(/PREESCOLAR/gi, 'Preescolar');
    
    // Último recurso para el símbolo raro
    fixed = fixed.replace(/\uFFFD/g, 'ó'); 
    
    return fixed;
}

function style(feature) {
    var currentOpacity = parseFloat(opacitySlider.value);
    var cat = feature.properties.CLAS_IMPLA ? feature.properties.CLAS_IMPLA.toUpperCase().trim() : 'default';
    var colorRelleno = categoryColors[cat] || categoryColors['default'];
    return { fillColor: colorRelleno, weight: 1, opacity: 1, color: 'white', fillOpacity: currentOpacity };
}
var bufferStyle = { fillColor: '#238b45', fillOpacity: 0.1, stroke: true, color: '#9ad6aeff', weight: 2, dashArray: '5, 5' };

function renderLimite(geojsonData) { limiteLayer.clearLayers(); L.geoJSON(geojsonData, { style: { fill: false, color: '#333333', weight: 3, dashArray: '', opacity: 1 }, interactive: false }).addTo(limiteLayer); limiteLayer.bringToFront(); }
function renderZonaMetro(geojsonData) { zonaMetroLayer.clearLayers(); L.geoJSON(geojsonData, { style: { fill: false, color: '#ff7800', weight: 1.5, dashArray: '5, 10', opacity: 0.5 }, interactive: false }).addTo(zonaMetroLayer); zonaMetroLayer.bringToBack(); }

function initDenueLayer(geojsonData) {
    const tree = {};
    geojsonData.features.forEach(f => {
        const cat = f.properties.NOM_ACTIV || 'Otros / No Clasificado';
        const sub = f.properties.NOM_JERARQ || 'Sin Jerarquía';
        if (!tree[cat]) tree[cat] = new Set(); tree[cat].add(sub);
        if (!denueSelection[cat]) denueSelection[cat] = new Set(); denueSelection[cat].add(sub);
    });
    const container = document.getElementById('denue-filters-list'); container.innerHTML = '';
    const toggleAllDiv = document.createElement('div'); toggleAllDiv.className = 'filter-group';
    toggleAllDiv.innerHTML = `<div class="filter-header" style="background:#f4f4f4;"><input type="checkbox" id="chk-all-denue" checked> <label for="chk-all-denue" style="margin-left:5px; font-weight:bold;">Marcar Todo</label></div>`;
    container.appendChild(toggleAllDiv);
    document.getElementById('chk-all-denue').addEventListener('change', function(e) {
        if(e.target.checked) { for(let cat in tree) denueSelection[cat] = new Set(tree[cat]); document.querySelectorAll('.denue-parent, .denue-child').forEach(c => c.checked = true); } else { denueSelection = {}; document.querySelectorAll('.denue-parent, .denue-child').forEach(c => c.checked = false); } refreshDenueLayer(geojsonData);
    });
    const sortedCats = Object.keys(tree).sort((a, b) => { if (a.includes("Otros")) return 1; if (b.includes("Otros")) return -1; return a.localeCompare(b); });
    sortedCats.forEach(cat => {
        const hierarchies = Array.from(tree[cat]).sort();
        let color = denueColors["default"]; for (const key in denueColors) { if (cat.includes(key) || key.includes(cat)) { color = denueColors[key]; break; } }
        const groupDiv = document.createElement('div'); groupDiv.className = 'filter-group';
        const header = document.createElement('div'); header.className = 'filter-header';
        const parentChk = document.createElement('input'); parentChk.type = 'checkbox'; parentChk.className = 'denue-parent'; parentChk.checked = true; parentChk.dataset.cat = cat;
        parentChk.addEventListener('change', function(e) {
            const isChecked = e.target.checked; const childrenDiv = groupDiv.querySelector('.filter-children');
            childrenDiv.querySelectorAll('.denue-child').forEach(child => { child.checked = isChecked; const sub = child.value; if(isChecked) { if(!denueSelection[cat]) denueSelection[cat] = new Set(); denueSelection[cat].add(sub); } else { if(denueSelection[cat]) denueSelection[cat].delete(sub); } }); refreshDenueLayer(geojsonData);
        });
        const label = document.createElement('span'); label.innerHTML = `<span style="display:inline-block;width:10px;height:10px;background:${color};margin-right:5px;border-radius:50%;"></span>${cat}`; label.style.marginLeft = '5px'; label.style.flex = '1';
        const toggleIcon = document.createElement('i'); toggleIcon.className = 'fa-solid fa-chevron-right toggle-icon'; header.onclick = (e) => { if(e.target !== parentChk) { groupDiv.querySelector('.filter-children').classList.toggle('show'); toggleIcon.classList.toggle('rotated'); } };
        header.appendChild(parentChk); header.appendChild(label); header.appendChild(toggleIcon); groupDiv.appendChild(header);
        const childrenContainer = document.createElement('div'); childrenContainer.className = 'filter-children';
        hierarchies.forEach(sub => {
            const childRow = document.createElement('div'); childRow.className = 'child-filter-item';
            const childChk = document.createElement('input'); childChk.type = 'checkbox'; childChk.className = 'denue-child'; childChk.value = sub; childChk.checked = true;
            childChk.addEventListener('change', function(e) { if(e.target.checked) { if(!denueSelection[cat]) denueSelection[cat] = new Set(); denueSelection[cat].add(sub); } else { if(denueSelection[cat]) denueSelection[cat].delete(sub); } refreshDenueLayer(geojsonData); });
            const childLbl = document.createElement('label'); childLbl.innerText = sub; childLbl.style.marginLeft = '5px'; childRow.appendChild(childChk); childRow.appendChild(childLbl); childrenContainer.appendChild(childRow);
        });
        groupDiv.appendChild(childrenContainer); container.appendChild(groupDiv);
    });
    refreshDenueLayer(geojsonData);
}

function refreshDenueLayer(geojsonData) {
    if (denueLayer) { if (map.hasLayer(denueLayer)) map.removeLayer(denueLayer); }
    const filteredData = { type: "FeatureCollection", features: geojsonData.features.filter(f => { const cat = f.properties.NOM_ACTIV || 'Otros / No Clasificado'; const sub = f.properties.NOM_JERARQ || 'Sin Jerarquía'; return denueSelection[cat] && denueSelection[cat].has(sub); }) };
    denueLayer = L.geoJSON(filteredData, {
        pointToLayer: function (feature, latlng) { const cat = feature.properties.NOM_ACTIV || 'Otros'; let color = denueColors["default"]; for (const key in denueColors) { if (cat.includes(key) || key.includes(cat)) { color = denueColors[key]; break; } } return L.circleMarker(latlng, { radius: 3, fillColor: color, color: "#fff", weight: 0.5, opacity: 1, fillOpacity: 0.9 }); },
        onEachFeature: function (feature, layer) {
            const hierarchy = feature.properties.NOM_JERARQ || "Sin Jerarquía"; layer.bindTooltip(hierarchy, { direction: 'top', offset: [0, -2] });
            layer.on('click', function(e) { L.DomEvent.stopPropagation(e); if (selectedLayer === layer) { document.getElementById('denue-default').style.display = 'block'; document.getElementById('denue-details').style.display = 'none'; selectedLayer = null; return; } selectedLayer = layer; updateDenuePanel(feature.properties); });
        }
    });
    document.getElementById('stat-total-denue').innerText = filteredData.features.length.toLocaleString();
    if(document.getElementById('ui-nom002').classList.contains('active')) { denueLayer.addTo(map); }
}

function updateDenuePanel(props) {
    document.getElementById('denue-default').style.display = 'none'; document.getElementById('denue-details').style.display = 'block';
    document.getElementById('denue-title').innerText = props.NOM_JERARQ || "Sin Jerarquía";
    document.getElementById('denue-code').innerText = props.codigo_act || "N/A";
    const rawName = props.nom_act || props.nombre_act || "Nombre no disponible";
    document.getElementById('denue-activity-name').innerText = fixEncoding(rawName);
    document.getElementById('denue-addr').innerText = (props.CALLE || "") + " " + (props.NUM_EXT || "") + ", " + (props.COLONIA || "");
}

function initFilters(features) { availableCategories.clear(); features.forEach(f => { if (f.properties.CLAS_IMPLA) availableCategories.add(f.properties.CLAS_IMPLA); }); const cats = Array.from(availableCategories).sort(); activeFilters = new Set(cats); filtersContainer.innerHTML = ''; const toggleAllDiv = document.createElement('div'); toggleAllDiv.className = 'filter-item'; toggleAllDiv.innerHTML = `<input type="checkbox" id="chk-all" checked> <label for="chk-all"><b>Marcar Todo</b></label>`; filtersContainer.appendChild(toggleAllDiv); document.getElementById('chk-all').addEventListener('change', function(e) { if(e.target.checked) { activeFilters = new Set(cats); document.querySelectorAll('.cat-filter').forEach(c => c.checked = true); } else { activeFilters.clear(); document.querySelectorAll('.cat-filter').forEach(c => c.checked = false); } applyFilters(); }); cats.forEach(cat => { const div = document.createElement('div'); div.className = 'filter-item'; const safeId = 'cat-' + cat.replace(/[^a-z0-9]/gi, ''); var catColor = categoryColors[cat.toUpperCase().trim()] || categoryColors['default']; const chk = document.createElement('input'); chk.type = 'checkbox'; chk.id = safeId; chk.className = 'cat-filter'; chk.value = cat; chk.checked = true; chk.addEventListener('change', function(e) { if (e.target.checked) activeFilters.add(cat); else activeFilters.delete(cat); applyFilters(); }); const lbl = document.createElement('label'); lbl.htmlFor = safeId; lbl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;background:${catColor};margin-right:5px;border-radius:50%;"></span>${cat}`; div.appendChild(chk); div.appendChild(lbl); filtersContainer.appendChild(div); }); }
function applyFilters() { const filteredFeatures = espaciosData.features.filter(f => activeFilters.has(f.properties.CLAS_IMPLA)); renderMap(filteredFeatures); updateGlobalStats(filteredFeatures); }
function updatePanel(props) { tituloEl.innerHTML = props.CLAS_IMPLA || "Sin Clasificación"; if (selectedLayer) { var center = selectedLayer.getBounds().getCenter(); var gmapsLink = `http://googleusercontent.com/maps.google.com/9{center.lat.toFixed(6)},${center.lng.toFixed(6)}`; modulosEl.innerHTML = `<b>Ubicación:</b> <a href="${gmapsLink}" target="_blank">Ver en Google Maps</a><br><b>Tipo:</b> ` + (props.MODULOS || "No definido"); } nomEl.innerHTML = "<b>Escala de servicio:</b> " + (props.ESC_SERV || "No definido"); var area = props.SUP_TER_HA ? parseFloat(props.SUP_TER_HA).toFixed(2) : "0"; areaEl.innerHTML = "<b>Área:</b> " + area + " ha"; infoDefault.style.display = 'none'; infoPanel.style.display = 'block'; }
function resetHighlight() { 
    if (selectedLayer) { if(selectedLayer.setStyle) geojsonLayer.resetStyle(selectedLayer); selectedLayer = null; } 
    if (bufferLayer) map.removeLayer(bufferLayer); if (radiusLineLayer) map.removeLayer(radiusLineLayer); 
    manzanaHighlightLayer.clearLayers(); 
    pobTotalEl.innerText = "0"; pob014El.innerText = "0"; pob65El.innerText = "0"; pobDiscEl.innerText = "0"; 
    
    // CORRECCIÓN: Restaurar panel por defecto si estamos en NOM-001
    infoDefault.style.display = 'block'; infoPanel.style.display = 'none';
}
function setLayerOpacity(newOpacity) { if (geojsonLayer) { geojsonLayer.setStyle(function(feature) { var baseStyle = style(feature); baseStyle.fillOpacity = newOpacity; return baseStyle; }); if (selectedLayer && selectedLayer.setStyle) { selectedLayer.setStyle({ fillOpacity: newOpacity, weight: 5, color: '#FFFF00' }); } } }
function calculateGlobalCoverage(features) { if (!features || !manzanasData) return; let totalPobBeneficiada = 0; let manzanasBeneficiadas = new Set(); features.forEach(espacio => { var radio = parseFloat(espacio.properties.RAD_INF || 0); if (radio <= 0) return; var centroEspacio = turf.center(espacio); manzanasData.features.forEach((manzana, index) => { var centroManzana = turf.center(manzana); if (turf.distance(centroEspacio, centroManzana, {units: 'meters'}) <= radio) manzanasBeneficiadas.add(index); }); }); manzanasBeneficiadas.forEach(index => totalPobBeneficiada += (parseFloat(manzanasData.features[index].properties.POB1) || 0)); statPobBeneficiada.innerText = totalPobBeneficiada.toLocaleString(); }
function updateGlobalStats(features) { var totalEspacios = features.length; var totalArea = features.reduce((sum, f) => sum + (parseFloat(f.properties.SUP_TER_HA) || 0), 0); document.getElementById('stat-total-ep').innerText = totalEspacios; document.getElementById('stat-total-area').innerText = totalArea.toFixed(2) + " ha"; calculateGlobalCoverage(features); }
function highlightManzanas(centerPoint, radiusMeters) { manzanaHighlightLayer.clearLayers(); if (!manzanasData) return; let radiusKm = radiusMeters / 1000; let sumTotal = 0; let sum014 = 0; let sum65 = 0; let sumDisc = 0; manzanasData.features.forEach(manzana => { var centroManzana = turf.center(manzana); if (turf.distance(centerPoint, centroManzana, {units: 'kilometers'}) <= radiusKm) { var props = manzana.properties; sumTotal += (parseFloat(props.POB1) || 0); sum014 += (parseFloat(props.POB8) || 0); sum65 += (parseFloat(props.POB24) || 0); sumDisc += (parseFloat(props.DISC1) || 0); L.geoJSON(manzana, { style: { fillColor: '#b3d4beff', fillOpacity: 0.1, color: '#238b45', weight: 1, dashArray: '2, 4', opacity: 0.4, interactive: false } }).addTo(manzanaHighlightLayer); } }); pobTotalEl.innerText = sumTotal.toLocaleString(); pob014El.innerText = sum014.toLocaleString(); pob65El.innerText = sum65.toLocaleString(); pobDiscEl.innerText = sumDisc.toLocaleString(); }

function renderMap(featuresToRender) {
    resetHighlight(); if (geojsonLayer) map.removeLayer(geojsonLayer); allRadiiLayer.clearLayers();
    geojsonLayer = L.geoJSON(featuresToRender, { style: style, onEachFeature: function (feature, layer) {
            var rad = parseFloat(feature.properties.RAD_INF || 0); if (rad > 0) { var circle = L.circle(layer.getBounds().getCenter(), { radius: rad, stroke: true, color: '#333', weight: 1, dashArray: '5, 5', fillColor: '#6ebe89ff', fillOpacity: 0.10, interactive: false }); allRadiiLayer.addLayer(circle); }
            layer.on('click', function (e) { 
                L.DomEvent.stopPropagation(e); 
                if (selectedLayer === e.target) { resetHighlight(); return; } // TOGGLE OFF
                
                resetHighlight(); 
                selectedLayer = e.target; 
                selectedLayer.setStyle({ weight: 5, color: '#FFFF00', dashArray: '', fillOpacity: parseFloat(opacitySlider.value) }); selectedLayer.bringToFront(); 
                updatePanel(feature.properties); 
                var radius = parseFloat(feature.properties.RAD_INF || 0); 
                if (radius > 0) { var centerLatLng = layer.getBounds().getCenter(); bufferLayer = L.circle(centerLatLng, { ...bufferStyle, radius: radius }).addTo(map); var edgePoint = [centerLatLng.lat, bufferLayer.getBounds().getNorthEast().lng]; radiusLineLayer = L.polyline([centerLatLng, edgePoint], { className: 'leaflet-radius-line' }).addTo(map); radiusLineLayer.bindTooltip(radius.toFixed(0) + " m", { permanent: true, direction: 'right', className: 'leaflet-radius-tooltip' }).openTooltip(); var turfPoint = turf.point([centerLatLng.lng, centerLatLng.lat]); highlightManzanas(turfPoint, radius); map.fitBounds(bufferLayer.getBounds()); } else { map.fitBounds(selectedLayer.getBounds()); } 
            });
        } }).addTo(map);
    if (isRadiiVisible) { if (!map.hasLayer(allRadiiLayer)) map.addLayer(allRadiiLayer); }
}

async function cargarDatos() {
    try {
        const responseEspacios = await fetch('espacios_publicos.geojson'); if (!responseEspacios.ok) throw new Error("Falta 'espacios_publicos.geojson'"); const espacios = await responseEspacios.json();
        const responseManzanas = await fetch('manzanas.geojson'); if (!responseManzanas.ok) throw new Error("Falta 'manzanas.geojson'"); const manzanas = await responseManzanas.json();
        const responseLimite = await fetch('limite.geojson'); if (!responseLimite.ok) throw new Error("Falta 'limite.geojson'"); const limite = await responseLimite.json();
        let zonaMetro = null; try { const responseZM = await fetch('zonametropoli.geojson'); if (responseZM.ok) zonaMetro = await responseZM.json(); } catch(e) { console.warn("Error ZM", e); }
        let denue = null; try { const responseDenue = await fetch('denue.geojson'); if(responseDenue.ok) denue = await responseDenue.json(); } catch(e) { console.warn("Error DENUE", e); }

        espaciosData = espacios; manzanasData = manzanas; limiteData = limite; zonaMetroData = zonaMetro; denueData = denue;
        if (zonaMetroData) renderZonaMetro(zonaMetroData); renderLimite(limiteData); initFilters(espaciosData.features); renderMap(espaciosData.features);
        if (denueData) initDenueLayer(denueData);
        var totalPobMuni = manzanasData.features.reduce((sum, f) => sum + (parseFloat(f.properties.POB1) || 0), 0); document.getElementById('stat-pob-total').innerText = totalPobMuni.toLocaleString(); updateGlobalStats(espaciosData.features);
    } catch (error) { console.error(error); alert("¡Error cargando datos!\n\n" + error.message); }
}
cargarDatos();

opacitySlider.addEventListener('input', function() { setLayerOpacity(parseFloat(this.value)); });
document.getElementById('btn-ubicacion').addEventListener('click', function() { navigator.geolocation.getCurrentPosition(function(position) { var loc = [position.coords.latitude, position.coords.longitude]; map.setView(loc, 16); L.marker(loc).addTo(map).bindPopup("<b>¡Estás aquí!</b>").openPopup(); }, () => alert('No se pudo obtener ubicación')); });
document.getElementById('btn-toggle-radii').addEventListener('click', function() { var btn = document.getElementById('btn-toggle-radii'); if (isRadiiVisible) { map.removeLayer(allRadiiLayer); btn.innerHTML = '<i class="fa-solid fa-circle-notch"></i> Ver Cobertura (Radios)'; } else { map.addLayer(allRadiiLayer); btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Ocultar Cobertura'; } isRadiiVisible = !isRadiiVisible; });
map.on('click', function() { 
    // Lógica global de click en fondo del mapa para limpiar selecciones
    if(document.getElementById('ui-nom001').classList.contains('active')) { resetHighlight(); }
    if(document.getElementById('ui-nom002').classList.contains('active')) { 
        resetHighlight(); // Limpia el polígono de espacio público
        document.getElementById('denue-default').style.display = 'block'; 
        document.getElementById('denue-details').style.display = 'none'; 
        selectedLayer = null; 
    }
});