let selectedLat = null;
let selectedLng = null;
let irradiation = null;

// تغيير طريقة الإدخال
document.querySelectorAll('input[name="inputMode"]').forEach(el => {
  el.addEventListener('change', () => {
    const mode = document.querySelector('input[name="inputMode"]:checked').value;
    document.getElementById('directInputs').style.display = (mode === 'direct') ? 'block' : 'none';
    document.getElementById('deviceInputs').style.display = (mode === 'devices') ? 'block' : 'none';
  });
});

function addDevice() {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" placeholder="جهاز"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>
  `;
  document.getElementById('devicesTable').appendChild(row);
}

// إعداد الخريطة
const map = L.map('map').setView([34.5, 3], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'OpenStreetMap'
}).addTo(map);

map.on('click', async function (e) {
  selectedLat = e.latlng.lat;
  selectedLng = e.latlng.lng;
  document.getElementById('selectedLocation').textContent = '📍 الإحداثيات: ' + selectedLat.toFixed(4) + ', ' + selectedLng.toFixed(4);

  try {
    const response = await fetch(`https://re.jrc.ec.europa.eu/api/v5_2/seriescalc?lat=${selectedLat}&lon=${selectedLng}&outputformat=json&startyear=2020&endyear=2020&month=1&peakpower=1&loss=0`);
    const data = await response.json();
    if (data.outputs && data.outputs.monthly) {
      const monthlyData = data.outputs.monthly;
      const avg = monthlyData.reduce((sum, month) => sum + month.Gm, 0) / monthlyData.length;
      irradiation = avg / 30 / 1000;
      document.getElementById('irradiationValue').textContent = '☀️ الإشعاع الشمسي: ' + irradiation.toFixed(2) + ' kWh/m²';
    } else {
      irradiation = 5;
      document.getElementById('irradiationValue').textContent = '☀️ إشعاع تقديري: 5 kWh/m²';
    }
  } catch (error) {
    irradiation = 5;
    document.getElementById('irradiationValue').textContent = '☀️ إشعاع تقديري: 5 kWh/m²';
  }
});

function calculate() {
  let dailyKWh = 0;
  const mode = document.querySelector('input[name="inputMode"]:checked').value;

  if (mode === 'direct') {
    const daily = parseFloat(document.getElementById('dailyUsage').value) || 0;
    const monthly = parseFloat(document.getElementById('monthlyUsage').value) || 0;
    dailyKWh = daily || (monthly / 30);
  } else {
    const rows = document.querySelectorAll('#devicesTable tr:not(:first-child)');
    rows.forEach(row => {
      const power = parseFloat(row.children[1].querySelector('input').value) || 0;
      const hours = parseFloat(row.children[2].querySelector('input').value) || 0;
      const count = parseFloat(row.children[3].querySelector('input').value) || 0;
      dailyKWh += (power * hours * count) / 1000;
    });
  }

  const systemVoltage = parseFloat(document.getElementById('systemVoltage').value);
  const panelWatt = parseFloat(document.getElementById('panelWatt').value);
  const panelVoltage = parseFloat(document.getElementById('panelVoltage').value);
  const batteryCapacity = parseFloat(document.getElementById('batteryCapacity').value);
  const batteryVoltage = parseFloat(document.getElementById('batteryVoltage').value);

  if (!irradiation) irradiation = 5;

  const neededWhPerDay = dailyKWh * 1000;
  const panelOutputPerDay = panelWatt * irradiation;
  const numPanels = Math.ceil(neededWhPerDay / panelOutputPerDay);

  const panelsInSeries = Math.ceil(systemVoltage / panelVoltage);
  const panelsInParallel = Math.ceil(numPanels / panelsInSeries);

  const requiredAh = neededWhPerDay / systemVoltage;
  const batteriesInSeries = Math.ceil(systemVoltage / batteryVoltage);
  const batteriesInParallel = Math.ceil(requiredAh / batteryCapacity);
  const totalBatteries = batteriesInSeries * batteriesInParallel;

  document.getElementById('results').innerHTML = `
    ✅ الاستهلاك اليومي: ${dailyKWh.toFixed(2)} kWh<br>
    ✅ الإشعاع الشمسي: ${irradiation.toFixed(2)} kWh/m²<br>
    🔆 عدد الألواح المطلوبة: ${numPanels}<br>
    🔌 توزيع الألواح: ${panelsInSeries} على التسلسل × ${panelsInParallel} على التفرع<br>
    🔋 عدد البطاريات المطلوبة: ${totalBatteries}<br>
    🔌 توزيع البطاريات: ${batteriesInSeries} على التسلسل × ${batteriesInParallel} على التفرع
  `;
}
