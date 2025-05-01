document.addEventListener("DOMContentLoaded", () => {
    // console.log("✅ DOM fully loaded!");

    // Select all buttons with the class names
    const minimizeBtns = document.querySelectorAll(".minimize-window");
    const maximizeBtns = document.querySelectorAll(".maximize-window");
    const closeBtns = document.querySelectorAll(".close-window");

    if (minimizeBtns.length > 0) {
        // console.log("✅ Minimize buttons found!");
        minimizeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                window.electron.minimize();
            });
        });
    } else {
        console.error("❌ No minimize buttons found!");
    }

    if (maximizeBtns.length > 0) {
        // console.log("✅ Maximize buttons found!");
        maximizeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                window.electron.maximize();
            });
        });
    } else {
        console.error("❌ No maximize buttons found!");
    }

    if (closeBtns.length > 0) {
        // console.log("✅ Close buttons found!");
        closeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                window.electron.close();
            });
        });
    } else {
        console.error("❌ No close buttons found!");
    }
});
