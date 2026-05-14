// 【renderer.js 终极完全体】—— 增、删、改、查、图片特权通道全齐！

const { ipcRenderer } = window.electron;

const BASE_DATA_PATH = "D:\\MyGuziData\\GoodsImage";
let allGuziData = [];
let selectedImagePath = null; 
let editIndex = -1; // 💡 新增：用来记录当前正在编辑哪一个谷子（-1代表没有在编辑）

function initWarehouse() {
    ipcRenderer.invoke('read-data').then(data => {
        allGuziData = data || [];
        displayGuziList(allGuziData);
    }).catch(err => console.error(err));
}

function getFinalImageUrl(filename) {
    if (!filename || filename === 'default.jpg') {
        return 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500'; 
    }
    return `guzi-local://D:/MyGuziData/GoodsImage/${filename}`;
}

function displayGuziList(guziArray) {
    const warehouseElement = document.getElementById('warehouse');
    if (!warehouseElement) return;
    warehouseElement.innerHTML = ''; 

    if (!guziArray || guziArray.length === 0) {
        warehouseElement.innerHTML = '<div style="text-align:center; padding:50px; color:#aaa;">✨ 仓库还是空空如也，快让你的宝贝入库吧... ✨</div>';
        document.getElementById('total-count').innerText = '0';
        document.getElementById('total-price').innerText = '￥0.00';
        return;
    }

    const charGroups = {};
    guziArray.forEach((guzi, index) => {
        const charName = guzi.char || '未知角色';
        if (!charGroups[charName]) charGroups[charName] = [];
        charGroups[charName].push({ ...guzi, originalIndex: index });
    });

    let totalCount = 0;
    let totalPrice = 0;

    for (const charName in charGroups) {
        const items = charGroups[charName];
        let charCount = 0;
        let charPrice = 0;
        
        items.forEach(item => {
            const c = parseInt(item.count) || 1;
            const p = parseFloat(item.price) || 0;
            charCount += c;
            charPrice += (p * c);
            totalCount += c;
            totalPrice += (p * c);
        });

        const section = document.createElement('div');
        section.className = 'character-section';
        section.innerHTML = `
            <div class="character-header">
                <div class="character-title">👤 角色：${charName}</div>
                <div class="character-sum">共 ${charCount} 件 • 价值：￥${charPrice.toFixed(2)}</div>
            </div>
            <div class="grid" id="grid-${charName}"></div>
        `;
        warehouseElement.appendChild(section);

        const gridElement = document.getElementById(`grid-${charName}`);
        items.forEach(guzi => {
            const card = document.createElement('div');
            card.className = 'card';
            const finalImgUrl = getFinalImageUrl(guzi.image);
            
            // 🛠️ 【修改回正】把原本漏掉的 📝 编辑按钮和 ❌ 删除按钮重新组合画出来！
            card.innerHTML = `
                <div class="card-ops">
                    <button class="edit-mini-btn" title="编辑" onclick="editGuzi(${guzi.originalIndex})">📝</button>
                    <button class="delete-mini-btn" title="删除" onclick="deleteGuzi(${guzi.originalIndex})">❌</button>
                </div>
                <img src="${finalImgUrl}" alt="${guzi.name}">
                <div class="title">${guzi.name}</div>
                <div class="info">
                    <span class="price">￥${parseFloat(guzi.price).toFixed(2)}</span>
                    <span class="count">数量: ${guzi.count}</span>
                </div>
            `;
            gridElement.appendChild(card);
        });
    }

    document.getElementById('total-count').innerText = totalCount;
    document.getElementById('total-price').innerText = `￥${totalPrice.toFixed(2)}`;
}

// 📷 选择图片按钮点击
document.querySelector('.file-input-label').onclick = async (e) => {
    e.preventDefault(); 
    const filePath = await ipcRenderer.invoke('open-file-dialog');
    if (filePath) {
        selectedImagePath = filePath;
        const fileName = filePath.split('\\').pop().split('/').pop();
        document.getElementById('file-name-preview').innerText = fileName;
    }
};

// 📥 点击“新谷入库” / “确认修改” 大按钮
document.getElementById('add-btn').onclick = async () => {
    const name = document.getElementById('guzi-name').value.trim();
    const charName = document.getElementById('guzi-char').value.trim();
    const cat = document.getElementById('guzi-cat').value;
    const price = document.getElementById('guzi-price').value;
    const count = document.getElementById('guzi-count').value;

    if (!name || !price) {
        alert('补充单价和数量');
        return;
    }

    let savedFilename = 'default.jpg';
    
    // 如果在编辑状态下没有重新选图，我们要保留它原有的图片名
    if (editIndex > -1 && !selectedImagePath) {
        savedFilename = allGuziData[editIndex].image;
    }

    // 如果选了新图或者重新换了图，执行搬家
    if (selectedImagePath) {
        try {
            savedFilename = await ipcRenderer.invoke('upload-image', selectedImagePath);
        } catch (err) {
            console.error(err);
        }
    }

    const guziItem = {
        name: name,
        char: charName || '未知角色',
        cat: cat,
        price: price,
        count: count || 1,
        image: savedFilename
    };

    if (editIndex > -1) {
        // 📝 正在编辑：直接用新数据替换掉旧位置的数据
        allGuziData[editIndex] = guziItem;
        editIndex = -1; // 重置状态
        document.getElementById('add-btn').innerText = '新谷入库 ✨';
        document.getElementById('cancel-btn').style.display = 'none';
    } else {
        // 📥 正常入库：直接追加到尾部
        allGuziData.push(guziItem);
    }

    // 存盘
    await ipcRenderer.invoke('save-data', allGuziData);

    // 重置并清空输入框
    document.getElementById('guzi-name').value = '';
    document.getElementById('guzi-char').value = '';
    document.getElementById('guzi-price').value = '';
    document.getElementById('guzi-count').value = '1';
    selectedImagePath = null; 
    document.getElementById('file-name-preview').innerText = '未选择';

    displayGuziList(allGuziData);
};

// 📝 【功能回正】点击卡片上的 📝 按钮，把数据倒腾回上面的输入框里
window.editGuzi = function(originalIndex) {
    const target = allGuziData[originalIndex];
    if (!target) return;

    editIndex = originalIndex; // 记录目前正在改谁

    // 把旧数据填回表单
    document.getElementById('guzi-name').value = target.name;
    document.getElementById('guzi-char').value = target.char === '未知角色' ? '' : target.char;
    document.getElementById('guzi-cat').value = target.cat || '吧唧';
    document.getElementById('guzi-price').value = target.price;
    document.getElementById('guzi-count').value = target.count;
    document.getElementById('file-name-preview').innerText = '不更改请不选图';

    // 把大按钮的字变成“确认修改”，并且把旁边藏着的“取消编辑”按钮叫出来
    document.getElementById('add-btn').innerText = '确认修改';
    document.getElementById('cancel-btn').style.display = 'inline-block';
    
    // 自动平滑滚动到最顶部，方便修改
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🚫 【功能回正】点击“取消编辑”按钮
document.getElementById('cancel-btn').onclick = function() {
    editIndex = -1;
    document.getElementById('guzi-name').value = '';
    document.getElementById('guzi-char').value = '';
    document.getElementById('guzi-price').value = '';
    document.getElementById('guzi-count').value = '1';
    selectedImagePath = null;
    document.getElementById('file-name-preview').innerText = '未选择';
    
    this.style.display = 'none';
    document.getElementById('add-btn').innerText = '新谷入库 ✨';
}

window.deleteGuzi = async function(originalIndex) {
    if (confirm('确定删除吗？')) {
        // 如果正在编辑该谷子的时候把它给删了，需要退出编辑状态
        if (editIndex === originalIndex) {
            editIndex = -1;
            document.getElementById('add-btn').innerText = '新谷入库 ✨';
            document.getElementById('cancel-btn').style.display = 'none';
        }
        allGuziData.splice(originalIndex, 1);
        await ipcRenderer.invoke('save-data', allGuziData);
        displayGuziList(allGuziData);
    }
}

document.getElementById('search-input').oninput = function() {
    const keyword = this.value.toLowerCase().trim();
    if (!keyword) {
        displayGuziList(allGuziData);
        return;
    }
    const filtered = allGuziData.filter(g => 
        g.name.toLowerCase().includes(keyword) || 
        g.char.toLowerCase().includes(keyword)
    );
    displayGuziList(filtered);
};

initWarehouse();