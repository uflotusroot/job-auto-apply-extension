// content.js - 自动投递助手内容脚本
// 版本: v3.0
// 功能: 自动投递简历 + 智能帮答 + 模拟人工操作
// 更新: 重构Boss直聘为列表驱动模式，增强按钮点击可靠性

(function() {
  'use strict';

  // ==================== 全局状态 ====================
  let config = null;
  let replyConfig = null;
  let stats = { scanned: 0, matched: 0, applied: 0 };
  let replyStats = { replied: 0, candidates: 0 };
  let currentPlatform = null;
  let isApplyRunning = false;
  let isReplyRunning = false;
  let stopApplyRequested = false;
  let stopReplyRequested = false;
  let applyRunId = null;

  console.log('%c[自动投递助手] 脚本已加载 v3.0', 'color: #667eea; font-weight: bold; font-size: 14px;');

  // ==================== 初始化 ====================
  function init() {
    currentPlatform = detectPlatform();
    if (!currentPlatform) {
      console.log('[自动投递助手] 未识别的平台，脚本已加载但不会自动执行');
      return;
    }
    console.log(`[自动投递助手] 当前平台: ${currentPlatform}`);

    chrome.storage.local.get(['config', 'replyConfig', 'stats', 'replyStats'], function(result) {
      config = result.config || getDefaultConfig();
      replyConfig = result.replyConfig || getDefaultReplyConfig();
      stats = result.stats || { scanned: 0, matched: 0, applied: 0 };
      replyStats = result.replyStats || { replied: 0, candidates: 0 };
      console.log('[自动投递助手] 配置已加载');
    });

    injectDebugPanel();
  }

  function detectPlatform() {
    const url = window.location.href;
    if (url.includes('zhipin.com')) return 'boss';
    if (url.includes('zhaopin.com')) return 'zhilian';
    if (url.includes('51job.com')) return 'job51';
    if (url.includes('yingjiesheng.com')) return 'yjs';
    if (url.includes('jobonline.cn')) return 'jobOnline';
    return null;
  }

  function getDefaultConfig() {
    return {
      skills: [],
      experience: 0,
      education: 0,
      minSalary: 0,
      maxSalary: 0,
      location: '',
      keywords: [],
      excludeKeywords: [],
      minMatchScore: 40,
      interval: 5,
      skillMatchLevel: 2, // 0=严格 1=标准 2=宽松 3=极宽松
      platforms: { boss: true, zhilian: false, job51: false, yjs: false, jobOnline: false },
      humanMode: true,
      scrollInterval: 2000
    };
  }

  function getDefaultReplyConfig() {
    return {
      enabled: false,
      selfIntro: '',
      templates: [],
      presets: { salary: true, experience: true, onboard: true, greeting: true, interview: true }
    };
  }

  // ==================== 工具函数 ====================
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomDelay(minMs, maxMs) {
    const d = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return delay(d);
  }

  // 通过文本查找元素
  function findElementByText(tagName, text, container = document) {
    const elements = container.querySelectorAll(tagName);
    for (const el of elements) {
      if (el.textContent.trim() === text && el.offsetParent !== null) {
        return el;
      }
    }
    return null;
  }

  // 通过文本包含查找元素
  function findElementContainingText(tagName, text, container = document) {
    const elements = container.querySelectorAll(tagName);
    for (const el of elements) {
      if (el.textContent.includes(text) && el.offsetParent !== null) {
        return el;
      }
    }
    return null;
  }

  // 查找所有包含文本的元素
  function findAllElementsContainingText(tagName, text, container = document) {
    const elements = container.querySelectorAll(tagName);
    const results = [];
    for (const el of elements) {
      if (el.textContent.includes(text) && el.offsetParent !== null) {
        results.push(el);
      }
    }
    return results;
  }

  // 可靠的点击方式
  function reliableClick(element) {
    if (!element) return false;
    
    try {
      element.click();
      return true;
    } catch (e) {}
    
    try {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch (e) {}
    
    return false;
  }

  // ==================== 模拟人工操作 ====================
  const HumanSimulator = {
    async delay(minMs, maxMs) {
      return randomDelay(minMs, maxMs);
    },

    async scrollToElement(element, options = {}) {
      const { offsetY = 100, duration = 500 } = options;
      
      const rect = element.getBoundingClientRect();
      const targetY = rect.top + window.pageYOffset - offsetY;
      const startY = window.pageYOffset;
      const distance = targetY - startY;
      const startTime = performance.now();

      return new Promise(resolve => {
        function animation(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          window.scrollTo(0, startY + distance * easeProgress);
          if (progress < 1) {
            requestAnimationFrame(animation);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(animation);
      });
    },

    async moveMouseTo(element) {
      const rect = element.getBoundingClientRect();
      const startX = window.innerWidth / 2;
      const startY = window.innerHeight / 2;
      const endX = rect.left + rect.width / 2;
      const endY = rect.top + rect.height / 2;
      
      const steps = 8 + Math.floor(Math.random() * 8);
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const x = startX + (endX - startX) * progress + Math.sin(progress * Math.PI) * 15;
        const y = startY + (endY - startY) * progress;
        
        const event = new MouseEvent('mousemove', {
          bubbles: true, cancelable: true, view: window, clientX: x, clientY: y
        });
        document.elementFromPoint(x, y)?.dispatchEvent(event);
        
        await delay(10 + Math.random() * 20);
      }
    },

    async clickElement(element) {
      if (!element) return false;
      
      // 滚动到可见
      try { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      await delay(200, 400);
      
      // 移动鼠标
      await this.moveMouseTo(element);
      await delay(100, 250);
      
      // mouseover
      try {
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
      } catch(e) {}
      
      await delay(150, 350);
      
      // mousedown + mouseup + click
      try {
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0 }));
      } catch(e) {}
      
      await delay(50, 120);
      
      try {
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
      } catch(e) {}
      
      // 多种方式点击
      const clicked = reliableClick(element);
      
      return clicked;
    },

    async randomScroll(direction = 'down') {
      const scrollAmount = 100 + Math.floor(Math.random() * 200);
      const currentScroll = window.pageYOffset;
      const targetScroll = direction === 'down' 
        ? currentScroll + scrollAmount 
        : Math.max(0, currentScroll - scrollAmount);
      
      window.scrollTo({ top: targetScroll, behavior: 'smooth' });
      await delay(500, 1000);
    }
  };

  // ==================== 匹配算法 ====================
  function calculateMatchScore(jobInfo) {
    if (!config) return { score: 0, reasons: ['未加载配置'] };

    let totalScore = 0;
    let reasons = [];

    const skillScore = calculateSkillMatch(jobInfo);
    totalScore += skillScore.score;
    if (skillScore.matched.length > 0) {
      reasons.push(`技能匹配: ${skillScore.matched.join(', ')}`);
    }

    const salaryScore = calculateSalaryMatch(jobInfo.salary);
    totalScore += salaryScore.score;
    if (salaryScore.match) reasons.push('薪资符合');

    const expScore = calculateExperienceMatch(jobInfo.experience);
    totalScore += expScore.score;
    if (expScore.match) reasons.push('年限符合');

    const eduScore = calculateEducationMatch(jobInfo.education);
    totalScore += eduScore.score;
    if (eduScore.match) reasons.push('学历符合');

    const keywordScore = calculateKeywordMatch(jobInfo);
    totalScore += keywordScore.score;
    if (keywordScore.matched.length > 0) {
      reasons.push(`关键词: ${keywordScore.matched.join(', ')}`);
    }

    if (isExcluded(jobInfo)) {
      return { score: 0, reasons: ['包含排除关键词'] };
    }

    const locScore = calculateLocationMatch(jobInfo.location);
    totalScore += locScore.score;
    if (locScore.match) reasons.push('地点符合');

    const finalScore = Math.min(100, Math.round(totalScore));
    return { score: finalScore, reasons };
  }

  function calculateSkillMatch(jobInfo) {
    const skills = config.skills || [];
    if (skills.length === 0) return { score: 20, matched: [] };

    const allText = `${jobInfo.title} ${jobInfo.description} ${(jobInfo.skills || []).join(' ')}`.toLowerCase();
    const userSkills = skills.map(s => s.toLowerCase());
    
    let matched = [];
    userSkills.forEach(skill => {
      if (allText.includes(skill)) matched.push(skill);
    });

    const matchCount = matched.length;
    const totalSkills = userSkills.length;
    
    // 宽松度等级对应的阶梯分数
    // 每个等级定义：匹配到几个技能给多少分
    const levelConfigs = {
      0: [ // 严格：完全匹配才高分
        { count: 0, score: 0 },
        { count: 1, score: 8 },
        { count: 2, score: 16 },
        { count: 3, score: 24 },
        { count: 4, score: 32 },
        { count: 5, score: 38 },
        { count: 99, score: 40 }
      ],
      1: [ // 标准
        { count: 0, score: 0 },
        { count: 1, score: 15 },
        { count: 2, score: 25 },
        { count: 3, score: 32 },
        { count: 4, score: 37 },
        { count: 99, score: 40 }
      ],
      2: [ // 宽松（默认）：匹配2个就有30分，3个以上就很高
        { count: 0, score: 0 },
        { count: 1, score: 22 },
        { count: 2, score: 32 },
        { count: 3, score: 37 },
        { count: 4, score: 39 },
        { count: 99, score: 40 }
      ],
      3: [ // 极宽松：匹配1个就25分，2个以上基本满分
        { count: 0, score: 0 },
        { count: 1, score: 28 },
        { count: 2, score: 36 },
        { count: 3, score: 39 },
        { count: 99, score: 40 }
      ]
    };

    const level = config.skillMatchLevel || 2;
    const levels = levelConfigs[level] || levelConfigs[2];
    
    let score = 0;
    for (const tier of levels) {
      if (matchCount >= tier.count) {
        score = tier.score;
      } else {
        break;
      }
    }

    return { score, matched };
  }

  function calculateSalaryMatch(salaryText) {
    if (!config.minSalary && !config.maxSalary) return { score: 15, match: true };
    if (!salaryText) return { score: 10, match: true };

    const range = parseSalary(salaryText);
    if (!range) return { score: 10, match: true };

    const userMin = config.minSalary || 0;
    const userMax = config.maxSalary || 999;

    if (range.max >= userMin && range.min <= userMax) {
      return { score: 20, match: true };
    }
    return { score: 0, match: false };
  }

  function parseSalary(text) {
    if (!text) return null;
    
    const kMatch = text.match(/(\d+)\s*[-~至]\s*(\d+)\s*[kK千]/);
    if (kMatch) return { min: parseInt(kMatch[1]), max: parseInt(kMatch[2]) };

    const numMatch = text.match(/(\d+)\s*[-~至]\s*(\d+)/);
    if (numMatch) {
      const min = parseInt(numMatch[1]);
      const max = parseInt(numMatch[2]);
      if (min > 100) return { min: Math.round(min/1000), max: Math.round(max/1000) };
      return { min, max };
    }

    const upMatch = text.match(/(\d+)\s*[kK千]\s*以上|\+/);
    if (upMatch) return { min: parseInt(upMatch[1]), max: 999 };

    return null;
  }

  function calculateExperienceMatch(expText) {
    if (!config.experience || config.experience === 0) return { score: 15, match: true };
    
    const expRange = parseExperience(expText);
    if (!expRange) return { score: 8, match: true };

    const expMapping = {
      1: { min: 0, max: 1 },
      2: { min: 1, max: 3 },
      3: { min: 3, max: 5 },
      4: { min: 5, max: 10 },
      5: { min: 10, max: 99 }
    };

    const userExp = expMapping[config.experience];
    if (!userExp) return { score: 8, match: true };

    if (expRange.max >= userExp.min && expRange.min <= userExp.max) {
      return { score: 15, match: true };
    }
    return { score: 0, match: false };
  }

  function parseExperience(text) {
    if (!text) return null;
    
    const rangeMatch = text.match(/(\d+)\s*[-~至]\s*(\d+)\s*年/);
    if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };

    if (text.includes('不限')) return { min: 0, max: 99 };
    if (text.includes('应届') || text.includes('实习')) return { min: 0, max: 1 };

    const upMatch = text.match(/(\d+)\s*年\s*以上/);
    if (upMatch) return { min: parseInt(upMatch[1]), max: 99 };

    return null;
  }

  function calculateEducationMatch(eduText) {
    if (!config.education || config.education === 0) return { score: 10, match: true };
    
    const level = parseEducation(eduText);
    if (!level) return { score: 5, match: true };

    if (config.education >= level) return { score: 10, match: true };
    return { score: 0, match: false };
  }

  function parseEducation(text) {
    if (!text) return null;
    if (text.includes('博士')) return 4;
    if (text.includes('硕士') || text.includes('研究生')) return 3;
    if (text.includes('本科') || text.includes('学士')) return 2;
    if (text.includes('大专') || text.includes('专科')) return 1;
    if (text.includes('不限')) return 0;
    return null;
  }

  function calculateKeywordMatch(jobInfo) {
    const keywords = config.keywords || [];
    if (keywords.length === 0) return { score: 5, matched: [] };

    const allText = `${jobInfo.title} ${jobInfo.description}`.toLowerCase();
    let matched = [];

    keywords.forEach(kw => {
      if (allText.includes(kw.toLowerCase())) matched.push(kw);
    });

    const score = Math.round(10 * (matched.length / keywords.length));
    return { score, matched };
  }

  function isExcluded(jobInfo) {
    const excludeKeywords = config.excludeKeywords || [];
    if (excludeKeywords.length === 0) return false;

    const allText = `${jobInfo.title} ${jobInfo.description}`.toLowerCase();
    return excludeKeywords.some(kw => allText.includes(kw.toLowerCase()));
  }

  function calculateLocationMatch(location) {
    if (!config.location) return { score: 5, match: true };
    
    const locations = config.location.split(/[,，]/).map(l => l.trim().toLowerCase());
    const jobLocation = (location || '').toLowerCase();

    const match = locations.some(loc => jobLocation.includes(loc));
    return { score: match ? 5 : 0, match };
  }

  // ==================== Boss直聘解析器（列表驱动模式） ====================
  const BossParser = {
    platformName: 'Boss直聘',

    // 获取左栏职位列表项
    getJobListItems() {
      const selectors = [
        '.job-card-wrapper',
        'li.job-card-box',
        '.search-job-result li',
        '.job-list-box .job-card-wrapper',
        '[class*="job-card"]',
        'li[class*="job"]'
      ];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll(selector);
        const validItems = Array.from(items).filter(item => {
          const text = item.textContent || '';
          return text.length > 20 && 
                 (text.includes('K') || text.includes('千') || text.includes('薪')) &&
                 item.offsetParent !== null;
        });
        
        if (validItems.length > 0) {
          console.log(`[Boss直聘] 找到 ${validItems.length} 个职位，选择器: ${selector}`);
          return validItems;
        }
      }
      
      // 兜底：查找所有含薪资的列表项
      const allLi = document.querySelectorAll('li');
      const jobItems = Array.from(allLi).filter(li => {
        const text = li.textContent || '';
        return /\d+\s*[-~]\s*\d+\s*[kK]/.test(text) && 
               li.offsetParent !== null &&
               li.offsetHeight > 50;
      });
      
      if (jobItems.length > 0) {
        console.log(`[Boss直聘] 兜底找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    // 点击列表项并等待详情刷新
    async clickJobListItem(item) {
      console.log('[Boss直聘] 点击职位列表项...');
      
      // 先滚动到可见
      try { item.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      await delay(300, 500);
      
      // 获取当前详情页标题（用于判断是否刷新）
      const oldTitle = this.getDetailTitle();
      console.log(`[Boss直聘] 当前详情标题: ${oldTitle || '无'}`);
      
      // 点击列表项
      const clicked = await HumanSimulator.clickElement(item);
      if (!clicked) {
        // 兜底：直接点击第一个链接
        const link = item.querySelector('a');
        if (link) {
          reliableClick(link);
        } else {
          reliableClick(item);
        }
      }
      
      // 等待详情刷新
      let waited = 0;
      const maxWait = 5000;
      while (waited < maxWait) {
        await delay(300);
        waited += 300;
        const newTitle = this.getDetailTitle();
        if (newTitle && newTitle !== oldTitle) {
          console.log(`[Boss直聘] 详情已刷新: ${newTitle}`);
          return true;
        }
      }
      
      console.log('[Boss直聘] 等待详情刷新超时，继续执行');
      return true;
    },

    // 获取详情页标题
    getDetailTitle() {
      const selectors = [
        '.job-detail .job-name',
        '.job-banner .name',
        '.job-detail-title',
        '[class*="job-detail"] [class*="name"]',
        '.detail-content .job-name',
        'h1'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim() && el.offsetParent !== null) {
          return el.textContent.trim();
        }
      }
      return '';
    },

    // 解析详情页职位信息
    parseJobDetail(item) {
      try {
        let title = this.getDetailTitle();
        let salary = '';
        let company = '';
        let location = '';
        let experience = '';
        let education = '';
        let skills = [];
        let description = '';

        // 从详情区获取
        const detailArea = document.querySelector(
          '.job-detail, .job-detail-body, .detail-content, .job-primary, [class*="job-detail"]'
        );

        if (detailArea) {
          description = detailArea.textContent || '';
          
          // 薪资
          const salaryEls = detailArea.querySelectorAll('.salary, [class*="salary"]');
          for (const el of salaryEls) {
            if (el.offsetParent !== null && el.textContent.trim()) {
              salary = el.textContent.trim();
              break;
            }
          }
          
          // 公司
          const companyEls = detailArea.querySelectorAll('.company-name, [class*="company-name"]');
          for (const el of companyEls) {
            if (el.offsetParent !== null && el.textContent.trim()) {
              company = el.textContent.trim();
              break;
            }
          }
          
          // 地点
          const locEls = detailArea.querySelectorAll('.job-area, .area, [class*="job-area"]');
          for (const el of locEls) {
            if (el.offsetParent !== null && el.textContent.trim()) {
              location = el.textContent.trim();
              break;
            }
          }
          
          // 经验和学历
          const infoText = detailArea.textContent;
          const expMatch = infoText.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
          if (expMatch) experience = expMatch[1];
          const eduMatch = infoText.match(/(大专|本科|硕士|博士|学历不限)/);
          if (eduMatch) education = eduMatch[1];
          
          // 技能标签
          const tagEls = detailArea.querySelectorAll('.tag-list li, [class*="tag"] span');
          skills = Array.from(tagEls)
            .map(tag => tag.textContent.trim())
            .filter(t => t && t.length < 15 && t.length > 1);
        }

        // 如果从列表项更容易获取，补充
        if (item) {
          const itemText = item.textContent || '';
          if (!title) {
            const titleMatch = itemText.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
            if (titleMatch) title = titleMatch[1].trim();
          }
          if (!salary) {
            const salaryMatch = itemText.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
            if (salaryMatch) salary = salaryMatch[1];
          }
          if (!description) description = itemText;
        }

        return { title, salary, company, location, experience, education, skills, description, element: item };
      } catch (e) {
        console.error('[Boss直聘] 解析详情失败:', e);
        return null;
      }
    },

    // 兼容旧接口：从列表项解析
    parseJobItem(item) {
      return this.parseJobDetail(item);
    },

    // 在详情页点击立即沟通
    async clickApplyButton(jobItem) {
      console.log('[Boss直聘] 正在查找立即沟通按钮...');
      
      // 等待按钮出现
      let applyBtn = null;
      let waited = 0;
      
      while (waited < 3000 && !applyBtn) {
        applyBtn = this.findChatButton();
        if (applyBtn) break;
        await delay(300);
        waited += 300;
      }
      
      if (!applyBtn) {
        console.log('[Boss直聘] 未找到沟通按钮，尝试从列表卡片上找...');
        
        // 从列表卡片上找
        if (jobItem && jobItem.element) {
          const cardBtn = this.findChatButtonInCard(jobItem.element);
          if (cardBtn) {
            applyBtn = cardBtn;
          }
        }
      }
      
      if (!applyBtn) {
        console.log('[Boss直聘] 所有方式都找不到沟通按钮');
        return { success: false, error: '未找到沟通按钮' };
      }
      
      console.log('[Boss直聘] 找到沟通按钮，准备点击');
      
      // 滚动到按钮
      try { applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      await delay(300, 600);
      
      // 点击
      const clicked = await HumanSimulator.clickElement(applyBtn);
      if (!clicked) {
        reliableClick(applyBtn);
      }
      
      console.log('[Boss直聘] 已点击立即沟通');
      
      // 处理弹窗
      await delay(1500, 2500);
      await this.handleDialog();
      
      return { success: true };
    },

    // 查找沟通按钮（在整个页面）
    findChatButton() {
      // 方式1: 文本精确匹配
      const texts = ['立即沟通', '立即打招呼', '沟通', '打招呼', '聊一聊'];
      for (const text of texts) {
        const btn = findElementByText('button', text);
        if (btn) { console.log(`[Boss直聘] 按钮(精确匹配): ${text}`); return btn; }
        const a = findElementByText('a', text);
        if (a) { console.log(`[Boss直聘] 链接(精确匹配): ${text}`); return a; }
        const span = findElementByText('span', text);
        if (span && span.closest('button, a')) {
          console.log(`[Boss直聘] span按钮: ${text}`);
          return span.closest('button, a');
        }
      }
      
      // 方式2: 文本包含匹配
      for (const text of ['沟通', '打招呼', '聊']) {
        const btns = findAllElementsContainingText('button', text);
        for (const btn of btns) {
          if (btn.offsetParent !== null && btn.offsetWidth > 30) {
            console.log(`[Boss直聘] 按钮(包含匹配): ${btn.textContent.trim()}`);
            return btn;
          }
        }
      }
      
      // 方式3: class选择器
      const classSelectors = [
        '.btn-startchat',
        '.start-chat-btn',
        '.op-btn-chat',
        '.chat-btn',
        '[class*="start-chat"]',
        '[class*="startChat"]',
        '[class*="btn-start"]'
      ];
      
      for (const sel of classSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          console.log(`[Boss直聘] class选择器找到: ${sel}`);
          return btn;
        }
      }
      
      return null;
    },

    // 在卡片内查找沟通按钮
    findChatButtonInCard(card) {
      const texts = ['立即沟通', '沟通', '打招呼'];
      for (const text of texts) {
        const btn = findElementByText('button', text, card);
        if (btn) return btn;
        const a = findElementByText('a', text, card);
        if (a) return a;
      }
      
      const classSelectors = [
        '.start-chat-btn',
        '.chat-btn',
        '[class*="start-chat"]'
      ];
      for (const sel of classSelectors) {
        const btn = card.querySelector(sel);
        if (btn && btn.offsetParent !== null) return btn;
      }
      
      return null;
    },

    // 处理弹窗（如"去微信"、"留在此页"等）
    async handleDialog() {
      console.log('[Boss直聘] 检查是否有弹窗...');
      
      // 查找所有弹窗
      const dialogSelectors = [
        '[role="dialog"]',
        '.modal',
        '.dialog',
        '[class*="modal"]',
        '[class*="dialog"]',
        '.popup'
      ];
      
      let dialog = null;
      for (const sel of dialogSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          dialog = el;
          break;
        }
      }
      
      if (!dialog) {
        console.log('[Boss直聘] 没有检测到弹窗');
        return;
      }
      
      console.log('[Boss直聘] 检测到弹窗，处理中...');
      
      // 优先点击"留在此页"或"继续"
      const stayTexts = ['留在此页', '继续沟通', '继续', '知道了', '确定', '好的', '取消'];
      for (const text of stayTexts) {
        const btn = findElementByText('button', text, dialog);
        if (btn) {
          console.log(`[Boss直聘] 点击弹窗按钮: ${text}`);
          reliableClick(btn);
          await delay(500, 1000);
          return;
        }
      }
      
      // 找关闭按钮
      const closeSelectors = ['.close', '.close-btn', '[class*="close"]'];
      for (const sel of closeSelectors) {
        const btn = dialog.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          reliableClick(btn);
          await delay(500, 1000);
          return;
        }
      }
    },

    // 检查是否已沟通
    hasCommunicated(jobItem) {
      const text = (jobItem.element?.textContent || '') + (document.body.textContent || '');
      return text.includes('已沟通') || 
             text.includes('继续沟通') ||
             text.includes('已打招呼');
    },

    // 检查列表项是否已沟通（从列表卡片上判断）
    isJobItemApplied(item) {
      const text = item.textContent || '';
      return text.includes('已沟通') || 
             text.includes('继续沟通') ||
             text.includes('已打招呼');
    },

    // 翻页
    async goToNextPage() {
      const nextSelectors = [
        '.page-next:not(.disabled)',
        '.next:not(.disabled)',
        'a[title="下一页"]:not(.disabled)',
        '.pagination .next:not(.disabled)',
        '[class*="page-next"]:not(.disabled)'
      ];
      
      for (const sel of nextSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null && !btn.classList.contains('disabled')) {
          console.log('[Boss直聘] 找到下一页按钮');
          await HumanSimulator.clickElement(btn);
          await delay(2000, 3000);
          return true;
        }
      }
      
      return false;
    },

    // 滚动加载
    async scrollLoadMore() {
      console.log('[Boss直聘] 滚动加载更多...');
      const scrollHeight = document.body.scrollHeight;
      
      // 找可滚动的列表容器
      const listContainer = document.querySelector(
        '.job-list-box, .search-job-result, [class*="job-list"]'
      );
      
      if (listContainer) {
        listContainer.scrollTop = listContainer.scrollHeight;
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
      
      await delay(1500, 2500);
      
      const newScrollHeight = document.body.scrollHeight;
      if (newScrollHeight > scrollHeight) {
        console.log('[Boss直聘] 加载了更多内容');
        return true;
      }
      
      return false;
    },

    // 是否是列表+详情双栏模式
    isDualColumnMode() {
      const list = document.querySelector('.job-list-box, .search-job-result, [class*="job-list"]');
      const detail = document.querySelector('.job-detail, [class*="job-detail"]');
      return list && detail;
    }
  };

  // ==================== 智联招聘解析器 ====================
  const ZhilianParser = {
    platformName: '智联招聘',

    getJobListItems() {
      const selectors = [
        '.joblist-box .joblist-box__item',
        '.job-list-item',
        'li.job-list-box__item',
        '.contentpile__content__wrapper__item',
        '.positionlist__item',
        '[class*="job-list-item"]',
        '[class*="joblist"] li'
      ];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll(selector);
        const validItems = Array.from(items).filter(item => {
          const text = item.textContent || '';
          return text.length > 20 && 
                 (text.includes('K') || text.includes('千') || text.includes('薪') || /\d+-\d+/.test(text)) &&
                 item.offsetParent !== null;
        });
        
        if (validItems.length > 0) {
          console.log(`[智联招聘] 找到 ${validItems.length} 个职位，选择器: ${selector}`);
          return validItems;
        }
      }
      
      const allLi = document.querySelectorAll('div[class*="job"]');
      const jobItems = Array.from(allLi).filter(div => {
        const text = div.textContent || '';
        return /\d+\s*[-~]\s*\d+\s*[kK千]/.test(text) && 
               div.offsetParent !== null &&
               div.offsetHeight > 50;
      });
      
      if (jobItems.length > 0) {
        console.log(`[智联招聘] 兜底找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    parseJobItem(item) {
      try {
        const text = item.textContent || '';
        
        let title = '';
        const titleSelectors = ['.job-title', '.job-name', '.positionname', '[class*="job-title"]', '[class*="job-name"]'];
        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        if (!title) {
          const match = text.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
          if (match) title = match[1].trim();
        }
        
        let salary = '';
        const salarySelectors = ['.reward', '.salary', '.job-salary', '.money', '[class*="reward"]', '[class*="salary"]'];
        for (const sel of salarySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { salary = el.textContent.trim(); break; }
        }
        if (!salary) {
          const salaryMatch = text.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
          if (salaryMatch) salary = salaryMatch[1];
        }
        
        let company = '';
        const companySelectors = ['.company-name', '.company', '.job-com', '[class*="company-name"]'];
        for (const sel of companySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
        }
        
        let location = '';
        const locationSelectors = ['.address', '.job-area', '.city', '[class*="address"]', '[class*="area"]'];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { location = el.textContent.trim(); break; }
        }
        
        let experience = '';
        let education = '';
        const infoSelectors = ['.job-info', '.tag-box', '.job-require', '[class*="job-info"]', '[class*="tag"]'];
        for (const sel of infoSelectors) {
          const el = item.querySelector(sel);
          if (el) {
            const infoText = el.textContent;
            const expMatch = infoText.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
            if (expMatch) experience = expMatch[1];
            const eduMatch = infoText.match(/(大专|本科|硕士|博士|学历不限)/);
            if (eduMatch) education = eduMatch[1];
            if (experience || education) break;
          }
        }
        if (!experience) {
          const expMatch = text.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
          if (expMatch) experience = expMatch[1];
        }
        if (!education) {
          const eduMatch = text.match(/(大专|本科|硕士|博士|学历不限)/);
          if (eduMatch) education = eduMatch[1];
        }
        
        const skillTags = item.querySelectorAll('[class*="tag"] span, [class*="skill"]');
        const skills = Array.from(skillTags).map(tag => tag.textContent.trim()).filter(t => t && t.length < 15);

        return { title, salary, company, location, experience, education, skills, description: text, element: item };
      } catch (e) {
        console.error('[智联招聘] 解析失败:', e);
        return null;
      }
    },

    async clickApplyButton(jobItem) {
      const item = jobItem.element;
      console.log('[智联招聘] 查找投递按钮...');
      
      // 1. 在卡片上找
      let applyBtn = this.findApplyButton(item);
      
      // 2. 卡片上没有，点击进入详情
      if (!applyBtn) {
        console.log('[智联招聘] 卡片无按钮，进入详情页...');
        await this.clickJobCard(item);
        await delay(2000, 3000);
        
        // 等待页面加载后在详情页找
        let waited = 0;
        while (waited < 5000 && !applyBtn) {
          applyBtn = this.findApplyButton(document);
          if (applyBtn) break;
          await delay(500);
          waited += 500;
        }
      }
      
      if (!applyBtn) {
        return { success: false, error: '未找到投递按钮' };
      }
      
      console.log('[智联招聘] 找到投递按钮，点击');
      try { applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      await delay(300, 600);
      
      const clicked = await HumanSimulator.clickElement(applyBtn);
      if (!clicked) reliableClick(applyBtn);
      
      // 处理确认弹窗
      await delay(1000, 2000);
      await this.handleConfirmDialog();
      
      return { success: true };
    },

    findApplyButton(container) {
      const texts = ['立即投递', '投递简历', '申请职位', '投递', '立即申请'];
      for (const text of texts) {
        const btn = findElementByText('button', text, container);
        if (btn && btn.offsetParent !== null) return btn;
        const a = findElementByText('a', text, container);
        if (a && a.offsetParent !== null) return a;
      }
      
      const classSelectors = [
        '.btn-apply', '.apply-btn', '.job-apply',
        '.quick-apply-btn', 'button[data-type="apply"]',
        '[class*="apply-btn"]'
      ];
      for (const sel of classSelectors) {
        const btn = container.querySelector(sel);
        if (btn && btn.offsetParent !== null) return btn;
      }
      
      return null;
    },

    async handleConfirmDialog() {
      const dialogSelectors = ['[role="dialog"]', '.modal', '.dialog', '[class*="modal"]'];
      for (const sel of dialogSelectors) {
        const dialog = document.querySelector(sel);
        if (dialog && dialog.offsetParent !== null) {
          console.log('[智联招聘] 处理确认弹窗');
          const confirmTexts = ['确认', '确定', '投递', '好的', '知道了'];
          for (const text of confirmTexts) {
            const btn = findElementByText('button', text, dialog);
            if (btn) { reliableClick(btn); await delay(500); return; }
          }
        }
      }
    },

    async clickJobCard(item) {
      const linkSelectors = ['a[href*="job"]', '.job-title a', '.positionname a', 'a[class*="job"]'];
      for (const sel of linkSelectors) {
        const link = item.querySelector(sel);
        if (link) {
          await HumanSimulator.clickElement(link);
          return true;
        }
      }
      await HumanSimulator.clickElement(item);
      return true;
    },

    hasCommunicated(jobItem) {
      const text = jobItem.element?.textContent || '';
      return text.includes('已投递') || text.includes('已申请') || text.includes('继续沟通');
    },

    async goToNextPage() {
      const nextSelectors = [
        '.btn-next:not(.disabled)', '.page-next:not(.disabled)',
        '.next-page:not(.disabled)', 'a[title="下一页"]:not(.disabled)',
        '.pagination .next:not(.disabled)'
      ];
      for (const sel of nextSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null && !btn.classList.contains('disabled')) {
          console.log('[智联招聘] 点击下一页');
          await HumanSimulator.clickElement(btn);
          await delay(2000, 3000);
          return true;
        }
      }
      return false;
    },

    async scrollLoadMore() {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await delay(1500, 2500);
      return document.body.scrollHeight > scrollHeight;
    }
  };

  // ==================== 51job前程无忧解析器 ====================
  const Job51Parser = {
    platformName: '51job',

    getJobListItems() {
      const selectors = [
        '.j_joblist .e',
        '.joblist .j-li',
        'div[class*="joblist"] div[class*="item"]',
        '.sojob-list li',
        '.j_joblist div.el',
        '[class*="job-item"]',
        'div[class*="j_"]'
      ];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll(selector);
        const validItems = Array.from(items).filter(item => {
          const text = item.textContent || '';
          return text.length > 20 && 
                 (text.includes('K') || text.includes('千') || text.includes('薪') || /\d+-\d+/.test(text)) &&
                 item.offsetParent !== null;
        });
        
        if (validItems.length > 0) {
          console.log(`[51job] 找到 ${validItems.length} 个职位，选择器: ${selector}`);
          return validItems;
        }
      }
      
      const allDivs = document.querySelectorAll('div[class*="job"], div[class*="item"]');
      const jobItems = Array.from(allDivs).filter(div => {
        const text = div.textContent || '';
        return /\d+\s*[-~]\s*\d+\s*[kK千]/.test(text) && 
               div.offsetParent !== null &&
               div.offsetHeight > 50;
      });
      
      if (jobItems.length > 0) {
        console.log(`[51job] 兜底找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    parseJobItem(item) {
      try {
        const text = item.textContent || '';
        
        let title = '';
        const titleSelectors = ['.jname', '.job-name', '.el .t1 a', '.job-title', '[class*="jname"]', '[class*="job-name"]'];
        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        if (!title) {
          const match = text.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
          if (match) title = match[1].trim();
        }
        
        let salary = '';
        const salarySelectors = ['.sal', '.salary', '.el .t4', '[class*="sal"]', '[class*="money"]'];
        for (const sel of salarySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { salary = el.textContent.trim(); break; }
        }
        if (!salary) {
          const salaryMatch = text.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
          if (salaryMatch) salary = salaryMatch[1];
        }
        
        let company = '';
        const companySelectors = ['.cname', '.company-name', '.el .t2 a', '[class*="cname"]', '[class*="company"]'];
        for (const sel of companySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
        }
        
        let location = '';
        const locationSelectors = ['.area', '.job-area', '.el .t3', '[class*="area"]', '[class*="city"]'];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { location = el.textContent.trim(); break; }
        }
        
        let experience = '';
        let education = '';
        const infoSelectors = ['.info', '[class*="info"]', '[class*="require"]'];
        for (const sel of infoSelectors) {
          const el = item.querySelector(sel);
          if (el) {
            const infoText = el.textContent;
            const expMatch = infoText.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
            if (expMatch) experience = expMatch[1];
            const eduMatch = infoText.match(/(大专|本科|硕士|博士|学历不限)/);
            if (eduMatch) education = eduMatch[1];
            if (experience || education) break;
          }
        }
        if (!experience) {
          const expMatch = text.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
          if (expMatch) experience = expMatch[1];
        }
        if (!education) {
          const eduMatch = text.match(/(大专|本科|硕士|博士|学历不限)/);
          if (eduMatch) education = eduMatch[1];
        }
        
        const skillTags = item.querySelectorAll('[class*="tag"] span, [class*="skill"]');
        const skills = Array.from(skillTags).map(tag => tag.textContent.trim()).filter(t => t && t.length < 15);

        return { title, salary, company, location, experience, education, skills, description: text, element: item };
      } catch (e) {
        console.error('[51job] 解析失败:', e);
        return null;
      }
    },

    async clickApplyButton(jobItem) {
      const item = jobItem.element;
      console.log('[51job] 查找投递按钮...');
      
      let applyBtn = this.findApplyButton(item);
      
      if (!applyBtn) {
        console.log('[51job] 卡片无按钮，进入详情页...');
        await this.clickJobCard(item);
        await delay(2000, 3000);
        
        let waited = 0;
        while (waited < 5000 && !applyBtn) {
          applyBtn = this.findApplyButton(document);
          if (applyBtn) break;
          await delay(500);
          waited += 500;
        }
      }
      
      if (!applyBtn) {
        return { success: false, error: '未找到投递按钮' };
      }
      
      console.log('[51job] 找到投递按钮，点击');
      try { applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      await delay(300, 600);
      
      const clicked = await HumanSimulator.clickElement(applyBtn);
      if (!clicked) reliableClick(applyBtn);
      
      await delay(1000, 2000);
      await this.handleConfirmDialog();
      
      return { success: true };
    },

    findApplyButton(container) {
      const texts = ['立即投递', '申请职位', '投递简历', '投递', '立即申请'];
      for (const text of texts) {
        const btn = findElementByText('button', text, container);
        if (btn && btn.offsetParent !== null) return btn;
        const a = findElementByText('a', text, container);
        if (a && a.offsetParent !== null) return a;
      }
      
      const classSelectors = [
        '.btn-apply', '.apply-btn', '.j-apply',
        '.apply_now', 'button[class*="apply"]',
        'a[class*="apply"]'
      ];
      for (const sel of classSelectors) {
        const btn = container.querySelector(sel);
        if (btn && btn.offsetParent !== null) return btn;
      }
      
      return null;
    },

    async handleConfirmDialog() {
      const dialogSelectors = ['[role="dialog"]', '.modal', '.dialog', '[class*="modal"]', '[class*="dialog"]'];
      for (const sel of dialogSelectors) {
        const dialog = document.querySelector(sel);
        if (dialog && dialog.offsetParent !== null) {
          console.log('[51job] 处理确认弹窗');
          const confirmTexts = ['确认', '确定', '投递', '好的', '知道了', '提交'];
          for (const text of confirmTexts) {
            const btn = findElementByText('button', text, dialog);
            if (btn) { reliableClick(btn); await delay(500); return; }
          }
        }
      }
    },

    async clickJobCard(item) {
      const linkSelectors = ['a[href*="job"]', '.jname a', '.job-name a', 'a[class*="job"]'];
      for (const sel of linkSelectors) {
        const link = item.querySelector(sel);
        if (link) {
          await HumanSimulator.clickElement(link);
          return true;
        }
      }
      await HumanSimulator.clickElement(item);
      return true;
    },

    hasCommunicated(jobItem) {
      const text = jobItem.element?.textContent || '';
      return text.includes('已投递') || text.includes('已申请') || text.includes('已投');
    },

    async goToNextPage() {
      const nextSelectors = [
        '.next:not(.disabled)', '.page-next:not(.disabled)',
        '.paging .next:not(.disabled)', 'a.next:not(.disabled)', '#jump_page + a'
      ];
      for (const sel of nextSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null && !btn.classList.contains('disabled')) {
          console.log('[51job] 点击下一页');
          await HumanSimulator.clickElement(btn);
          await delay(2000, 3000);
          return true;
        }
      }
      return false;
    },

    async scrollLoadMore() {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await delay(1500, 2500);
      return document.body.scrollHeight > scrollHeight;
    }
  };

  // ==================== 应届生求职网解析器 ====================
  const YjsParser = {
    platformName: '应届生求职网',

    getJobListItems() {
      const selectors = [
        '.joblist li', '.jobslist .jobitem', '.result-list li',
        '.position-list .item', '[class*="joblist"] li', '[class*="job-item"]'
      ];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll(selector);
        const validItems = Array.from(items).filter(item => {
          const text = item.textContent || '';
          return text.length > 20 && 
                 (text.includes('K') || text.includes('千') || text.includes('薪') || /\d+-\d+/.test(text)) &&
                 item.offsetParent !== null;
        });
        
        if (validItems.length > 0) {
          console.log(`[应届生求职网] 找到 ${validItems.length} 个职位，选择器: ${selector}`);
          return validItems;
        }
      }
      
      const allLi = document.querySelectorAll('li');
      const jobItems = Array.from(allLi).filter(li => {
        const text = li.textContent || '';
        return (/[\d一二三四五六七八九十].*薪/.test(text) || /\d+\s*[-~]\s*\d+/.test(text)) && 
               li.offsetParent !== null && li.offsetHeight > 40;
      });
      
      if (jobItems.length > 0) {
        console.log(`[应届生求职网] 兜底找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    parseJobItem(item) {
      try {
        const text = item.textContent || '';
        
        let title = '';
        const titleSelectors = ['.job-name', '.position', '.jobtitle', '.job-item-title', 'a[class*="job"]', '[class*="job-name"]', '[class*="title"]'];
        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        if (!title) {
          const match = text.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
          if (match) title = match[1].trim();
        }
        
        let salary = '';
        const salarySelectors = ['.salary', '.job-salary', '.xinzi', '[class*="salary"]', '[class*="xin"]'];
        for (const sel of salarySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { salary = el.textContent.trim(); break; }
        }
        if (!salary) {
          const salaryMatch = text.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
          if (salaryMatch) salary = salaryMatch[1];
        }
        
        let company = '';
        const companySelectors = ['.company', '.company-name', '.com', '[class*="company"]'];
        for (const sel of companySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
        }
        
        let location = '';
        const locationSelectors = ['.city', '.area', '.job-city', '[class*="city"]', '[class*="area"]'];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { location = el.textContent.trim(); break; }
        }
        
        let experience = '';
        let education = '';
        const infoSelectors = ['.info', '.job-info', '[class*="info"]'];
        for (const sel of infoSelectors) {
          const el = item.querySelector(sel);
          if (el) {
            const infoText = el.textContent;
            const expMatch = infoText.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
            if (expMatch) experience = expMatch[1];
            const eduMatch = infoText.match(/(大专|本科|硕士|博士|学历不限)/);
            if (eduMatch) education = eduMatch[1];
            if (experience || education) break;
          }
        }
        if (!experience) {
          const expMatch = text.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
          if (expMatch) experience = expMatch[1];
        }
        if (!education) {
          const eduMatch = text.match(/(大专|本科|硕士|博士|学历不限)/);
          if (eduMatch) education = eduMatch[1];
        }
        
        const skillTags = item.querySelectorAll('[class*="tag"], [class*="skill"]');
        const skills = Array.from(skillTags).map(tag => tag.textContent.trim()).filter(t => t && t.length < 15);

        return { title, salary, company, location, experience, education, skills, description: text, element: item };
      } catch (e) {
        console.error('[应届生求职网] 解析失败:', e);
        return null;
      }
    },

    async clickApplyButton(jobItem) {
      const item = jobItem.element;
      console.log('[应届生求职网] 查找投递按钮...');
      
      let applyBtn = this.findApplyButton(item);
      
      if (!applyBtn) {
        console.log('[应届生求职网] 卡片无按钮，进入详情页...');
        await this.clickJobCard(item);
        await delay(2000, 3000);
        
        let waited = 0;
        while (waited < 5000 && !applyBtn) {
          applyBtn = this.findApplyButton(document);
          if (applyBtn) break;
          await delay(500);
          waited += 500;
        }
      }
      
      if (!applyBtn) {
        return { success: false, error: '未找到投递按钮' };
      }
      
      console.log('[应届生求职网] 找到投递按钮，点击');
      try { applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      await delay(300, 600);
      
      const clicked = await HumanSimulator.clickElement(applyBtn);
      if (!clicked) reliableClick(applyBtn);
      
      await delay(1000, 2000);
      await this.handleConfirmDialog();
      
      return { success: true };
    },

    findApplyButton(container) {
      const texts = ['立即投递', '申请职位', '投递简历', '网申', '投递'];
      for (const text of texts) {
        const btn = findElementByText('button', text, container);
        if (btn && btn.offsetParent !== null) return btn;
        const a = findElementByText('a', text, container);
        if (a && a.offsetParent !== null) return a;
      }
      
      const classSelectors = ['.apply-btn', '.btn-apply', '.jobapply', 'button[class*="apply"]', 'a[class*="apply"]'];
      for (const sel of classSelectors) {
        const btn = container.querySelector(sel);
        if (btn && btn.offsetParent !== null) return btn;
      }
      
      return null;
    },

    async handleConfirmDialog() {
      const dialogSelectors = ['[role="dialog"]', '.modal', '.dialog', '[class*="modal"]'];
      for (const sel of dialogSelectors) {
        const dialog = document.querySelector(sel);
        if (dialog && dialog.offsetParent !== null) {
          console.log('[应届生求职网] 处理确认弹窗');
          const confirmTexts = ['确认', '确定', '投递', '好的', '提交'];
          for (const text of confirmTexts) {
            const btn = findElementByText('button', text, dialog);
            if (btn) { reliableClick(btn); await delay(500); return; }
          }
        }
      }
    },

    async clickJobCard(item) {
      const linkSelectors = ['a[href*="job"]', '.job-name a', '.title a', 'a[class*="job"]'];
      for (const sel of linkSelectors) {
        const link = item.querySelector(sel);
        if (link) {
          await HumanSimulator.clickElement(link);
          return true;
        }
      }
      await HumanSimulator.clickElement(item);
      return true;
    },

    hasCommunicated(jobItem) {
      const text = jobItem.element?.textContent || '';
      return text.includes('已投递') || text.includes('已申请') || text.includes('已投');
    },

    async goToNextPage() {
      const nextSelectors = [
        '.next:not(.disabled)', '.page-next:not(.disabled)',
        '.pager .next:not(.disabled)', 'a[class*="next"]:not(.disabled)'
      ];
      for (const sel of nextSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null && !btn.classList.contains('disabled')) {
          console.log('[应届生求职网] 点击下一页');
          await HumanSimulator.clickElement(btn);
          await delay(2000, 3000);
          return true;
        }
      }
      return false;
    },

    async scrollLoadMore() {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await delay(1500, 2500);
      return document.body.scrollHeight > scrollHeight;
    }
  };

  // ==================== 自动投递主逻辑 ====================
  function getCurrentParser() {
    switch (currentPlatform) {
      case 'boss': return BossParser;
      case 'zhilian': return ZhilianParser;
      case 'job51': return Job51Parser;
      case 'yjs': return YjsParser;
      default: return null;
    }
  }

  async function startAutoApply() {
    if (isApplyRunning) {
      console.log('[自动投递] 已经在运行中，忽略重复启动');
      return;
    }

    const parser = getCurrentParser();
    if (!parser) {
      sendApplyStatus('当前页面不支持，请在招聘网站上使用', 'error');
      return;
    }

    // 生成runId用于单例控制
    const runId = Date.now().toString();
    applyRunId = runId;
    isApplyRunning = true;
    stopApplyRequested = false;

    const platformName = parser.platformName || currentPlatform;
    console.log(`%c[自动投递] 开始自动投递 - ${platformName}`, 'color: #51cf66; font-weight: bold;');
    updateDebugPanel('status', '运行中...');
    sendApplyStatus(`已连接${platformName}，开始投递...`, 'running');

    let currentPage = 1;
    let processedCount = 0;
    let noMoreContent = false;
    const processedSet = new Set(); // 去重

    while (isApplyRunning && !stopApplyRequested && !noMoreContent && applyRunId === runId) {
      console.log(`\n===== [自动投递] 第 ${currentPage} 页 =====`);
      updateDebugPanel('page', currentPage.toString());
      
      await delay(1500, 2500);
      
      const jobItems = parser.getJobListItems();
      
      if (jobItems.length === 0) {
        console.log('[自动投递] 未找到职位，尝试滚动加载...');
        const loaded = await parser.scrollLoadMore();
        if (loaded) continue;
        console.log('[自动投递] 无法加载更多内容');
        noMoreContent = true;
        break;
      }

      console.log(`[自动投递] 本页共 ${jobItems.length} 个职位`);

      // 处理每个职位
      for (let i = 0; i < jobItems.length && !stopApplyRequested && applyRunId === runId; i++) {
        const jobItem = jobItems[i];
        
        // 生成唯一标识去重
        const itemKey = jobItem.textContent?.substring(0, 50) + '_' + i;
        if (processedSet.has(itemKey)) {
          console.log('[自动投递] 已处理过，跳过');
          continue;
        }
        processedSet.add(itemKey);
        
        stats.scanned++;
        updateStats();
        updateDebugPanel('scanned', stats.scanned.toString());

        // 先在列表上判断是否已投递
        if (parser.isJobItemApplied && parser.isJobItemApplied(jobItem)) {
          console.log('[自动投递] 列表显示已投递，跳过');
          continue;
        }

        // Boss直聘双栏模式：先点列表项，等详情刷新
        let jobInfo;
        if (currentPlatform === 'boss') {
          // 点击列表项
          await HumanSimulator.scrollToElement(jobItem, { offsetY: 150 });
          await delay(300, 600);
          
          const clicked = await BossParser.clickJobListItem(jobItem);
          await delay(800, 1500);
          
          // 从详情解析
          jobInfo = BossParser.parseJobDetail(jobItem);
        } else {
          // 其他平台正常解析
          await HumanSimulator.scrollToElement(jobItem, { offsetY: 150 });
          await delay(300, 600);
          jobInfo = parser.parseJobItem(jobItem);
        }
        
        if (!jobInfo || !jobInfo.title) {
          console.log(`[自动投递] 第 ${i+1} 个职位解析失败，跳过`);
          continue;
        }

        console.log(`[自动投递] [${i+1}/${jobItems.length}] ${jobInfo.title} - ${jobInfo.company} | ${jobInfo.salary}`);
        updateDebugPanel('current', jobInfo.title);

        // 检查是否已沟通
        if (parser.hasCommunicated(jobInfo)) {
          console.log('[自动投递] 已投递/已沟通，跳过');
          continue;
        }

        // 计算匹配度
        const matchResult = calculateMatchScore(jobInfo);
        console.log(`[自动投递] 匹配度: ${matchResult.score}% | ${matchResult.reasons.join(', ')}`);

        if (matchResult.score < (config?.minMatchScore || 60)) {
          console.log(`[自动投递] 匹配度低于阈值 ${config?.minMatchScore || 60}%，跳过`);
          continue;
        }

        stats.matched++;
        updateStats();
        updateDebugPanel('matched', stats.matched.toString());

        // 点击投递
        sendApplyStatus(`正在投递: ${jobInfo.title.substring(0, 15)}...`, 'running');
        
        const result = await parser.clickApplyButton(jobInfo);
        
        if (result.success) {
          stats.applied++;
          updateStats();
          updateDebugPanel('applied', stats.applied.toString());
          sendApplyStatus(`✓ 已投递: ${jobInfo.title.substring(0, 15)}`, 'success');
          console.log(`%c[自动投递] ✓ 投递成功: ${jobInfo.title}`, 'color: #51cf66;');
          processedCount++;
          
          // 等待一会
          await delay(2000, 3500);
          
          // 如果跳转了详情页，返回列表
          if (currentPlatform !== 'boss') {
            const stillHasList = parser.getJobListItems().length > 0;
            if (!stillHasList && history.length > 1) {
              console.log('[自动投递] 返回列表页');
              history.back();
              await delay(1500, 2500);
            }
          }
        } else {
          console.log(`[自动投递] 投递失败: ${result.error}`);
        }

        // 投递间隔
        const interval = (config?.interval || 5) * 1000;
        const randomExtra = Math.random() * 3000;
        await delay(interval, interval + randomExtra);
      }

      // 翻页或滚动加载
      const hasNext = await parser.goToNextPage();
      if (hasNext) {
        currentPage++;
        await delay(2000, 4000);
      } else {
        const scrolled = await parser.scrollLoadMore();
        if (scrolled) {
          await delay(1500, 2500);
        } else {
          noMoreContent = true;
        }
      }
    }

    if (applyRunId === runId) {
      isApplyRunning = false;
      applyRunId = null;
      updateDebugPanel('status', '已停止');
      sendApplyStatus(
        `投递完成！扫描 ${stats.scanned} 个，匹配 ${stats.matched} 个，投递 ${stats.applied} 个`, 
        'success'
      );
      console.log('%c[自动投递] 任务完成', 'color: #667eea; font-weight: bold;');
    }
  }

  function stopAutoApply() {
    stopApplyRequested = true;
    isApplyRunning = false;
    applyRunId = null;
    console.log('[自动投递] 已停止');
    updateDebugPanel('status', '已停止');
    sendApplyStatus('投递已停止', 'info');
  }

  // ==================== 智能帮答 ====================
  async function startAutoReply() {
    if (isReplyRunning) {
      console.log('[智能帮答] 已经在运行中');
      return;
    }

    if (currentPlatform !== 'boss') {
      sendApplyStatus('帮答功能目前支持Boss直聘消息页', 'error');
      return;
    }

    isReplyRunning = true;
    stopReplyRequested = false;

    console.log('%c[智能帮答] 开始运行', 'color: #51cf66; font-weight: bold;');
    sendApplyStatus('智能帮答已启动', 'running');

    while (isReplyRunning && !stopReplyRequested) {
      await checkAndReplyMessages();
      await delay(5000, 10000);
    }

    isReplyRunning = false;
    console.log('[智能帮答] 已停止');
    sendApplyStatus('智能帮答已停止', 'info');
  }

  function stopAutoReply() {
    stopReplyRequested = true;
    isReplyRunning = false;
  }

  async function checkAndReplyMessages() {
    if (!replyConfig || !replyConfig.enabled) return;

    // 查找消息列表中未读的
    const unreadItems = document.querySelectorAll('[class*="unread"], [class*="badge"]');
    
    for (const item of unreadItems) {
      if (stopReplyRequested) break;
      
      const chatItem = item.closest('[class*="chat-item"], [class*="message-item"], li');
      if (chatItem && chatItem.offsetParent !== null) {
        await HumanSimulator.clickElement(chatItem);
        await delay(1000, 2000);
        
        const reply = generateReply();
        if (reply) {
          const inputEl = document.querySelector('textarea, [contenteditable="true"]');
          if (inputEl) {
            await HumanSimulator.typeText(inputEl, reply);
            await delay(500, 1000);
            
            const sendBtn = findElementContainingText('button', '发送') ||
                           findElementContainingText('button', 'send');
            if (sendBtn) {
              reliableClick(sendBtn);
              replyStats.replied++;
              chrome.storage.local.set({ replyStats });
            }
          }
        }
        
        await delay(1000, 2000);
      }
    }
  }

  function generateReply() {
    if (!replyConfig) return '';
    
    const lastMessage = getLastRecruiterMessage();
    if (!lastMessage) return '';

    // 自定义模板匹配
    if (replyConfig.templates) {
      for (const tpl of replyConfig.templates) {
        if (tpl.keyword && lastMessage.includes(tpl.keyword)) {
          return tpl.reply;
        }
      }
    }

    // 预设回复
    const presets = replyConfig.presets || {};
    const msg = lastMessage.toLowerCase();
    
    if (presets.salary && (msg.includes('薪资') || msg.includes('期望') || msg.includes('工资') || msg.includes('薪水'))) {
      return `您好，我的期望薪资是${config?.minSalary || '面议'}K-${config?.maxSalary || '面议'}K，具体可根据工作内容和公司福利协商。`;
    }
    
    if (presets.experience && (msg.includes('经验') || msg.includes('做过') || msg.includes('项目'))) {
      return replyConfig.selfIntro || '您好，我有相关工作经验，具备所需的专业技能，期待进一步沟通。';
    }
    
    if (presets.onboard && (msg.includes('入职') || msg.includes('到岗') || msg.includes('什么时候能来'))) {
      return '您好，我离职后可在1-2周内到岗，具体时间可以协商。';
    }
    
    if (presets.greeting && (msg === '你好' || msg === '您好' || msg.includes('在吗'))) {
      return '您好！我对这个职位很感兴趣，我的简历已发送，请您查阅。如有问题随时沟通~';
    }
    
    if (presets.interview && (msg.includes('面试') || msg.includes('方便聊聊') || msg.includes('电话'))) {
      return '您好，方便的！我的电话是（请填写），随时可以沟通。或者您方便的时间也可以告诉我。';
    }
    
    return '';
  }

  function getLastRecruiterMessage() {
    const messages = document.querySelectorAll('[class*="message"], [class*="msg-item"]');
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const text = msg.textContent?.trim() || '';
      if (text && text.length < 500) {
        return text;
      }
    }
    return '';
  }

  // ==================== 统计和状态 ====================
  function updateStats() {
    chrome.storage.local.set({ stats });
    try {
      chrome.runtime.sendMessage({ type: 'STATS_UPDATED', stats });
    } catch(e) {}
  }

  function sendApplyStatus(status, statusType) {
    try {
      chrome.runtime.sendMessage({ type: 'APPLY_STATUS', status, statusType });
    } catch(e) {}
  }

  // ==================== 调试面板 ====================
  function injectDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'auto-apply-debug-panel';
    panel.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      background: rgba(0, 0, 0, 0.85); color: white; padding: 12px 16px;
      border-radius: 8px; font-size: 12px; font-family: monospace;
      cursor: move; user-select: none; min-width: 180px; display: none;
    `;
    
    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #667eea;">📮 自动投递助手 v3.0</div>
      <div>状态: <span id="debug-status">待机</span></div>
      <div>当前页: <span id="debug-page">-</span></div>
      <div>已扫描: <span id="debug-scanned">0</span></div>
      <div>已匹配: <span id="debug-matched">0</span></div>
      <div>已投递: <span id="debug-applied">0</span></div>
      <div style="margin-top: 6px; font-size: 11px; color: #aaa;">当前职位: <span id="debug-current">-</span></div>
      <div style="margin-top: 8px; font-size: 11px; color: #667eea;">按 Ctrl+Shift+A 显示/隐藏</div>
    `;
    
    document.body.appendChild(panel);
    
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        const panel = document.getElementById('auto-apply-debug-panel');
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      }
    });
    
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    panel.addEventListener('mousedown', function(e) {
      isDragging = true;
      dragOffset.x = e.clientX - panel.offsetLeft;
      dragOffset.y = e.clientY - panel.offsetTop;
    });
    document.addEventListener('mousemove', function(e) {
      if (isDragging) {
        panel.style.left = (e.clientX - dragOffset.x) + 'px';
        panel.style.top = (e.clientY - dragOffset.y) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      }
    });
    document.addEventListener('mouseup', function() { isDragging = false; });
  }

  function updateDebugPanel(key, value) {
    const el = document.getElementById(`debug-${key}`);
    if (el) el.textContent = value;
  }

  // ==================== 消息监听 ====================
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('[自动投递助手] 收到消息:', message.type);

    switch (message.type) {
      case 'START_AUTO_APPLY':
        chrome.storage.local.get(['config'], function(result) {
          config = result.config || config;
          startAutoApply();
        });
        sendResponse({ success: true });
        break;

      case 'STOP_AUTO_APPLY':
        stopAutoApply();
        sendResponse({ success: true });
        break;

      case 'START_AUTO_REPLY':
        chrome.storage.local.get(['replyConfig', 'config'], function(result) {
          replyConfig = result.replyConfig || replyConfig;
          config = result.config || config;
          startAutoReply();
        });
        sendResponse({ success: true });
        break;

      case 'STOP_AUTO_REPLY':
        stopAutoReply();
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          success: true,
          isApplyRunning,
          isReplyRunning,
          stats,
          replyStats,
          platform: currentPlatform
        });
        break;

      case 'PING':
        sendResponse({ success: true, platform: currentPlatform, ready: true });
        break;

      default:
        sendResponse({ success: false, error: '未知消息类型' });
    }

    return true;
  });

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
