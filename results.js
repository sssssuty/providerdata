// Load results data from localStorage
const PAGE_DATA = JSON.parse(localStorage.getItem('providerResults'));

if (!PAGE_DATA) {
    document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;"><h1>No data found</h1><p>Please return to the search page.</p></div>';
} else {
    let plotlyCharts = {};
    let CPT_DATA = PAGE_DATA.cptData || {};
    
    // Function to get CPT description
    function getCptDescription(hcpcsCode) {
        return CPT_DATA[hcpcsCode] || 'Description not available';
    }
    
    // Function to format description for tooltip
    function formatDescriptionForTooltip(description) {
        const words = description.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            if (currentLine.length + word.length + 1 <= 35) {
                if (currentLine === '') {
                    currentLine = word;
                } else {
                    currentLine += ' ' + word;
                }
            } else {
                if (currentLine !== '') {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        }
        
        if (currentLine !== '') {
            lines.push(currentLine);
        }
        
        return lines.join('\n');
    }
    
    // Typewriter effect for greeting text
    function initTypewriterEffect() {
        const greetingText = PAGE_DATA.greetingText || "Welcome!";
        const typewriterElement = document.getElementById('typewriter-text');
        const scrollInstruction = document.getElementById('scroll-instruction');
        
        let i = 0;
        typewriterElement.innerHTML = '';
        
        function typeWriter() {
            if (i < greetingText.length) {
                typewriterElement.innerHTML += greetingText.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            } else {
                setTimeout(() => {
                    scrollInstruction.style.opacity = '1';
                }, 500);
            }
        }
        
        setTimeout(typeWriter, 500);
    }
    
    // Initialize Google Charts
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(draw);
    
    function draw() {
        // Filter out J codes
        const filteredSummary = PAGE_DATA.summary.filter(r => !r.HCPCS_Cd.startsWith('J'));
        
        const labels = filteredSummary.map(r => r.HCPCS_Cd);
        const serviceValues = filteredSummary.map(r => r.Tot_Srvcs);
        const paymentValues = filteredSummary.map(r => r.Total_Mdcr_Allowed);
        
        create3DPie('chart1', labels, serviceValues, 'Procedure Code and Volume');
        create3DPie('chart2', labels, paymentValues, 'Procedure Code and Payment');
        
        createPlotlyChart('chart1', labels, serviceValues, 'Procedure Code and Volume');
        createPlotlyChart('chart2', labels, paymentValues, 'Procedure Code and Payment');
        
        renderTable('summaryTable', 'Summary by HCPCS', filteredSummary,
            ['HCPCS_Cd', 'Procedure_Code_Description', 'Tot_Srvcs', 'Total_Mdcr_Allowed']);
        
        const rawHeaders = Object.keys(PAGE_DATA.raw[0] || {});
        renderTable('rawTable', 'Source Data', PAGE_DATA.raw, rawHeaders);
        
        window.addEventListener('resize', () => {
            create3DPie('chart1', labels, serviceValues, 'Procedure Code and Volume');
            create3DPie('chart2', labels, paymentValues, 'Procedure Code and Payment');
        });
    }
    
    function create3DPie(containerId, labels, values, title) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div id="gc-' + containerId + '" class="google-chart"></div>';
        const chartDiv = document.getElementById('gc-' + containerId);
        
        const blueColors = ['#2D40CB', '#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#2563EB', '#1E40AF', '#1E3A8A', '#1F2937', '#374151', '#4B5563'];
        
        const sortedData = labels.map((label, index) => [label, values[index]])
            .sort((a, b) => b[1] - a[1]);
        
        const isMobile = window.innerWidth <= 768;
        const limitedData = isMobile ? sortedData.slice(0, 6) : sortedData;
        
        const data = new google.visualization.DataTable();
        data.addColumn('string', 'Procedure Code');
        data.addColumn('number', 'Value');
        data.addColumn({ type: 'string', role: 'tooltip' });
        
        const dataWithTooltips = limitedData.map(row => {
            const code = row[0];
            const value = row[1];
            const description = getCptDescription(code);
            const formattedDescription = formatDescriptionForTooltip(description);
            const tooltipText = code + '\n\nValue: ' + value.toLocaleString() + '\n\n' + formattedDescription;
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
            tooltip: { textStyle: { fontSize: 12, color: '#000000' }, trigger: 'focus', isHtml: false, showColorCode: false },
            chartArea: { left: 20, top: 60, right: 20, bottom: 80, width: '100%', height: '100%' },
            width: '100%',
            height: 600,
            animation: { startup: true, duration: 1000, easing: 'out' }
        };
        
        const chart = new google.visualization.PieChart(chartDiv);
        chart.draw(data, options);
        
        google.visualization.events.addListener(chart, 'onmouseover', function (e) {
            const allSlices = chartDiv.querySelectorAll('svg g[aria-label*="slice"]');
            allSlices.forEach((slice, index) => {
                if (index !== e.row) {
                    slice.style.opacity = '0.5';
                }
            });
        });
        
        google.visualization.events.addListener(chart, 'onmouseout', function (e) {
            const allSlices = chartDiv.querySelectorAll('svg g[aria-label*="slice"]');
            allSlices.forEach(slice => {
                slice.style.opacity = '1';
            });
        });
    }
    
    function createPlotlyChart(chartId, labels, values, title) {
        const blueColors = ['#2D40CB', '#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#2563EB', '#1E40AF', '#1E3A8A', '#1F2937', '#374151', '#4B5563'];
        
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
    
    function renderTable(containerId, title, rows, headers) {
        const container = document.getElementById(containerId);
        const isRawTable = title.includes('Source Data');
        const isSummaryTable = title.includes('Summary by HCPCS');
        let tableClass = '';
        if (isRawTable) tableClass += ' raw-table';
        if (isSummaryTable) tableClass += ' summary-table';
        
        // Sort summary table by Total Medicare Allowed (highest first)
        if (isSummaryTable) {
            rows = [...rows].sort((a, b) => b.Total_Mdcr_Allowed - a.Total_Mdcr_Allowed);
        }
        
        const readableHeaders = headers.map(h => convertToReadableHeader(h));
        
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
    
    function initSlideAnimations() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.3
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const components = entry.target.querySelectorAll('.slide-component');
                    components.forEach(component => {
                        component.classList.add('fade-in');
                    });
                }
            });
        }, observerOptions);
        
        const slides = document.querySelectorAll('.sticky');
        slides.forEach(slide => {
            observer.observe(slide);
        });
    }
    
    // Initialize typewriter effect when page loads
    window.addEventListener('load', () => {
        initTypewriterEffect();
        initSlideAnimations();
        initComparisonForm();
    });
    
    // Handle comparison form submission
    function initComparisonForm() {
        const comparisonForm = document.getElementById('comparisonForm');
        const comparisonStatus = document.getElementById('comparisonStatus');
        
        if (!comparisonForm) return;
        
        comparisonForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            
            const formData = new FormData(comparisonForm);
            const npi = formData.get('npi').trim();
            const firstName = formData.get('firstName').trim();
            const lastName = formData.get('lastName').trim();
            const state = formData.get('state').trim().toUpperCase();
            
            // Validation
            if (!npi && (!firstName || !lastName)) {
                showComparisonMessage("Please enter either an NPI number OR both first and last name.", 'error');
                return;
            }
            
            if (state && state.length !== 2) {
                showComparisonMessage("State code must be 2 letters (e.g., CA, NY, TX)", 'error');
                return;
            }
            
            if (npi && (!/^\d{10}$/.test(npi))) {
                showComparisonMessage("NPI must be exactly 10 digits.", 'error');
                return;
            }
            
            const submitBtn = comparisonForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Searching...';
            
            try {
                showComparisonMessage("🔍 Searching for provider...", 'info');
                
                let npiList = [];
                
                if (npi) {
                    npiList = [npi];
                    showComparisonMessage(`✅ Using NPI ${npi}`, 'success');
                } else {
                    // Use global functions from parent
                    if (typeof getNpi === 'undefined') {
                        showComparisonMessage("Error: Search functions not available", 'error');
                        return;
                    }
                    
                    npiList = await getNpi(firstName, lastName, state);
                    
                    if (npiList.length === 0) {
                        showComparisonMessage("❌ No NPI found. Please check spelling or try again.", 'error');
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = 'Confirm';
                        return;
                    }
                    
                    if (npiList.length > 1) {
                        showComparisonMessage("⚠️ Multiple records found. Please search by NPI for accurate results.", 'warning');
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = 'Confirm';
                        return;
                    }
                    
                    showComparisonMessage(`✅ Found NPI for ${firstName} ${lastName}`, 'success');
                }
                
                showComparisonMessage("📊 Fetching claim data...", 'info');
                
                if (typeof fetchCmsData === 'undefined') {
                    showComparisonMessage("Error: Data fetch functions not available", 'error');
                    return;
                }
                
                const cmsData2 = await fetchCmsData(npiList[0]);
                
                if (cmsData2.length === 0) {
                    showComparisonMessage(`⚠️ No data found for NPI ${npiList[0]}.`, 'warning');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Confirm';
                    return;
                }
                
                showComparisonMessage(`✅ Data found! Opening comparison view...`, 'success');
                
                // Prepare data for provider 2
                const processedData2 = cmsData2.map(row => ({
                    ...row,
                    Tot_Srvcs: parseFloat(row.Tot_Srvcs) || 0,
                    Avg_Mdcr_Alowd_Amt: parseFloat(row.Avg_Mdcr_Alowd_Amt) || 0
                }));
                processedData2.forEach(row => {
                    row.Total_Mdcr_Allowed = row.Avg_Mdcr_Alowd_Amt * row.Tot_Srvcs;
                });
                const grouped2 = {};
                processedData2.forEach(row => {
                    const code = row.HCPCS_Cd;
                    if (!grouped2[code]) {
                        grouped2[code] = { Tot_Srvcs: 0, Total_Mdcr_Allowed: 0 };
                    }
                    grouped2[code].Tot_Srvcs += row.Tot_Srvcs;
                    grouped2[code].Total_Mdcr_Allowed += row.Total_Mdcr_Allowed;
                });
                const summaryRows2 = Object.keys(grouped2).map(code => ({
                    HCPCS_Cd: code,
                    Procedure_Code_Description: getCptDescription(code),
                    Tot_Srvcs: grouped2[code].Tot_Srvcs,
                    Total_Mdcr_Allowed: grouped2[code].Total_Mdcr_Allowed
                }));
                
                // Create combined CPT data
                const chartLabels1 = Object.keys(PAGE_DATA.summary.reduce((acc, r) => ({ ...acc, [r.HCPCS_Cd]: true }), {}));
                const chartLabels2 = Object.keys(grouped2);
                const allLabels = [...new Set([...chartLabels1, ...chartLabels2])];
                const limitedCptData = {};
                allLabels.forEach(code => {
                    limitedCptData[code] = getCptDescription(code);
                });
                
                const provider2Data = { raw: cmsData2, summary: summaryRows2, cptData: limitedCptData };
                
                // Store comparison data in localStorage
                const comparisonData = { provider1: PAGE_DATA, provider2: provider2Data };
                localStorage.setItem('comparisonData', JSON.stringify(comparisonData));
                
                // Navigate to comparison page
                window.open('comparison.html', '_blank');
                
            } catch (error) {
                console.error('Comparison search error:', error);
                showComparisonMessage(`Search failed: ${error.message}`, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Confirm';
            }
        });
        
        function showComparisonMessage(message, type) {
            comparisonStatus.style.display = 'block';
            comparisonStatus.className = '';
            
            const colors = {
                info: '#3B82F6',
                success: '#10B981',
                error: '#EF4444',
                warning: '#F59E0B'
            };
            
            comparisonStatus.style.background = colors[type] || '#3B82F6';
            comparisonStatus.style.color = '#ffffff';
            comparisonStatus.innerHTML = message;
        }
    }
}

