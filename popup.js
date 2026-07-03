// popup.js - 配置页面逻辑
document.addEventListener('DOMContentLoaded', function() {
  // ==================== 标签页切换 ====================
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === targetTab + 'Tab') {
          content.classList.add('active');
        }
      });
    });
  });

  // ==================== 自动投递功能 ====================
  // 元素引用
  const skillsInput = document.getElementById('skills');
  const skillsTags = document.getElementById('skillsTags');
  const experienceSelect = document.getElementById('experience');
  const educationSelect = document.getElementById('education');
  const minSalaryInput = document.getElementById('minSalary');
  const maxSalaryInput = document.getElementById('maxSalary');
  const locationInput = document.getElementById('location');
  const keywordsInput = document.getElementById('keywords');
  const excludeKeywordsInput = document.getElementById('excludeKeywords');
  const minMatchScoreInput = document.getElementById('minMatchScore');
  const skillMatchLevelSelect = document.getElementById('skillMatchLevel');
  const intervalInput = document.getElementById('interval');
  const enableBossCheckbox = document.getElementById('enableBoss');
  const enableZhilianCheckbox = document.getElementById('enableZhilian');
  const enable51JobCheckbox = document.getElementById('enable51Job');
  const enableYjsCheckbox = document.getElementById('enableYjs');
  const enableJobOnlineCheckbox = document.getElementById('enableJobOnline');
  const saveBtn = document.getElementById('saveBtn');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusDiv = document.getElementById('status');
  const totalScannedSpan = document.getElementById('totalScanned');
  const totalMatchedSpan = document.getElementById('totalMatched');
  const totalAppliedSpan = document.getElementById('totalApplied');

  // 技能标签管理
  let skillsArray = [];

  // 加载保存的配置
  loadConfig();
  loadStats();

  // 监听技能输入
  skillsInput.addEventListener('input', function() {
    const value = this.value;
    if (value.includes(',') || value.includes('，') || value.includes('\n')) {
      const newSkills = value.split(/[,，\n]/).map(s => s.trim()).filter(s => s);
      newSkills.forEach(skill => {
        if (!skillsArray.includes(skill)) {
          skillsArray.push(skill);
        }
      });
      updateSkillsTags();
      this.value = '';
    }
  });

  // 更新技能标签显示
  function updateSkillsTags() {
    skillsTags.innerHTML = '';
    skillsArray.forEach((skill, index) => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.innerHTML = `
        ${skill}
        <span class="remove" data-index="${index}">×</span>
      `;
      skillsTags.appendChild(tag);
    });

    // 绑定删除事件
    skillsTags.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        skillsArray.splice(index, 1);
        updateSkillsTags();
      });
    });
  }

  // 保存配置
  saveBtn.addEventListener('click', function() {
    const config = {
      skills: skillsArray,
      experience: parseInt(experienceSelect.value),
      education: parseInt(educationSelect.value),
      minSalary: parseInt(minSalaryInput.value) || 0,
      maxSalary: parseInt(maxSalaryInput.value) || 0,
      location: locationInput.value,
      keywords: keywordsInput.value.split(/[,，]/).map(k => k.trim()).filter(k => k),
      excludeKeywords: excludeKeywordsInput.value.split(/[,，]/).map(k => k.trim()).filter(k => k),
      minMatchScore: parseInt(minMatchScoreInput.value) || 40,
      skillMatchLevel: parseInt(skillMatchLevelSelect.value) || 2,
      interval: parseInt(intervalInput.value) || 5,
      platforms: {
        boss: enableBossCheckbox.checked,
        zhilian: enableZhilianCheckbox.checked,
        job51: enable51JobCheckbox.checked,
        yjs: enableYjsCheckbox.checked,
        jobOnline: enableJobOnlineCheckbox.checked
      }
    };

    chrome.storage.local.set({ config: config }, function() {
      showStatus('配置已保存', 'success');
      // 通知content script配置已更新
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'CONFIG_UPDATED', config: config });
        }
      });
    });
  });

  // 加载配置
  function loadConfig() {
    chrome.storage.local.get(['config', 'replyConfig'], function(result) {
      if (result.config) {
        const config = result.config;
        skillsArray = config.skills || [];
        updateSkillsTags();
        experienceSelect.value = config.experience || 0;
        educationSelect.value = config.education || 0;
        minSalaryInput.value = config.minSalary || '';
        maxSalaryInput.value = config.maxSalary || '';
        locationInput.value = config.location || '';
        keywordsInput.value = (config.keywords || []).join(', ');
        excludeKeywordsInput.value = (config.excludeKeywords || []).join(', ');
        minMatchScoreInput.value = config.minMatchScore || 40;
        skillMatchLevelSelect.value = config.skillMatchLevel !== undefined ? config.skillMatchLevel : 2;
        intervalInput.value = config.interval || 5;
        
        if (config.platforms) {
          enableBossCheckbox.checked = config.platforms.boss !== false;
          enableZhilianCheckbox.checked = config.platforms.zhilian !== false;
          enable51JobCheckbox.checked = config.platforms.job51 !== false;
          enableYjsCheckbox.checked = config.platforms.yjs !== false;
          enableJobOnlineCheckbox.checked = config.platforms.jobOnline === true;
        }
      }
      
      // 加载帮答配置
      if (result.replyConfig) {
        loadReplyConfig(result.replyConfig);
      }
    });
  }

  // 加载统计信息
  function loadStats() {
    chrome.storage.local.get(['stats', 'replyStats'], function(result) {
      if (result.stats) {
        updateStatsDisplay(result.stats);
      }
      if (result.replyStats) {
        updateReplyStatsDisplay(result.replyStats);
      }
    });
  }

  // 更新统计显示
  function updateStatsDisplay(stats) {
    totalScannedSpan.textContent = stats.scanned || 0;
    totalMatchedSpan.textContent = stats.matched || 0;
    totalAppliedSpan.textContent = stats.applied || 0;
  }

  // 发送消息到 content script 的封装
  function sendMessageToContent(type, data, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0]) {
        if (callback) callback(null, '没有找到活动标签页');
        return;
      }

      const tabId = tabs[0].id;
      
      // 先尝试 ping 一下
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, function(pingResponse) {
        if (chrome.runtime.lastError) {
          console.warn('Content script 未响应，尝试重新注入...', chrome.runtime.lastError.message);
          
          // 如果 ping 失败，尝试用 scripting API 注入
          if (chrome.scripting && chrome.scripting.executeScript) {
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content.js']
            }, function() {
              if (chrome.runtime.lastError) {
                console.error('注入失败:', chrome.runtime.lastError.message);
                if (callback) callback(null, '无法注入脚本，请刷新页面');
                return;
              }
              
              // 等待注入完成后再发送消息
              setTimeout(function() {
                chrome.tabs.sendMessage(tabId, { type: type, ...(data || {}) }, function(response) {
                  if (callback) callback(response, chrome.runtime.lastError);
                });
              }, 500);
            });
          } else {
            if (callback) callback(null, '脚本未加载，请刷新页面');
          }
          return;
        }
        
        // ping 成功，直接发送
        chrome.tabs.sendMessage(tabId, { type: type, ...(data || {}) }, function(response) {
          if (callback) callback(response, chrome.runtime.lastError);
        });
      });
    });
  }

  // 开始自动投递
  startBtn.addEventListener('click', function() {
    const url = window.location.href; // 只是为了保留逻辑，实际在popup里取的是tab url
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0]) return;
      
      const tabUrl = tabs[0].url;
      const platform = detectPlatform(tabUrl);
      
      if (!platform) {
        showStatus('请先打开Boss直聘/智联/51job/应届生求职网', 'error');
        return;
      }

      showStatus('正在启动...', 'running');
      
      // 发送开始消息
      sendMessageToContent('START_AUTO_APPLY', null, function(response, error) {
        if (error) {
          showStatus('启动失败: ' + error, 'error');
          return;
        }
        
        if (response && response.success) {
          showStatus('自动投递已开始...', 'running');
          startBtn.classList.add('hidden');
          stopBtn.classList.remove('hidden');
        } else {
          showStatus('启动失败，请刷新页面后重试', 'error');
        }
      });
    });
  });

  // 停止自动投递
  stopBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_AUTO_APPLY' }, function(response) {
          if (response && response.success) {
            showStatus('自动投递已停止', 'info');
            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
          }
        });
      }
    });
  });

  // 重置统计
  resetBtn.addEventListener('click', function() {
    chrome.storage.local.set({ stats: { scanned: 0, matched: 0, applied: 0 } }, function() {
      updateStatsDisplay({ scanned: 0, matched: 0, applied: 0 });
      showStatus('统计已重置', 'success');
    });
  });

  // ==================== 智能帮答功能 ====================
  const enableAutoReplyCheckbox = document.getElementById('enableAutoReply');
  const selfIntroInput = document.getElementById('selfIntro');
  const replyTemplatesDiv = document.getElementById('replyTemplates');
  const addTemplateBtn = document.getElementById('addTemplateBtn');
  const templateForm = document.getElementById('templateForm');
  const templateKeywordInput = document.getElementById('templateKeyword');
  const templateReplyInput = document.getElementById('templateReply');
  const saveTemplateBtn = document.getElementById('saveTemplateBtn');
  const cancelTemplateBtn = document.getElementById('cancelTemplateBtn');
  const presetSalaryCheckbox = document.getElementById('presetSalary');
  const presetExperienceCheckbox = document.getElementById('presetExperience');
  const presetOnboardCheckbox = document.getElementById('presetOnboard');
  const saveReplyBtn = document.getElementById('saveReplyBtn');
  const startReplyBtn = document.getElementById('startReplyBtn');
  const stopReplyBtn = document.getElementById('stopReplyBtn');
  const totalRepliedSpan = document.getElementById('totalReplied');
  const totalCandidatesSpan = document.getElementById('totalCandidates');

  // 回复模板数组
  let replyTemplates = [];

  // 预设模板
  const presetTemplates = {
    salary: [
      { keyword: '薪资', reply: '您好，根据我的经验和能力，期望薪资在您招聘信息标注的范围内，具体可以根据面试情况详谈。感谢您的关注！' },
      { keyword: '待遇', reply: '感谢询问！薪资待遇方面，我期望能与岗位市场水平相符，同时也看重公司的发展前景和团队氛围。期待有机会进一步沟通。' }
    ],
    experience: [
      { keyword: '经验', reply: '您好，我有相关岗位的工作经验，具体项目经历可以面试时详细交流。期待能有机会加入贵公司！' },
      { keyword: '做过', reply: '感谢您的关注！我在相关领域有一定的项目经验，具体细节可以在面试中详细介绍。' }
    ],
    onboard: [
      { keyword: '入职', reply: '您好，如果面试通过，我可以在一周内办理入职手续。感谢您的考虑！' },
      { keyword: '到岗', reply: '感谢询问！如果双方合适，我可以在收到offer后尽快到岗，预计一周内可以入职。' }
    ]
  };

  // 显示添加模板表单
  addTemplateBtn.addEventListener('click', function() {
    templateForm.classList.remove('hidden');
    addTemplateBtn.classList.add('hidden');
  });

  // 取消添加模板
  cancelTemplateBtn.addEventListener('click', function() {
    templateForm.classList.add('hidden');
    addTemplateBtn.classList.remove('hidden');
    templateKeywordInput.value = '';
    templateReplyInput.value = '';
  });

  // 保存新模板
  saveTemplateBtn.addEventListener('click', function() {
    const keyword = templateKeywordInput.value.trim();
    const reply = templateReplyInput.value.trim();
    
    if (!keyword || !reply) {
      showStatus('请填写关键词和回复内容', 'error');
      return;
    }
    
    replyTemplates.push({ keyword, reply });
    renderTemplates();
    
    templateForm.classList.add('hidden');
    addTemplateBtn.classList.remove('hidden');
    templateKeywordInput.value = '';
    templateReplyInput.value = '';
    
    showStatus('模板已添加', 'success');
  });

  // 渲染模板列表
  function renderTemplates() {
    replyTemplatesDiv.innerHTML = '';
    
    replyTemplates.forEach((template, index) => {
      const item = document.createElement('div');
      item.className = 'template-item';
      item.innerHTML = `
        <div class="template-header">
          <span class="template-keyword">${template.keyword}</span>
          <span class="template-remove" data-index="${index}">删除</span>
        </div>
        <div class="template-reply">${template.reply}</div>
      `;
      replyTemplatesDiv.appendChild(item);
    });
    
    // 绑定删除事件
    replyTemplatesDiv.querySelectorAll('.template-remove').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        replyTemplates.splice(index, 1);
        renderTemplates();
      });
    });
  }

  // 保存帮答配置
  saveReplyBtn.addEventListener('click', function() {
    const replyConfig = {
      enabled: enableAutoReplyCheckbox.checked,
      selfIntro: selfIntroInput.value,
      templates: replyTemplates,
      presets: {
        salary: presetSalaryCheckbox.checked,
        experience: presetExperienceCheckbox.checked,
        onboard: presetOnboardCheckbox.checked
      }
    };
    
    chrome.storage.local.set({ replyConfig }, function() {
      showStatus('帮答配置已保存', 'success');
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'REPLY_CONFIG_UPDATED', replyConfig });
        }
      });
    });
  });

  // 加载帮答配置
  function loadReplyConfig(config) {
    enableAutoReplyCheckbox.checked = config.enabled || false;
    selfIntroInput.value = config.selfIntro || '';
    replyTemplates = config.templates || [];
    renderTemplates();
    
    if (config.presets) {
      presetSalaryCheckbox.checked = config.presets.salary !== false;
      presetExperienceCheckbox.checked = config.presets.experience !== false;
      presetOnboardCheckbox.checked = config.presets.onboard !== false;
    }
  }

  // 更新帮答统计显示
  function updateReplyStatsDisplay(stats) {
    totalRepliedSpan.textContent = stats.replied || 0;
    totalCandidatesSpan.textContent = stats.candidates || 0;
  }

  // 开始帮答
  startReplyBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'START_AUTO_REPLY' }, function(response) {
          if (response && response.success) {
            showStatus('智能帮答已开始...', 'running');
            startReplyBtn.classList.add('hidden');
            stopReplyBtn.classList.remove('hidden');
          } else {
            showStatus('启动失败，请确保在消息页面', 'error');
          }
        });
      }
    });
  });

  // 停止帮答
  stopReplyBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_AUTO_REPLY' }, function(response) {
          if (response && response.success) {
            showStatus('智能帮答已停止', 'info');
            startReplyBtn.classList.remove('hidden');
            stopReplyBtn.classList.add('hidden');
          }
        });
      }
    });
  });

  // ==================== 公共函数 ====================
  // 检测当前平台
  function detectPlatform(url) {
    if (url.includes('zhipin.com')) return 'boss';
    if (url.includes('zhaopin.com')) return 'zhilian';
    if (url.includes('51job.com')) return 'job51';
    if (url.includes('yingjiesheng.com')) return 'yjs';
    if (url.includes('jobonline.cn')) return 'jobOnline';
    return null;
  }

  // 平台名称映射
  function getPlatformName(platform) {
    const names = {
      boss: 'Boss直聘',
      zhilian: '智联招聘',
      job51: '51job前程无忧',
      yjs: '应届生求职网',
      jobOnline: '就业在线'
    };
    return names[platform] || '未知平台';
  }

  // 显示状态消息
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
    
    if (type !== 'running') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 3000);
    }
  }

  // 监听来自content script的消息
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'STATS_UPDATED') {
      updateStatsDisplay(message.stats);
    } else if (message.type === 'APPLY_STATUS') {
      showStatus(message.status, message.statusType || 'info');
      if (message.statusType === 'stopped') {
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
      }
    } else if (message.type === 'REPLY_STATS_UPDATED') {
      updateReplyStatsDisplay(message.stats);
    } else if (message.type === 'REPLY_STATUS') {
      showStatus(message.status, message.statusType || 'info');
      if (message.statusType === 'stopped') {
        startReplyBtn.classList.remove('hidden');
        stopReplyBtn.classList.add('hidden');
      }
    }
  });
});