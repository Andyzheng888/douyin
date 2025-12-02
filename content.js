// 抖音创作者中心批量删除工具
(function() {
  'use strict';
  
  // 存储选中的作品元素和数据
  let selectedItems = new Set();
  let videoCards = [];
  
  // ⭐ 使用外部存储记录需要删除的作品数量(不依赖DOM)
  let pendingDeleteCount = 0;
  
  // 标记作品为选中状态
  function markItemAsSelected(item, selected) {
    if (selected) {
      item.dataset.douSelected = 'true';
    } else {
      delete item.dataset.douSelected;
    }
  }
  
  // 等待元素加载
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        return resolve(element);
      }
      
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error('等待元素超时'));
      }, timeout);
    });
  }
  
 // 查找作品卡片容器
  function getVideoItems() {
    console.log('[抖音删除工具] 开始查找作品列表...');
    
    // 方法1: 通过video-card class查找(最准确)
    let items = document.querySelectorAll('div[class*="video-card"]');
    if (items.length > 0) {
      // 过滤掉子元素,只保留最外层的卡片
      const cards = Array.from(items).filter(item => {
        // 确保是最外层卡片(包含video-card-content)
        return item.querySelector('[class*="video-card-content"]') !== null;
      });
      
      if (cards.length > 0) {
        console.log(`[抖音删除工具] 方法1成功: 通过video-card找到 ${cards.length} 个作品`);
        return cards;
      }
    }
    
    // 方法2: 通过封面图片查找
    const covers = document.querySelectorAll('[class*="video-card-cover"]');
    if (covers.length > 0) {
      const cards = Array.from(covers).map(cover => {
        // 向上找到卡片容器
        let parent = cover;
        for (let i = 0; i < 3; i++) {
          parent = parent.parentElement;
          if (parent && parent.className.includes('video-card')) {
            return parent;
          }
        }
        return null;
      }).filter(card => card !== null);
      
      if (cards.length > 0) {
        console.log(`[抖音删除工具] 方法2成功: 通过封面找到 ${cards.length} 个作品`);
        return [...new Set(cards)]; // 去重
      }
    }
    
    // 方法3: 通过包含"删除作品"按钮的元素查找
    const deleteButtons = Array.from(document.querySelectorAll('span')).filter(span => 
      span.textContent.trim() === '删除作品'
    );
    
    if (deleteButtons.length > 0) {
      const cards = deleteButtons.map(btn => {
        // 向上找到video-card容器
        let parent = btn;
        for (let i = 0; i < 10; i++) {
          parent = parent.parentElement;
          if (parent && parent.className.includes('video-card')) {
            return parent;
          }
        }
        return null;
      }).filter(card => card !== null);
      
      if (cards.length > 0) {
        console.log(`[抖音删除工具] 方法3成功: 通过删除按钮找到 ${cards.length} 个作品`);
        return [...new Set(cards)];
      }
    }
    
    console.error('[抖音删除工具] 所有方法都失败了,未找到作品列表');
    console.log('[抖音删除工具] 调试信息:');
    console.log('  - 页面URL:', window.location.href);
    console.log('  - 页面标题:', document.title);
    console.log('  - 尝试手动执行: document.querySelectorAll("[class*=\"video-card\"]").length');
    
    return [];
  }
  
  // 查找删除按钮或更多操作按钮
  function findActionButton(item) {
    console.log('[抖音删除工具] 开始查找操作按钮...');
    console.log('[抖音删除工具] 卡片HTML预览:', item.innerHTML.substring(0, 300));
    
    // 方法1: 直接查找"删除作品"按钮(最准确)
    const deleteButtons = Array.from(item.querySelectorAll('div, button, span, a')).filter(el => {
      const text = el.textContent.trim();
      const hasDeleteText = text === '删除作品' || (text.includes('删除') && text.length < 10);
      if (hasDeleteText) {
        console.log(`[抖音删除工具] 找到包含删除文本的元素: "${text}"`);
      }
      return hasDeleteText;
    });
    
    for (const btn of deleteButtons) {
      // 查找可点击的父元素
      const clickable = btn.closest('div[style*="cursor: pointer"], button, a, [role="button"]');
      if (clickable) {
        console.log('[抖音删除工具] ✅ 方法1成功: 找到删除作品按钮');
        return { type: 'delete', element: clickable };
      }
      
      // 如果元素本身可点击
      const style = getComputedStyle(btn);
      if (style.cursor === 'pointer' || btn.onclick) {
        console.log('[抖音删除工具] ✅ 方法1成功: 元素本身可点击');
        return { type: 'delete', element: btn };
      }
    }
    
    // 方法2: 通过class查找操作按钮
    const buttonClasses = [
      'div[class*="ghost-btn"]',
      'div[class*="op-btn"]',
      'div[class*="operate"]',
      'div[class*="action"]'
    ];
    
    for (const selector of buttonClasses) {
      const buttons = item.querySelectorAll(selector);
      for (const btn of buttons) {
        if (btn.textContent.includes('删除')) {
          console.log(`[抖音删除工具] ✅ 方法2成功: 通过class找到删除按钮 (${selector})`);
          return { type: 'delete', element: btn };
        }
      }
    }
    
    // 方法3: 查找所有SVG图标,找删除相关的
    const svgs = item.querySelectorAll('svg');
    for (const svg of svgs) {
      const parent = svg.closest('div[style*="cursor: pointer"], button, [role="button"]');
      if (parent && parent.textContent.includes('删除')) {
        console.log('[抖音删除工具] ✅ 方法3成功: 通过SVG找到删除按钮');
        return { type: 'delete', element: parent };
      }
    }
    
    // 方法4: 遍历所有可点击元素,检查文本内容
    const allClickable = item.querySelectorAll('[style*="cursor: pointer"], button, a, [role="button"]');
    console.log(`[抖音删除工具] 方法4: 找到 ${allClickable.length} 个可点击元素`);
    
    for (const el of allClickable) {
      const text = el.textContent.trim();
      if (text.includes('删除作品') || (text.includes('删除') && !text.includes('编辑') && text.length < 20)) {
        console.log(`[抖音删除工具] ✅ 方法4成功: 找到删除按钮 (文本: "${text}")`);
        return { type: 'delete', element: el };
      }
    }
    
    console.error('[抖音删除工具] ❌ 所有方法都未找到删除按钮');
    console.log('[抖音删除工具] 调试信息:');
    console.log('  - 卡片内所有button:', item.querySelectorAll('button').length);
    console.log('  - 卡片内所有可点击元素:', item.querySelectorAll('[style*="cursor"]').length);
    console.log('  - 卡片内包含"删除"的文本:', 
      Array.from(item.querySelectorAll('*'))
        .filter(el => el.textContent.includes('删除'))
        .map(el => `${el.tagName}: "${el.textContent.trim().substring(0, 30)}"`)
    );
    
    return null;
  }
  
  // 添加复选框到作品项
  function addCheckbox(item, index) {
    if (!item || item.querySelector('.dou-tool-checkbox-wrapper')) {
      return; // 已经添加过了
    }
    
    // 创建复选框容器
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.className = 'dou-tool-checkbox-wrapper';
    checkboxWrapper.style.cssText = `
      position: absolute !important;
      top: 8px !important;
      left: 8px !important;
      z-index: 99999 !important;
      background: rgba(255, 255, 255, 0.95) !important;
      border-radius: 4px !important;
      padding: 4px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'dou-tool-checkbox';
    checkbox.style.cssText = `
      width: 18px !important;
      height: 18px !important;
      cursor: pointer !important;
      accent-color: #fe2c55 !important;
      margin: 0 !important;
      display: block !important;
    `;
    
    checkbox.dataset.index = index;
    
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      
      console.log(`[抖音删除工具] 复选框状态变更: ${isChecked ? '选中' : '取消选中'}`);
      
      if (isChecked) {
        selectedItems.add(item);
        markItemAsSelected(item, true); // 标记选中
        item.style.outline = '3px solid #fe2c55';
        item.style.outlineOffset = '-3px';
        checkboxWrapper.style.background = '#fe2c55';
        console.log(`[抖音删除工具] ✅ 已选中作品, 当前总数: ${selectedItems.size}`);
      } else {
        selectedItems.delete(item);
        markItemAsSelected(item, false); // 取消标记
        item.style.outline = '';
        item.style.outlineOffset = '';
        checkboxWrapper.style.background = 'rgba(255, 255, 255, 0.95)';
        console.log(`[抖音删除工具] ❌ 已取消选中, 当前总数: ${selectedItems.size}`);
      }
      updateSelectedCount();
    });
    
    // 防止点击复选框时触发卡片点击
    checkboxWrapper.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 直接点击checkbox元素,让浏览器处理默认行为
      checkbox.click();
    });
    
    // 直接点击checkbox时也要阻止事件冒泡
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    checkboxWrapper.appendChild(checkbox);
    
    // 确保父元素有相对定位
    const currentPosition = getComputedStyle(item).position;
    if (currentPosition === 'static') {
      item.style.position = 'relative';
    }
    
    // 尝试插入到最前面
    if (item.firstChild) {
      item.insertBefore(checkboxWrapper, item.firstChild);
    } else {
      item.appendChild(checkboxWrapper);
    }
    
    console.log(`[抖音删除工具] 已为第 ${index + 1} 个作品添加复选框`);
  }
  
  // 初始化复选框
  function initCheckboxes() {
    const items = getVideoItems();
    console.log(`[抖音删除工具] 找到 ${items.length} 个作品项`);
    
    if (items.length === 0) {
      console.warn('[抖音删除工具] 未找到作品列表,请确认已进入内容管理页面');
      // 输出页面结构信息帮助调试
      console.log('[抖音删除工具] 当前页面URL:', window.location.href);
      console.log('[抖音删除工具] 页面标题:', document.title);
    }
    
    items.forEach((item, index) => {
      addCheckbox(item, index);
    });
    
    videoCards = items;
  }
  
  // 更新选中数量
  function updateSelectedCount() {
    window.douToolSelectedCount = selectedItems.size;
  }
  
  // 全选功能
  window.douToolSelectAll = function() {
    const checkboxes = document.querySelectorAll('.dou-tool-checkbox');
    console.log(`[抖音删除工具] 开始全选, 找到 ${checkboxes.length} 个复选框`);
    
    checkboxes.forEach(cb => {
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    console.log(`[抖音删除工具] 已选择 ${selectedItems.size} 个作品`);
    return checkboxes.length;
  };
  
  // 取消全选
  window.douToolUnselectAll = function() {
    const checkboxes = document.querySelectorAll('.dou-tool-checkbox');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        cb.checked = false;
        cb.dispatchEvent(new Event('change'));
      }
    });
    selectedItems.clear();
    updateSelectedCount();
  };
  
  // 删除选中的作品
  window.douToolDeleteSelected = async function() {
    console.log('[抖音删除工具] 开始批量删除流程...');
    
    // ⭐ 关键: 在开始前记录需要删除的数量
    const initialSelectedCards = document.querySelectorAll('[data-dou-selected="true"]');
    pendingDeleteCount = initialSelectedCards.length;
    
    if (pendingDeleteCount === 0) {
      return { success: false, message: '没有选中的作品' };
    }
    
    console.log(`[抖音删除工具] ⭐ 总共需要删除 ${pendingDeleteCount} 个作品`);
    
    let successCount = 0;
    let failCount = 0;
    let totalAttempts = 0;
    const maxAttempts = 100; // 最大尝试次数,防止死循环
    
    // 持续删除,直到完成所有任务
    while (successCount + failCount < pendingDeleteCount && totalAttempts < maxAttempts) {
      totalAttempts++;
      
      // 查找当前页面上的第一个作品(任意一个)
      const allCards = document.querySelectorAll('[class*="video-card"][class*="video-card-new"]');
      
      if (allCards.length === 0) {
        console.log('[抖音删除工具] ⚠️ 页面上没有作品了,等待页面刷新...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      const item = allCards[0]; // 总是删除第一个
      
      console.log(`[抖音删除工具] ----- 第 ${totalAttempts} 次尝试 (已删${successCount}, 失败${failCount}, 目标${pendingDeleteCount}) -----`);
      
      if (!item) {
        console.error('[抖音删除工具] 无法找到作品,跳过');
        failCount++;
        continue;
      }
      
      try {
        // 获取作品标题用于日志
        const title = item.querySelector('[class*="title"]')?.textContent.substring(0, 30) || '未知标题';
        console.log(`[抖音删除工具] 当前作品: ${title}`);
        
        // 滚动到元素可见
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 查找删除按钮
        const actionBtn = findActionButton(item);
        
        if (!actionBtn) {
          console.error('[抖音删除工具] 未找到删除按钮,取消选中');
          checkbox.checked = false;
          failCount++;
          continue;
        }
        
        console.log('[抖音删除工具] 准备点击删除按钮');
        
        // 点击删除按钮
        try {
          actionBtn.element.click();
          console.log('[抖音删除工具] ✅ 已点击删除按钮');
        } catch (e) {
          console.log('[抖音删除工具] 普通点击失败,尝试触发事件');
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          actionBtn.element.dispatchEvent(clickEvent);
        }
        
        // 等待确认对话框出现
        await new Promise(resolve => setTimeout(resolve, 800));
        
        console.log('[抖音删除工具] 查找确认对话框...');
        
        // 查找确认按钮
        let confirmBtn = null;
        
        // 方法1: 查找所有可见的按钮,匹配文本
        const allVisibleButtons = Array.from(document.querySelectorAll('button, div[role="button"], a, span[role="button"]')).filter(btn => {
          // 确保按钮可见
          const style = getComputedStyle(btn);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
        
        console.log(`[抖音删除工具] 找到 ${allVisibleButtons.length} 个可见按钮`);
        
        for (const btn of allVisibleButtons) {
          const text = btn.textContent.trim();
          // 匹配多种可能的确认文本
          if (text === '确定' || text === '删除' || text === '确认' || 
              text === '确认删除' || text === 'OK' || text === 'Delete' ||
              text === '是' || text === '继续') {
            console.log(`[抖音删除工具] 找到疑似确认按钮: "${text}"`);
            
            // 检查按钮是否在对话框/模态框中
            const inModal = btn.closest('.semi-modal, [class*="modal"], [class*="Modal"], [role="dialog"], [class*="dialog"]');
            if (inModal) {
              confirmBtn = btn;
              console.log(`[抖音删除工具] ✅ 确认按钮在模态框中: "${text}"`);
              break;
            } else {
              console.log(`[抖音删除工具] ⚠️ 按钮不在模态框中,跳过`);
            }
          }
        }
        
        // 方法2: 如果还没找到,查找primary按钮
        if (!confirmBtn) {
          console.log('[抖音删除工具] 方法1未找到,尝试查找primary按钮...');
          const primarySelectors = [
            '.semi-modal button[class*="primary"]',
            '.semi-modal button[class*="Primary"]',
            '[class*="modal"] button[class*="primary"]',
            '[class*="Modal"] button[class*="primary"]',
            '[role="dialog"] button[class*="primary"]',
            '.semi-modal-footer button:last-child',
            '[class*="modal-footer"] button:last-child'
          ];
          
          for (const selector of primarySelectors) {
            const btn = document.querySelector(selector);
            if (btn) {
              confirmBtn = btn;
              console.log(`[抖音删除工具] ✅ 通过选择器找到primary按钮: ${selector}`);
              break;
            }
          }
        }
        
        // 方法3: 查找所有包含"确定"类文本的元素
        if (!confirmBtn) {
          console.log('[抖音删除工具] 方法2未找到,尝试全局搜索...');
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            if (el.children.length === 0) { // 只检查叶子节点
              const text = el.textContent.trim();
              if (text === '确定' || text === '删除') {
                const clickable = el.closest('button, [role="button"], a');
                if (clickable) {
                  confirmBtn = clickable;
                  console.log(`[抖音删除工具] ✅ 通过全局搜索找到按钮: "${text}"`);
                  break;
                }
              }
            }
          }
        }
        
        // 输出调试信息
        if (!confirmBtn) {
          console.error('[抖音删除工具] ❌ 所有方法都未找到确认按钮');
          console.log('[抖音删除工具] 当前页面所有模态框:');
          const modals = document.querySelectorAll('.semi-modal, [class*="modal"], [role="dialog"]');
          modals.forEach((modal, idx) => {
            console.log(`  模态框 ${idx + 1}:`, modal.innerHTML.substring(0, 200));
          });
        }
        
        if (confirmBtn) {
          try {
            confirmBtn.click();
            console.log('[抖音删除工具] ✅ 已点击确认按钮');
          } catch (e) {
            const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            confirmBtn.dispatchEvent(clickEvent);
            console.log('[抖音删除工具] ✅ 通过事件触发确认');
          }
          
          successCount++;
          console.log(`[抖音删除工具] ✅✅✅ 删除成功! 已完成 ${successCount}/${pendingDeleteCount}`);
          
          // 等待删除完成和页面更新
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          console.log(`[抖音删除工具] ⭐ 继续下一个...还需删除 ${pendingDeleteCount - successCount - failCount} 个`);
          
        } else {
          console.error('[抖音删除工具] ❗ 未找到确认按钮');
          // 尝试关闭弹窗
          const closeBtn = document.querySelector('[class*="modal-close"], [aria-label="Close"]');
          if (closeBtn) {
            closeBtn.click();
            console.log('[抖音删除工具] 已关闭弹窗');
          }
          failCount++;
        }
      } catch (error) {
        console.error('[抖音删除工具] 删除失败:', error);
        failCount++;
      }
    }
    
    // 清空所有剩余的选中状态
    document.querySelectorAll('.dou-tool-checkbox:checked').forEach(cb => {
      cb.checked = false;
    });
    selectedItems.clear();
    updateSelectedCount();
    
    console.log(`[抖音删除工具] ===== 删除完成: 成功 ${successCount} 个, 失败 ${failCount} 个 =====`);
    
    return {
      success: true,
      count: successCount,
      failed: failCount,
      message: `成功删除 ${successCount} 个,失败 ${failCount} 个`
    };
  };
  
  // 监听页面变化,自动添加复选框
  const observer = new MutationObserver((mutations) => {
    // 检查是否有新的作品项添加
    const hasNewItems = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType === 1) { // Element node
          return node.matches && (
            node.matches('[class*="video-item"]') ||
            node.matches('[class*="content-item"]') ||
            node.querySelector('[class*="video-item"]') ||
            node.querySelector('[class*="content-item"]')
          );
        }
        return false;
      });
    });
    
    if (hasNewItems) {
      setTimeout(initCheckboxes, 500);
    }
  });
  
  // 页面加载完成后初始化
  function init() {
    console.log('[抖音删除工具] 开始初始化...');
    initCheckboxes();
    
    // 如果第一次没找到,3秒后再试一次
    setTimeout(() => {
      const currentCount = document.querySelectorAll('.dou-tool-checkbox-wrapper').length;
      if (currentCount === 0) {
        console.log('[抖音删除工具] 第一次未找到作品,重试...');
        initCheckboxes();
      }
    }, 3000);
  }
  
  // 暴露初始化函数供手动调用
  window.douToolInit = init;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[抖音删除工具] DOM加载完成,准备初始化...');
      setTimeout(init, 2000);
    });
  } else {
    console.log('[抖音删除工具] 页面已加载,立即初始化...');
    setTimeout(init, 2000);
  }
  
  // 开始监听
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 初始化选中计数
  window.douToolSelectedCount = 0;
  
  console.log('[抖音删除工具] 插件已加载');
  console.log('[抖音删除工具] 使用说明:');
  console.log('  1. 点击浏览器工具栏的插件图标');
  console.log('  2. 在弹出面板中点击"全选当前页作品"');
  console.log('  3. 点击"删除选中的作品"开始删除');
  console.log('  4. 如有问题请查看控制台日志');
})();
