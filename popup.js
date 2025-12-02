// 获取当前标签页
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// 执行脚本并获取结果
async function executeScript(func) {
  const tab = await getCurrentTab();
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: func
  });
  return results[0].result;
}

// 显示状态消息
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status show ${type}`;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}

// 更新选中数量
async function updateCount() {
  const count = await executeScript(() => {
    return window.douToolSelectedCount || 0;
  });
  document.getElementById('count').textContent = `已选择: ${count} 个作品`;
}

// 全选作品
document.getElementById('selectAll').addEventListener('click', async () => {
  try {
    const count = await executeScript(() => {
      if (typeof window.douToolSelectAll === 'function') {
        return window.douToolSelectAll();
      }
      return 0;
    });
    
    if (count > 0) {
      showStatus(`已选择 ${count} 个作品`, 'success');
      await updateCount();
    } else {
      showStatus('未找到可选择的作品,请确保在作品管理页面', 'error');
    }
  } catch (error) {
    showStatus('操作失败: ' + error.message, 'error');
  }
});

// 取消全选
document.getElementById('unselectAll').addEventListener('click', async () => {
  try {
    await executeScript(() => {
      if (typeof window.douToolUnselectAll === 'function') {
        window.douToolUnselectAll();
      }
    });
    
    showStatus('已取消全选', 'info');
    await updateCount();
  } catch (error) {
    showStatus('操作失败: ' + error.message, 'error');
  }
});

// 重新扫描作品
document.getElementById('refresh').addEventListener('click', async () => {
  try {
    showStatus('正在扫描页面...', 'info');
    
    const result = await executeScript(() => {
      // 先清除所有复选框
      document.querySelectorAll('.dou-tool-checkbox-wrapper').forEach(el => el.remove());
      
      // 重新初始化
      if (typeof window.douToolInit === 'function') {
        window.douToolInit();
        return document.querySelectorAll('.dou-tool-checkbox-wrapper').length;
      }
      return 0;
    });
    
    if (result > 0) {
      showStatus(`扫描完成,找到 ${result} 个作品`, 'success');
    } else {
      showStatus('未找到作品,请确认已进入作品管理页面', 'error');
    }
    
    await updateCount();
  } catch (error) {
    showStatus('扫描失败: ' + error.message, 'error');
  }
});

// 删除选中的作品
document.getElementById('deleteSelected').addEventListener('click', async () => {
  try {
    const count = await executeScript(() => {
      return window.douToolSelectedCount || 0;
    });
    
    if (count === 0) {
      showStatus('请先选择要删除的作品', 'error');
      return;
    }
    
    if (!confirm(`确定要删除选中的 ${count} 个作品吗?

⚠️ 此操作不可恢复!

建议:
1. 确认已备份重要内容
2. 先小范围测试
3. 删除过程中请不要关闭页面`)) {
      return;
    }
    
    // 显示进度条
    const progressEl = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    progressEl.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '正在准备删除...';
    
    showStatus('正在删除...请耐心等待', 'info');
    
    // 禁用按钮
    const deleteBtn = document.getElementById('deleteSelected');
    deleteBtn.disabled = true;
    deleteBtn.textContent = '删除中...';
    
    // 启动删除进程(不等待结果)
    await executeScript(() => {
      if (typeof window.douToolDeleteSelected === 'function') {
        // 异步执行删除,不阻塞
        window.douToolDeleteSelected().then(result => {
          console.log('[抖音删除工具] 删除完成:', result);
          window.douToolDeleteResult = result;
        }).catch(error => {
          console.error('[抖音删除工具] 删除错误:', error);
          window.douToolDeleteResult = { success: false, message: error.message };
        });
      }
      return true;
    });
    
    // 轮询检查进度和结果
    let checkCount = 0;
    const maxChecks = 300; // 最多5分钟
    
    const checkInterval = setInterval(async () => {
      checkCount++;
      
      const status = await executeScript(() => {
        return {
          remaining: window.douToolSelectedCount || 0,
          result: window.douToolDeleteResult || null
        };
      });
      
      const deleted = count - status.remaining;
      const percent = Math.min(99, Math.round((deleted / count) * 100));
      
      progressBar.style.width = percent + '%';
      progressText.textContent = `已删除 ${deleted}/${count} 个作品`;
      
      // 检查是否完成
      if (status.result) {
        clearInterval(checkInterval);
        
        // 恢复按钮
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️ 删除选中的作品';
        
        if (status.result.success) {
          progressBar.style.width = '100%';
          progressText.textContent = `完成! ${status.result.message}`;
          showStatus(`✅ ${status.result.message}`, 'success');
          
          setTimeout(() => {
            progressEl.style.display = 'none';
          }, 3000);
        } else {
          progressEl.style.display = 'none';
          showStatus(status.result.message || '删除失败', 'error');
        }
        
        // 清除结果
        await executeScript(() => {
          delete window.douToolDeleteResult;
        });
        
        await updateCount();
      } else if (checkCount >= maxChecks) {
        // 超时
        clearInterval(checkInterval);
        progressEl.style.display = 'none';
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️ 删除选中的作品';
        showStatus('删除超时,请刷新页面检查', 'error');
      }
    }, 1000);
    
  } catch (error) {
    document.getElementById('progress').style.display = 'none';
    const deleteBtn = document.getElementById('deleteSelected');
    deleteBtn.disabled = false;
    deleteBtn.textContent = '🗑️ 删除选中的作品';
    showStatus('删除失败: ' + error.message, 'error');
  }
});

// 页面加载时更新计数
updateCount();

// 定期更新计数
setInterval(updateCount, 2000);
