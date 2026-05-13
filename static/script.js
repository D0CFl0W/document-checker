(function() {
    "use strict";

    // ---------- КОНФИГУРАЦИЯ ----------
    const CONFIG = {
        API_URL: "http://127.0.0.1:8000",
        ENDPOINTS: {
            UPLOAD_ZIP: "/upload-archive/",
            DOWNLOAD: "/download-report/"
        }
    };

    const selectedFiles = {
        title: null, task: null, review: null, norm: null, antiplag: null
    };

    // Элементы (старые, для отдельных файлов)
    const notificationArea = document.getElementById('notificationArea');
    const errorList = document.getElementById('errorList');
    const successMsg = document.getElementById('successMessage');
    const reportStatusSpan = document.getElementById('reportStatus');
    const downloadBtn = document.getElementById('downloadReportBtn');

    const fileInputs = [
        { input: document.getElementById('file-title'), nameSpan: document.getElementById('title-name'), statusSpan: document.getElementById('title-status'), key: 'title' },
        { input: document.getElementById('file-task'), nameSpan: document.getElementById('task-name'), statusSpan: document.getElementById('task-status'), key: 'task' },
        { input: document.getElementById('file-review'), nameSpan: document.getElementById('review-name'), statusSpan: document.getElementById('review-status'), key: 'review' },
        { input: document.getElementById('file-norm'), nameSpan: document.getElementById('norm-name'), statusSpan: document.getElementById('norm-status'), key: 'norm' },
        { input: document.getElementById('file-antiplag'), nameSpan: document.getElementById('antiplag-name'), statusSpan: document.getElementById('antiplag-status'), key: 'antiplag' }
    ];

    // Элементы для архивной загрузки и уведомлений
    const archiveInput = document.getElementById('archiveInput');
    const archiveName = document.getElementById('archive-name');
    const archiveAlert = document.getElementById('archiveAlert');
    const archiveErrorList = document.getElementById('archiveErrorList');
    const archiveSuccess = document.getElementById('archiveSuccess');
    const checkArchiveBtn = document.getElementById('checkArchiveBtn');
    const checkFilesBtn = document.getElementById('checkFilesBtn');
    const filesAlert = document.getElementById('filesAlert');
    const filesErrorList = document.getElementById('filesErrorList');
    const filesSuccess = document.getElementById('filesSuccess');
    const loginBtn = document.getElementById('loginBtn');
    const authMessage = document.getElementById('authMessage');
    const adminDbLink = document.getElementById('adminDbLink');

    // ---------- НАВИГАЦИЯ (7 страниц, но главная теперь включает загрузку) ----------
    const allNavLinks = document.querySelectorAll('.nav-link');
    const allPages = document.querySelectorAll('.page');

    function switchPage(targetId) {
        allPages.forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(targetId);
        if (targetPage) targetPage.classList.add('active');

        allNavLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === targetId);
        });
    }

    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (link.dataset.page) switchPage(link.dataset.page);
        });
    });

    // ---------- ОБРАБОТКА ОТДЕЛЬНЫХ ФАЙЛОВ ----------
    fileInputs.forEach(item => {
        if (!item.input) return;
        item.input.addEventListener('change', () => {
            const file = item.input.files[0];
            if (file) {
                selectedFiles[item.key] = file;
                item.nameSpan.textContent = file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name;
                item.statusSpan.textContent = 'готов';
                item.statusSpan.style.background = '#dcfce7';
            } else {
                selectedFiles[item.key] = null;
                item.nameSpan.textContent = 'файл не выбран';
                item.statusSpan.textContent = 'ожидает';
                item.statusSpan.style.background = '#e6edf6';
            }
            hideFileNotifications();
        });
    });

    // ---------- ОТПРАВКА ZIP (общая) ----------
    async function sendZipToBackend(filesToZip, sourceType = 'files') {
        const missing = Object.keys(filesToZip).filter(key => !filesToZip[key]);
        if (missing.length > 0) {
            if (sourceType === 'files') {
                displayFileResults(['Загрузите все 5 документов перед отправкой!'], false);
            } else {
                displayArchiveResults(['В архиве не найдены все 5 документов!'], false);
            }
            updateReportStatus('ошибка загрузки');
            return;
        }

        const btn = sourceType === 'files' ? checkFilesBtn : checkArchiveBtn;
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Упаковка и отправка...';

        try {
            const zip = new JSZip();
            zip.file("1_title.docx", filesToZip.title);
            zip.file("2_task.docx", filesToZip.task);
            zip.file("3_review.docx", filesToZip.review);
            zip.file("4_norm.docx", filesToZip.norm);
            zip.file("5_antiplag.pdf", filesToZip.antiplag);

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const formData = new FormData();
            formData.append('archive', zipBlob, "documents_bundle.zip");


            const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.UPLOAD_ZIP}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Ошибка сервера');
            const data = await response.json();

            if (data.errors && data.errors.length > 0) {
                if (sourceType === 'files') {
                    displayFileResults(data.errors, false);
                } else {
                    displayArchiveResults(data.errors, false);
                }
                updateReportStatus('обнаружены замечания');
            } else {
                if (sourceType === 'files') {
                    displayFileResults([], true);
                } else {
                    displayArchiveResults([], true);
                }
                updateReportStatus('успешно');
            }
        } catch (err) {
            if (sourceType === 'files') {
                displayFileResults(['Ошибка связи с сервером. Проверьте FastAPI и CORS.'], false);
            } else {
                displayArchiveResults(['Ошибка связи с сервером. Проверьте FastAPI и CORS.'], false);
            }
            updateReportStatus('ошибка сервера');
        } finally {
            btn.disabled = false;
            btn.textContent = sourceType === 'files' ? 'Проверить все документы' : 'Проверить архив';
        }
    }

    if (checkFilesBtn) checkFilesBtn.addEventListener('click', () => sendZipToBackend(selectedFiles, 'files'));
    if (checkArchiveBtn) checkArchiveBtn.addEventListener('click', async () => {
        const archiveFile = archiveInput ? archiveInput.files[0] : null;
        if (!archiveFile) {
            displayArchiveResults(['Архив не выбран.'], false);
            updateReportStatus('не выбран');
            return;
        }

        checkArchiveBtn.disabled = true;
        checkArchiveBtn.textContent = 'Распаковка и отправка...';

        try {
            const zip = await JSZip.loadAsync(archiveFile);
            
            // 1. Извлекаем все файлы, которые не являются папками и имеют нужный формат
            const validFiles = [];
            const entries = Object.values(zip.files).filter(entry => !entry.dir);

            for (const entry of entries) {
                const name = entry.name.toLowerCase();
                if (name.endsWith('.docx') || name.endsWith('.pdf')) {
                    const blob = await entry.async('blob');
                    validFiles.push({ name: entry.name, blob: blob });
                }
            }

            // 2. Проверяем, набралось ли 5 файлов
            if (validFiles.length < 5) {
                displayArchiveResults([`Найдено только ${validFiles.length} подходящих файлов (нужно 5 в формате docx или pdf).`], false);
                return;
            }

            // 3. Сортируем файлы по имени (чтобы 1.pdf был первым, 2.docx вторым и т.д.)
            validFiles.sort((a, b) => a.name.localeCompare(b.name));

            // 4. Распределяем по ключам по порядку
            const extractedFiles = {
                title:     validFiles[0].blob,
                task:      validFiles[1].blob,
                review:    validFiles[2].blob,
                norm:      validFiles[3].blob,
                antiplag:  validFiles[4].blob
            };

            console.log("Файлы успешно распределены по порядку:", validFiles.map(f => f.name));
            await sendZipToBackend(extractedFiles, 'archive');

        } catch (err) {
            console.error(err);
            displayArchiveResults(['Ошибка при разборе архива.'], false);
        } finally {
            checkArchiveBtn.disabled = false;
            checkArchiveBtn.textContent = 'Проверить архив';
        }
    });

    // ---------- ЗАГРУЗКА АРХИВА (отображение имени) ----------
    if (archiveInput) {
        archiveInput.addEventListener('change', () => {
            const file = archiveInput.files[0];
            if (archiveName) archiveName.textContent = file ? file.name : 'архив не выбран';
            hideArchiveNotifications();
        });
    }

    // ---------- СКАЧИВАНИЕ ОТЧЁТА ----------
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.DOWNLOAD}`, { method: 'GET' });
                if (!response.ok) throw new Error('Файл не найден');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Report_Normokontrol_${new Date().toISOString().slice(0,10)}.docx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                alert('Не удалось скачать отчёт. Убедитесь, что проверка на сервере завершена.');
            }
        });
    }

    // ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УВЕДОМЛЕНИЙ ----------
    function displayArchiveResults(errors, isSuccess) {
        if (!archiveErrorList || !archiveAlert || !archiveSuccess) return;
        archiveErrorList.innerHTML = '';
        if (isSuccess) {
            archiveAlert.style.display = 'none';
            archiveSuccess.style.display = 'block';
        } else {
            errors.forEach(err => {
                const li = document.createElement('li');
                li.textContent = err;
                archiveErrorList.appendChild(li);
            });
            archiveAlert.style.display = 'block';
            archiveSuccess.style.display = 'none';
        }
    }

    function displayFileResults(errors, isSuccess) {
        if (!filesErrorList || !filesAlert || !filesSuccess) return;
        filesErrorList.innerHTML = '';
        if (isSuccess) {
            filesAlert.style.display = 'none';
            filesSuccess.style.display = 'block';
        } else {
            errors.forEach(err => {
                const li = document.createElement('li');
                li.textContent = err;
                filesErrorList.appendChild(li);
            });
            filesAlert.style.display = 'block';
            filesSuccess.style.display = 'none';
        }
    }

    function hideArchiveNotifications() {
        if (archiveAlert) archiveAlert.style.display = 'none';
        if (archiveSuccess) archiveSuccess.style.display = 'none';
    }

    function hideFileNotifications() {
        if (filesAlert) filesAlert.style.display = 'none';
        if (filesSuccess) filesSuccess.style.display = 'none';
    }

    function updateReportStatus(text) {
        if (reportStatusSpan) reportStatusSpan.textContent = text;
    }

    // ---------- АВТОРИЗАЦИЯ (с ролью) ----------
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('loginEmail');
            const email = emailInput ? emailInput.value : '';
            
            if (email.includes('@normocontrol')) {
                authMessage.innerHTML = '✅ Вход выполнен. Роль: нормоконтролёр. Доступна база.';
                authMessage.style.color = '#1f7a4a';
                if (adminDbLink) adminDbLink.style.display = 'block';
            } else {
                authMessage.innerHTML = '✅ Вход выполнен. Роль: студент.';
                authMessage.style.color = '#1f7a4a';
                if (adminDbLink) adminDbLink.style.display = 'none';
            }
        });
    }
})();