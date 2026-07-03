// background.js - Service Worker后台脚本

chrome.runtime.onInstalled.addListener(function(details) {
  console.log('[自动投递助手] 扩展已安装:', details.reason);
  
  // 初始化默认配置
  if (details.reason === 'install') {
    const defaultConfig = {
      skills: [],
      experience: 0,
      education: 0,
      minSalary: 0,
      maxSalary: 0,
      location: '',
      keywords: [],
      excludeKeywords: [],
      minMatchScore: 60,
      interval: 5,
      platforms: {
        boss: true,
        zhilian: false,
        jobOnline: false
      }
    };
    
    const defaultStats = {
      scanned: 0,
      matched: 0,
      applied: 0
    };
    
    chrome.storage.local.set({
      config: defaultConfig,
      stats: defaultStats
    }, function() {
      console.log('[自动投递助手] 默认配置已保存');
    });
  }
});

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('[自动投递助手] 后台收到消息:', message.type);
  
  switch (message.type) {
    case 'STATS_UPDATED':
      // 更新统计信息到storage
      chrome.storage.local.set({ stats: message.stats }, function() {
        // 通知popup更新显示
        chrome.runtime.sendMessage(message);
      });
      sendResponse({ success: true });
      break;
      
    case 'APPLY_STATUS':
      // 转发状态消息到popup
      chrome.runtime.sendMessage(message);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: '未知消息类型' });
  }
  
  return true;
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    // 检查是否是目标平台
    const isTargetPlatform = 
      tab.url.includes('zhipin.com') ||
      tab.url.includes('zhaopin.com') ||
      tab.url.includes('jobonline.cn');
    
    if (isTargetPlatform) {
      console.log('[自动投递助手] 检测到目标平台:', tab.url);
      
      // 注入content script（如果需要重新注入）
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }, function(results) {
        if (chrome.runtime.lastError) {
          console.log('[自动投递助手] 注入脚本失败:', chrome.runtime.lastError);
        } else {
          console.log('[自动投递助手] 脚本已注入');
        }
      });
    }
  }
});

// 点击扩展图标时的处理
chrome.action.onClicked.addListener(function(tab) {
  console.log('[自动投递助手] 扩展图标被点击');
});