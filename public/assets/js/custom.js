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
  let currentProjectId = null;
  let isEditMode = false;
  const modbusToggle = document.getElementById("modbusToggle");
  let worker = null;
  let isRealtimeRunning = false;
  let isRealtimePaused = false;
  let realtimeInterval = null;
  const startBtn = document.getElementById("start-realtime");
  const stopBtn = document.getElementById("stop-realtime");
  let simulationInterval = null;
  let simulatedAddressRanges = {}; // Maps address → [min, max]

  const availableRanges = [
    [0, 25000],
    [-40, 300],
    [-400, 400],
    [0, 16000],
    [0, 5000],
    [0, 100]
  ];

  let realtimeIntervalId = null;
  let realtimeMappings = [];
  let refreshRate = 5000;

  /* Login button disable validation */

  function validateLoginFields() {
    const usernameFilled = usernameInput?.value.trim() !== "";
    const passwordFilled = passwordInput?.value.trim() !== "";

    loginBtn.disabled = !(usernameFilled && passwordFilled);
  }

  /* Logn button spinner logic */

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

  /* Submission of login form - First time call the api then from sqlite */

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

  /* Licence key validation - will be called only once for the first time */

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

  /* Project creation logic */

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

  /* Project dropdown creation with project data */

  async function populateProjectsUI() {
    const select = document.getElementById("project-select");
    if (!select) return;

    select.innerHTML = "";

    const projects = await window.electron.getProjects();
    // console.log("Projects in renderer:", projects);
    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });


    const createNewOption = document.createElement("option");
    createNewOption.value = "create-new";
    createNewOption.textContent = "Create New Project ➕";
    select.appendChild(createNewOption);

    select.onchange = function () {
      if (this.value === "create-new") {
        showMainSection("pages-with-side-bar");
        dashboardFullScreen();
        document.getElementById("project-name").value = "";
      }
      else {
        currentProjectId = this.value;
        loadConfigurationForProject(currentProjectId);
      }
      openStep1Tab();
    };
  }

  // Disable tab click on configuration screen
  document.querySelectorAll(".custom-nav .nav-link").forEach(link => {
    link.addEventListener("click", e => e.preventDefault());
  });

  document.getElementById("go-to-step2")?.addEventListener("click", () => {
    const requiredFields = document.querySelectorAll("#step1 input, #step1 textarea");

    for (let field of requiredFields) {
      const fieldId = field.id;

      // Skip client logo check during edit mode
      if (isEditMode && fieldId === "client-logo") continue;

      if (!field.value.trim()) {
        const label = field.closest(".mb-3")?.querySelector("label")?.innerText || "This field";
        showToast(`Please fill the "${label}"`, "danger");
        field.focus();
        return; // Prevent tab switch
      }
    }

    // Proceed to next tab if all fields are filled
    document.getElementById("step1").classList.remove("show", "active");
    document.getElementById("step2").classList.add("show", "active");

    const tabs = document.querySelectorAll(".custom-nav .nav-link");
    tabs[0].classList.remove("active");
    tabs[1].classList.add("active");
  });


  // Handle previous buttons
  document.querySelectorAll(".previestab").forEach(btn => {
    btn.addEventListener("click", function () {
      const prevTabId = this.dataset.previous;
      const prevButton = document.querySelector(`#${prevTabId}`);
      if (prevButton) {
        // Switch nav tab
        document.querySelectorAll(".custom-nav .nav-link").forEach(el => el.classList.remove("active"));
        prevButton.classList.add("active");

        // Switch tab content
        const targetTabPane = prevButton.dataset.bsTarget;
        if (targetTabPane) {
          document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("show", "active"));
          const tabPane = document.querySelector(targetTabPane);
          if (tabPane) tabPane.classList.add("show", "active");
        }
      }
    });
  });

  document.getElementById("well-config-form")?.addEventListener("submit", async function (e) {
    e.preventDefault();

    const getVal = (id) => document.getElementById(id)?.value?.trim() || "";
    const showError = (msg) => showToast(msg, "danger");

    const projectId = document.querySelector("#project-select")?.value;
    if (!projectId || projectId === "create-new") return showError("Select a valid project");

    const inputs = {
      clientName: getVal("client-name"),
      fieldName: getVal("field-name"),
      wellNumber: getVal("well-number"),
      wellHistory: getVal("well-history"),
      drilledOn: getVal("drilled-on"),
      completedOn: getVal("completed-on"),
      completionDate: getVal("completion-date"),
      formationType: getVal("formation-type"),
      lastOperation: getVal("last-operation"),
      wellHistoryDetails: getVal("well-history-details"),
      surfaceLocation: getVal("surface-location"),
      rigElevation: getVal("rig-elevation"),
      casingDetails: getVal("casing-details"),
      criticalDepth: getVal("critical-depth"),
      tubingDetails: getVal("tubing-details"),
      maxDeviation: getVal("max-deviation"),
      reservoirPressure: getVal("reservoir-pressure"),
      reservoirTemperature: getVal("reservoir-temperature"),
      lastHud: getVal("last-hud"),
      perforationInterval: getVal("perforation-interval"),
      payZone: getVal("pay-zone"),
      minimumId: getVal("minimum-id"),
      wellStatus: getVal("well-status")
    };

    for (let key in inputs) {
      if (!inputs[key]) return showError(`Please fill "${key}"`);
    }

    const getFile = async (id) => {
      const input = document.getElementById(id);
      if (!input || !input.files || input.files.length === 0) return null;
      const file = input.files[0];
      const buffer = await file.arrayBuffer();
      return {
        name: file.name,
        content: Array.from(new Uint8Array(buffer))
      };
    };

    const files = {
      clientLogo: await getFile("client-logo"),
      completionPicture: await getFile("completion-picture"),
      wellProgram: await getFile("well-program"),
      designService: await getFile("design-service")
    };

    const saveIfPresent = async (file, fieldName) => {
      return file ? await window.electron.invoke("save-file", { fileObj: file, fieldName, projectId }) : null;
    };

    try {
      if (isEditMode) {
        const result = await window.electron.updateConfiguration({
          ...inputs,
          projectId,
          clientLogo: await saveIfPresent(files.clientLogo, "client_logo"),
          completionPicture: await saveIfPresent(files.completionPicture, "completion_picture"),
          wellProgram: await saveIfPresent(files.wellProgram, "well_program"),
          designService: await saveIfPresent(files.designService, "design_service")
        });

        if (result?.success) showToast("Configuration updated!", "success");
        else showToast("Update failed.", "danger");

      } else {
        const result = await window.electron.invoke("save-well-config", {
          projectId,
          inputs,
          files
        });

        if (result?.success) showToast("Configuration saved!", "success");
        else showToast("Save failed.", "danger");
      }
    } catch (err) {
      console.error("Submit Error:", err);
      showToast("Unexpected error occurred.", "danger");
    }
  });

  // Disable Scan button when clicked
  scanBtn?.addEventListener("click", () => {
    scanBtn.disabled = true; // ✅ disable on click

    const timeout = parseInt(document.getElementById("timeout")?.value);
    const lastAddress = parseInt(document.getElementById("lastAddress")?.value);
    const length = parseInt(document.getElementById("length")?.value);

    if (isNaN(lastAddress) || isNaN(length) || isNaN(timeout)) {
      showToast("Please fill last address, length, and timeout.", "danger");
      scanBtn.disabled = false; // re-enable if validation fails
      return;
    }

    if (loaderOverlay) loaderOverlay.style.display = "flex";

    if (modbusToggle?.checked) {
      stopSimulation();
      generateSimulatedData(lastAddress, length);
      updateTableWithSimulatedValues(lastAddress, length);
      simulationInterval = setInterval(() => {
        updateTableWithSimulatedValues(lastAddress, length);
      }, timeout);

      setTimeout(() => {
        if (loaderOverlay) loaderOverlay.style.display = "none";
      }, 500);
    } else {
      const config = {
        port: document.getElementById("port").value,
        baudrate: parseInt(document.getElementById("baudrate")?.value),
        length,
        dataBits: parseInt(document.getElementById("dataBits")?.value),
        parity: document.getElementById("parity")?.value,
        stopBits: parseInt(document.getElementById("stopBits")?.value),
        timeout,
        lastAddress
      };

      if (
        !config.port || isNaN(config.baudrate) || isNaN(config.dataBits) ||
        !config.parity || isNaN(config.stopBits)
      ) {
        showToast("Please complete all required Modbus fields.", "danger");
        if (loaderOverlay) loaderOverlay.style.display = "none";
        scanBtn.disabled = false;
        return;
      }

      window.electron.sendModbusConfig(config);
    }
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

  modbusToggle?.addEventListener("change", () => {
    stopSimulation();

    const tbody = document.querySelector(".table tbody");
    if (!tbody) return;

    if (!modbusToggle.checked) {
      tbody.innerHTML = `
        <tr>
          <td colspan="2" style="color: red;" align="left">Please configure inputs and click on Scan.</td>
        </tr>
      `;
      modbusAddressMap = {};
    }

    scanBtn.disabled = false; // ✅ Enable again on toggle
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

  function getRandomInRange(min, max) {
    return (Math.random() * (max - min) + min).toFixed(2);
  }

  function generateSimulatedData(lastAddress, length) {
    simulatedAddressRanges = {};
    for (let i = 0; i < length; i++) {
      const currentAddress = lastAddress + i;
      const range = availableRanges[Math.floor(Math.random() * availableRanges.length)];
      simulatedAddressRanges[currentAddress] = range;
    }
  }

  function updateTableWithSimulatedValues(lastAddress, length) {
    const tbody = document.querySelector(".table tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    modbusAddressMap = {};

    for (let i = 0; i < length; i++) {
      const currentAddress = lastAddress + i;
      const [min, max] = simulatedAddressRanges[currentAddress];
      const value = getRandomInRange(min, max);

      modbusAddressMap[currentAddress] = value;

      const row = document.createElement("tr");
      row.dataset.address = currentAddress;
      row.innerHTML = `
        <th scope="row"><a href="#" class="fw-medium">${currentAddress}</a></th>
        <td data-value>${value}</td>
      `;
      tbody.appendChild(row);
    }
  }

  function stopSimulation() {
    clearInterval(simulationInterval);
    simulationInterval = null;
    simulatedAddressRanges = {};
  }

  if (modbusToggle) {
    modbusToggle.addEventListener("change", () => {
      stopSimulation();

      const tbody = document.querySelector(".table tbody");
      if (!tbody) return;

      if (!modbusToggle.checked) {
        // Turned OFF → Reset state
        tbody.innerHTML = `
        <tr>
          <td colspan="2" style="color: red;" align="left">Please configure inputs and click on Scan.</td>
        </tr>
      `;
        modbusAddressMap = {};
        if (scanBtn) scanBtn.disabled = false;
      }
    });
  }

  scanBtn?.addEventListener("click", () => {
    const timeout = parseInt(document.getElementById("timeout")?.value);
    const lastAddress = parseInt(document.getElementById("lastAddress")?.value);
    const length = parseInt(document.getElementById("length")?.value);

    if (isNaN(lastAddress) || isNaN(length) || isNaN(timeout)) {
      showToast("Please fill last address, length, and timeout.", "danger");
      return;
    }

    scanBtn.disabled = true;

    if (modbusToggle?.checked) {
      stopSimulation();
      generateSimulatedData(lastAddress, length);
      updateTableWithSimulatedValues(lastAddress, length);
      simulationInterval = setInterval(() => {
        updateTableWithSimulatedValues(lastAddress, length);
      }, timeout);
    } else {
      // Let the original Modbus config logic execute here
      loaderOverlay && (loaderOverlay.style.display = "flex");

      const config = {
        port: document.getElementById("port").value,
        baudrate: parseInt(document.getElementById("baudrate").value),
        length,
        dataBits: parseInt(document.getElementById("dataBits").value),
        parity: document.getElementById("parity").value,
        stopBits: parseInt(document.getElementById("stopBits").value),
        timeout,
        lastAddress
      };

      window.electron.sendModbusConfig(config);
    }
  });

  window.electron.onSerialData((data) => {
    // Skip real Modbus updates if simulation mode is ON
    if (document.getElementById("modbusToggle")?.checked) return;

    if (loaderOverlay) loaderOverlay.style.display = "none";

    const tbody = document.querySelector(".table tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    modbusAddressMap = {};

    const lastAddress = parseInt(document.getElementById("lastAddress")?.value);
    const length = parseInt(document.getElementById("length")?.value);

    if (isNaN(lastAddress) || isNaN(length)) {
      const errorRow = document.createElement("tr");
      errorRow.innerHTML = `
      <td colspan="2" style="color: red;">⚠️ Invalid last address or length</td>
    `;
      tbody.appendChild(errorRow);
      return;
    }

    for (let i = 0; i < length && i < data.length; i++) {
      const currentAddress = lastAddress + i;
      const value = data[i];

      modbusAddressMap[currentAddress] = value;

      const row = document.createElement("tr");
      row.dataset.address = currentAddress;
      row.innerHTML = `
      <th scope="row"><a href="#" class="fw-medium">${currentAddress}</a></th>
      <td data-value>${value}</td>
    `;
      tbody.appendChild(row);
    }
  });

  function getValueFromAddressTable(address) {
    const row = document.querySelector(`.table tbody tr[data-address="${address}"]`);
    if (!row) return null;

    const valueCell = row.querySelector("td[data-value]");
    if (!valueCell) return null;

    return valueCell.textContent.trim();
  }

  /* Create project full screen login with project listing */

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
    projects.forEach(project => {
      const div = document.createElement("div");
      div.className = "bg-info bg-opacity-10 border border-info text-info p-3 rounded mb-2 cursor-pointer clickable-project";
      div.dataset.id = project.id;
      div.innerHTML = `<h6 class="mb-0 text-truncate">${project.name}</h6>`;
      container.appendChild(div);
    });
  }

  /* Recent project list click logic from project creation screen */

  document.getElementById("recent-projects")?.addEventListener("click", async function (e) {

    const clicked = e.target.closest(".clickable-project");
    if (!clicked) return;

    currentProjectId = clicked.dataset.id;
    if (!currentProjectId) {
      return;
    }
    else {
      loadConfigurationForProject(currentProjectId);
    }

    await populateProjectsUI();
    const select = document.querySelector("#project-dropdown select");
    if (select) {
      select.value = currentProjectId;
      select.dispatchEvent(new Event("change"));
    }

    revertFullscreenLayout();
    showMainSection("pages-with-side-bar");
    showSidebarSection("configuration");
    openStep1Tab();
  });

  async function loadConfigurationForProject(projectId) {
    const data = await window.electron.invoke("get-configuration", parseInt(projectId));
    const submitBtn = document.getElementById("config-submit-btn");

    if (data) {
      document.getElementById("client-name").value = data.client_name || "";
      document.getElementById("field-name").value = data.field_name || "";
      document.getElementById("well-number").value = data.well_number || "";
      document.getElementById("well-history").value = data.well_history || "";
      document.getElementById("drilled-on").value = data.drilled_on || "";
      document.getElementById("completed-on").value = data.completed_on || "";
      document.getElementById("completion-date").value = data.completion_date || "";
      document.getElementById("formation-type").value = data.formation_type || "";
      document.getElementById("last-operation").value = data.last_operation || "";
      document.getElementById("well-history-details").value = data.well_history_details || "";
      document.getElementById("surface-location").value = data.surface_location || "";
      document.getElementById("rig-elevation").value = data.rig_elevation || "";
      document.getElementById("casing-details").value = data.casing_details || "";
      document.getElementById("critical-depth").value = data.critical_depth || "";
      document.getElementById("tubing-details").value = data.tubing_details || "";
      document.getElementById("max-deviation").value = data.max_deviation || "";
      document.getElementById("reservoir-pressure").value = data.reservoir_pressure || "";
      document.getElementById("reservoir-temperature").value = data.reservoir_temperature || "";
      document.getElementById("last-hud").value = data.last_hud || "";
      document.getElementById("perforation-interval").value = data.perforation_interval || "";
      document.getElementById("pay-zone").value = data.pay_zone || "";
      document.getElementById("minimum-id").value = data.minimum_id || "";
      document.getElementById("well-status").value = data.well_status || "";
      isEditMode = true;
      submitBtn.textContent = "Edit";
    } else {
      // Clear fields
      document.querySelectorAll("#well-config-form input, #well-config-form textarea").forEach(field => field.value = "");
      submitBtn.textContent = "Submit";
      isEditMode = false;
    }

    // Load sensor mappings
    try {
      // console.log("Loading sensor mappings for project:", projectId);
      const sensorMappings = await window.electron.getSensorMappings(projectId);
      // console.log("Received sensor mappings:", sensorMappings);

      // Reset all checkboxes and inputs first
      document.querySelectorAll(".form-check-input[type='checkbox']").forEach(checkbox => {
        checkbox.checked = false;
        const wrapper = checkbox.closest(".form-check").querySelector(".input-wrapper");
        if (wrapper) {
          wrapper.style.display = "none";
          const input = wrapper.querySelector("input");
          if (input) input.value = "";
        }
      });

      // Apply saved mappings
      sensorMappings.forEach(mapping => {
        // console.log("Processing mapping:", mapping);

        // Find all checkboxes and their inputs
        const checkboxes = document.querySelectorAll(".form-check-input[type='checkbox']");
        checkboxes.forEach(checkbox => {
          const input = checkbox.closest(".form-check").querySelector(".input-wrapper input");
          if (input) {
            const params = JSON.parse(input.dataset.params || "{}");
            if (params.long === mapping.long) {
              // console.log("Found matching checkbox for:", mapping.long);
              // Check the checkbox
              checkbox.checked = true;
              // Show the input wrapper
              const wrapper = checkbox.closest(".form-check").querySelector(".input-wrapper");
              if (wrapper) {
                wrapper.style.display = "block";
                // Set the input value
                input.value = mapping.value;
                // console.log("Set value:", mapping.value, "for input");
              }
            }
          }
        });
      });
    } catch (error) {
      console.error("Error loading sensor mappings:", error);
    }
  }

  /* Revert full screen to sidebar logic */

  function revertFullscreenLayout() {
    const appMenu = document.querySelector(".app-menu");
    const dashboard = document.getElementById("dashboard");
    const topbar = document.getElementById("page-topbar");

    appMenu?.classList.remove("d-none");
    dashboard?.classList.remove("full-width-dashboard");
    topbar.style.left = "";
  }

  function openStep1Tab() {
    // Reset tab pane visibility
    document.getElementById("step1")?.classList.add("show", "active");
    document.getElementById("step2")?.classList.remove("show", "active");

    // Reset tab header active state
    document.getElementById("well-tab-header-1")?.classList.add("active");
    document.getElementById("well-tab-header-2")?.classList.remove("active");
  }

  /* Alert message is replaced with Toast at the bottom right corner */

  function showToast(message, type, duration = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    // Reset all alert classes
    toast.className = "alert alert-dismissible fade show toast-message"; // Reset with base classes

    // Apply type-specific class
    if (type === "success") {
      toast.classList.add("alert-success");
    } else if (type === "danger") {
      toast.classList.add("alert-danger");
    } else if (type === "warning") {
      toast.classList.add("alert-warning");
    }

    // Set the message
    toast.textContent = message;

    // Auto-hide the alert
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
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
    document.getElementById(link.id)?.addEventListener("click", async function (event) {
      event.preventDefault();
      showSidebarSection(link.target);
      if (link.target === "configuration") {
        openStep1Tab();
      }

      if (link.target === "realtime-data") {
        if (!currentProjectId) {
          showToast("Select a project first", "danger");
          return;
        }

        // Load sensor mappings
        try {
          realtimeMappings = await window.electron.getSensorMappings(currentProjectId);

        } catch (err) {
          console.error("Failed to load sensor mappings:", err);
          showToast("Sensor mappings not found", "danger");
          return;
        }

        // Get refresh interval
        const refreshInput = document.querySelector("input.product-quantity");
        const intervalValue = parseInt(refreshInput?.value || "5", 10);
        refreshRate = isNaN(intervalValue) ? 5000 : intervalValue * 1000;

        // Ensure header is visible
        document.querySelector("#realtime-data thead")?.classList.remove("hide-div");
      }
    });
  });

  document.querySelector("#start-realtime")?.addEventListener("click", async function () {

    if (!isRealtimeRunning) {
      if (!currentProjectId) {
        showToast("Please select a project first.", "danger");
        return;
      }

      if (!realtimeMappings.length) {
        realtimeMappings = await window.electron.getSensorMappings(currentProjectId);
      }

      const refreshInput = document.querySelector("input.product-quantity");
      const intervalValue = parseInt(refreshInput?.value || "5", 10);
      refreshRate = isNaN(intervalValue) ? 5000 : intervalValue * 1000;

      worker = new Worker("./assets/js/realtime-worker.js");
      worker.postMessage({ mappings: realtimeMappings, interval: refreshRate });

      worker.onmessage = (e) => {
        if (!isRealtimePaused) {
          appendRowToDOM(e.data);
        }
      };

      isRealtimeRunning = true;
      isRealtimePaused = false;
      startBtn.textContent = "Pause";
      stopBtn.disabled = false;

      showToast("⏱️ Real-time data started", "success");
    } else {
      isRealtimePaused = !isRealtimePaused;
      startBtn.textContent = isRealtimePaused ? "Resume" : "Pause";
      showToast(isRealtimePaused ? "⏸️ Paused" : "▶️ Resumed", isRealtimePaused ? "warning" : "success");
    }
  });

  // Append a row to DOM using <td> for performance
  function appendRowToDOM(data) {
    const tbody = document.querySelector("#realtime-data tbody");
    if (!tbody) return;

    // Remove default 'No Data Found!' row
    const noDataRow = Array.from(tbody.children).find(row => row.innerText.includes("No Data Found!"));
    if (noDataRow) tbody.removeChild(noDataRow);

    const fragment = document.createDocumentFragment();
    const newRow = document.createElement("tr");

    let rowHtml = `
      <td>${data.date}</td>
      <td>${data.time}</td>
      <td class="editable-cell td-no-padding"></td>
      <td class="editable-cell td-no-padding"></td>
      <td class="editable-cell td-no-padding"></td>
    `;

    // Collect annotations from the header row
    const annotationRow = Array.from(document.querySelectorAll("#realtime-data thead tr")).find(row =>
      Array.from(row.children).some(cell =>
        cell.classList.contains("sensor") ||
        cell.classList.contains("calculated") ||
        cell.classList.contains("manual")
      )
    );

    if (!annotationRow) return;

    const annotationCells = annotationRow.querySelectorAll("td, th");
    const valuesByAnnotation = {};
    data.values.forEach(v => {
      valuesByAnnotation[v.annotation] = v.value;
    });

    annotationCells.forEach(cell => {
      const annotation = cell.innerText.trim();
      const val = valuesByAnnotation[annotation] || "";
      const isNumber = !isNaN(parseFloat(val)) && isFinite(val);
      const alignmentClass = isNumber ? "text-end" : "";
      rowHtml += `<td class="editable-cell td-no-padding ${alignmentClass}">${val}</td>`;
    });

    newRow.innerHTML = rowHtml;
    fragment.appendChild(newRow);
    tbody.appendChild(fragment);
  }

  document.querySelector("#stop-realtime")?.addEventListener("click", function () {

    if (!isRealtimeRunning) return;

    const confirmStop = confirm("Are you sure you want to stop real-time data?");
    if (!confirmStop) return;

    worker?.terminate();
    worker = null;

    isRealtimeRunning = false;
    isRealtimePaused = false;
    startBtn.textContent = "Start";
    stopBtn.disabled = true;

    showToast("⛔ Real-time data stopped", "danger");
  });

  document.addEventListener("click", function (event) {
    const target = event.target;

    if (
      target.tagName === "TD" &&
      !target.querySelector("input") &&
      target.classList.contains("editable-cell")
    ) {
      const currentValue = target.textContent.trim();

      const input = document.createElement("input");
      input.type = "text";
      input.value = currentValue;
      input.className = "editable-input";
      input.style.width = "100%";
      input.style.border = "0";
      input.style.outline = "none";
      input.style.backgroundColor = "transparent";
      input.style.paddingRight = "0";
      input.style.font = "inherit";
      input.style.textAlign = "inherit";

      target.textContent = "";
      target.appendChild(input);
      input.focus();

      const saveInput = () => {
        target.textContent = input.value.trim();
      };

      input.addEventListener("blur", saveInput);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          input.blur();
        }
      });
    }
  });

  document.getElementById("download-excel").addEventListener("click", function () {
    const table = document.getElementById("realtime-data");
    const rows = Array.from(table.querySelectorAll("thead tr, tbody tr"));
    const matrix = [];
    const merges = [];

    const getCellStyle = (td, isHeader = false, colIndex = 0) => {
      const align = isHeader
        ? 'center'
        : (colIndex >= 3 ? 'right' : 'left');

      const valign = window.getComputedStyle(td).verticalAlign || "bottom";

      const style = {
        font: { name: 'Tahoma', sz: isHeader ? 10 : 11, bold: isHeader },
        alignment: {
          horizontal: align,
          vertical: valign === "middle" ? "center" : valign
        },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };

      if (isHeader) {
        style.fill = {
          type: 'pattern',
          patternType: 'solid',
          fgColor: { rgb: 'EEF0F7' }
        };
      }

      return style;
    };

    let rowIndex = 0;

    rows.forEach(tr => {
      const isHeader = tr.closest("thead") !== null;
      const cells = Array.from(tr.children);
      matrix[rowIndex] = matrix[rowIndex] || [];

      let colIndex = 0;
      for (let i = 0; i < cells.length; i++) {
        const td = cells[i];

        // Skip cells already filled due to rowspan/colspan
        while (matrix[rowIndex][colIndex] !== undefined) colIndex++;

        const value = (() => {
          const input = td.querySelector("input");
          if (input) return input.value.trim();
          const select = td.querySelector("select");
          if (select) return select.options[select.selectedIndex]?.text || "";
          return td.innerText.trim();
        })();

        const rowspan = parseInt(td.getAttribute("rowspan") || "1", 10);
        const colspan = parseInt(td.getAttribute("colspan") || "1", 10);

        const cellObj = {
          v: value,
          t: 's',
          s: getCellStyle(td, isHeader, colIndex)
        };

        // Place main cell and fill rest with null (merged)
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            const ri = rowIndex + r;
            const ci = colIndex + c;
            matrix[ri] = matrix[ri] || [];
            matrix[ri][ci] = (r === 0 && c === 0)
              ? cellObj
              : {
                v: '',
                t: 's',
                s: getCellStyle(td, isHeader, ci)
              };
          }
        }

        if (rowspan > 1 || colspan > 1) {
          merges.push({
            s: { r: rowIndex, c: colIndex },
            e: { r: rowIndex + rowspan - 1, c: colIndex + colspan - 1 }
          });
        }

        colIndex += colspan;
      }

      rowIndex++;
    });

    // Build worksheet
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    ws['!merges'] = merges;
    ws['!rows'] = matrix.map(() => ({ hpt: 18 }));
    const maxCols = Math.max(...matrix.map(r => r.length));
    ws['!cols'] = Array(maxCols).fill({ wpx: 120 });

    // File name with timestamp
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${pad(now.getDate())}-${now.toLocaleString('en-US', { month: 'short' })}-${now.getFullYear()} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const filename = `realtime-data-${timestamp}.xlsx`;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Realtime Data");
    XLSX.writeFile(wb, filename);
  });

  document.getElementById("download-pdf").addEventListener("click", function () {
    const contentElement = document.getElementById("pdf-content");

    // Create loader if not already present
    if (!document.getElementById("pdf-loader")) {
      const loader = document.createElement("div");
      loader.id = "pdf-loader";
      loader.innerText = "Generating PDF, please wait...";

      Object.assign(loader.style, {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "#fff",
        padding: "1rem 2rem",
        zIndex: "1000",
        border: "1px solid #ccc",
        pointerEvents: "none",
        fontSize: "14px"
      });

      contentElement.style.position = "relative";
      contentElement.appendChild(loader);
    }

    // Clone content and remove loader before printing
    const clonedElement = contentElement.cloneNode(true);
    const loaderInClone = clonedElement.querySelector("#pdf-loader");
    if (loaderInClone) loaderInClone.remove(); // Ensure loader is not included in PDF

    setTimeout(() => {
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: 'realtime-data.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          scrollY: 0,
          useCORS: true
        },
        jsPDF: {
          unit: 'in',
          format: 'a4', // Larger format for wide tables
          orientation: 'landscape'
        }
      };

      html2pdf()
        .set(opt)
        .from(clonedElement)
        .save()
        .finally(() => {
          document.getElementById("pdf-loader")?.remove();
          contentElement.style.position = ""; // Clean up
        });
    }, 100);
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

  // On "Check Values" button click
  document.getElementById("check_value")?.addEventListener("click", async function () {
    const checkboxes = document.querySelectorAll("input.form-check-input");
    const sensorData = {};
    const checkedSensors = {};

    let missingValue = false;
    let missingLabel = "";

    // First, collect all checkboxes state and data
    checkboxes.forEach((checkbox) => {
      const wrapper = checkbox.closest(".form-check");
      const input = wrapper.querySelector(".input-wrapper input");
      const checkboxId = checkbox.id;

      if (!input) return;

      const params = JSON.parse(input.dataset.params || "{}");
      const value = input.value.trim();
      const isChecked = checkbox.checked;

      // Store the checked state
      checkedSensors[checkboxId] = isChecked;

      // If checked, validate and store the data
      if (isChecked) {
        if (!value) {
          missingValue = true;
          missingLabel = params.long || "Unnamed Sensor";
          return;
        }

        sensorData[checkboxId] = {
          unit: params.unit || "",
          long: params.long || "",
          annotation: params.annotation || "",
          value: value
        };
      }
    });

    if (missingValue) {
      showToast(`Please enter a value for "${missingLabel}"`, "danger");
      return;
    }

    if (Object.keys(checkedSensors).length === 0) {
      showToast("No sensors selected.", "danger");
      return;
    }

    try {
      if (!currentProjectId) {
        showToast("No project selected. Please select a project first.", "danger");
        return;
      }

      // Save the sensor mappings
      const result = await window.electron.saveSensorMappings(currentProjectId, sensorData, checkedSensors);

      if (result.success) {
        showToast("Sensor mappings saved successfully!", "success");
        // console.log("✅ Sensor mappings saved:", { sensorData, checkedSensors });
      } else {
        showToast("Failed to save sensor mappings.", "danger");
      }
    } catch (error) {
      // console.error("Error saving sensor mappings:", error);
      showToast("Error saving sensor mappings: " + error.message, "danger");
    }
  });

  /* Show login screen on app launch */

  showMainSection("login");
});