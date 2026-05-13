(function () {
  "use strict";

  // Настройки адресов бэкенда
  const CONFIG = {
    ENDPOINTS: {
      UPLOAD_ZIP: "/upload-archive", // Эндпоинт для приема ZIP-архива
      DOWNLOAD: "/download-report", // Эндпоинт для скачивания отчета
    },
  };

  // Хранилище для файлов в оперативной памяти
  const selectedFiles = {
    title: null,
    task: null,
    review: null,
    norm: null,
    antiplag: null,
  };

  // Элементы интерфейса
  const navLinks = document.querySelectorAll(".nav-link");
  const pages = {
    page1: document.getElementById("page1"),
    page2: document.getElementById("page2"),
    page3: document.getElementById("page3"),
  };

  const notificationArea = document.getElementById("notificationArea");
  const errorList = document.getElementById("errorList");
  const successMsg = document.getElementById("successMessage");
  const reportStatusSpan = document.getElementById("reportStatus");
  const checkBtn = document.getElementById("checkBtn");
  const downloadBtn = document.getElementById("downloadReportBtn");
  let uploadedFileInfo = null;

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

  // --- НАВИГАЦИЯ МЕЖДУ СТРАНИЦАМИ ---
  function switchPage(targetId) {
    Object.values(pages).forEach((p) => p.classList.add("hidden"));
    if (pages[targetId]) pages[targetId].classList.remove("hidden");

    navLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.page === targetId);
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchPage(link.dataset.page);
    });
  });

  // --- ОБРАБОТКА ВЫБОРА ФАЙЛОВ ---
  fileInputs.forEach((item) => {
    item.input.addEventListener("change", () => {
      const file = item.input.files[0];
      if (file) {
        selectedFiles[item.key] = file;
        item.nameSpan.textContent =
          file.name.length > 25
            ? file.name.substring(0, 22) + "..."
            : file.name;
        item.statusSpan.textContent = "📦 готов";
        item.statusSpan.style.background = "#dcfce7"; // Зеленый фон
      } else {
        selectedFiles[item.key] = null;
        item.nameSpan.textContent = "файл не выбран";
        item.statusSpan.textContent = "⏳ ожидает";
        item.statusSpan.style.background = "#e6edf6";
      }
      hideNotifications();
    });
  });

  // --- ОТПРАВКА АРХИВА НА БЭКЕНД ---
  checkBtn.addEventListener("click", async () => {
    // Проверка: загружены ли все файлы?
    const missing = Object.keys(selectedFiles).filter(
      (key) => !selectedFiles[key],
    );
    if (missing.length > 0) {
      displayResults(["Загрузите все 5 документов перед отправкой!"], false);
      return;
    }

    checkBtn.disabled = true;
    checkBtn.textContent = "⌛ Упаковка и отправка...";

    try {
      // Расширение в имени в ZIP должно совпадать с реальным файлом (иначе бэкенд видел .docx при PDF).
      function zipExt(file) {
        const n = file && file.name ? file.name.toLowerCase() : "";
        if (n.endsWith(".pdf")) return "pdf";
        if (n.endsWith(".docx")) return "docx";
        return "docx";
      }
      // Создаем ZIP архив
      const zip = new JSZip();
      zip.file(`1_title.${zipExt(selectedFiles.title)}`, selectedFiles.title);
      zip.file(`2_task.${zipExt(selectedFiles.task)}`, selectedFiles.task);
      zip.file(
        `3_review.${zipExt(selectedFiles.review)}`,
        selectedFiles.review,
      );
      zip.file(`4_norm.${zipExt(selectedFiles.norm)}`, selectedFiles.norm);
      zip.file(
        `5_antiplag.${zipExt(selectedFiles.antiplag)}`,
        selectedFiles.antiplag,
      );

      // Генерируем архив в виде Blob
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Подготавливаем данные для отправки
      const formData = new FormData();
      formData.append("archive", zipBlob, "documents_bundle.zip");

      // Fetch запрос
      const response = await fetch(`${CONFIG.ENDPOINTS.UPLOAD_ZIP}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Ошибка сервера");

      uploadedFileInfo = await response.json();
      const data = uploadedFileInfo;
      // Если сервер вернул ошибки в ключе 'errors'
      if (data.errors && data.errors.length > 0) {
        displayResults(data.errors, false);
        reportStatusSpan.textContent = "обнаружены замечания";
      } else {
        displayResults([], true);
        reportStatusSpan.textContent = "успешно ✅";
      }
    } catch (err) {
      displayResults(
        ["Ошибка связи с сервером. Проверьте FastAPI и CORS."],
        false,
      );
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = "🔎 Проверить все документы";
    }
  });

  // --- СКАЧИВАНИЕ ОТЧЕТА ---
  downloadBtn.addEventListener("click", async () => {
    // 3. Проверяем, есть ли данные для отправки
    if (!uploadedFileInfo) {
      alert("Сначала дождитесь окончания загрузки и проверки файла!");
      return;
    }

    try {
      const response = await fetch(`${CONFIG.ENDPOINTS.DOWNLOAD}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // 4. Отправляем те самые сохраненные данные
        body: JSON.stringify(uploadedFileInfo),
      });

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
      // Теперь выведем реальную ошибку в консоль, чтобы в будущем не гадать
      console.error("Ошибка при скачивании:", err);
      alert("Не удалось скачать отчёт. Посмотрите ошибку в консоли (F12).");
    }
  });

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  function displayResults(errors, isSuccess) {
    errorList.innerHTML = "";
    if (isSuccess) {
      notificationArea.style.display = "none";
      successMsg.style.display = "block";
    } else {
      errors.forEach((err) => {
        const li = document.createElement("li");
        li.textContent = err;
        errorList.appendChild(li);
      });
      notificationArea.style.display = "block";
      successMsg.style.display = "none";
    }
  }

  function hideNotifications() {
    notificationArea.style.display = "none";
    successMsg.style.display = "none";
  }
})();
