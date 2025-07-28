let map = L.map('map').setView([28, 2], 6);
let selectedLatLng = null;
let marker = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

map.on('click', async function (e) {
  selectedLatLng = e.latlng;

  if (marker) map.removeLayer(marker);
  marker = L.marker(selectedLatLng).addTo(map);

  document.getElementById('selectedLocation').innerText = `📍 الإحداثيات: ${selectedLatLng.lat.toFixed(4)}, ${selectedLatLng.lng.toFixed(4)}`;
  await getIrradiation(selectedLatLng.lat, selectedLatLng.lng);
});

async function getIrradiation(lat, lon) {
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/series?lat=${lat}&lon=${lon}&outputformat=json&startyear=2020&endyear=2020&optimalangles=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const dailyData = data.outputs.daily;

    if (!dailyData || dailyData.length === 0) {
      document.getElementById("irradiationValue").innerText = "❌ لم يتم العثور على بيانات الإشعاع.";
      return;
    }

    // حساب المتوسط اليومي للإشعاع
    const total = dailyData.reduce((sum, d) => sum + (d.G(i) || 0), 0);
    const averageIrradiation = (total / dailyData.length).toFixed(2);
    document.getElementById("irradiationValue").innerText = `☀️ الإشعاع الشمسي: ${averageIrradiation} kWh/m²`;
    document.getElementById("irradiationValue").dataset.value = averageIrradiation;
  } catch (err) {
    console.error(err);
    document.getElementById("irradiationValue").innerText = "⚠️ حدث خطأ أثناء جلب بيانات الإشعاع.";
  }
}

function addDevice() {
  const table = document.getElementById("devicesTable");
  const row = table.insertRow();
  row.innerHTML = `
    <td><input type="text" placeholder="جهاز"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>
  `;
}

document.querySelectorAll("input[name='inputMode']").forEach(el => {
  el.addEventListener("change", () => {
    const mode = document.querySelector("input[name='inputMode']:checked").value;
    document.getElementById("directInputs").style.display = mode === "direct" ? "block" : "none";
    document.getElementById("deviceInputs").style.display = mode === "devices" ? "block" : "none";
  });
});

function calculate() {
  let energy = 0;
  const mode = document.querySelector("input[name='inputMode']:checked").value;

  if (mode === "direct") {
    energy = parseFloat(document.getElementById("dailyUsage").value) || (parseFloat(document.getElementById("monthlyUsage").value) / 30) || 0;
  } else {
    const rows = document.querySelectorAll("#devicesTable tr:not(:first-child)");
    rows.forEach(row => {
      const watt = parseFloat(row.cells[1].children[0].value);
      const hours = parseFloat(row.cells[2].children[0].value);
      const count = parseFloat(row.cells[3].children[0].value);
      if (watt && hours && count) {
        energy += (watt * hours * count) / 1000;
      }
    });
  }

  const irradiation = parseFloat(document.getElementById("irradiationValue").dataset.value) || 5;
  const systemVoltage = parseFloat(document.getElementById("systemVoltage").value);

  const panelWatt = parseFloat(document.getElementById("panelWatt").value);
  const panelVoltage = parseFloat(document.getElementById("panelVoltage").value);

  const batteryCapacity = parseFloat(document.getElementById("batteryCapacity").value);
  const batteryVoltage = parseFloat(document.getElementById("batteryVoltage").value);

  const requiredPanels = Math.ceil((energy * 1000) / (irradiation * panelWatt));
  const panelsSeries = Math.ceil(systemVoltage / panelVoltage);
  const panelsParallel = Math.ceil(requiredPanels / panelsSeries);

  const batteryEnergyWh = energy * 1000;
  const batteryWh = batteryCapacity * batteryVoltage;
  const requiredBatteries = Math.ceil(batteryEnergyWh / batteryWh);
  const batteriesSeries = Math.ceil(systemVoltage / batteryVoltage);
  const batteriesParallel = Math.ceil(requiredBatteries / batteriesSeries);

  document.getElementById("results").innerHTML = `
    🔋 الاستهلاك اليومي: ${energy.toFixed(2)} kWh<br>
    ☀️ الإشعاع الشمسي: ${irradiation} kWh/m²<br>
    🔆 عدد الألواح المطلوبة: ${requiredPanels}<br>
    🔌 توزيع الألواح: ${panelsSeries} على التسلسل × ${panelsParallel} على التفرع<br>
    🔋 عدد البطاريات المطلوبة: ${requiredBatteries}<br>
    🔌 توزيع البطاريات: ${batteriesSeries} على التسلسل × ${batteriesParallel} على التفرع
  `;
}
