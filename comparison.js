// Load comparison data from localStorage
const PAGE_DATA = JSON.parse(localStorage.getItem('comparisonData'));

if (!PAGE_DATA) {
    document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;"><h1>No data found</h1><p>Please return to the search page.</p></div>';
} else {
    let CPT_DATA = PAGE_DATA.provider1.cptData || {};
    
    function getCptDescription(hcpcsCode) {
        return CPT_DATA[hcpcsCode] || 'Description not available';
    }
    
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
    
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(draw);
    
    function draw() {
        if (!PAGE_DATA) {
            console.error('No data available');
            return;
        }
        
        console.log('Drawing comparison charts...');
        console.log('Provider 1 data:', PAGE_DATA.provider1);
        console.log('Provider 2 data:', PAGE_DATA.provider2);
        
        const filtered1 = PAGE_DATA.provider1.summary.filter(r => !r.HCPCS_Cd.startsWith('J'));
        const labels1 = filtered1.map(r => r.HCPCS_Cd);
        const serviceValues1 = filtered1.map(r => r.Tot_Srvcs);
        const paymentValues1 = filtered1.map(r => r.Total_Mdcr_Allowed);
        
        const filtered2 = PAGE_DATA.provider2.summary.filter(r => !r.HCPCS_Cd.startsWith('J'));
        const labels2 = filtered2.map(r => r.HCPCS_Cd);
        const serviceValues2 = filtered2.map(r => r.Tot_Srvcs);
        const paymentValues2 = filtered2.map(r => r.Total_Mdcr_Allowed);
        
        console.log('Provider 1 labels:', labels1);
        console.log('Provider 2 labels:', labels2);
        
        create3DPie('chart1-volume', labels1, serviceValues1);
        create3DPie('chart1-payment', labels1, paymentValues1);
        create3DPie('chart2-volume', labels2, serviceValues2);
        create3DPie('chart2-payment', labels2, paymentValues2);
        
        renderTable('table1-summary', filtered1);
        renderTable('table2-summary', filtered2);
        
        if (PAGE_DATA.provider1.raw && PAGE_DATA.provider1.raw.length > 0) {
            const p1 = PAGE_DATA.provider1.raw[0];
            if (p1 && p1.Rndrng_Prvdr_Last_Org_Name) {
                document.getElementById('provider1Title').textContent = 'Dr. ' + p1.Rndrng_Prvdr_Last_Org_Name;
            }
        }
        
        if (PAGE_DATA.provider2.raw && PAGE_DATA.provider2.raw.length > 0) {
            const p2 = PAGE_DATA.provider2.raw[0];
            if (p2 && p2.Rndrng_Prvdr_Last_Org_Name) {
                document.getElementById('provider2Title').textContent = 'Dr. ' + p2.Rndrng_Prvdr_Last_Org_Name;
            }
        }
    }
    
    function create3DPie(containerId, labels, values) {
        console.log('Creating chart:', containerId, 'Labels:', labels.length, 'Values:', values.length);
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }
        if (!labels || labels.length === 0) {
            console.error('No data for chart:', containerId);
            return;
        }
        
        const blueColors = ['#2D40CB', '#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#2563EB', '#1E40AF'];
        
        const sortedData = labels.map((label, index) => [label, values[index]]).sort((a, b) => b[1] - a[1]);
        
        const data = new google.visualization.DataTable();
        data.addColumn('string', 'Procedure Code');
        data.addColumn('number', 'Value');
        data.addColumn({ type: 'string', role: 'tooltip' });
        
        const dataWithTooltips = sortedData.map(row => {
            const code = row[0];
            const value = row[1];
            const description = getCptDescription(code);
            const formattedDescription = formatDescriptionForTooltip(description);
            const tooltipText = code + '\n\nValue: ' + value.toLocaleString() + '\n\n' + formattedDescription;
            return [code, value, tooltipText];
        });
        
        data.addRows(dataWithTooltips);
        
        const options = {
            is3D: true,
            backgroundColor: 'transparent',
            colors: blueColors,
            legend: { position: 'right', textStyle: { fontSize: 11, color: '#ffffff' } },
            pieSliceText: 'percentage',
            pieSliceTextStyle: { fontSize: 10, color: 'white' },
            tooltip: { textStyle: { fontSize: 12 }, isHtml: false, showColorCode: false },
            chartArea: { width: '90%', height: '80%' },
            width: '100%',
            height: 400
        };
        
        const chart = new google.visualization.PieChart(container);
        chart.draw(data, options);
    }
    
    function renderTable(tableId, rows) {
        const table = document.getElementById(tableId);
        
        // Sort by Total Medicare Allowed (highest first)
        const sortedRows = [...rows].sort((a, b) => b.Total_Mdcr_Allowed - a.Total_Mdcr_Allowed);
        
        const headers = ['Procedure Code', 'Procedure Code Description', 'Total Services', 'Total Medicare Allowed'];
        const thead = '<thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead>';
        
        const tbody = '<tbody>' + sortedRows.map(r => {
            const description = getCptDescription(r.HCPCS_Cd);
            return '<tr><td>' + r.HCPCS_Cd + '</td><td>' + description + '</td><td>' + r.Tot_Srvcs.toLocaleString() + '</td><td>$' + r.Total_Mdcr_Allowed.toFixed(2) + '</td></tr>';
        }).join('') + '</tbody>';
        
        table.innerHTML = thead + tbody;
    }
}

