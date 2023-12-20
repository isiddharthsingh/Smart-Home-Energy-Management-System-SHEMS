const ctx = document.getElementById('dailyEnergyConsumptionChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line', // Change this to the type of chart you want
  data: {
    labels: [], // Fill this array with the labels for the x-axis
    datasets: [{
      label: 'Daily Energy Consumption',
      data: [], // Fill this array with the data for the y-axis
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  },
  options: {
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
});