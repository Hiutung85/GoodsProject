const { ipcRenderer } = window.electron;

// 1. 基础配置
const BASE_DATA_PATH = "D:\\MyGuziData\\GoodsImage";
let allGuziData = [];
let selectedImagePath = null; 
let editIndex = -1; 
const charFilters = {}; // 记录每个角色的筛选状态

// 🚀 开机第一件事：去读取 D 盘账本
function initWarehouse() {
    ipcRenderer.invoke('read-data').then(data => {
        allGuziData = Array.isArray(data) ? data : [];
        displayGuziList(allGuziData);
    }).catch(err => {
        console.error("读取失败，可能是第一次运行:", err);
        displayGuziList([]);
    });
}

// 🖼️ 图片路径转换特权通道
function getFinalImageUrl(filename) {
    if (!filename || filename === 'default.jpg') {
        return 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500'; 
    }
    // 使用我们在 main.js 注册的特权协议 guzi-local://
    return `guzi-local://D:/MyGuziData/GoodsImage/${filename}`;
}

// 📦 核心渲染函数：把数据画在网页上
function displayGuziList(guziArray) {
    const warehouseElement = document.getElementById('warehouse');
    if (!warehouseElement) return;
    warehouseElement.innerHTML = ''; 

    if (!guziArray || guziArray.length === 0) {
        warehouseElement.innerHTML = '<div style="text-align:center; padding:50px; color:#aaa;">✨ 仓库还是空空如也，快让宝贝入库吧... ✨</div>';
        // 安全更新总账
        const tc = document.getElementById('total-count');
        const tp = document.getElementById('total-price');
        if (tc) tc.innerText = '0';
        if (tp) tp.innerText = '￥0.00';
        return;
    }

    // A. 计算全局总账（顶部显示）
    let globalCount = 0;
    let globalPrice = 0;
    guziArray.forEach(item => {
        globalCount += (parseInt(item.count) || 0);
        globalPrice += (parseFloat(item.price) || 0) * (parseInt(item.count) || 0);
    });

    // B. 按角色分组逻辑
    const charGroups = {};
    guziArray.forEach((guzi, index) => {
        const charName = guzi.char || '未知角色';
        if (!charGroups[charName]) charGroups[charName] = [];
        charGroups[charName].push({ ...guzi, originalIndex: index });
    });

    // C. 循环每个角色大区块
    for (const charName in charGroups) {
        const allItemsOfChar = charGroups[charName];
        const currentFilter = charFilters[charName] || '全部';

        // 🎯 执行角色内部过滤
        const displayItems = currentFilter === '全部' 
            ? allItemsOfChar 
            : allItemsOfChar.filter(item => item.cat === currentFilter);

        // 🛠️ 计算该角色当前的局部统计（会随筛选变动）
        let charFilteredCount = 0;
        let charFilteredPrice = 0;
        displayItems.forEach(item => {
            const c = parseInt(item.count) || 0;
            const p = parseFloat(item.price) || 0;
            charFilteredCount += c;
            charFilteredPrice += (p * c);
        });

        const section = document.createElement('div');
        section.className = 'character-section';
        section.innerHTML = `
            <div class="character-header">
                <div class="character-title">👤 角色：${charName}</div>
                <div class="character-ops-area">
                    <select class="char-filter-select" onchange="filterChar('${charName}', this.value)">
                        <option value="全部" ${currentFilter === '全部' ? 'selected' : ''}>全部</option>
                        <option value="吧唧" ${currentFilter === '吧唧' ? 'selected' : ''}>吧唧</option>
                        <option value="亚克力" ${currentFilter === '亚克力' ? 'selected' : ''}>亚克力</option>
                        <option value="纸片" ${currentFilter === '纸片' ? 'selected' : ''}>纸片</option>
                        <option value="杯垫" ${currentFilter === '杯垫' ? 'selected' : ''}>杯垫</option>
                        <option value="其他" ${currentFilter === '其他' ? 'selected' : ''}>其他</option>
                    </select>
                    <div class="character-sum">
                        ${currentFilter === '全部' ? '合计' : currentFilter}：
                        ${charFilteredCount} 件 • ￥${charFilteredPrice.toFixed(2)}
                    </div>
                </div>
            </div>
            <div class="grid"></div>
        `;
        warehouseElement.appendChild(section);

        const gridElement = section.querySelector('.grid');
        displayItems.forEach(guzi => {
            const card = document.createElement('div');
            card.className = 'card';
            const finalImgUrl = getFinalImageUrl(guzi.image);
            card.innerHTML = `
                <div class="card-ops">
                    <button class="edit-mini-btn" title="编辑" onclick="editGuzi(${guzi.originalIndex})">📝</button>
                    <button class="delete-mini-btn" title="删除" onclick="deleteGuzi(${guzi.originalIndex})">❌</button>
                </div>
                <img src="${finalImgUrl}" alt="${guzi.name}">
                <div class="card-content">
                    <span class="tag">${guzi.cat || '未分类'}</span>
                    <div class="title">${guzi.name}</div>
                    <div class="info">
                        <span class="price">￥${parseFloat(guzi.price).toFixed(2)}</span>
                        <span class="count">数量: ${guzi.count}</span>
                    </div>
                </div>
            `;
            gridElement.appendChild(card);
        });
    }

    // 更新顶部总账
    const gtc = document.getElementById('total-count');
    const gtp = document.getElementById('total-price');
    if (gtc) gtc.innerText = globalCount;
    if (gtp) gtp.innerText = `￥${globalPrice.toFixed(2)}`;
}

// 💡 角色局部筛选触发函数
window.filterChar = function(charName, category) {
    charFilters[charName] = category;
    displayGuziList(allGuziData);
};

// 📷 唤起原生选图窗口
document.querySelector('.file-input-label').onclick = async (e) => {
    e.preventDefault(); 
    const filePath = await ipcRenderer.invoke('open-file-dialog');
    if (filePath) {
        selectedImagePath = filePath;
        const fileName = filePath.split('\\').pop().split('/').pop();
        document.getElementById('file-name-preview').innerText = fileName;
    }
};

// 📥 点击“新谷入库”按钮
document.getElementById('add-btn').onclick = async () => {
    const name = document.getElementById('guzi-name').value.trim();
    const charName = document.getElementById('guzi-char').value.trim();
    const cat = document.getElementById('guzi-cat').value;
    const price = document.getElementById('guzi-price').value;
    const count = document.getElementById('guzi-count').value;

    if (!name || !price) {
        alert('✨ 亲爱的，至少把名字和单价写完呀！ ✨');
        return;
    }

    let savedFilename = 'default.jpg';
    
    // 如果在编辑状态下没重新选图，保留旧图
    if (editIndex > -1 && !selectedImagePath) {
        savedFilename = allGuziData[editIndex].image;
    }

    if (selectedImagePath) {
        try {
            savedFilename = await ipcRenderer.invoke('upload-image', selectedImagePath);
        } catch (err) { console.error(err); }
    }

    const guziItem = {
        name,
        char: charName || '未知角色',
        cat,
        price,
        count: count || 1,
        image: savedFilename
    };

    if (editIndex > -1) {
        allGuziData[editIndex] = guziItem;
        editIndex = -1;
        document.getElementById('add-btn').innerText = '新谷入库';
        document.getElementById('cancel-btn').style.display = 'none';
    } else {
        allGuziData.push(guziItem);
    }

    await ipcRenderer.invoke('save-data', allGuziData);
    
    // 清空表单
    document.getElementById('guzi-name').value = '';
    document.getElementById('guzi-char').value = '';
    document.getElementById('guzi-price').value = '';
    document.getElementById('guzi-count').value = '1';
    selectedImagePath = null; 
    document.getElementById('file-name-preview').innerText = '未选择';

    displayGuziList(allGuziData);
};

// 📝 编辑功能
window.editGuzi = function(originalIndex) {
    const target = allGuziData[originalIndex];
    if (!target) return;
    editIndex = originalIndex;
    document.getElementById('guzi-name').value = target.name;
    document.getElementById('guzi-char').value = target.char === '未知角色' ? '' : target.char;
    document.getElementById('guzi-cat').value = target.cat || '吧唧';
    document.getElementById('guzi-price').value = target.price;
    document.getElementById('guzi-count').value = target.count;
    document.getElementById('add-btn').innerText = '确认修改 💾';
    document.getElementById('cancel-btn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ❌ 删除功能
window.deleteGuzi = async function(originalIndex) {
    if (confirm('确定要让这个宝贝消失吗？😭')) {
        allGuziData.splice(originalIndex, 1);
        await ipcRenderer.invoke('save-data', allGuziData);
        displayGuziList(allGuziData);
    }
};

// 🔍 搜索定位功能
document.getElementById('search-input').oninput = function() {
    const keyword = this.value.toLowerCase().trim();
    if (!keyword) { displayGuziList(allGuziData); return; }
    const filtered = allGuziData.filter(g => 
        g.name.toLowerCase().includes(keyword) || g.char.toLowerCase().includes(keyword)
    );
    displayGuziList(filtered);
};

// 🚀 启动！
initWarehouse();