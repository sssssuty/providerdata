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

// Helper functions - exposed to window for cross-tab access
window.getCptDescription = function getCptDescription(hcpcsCode) {
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
    
    throw new Error('All CORS proxies failed. Please try one of these solutions:\n1. Run the app from a web server (not file://)\n2. Use a browser extension like "CORS Unblock"\n3. Try a different browser or incognito mode\n4. Database may be temporarily unavailable.');
}

// API Functions - exposed to window for cross-tab access
window.getNpi = async function getNpi(firstName, lastName, state = null) {
    // Check cache first
    const cacheKey = `npi_${firstName.toLowerCase()}_${lastName.toLowerCase()}_${(state || '').toLowerCase()}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
        console.log('Using cached result');
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
            throw new Error(`API error: ${response.status}`);
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
                5. <strong>API status:</strong> Database may be temporarily unavailable
            `, 'warning');
        } else {
            showMessage(`API error: ${error.message}`, 'error');
        }
        
        return [];
    }
}

window.fetchCmsData = async function fetchCmsData(npi, limit = 1000, offset = 0) {
    // Check cache first
    const cacheKey = `cms_${npi}_${limit}_${offset}`;
    const cached = getCachedResult(cacheKey);
    if (cached) {
        console.log(`Using cached claim data for NPI ${npi}`);
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
            throw new Error(`Failed to fetch claim data for NPI ${npi}: ${response.status}`);
        }
        
        const data = await response.json();
        const result = Array.isArray(data) ? data : [];
        
        // Cache successful result
        if (result.length > 0) {
            setCachedResult(cacheKey, result);
        }
        
        return result;
    } catch (error) {
        console.error('Error fetching data:', error);
        
        if (error.message.includes('CORS proxies failed')) {
            showMessage(`⚠️ Data fetch failed for NPI ${npi}. Try running from a web server.`, 'warning');
        } else {
            showMessage(`Failed to fetch claim data for NPI ${npi}: ${error.message}`, 'error');
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

    // Convert names to title case
    const titleCase = (str) => {
        return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };
    
    let lastNameForGreeting;
    if (firstName && lastName) {
        lastNameForGreeting = titleCase(lastName);
    } else if (cmsData.length > 0 && cmsData[0].Rndrng_Prvdr_Last_Org_Name) {
        lastNameForGreeting = titleCase(cmsData[0].Rndrng_Prvdr_Last_Org_Name);
    } else {
        lastNameForGreeting = 'Provider';
    }

    // Store data in localStorage
    const resultsData = {
        raw: cmsData,
        summary: summaryRows,
        cptData: limitedCptData,
        npi: npi,
        greetingText: `Hi Dr. ${lastNameForGreeting}, here's your data.`
    };
    
    localStorage.setItem('providerResults', JSON.stringify(resultsData));
    
    // Navigate to results page
    window.open('results.html', '_blank');
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
            showMessage("📡 Connecting to the database...", 'info');
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

        showMessage(`📊 Fetching claim data... This may take a few moments.`, 'info');
        totalNpis = npiList.length;
        updateProgress(0, totalNpis);

        // Process each NPI
        for (let i = 0; i < npiList.length; i++) {
            const currentNpi = npiList[i];
            showMessage(`📊 Fetching claim data for NPI ${currentNpi}...`, 'info');
            
            const cmsData = await fetchCmsData(currentNpi);
            
            if (cmsData.length === 0) {
                showMessage(`⚠️ No data found for NPI ${currentNpi}.`, 'warning');
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

