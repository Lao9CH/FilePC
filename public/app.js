// State
// Global state removed, moved to local scope

let historyStack = [];
let historyIndex = -1;

// Clock
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Open specific folder
function openFolder(folderPath) {
    showToast(`Opening ${folderPath}...`, 'info');
    openFileManager(folderPath);
}

// Toast Notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
    container.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

// Window Management
let zIndexCounter = 100;

function openFileManager(initialPath = '') {
    // Check if already open? For now, allow multiple instances or just one.
    // Let's just create a new one for simplicity.
    const template = document.getElementById('window-template');
    const clone = template.content.cloneNode(true);
    const win = clone.querySelector('.window');

    document.getElementById('windows-area').appendChild(win);

    // Initialize common window behavior
    setupWindow(win);

    // Initialize File Manager Logic for this window
    initFileManager(win, initialPath);

    return win;
}

function initFileManager(win, initialPath = '') {
    const fileListEl = win.querySelector('#file-list');
    const addressInput = win.querySelector('#address-input');
    const btnBack = win.querySelector('#btn-back');
    const btnRefresh = win.querySelector('#btn-refresh');
    const btnUpload = win.querySelector('#btn-upload');
    const btnNewFolder = win.querySelector('#btn-new-folder');
    const btnRename = win.querySelector('#btn-rename');
    const btnDelete = win.querySelector('#btn-delete');
    const fileUploadInput = win.querySelector('#file-upload-input');
    const statusCount = win.querySelector('#status-count');
    const sidebarItems = win.querySelectorAll('.sidebar-item');
    const loadingOverlay = win.querySelector('.loading-overlay');
    const sidebar = win.querySelector('#fm-sidebar');
    const sidebarOverlay = win.querySelector('#sidebar-overlay');
    const btnSidebarToggle = win.querySelector('#btn-sidebar-toggle');
    const btnViewMode = win.querySelector('#btn-view-mode');

    // Local state variables
    let currentPath = '';
    let selectedFile = null;
    let viewMode = 'grid'; // 'grid' or 'carousel'

    // View Mode Toggle
    if (btnViewMode) {
        btnViewMode.addEventListener('click', () => {
            viewMode = viewMode === 'grid' ? 'carousel' : 'grid';
            btnViewMode.innerHTML = viewMode === 'carousel'
                ? '<i class="fa-solid fa-th"></i>'
                : '<i class="fa-solid fa-images"></i>';
            loadFiles(currentPath); // Reload with new view mode
        });
    }

    // Load initial path (use provided initialPath or default to root)
    loadFiles(initialPath);

    function loadFiles(path) {
        // showToast(`Loading: ${path || 'root'}`, 'info'); // Debugging
        if (loadingOverlay) loadingOverlay.classList.add('active');
        fetch(`/api/files?path=${encodeURIComponent(path)}`)
            .then(res => res.json())
            .then(data => {
                if (loadingOverlay) loadingOverlay.classList.remove('active');
                if (data.error) {
                    showToast(data.error, 'error');
                    return;
                }
                currentPath = data.currentPath;
                const rootDisplay = 'D:/CDZ';
                addressInput.value = currentPath ? `${rootDisplay}/${currentPath}` : rootDisplay;

                // Update sidebar active state
                sidebarItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.dataset.path === currentPath || (currentPath === '' && item.dataset.path === '')) {
                        item.classList.add('active');
                    }
                });

                renderFiles(data.files);
            })
            .catch(err => console.error(err));
    }

    function renderFiles(files) {
        fileListEl.innerHTML = '';
        statusCount.textContent = `${files.length} items`;

        if (viewMode === 'carousel') {
            const imageFiles = files.filter(f => {
                const ext = f.name.split('.').pop().toLowerCase();
                return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
            });

            if (imageFiles.length > 0) {
                fileListEl.classList.add('carousel-mode');
                renderCarousel(imageFiles);
                return;
            } else {
                fileListEl.classList.remove('carousel-mode');
                // Fallback to grid if no images, but keep viewMode state
            }
        } else {
            fileListEl.classList.remove('carousel-mode');
        }

        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';

            let iconClass = 'fa-file';
            let colorClass = '';

            if (file.isDirectory) {
                iconClass = 'fa-folder';
                colorClass = 'folder';
            } else {
                const ext = file.name.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
                    // Use Thumbnail
                    const viewUrl = `/api/view?path=${encodeURIComponent(file.path)}`;
                    item.innerHTML = `
                        <img src="${viewUrl}" class="file-thumb" loading="lazy" alt="${file.name}">
                        <div class="file-name">${file.name}</div>
                    `;
                    item.title = file.name; // Show full filename on hover
                    // Skip default innerHTML
                    addListeners(item, file, files);
                    fileListEl.appendChild(item);
                    return;
                }
                else if (['js', 'html', 'css', 'json', 'py'].includes(ext)) { iconClass = 'fa-file-code'; colorClass = 'code'; }
                else if (['pdf'].includes(ext)) { iconClass = 'fa-file-pdf'; colorClass = 'pdf'; }
                else if (['mp3', 'wav'].includes(ext)) { iconClass = 'fa-music'; colorClass = 'music'; }
                else if (['mp4', 'mkv'].includes(ext)) { iconClass = 'fa-film'; colorClass = 'video'; }
            }

            item.innerHTML = `
                <div class="file-icon ${colorClass}"><i class="fa-solid ${iconClass}"></i></div>
                <div class="file-name">${file.name}</div>
            `;
            item.title = file.name; // Show full filename on hover
            addListeners(item, file, files);
            fileListEl.appendChild(item);
        });
    }

    function renderCarousel(imageFiles) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'preview-content';

        // Ensure container takes full height
        previewContainer.style.height = '100%';
        previewContainer.style.width = '100%';

        let currentIndex = 0;
        let autoPlayInterval = null;

        // Main Image Area
        const mainArea = document.createElement('div');
        mainArea.className = 'preview-main-area';

        const img = document.createElement('img');
        // Initial load
        img.src = `/api/view?path=${encodeURIComponent(imageFiles[0].path)}`;

        // Double-click to toggle fullscreen (using the container)
        img.addEventListener('dblclick', () => {
            if (!document.fullscreenElement) {
                if (previewContainer.requestFullscreen) previewContainer.requestFullscreen();
                else if (previewContainer.webkitRequestFullscreen) previewContainer.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
        });

        mainArea.appendChild(img);
        previewContainer.appendChild(mainArea);

        // Add school slogan banner (only visible in fullscreen)
        const sloganBanner = document.createElement('div');
        sloganBanner.className = 'fullscreen-slogan';
        sloganBanner.textContent = '黄石三中课前5分钟';
        previewContainer.appendChild(sloganBanner);

        // Add exit fullscreen button
        const exitFullscreenBtn = document.createElement('button');
        exitFullscreenBtn.className = 'exit-fullscreen-btn';
        exitFullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i> 退出全屏';
        exitFullscreenBtn.addEventListener('click', () => {
            if (document.exitFullscreen) document.exitFullscreen();
        });
        previewContainer.appendChild(exitFullscreenBtn);

        // Controls (Auto Play)
        const controls = document.createElement('div');
        controls.className = 'preview-controls';
        const autoPlayBtn = document.createElement('button');
        autoPlayBtn.className = 'control-btn';
        autoPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto Play';
        controls.appendChild(autoPlayBtn);
        previewContainer.appendChild(controls);

        // Image Counter
        const imageCounter = document.createElement('div');
        imageCounter.className = 'image-counter';
        imageCounter.textContent = `1 / ${imageFiles.length}`;
        previewContainer.appendChild(imageCounter);

        // Filmstrip
        const filmstrip = document.createElement('div');
        filmstrip.className = 'preview-filmstrip';

        const updateImage = (index) => {
            if (index < 0) index = imageFiles.length - 1;
            if (index >= imageFiles.length) index = 0;
            currentIndex = index;

            const nextFile = imageFiles[currentIndex];
            img.src = `/api/view?path=${encodeURIComponent(nextFile.path)}`;

            // Update counter
            imageCounter.textContent = `${currentIndex + 1} / ${imageFiles.length}`;

            // Update Filmstrip
            filmstrip.querySelectorAll('.filmstrip-item').forEach((el, i) => {
                if (i === currentIndex) {
                    el.classList.add('active');
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                } else {
                    el.classList.remove('active');
                }
            });
        };

        imageFiles.forEach((f, index) => {
            const stripItem = document.createElement('div');
            stripItem.className = `filmstrip-item ${index === currentIndex ? 'active' : ''}`;
            stripItem.innerHTML = `<img src="/api/view?path=${encodeURIComponent(f.path)}" loading="lazy">`;
            stripItem.onclick = (e) => {
                e.stopPropagation();
                updateImage(index);
            };
            filmstrip.appendChild(stripItem);
        });
        previewContainer.appendChild(filmstrip);

        if (imageFiles.length > 1) {
            // Prev Button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'preview-nav-btn prev';
            prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            mainArea.appendChild(prevBtn);

            // Next Button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'preview-nav-btn next';
            nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            mainArea.appendChild(nextBtn);

            prevBtn.onclick = (e) => { e.stopPropagation(); updateImage(currentIndex - 1); };
            nextBtn.onclick = (e) => { e.stopPropagation(); updateImage(currentIndex + 1); };

            // Auto Play Logic
            autoPlayBtn.onclick = () => {
                if (autoPlayInterval) {
                    clearInterval(autoPlayInterval);
                    autoPlayInterval = null;
                    autoPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto Play';
                } else {
                    updateImage(currentIndex + 1);
                    autoPlayInterval = setInterval(() => {
                        updateImage(currentIndex + 1);
                    }, 3000);
                    autoPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
                }
            };
        }

        fileListEl.appendChild(previewContainer);
    }


    function addListeners(element, file, allFiles) {
        // Click to select
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            win.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            selectedFile = file;
            btnRename.disabled = false;
            btnDelete.disabled = false;
        });

        // Double click to open/preview
        element.addEventListener('dblclick', () => {
            if (file.isDirectory) {
                loadFiles(file.path);
            } else {
                openPreview(file, allFiles);
            }
        });

        // Right click to delete
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                fetch(`/api/delete?path=${encodeURIComponent(file.path)}`, { method: 'DELETE' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.error) showToast(data.error, 'error');
                        else {
                            showToast('Deleted successfully', 'success');
                            loadFiles(currentPath);
                        }
                    })
                    .catch(err => console.error(err));
            }
        });
    }

    // Deselect when clicking empty space
    fileListEl.addEventListener('click', () => {
        win.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
        selectedFile = null;
        btnRename.disabled = true;
        btnDelete.disabled = true;
    });



    btnRefresh.addEventListener('click', () => loadFiles(currentPath));

    btnBack.addEventListener('click', () => {
        // Simple parent directory logic
        if (currentPath === '' || currentPath === '.') return;
        const parts = currentPath.split('/');
        parts.pop();
        loadFiles(parts.join('/'));
    });

    btnNewFolder.addEventListener('click', () => {
        const name = prompt("Folder Name:");
        if (name) {
            fetch(`/api/folder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: currentPath, name })
            }).then(res => res.json()).then(data => {
                if (data.error) showToast(data.error, 'error');
                else {
                    showToast('Folder created', 'success');
                    loadFiles(currentPath);
                }
            });
        }
    });

    btnRename.addEventListener('click', () => {
        if (!selectedFile) return;
        const newName = prompt("New Name:", selectedFile.name);
        if (newName && newName !== selectedFile.name) {
            fetch(`/api/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: selectedFile.path, newName })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.error) showToast(data.error, 'error');
                    else {
                        showToast('Renamed successfully', 'success');
                        loadFiles(currentPath);
                    }
                });
        }
    });

    btnDelete.addEventListener('click', () => {
        if (!selectedFile) return;
        if (confirm(`Are you sure you want to delete "${selectedFile.name}"?`)) {
            fetch(`/api/delete?path=${encodeURIComponent(selectedFile.path)}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    if (data.error) showToast(data.error, 'error');
                    else {
                        showToast('Deleted successfully', 'success');
                        loadFiles(currentPath);
                    }
                });
        }
    });

    btnUpload.addEventListener('click', () => {
        fileUploadInput.click();
    });

    // Sidebar Navigation
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const path = item.dataset.path;
            loadFiles(path);
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });

    // Sidebar Shortcuts (red text links)
    const sidebarShortcuts = win.querySelectorAll('.sidebar-shortcut');
    sidebarShortcuts.forEach(shortcut => {
        shortcut.addEventListener('click', (e) => {
            e.stopPropagation();
            const path = shortcut.dataset.path;
            loadFiles(path);
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });

    // Mobile Sidebar Toggle
    if (btnSidebarToggle) {
        btnSidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    fileUploadInput.addEventListener('change', () => {
        if (fileUploadInput.files.length > 0) {
            const formData = new FormData();
            formData.append('file', fileUploadInput.files[0]);

            fetch(`/api/upload?path=${encodeURIComponent(currentPath)}`, {
                method: 'POST',
                body: formData
            }).then(() => {
                showToast('文件上传成功', 'success');
                loadFiles(currentPath);
                fileUploadInput.value = ''; // reset
            }).catch(err => {
                showToast('上传失败', 'error');
                console.error(err);
            });
        }
    });

    // Drag and Drop Upload
    fileListEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileListEl.classList.add('drag-over');
    });

    fileListEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileListEl.classList.remove('drag-over');
    });

    fileListEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileListEl.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // Upload all dropped files
            Array.from(files).forEach(file => {
                const formData = new FormData();
                formData.append('file', file);

                fetch(`/api/upload?path=${encodeURIComponent(currentPath)}`, {
                    method: 'POST',
                    body: formData
                }).then(() => {
                    showToast(`${file.name} 上传成功`, 'success');
                    loadFiles(currentPath);
                }).catch(err => {
                    showToast(`${file.name} 上传失败`, 'error');
                    console.error(err);
                });
            });
        }
    });
}

function openPreview(file, allFiles = []) {
    const ext = file.name.split('.').pop().toLowerCase();
    const viewUrl = `/api/view?path=${encodeURIComponent(file.path)}`;

    // Determine type
    let type = 'unknown';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) type = 'image';
    else if (['mp4', 'webm', 'ogg'].includes(ext)) type = 'video';
    else if (['mp3', 'wav'].includes(ext)) type = 'audio';
    else if (['pdf'].includes(ext)) type = 'pdf';
    else if (['txt', 'js', 'css', 'html', 'json', 'md', 'py', 'java', 'c', 'cpp', 'h'].includes(ext)) type = 'text';

    if (type === 'unknown') {
        // Fallback to download
        window.open(`/api/download?path=${encodeURIComponent(file.path)}`, '_blank');
        return;
    }

    // Create Window
    const template = document.getElementById('window-template');
    const clone = template.content.cloneNode(true);
    const win = clone.querySelector('.window');

    // Customize Window
    win.querySelector('.window-title span').textContent = file.name;
    const contentArea = win.querySelector('.window-content');
    contentArea.innerHTML = ''; // Clear default FM layout

    const previewContainer = document.createElement('div');
    previewContainer.className = 'preview-content';

    // Carousel Logic for Images
    if (type === 'image') {
        const imageFiles = allFiles.filter(f => {
            const e = f.name.split('.').pop().toLowerCase();
            return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(e);
        });

        let currentIndex = imageFiles.findIndex(f => f.path === file.path);
        let autoPlayInterval = null;

        // Main Image Area
        const mainArea = document.createElement('div');
        mainArea.className = 'preview-main-area';

        const img = document.createElement('img');
        img.src = viewUrl;

        // Double-click to toggle fullscreen
        img.addEventListener('dblclick', () => {
            if (!document.fullscreenElement) {
                // Enter fullscreen
                if (previewContainer.requestFullscreen) {
                    previewContainer.requestFullscreen();
                } else if (previewContainer.webkitRequestFullscreen) {
                    previewContainer.webkitRequestFullscreen();
                } else if (previewContainer.msRequestFullscreen) {
                    previewContainer.msRequestFullscreen();
                }
            } else {
                // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        });

        mainArea.appendChild(img);
        previewContainer.appendChild(mainArea);

        // Add school slogan banner (only visible in fullscreen)
        const sloganBanner = document.createElement('div');
        sloganBanner.className = 'fullscreen-slogan';

        // Determine slogan based on folder path
        // Determine slogan based on folder path
        let sloganText = '每天进步一点点！'; // Default
        if (file.path.includes('5分钟')) sloganText = '黄石三中 课前5分钟';
        else if (file.path.includes('提高练习')) sloganText = '挑战自我，迈向成功！';
        else if (file.path.includes('学生练习')) sloganText = '我的作业留影';
        else if (file.path.includes('作业答案')) sloganText = '昨日答案，自行订正！';

        sloganBanner.textContent = sloganText;
        previewContainer.appendChild(sloganBanner);

        // Add exit fullscreen button (only visible in fullscreen)
        const exitFullscreenBtn = document.createElement('button');
        exitFullscreenBtn.className = 'exit-fullscreen-btn';
        exitFullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i> 退出全屏';
        exitFullscreenBtn.addEventListener('click', () => {
            // Reset Zoom and Rotation
            zoomLevel = 1;
            rotation = 0;
            translateX = 0;
            translateY = 0;
            updateTransform();

            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        });
        previewContainer.appendChild(exitFullscreenBtn);

        // Zoom Controls (only visible in fullscreen)
        const zoomControls = document.createElement('div');
        zoomControls.className = 'zoom-controls';

        const rotateLeftBtn = document.createElement('button');
        rotateLeftBtn.className = 'zoom-btn';
        rotateLeftBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
        rotateLeftBtn.title = '向左旋转';

        const rotateRightBtn = document.createElement('button');
        rotateRightBtn.className = 'zoom-btn';
        rotateRightBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
        rotateRightBtn.title = '向右旋转';

        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'zoom-btn';
        zoomInBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass-plus"></i>';
        zoomInBtn.title = '放大';

        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'zoom-btn';
        zoomOutBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass-minus"></i>';
        zoomOutBtn.title = '缩小';

        const zoomResetBtn = document.createElement('button');
        zoomResetBtn.className = 'zoom-btn';
        zoomResetBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
        zoomResetBtn.title = '重置';

        zoomControls.appendChild(rotateLeftBtn);
        zoomControls.appendChild(rotateRightBtn);
        zoomControls.appendChild(zoomInBtn);
        zoomControls.appendChild(zoomOutBtn);
        zoomControls.appendChild(zoomResetBtn);
        previewContainer.appendChild(zoomControls);

        // Zoom and Rotation Logic
        let zoomLevel = 1;
        let rotation = 0;
        let isDragging = false;
        let startX, startY, translateX = 0, translateY = 0;

        function updateTransform() {
            img.style.transform = `rotate(${rotation}deg) scale(${zoomLevel}) translate(${translateX / zoomLevel}px, ${translateY / zoomLevel}px)`;
            img.style.cursor = zoomLevel > 1 ? 'grab' : 'zoom-in';
        }

        rotateLeftBtn.onclick = (e) => { e.stopPropagation(); rotation -= 90; updateTransform(); };
        rotateRightBtn.onclick = (e) => { e.stopPropagation(); rotation += 90; updateTransform(); };
        zoomInBtn.onclick = (e) => { e.stopPropagation(); zoomLevel += 0.5; updateTransform(); };
        zoomOutBtn.onclick = (e) => { e.stopPropagation(); zoomLevel = Math.max(1, zoomLevel - 0.5); if (zoomLevel === 1) { translateX = 0; translateY = 0; } updateTransform(); };
        zoomResetBtn.onclick = (e) => { e.stopPropagation(); zoomLevel = 1; rotation = 0; translateX = 0; translateY = 0; updateTransform(); };

        // Mouse Wheel Zoom
        img.addEventListener('wheel', (e) => {
            if (document.fullscreenElement) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    zoomLevel += 0.2;
                } else {
                    zoomLevel = Math.max(1, zoomLevel - 0.2);
                }
                if (zoomLevel === 1) { translateX = 0; translateY = 0; }
                updateTransform();
            }
        });

        // Panning Logic
        img.addEventListener('mousedown', (e) => {
            if (zoomLevel > 1) {
                isDragging = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
                img.style.cursor = 'grabbing';
                e.preventDefault(); // Prevent drag image
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging && zoomLevel > 1) {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                img.style.cursor = 'grab';
            }
        });

        // Controls (Auto Play)
        const controls = document.createElement('div');
        controls.className = 'preview-controls';
        const autoPlayBtn = document.createElement('button');
        autoPlayBtn.className = 'control-btn';
        autoPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto Play';
        controls.appendChild(autoPlayBtn);
        previewContainer.appendChild(controls);

        // Image Counter
        const imageCounter = document.createElement('div');
        imageCounter.className = 'image-counter';
        imageCounter.textContent = `${currentIndex + 1} / ${imageFiles.length}`;
        previewContainer.appendChild(imageCounter);

        // Filmstrip
        const filmstrip = document.createElement('div');
        filmstrip.className = 'preview-filmstrip';

        // Define updateImage function first
        const updateImage = (index) => {
            if (index < 0) index = imageFiles.length - 1;
            if (index >= imageFiles.length) index = 0;
            currentIndex = index;

            // Reset Zoom and Rotation
            zoomLevel = 1;
            rotation = 0;
            translateX = 0;
            translateY = 0;
            updateTransform();

            const nextFile = imageFiles[currentIndex];
            img.src = `/api/view?path=${encodeURIComponent(nextFile.path)}`;
            win.querySelector('.window-title span').textContent = nextFile.name;

            // Update counter
            imageCounter.textContent = `${currentIndex + 1} / ${imageFiles.length}`;

            // Update Filmstrip
            filmstrip.querySelectorAll('.filmstrip-item').forEach((el, i) => {
                if (i === currentIndex) {
                    el.classList.add('active');
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                } else {
                    el.classList.remove('active');
                }
            });
        };

        // Render Filmstrip Items (after updateImage is defined)
        imageFiles.forEach((f, index) => {
            const stripItem = document.createElement('div');
            stripItem.className = `filmstrip-item ${index === currentIndex ? 'active' : ''}`;
            stripItem.innerHTML = `<img src="/api/view?path=${encodeURIComponent(f.path)}" loading="lazy">`;
            stripItem.onclick = (e) => {
                e.stopPropagation();
                updateImage(index);
            };
            filmstrip.appendChild(stripItem);
        });
        previewContainer.appendChild(filmstrip);

        if (imageFiles.length > 1) {
            // Prev Button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'preview-nav-btn prev';
            prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            mainArea.appendChild(prevBtn);

            // Next Button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'preview-nav-btn next';
            nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            mainArea.appendChild(nextBtn);

            prevBtn.onclick = (e) => { e.stopPropagation(); updateImage(currentIndex - 1); };
            nextBtn.onclick = (e) => { e.stopPropagation(); updateImage(currentIndex + 1); };

            // Auto Play Logic
            autoPlayBtn.onclick = () => {
                if (autoPlayInterval) {
                    clearInterval(autoPlayInterval);
                    autoPlayInterval = null;
                    autoPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto Play';
                } else {
                    updateImage(currentIndex + 1); // Start immediately
                    autoPlayInterval = setInterval(() => {
                        updateImage(currentIndex + 1);
                    }, 3000);
                    autoPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
                }
            };

            // Keyboard Support
            win.tabIndex = 0; // Make focusable
            win.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') updateImage(currentIndex - 1);
                if (e.key === 'ArrowRight') updateImage(currentIndex + 1);
                if (e.key === ' ') { // Space to toggle autoplay
                    e.preventDefault();
                    autoPlayBtn.click();
                }
            });

            // Touch Swipe Support
            let touchStartX = 0;
            let touchStartY = 0;
            let touchEndX = 0;
            let touchEndY = 0;
            const minSwipeDistance = 50; // Minimum distance for a swipe

            mainArea.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });

            mainArea.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
                handleSwipe();
            }, { passive: true });

            const handleSwipe = () => {
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;

                // Check if horizontal swipe is dominant
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                    if (deltaX > 0) {
                        // Swipe right - previous image
                        updateImage(currentIndex - 1);
                    } else {
                        // Swipe left - next image
                        updateImage(currentIndex + 1);
                    }
                }
            };

            // Cleanup on close
            win.querySelector('.close').addEventListener('click', () => {
                if (autoPlayInterval) clearInterval(autoPlayInterval);
            });
        }
    } else if (type === 'video') {
        previewContainer.innerHTML = `<video controls autoplay src="${viewUrl}"></video>`;
    } else if (type === 'audio') {
        previewContainer.innerHTML = `<audio controls autoplay src="${viewUrl}" class="preview-audio"></audio>`;
    } else if (type === 'pdf') {
        previewContainer.innerHTML = `<iframe src="${viewUrl}"></iframe>`;
    } else if (type === 'text') {
        previewContainer.innerHTML = `<div class="preview-text">Loading...</div>`;
        fetch(viewUrl)
            .then(res => res.text())
            .then(text => {
                previewContainer.querySelector('.preview-text').textContent = text;
            });
    }

    contentArea.appendChild(previewContainer);
    document.getElementById('windows-area').appendChild(win);

    // Window Logic (Reuse basic logic)
    setupWindow(win);
    win.focus(); // Focus for keyboard events
}

function setupWindow(win) {
    // Center window
    win.style.left = '150px';
    win.style.top = '80px';
    win.style.zIndex = ++zIndexCounter;

    // Make Draggable (Disable on mobile)
    const header = win.querySelector('.window-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
        if (window.innerWidth <= 768) return; // Disable drag on mobile
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = win.offsetLeft;
        initialTop = win.offsetTop;
        win.style.zIndex = ++zIndexCounter;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        win.style.left = `${initialLeft + dx}px`;
        win.style.top = `${initialTop + dy}px`;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    win.addEventListener('mousedown', () => {
        win.style.zIndex = ++zIndexCounter;
    });

    // Controls
    win.querySelector('.close').addEventListener('click', () => win.remove());
    win.querySelector('.maximize').addEventListener('click', () => {
        if (win.style.width === '100%') {
            win.style.width = '800px';
            win.style.height = '500px';
            win.style.top = '80px';
            win.style.left = '150px';
        } else {
            win.style.width = '100%';
            win.style.height = 'calc(100vh - 48px)';
            win.style.top = '0';
            win.style.left = '0';
        }
    });
}
