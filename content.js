// content.js - 自动投递助手内容脚本
// 版本: v2.0
// 功能: 自动投递简历 + 智能帮答 + 模拟人工操作

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

  console.log('%c[自动投递助手] 脚本已加载', 'color: #667eea; font-weight: bold; font-size: 14px;');

  // ==================== 初始化 ====================
  function init() {
    currentPlatform = detectPlatform();
    if (!currentPlatform) {
      console.log('[自动投递助手] 未识别的平台，脚本已加载但不会自动执行');
      return;
    }
    console.log(`[自动投递助手] 当前平台: ${currentPlatform}`);

    // 加载配置
    chrome.storage.local.get(['config', 'replyConfig', 'stats', 'replyStats'], function(result) {
      config = result.config || getDefaultConfig();
      replyConfig = result.replyConfig || getDefaultReplyConfig();
      stats = result.stats || { scanned: 0, matched: 0, applied: 0 };
      replyStats = result.replyStats || { replied: 0, candidates: 0 };
      console.log('[自动投递助手] 配置已加载');
    });

    // 注入调试信息到页面
    injectDebugPanel();
  }

  // 检测当前平台
  function detectPlatform() {
    const url = window.location.href;
    if (url.includes('zhipin.com')) return 'boss';
    if (url.includes('zhaopin.com')) return 'zhilian';
    if (url.includes('51job.com')) return 'job51';
    if (url.includes('yingjiesheng.com')) return 'yjs';
    if (url.includes('jobonline.cn')) return 'jobOnline';
    return null;
  }

  // 默认配置
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
      minMatchScore: 60,
      interval: 5,
      platforms: { boss: true, zhilian: false, jobOnline: false },
      humanMode: true,
      scrollInterval: 2000
    };
  }

  function getDefaultReplyConfig() {
    return {
      enabled: false,
      selfIntro: '',
      templates: [],
      presets: { salary: true, experience: true, onboard: true }
    };
  }

  // ==================== 模拟人工操作工具 ====================
  const HumanSimulator = {
    // 随机延迟
    async delay(minMs, maxMs) {
      const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
      return new Promise(resolve => setTimeout(resolve, delay));
    },

    // 平滑滚动到元素
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
          
          // 缓动函数 (ease-out)
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

    // 模拟鼠标移动到元素
    async moveMouseTo(element) {
      const rect = element.getBoundingClientRect();
      const startX = window.innerWidth / 2;
      const startY = window.innerHeight / 2;
      const endX = rect.left + rect.width / 2;
      const endY = rect.top + rect.height / 2;
      
      // 分多步移动，模拟人类鼠标轨迹
      const steps = 10 + Math.floor(Math.random() * 10);
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        // 贝塞尔曲线 - 添加一点弧度
        const x = startX + (endX - startX) * progress + Math.sin(progress * Math.PI) * 20;
        const y = startY + (endY - startY) * progress;
        
        // 派发鼠标移动事件
        const event = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        });
        document.elementFromPoint(x, y)?.dispatchEvent(event);
        
        await this.delay(15, 30);
      }
    },

    // 模拟人类点击
    async clickElement(element) {
      if (!element) return false;
      
      // 先移动鼠标
      await this.moveMouseTo(element);
      await this.delay(100, 300);
      
      // 鼠标悬停
      element.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true,
        view: window,
        clientX: element.getBoundingClientRect().left + element.offsetWidth / 2,
        clientY: element.getBoundingClientRect().top + element.offsetHeight / 2
      }));
      
      await this.delay(200, 500);
      
      // mousedown + mouseup + click
      element.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0
      }));
      
      await this.delay(50, 150);
      
      element.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0
      }));
      
      element.click();
      
      return true;
    },

    // 模拟输入
    async typeText(inputElement, text, options = {}) {
      const { delayMin = 50, delayMax = 150 } = options;
      
      inputElement.focus();
      await this.delay(200, 400);
      
      for (let i = 0; i < text.length; i++) {
        inputElement.value += text[i];
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 随机延迟
        await this.delay(delayMin, delayMax);
        
        // 偶尔停顿一下（模拟思考）
        if (i > 0 && i % 5 === 0 && Math.random() > 0.7) {
          await this.delay(300, 800);
        }
      }
    },

    // 随机滚动页面
    async randomScroll(direction = 'down') {
      const scrollAmount = 100 + Math.floor(Math.random() * 200);
      const currentScroll = window.pageYOffset;
      const targetScroll = direction === 'down' 
        ? currentScroll + scrollAmount 
        : Math.max(0, currentScroll - scrollAmount);
      
      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
      
      await this.delay(500, 1000);
    }
  };

  // ==================== 匹配算法 ====================
  function calculateMatchScore(jobInfo) {
    if (!config) return { score: 0, reasons: ['未加载配置'] };

    let totalScore = 0;
    let reasons = [];

    // 1. 技能匹配 (40分)
    const skillScore = calculateSkillMatch(jobInfo);
    totalScore += skillScore.score;
    if (skillScore.matched.length > 0) {
      reasons.push(`技能匹配: ${skillScore.matched.join(', ')}`);
    }

    // 2. 薪资匹配 (20分)
    const salaryScore = calculateSalaryMatch(jobInfo.salary);
    totalScore += salaryScore.score;
    if (salaryScore.match) reasons.push('薪资符合');

    // 3. 工作年限 (15分)
    const expScore = calculateExperienceMatch(jobInfo.experience);
    totalScore += expScore.score;
    if (expScore.match) reasons.push('年限符合');

    // 4. 学历匹配 (10分)
    const eduScore = calculateEducationMatch(jobInfo.education);
    totalScore += eduScore.score;
    if (eduScore.match) reasons.push('学历符合');

    // 5. 关键词匹配 (10分)
    const keywordScore = calculateKeywordMatch(jobInfo);
    totalScore += keywordScore.score;
    if (keywordScore.matched.length > 0) {
      reasons.push(`关键词: ${keywordScore.matched.join(', ')}`);
    }

    // 6. 排除关键词检查 (直接排除)
    if (isExcluded(jobInfo)) {
      return { score: 0, reasons: ['包含排除关键词'] };
    }

    // 7. 地点匹配 (5分)
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

    const score = Math.round(40 * (matched.length / userSkills.length));
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

  // ==================== Boss直聘解析器 ====================
  const BossParser = {
    // 获取职位列表 - 更新了选择器以适配最新Boss直聘页面
    getJobListItems() {
      const selectors = [
        '.job-card-wrapper',
        '.job-card-left',
        'li.job-card-box',
        '.job-list-box li',
        '.search-job-result .job-card-wrapper',
        '.job-list .job-card-wrapper',
        '.result-job-wrapper .job-card-wrapper',
        '.job-card-container',
        '[class*="job-card"]',
        'li[class*="job"]'
      ];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll(selector);
        const validItems = Array.from(items).filter(item => {
          // 过滤掉明显不是职位卡片的元素
          const text = item.textContent || '';
          return text.length > 20 && 
                 (text.includes('K') || text.includes('千') || text.includes('薪')) &&
                 item.offsetParent !== null; // 确保元素可见
        });
        
        if (validItems.length > 0) {
          console.log(`[Boss直聘] 找到 ${validItems.length} 个职位卡片，选择器: ${selector}`);
          return validItems;
        }
      }
      
      console.log('[Boss直聘] 未找到职位卡片，正在尝试其他方式...');
      
      // 兜底方案：查找所有包含薪资数字的列表项
      const allLi = document.querySelectorAll('li');
      const jobItems = Array.from(allLi).filter(li => {
        const text = li.textContent || '';
        return /\d+\s*[-~]\s*\d+\s*[kK]/.test(text) && 
               li.offsetParent !== null &&
               li.offsetHeight > 50;
      });
      
      if (jobItems.length > 0) {
        console.log(`[Boss直聘] 通过兜底方式找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    // 解析职位信息
    parseJobItem(item) {
      try {
        const text = item.textContent || '';
        
        // 标题
        let title = '';
        const titleSelectors = [
          '.job-name', '.job-title', '.position',
          '.job-name-wrapper .job-name',
          '.job-title-text',
          '[class*="job-name"]', '[class*="job-title"]'
        ];
        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) {
            title = el.textContent.trim();
            break;
          }
        }
        if (!title) {
          // 从文本中提取（前10-20个字符通常是标题）
          const match = text.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
          if (match) title = match[1].trim();
        }
        
        // 薪资
        let salary = '';
        const salarySelectors = [
          '.salary', '.job-salary', '.red',
          '.job-salary-wrapper .salary',
          '[class*="salary"]'
        ];
        for (const sel of salarySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) {
            salary = el.textContent.trim();
            break;
          }
        }
        if (!salary) {
          const salaryMatch = text.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
          if (salaryMatch) salary = salaryMatch[1];
        }
        
        // 公司
        let company = '';
        const companySelectors = [
          '.company-name', '.company-text',
          '.company-info .company-name',
          '[class*="company-name"]'
        ];
        for (const sel of companySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) {
            company = el.textContent.trim();
            break;
          }
        }
        
        // 地点
        let location = '';
        const locationSelectors = [
          '.job-area', '.area', '.job-area-wrapper',
          '[class*="job-area"]', '[class*="area"]'
        ];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) {
            location = el.textContent.trim();
            break;
          }
        }
        
        // 经验和学历
        let experience = '';
        let education = '';
        const infoSelectors = [
          '.tag-list', '.job-info', '.job-request',
          '.job-info-wrapper',
          '[class*="tag-list"]', '[class*="job-info"]'
        ];
        
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
        
        // 如果没找到，从全文本提取
        if (!experience) {
          const expMatch = text.match(/(\d+-\d+年|经验不限|应届|实习|\d+年以上)/);
          if (expMatch) experience = expMatch[1];
        }
        if (!education) {
          const eduMatch = text.match(/(大专|本科|硕士|博士|学历不限)/);
          if (eduMatch) education = eduMatch[1];
        }
        
        // 技能标签
        const skillTags = item.querySelectorAll(
          '.tag-list li, .job-tags span, .skills span, [class*="tag"]'
        );
        const skills = Array.from(skillTags)
          .map(tag => tag.textContent.trim())
          .filter(t => t && t.length < 15);

        return {
          title,
          salary,
          company,
          location,
          experience,
          education,
          skills,
          description: text,
          element: item
        };
      } catch (e) {
        console.error('[Boss直聘] 解析职位失败:', e);
        return null;
      }
    },

    // 点击沟通按钮
    async clickApplyButton(jobItem) {
      try {
        const item = jobItem.element;
        
        // 查找沟通按钮（多种选择器）
        const btnSelectors = [
          '.start-chat-btn',
          '.chat-btn',
          '.btn-startchat',
          'button[data-url*="chat"]',
          '[class*="start-chat"]',
          '[class*="chat-btn"]',
          'button:contains("沟通")',
          'a:contains("沟通")'
        ];
        
        let applyBtn = null;
        for (const sel of btnSelectors) {
          const btn = item.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            applyBtn = btn;
            break;
          }
        }
        
        // 如果卡片上没有按钮，尝试找整个页面可见的
        if (!applyBtn) {
          // 先点击卡片进入详情
          console.log('[Boss直聘] 卡片上未找到沟通按钮，尝试点击卡片...');
          await this.clickJobCard(item);
          
          // 等待页面跳转
          await HumanSimulator.delay(1500, 2500);
          
          // 在新页面找沟通按钮
          const detailBtns = document.querySelectorAll(
            '.op-btn-chat, .start-chat-btn, .chat-btn, [class*="start-chat"], [class*="沟通"]'
          );
          
          for (const btn of detailBtns) {
            if (btn.offsetParent !== null) {
              applyBtn = btn;
              break;
            }
          }
          
          if (applyBtn) {
            console.log('[Boss直聘] 在详情页找到沟通按钮');
            await HumanSimulator.clickElement(applyBtn);
            return { success: true };
          }
          
          return { success: false, error: '详情页也未找到沟通按钮' };
        }
        
        console.log('[Boss直聘] 找到沟通按钮，准备点击');
        
        // 滚动到可见位置
        await HumanSimulator.scrollToElement(applyBtn);
        await HumanSimulator.delay(300, 600);
        
        // 模拟人类点击
        await HumanSimulator.clickElement(applyBtn);
        
        return { success: true };
      } catch (e) {
        console.error('[Boss直聘] 点击沟通按钮失败:', e);
        return { success: false, error: e.message };
      }
    },

    // 点击职位卡片
    async clickJobCard(item) {
      const linkSelectors = [
        'a[href*="job_detail"]',
        'a.job-card-left',
        '.job-card-wrapper a',
        'a[href*="/job/"]'
      ];
      
      for (const sel of linkSelectors) {
        const link = item.querySelector(sel);
        if (link) {
          await HumanSimulator.clickElement(link);
          return true;
        }
      }
      
      // 兜底：直接点击元素
      await HumanSimulator.clickElement(item);
      return true;
    },

    // 检查是否已经沟通过
    hasCommunicated(jobItem) {
      const text = jobItem.element.textContent || '';
      return text.includes('已沟通') || 
             text.includes('已投递') || 
             text.includes('已打招呼') ||
             text.includes('继续沟通');
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
          return true;
        }
      }
      
      console.log('[Boss直聘] 未找到下一页按钮');
      return false;
    },

    // 滚动加载更多（Boss直聘有些页面是滚动加载）
    async scrollLoadMore() {
      console.log('[Boss直聘] 滚动加载更多职位...');
      
      const scrollHeight = document.body.scrollHeight;
      
      // 平滑滚动到底部
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
      
      await HumanSimulator.delay(1500, 2500);
      
      // 检查是否有新内容加载
      const newScrollHeight = document.body.scrollHeight;
      if (newScrollHeight > scrollHeight) {
        console.log('[Boss直聘] 加载了更多内容');
        return true;
      }
      
      return false;
    }
  };

  // ==================== 智联招聘解析器 ====================
  const ZhilianParser = {
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
      
      // 兜底
      const allLi = document.querySelectorAll('div[class*="job"]');
      const jobItems = Array.from(allLi).filter(div => {
        const text = div.textContent || '';
        return /\d+\s*[-~]\s*\d+\s*[kK千]/.test(text) && 
               div.offsetParent !== null &&
               div.offsetHeight > 50;
      });
      
      if (jobItems.length > 0) {
        console.log(`[智联招聘] 通过兜底找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    parseJobItem(item) {
      try {
        const text = item.textContent || '';
        
        let title = '';
        const titleSelectors = [
          '.job-title', '.job-name', '.positionname',
          '.joblist-box__iteminfo__jobname',
          '[class*="job-title"]', '[class*="job-name"]'
        ];
        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        if (!title) {
          const match = text.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
          if (match) title = match[1].trim();
        }
        
        let salary = '';
        const salarySelectors = [
          '.reward', '.salary', '.job-salary', '.money',
          '[class*="reward"]', '[class*="salary"]'
        ];
        for (const sel of salarySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { salary = el.textContent.trim(); break; }
        }
        if (!salary) {
          const salaryMatch = text.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
          if (salaryMatch) salary = salaryMatch[1];
        }
        
        let company = '';
        const companySelectors = [
          '.company-name', '.company', '.job-com',
          '[class*="company-name"]'
        ];
        for (const sel of companySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
        }
        
        let location = '';
        const locationSelectors = [
          '.address', '.job-area', '.city',
          '[class*="address"]', '[class*="area"]'
        ];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { location = el.textContent.trim(); break; }
        }
        
        let experience = '';
        let education = '';
        const infoSelectors = [
          '.job-info', '.tag-box', '.job-require',
          '[class*="job-info"]', '[class*="tag"]'
        ];
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
        const skills = Array.from(skillTags)
          .map(tag => tag.textContent.trim())
          .filter(t => t && t.length < 15);

        return { title, salary, company, location, experience, education, skills, description: text, element: item };
      } catch (e) {
        console.error('[智联招聘] 解析失败:', e);
        return null;
      }
    },

    async clickApplyButton(jobItem) {
      try {
        const item = jobItem.element;
        
        const btnSelectors = [
          '.btn-apply', '.apply-btn', '.job-apply',
          '.quick-apply-btn', 'button[data-type="apply"]',
          '[class*="apply-btn"]', '[class*="投递"]'
        ];
        
        let applyBtn = null;
        for (const sel of btnSelectors) {
          const btn = item.querySelector(sel);
          if (btn && btn.offsetParent !== null) { applyBtn = btn; break; }
        }
        
        if (!applyBtn) {
          console.log('[智联招聘] 卡片无投递按钮，点击进入详情...');
          await this.clickJobCard(item);
          await HumanSimulator.delay(1500, 2500);
          
          const detailBtns = document.querySelectorAll(
            '.apply-btn, .btn-apply, .job-apply-btn, [class*="apply-btn"], button:contains("投递")'
          );
          
          for (const btn of detailBtns) {
            if (btn.offsetParent !== null) { applyBtn = btn; break; }
          }
          
          if (applyBtn) {
            console.log('[智联招聘] 在详情页找到投递按钮');
            await HumanSimulator.scrollToElement(applyBtn);
            await HumanSimulator.clickElement(applyBtn);
            return { success: true };
          }
          return { success: false, error: '详情页也未找到投递按钮' };
        }
        
        console.log('[智联招聘] 找到投递按钮');
        await HumanSimulator.scrollToElement(applyBtn);
        await HumanSimulator.delay(300, 600);
        await HumanSimulator.clickElement(applyBtn);
        return { success: true };
      } catch (e) {
        console.error('[智联招聘] 点击失败:', e);
        return { success: false, error: e.message };
      }
    },

    async clickJobCard(item) {
      const linkSelectors = [
        'a[href*="job"]', '.job-title a', '.positionname a',
        'a[class*="job"]'
      ];
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
      const text = jobItem.element.textContent || '';
      return text.includes('已投递') || text.includes('已申请') || text.includes('继续沟通');
    },

    async goToNextPage() {
      const nextSelectors = [
        '.btn-next:not(.disabled)',
        '.page-next:not(.disabled)',
        '.next-page:not(.disabled)',
        'a[title="下一页"]:not(.disabled)',
        '.pagination .next:not(.disabled)'
      ];
      
      for (const sel of nextSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null && !btn.classList.contains('disabled')) {
          console.log('[智联招聘] 找到下一页');
          await HumanSimulator.clickElement(btn);
          return true;
        }
      }
      return false;
    },

    async scrollLoadMore() {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await HumanSimulator.delay(1500, 2500);
      return document.body.scrollHeight > scrollHeight;
    }
  };

  // ==================== 51job前程无忧解析器 ====================
  const Job51Parser = {
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
        console.log(`[51job] 通过兜底找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    parseJobItem(item) {
      try {
        const text = item.textContent || '';
        
        let title = '';
        const titleSelectors = [
          '.jname', '.job-name', '.j_joblist .e .jname',
          '.el .t1 a', '.job-title',
          '[class*="jname"]', '[class*="job-name"]'
        ];
        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        if (!title) {
          const match = text.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
          if (match) title = match[1].trim();
        }
        
        let salary = '';
        const salarySelectors = [
          '.sal', '.salary', '.j_joblist .e .sal',
          '.el .t4', '[class*="sal"]', '[class*="money"]'
        ];
        for (const sel of salarySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { salary = el.textContent.trim(); break; }
        }
        if (!salary) {
          const salaryMatch = text.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
          if (salaryMatch) salary = salaryMatch[1];
        }
        
        let company = '';
        const companySelectors = [
          '.cname', '.company-name', '.j_joblist .e .cname',
          '.el .t2 a', '[class*="cname"]', '[class*="company"]'
        ];
        for (const sel of companySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
        }
        
        let location = '';
        const locationSelectors = [
          '.area', '.job-area', '.j_joblist .e .d',
          '.el .t3', '[class*="area"]', '[class*="city"]'
        ];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { location = el.textContent.trim(); break; }
        }
        
        let experience = '';
        let education = '';
        const infoSelectors = [
          '.info', '.j_joblist .e .info',
          '[class*="info"]', '[class*="require"]'
        ];
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
        const skills = Array.from(skillTags)
          .map(tag => tag.textContent.trim())
          .filter(t => t && t.length < 15);

        return { title, salary, company, location, experience, education, skills, description: text, element: item };
      } catch (e) {
        console.error('[51job] 解析失败:', e);
        return null;
      }
    },

    async clickApplyButton(jobItem) {
      try {
        const item = jobItem.element;
        
        const btnSelectors = [
          '.btn-apply', '.apply-btn', '.j-apply',
          '.apply_now', 'button[class*="apply"]',
          'a[class*="apply"]'
        ];
        
        let applyBtn = null;
        for (const sel of btnSelectors) {
          const btn = item.querySelector(sel);
          if (btn && btn.offsetParent !== null) { applyBtn = btn; break; }
        }
        
        if (!applyBtn) {
          console.log('[51job] 卡片无按钮，点击进入详情...');
          await this.clickJobCard(item);
          await HumanSimulator.delay(1500, 2500);
          
          const detailBtns = document.querySelectorAll(
            '.apply-btn, .btn-apply, .job-apply, [class*="apply-btn"]'
          );
          
          for (const btn of detailBtns) {
            if (btn.offsetParent !== null) { applyBtn = btn; break; }
          }
          
          if (applyBtn) {
            console.log('[51job] 在详情页找到投递按钮');
            await HumanSimulator.scrollToElement(applyBtn);
            await HumanSimulator.clickElement(applyBtn);
            return { success: true };
          }
          return { success: false, error: '详情页也未找到投递按钮' };
        }
        
        console.log('[51job] 找到投递按钮');
        await HumanSimulator.scrollToElement(applyBtn);
        await HumanSimulator.delay(300, 600);
        await HumanSimulator.clickElement(applyBtn);
        return { success: true };
      } catch (e) {
        console.error('[51job] 点击失败:', e);
        return { success: false, error: e.message };
      }
    },

    async clickJobCard(item) {
      const linkSelectors = [
        'a[href*="job"]', '.jname a', '.job-name a',
        'a[class*="job"]'
      ];
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
      const text = jobItem.element.textContent || '';
      return text.includes('已投递') || text.includes('已申请') || text.includes('已投');
    },

    async goToNextPage() {
      const nextSelectors = [
        '.next:not(.disabled)',
        '.page-next:not(.disabled)',
        '.paging .next:not(.disabled)',
        'a.next:not(.disabled)',
        '#jump_page + a'
      ];
      
      for (const sel of nextSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null && !btn.classList.contains('disabled')) {
          console.log('[51job] 找到下一页');
          await HumanSimulator.clickElement(btn);
          return true;
        }
      }
      return false;
    },

    async scrollLoadMore() {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await HumanSimulator.delay(1500, 2500);
      return document.body.scrollHeight > scrollHeight;
    }
  };

  // ==================== 应届生求职网解析器 ====================
  const YjsParser = {
    getJobListItems() {
      const selectors = [
        '.joblist li',
        '.jobslist .jobitem',
        '.result-list li',
        '.position-list .item',
        '[class*="joblist"] li',
        '[class*="job-item"]'
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
               li.offsetParent !== null &&
               li.offsetHeight > 40;
      });
      
      if (jobItems.length > 0) {
        console.log(`[应届生求职网] 通过兜底找到 ${jobItems.length} 个职位`);
        return jobItems;
      }
      
      return [];
    },

    parseJobItem(item) {
      try {
        const text = item.textContent || '';
        
        let title = '';
        const titleSelectors = [
          '.job-name', '.position', '.jobtitle',
          '.job-item-title', 'a[class*="job"]',
          '[class*="job-name"]', '[class*="title"]'
        ];
        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        if (!title) {
          const match = text.match(/^(.{5,25}?)(?:\s{2,}|\n)/);
          if (match) title = match[1].trim();
        }
        
        let salary = '';
        const salarySelectors = [
          '.salary', '.job-salary', '.xinzi',
          '[class*="salary"]', '[class*="xin"]'
        ];
        for (const sel of salarySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { salary = el.textContent.trim(); break; }
        }
        if (!salary) {
          const salaryMatch = text.match(/(\d+\s*[-~]\s*\d+\s*[kK千])/);
          if (salaryMatch) salary = salaryMatch[1];
        }
        
        let company = '';
        const companySelectors = [
          '.company', '.company-name', '.com',
          '[class*="company"]'
        ];
        for (const sel of companySelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
        }
        
        let location = '';
        const locationSelectors = [
          '.city', '.area', '.job-city',
          '[class*="city"]', '[class*="area"]'
        ];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el && el.textContent.trim()) { location = el.textContent.trim(); break; }
        }
        
        let experience = '';
        let education = '';
        const infoSelectors = [
          '.info', '.job-info', '[class*="info"]'
        ];
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
        const skills = Array.from(skillTags)
          .map(tag => tag.textContent.trim())
          .filter(t => t && t.length < 15);

        return { title, salary, company, location, experience, education, skills, description: text, element: item };
      } catch (e) {
        console.error('[应届生求职网] 解析失败:', e);
        return null;
      }
    },

    async clickApplyButton(jobItem) {
      try {
        const item = jobItem.element;
        
        const btnSelectors = [
          '.apply-btn', '.btn-apply', '.jobapply',
          'button[class*="apply"]', 'a[class*="apply"]'
        ];
        
        let applyBtn = null;
        for (const sel of btnSelectors) {
          const btn = item.querySelector(sel);
          if (btn && btn.offsetParent !== null) { applyBtn = btn; break; }
        }
        
        if (!applyBtn) {
          console.log('[应届生求职网] 卡片无按钮，点击进入详情...');
          await this.clickJobCard(item);
          await HumanSimulator.delay(1500, 2500);
          
          const detailBtns = document.querySelectorAll(
            '.apply-btn, .btn-apply, [class*="apply-btn"]'
          );
          
          for (const btn of detailBtns) {
            if (btn.offsetParent !== null) { applyBtn = btn; break; }
          }
          
          if (applyBtn) {
            console.log('[应届生求职网] 在详情页找到投递按钮');
            await HumanSimulator.scrollToElement(applyBtn);
            await HumanSimulator.clickElement(applyBtn);
            return { success: true };
          }
          return { success: false, error: '详情页也未找到投递按钮' };
        }
        
        console.log('[应届生求职网] 找到投递按钮');
        await HumanSimulator.scrollToElement(applyBtn);
        await HumanSimulator.delay(300, 600);
        await HumanSimulator.clickElement(applyBtn);
        return { success: true };
      } catch (e) {
        console.error('[应届生求职网] 点击失败:', e);
        return { success: false, error: e.message };
      }
    },

    async clickJobCard(item) {
      const linkSelectors = [
        'a[href*="job"]', '.job-name a', '.title a',
        'a[class*="job"]'
      ];
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
      const text = jobItem.element.textContent || '';
      return text.includes('已投递') || text.includes('已申请') || text.includes('已投');
    },

    async goToNextPage() {
      const nextSelectors = [
        '.next:not(.disabled)',
        '.page-next:not(.disabled)',
        '.pager .next:not(.disabled)',
        'a[class*="next"]:not(.disabled)'
      ];
      
      for (const sel of nextSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null && !btn.classList.contains('disabled')) {
          console.log('[应届生求职网] 找到下一页');
          await HumanSimulator.clickElement(btn);
          return true;
        }
      }
      return false;
    },

    async scrollLoadMore() {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await HumanSimulator.delay(1500, 2500);
      return document.body.scrollHeight > scrollHeight;
    }
  };

  // ==================== 自动投递主逻辑 ====================
  // 获取当前平台的解析器
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
      console.log('[自动投递] 已经在运行中');
      return;
    }

    const parser = getCurrentParser();
    if (!parser) {
      sendApplyStatus('当前页面不支持，请在招聘网站上使用', 'error');
      return;
    }

    isApplyRunning = true;
    stopApplyRequested = false;

    const platformNames = {
      boss: 'Boss直聘',
      zhilian: '智联招聘',
      job51: '51job前程无忧',
      yjs: '应届生求职网'
    };

    console.log(`%c[自动投递] 开始自动投递 - ${platformNames[currentPlatform]}`, 'color: #51cf66; font-weight: bold;');
    updateDebugPanel('status', '运行中...');
    sendApplyStatus(`已连接${platformNames[currentPlatform]}，开始投递...`, 'running');

    let currentPage = 1;
    let processedCount = 0;
    let noMoreContent = false;

    while (isApplyRunning && !stopApplyRequested && !noMoreContent) {
      console.log(`\n===== [自动投递] 第 ${currentPage} 页 =====`);
      updateDebugPanel('page', currentPage.toString());
      
      // 等待页面加载
      await HumanSimulator.delay(1500, 2500);
      
      // 获取职位列表
      const jobItems = parser.getJobListItems();
      
      if (jobItems.length === 0) {
        console.log('[自动投递] 未找到职位，尝试滚动加载...');
        
        // 尝试滚动加载
        const loaded = await parser.scrollLoadMore();
        if (loaded) {
          continue; // 重新获取
        }
        
        console.log('[自动投递] 无法加载更多内容');
        noMoreContent = true;
        break;
      }

      console.log(`[自动投递] 本页共 ${jobItems.length} 个职位`);

      // 处理每个职位
      for (let i = 0; i < jobItems.length && !stopApplyRequested; i++) {
        const jobItem = jobItems[i];
        
        // 滚动到当前职位
        await HumanSimulator.scrollToElement(jobItem, { offsetY: 150 });
        await HumanSimulator.delay(500, 1000);
        
        // 更新统计
        stats.scanned++;
        updateStats();
        updateDebugPanel('scanned', stats.scanned.toString());

        // 解析职位信息
        const jobInfo = parser.parseJobItem(jobItem);
        if (!jobInfo || !jobInfo.title) {
          console.log(`[自动投递] 第 ${i+1} 个职位解析失败，跳过`);
          continue;
        }

        console.log(`[自动投递] [${i+1}/${jobItems.length}] ${jobInfo.title} - ${jobInfo.company} | ${jobInfo.salary}`);
        updateDebugPanel('current', jobInfo.title);

        // 检查是否已经沟通过
        if (parser.hasCommunicated(jobItem)) {
          console.log('[自动投递] 已投递，跳过');
          continue;
        }

        // 计算匹配度
        const matchResult = calculateMatchScore(jobInfo);
        console.log(`[自动投递] 匹配度: ${matchResult.score}% | ${matchResult.reasons.join(', ')}`);

        if (matchResult.score < config.minMatchScore) {
          console.log(`[自动投递] 匹配度低于阈值 ${config.minMatchScore}%，跳过`);
          continue;
        }

        // 更新匹配统计
        stats.matched++;
        updateStats();
        updateDebugPanel('matched', stats.matched.toString());

        // 点击投递
        sendApplyStatus(`正在投递: ${jobInfo.title.substring(0, 15)}...`, 'running');
        
        const result = await parser.clickApplyButton(jobItem);
        
        if (result.success) {
          stats.applied++;
          updateStats();
          updateDebugPanel('applied', stats.applied.toString());
          sendApplyStatus(`✓ 已投递: ${jobInfo.title.substring(0, 15)}`, 'success');
          console.log(`%c[自动投递] ✓ 投递成功: ${jobInfo.title}`, 'color: #51cf66;');
          processedCount++;
          
          // 等待一会再返回列表
          await HumanSimulator.delay(2000, 3000);
          
          // 返回列表页（如果跳转了）
          if (document.querySelector('.job-card-wrapper') === null && 
              document.querySelector('[class*="joblist"]') === null &&
              document.querySelector('[class*="job-list"]') === null) {
            history.back();
            await HumanSimulator.delay(1500, 2500);
          }
        } else {
          console.log(`[自动投递] 投递失败: ${result.error}`);
        }

        // 投递间隔
        const interval = (config.interval || 5) * 1000;
        const randomExtra = Math.random() * 3000;
        await HumanSimulator.delay(interval, interval + randomExtra);
      }

      // 翻页或滚动加载
      const hasNext = await parser.goToNextPage();
      if (hasNext) {
        currentPage++;
        await HumanSimulator.delay(2000, 4000);
      } else {
        // 尝试滚动加载
        const scrolled = await parser.scrollLoadMore();
        if (scrolled) {
          await HumanSimulator.delay(1500, 2500);
        } else {
          noMoreContent = true;
        }
      }
    }

    isApplyRunning = false;
    updateDebugPanel('status', '已停止');
    sendApplyStatus(
      `投递完成！扫描 ${stats.scanned} 个，匹配 ${stats.matched} 个，投递 ${stats.applied} 个`, 
      'success'
    );
    console.log('%c[自动投递] 任务完成', 'color: #667eea; font-weight: bold;');
  }

  function stopAutoApply() {
    stopApplyRequested = true;
    isApplyRunning = false;
    console.log('[自动投递] 已停止');
    updateDebugPanel('status', '已停止');
    sendApplyStatus('投递已停止', 'info');
  }

  // ==================== 统计和状态 ====================
  function updateStats() {
    chrome.storage.local.set({ stats });
    chrome.runtime.sendMessage({ type: 'STATS_UPDATED', stats });
  }

  function sendApplyStatus(status, statusType) {
    chrome.runtime.sendMessage({ type: 'APPLY_STATUS', status, statusType });
  }

  // ==================== 调试面板 ====================
  function injectDebugPanel() {
    // 创建悬浮调试面板
    const panel = document.createElement('div');
    panel.id = 'auto-apply-debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      cursor: move;
      user-select: none;
      min-width: 180px;
      display: none;
    `;
    
    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #667eea;">
        📮 自动投递助手
      </div>
      <div>状态: <span id="debug-status">待机</span></div>
      <div>当前页: <span id="debug-page">-</span></div>
      <div>已扫描: <span id="debug-scanned">0</span></div>
      <div>已匹配: <span id="debug-matched">0</span></div>
      <div>已投递: <span id="debug-applied">0</span></div>
      <div style="margin-top: 6px; font-size: 11px; color: #aaa;">
        当前职位: <span id="debug-current">-</span>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // 快捷键显示/隐藏: Ctrl+Shift+A
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        const panel = document.getElementById('auto-apply-debug-panel');
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      }
    });
    
    // 拖拽功能
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
    
    document.addEventListener('mouseup', function() {
      isDragging = false;
    });
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
        // 确保配置已加载
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

      case 'CONFIG_UPDATED':
        config = message.config;
        console.log('[自动投递助手] 配置已更新');
        sendResponse({ success: true });
        break;

      case 'START_AUTO_REPLY':
        // 暂不实现
        sendResponse({ success: false, error: '帮答功能开发中' });
        break;

      case 'STOP_AUTO_REPLY':
        sendResponse({ success: true });
        break;

      case 'REPLY_CONFIG_UPDATED':
        replyConfig = message.replyConfig;
        sendResponse({ success: true });
        break;

      case 'PING':
        sendResponse({ success: true, platform: currentPlatform });
        break;

      default:
        sendResponse({ success: false, error: '未知消息类型' });
    }

    return true;
  });

  // ==================== 启动 ====================
  init();

})();