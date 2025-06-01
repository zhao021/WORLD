mapboxgl.accessToken = 'pk.eyJ1IjoieGpuMjAyNSIsImEiOiJjbTkxMWJ1cTEwM3NkMm5wdnNkemE4Z24yIn0.ZDf4-d0toG_wjYNsdQvlzw';

// 文件存储配置
const STORAGE_CONFIG = {
  currentFile: 'output/current/markers_data.json', // 当前数据文件
  backupsDir: 'output/backups/', // 手动备份目录
  historyDir: 'output/history/', // 历史记录目录
  version: 1
};

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v10',
  center: [105, 35],
  zoom: 3
});

let activePopup = null;
let selectedLocation = null;
let tempMarker = null;
let markersData = []; // 存储所有标记数据

// 从文件加载数据
function loadDataFromFile(filePath) {
  return new Promise((resolve, reject) => {
    fetch(filePath, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(response => {
        if (!response.ok) {
          if (response.status === 404) {
            console.log('数据文件不存在，将创建新文件');
            return []; // 文件不存在时返回空数组
          }
          throw new Error('无法加载数据文件');
        }
        return response.text().then(text => {
          // 检查文本是否为空或只包含空白字符
          if (!text || text.trim() === '') {
            return [];
          }
          // 尝试解析JSON
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error('JSON解析错误:', e, '原始文本:', text);
            return [];
          }
        });
      })
      .then(data => {
        console.log(`已从文件加载 ${data.length} 条记录`);
        resolve(data);
      })
      .catch(error => {
        console.error('加载数据失败', error);
        resolve([]); // 出错时返回空数组
      });
  });
}

// 保存数据到当前文件
function saveDataToCurrentFile(data) {
  return saveFileUsingPHP(data, STORAGE_CONFIG.currentFile);
}

// 保存数据到历史记录
function saveDataToHistory(data) {
  // 使用当前时间作为文件名，精确到秒
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  
  const filename = `${STORAGE_CONFIG.historyDir}emotion_map_${timestamp}.json`;
  return saveFileUsingPHP(data, filename);
}

// 导出数据到备份目录
function exportDataToBackup(data) {
  // 使用当前时间作为文件名，精确到秒
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  
  const filename = `${STORAGE_CONFIG.backupsDir}emotion_map_${timestamp}.json`;
  return saveFileUsingPHP(data, filename);
}

// 使用PHP保存文件
function saveFileUsingPHP(data, filename) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    const jsonData = JSON.stringify(data, null, 2);
    
    formData.append('data', jsonData);
    formData.append('filename', filename);
    
    fetch('save-file.php', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('保存文件失败，服务器返回错误');
      }
      return response.json();
    })
    .then(result => {
      if (result.success) {
        console.log(`文件已保存到: ${result.filepath}`);
        resolve(result);
      } else {
        console.error('保存文件失败:', result.message);
        // 如果PHP保存失败，回退到本地存储
        return saveToLocalStorage(data, filename).then(resolve).catch(reject);
      }
    })
    .catch(error => {
      console.error('保存文件失败:', error);
      // 如果PHP请求失败，回退到本地存储
      saveToLocalStorage(data, filename).then(resolve).catch(reject);
    });
  });
}

// 保存到本地存储（作为备用方案）
function saveToLocalStorage(data, filename) {
  return new Promise((resolve, reject) => {
    try {
      // 保存数据到localStorage
      const key = 'emotion_map_data';
      localStorage.setItem(key, JSON.stringify(data));
      console.log('数据已保存到本地存储（备用方案）');
      
      // 同时尝试下载文件
      downloadFile(data, filename).catch(err => {
        console.warn('下载文件失败，但数据已保存到本地存储', err);
      });
      
      resolve({
        success: true,
        message: '数据已保存到本地存储（备用方案）',
        filepath: 'localStorage'
      });
    } catch (error) {
      console.error('保存到本地存储失败', error);
      
      // 如果本地存储也失败，尝试下载文件
      downloadFile(data, filename)
        .then(() => {
          resolve({
            success: true,
            message: '数据已下载到本地文件（备用方案）',
            filepath: filename
          });
        })
        .catch(err => {
          reject(err);
        });
    }
  });
}

// 通用下载文件函数（浏览器下载，作为备用方案）
function downloadFile(data, filename) {
  return new Promise((resolve, reject) => {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      resolve();
    } catch (error) {
      console.error('文件下载失败', error);
      reject(error);
    }
  });
}

function getGlowBoxShadow(type, likes) {
  let intensity = 6;
  if (likes > 50) intensity = 18;
  else if (likes > 10) intensity = 12;
  const color = type === '心愿碟' ? '#66ccffaa' : '#ffdd33aa';
  return `0 0 ${intensity}px ${intensity / 3}px ${color}`;
}

function createVinylMarker(data) {
  const { title, content, date, city, longitude, latitude, type, likes } = data;

  const el = document.createElement('div');
  el.className = 'vinyl';
  el.style.boxShadow = getGlowBoxShadow(type, likes);

  const center = document.createElement('div');
  center.className = 'center-ring';
  el.appendChild(center);

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const coords = [longitude, latitude];
    const screenPos = map.project(coords);

    const heart = document.createElement('div');
    heart.className = 'heartbeat';
    heart.style.left = `${screenPos.x}px`;
    heart.style.top = `${screenPos.y}px`;
    heart.style.background = type === '心愿碟' ? '#66ccff55' : '#ffdd3355';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 600);

    if (activePopup) activePopup.remove();
    activePopup = new mapboxgl.Popup()
      .setLngLat(coords)
      .setHTML(`
        <strong>${title}</strong><br>
        ${content}<br>
        日期：${date}<br>
        城市：${city}
      `)
      .addTo(map);
  });

  new mapboxgl.Marker({
    element: el,
    anchor: 'center',
    offset: [0, 0]
  })
  .setLngLat([longitude, latitude])
  .addTo(map);
}

map.on('load', () => {
  // 添加文件管理按钮
  addFileManagerButton();
  
  // 加载标记数据
  loadMarkers();
  
  // 初始化表单元素
  initFormElements();
  
  // 处理提示显示
  const mapTip = document.getElementById('mapTip');
  setTimeout(() => {
    mapTip.classList.add('fade');
  }, 5000);
});

// 添加文件管理按钮
function addFileManagerButton() {
  const fileManagerBtn = document.createElement('div');
  fileManagerBtn.className = 'file-manager-btn';
  fileManagerBtn.innerHTML = '<span>文件管理</span>';
  fileManagerBtn.title = '打开文件管理页面，可导入/导出数据';
  fileManagerBtn.addEventListener('click', () => {
    window.location.href = 'file-manager.html';
  });
  document.body.appendChild(fileManagerBtn);
}

// 加载标记数据
function loadMarkers() {
  // 从当前文件加载数据
  loadDataFromFile(STORAGE_CONFIG.currentFile)
    .then(data => {
      if (data && data.length > 0) {
        markersData = data;
        console.log(`已从当前文件加载 ${markersData.length} 条记录`);
        
        // 在地图上显示所有标记
        markersData.forEach(item => {
          createVinylMarker({
            title: item.title,
            content: item.content,
            date: item.date,
            city: item.city,
            longitude: parseFloat(item.longitude),
            latitude: parseFloat(item.latitude),
            type: item.type || '心愿碟',
            likes: parseInt(item.likes) || 0,
          });
        });
      } else {
        // 如果文件中没有数据，尝试从localStorage加载
        try {
          const storedData = localStorage.getItem('emotion_map_data');
          if (storedData) {
            markersData = JSON.parse(storedData) || [];
            console.log(`已从本地存储加载 ${markersData.length} 条记录（备用方案）`);
            
            // 在地图上显示所有标记
            markersData.forEach(item => {
              createVinylMarker({
                title: item.title,
                content: item.content,
                date: item.date,
                city: item.city,
                longitude: parseFloat(item.longitude),
                latitude: parseFloat(item.latitude),
                type: item.type || '心愿碟',
                likes: parseInt(item.likes) || 0,
              });
            });
            
            // 保存到文件
            saveDataToCurrentFile(markersData).catch(err => {
              console.error('保存数据到文件失败', err);
            });
          } else {
            markersData = []; // 初始化为空数组
          }
        } catch (error) {
          console.error('从本地存储加载数据失败', error);
          markersData = []; // 初始化为空数组
        }
      }
    })
    .catch(err => {
      console.error('加载数据失败', err);
      
      // 尝试从localStorage加载
      try {
        const storedData = localStorage.getItem('emotion_map_data');
        if (storedData) {
          markersData = JSON.parse(storedData) || [];
          console.log(`已从本地存储加载 ${markersData.length} 条记录（备用方案）`);
          
          // 在地图上显示所有标记
          markersData.forEach(item => {
            createVinylMarker({
              title: item.title,
              content: item.content,
              date: item.date,
              city: item.city,
              longitude: parseFloat(item.longitude),
              latitude: parseFloat(item.latitude),
              type: item.type || '心愿碟',
              likes: parseInt(item.likes) || 0,
            });
          });
        } else {
          markersData = []; // 初始化为空数组
        }
      } catch (error) {
        console.error('从本地存储加载数据失败', error);
        markersData = []; // 初始化为空数组
      }
    });
}

// 保存标记数据
function saveMarkerData(markerData) {
  return new Promise((resolve, reject) => {
    // 添加到数组
    markersData.push(markerData);
    
    // 同时保存到当前文件和历史记录
    Promise.all([
      saveDataToCurrentFile(markersData),
      saveDataToHistory(markersData)
    ])
      .then(() => {
        console.log('数据保存成功');
        resolve();
      })
      .catch(error => {
        console.error('保存数据失败', error);
        reject('保存数据失败');
      });
  });
}

// 初始化表单元素和事件
function initFormElements() {
  const infoPanel = document.getElementById('infoPanel');
  const btnAdd = document.getElementById('btnAdd');
  const btnCancel = document.getElementById('btnCancel');
  const titleInput = document.getElementById('title');
  const contentInput = document.getElementById('content');
  const dateInput = document.getElementById('date');
  const cityInput = document.getElementById('city');
  const feedback = document.getElementById('feedback');
  
  // 设置默认日期为今天
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${year}-${month}-${day}`;
  
  // 添加按钮点击事件
  btnAdd.addEventListener('click', () => {
    if (!selectedLocation) {
      feedback.textContent = '请先在地图上选择一个位置';
      return;
    }
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const date = dateInput.value;
    const city = cityInput.value.trim();
    
    if (!title) {
      feedback.textContent = '请输入标题';
      return;
    }
    
    if (!content) {
      feedback.textContent = '请输入内容';
      return;
    }
    
    if (!city) {
      feedback.textContent = '请输入城市';
      return;
    }
    
    const newMarker = {
      title,
      content,
      date,
      city,
      longitude: selectedLocation[0],
      latitude: selectedLocation[1],
      type: '心愿碟',
      likes: 0,
      timestamp: new Date().getTime(),
      create_date: new Date().toISOString()
    };
    
    // 保存到本地
    saveMarker(newMarker);
  });
  
  // 取消按钮点击事件
  btnCancel.addEventListener('click', () => {
    hideInfoPanel();
    resetForm();
    if (tempMarker) {
      tempMarker.remove();
      tempMarker = null;
    }
  });
}

// 保存标记
function saveMarker(markerData) {
  const feedback = document.getElementById('feedback');
  feedback.textContent = '正在保存...';
  
  saveMarkerData(markerData)
    .then(() => {
      // 在地图上显示
      createVinylMarker(markerData);
      
      feedback.textContent = '添加成功！';
      setTimeout(() => {
        hideInfoPanel();
        feedback.textContent = '';
        resetForm();
      }, 1500);
    })
    .catch(err => {
      feedback.textContent = '保存失败，请重试';
      console.error('保存失败', err);
    });
}

// 重置表单
function resetForm() {
  document.getElementById('title').value = '';
  document.getElementById('content').value = '';
  
  const cityInput = document.getElementById('city');
  cityInput.value = '';
  cityInput.disabled = false;
  
  // 重置日期为今天
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  document.getElementById('date').value = `${year}-${month}-${day}`;
}

// 显示信息面板
function showInfoPanel() {
  const infoPanel = document.getElementById('infoPanel');
  infoPanel.classList.remove('hidden');
}

// 隐藏信息面板
function hideInfoPanel() {
  const infoPanel = document.getElementById('infoPanel');
  infoPanel.classList.add('hidden');
  selectedLocation = null;
  if (tempMarker) {
    tempMarker.remove();
    tempMarker = null;
  }
}

// 基于经纬度获取城市
function estimateCityFromCoordinates(lng, lat) {
  return new Promise((resolve, reject) => {
    // 设置超时
    const timeout = setTimeout(() => {
      console.log('获取城市信息超时，允许用户自行填写');
      resolve(''); // 超时后返回空字符串，让用户自行填写
    }, 5000); // 5秒超时
    
    // 使用Nominatim API获取城市信息
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-CN`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Nominatim API请求失败');
        }
        return response.json();
      })
      .then(data => {
        // 清除超时计时器
        clearTimeout(timeout);
        
        // 尝试获取城市信息，优先使用中文名称
        const city = data.address.city || 
                    data.address.town || 
                    data.address.village || 
                    data.address.county ||
                    data.address.state ||
                    '';
        
        if (city) {
          resolve(city);
        } else {
          // 如果没有找到城市，则使用备用方法
          useFallbackCityEstimation(lng, lat, resolve);
        }
      })
      .catch(error => {
        // 清除超时计时器
        clearTimeout(timeout);
        
        console.error('获取城市信息失败:', error);
        // 如果API请求失败，使用备用方法
        useFallbackCityEstimation(lng, lat, resolve);
      });
  });
}

// 备用城市估算方法（基于预设城市坐标）
function useFallbackCityEstimation(lng, lat, resolve) {
  // 预设的主要城市坐标
  const cities = [
    { name: "北京", lat: 39.9042, lng: 116.4074, radius: 50 },
    { name: "上海", lat: 31.2304, lng: 121.4737, radius: 50 },
    { name: "广州", lat: 23.1291, lng: 113.2644, radius: 40 },
    { name: "深圳", lat: 22.5431, lng: 114.0579, radius: 35 },
    { name: "成都", lat: 30.5728, lng: 104.0668, radius: 45 },
    { name: "杭州", lat: 30.2741, lng: 120.1551, radius: 40 },
    { name: "武汉", lat: 30.5928, lng: 114.3055, radius: 45 },
    { name: "西安", lat: 34.3416, lng: 108.9398, radius: 40 },
    { name: "南京", lat: 32.0603, lng: 118.7969, radius: 40 },
    { name: "重庆", lat: 29.4316, lng: 106.9123, radius: 50 },
    { name: "天津", lat: 39.3434, lng: 117.3616, radius: 45 },
    { name: "苏州", lat: 31.2990, lng: 120.5853, radius: 35 },
    { name: "郑州", lat: 34.7466, lng: 113.6253, radius: 40 },
    { name: "长沙", lat: 28.2278, lng: 112.9388, radius: 40 },
    { name: "沈阳", lat: 41.8057, lng: 123.4315, radius: 40 }
  ];
  
  // 计算距离
  function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径，单位km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  // 找到最近的城市
  let closestCity = null;
  let minDistance = Infinity;
  
  for (const city of cities) {
    const distance = getDistance(lat, lng, city.lat, city.lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city;
    }
  }
  
  // 如果在某个城市半径范围内，返回该城市
  if (closestCity && minDistance <= closestCity.radius) {
    resolve(closestCity.name);
  } else {
    // 如果都失败了，返回最近的城市加上"附近"
    if (closestCity) {
      resolve(`${closestCity.name}附近`);
    } else {
      resolve("未知城市");
    }
  }
}

// 点击地图空白处关闭弹窗
map.on('click', (e) => {
  // 隐藏提示
  const mapTip = document.getElementById('mapTip');
  if (mapTip) {
    mapTip.classList.add('fade');
  }

  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  } else {
    selectedLocation = [e.lngLat.lng, e.lngLat.lat];
    
    // 添加临时标记显示选中的位置
    if (tempMarker) {
      tempMarker.remove();
    }
    
    // 创建临时标记元素
    const el = document.createElement('div');
    el.className = 'vinyl';
    el.style.boxShadow = '0 0 10px 3px #ff7f00aa';
    
    const center = document.createElement('div');
    center.className = 'center-ring';
    el.appendChild(center);
    
    tempMarker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
      offset: [0, 0]
    })
    .setLngLat(selectedLocation)
    .addTo(map);
    
    // 显示面板
    showInfoPanel();
    
    // 显示城市加载状态
    const cityInput = document.getElementById('city');
    cityInput.value = '正在获取城市...';
    cityInput.disabled = true;
    
    // 使用IP-API获取城市名称（中国可用，无需注册）
    setTimeout(() => {
      const lng = selectedLocation[0];
      const lat = selectedLocation[1];
      
      // 使用经纬度估算城市
      estimateCityFromCoordinates(lng, lat)
        .then(city => {
          cityInput.value = city;
          cityInput.disabled = false;
        })
        .catch(err => {
          console.error('获取城市信息失败', err);
          cityInput.value = '';
          cityInput.disabled = false;
        });
    }, 300);
  }
});
