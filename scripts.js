// Global variables
let allResults = [];
let currentNpiIndex = 0;
let totalNpis = 0;
let cptData = {}; // Store CPT code descriptions

// DOM elements - will be initialized when DOM is loaded
let form, searchBtn, resultsSection, statusMessages, progressBar, searchResults;

// CORS Proxy URLs - using public CORS proxies as fallback
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://cors-anywhere.herokuapp.com/',
    'https://thingproxy.freeboard.io/fetch/',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://yacdn.org/proxy/',
    'https://cors.bridged.cc/',
    'https://proxy.cors.sh/'
];

let currentProxyIndex = 0;

// Load CPT data from embedded JavaScript object
function loadCptData() {
    try {
        if (window.CPT_DATA) {
            cptData = window.CPT_DATA;
            console.log(`Loaded ${Object.keys(cptData).length} CPT codes`);
            return true;
        } else {
            console.warn('CPT data not found in window.CPT_DATA');
            return false;
        }
    } catch (error) {
        console.warn('Failed to load CPT data:', error);
        return false;
    }
}

// Initialize DOM elements when page loads
document.addEventListener('DOMContentLoaded', function() {
    form = document.getElementById('providerForm');
    searchBtn = document.getElementById('searchBtn');
    resultsSection = document.getElementById('resultsSection');
    statusMessages = document.getElementById('statusMessages');
    progressBar = document.getElementById('progressBar');
    searchResults = document.getElementById('searchResults');

    // Event listeners
    form.addEventListener('submit', handleFormSubmit);

    // Initialize Google Charts
    google.charts.load('current', {packages: ['corechart']});
    
    // Load CPT data
    loadCptData();
    
    console.log('Provider Lookup & Medicare Data Tool initialized');
});

// Helper functions
function getCptDescription(hcpcsCode) {
    // Return the CPT description if found, otherwise return a default message
    return cptData[hcpcsCode] || 'Description not available';
}

function formatDescriptionForTooltip(description) {
    // Break description into lines every ~70 characters without splitting words
    const words = description.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        // Check if adding this word would exceed 70 characters
        if (currentLine.length + word.length + 1 <= 70) {
            // Add word to current line
            if (currentLine === '') {
                currentLine = word;
            } else {
                currentLine += ' ' + word;
            }
        } else {
            // Start a new line
            if (currentLine !== '') {
                lines.push(currentLine);
            }
            currentLine = word;
        }
    }
    
    // Add the last line if it's not empty
    if (currentLine !== '') {
        lines.push(currentLine);
    }
    
    return lines.join('\\n');
}

function showMessage(message, type = 'info') {
    // Hide all previous status messages
    const existingMessages = statusMessages.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.style.display = 'none');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `status-message status-${type}`;
    messageDiv.innerHTML = message;
    messageDiv.style.display = 'block';
    statusMessages.appendChild(messageDiv);
    messageDiv.classList.add('fade-in');
}

function clearMessages() {
    statusMessages.innerHTML = '';
}

function updateProgress(current, total) {
    const percentage = (current / total) * 100;
    progressBar.style.width = `${percentage}%`;
}

function setLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="loading"></span>Searching...';
    } else {
        button.disabled = false;
        button.innerHTML = '🔍 Search Providers';
    }
}

// Local storage cache for successful searches
function getCachedResult(key) {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            const data = JSON.parse(cached);
            // Cache valid for 1 hour
            if (Date.now() - data.timestamp < 3600000) {
                return data.result;
            }
        }
    } catch (e) {
        console.warn('Cache read error:', e);
    }
    return null;
}

function setCachedResult(key, result) {
    try {
        localStorage.setItem(key, JSON.stringify({
            result: result,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Cache write error:', e);
    }
}

function clearCache() {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('npi_') || key.startsWith('cms_')) {
                localStorage.removeItem(key);
            }
        });
        showMessage('🗑️ Cache cleared successfully!', 'success');
    } catch (e) {
        console.warn('Cache clear error:', e);
        showMessage('⚠️ Failed to clear cache', 'warning');
    }
}

// CORS Proxy function with improved handling
async function fetchWithProxy(url, options = {}) {
    const maxRetries = CORS_PROXIES.length;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            let proxyUrl;
            
            // Handle different proxy URL formats
            if (CORS_PROXIES[currentProxyIndex].includes('allorigins.win')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + encodeURIComponent(url);
            } else if (CORS_PROXIES[currentProxyIndex].includes('cors-anywhere.herokuapp.com')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + url;
            } else if (CORS_PROXIES[currentProxyIndex].includes('thingproxy.freeboard.io')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + url;
            } else if (CORS_PROXIES[currentProxyIndex].includes('corsproxy.io')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + url;
            } else if (CORS_PROXIES[currentProxyIndex].includes('codetabs.com')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + url;
            } else if (CORS_PROXIES[currentProxyIndex].includes('yacdn.org')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + url;
            } else if (CORS_PROXIES[currentProxyIndex].includes('bridged.cc')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + url;
            } else if (CORS_PROXIES[currentProxyIndex].includes('cors.sh')) {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + url;
            } else {
                proxyUrl = CORS_PROXIES[currentProxyIndex] + encodeURIComponent(url);
            }
            
            console.log(`Attempting fetch with proxy ${currentProxyIndex + 1}: ${proxyUrl}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(proxyUrl, {
                ...options,
                signal: controller.signal,
                headers: {
                    ...options.headers,
                    'Content-Type': 'application/json',
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return response;
            } else {
                console.warn(`Proxy ${currentProxyIndex + 1} returned status ${response.status}`);
            }
        } catch (error) {
            console.warn(`Proxy ${currentProxyIndex + 1} failed:`, error.message);
        }
        
        // Try next proxy with a small delay
        currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
        if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
    }
    
    throw new Error('All CORS proxies failed. Please try one of these solutions:\n1. Run the app from a web server (not file://)\n2. Use a browser extension like "CORS Unblock"\n3. Try a different browser or incognito mode\n4. The NPI Registry API may be temporarily unavailable.');
}

// API Functions
async function getNpi(firstName, lastName, state = null) {
    // Check cache first
    const cacheKey = `npi_${firstName.toLowerCase()}_${lastName.toLowerCase()}_${(state || '').toLowerCase()}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
        console.log('Using cached NPI result');
        return cached;
    }

    const baseUrl = "https://npiregistry.cms.hhs.gov/api/";
    const params = new URLSearchParams({
        version: "2.1",
        first_name: firstName,
        last_name: lastName,
        state: state || "",
        enumeration_type: "NPI-1"
    });

    try {
        // Try direct fetch first
        let response;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            response = await fetch(`${baseUrl}?${params}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (corsError) {
            console.log('Direct fetch failed due to CORS, trying with proxy...');
            response = await fetchWithProxy(`${baseUrl}?${params}`);
        }
        
        if (!response.ok) {
            throw new Error(`NPI Registry API error: ${response.status}`);
        }
        
        const data = await response.json();
        const result = data.results ? data.results.map(r => r.number) : [];
        
        // Cache successful result
        if (result.length > 0) {
            setCachedResult(cacheKey, result);
        }
        
        return result;
    } catch (error) {
        console.error('Error fetching NPI:', error);
        
        // Show helpful instructions for CORS issues
        if (error.message.includes('CORS proxies failed')) {
            showMessage(`
                <strong>🔧 CORS Error Solutions:</strong><br>
                1. <strong>Run from web server:</strong> Use a local server (not file://)<br>
                2. <strong>Browser extension:</strong> Install "CORS Unblock" extension<br>
                3. <strong>Different browser:</strong> Try Chrome, Firefox, or Edge<br>
                4. <strong>Incognito mode:</strong> May bypass some restrictions<br>
                5. <strong>API status:</strong> NPI Registry may be temporarily unavailable
            `, 'warning');
        } else {
            showMessage(`NPI Registry API error: ${error.message}`, 'error');
        }
        
        return [];
    }
}

async function fetchCmsData(npi, limit = 1000, offset = 0) {
    // Check cache first
    const cacheKey = `cms_${npi}_${limit}_${offset}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
        console.log(`Using cached CMS data for NPI ${npi}`);
        return cached;
    }

    const url = "https://data.cms.gov/data-api/v1/dataset/92396110-2aed-4d63-a6a2-5d6207d46a29/data";
    const params = new URLSearchParams({
        keyword: npi.toString(),
        offset: offset.toString(),
        size: limit.toString()
    });

    try {
        // Try direct fetch first
        let response;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for CMS data
            
            response = await fetch(`${url}?${params}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (corsError) {
            console.log('Direct fetch failed due to CORS, trying with proxy...');
            response = await fetchWithProxy(`${url}?${params}`);
        }
        
        if (!response.ok) {
            throw new Error(`Failed to fetch CMS data for NPI ${npi}: ${response.status}`);
        }
        
        const data = await response.json();
        const result = Array.isArray(data) ? data : [];
        
        // Cache successful result
        if (result.length > 0) {
            setCachedResult(cacheKey, result);
        }
        
        return result;
    } catch (error) {
        console.error('Error fetching CMS data:', error);
        
        if (error.message.includes('CORS proxies failed')) {
            showMessage(`⚠️ CMS data fetch failed for NPI ${npi}. Try running from a web server.`, 'warning');
        } else {
            showMessage(`Failed to fetch CMS data for NPI ${npi}: ${error.message}`, 'error');
        }
        
        return [];
    }
}

// Chart Functions
function create3DPieChart(containerId, labels, values, title, animationDelay = 300) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div id="chart-${containerId}" class="google-chart"></div>`;
    
    const chartDiv = document.getElementById(`chart-${containerId}`);
    
    // Create data table for Google Charts
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Procedure Code');
    data.addColumn('number', 'Value');
    data.addColumn({type: 'string', role: 'tooltip'});
    
    // Sort data to ensure largest value gets the primary blue
    const sortedData = labels.map((label, index) => ({ label, value: values[index] }))
        .sort((a, b) => b.value - a.value);
    
    // Limit to 6 items on mobile
    const isMobile = window.innerWidth <= 768;
    const limitedData = isMobile ? sortedData.slice(0, 6) : sortedData;
    
    const rows = limitedData.map(item => {
        const description = getCptDescription(item.label);
        const formattedDescription = formatDescriptionForTooltip(description);
        const tooltipText = `${item.label}\nValue: ${item.value.toLocaleString()}\n\n${formattedDescription}`;
        return [item.label, item.value, tooltipText];
    });
    data.addRows(rows);
    
    // Diverse blue color palette with clearly different shades
    const blueColors = ['#2D40CB', '#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#2563EB', '#1E40AF', '#1E3A8A', '#1F2937', '#374151', '#4B5563'];
    
    // Create new data table with sorted values
    const sortedDataTable = new google.visualization.DataTable();
    sortedDataTable.addColumn('string', 'Procedure Code');
    sortedDataTable.addColumn('number', 'Value');
    sortedDataTable.addColumn({type: 'string', role: 'tooltip'});
    
    const sortedRows = sortedData.map(item => {
        const description = getCptDescription(item.label);
        const formattedDescription = formatDescriptionForTooltip(description);
        const tooltipText = `${item.label}\nValue: ${item.value.toLocaleString()}\n\n${formattedDescription}`;
        return [item.label, item.value, tooltipText];
    });
    sortedDataTable.addRows(sortedRows);

    // Chart options optimized for mobile and desktop
    const options = {
        title: '',
        is3D: true,
        backgroundColor: 'transparent',
        colors: blueColors,
        legend: {
            position: 'right',
            textStyle: {
                fontSize: 12,
                color: '#ffffff'
            },
            maxLines: window.innerWidth <= 768 ? 6 : 10,
            alignment: 'center'
        },
        pieSliceText: 'both',
        pieSliceTextStyle: {
            fontSize: 10,
            color: 'white',
            bold: true
        },
        tooltip: {
            textStyle: {
                fontSize: 12,
                color: '#000000'
            },
            trigger: 'focus'
        },
        chartArea: {
            left: 20,
            top: 60,
            right: 20,
            bottom: 80,
            width: '100%',
            height: '100%'
        },
        width: '100%',
        height: 600,
        animation: {
            startup: true,
            duration: 1000,
            easing: 'out'
        }
    };
    
        // Create and draw the chart
        const chart = new google.visualization.PieChart(chartDiv);
        
        // Add animation delay if specified
        setTimeout(() => {
            chart.draw(sortedDataTable, options);
            
            // Add hover effects for legend items
            google.visualization.events.addListener(chart, 'onmouseover', function(e) {
                // Get all slices
                const allSlices = chartDiv.querySelectorAll('svg g[aria-label*="slice"]');
                allSlices.forEach((slice, index) => {
                    if (index !== e.row) {
                        slice.style.opacity = '0.5';
                    }
                });
            });
            
            google.visualization.events.addListener(chart, 'onmouseout', function(e) {
                // Reset all slices to full opacity
                const allSlices = chartDiv.querySelectorAll('svg g[aria-label*="slice"]');
                allSlices.forEach(slice => {
                    slice.style.opacity = '1';
                });
            });
        }, animationDelay);
    
    // Make chart responsive
    window.addEventListener('resize', function() {
        chart.draw(sortedDataTable, options);
    });
}

function plotPieCharts(data, npi) {
    if (!data || data.length === 0) return;

    // Process data
    const processedData = data.map(row => ({
        ...row,
        Tot_Srvcs: parseFloat(row.Tot_Srvcs) || 0,
        Avg_Mdcr_Alowd_Amt: parseFloat(row.Avg_Mdcr_Alowd_Amt) || 0
    }));

    // Calculate totals
    processedData.forEach(row => {
        row.Total_Mdcr_Allowed = row.Avg_Mdcr_Alowd_Amt * row.Tot_Srvcs;
    });

    // Group by HCPCS_Cd
    const grouped = {};
    processedData.forEach(row => {
        const code = row.HCPCS_Cd;
        if (!grouped[code]) {
            grouped[code] = { Tot_Srvcs: 0, Total_Mdcr_Allowed: 0 };
        }
        grouped[code].Tot_Srvcs += row.Tot_Srvcs;
        grouped[code].Total_Mdcr_Allowed += row.Total_Mdcr_Allowed;
    });

    const labels = Object.keys(grouped);
    const serviceValues = labels.map(code => grouped[code].Tot_Srvcs);
    const paymentValues = labels.map(code => grouped[code].Total_Mdcr_Allowed);

    // Create charts
    const chartContainer1 = `chart1-${npi}`;
    const chartContainer2 = `chart2-${npi}`;
    
    const chartsHtml = `
        <div class="chart-container">
            <div id="${chartContainer1}"></div>
        </div>
        <div class="chart-container">
            <div id="${chartContainer2}"></div>
        </div>
    `;
    
    searchResults.insertAdjacentHTML('beforeend', chartsHtml);

    // Create 3D pie charts with Google Charts
    create3DPieChart(chartContainer1, labels, serviceValues, 
        "Procedure Code and Volume", 0);
    create3DPieChart(chartContainer2, labels, paymentValues, 
        "Procedure Code and Payment", 500);
}

function createDataTable(data, npi) {
    if (!data || data.length === 0) return;

    const tableHtml = `
        <div class="data-table">
            <h3>📊 Data for NPI ${npi}</h3>
            <table>
                <thead>
                    <tr>
                        ${Object.keys(data[0]).map(key => `<th>${key}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => `
                        <tr>
                            ${Object.values(row).map(value => `<td>${value}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    searchResults.insertAdjacentHTML('beforeend', tableHtml);
}

// Open results in a new tab with charts and two tables (summary + raw)
function openResultsInNewTab(cmsData, npi, firstName = '', lastName = '') {
    const win = window.open('', '_blank');
    if (!win) {
        showMessage('Popup blocked. Please allow popups for this site to view results in a new tab.', 'warning');
        return;
    }

    // Prepare data for summary table
    const processedData = cmsData.map(row => ({
        ...row,
        Tot_Srvcs: parseFloat(row.Tot_Srvcs) || 0,
        Avg_Mdcr_Alowd_Amt: parseFloat(row.Avg_Mdcr_Alowd_Amt) || 0
    }));
    processedData.forEach(row => {
        row.Total_Mdcr_Allowed = row.Avg_Mdcr_Alowd_Amt * row.Tot_Srvcs;
    });
    const grouped = {};
    processedData.forEach(row => {
        const code = row.HCPCS_Cd;
        if (!grouped[code]) {
            grouped[code] = { Tot_Srvcs: 0, Total_Mdcr_Allowed: 0 };
        }
        grouped[code].Tot_Srvcs += row.Tot_Srvcs;
        grouped[code].Total_Mdcr_Allowed += row.Total_Mdcr_Allowed;
    });
    const summaryRows = Object.keys(grouped).map(code => ({
        HCPCS_Cd: code,
        Procedure_Code_Description: getCptDescription(code),
        Tot_Srvcs: grouped[code].Tot_Srvcs,
        Total_Mdcr_Allowed: grouped[code].Total_Mdcr_Allowed
    }));

    // Create a limited CPT data object with only the codes used in the charts
    const chartLabels = Object.keys(grouped);
    const limitedCptData = {};
    chartLabels.forEach(code => {
        limitedCptData[code] = getCptDescription(code);
    });

    const serialized = JSON.stringify({ raw: cmsData, summary: summaryRows, cptData: limitedCptData });

    // Convert names to title case
    const titleCase = (str) => {
        return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };
    // Get doctor name from first record or use provided name
    let doctorName;
    let lastNameForGreeting;
    
    if (firstName && lastName) {
        doctorName = `Dr. ${titleCase(firstName)} ${titleCase(lastName)}`;
        lastNameForGreeting = titleCase(lastName);
    } else if (cmsData.length > 0 && cmsData[0].Rndrng_Prvdr_First_Name && cmsData[0].Rndrng_Prvdr_Last_Org_Name) {
        doctorName = `Dr. ${titleCase(cmsData[0].Rndrng_Prvdr_First_Name)} ${titleCase(cmsData[0].Rndrng_Prvdr_Last_Org_Name)}`;
        lastNameForGreeting = titleCase(cmsData[0].Rndrng_Prvdr_Last_Org_Name);
    } else {
        doctorName = `NPI ${npi}`;
        lastNameForGreeting = 'Provider';
    }
    
    // Create greeting text
    const greetingText = `Hi Dr. ${lastNameForGreeting}, here's your data.`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Results for ${doctorName}</title>
  <link rel="stylesheet" href="styles.css" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
  <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
  <style>
    body { 
      background: #111111; 
      margin: 0; 
      padding: 0; 
      color: #ffffff; 
      font-family: Helvetica, Arial, sans-serif;
    }
    
    /* Chart and table styling for sticky slides */
    .chart-container { 
      background: transparent; 
      border: none; 
      border-radius: 8px; 
      padding: 20px; 
    }
    
    .data-table { 
      background: transparent; 
      border: none; 
      border-radius: 8px; 
      padding: 20px;
      padding-top: 60px;
    }
    
    .table-wrapper {
      max-height: calc(80vh - 60px);
      overflow: auto;
    }
    
    .data-table table { 
      width: max-content; 
      min-width: 100%; 
      table-layout: auto; 
      border-radius: 4px; 
      overflow: hidden; 
      background: transparent;
    }
    
    .data-table th, .data-table td { 
      border-right: 1px solid #e0e0e0; 
      font-size: 16px; 
      white-space: nowrap; 
      min-width: 120px; 
      max-width: none; 
      color: #000000; 
      padding: 8px 12px;
      background: transparent;
    }
    
    .data-table th:last-child, .data-table td:last-child { 
      border-right: none; 
    }
    
    .data-table th { 
      position: sticky; 
      top: 0; 
      z-index: 20; 
      background: rgba(255, 255, 255, 0.2) !important; 
      color: #000000; 
      font-weight: 600;
    }
    
    .data-table th:first-child, .data-table td:first-child { 
      position: sticky; 
      left: 0; 
      background: rgba(255, 255, 255, 0.2); 
      z-index: 25; 
      min-width: 150px; 
      max-width: 200px; 
    }
    
    .data-table th:first-child { 
      background: rgba(255, 255, 255, 0.2) !important; 
    }
    
    .data-table td:first-child { 
      background: rgba(255, 255, 255, 0.2) !important; 
    }
    
    /* Specific styling for Procedure Code Description column in Summary by HCPCS table */
    .summary-table th:nth-child(2), 
    .summary-table td:nth-child(2) {
      width: 300px !important;
      max-width: 300px !important;
      min-width: 300px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    
    .data-table h3 { 
      margin-bottom: 20px; 
      text-align: left; 
      color: #000000;
      font-size: 1.5em;
      font-weight: 600;
    }
    
    /* Google Charts styling */
    .google-chart {
      width: 100% !important;
      max-height: 840px;
    }
    
    /* Target 3rd and subsequent text elements within g elements for pie chart slice labels */
    .google-chart svg g text:nth-child(n+3) {
      font-size: 20px !important;
    }
    
    /* Smooth transitions for hover effects */
    .google-chart svg g[aria-label*="slice"] {
      transition: opacity 0.3s ease;
    }
    
    /* Font family for consistency */
    .font-helvetica {
      font-family: Helvetica, Arial, sans-serif;
    }
    
    /* Fade-in animation styles */
    .slide-component {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 2s ease-out, transform 2s ease-out;
    }
    
    .slide-component.fade-in {
      opacity: 1;
      transform: translateY(0);
    }
    
    /* Staggered animation delays for multiple components */
    .slide-component:nth-child(1) { transition-delay: 0.1s; }
    .slide-component:nth-child(2) { transition-delay: 0.2s; }
    .slide-component:nth-child(3) { transition-delay: 0.3s; }
    .slide-component:nth-child(4) { transition-delay: 0.4s; }
    .slide-component:nth-child(5) { transition-delay: 0.5s; }
    .slide-component:nth-child(6) { transition-delay: 0.6s; }
    
    /* Tooltip styling for Google Charts */
    .google-visualization-tooltip {
      max-width: 100px !important;
      width: 100px !important;
      word-wrap: break-word !important;
      white-space: normal !important;
      overflow-wrap: break-word !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      overflow: visible !important;
      text-overflow: unset !important;
    }
    
    /* Ensure tooltip text wraps properly */
    .google-visualization-tooltip * {
      max-width: 100px !important;
      word-wrap: break-word !important;
      white-space: normal !important;
      overflow-wrap: break-word !important;
      hyphens: auto !important;
    }
    
    /* Force text wrapping in tooltip content */
    .google-visualization-tooltip table {
      max-width: 100px !important;
      table-layout: fixed !important;
    }
    
    .google-visualization-tooltip td {
      max-width: 100px !important;
      word-wrap: break-word !important;
      white-space: normal !important;
      overflow-wrap: break-word !important;
      hyphens: auto !important;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .google-chart {
        height: 600px !important;
        min-height: 480px;
        max-height: 600px;
      }
      
      .data-table {
        max-height: 70vh;
      }
      
      .data-table th, .data-table td {
        font-size: 12px;
        padding: 6px 8px;
      }
    }
  </style>
</head>
<body>
  <div class="relative">
    <!-- Slide 1: Greeting -->
    <div class="sticky top-0 h-screen flex flex-col items-center justify-center text-white" style="background: linear-gradient(to bottom, #0C0554, #08033A);">
      <h2 id="typewriter-text" class="slide-component text-4xl font-bold font-helvetica"></h2>
      <p id="scroll-instruction" class="slide-component mt-4 text-lg opacity-0 transition-opacity duration-[2000ms]">Scroll Down for Analysis</p>
    </div>
    
    <!-- Slide 2: Volume Chart -->
    <div class="sticky top-0 h-screen flex flex-col items-center justify-center text-white" style="background: linear-gradient(to bottom, #070A1F, #050714);">
      <div class="w-full max-w-6xl px-8">
        <div class="chart-container slide-component rounded-lg p-6 mb-6">
          <div class="chart-header flex justify-between items-center mb-4">
            <div class="chart-title text-2xl font-bold">Procedure Code and Volume</div>
            <button class="download-btn bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition-colors" onclick="downloadChart('chart1')" title="Download Chart">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
          <div id="chart1" class="google-chart"></div>
        </div>
      </div>
    </div>
    
    <!-- Slide 3: Payment Chart -->
    <div class="sticky top-0 h-screen flex flex-col items-center justify-center text-white" style="background: linear-gradient(to bottom, #1B164E, #15113A);">
      <div class="w-full max-w-6xl px-8">
        <div class="chart-container slide-component rounded-lg p-6 mb-6">
          <div class="chart-header flex justify-between items-center mb-4">
            <div class="chart-title text-2xl font-bold">Procedure Code and Payment</div>
            <button class="download-btn bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition-colors" onclick="downloadChart('chart2')" title="Download Chart">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
          <div id="chart2" class="google-chart"></div>
        </div>
      </div>
    </div>
    
    <!-- Slide 4: Summary Table -->
    <div class="sticky top-0 h-screen flex flex-col items-center justify-center text-black" style="background: linear-gradient(to bottom, #C4D7FF, #A8C7FF);">
      <div class="w-full max-w-7xl px-8">
        <div class="data-table slide-component rounded-lg p-6" id="summaryTable">
          <!-- Table content will be populated by JavaScript -->
        </div>
      </div>
    </div>
    
    <!-- Slide 5: Raw Data Table -->
    <div class="sticky top-0 h-screen flex flex-col items-center justify-center text-black" style="background: linear-gradient(to bottom, #9BBCFF, #7BA3FF);">
      <div class="w-full max-w-7xl px-8">
        <div class="data-table slide-component rounded-lg p-6" id="rawTable">
          <!-- Table content will be populated by JavaScript -->
        </div>
      </div>
    </div>
  </div>
  
  <!-- Hidden Plotly charts for downloads -->
  <div id="plotly-chart1" style="display: none;"></div>
  <div id="plotly-chart2" style="display: none;"></div>

  <script>
    const PAGE_DATA = ${serialized};
    let plotlyCharts = {};
    
    // CPT Data for tooltips
    let CPT_DATA = PAGE_DATA.cptData || {};
    
    // Function to get CPT description
    function getCptDescription(hcpcsCode) {
      return CPT_DATA[hcpcsCode] || 'Description not available';
    }
    
    // Function to format description for tooltip (break every ~70 characters without splitting words)
    function formatDescriptionForTooltip(description) {
      const words = description.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (const word of words) {
        // Check if adding this word would exceed 70 characters
        if (currentLine.length + word.length + 1 <= 70) {
          // Add word to current line
          if (currentLine === '') {
            currentLine = word;
          } else {
            currentLine += ' ' + word;
          }
        } else {
          // Start a new line
          if (currentLine !== '') {
            lines.push(currentLine);
          }
          currentLine = word;
        }
      }
      
      // Add the last line if it's not empty
      if (currentLine !== '') {
        lines.push(currentLine);
      }
      
      return lines.join('\\n');
    }
    
    // Typewriter effect for greeting text
    function initTypewriterEffect() {
      const greetingText = "${greetingText}";
      const typewriterElement = document.getElementById('typewriter-text');
      const scrollInstruction = document.getElementById('scroll-instruction');
      
      let i = 0;
      typewriterElement.innerHTML = '';
      
      function typeWriter() {
        if (i < greetingText.length) {
          typewriterElement.innerHTML += greetingText.charAt(i);
          i++;
          setTimeout(typeWriter, 50); // 50ms per character
        } else {
          // Typewriter finished, fade in scroll instruction
          setTimeout(() => {
            scrollInstruction.style.opacity = '1';
          }, 500); // Small delay before showing scroll instruction
        }
      }
      
      // Start typewriter effect after a short delay
      setTimeout(typeWriter, 500);
    }
    
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(draw);

    function draw() {
      // Filter out codes starting with 'J' from summary data
      const filteredSummary = PAGE_DATA.summary.filter(r => !r.HCPCS_Cd.startsWith('J'));
      
      // Build labels and values from filtered summary
      const labels = filteredSummary.map(r => r.HCPCS_Cd);
      const serviceValues = filteredSummary.map(r => r.Tot_Srvcs);
      const paymentValues = filteredSummary.map(r => r.Total_Mdcr_Allowed);

      // Draw charts
      create3DPie('chart1', labels, serviceValues, 'Procedure Code and Volume');
      create3DPie('chart2', labels, paymentValues, 'Procedure Code and Payment');
      
      // Create Plotly versions for downloads
      createPlotlyChart('chart1', labels, serviceValues, 'Procedure Code and Volume');
      createPlotlyChart('chart2', labels, paymentValues, 'Procedure Code and Payment');

      // Render summary table with filtered data (excluding J codes)
      renderTable(
        'summaryTable',
        'Summary by HCPCS',
        filteredSummary,
        ['HCPCS_Cd','Procedure_Code_Description','Tot_Srvcs','Total_Mdcr_Allowed']
      );

      // Render raw table
      const rawHeaders = Object.keys(PAGE_DATA.raw[0] || {});
      renderTable('rawTable', 'Source Data', PAGE_DATA.raw, rawHeaders);
      
      window.addEventListener('resize', () => {
        create3DPie('chart1', labels, serviceValues, 'Procedure Code and Volume');
        create3DPie('chart2', labels, paymentValues, 'Procedure Code and Payment');
      });
    }
    
    function createPlotlyChart(chartId, labels, values, title) {
      // Blue color palette with #2D40CB for largest segment
      const blueColors = ['#2D40CB', '#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#2563EB', '#1E40AF', '#1E3A8A', '#1F2937', '#374151', '#4B5563'];
      
      // Sort data to ensure largest value gets the primary blue
      const sortedData = labels.map((label, index) => ({ label, value: values[index] }))
        .sort((a, b) => b.value - a.value);
      
      const sortedLabels = sortedData.map(item => item.label);
      const sortedValues = sortedData.map(item => item.value);
      
      const trace = {
        labels: sortedLabels,
        values: sortedValues,
        type: 'pie',
        hole: 0.3,
        textinfo: 'label+percent',
        textposition: 'outside',
        marker: {
          colors: blueColors,
          line: { color: 'white', width: 2 }
        }
      };

      const layout = {
        title: '',
        showlegend: true,
        legend: {
          orientation: 'v',
          x: 1.02,
          y: 1,
          xanchor: 'left',
          font: { size: 10 }
        },
        font: { family: 'Helvetica, Arial, sans-serif', color: '#000000' },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white'
      };

      const plotlyId = chartId.replace('chart', 'plotly-chart');
      Plotly.newPlot(plotlyId, [trace], layout);
      plotlyCharts[chartId] = { data: [trace], layout: layout };
    }
    
    function downloadChart(chartId) {
      const plotlyId = chartId.replace('chart', 'plotly-chart');
      Plotly.downloadImage(plotlyId, {
        format: 'png',
        width: 800,
        height: 600,
        filename: chartId + '_chart'
      });
    }

    function create3DPie(containerId, labels, values, title) {
      const container = document.getElementById(containerId);
      container.innerHTML = '<div id="gc-' + containerId + '" class="google-chart"></div>';
      const chartDiv = document.getElementById('gc-' + containerId);
      
      // Blue color palette with #2D40CB for largest segment
      const blueColors = ['#2D40CB', '#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#2563EB', '#1E40AF', '#1E3A8A', '#1F2937', '#374151', '#4B5563'];
      
      // Sort data to ensure largest value gets the primary blue
      const sortedData = labels.map((label, index) => [label, values[index]])
        .sort((a, b) => b[1] - a[1]);
      
      // Limit to 6 items on mobile
      const isMobile = window.innerWidth <= 768;
      const limitedData = isMobile ? sortedData.slice(0, 6) : sortedData;
      
      const data = new google.visualization.DataTable();
      data.addColumn('string', 'Procedure Code');
      data.addColumn('number', 'Value');
      data.addColumn({type: 'string', role: 'tooltip'});
      
      const dataWithTooltips = limitedData.map(row => {
        const code = row[0];
        const value = row[1];
        const description = getCptDescription(code);
        const formattedDescription = formatDescriptionForTooltip(description);
        const tooltipText = code + '\\nValue: ' + value.toLocaleString() + '\\n\\n' + formattedDescription;
        return [code, value, tooltipText];
      });
      
      data.addRows(dataWithTooltips);

      const options = {
        title: '',
        is3D: true,
        backgroundColor: 'transparent',
        colors: blueColors,
        legend: { position: 'right', textStyle: { fontSize: 12, color: '#ffffff' }, maxLines: window.innerWidth <= 768 ? 6 : 10, alignment: 'center' },
        pieSliceText: 'both',
        pieSliceTextStyle: { fontSize: 10, color: 'white', bold: true },
        tooltip: {
            textStyle: {
                fontSize: 12,
                color: '#000000'
            },
            trigger: 'focus'
        },
        chartArea: { left: 20, top: 60, right: 20, bottom: 80, width: '100%', height: '100%' },
        width: '100%',
        height: 600,
        animation: { startup: true, duration: 800, easing: 'out' }
      };

      const chart = new google.visualization.PieChart(chartDiv);
      chart.draw(data, options);
      
      // Add hover effects for legend items
      google.visualization.events.addListener(chart, 'onmouseover', function(e) {
        // Get all slices
        const allSlices = chartDiv.querySelectorAll('svg g[aria-label*="slice"]');
        allSlices.forEach((slice, index) => {
          if (index !== e.row) {
            slice.style.opacity = '0.5';
          }
        });
      });
      
      google.visualization.events.addListener(chart, 'onmouseout', function(e) {
        // Reset all slices to full opacity
        const allSlices = chartDiv.querySelectorAll('svg g[aria-label*="slice"]');
        allSlices.forEach(slice => {
          slice.style.opacity = '1';
        });
      });
    }

      function renderTable(containerId, title, rows, headers) {
        const container = document.getElementById(containerId);
        const isRawTable = title.includes('Source Data');
        const isSummaryTable = title.includes('Summary by HCPCS');
        let tableClass = '';
        if (isRawTable) tableClass += ' raw-table';
        if (isSummaryTable) tableClass += ' summary-table';
      
      // Convert headers to human-readable text
      const readableHeaders = headers.map(h => convertToReadableHeader(h));
      
      // Define currency columns
      const currencyColumns = [
        'Total_Mdcr_Allowed',
        'Avg_Sbmtd_Chrg', 
        'Avg_Mdcr_Alowd_Amt',
        'Avg_Mdcr_Pymt_Amt',
        'Avg_Mdcr_Stdzd_Amt'
      ];
      
      const thead = '<thead><tr>' + readableHeaders.map(h => '<th>' + h + '</th>').join('') + '</tr></thead>';
      const tbody = '<tbody>' + rows.map(r => '<tr>' + headers.map(h => {
        let value = r[h] ?? '';
        
        // Format currency columns
        if (currencyColumns.includes(h) && value !== '' && !isNaN(value)) {
          value = '$' + parseFloat(value).toFixed(2);
        }
        
        return '<td>' + value + '</td>';
      }).join('') + '</tr>').join('') + '</tbody>';
      container.innerHTML = '<h3 class="slide-component" style="position: sticky; top: 0; background: transparent; z-index: 10; margin-bottom: 40px;">' + title + '</h3><div class="table-wrapper slide-component" style="max-height: calc(80vh - 60px); overflow: auto;"><table class="' + tableClass.trim() + '">' + thead + tbody + '</table></div>';
    }
    
    function convertToReadableHeader(header) {
      const headerMap = {
        'HCPCS_Cd': 'Procedure Code',
        'Procedure_Code_Description': 'Procedure Code Description',
        'Tot_Srvcs': 'Total Services',
        'Total_Mdcr_Allowed': 'Total Medicare Allowed',
        'Rndrng_NPI': 'Rendering NPI',
        'Rndrng_Prvdr_Last_Org_Name': 'Provider Last/Org Name',
        'Rndrng_Prvdr_First_Name': 'Provider First Name',
        'Rndrng_Prvdr_MI': 'Provider MI',
        'Rndrng_Prvdr_Crdntls': 'Provider Credentials',
        'Rndrng_Prvdr_Ent_Cd': 'Provider Entity Code',
        'Rndrng_Prvdr_St1': 'Provider Street 1',
        'Rndrng_Prvdr_St2': 'Provider Street 2',
        'Rndrng_Prvdr_City': 'Provider City',
        'Rndrng_Prvdr_State_Abrvtn': 'Provider State',
        'Rndrng_Prvdr_State_FIPS': 'Provider State FIPS',
        'Rndrng_Prvdr_Zip5': 'Provider Zip',
        'Rndrng_Prvdr_RUCA': 'Provider RUCA',
        'Rndrng_Prvdr_RUCA_Desc': 'Provider RUCA Description',
        'Rndrng_Prvdr_Cntry': 'Provider Country',
        'Rndrng_Prvdr_Type': 'Provider Type',
        'Rndrng_Prvdr_Mdcr_Prtcptg_Ind': 'Medicare Participation',
        'HCPCS_Desc': 'Procedure Description',
        'HCPCS_Drug_Ind': 'Drug Indicator',
        'Place_Of_Srvc': 'Place of Service',
        'Tot_Benes': 'Total Beneficiaries',
        'Tot_Bene_Day_Srvcs': 'Total Beneficiary Day Services',
        'Avg_Sbmtd_Chrg': 'Average Submitted Charge',
        'Avg_Mdcr_Alowd_Amt': 'Average Medicare Allowed Amount',
        'Avg_Mdcr_Pymt_Amt': 'Average Medicare Payment Amount',
        'Avg_Mdcr_Stdzd_Amt': 'Average Medicare Standardized Amount'
      };
      
      return headerMap[header] || header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Initialize fade-in animations for slide components
    function initSlideAnimations() {
      const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.3 // Trigger when 30% of the slide is visible
      };
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Add fade-in class to all components in the slide
            const components = entry.target.querySelectorAll('.slide-component');
            components.forEach(component => {
              component.classList.add('fade-in');
            });
          }
        });
      }, observerOptions);
      
      // Observe all slides
      const slides = document.querySelectorAll('.sticky');
      slides.forEach(slide => {
        observer.observe(slide);
      });
    }
    
    // Initialize typewriter effect when page loads
    window.addEventListener('load', () => {
      initTypewriterEffect();
      initSlideAnimations();
    });
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
}

// Main functions
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const npi = formData.get('npi').trim();
    const firstName = formData.get('firstName').trim();
    const lastName = formData.get('lastName').trim();
    const state = formData.get('state').trim().toUpperCase();

    // Validation
    if (!npi && (!firstName || !lastName)) {
        showMessage("Please enter either an NPI number OR both first and last name.", 'error');
        return;
    }

    if (state && state.length !== 2) {
        showMessage("State code must be 2 letters (e.g., CA, NY, TX)", 'error');
        return;
    }

    // Validate NPI format if provided
    if (npi && (!/^\d{10}$/.test(npi))) {
        showMessage("NPI must be exactly 10 digits.", 'error');
        return;
    }

    // Clear previous results
    clearMessages();
    searchResults.innerHTML = '';
    allResults = [];
    currentNpiIndex = 0;

    // Show results section
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');

    setLoading(searchBtn, true);
    showMessage("🔍 Searching for NPIs... This may take a moment due to CORS restrictions.", 'info');

    try {
        let npiList = [];
        
        if (npi) {
            // NPI provided - use it directly
            showMessage("🔍 Using provided NPI number...", 'info');
            npiList = [npi];
            showMessage(`✅ Using NPI ${npi}`, 'success');
        } else {
            // Search by name and state
            showMessage("📡 Attempting to connect to NPI Registry API...", 'info');
            npiList = await getNpi(firstName, lastName, state);
            
            if (npiList.length === 0) {
                showMessage("❌ No NPI found. Please check spelling or try again.", 'error');
                setLoading(searchBtn, false);
                return;
            }

            // Check if multiple NPIs found when searching by name
            if (npiList.length > 1) {
                showMessage("⚠️ We found multiple records with the same name. To get an accurate search, please search by NPI.", 'warning');
                setLoading(searchBtn, false);
                return;
            }

            showMessage(`✅ Found ${npiList.length} NPI(s) for ${firstName} ${lastName}`, 'success');
        }

        showMessage(`📊 Fetching CMS data for each NPI... This may take a few moments.`, 'info');
        totalNpis = npiList.length;
        updateProgress(0, totalNpis);

        // Process each NPI
        for (let i = 0; i < npiList.length; i++) {
            const currentNpi = npiList[i];
            showMessage(`📊 Fetching CMS data for NPI ${currentNpi}...`, 'info');
            
            const cmsData = await fetchCmsData(currentNpi);
            
            if (cmsData.length === 0) {
                showMessage(`⚠️ No CMS data found for NPI ${currentNpi}.`, 'warning');
            } else {
                showMessage(`✅ Data found for NPI ${currentNpi} (${cmsData.length} records)`, 'success');
                // Open new tab with results
                openResultsInNewTab(cmsData, currentNpi, firstName, lastName);

                allResults.push(...cmsData);
            }
            
            updateProgress(i + 1, totalNpis);
            await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UX
        }


    } catch (error) {
        console.error('Search error:', error);
        showMessage(`Search failed: ${error.message}`, 'error');
    } finally {
        setLoading(searchBtn, false);
    }
}

