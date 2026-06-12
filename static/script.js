(function () {
  "use strict";

  const CONFIG = {
    ENDPOINTS: {
      UPLOAD_ZIP: "/upload-archive",
      DOWNLOAD: "/download-report",
      LOGIN: "/api/v1/auth/login",
      REGISTER: "/api/v1/auth/register",
      ME: "/api/v1/auth/me",
    },
  };

  const selectedFiles = {
    title: null,
    task: null,
    review: null,
    norm: null,
    antiplag: null,
  };
  let uploadedFileInfo = null;
  let accessToken = localStorage.getItem("access_token") || null;

  const reportStatusSpan = document.getElementById("reportStatus");
  const downloadBtn = document.getElementById("downloadReportBtn");

  const fileInputs = [
    {
      input: document.getElementById("file-title"),
      nameSpan: document.getElementById("title-name"),
      statusSpan: document.getElementById("title-status"),
      key: "title",
    },
    {
      input: document.getElementById("file-task"),
      nameSpan: document.getElementById("task-name"),
      statusSpan: document.getElementById("task-status"),
      key: "task",
    },
    {
      input: document.getElementById("file-review"),
      nameSpan: document.getElementById("review-name"),
      statusSpan: document.getElementById("review-status"),
      key: "review",
    },
    {
      input: document.getElementById("file-norm"),
      nameSpan: document.getElementById("norm-name"),
      statusSpan: document.getElementById("norm-status"),
      key: "norm",
    },
    {
      input: document.getElementById("file-antiplag"),
      nameSpan: document.getElementById("antiplag-name"),
      statusSpan: document.getElementById("antiplag-status"),
      key: "antiplag",
    },
  ];

  const archiveInput = document.getElementById("archiveInput");
  const archiveName = document.getElementById("archive-name");
  const archiveAlert = document.getElementById("archiveAlert");
  const archiveErrorList = document.getElementById("archiveErrorList");
  const archiveSuccess = document.getElementById("archiveSuccess");
  const checkArchiveBtn = document.getElementById("checkArchiveBtn");
  const checkFilesBtn = document.getElementById("checkFilesBtn");
  const filesAlert = document.getElementById("filesAlert");
  const filesErrorList = document.getElementById("filesErrorList");
  const filesSuccess = document.getElementById("filesSuccess");
  const authMessage = document.getElementById("authMessage");
  const regMessage = document.getElementById("regMessage");
  const adminDbLink = document.getElementById("adminDbLink");
  const authLink = document.getElementById("authLink");
  const logoutBtn = document.getElementById("logoutBtn");

  const allNavLinks = document.querySelectorAll(".nav-link");
  const allPages = document.querySelectorAll(".page");

  function switchPage(targetId) {
    allPages.forEach((p) => p.classList.remove("active"));
    const targetPage = document.getElementById(targetId);
    if (targetPage) targetPage.classList.add("active");
    allNavLinks.forEach((link) => {
      if (link.id === "logoutBtn") return;
      link.classList.toggle("active", link.dataset.page === targetId);
    });
  }

  allNavLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (link.id === "logoutBtn") return;
      if (link.dataset.page) switchPage(link.dataset.page);
    });
  });

  fileInputs.forEach((item) => {
    if (!item.input) return;
    item.input.addEventListener("change", () => {
      const file = item.input.files[0];
      if (file) {
        selectedFiles[item.key] = file;
        item.nameSpan.textContent =
          file.name.length > 25
            ? file.name.substring(0, 22) + "..."
            : file.name;
        item.statusSpan.textContent = "готов";
        item.statusSpan.style.background = "#dcfce7";
      } else {
        selectedFiles[item.key] = null;
        item.nameSpan.textContent = "файл не выбран";
        item.statusSpan.textContent = "ожидает";
        item.statusSpan.style.background = "#e6edf6";
      }
      hideFileNotifications();
    });
  });

  function getAuthHeaders(isJson = false) {
    const headers = {};
    if (isJson) headers["Content-Type"] = "application/json";
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return headers;
  }

  async function sendZipToBackend(filesToZip, sourceType = "files") {
    if (!accessToken) {
      const msg = "Требуется авторизация. Войдите в систему.";
      if (sourceType === "files") displayFileResults([msg], false);
      else displayArchiveResults([msg], false);
      updateReportStatus("требуется вход");
      switchPage("page-auth");
      return;
    }

    const missing = Object.keys(filesToZip).filter((key) => !filesToZip[key]);
    if (missing.length > 0) {
      if (sourceType === "files")
        displayFileResults(
          ["Загрузите все 5 документов перед отправкой!"],
          false,
        );
      else
        displayArchiveResults(["В архиве не найдены все 5 документов!"], false);
      updateReportStatus("ошибка загрузки");
      return;
    }

    const btn = sourceType === "files" ? checkFilesBtn : checkArchiveBtn;
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Упаковка и отправка...";

    try {
      const zip = new JSZip();
      zip.file("1_title.docx", filesToZip.title);
      zip.file("2_task.docx", filesToZip.task);
      zip.file("3_review.docx", filesToZip.review);
      zip.file("4_norm.docx", filesToZip.norm);
      zip.file("5_antiplag.pdf", filesToZip.antiplag);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const formData = new FormData();
      formData.append("archive", zipBlob, "documents_bundle.zip");

      const response = await fetch(`${CONFIG.ENDPOINTS.UPLOAD_ZIP}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (response.status === 401) {
        handleLogout();
        throw new Error("Сессия истекла. Войдите заново.");
      }
      if (!response.ok) throw new Error("Ошибка сервера");

      uploadedFileInfo = await response.json();
      const data = uploadedFileInfo;
      if (data.errors && data.errors.length > 0) {
        if (sourceType === "files") displayFileResults(data.errors, false);
        else displayArchiveResults(data.errors, false);
        updateReportStatus("обнаружены замечания");
      } else {
        if (sourceType === "files") displayFileResults([], true);
        else displayArchiveResults([], true);
        updateReportStatus("успешно");
      }
    } catch (err) {
      const msg = err.message || "Ошибка связи с сервером.";
      if (sourceType === "files") displayFileResults([msg], false);
      else displayArchiveResults([msg], false);
      updateReportStatus("ошибка сервера");
    } finally {
      btn.disabled = false;
      btn.textContent =
        sourceType === "files" ? "Проверить все документы" : "Проверить архив";
    }
  }

  if (checkFilesBtn)
    checkFilesBtn.addEventListener("click", () =>
      sendZipToBackend(selectedFiles, "files"),
    );

  if (checkArchiveBtn) {
    checkArchiveBtn.addEventListener("click", async () => {
      if (!accessToken) {
        displayArchiveResults(
          ["Требуется авторизация. Войдите в систему."],
          false,
        );
        switchPage("page-auth");
        return;
      }

      const archiveFile = archiveInput ? archiveInput.files[0] : null;
      if (!archiveFile) {
        displayArchiveResults(["Архив не выбран."], false);
        updateReportStatus("не выбран");
        return;
      }

      checkArchiveBtn.disabled = true;
      checkArchiveBtn.textContent = "Распаковка и отправка...";

      try {
        const zip = await JSZip.loadAsync(archiveFile);
        const validFiles = [];
        for (const entry of Object.values(zip.files)) {
          if (entry.dir) continue;
          if (entry.name.includes("__MACOSX") || entry.name.includes("._"))
            continue;
          const name = entry.name.toLowerCase();
          if (name.endsWith(".docx") || name.endsWith(".pdf")) {
            const blob = await entry.async("blob");
            validFiles.push({ name: entry.name, blob });
          }
        }

        const names = validFiles.map((f) => f.name.toLowerCase());
        const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
        if (duplicates.length > 0) {
          displayArchiveResults(
            [
              `Обнаружены одинаковые файлы: ${[...new Set(duplicates)].join(", ")}`,
            ],
            false,
          );
          return;
        }

        if (validFiles.length < 5) {
          displayArchiveResults(
            [
              `Найдено только ${validFiles.length} подходящих файлов (нужно 5).`,
            ],
            false,
          );
          return;
        }

        const extractedFiles = {
          title: validFiles[0].blob,
          task: validFiles[1].blob,
          review: validFiles[2].blob,
          norm: validFiles[3].blob,
          antiplag: validFiles[4].blob,
        };

        await sendZipToBackend(extractedFiles, "archive");
      } catch (err) {
        console.error(err);
        displayArchiveResults(["Ошибка при разборе архива."], false);
      } finally {
        checkArchiveBtn.disabled = false;
        checkArchiveBtn.textContent = "Проверить архив";
      }
    });
  }

  if (archiveInput) {
    archiveInput.addEventListener("change", () => {
      const file = archiveInput.files[0];
      if (archiveName)
        archiveName.textContent = file ? file.name : "архив не выбран";
      hideArchiveNotifications();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", async () => {
      if (!accessToken) {
        alert("Требуется авторизация.");
        switchPage("page-auth");
        return;
      }
      if (!uploadedFileInfo) {
        alert("Сначала дождитесь окончания загрузки и проверки файла!");
        return;
      }

      try {
        const response = await fetch(`${CONFIG.ENDPOINTS.DOWNLOAD}`, {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify(uploadedFileInfo),
        });

        if (response.status === 401) {
          handleLogout();
          throw new Error("Сессия истекла.");
        }
        if (!response.ok) throw new Error("Файл не найден на сервере");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Report_Normokontrol_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Ошибка при скачивании:", err);
        alert(err.message || "Не удалось скачать отчёт.");
      }
    });
  }

  function displayArchiveResults(errors, isSuccess) {
    if (!archiveErrorList || !archiveAlert || !archiveSuccess) return;
    archiveErrorList.innerHTML = "";
    if (isSuccess) {
      archiveAlert.style.display = "none";
      archiveSuccess.style.display = "block";
    } else {
      errors.forEach((err) => {
        const li = document.createElement("li");
        li.textContent = err;
        archiveErrorList.appendChild(li);
      });
      archiveAlert.style.display = "block";
      archiveSuccess.style.display = "none";
    }
  }

  function displayFileResults(errors, isSuccess) {
    if (!filesErrorList || !filesAlert || !filesSuccess) return;
    filesErrorList.innerHTML = "";
    if (isSuccess) {
      filesAlert.style.display = "none";
      filesSuccess.style.display = "block";
    } else {
      errors.forEach((err) => {
        const li = document.createElement("li");
        li.textContent = err;
        filesErrorList.appendChild(li);
      });
      filesAlert.style.display = "block";
      filesSuccess.style.display = "none";
    }
  }

  function hideArchiveNotifications() {
    if (archiveAlert) archiveAlert.style.display = "none";
    if (archiveSuccess) archiveSuccess.style.display = "none";
  }

  function hideFileNotifications() {
    if (filesAlert) filesAlert.style.display = "none";
    if (filesSuccess) filesSuccess.style.display = "none";
  }

  function updateReportStatus(text) {
    if (reportStatusSpan) reportStatusSpan.textContent = text;
  }

  // Авторизация
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const showRegisterBtn = document.getElementById("showRegisterBtn");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (showRegisterBtn) {
    showRegisterBtn.addEventListener("click", () => {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", () => {
      registerForm.style.display = "none";
      loginForm.style.display = "block";
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      try {
        const res = await fetch(CONFIG.ENDPOINTS.LOGIN, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Неверный логин или пароль");
        }

        const data = await res.json();
        accessToken = data.access_token;
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("user_role", data.role);

        authMessage.style.color = "#1f7a4a";
        authMessage.textContent = `✅ Вход выполнен. Роль: ${data.role}`;
        updateUIForAuth(data.role);
        setTimeout(() => switchPage("page-home"), 800);
      } catch (err) {
        authMessage.style.color = "#b91c1c";
        authMessage.textContent = "❌ " + err.message;
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      const email = document.getElementById("regEmail").value;
      const username = document.getElementById("regUsername").value;
      const password = document.getElementById("regPassword").value;
      const role = document.getElementById("regRole").value;

      try {
        const res = await fetch(CONFIG.ENDPOINTS.REGISTER, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password, role }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Ошибка регистрации");
        }

        regMessage.style.color = "#1f7a4a";
        regMessage.textContent = "✅ Регистрация успешна! Теперь войдите.";
        setTimeout(() => {
          registerForm.style.display = "none";
          loginForm.style.display = "block";
          regMessage.textContent = "";
        }, 1500);
      } catch (err) {
        regMessage.style.color = "#b91c1c";
        regMessage.textContent = "❌ " + err.message;
      }
    });
  }

  function updateUIForAuth(role) {
    if (authLink) authLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    if (adminDbLink && role === "normocontrol")
      adminDbLink.style.display = "inline-block";
  }

  function handleLogout() {
    accessToken = null;
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    if (authLink) authLink.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (adminDbLink) adminDbLink.style.display = "none";
    switchPage("page-auth");
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Проверка сессии при загрузке страницы
  (async function init() {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const res = await fetch(CONFIG.ENDPOINTS.ME, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        accessToken = token;
        updateUIForAuth(user.role);
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
      }
    } catch (e) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
    }
  })();
})();
