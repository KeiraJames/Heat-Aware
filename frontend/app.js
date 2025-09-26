document.addEventListener('DOMContentLoaded', () => {
    // Fetch data from the /api/data route which handles the temperature filter
    fetch('/api/data')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load data (Status: ${response.status})`);
            }
            return response.json();
        })
        .then(data => {
            const list = document.getElementById('data-list');
            list.innerHTML = ''; 

            if (data.length === 0) {
                 list.innerHTML = '<li>No temperature readings were found above 20°C.</li>';
                 return;
            }

            // Display the filtered high-temperature records
            data.forEach((item) => {
                const li = document.createElement('li');
                
                // Format the output
                const temp = item.temperature ? item.temperature.toFixed(2) : 'N/A';
                const moisture = item.moisture_value ? item.moisture_value : 'N/A';

                li.innerHTML = `
                    <strong>Temperature:</strong> <span style="color: red;">${temp}°C</span> | 
                    <strong>Moisture:</strong> ${moisture} | 
                    <small>ID: ${item._id}</small>
                `
                ;
                list.appendChild(li);
            });
        })
        .catch(error => {
            console.error('Fetch error:', error);
            const list = document.getElementById('data-list');
            list.innerHTML = `<li style="color: red;">ERROR: ${error.message}. Check the Node.js server status and console.</li>`;
        });
});