// For Input Masking

const licenseInput = document.getElementById('licenseKey');
if (licenseInput) {
    licenseInput.addEventListener('input', function (e) {
        let input = e.target;
        let value = input.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        let formattedValue = value.match(/.{1,4}/g)?.join('-') || ''; 
        input.value = formattedValue;
    });
}

// For Custom Select

let x, i, j, l, ll, selElmnt, a, b, c;
/* Look for any elements with the class "custom-select": */
x = document.getElementsByClassName("custom-select");
l = x.length;

for (i = 0; i < l; i++) {
  selElmnt = x[i].getElementsByTagName("select")[0];
  ll = selElmnt.length;

  /* Create a new DIV that will act as the selected item: */
  a = document.createElement("DIV");
  a.setAttribute("class", "select-selected");
  a.innerHTML = selElmnt.options[selElmnt.selectedIndex].innerHTML;
  x[i].appendChild(a);

  /* Create a new DIV that will contain the option list: */
  b = document.createElement("DIV");
  b.setAttribute("class", "select-items select-hide");

  for (j = 1; j < ll; j++) {
    /* Create a new DIV that will act as an option item: */
    c = document.createElement("DIV");
    c.innerHTML = selElmnt.options[j].innerHTML;

    c.addEventListener("click", function () {
      /* When an item is clicked, update the original select box and the selected item: */
      let y, k, s, h, sl, yl;
      s = this.parentNode.parentNode.getElementsByTagName("select")[0];
      sl = s.length;
      h = this.parentNode.previousSibling;

      for (let i = 0; i < sl; i++) {
        if (s.options[i].innerHTML === this.innerHTML) {
          s.selectedIndex = i;
          h.innerHTML = this.innerHTML;
          y = this.parentNode.getElementsByClassName("same-as-selected");
          yl = y.length;

          for (k = 0; k < yl; k++) {
            y[k].removeAttribute("class");
          }
          this.setAttribute("class", "same-as-selected");
          break;
        }
      }
      h.click();
    });

    b.appendChild(c);
  }

  x[i].appendChild(b);

  a.addEventListener("click", function (e) {
    /* When the select box is clicked, close any other select boxes, and open/close the current select box: */
    e.stopPropagation();
    closeAllSelect(this);
    this.nextSibling.classList.toggle("select-hide");
    this.classList.toggle("select-arrow-active");
  });
}

function closeAllSelect(elmnt) {
  /* A function that will close all select boxes in the document, except the current select box: */
  let x, y, i, xl, yl, arrNo = [];
  x = document.getElementsByClassName("select-items");
  y = document.getElementsByClassName("select-selected");
  xl = x.length;
  yl = y.length;

  for (i = 0; i < yl; i++) {
    if (elmnt === y[i]) {
      arrNo.push(i);
    } else {
      y[i].classList.remove("select-arrow-active");
    }
  }

  for (i = 0; i < xl; i++) {
    if (!arrNo.includes(i)) {
      x[i].classList.add("select-hide");
    }
  }
}

/* If the user clicks anywhere outside the select box, then close all select boxes: */
document.addEventListener("click", closeAllSelect);

document.addEventListener("DOMContentLoaded", function () {

  const sensorElement = document.getElementById("sensor-data");
  let isModbusConnected = false;
  let modbusAddressMap = {};
  const loaderOverlay = document.getElementById("table-loader-overlay");
  const scanBtn = document.getElementById("scanBtn");
  const formInputs = document.querySelectorAll("#sensorForm input, #sensorForm select");  

  document.getElementById("submit-login")?.addEventListener("click", async function (event) {
    event.preventDefault();
  
    const username = document.getElementById("username")?.value?.trim();
    const password = document.getElementById("password-input")?.value?.trim();
  
    if (!username || !password) {
      showToast("Please enter both username and password.");
      return;
    }
  
    const result = await window.electron.loginCheck(username, password);

    if (!result) return showToast("Login failed.");
  
    if (result.expired) {
      showToast("Your license is expired or not yet active.");
      return;
    }
    
    if (result.from === "local") {
      showMainSection("pages-with-side-bar");
    } else if (result.from === "api") {
      window._tempLogin = result.record;
      showMainSection("activation");
    }
  });

  document.getElementById("submit-licence-key")?.addEventListener("click", async function (event) {
    event.preventDefault();
  
    const enteredKey = document.getElementById("licenseKey")?.value?.trim();
  
    // Always validate presence
    if (!enteredKey) {
      showToast("Please enter a license key.");
      return;
    }
  
    const saved = window._tempLogin;
  
    if (!saved) {
      showToast("Session expired. Please log in again.");
      showMainSection("login");
      return;
    }
  
    if (enteredKey !== saved.serial_key) {
      showToast("❌ Invalid license key.");
      return;
    }
  
    const success = await window.electron.saveCredentials(saved);
  
    if (success) {
      showMainSection("pages-with-side-bar");
    } else {
      showToast("Failed to save license data.");
    }
  });  
  
  // Disable Scan button when clicked
  scanBtn?.addEventListener("click", () => {
    scanBtn.disabled = true;
  });

  // Re-enable Scan button when any form input changes
  formInputs.forEach((input) => {
    input.addEventListener("input", () => {
      scanBtn.disabled = false;
    });

    input.addEventListener("change", () => {
      scanBtn.disabled = false;
    });
  });

  window.electron.onModbusConnection((status) => {
    isModbusConnected = status;
  });

  window.electron.onModbusConnectionError((errorMessage) => {
    
    loaderOverlay.style.display = "none";
    const tbody = document.querySelector(".table tbody");
    if (!tbody) return;
  
    tbody.innerHTML = ""; // Clear any previous data
    const errorRow = document.createElement("tr");
    errorRow.innerHTML = `
      <td colspan="2" style="color: red; text-align: left;">❌ Error! Please reconfigure and try again later.</td>
    `;
    tbody.appendChild(errorRow);
  });

  window.electron.onSerialData((data) => {
    loaderOverlay.style.display = "none";
    const tbody = document.querySelector(".table tbody");
    if (!tbody) return;
  
    tbody.innerHTML = "";
    modbusAddressMap = {};
  
    const lastAddress = parseInt(document.getElementById("lastAddress")?.value);
    const length = parseInt(document.getElementById("length")?.value);
  
    if (isNaN(lastAddress) || isNaN(length)) {
      const errorRow = document.createElement("tr");
      errorRow.innerHTML = `
        <td colspan="2" style="color: red; text-align: left;">⚠️ Invalid last address or length</td>
      `;
      tbody.appendChild(errorRow);
      return;
    }
  
    for (let i = 0; i < length && i < data.length; i++) {
      const currentAddress = lastAddress + i;
      const value = data[i];
  
      modbusAddressMap[currentAddress] = value;
  
      const row = document.createElement("tr");
      row.innerHTML = `
        <th scope="row"><a href="#" class="fw-medium">${currentAddress}</a></th>
        <td>${value}</td>
      `;
      tbody.appendChild(row);
    }
  });  

  function showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) return;
  
    toast.textContent = message;
    toast.classList.add("show");
  
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  function getRegisterValue(address) {
    return modbusAddressMap[address] ?? "0";
  }

  // Main sections
  const mainSections = ["login", "activation", "pages-with-side-bar"];
  
  // Sidebar sections inside 'pages-with-side-bar'
  const sidebarSections = [
      "dashboard", "configuration", "sensor-mapping", "pid-diagram",
      "realtime-data", "charts", "download-reports", "refresh-interval",
      "software-version", "licence-validity", "downhold-data"
  ];

  function showMainSection(activeSection) {
      mainSections.forEach(id => {
          const section = document.getElementById(id);
          if (section) {
              if (id === activeSection) {
                  section.classList.remove("hide-div"); // Show active section
              } else {
                  section.classList.add("hide-div"); // Hide others
              }
          }
      });

      if (activeSection === "pages-with-side-bar") {
          showSidebarSection("dashboard"); // Default to dashboard when opening sidebar
      }
  }

  function showSidebarSection(activeSidebar) {
    // Hide/show relevant section
    sidebarSections.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        section.classList.toggle("hide-div", id !== activeSidebar);
      }
    });
  
    // Remove 'active' class from all nav links
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.remove("active");
    });
  
    // Add 'active' to the clicked link (based on sidebar ID convention)
    const activeLink = document.querySelector(`#${activeSidebar}-click`);
    if (activeLink) {
      activeLink.classList.add("active");
    }
  }
  
  // Show 'activation' when 'submit-login' is clicked
  // document.getElementById("submit-login")?.addEventListener("click", function (event) {
  //     event.preventDefault();
  //     showMainSection("activation");
  // });

  // Show 'pages-with-side-bar' when 'submit-licence-key' is clicked
  // document.getElementById("submit-licence-key")?.addEventListener("click", function (event) {
  //     event.preventDefault();
  //     showMainSection("pages-with-side-bar");
  // });

  document.querySelector(".modal-footer .btn-success")?.addEventListener("click", function () {

    loaderOverlay.style.display = "flex";

    const config = {
      port: document.getElementById("port").value,
      baudrate: parseInt(document.getElementById("baudrate").value),
      length: parseInt(document.getElementById("length").value),
      dataBits: parseInt(document.getElementById("dataBits").value),
      parity: document.getElementById("parity").value,
      stopBits: parseInt(document.getElementById("stopBits").value),
      timeout: parseInt(document.getElementById("timeout").value),
      lastAddress: parseInt(document.getElementById("lastAddress").value),
    };

    // ✅ Simple front-end validation
    if (
      !config.port ||
      isNaN(config.baudrate) ||
      isNaN(config.length) ||
      isNaN(config.dataBits) ||
      !config.parity ||
      isNaN(config.stopBits) ||
      isNaN(config.timeout) ||
      isNaN(config.lastAddress)
    ) {
      showToast("Please fill all required Modbus fields correctly.");
      return;
    }
  
    // console.log("📨 Sending config to main process:", config);
    window.electron.sendModbusConfig(config);
  });

  // Sidebar navigation event listeners
  const sidebarLinks = [
      { id: "dashboard-click", target: "dashboard" },
      { id: "configuration-click", target: "configuration" },
      { id: "sensor-mapping-click", target: "sensor-mapping" },
      { id: "pid-diagram-click", target: "pid-diagram" },
      { id: "realtime-data-click", target: "realtime-data" },
      { id: "charts-click", target: "charts" },
      { id: "download-reports-click", target: "download-reports" },
      { id: "refresh-interval-click", target: "refresh-interval" },
      { id: "licence-validity-click", target: "licence-validity" },
      { id: "software-version-click", target: "software-version" },
      { id: "downhold-data-click", target: "downhold-data" }
  ];

  sidebarLinks.forEach(link => {
      document.getElementById(link.id)?.addEventListener("click", function (event) {
          event.preventDefault();
          showSidebarSection(link.target);
      });
  });

  // Hide and show text inputs on toggle of checkbox on sensor mapping page
  document.querySelectorAll(".form-check-input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      const wrapper = this.closest(".form-check").querySelector(".input-wrapper");
      const input = wrapper?.querySelector("input");

      if (this.checked) {
        wrapper.style.display = "block";
        input?.focus();
      } else {
        wrapper.style.display = "none";
        if (input) input.value = ""; // Clear value when unchecked
      }
    });
  });

  // get checked sensor values from sensor mapping page
  function getCheckedSensorValues() {
    const results = [];
  
    document.querySelectorAll(".form-check").forEach((checkBlock) => {
      const checkbox = checkBlock.querySelector("input[type='checkbox']");
      const label = checkBlock.querySelector("label")?.innerText?.trim();
      const input = checkBlock.querySelector(".input-wrapper input");
  
      if (checkbox && checkbox.checked && input) {
        const value = input.value || null;
        const unit = input.dataset.unit || ""; // ✅ get unit from data attribute
  
        results.push({
          label: label || checkbox.id,
          value,
          unit,
        });
      }
    });
  
    return results;
  }
  
  // On "Check Values" button click
  document.getElementById("check_value")?.addEventListener("click", function () {
    const checkboxes = document.querySelectorAll("input.form-check-input:checked");
    const sensorData = [];
  
    let missingValue = false;
    let missingLabel = "";
  
    checkboxes.forEach((checkbox) => {
      const wrapper = checkbox.closest(".form-check");
      const input = wrapper.querySelector(".input-wrapper input");
  
      if (!input) return;
  
      const params = JSON.parse(input.dataset.params || "{}");
      const value = input.value.trim();
  
      if (!value) {
        missingValue = true;
        missingLabel = params.long || "Unnamed Sensor";
        return;
      }
  
      sensorData.push({
        unit: params.unit || "",
        long: params.long || "",
        annotation: params.annotation || "",
        value: value
      });
    });
  
    if (missingValue) {
      showToast(`Please enter a value for "${missingLabel}"`);
      return;
    }
  
    if (sensorData.length === 0) {
      showToast("No sensors selected.");
    } else {
      console.log("✅ Checked Sensor Data:", sensorData);
    }
  });

  // Show 'login' section by default
  showMainSection("login");
});



