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

document.addEventListener("DOMContentLoaded", function () {

  const sensorElement = document.getElementById("sensor-data");
  let isModbusConnected = false;
  let modbusAddressMap = {};
  const loaderOverlay = document.getElementById("table-loader-overlay");
  const scanBtn = document.getElementById("scanBtn");
  const formInputs = document.querySelectorAll("#sensorForm input, #sensorForm select");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password-input");
  const loginBtn = document.getElementById("submit-login");

  function validateLoginFields() {
    const usernameFilled = usernameInput?.value.trim() !== "";
    const passwordFilled = passwordInput?.value.trim() !== "";

    loginBtn.disabled = !(usernameFilled && passwordFilled);
  }

  function toggleLoginLoading(state) {
    const loginBtn = document.getElementById("submit-login");
    const loginSpinner = document.getElementById("login-spinner");

    if (state) {
      loginBtn.disabled = true;
      loginSpinner.classList.remove("d-none");
    } else {
      loginBtn.disabled = false;
      loginSpinner.classList.add("d-none");
    }
  }

  // Attach listeners
  usernameInput?.addEventListener("input", validateLoginFields);
  passwordInput?.addEventListener("input", validateLoginFields);

  document.getElementById("submit-login")?.addEventListener("click", async function (event) {
    event.preventDefault();

    const username = document.getElementById("username")?.value?.trim();
    const password = document.getElementById("password-input")?.value?.trim();

    if (!username || !password) {
      showToast("Please enter both username and password.", "danger");
      return;
    }

    toggleLoginLoading(true); // 🌀 Show spinner

    try {
      const result = await window.electron.loginCheck(username, password);

      if (!result) {
        showToast("Login failed. Please try again.", "danger");
        return;
      }

      if (result.expired) {
        showToast("Your license is expired or not yet active.", "danger");
        return;
      }

      if (result.from === "local") {
        showMainSection("pages-with-side-bar");
        dashboardFullScreen();
      } else if (result.from === "api") {
        window._tempLogin = result.record;
        showMainSection("activation");
        revertFullscreenLayout();
      }

    } catch (err) {
      showToast("Something went wrong.", "danger");
      console.error("Login error:", err);
    } finally {
      toggleLoginLoading(false); // ✅ Always hide spinner
      validateLoginFields();     // Re-check form to enable/disable button based on input
    }
  });

  document.getElementById("submit-licence-key")?.addEventListener("click", async function (event) {
    event.preventDefault();

    const enteredKey = document.getElementById("licenseKey")?.value?.trim();

    // Always validate presence
    if (!enteredKey) {
      showToast("Please enter a license key.", "danger");
      return;
    }

    const saved = window._tempLogin;

    if (!saved) {
      showToast("Session expired. Please log in again.", "danger");
      showMainSection("login");
      revertFullscreenLayout();
      return;
    }

    if (enteredKey !== saved.serial_key) {
      showToast("❌ Invalid license key.", "danger");
      return;
    }

    const success = await window.electron.saveCredentials(saved);

    if (success) {
      showMainSection("pages-with-side-bar");
      dashboardFullScreen();
    } else {
      showToast("Failed to save license data.", "danger");
    }
  });

  // ✅ custom.js - Project creation logic

  document.getElementById("project-submit")?.addEventListener("click", async function (e) {
    e.preventDefault();

    const projectName = document.getElementById("project-name")?.value?.trim();
    if (!projectName) return showToast("Please enter a project name.", "danger");

    // Check if project already exists
    const exists = await window.electron.invoke("check-project-exists", projectName);
    if (exists) return showToast("Project already exists.", "danger");

    // Insert project
    const created = await window.electron.invoke("create-project", projectName);
    if (created?.id) {
      showToast("Project created successfully.", "success");
      revertFullscreenLayout();
      showMainSection("pages-with-side-bar");
      showSidebarSection("configuration");
      populateProjectsUI();
    } else {
      showToast("Failed to create project.", "danger");
    }
  });

  async function populateProjectsUI() {
    const select = document.getElementById("project-select");
    if (!select) return;

    select.innerHTML = "";

    const projects = await window.electron.getProjects();

    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });

    const createNewOption = document.createElement("option");
    createNewOption.value = "create-new";
    createNewOption.textContent = "➕ Create New Project";
    select.appendChild(createNewOption);

    select.onchange = function () {
      if (this.value === "create-new") {
        showMainSection("pages-with-side-bar");
        dashboardFullScreen();
        document.getElementById("project-name").value = "";
      }
    };
  }

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

  async function dashboardFullScreen() {
    document.querySelector(".app-menu")?.classList.add("d-none");
    document.getElementById("dashboard")?.classList.add("full-width-dashboard");
    document.getElementById("page-topbar").style.left = "0";
  
    const container = document.getElementById("recent-projects");
    container.innerHTML = "";
  
    const projects = await window.electron.getProjects();
  
    if (projects.length === 0) {
      const noProjectDiv = document.createElement("div");
      noProjectDiv.className = "bg-danger bg-opacity-10 border border-danger text-danger p-3 rounded mb-2";
      noProjectDiv.innerHTML = `<h6 class="mb-0 text-truncate" style="font-weight:normal;">No projects found. Please create one to get started.</h6>`;
      container.appendChild(noProjectDiv);
      return;
    }
  
    // Sort and append
    [...projects].reverse().forEach(project => {
      const div = document.createElement("div");
      div.className = "bg-info bg-opacity-10 border border-info text-info p-3 rounded mb-2 cursor-pointer clickable-project";
      div.dataset.id = project.id;
      div.innerHTML = `<h6 class="mb-0 text-truncate">${project.name}</h6>`;
      container.appendChild(div);
    });
  }
  
  document.getElementById("recent-projects")?.addEventListener("click", async function (e) {
    
    const clicked = e.target.closest(".clickable-project");
    if (!clicked) return;
  
    const projectId = clicked.dataset.id;
    if (!projectId) return;
  
    await populateProjectsUI();
    const select = document.querySelector("#project-dropdown select");
    if (select) {
      select.value = projectId;
      select.dispatchEvent(new Event("change"));
    }
  
    revertFullscreenLayout();
    showMainSection("pages-with-side-bar");
    showSidebarSection("configuration");
  });  

  function revertFullscreenLayout() {
    const appMenu = document.querySelector(".app-menu");
    const dashboard = document.getElementById("dashboard");
    const topbar = document.getElementById("page-topbar");

    appMenu?.classList.remove("d-none");
    dashboard?.classList.remove("full-width-dashboard");
    topbar.style.left = "";
  }


  function showToast(message, type, duration = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    // Clear any existing type classes
    toast.classList.remove("bg-success", "bg-danger", "text-white", "show");

    // Set new type class
    if (type === "success") {
      toast.classList.add("bg-success", "text-white");
    } else if (type === "danger") {
      toast.classList.add("bg-danger", "text-white");
    }

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
      showToast("Please fill all required Modbus fields correctly.", "danger");
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
      showToast(`Please enter a value for "${missingLabel}"`, "danger");
      return;
    }

    if (sensorData.length === 0) {
      showToast("No sensors selected.", "danger");
    } else {
      console.log("✅ Checked Sensor Data:", sensorData);
    }
  });

  // Show 'login' section by default
  showMainSection("login");
});



