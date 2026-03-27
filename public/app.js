// 全局状态
let currentUser = null;
let isAdmin = false;
let isUserMode = false; // 管理员是否切换到用户模式
let ws = null;
let posts = [];
let selectedAvatar = '';
let selectedGender = '';
let selectedAge = '';

const API_URL = window.location.origin;
const WS_URL = window.location.origin.replace('http', 'ws');

// 初始化
window.onload = function() {
    const savedUser = localStorage.getItem('currentUser');
    const savedAdmin = localStorage.getItem('isAdmin');
    
    if (savedAdmin === 'true') {
        // 恢复管理员状态
        isAdmin = true;
        showAdminInfo();
    } else if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showUserInfo();
    } else {
        setTimeout(() => {
            showRoleModal();
        }, 500);
    }
    
    connectWebSocket();
    loadPosts();
    loadStats();
};

// WebSocket连接
let wsHeartbeatInterval = null;

function connectWebSocket() {
    updateConnectionStatus('connecting');
    
    // 清除之前的心跳定时器
    if (wsHeartbeatInterval) {
        clearInterval(wsHeartbeatInterval);
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ WebSocket已连接');
        updateConnectionStatus('connected');
        
        // 启动心跳机制，每 30 秒发送一次 ping
        wsHeartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', time: Date.now() }));
            }
        }, 30000);
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        // 忽略心跳响应
        if (message.type === 'pong') return;
        
        switch(message.type) {
            case 'STATS_UPDATE':
                updateStatsUI(message.data);
                highlightElement('statsCard');
                break;
            case 'NEW_COMMENT':
                addCommentRealtime(message.data);
                break;
            case 'LIKE_UPDATE':
                updateLikeRealtime(message.data);
                break;
            case 'NEW_POST':
                addPostRealtime(message.data);
                showToast('🆕 有新帖子！');
                break;
        }
    };
    
    ws.onclose = () => {
        console.log('❌ WebSocket断开，3秒后重连');
        updateConnectionStatus('disconnected');
        if (wsHeartbeatInterval) {
            clearInterval(wsHeartbeatInterval);
        }
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (err) => {
        console.error('WebSocket错误:', err);
    };
}

function updateConnectionStatus(status) {
    const el = document.getElementById('connStatus');
    el.className = 'connection-status ' + status;
    
    const texts = {
        connected: '● 实时连接中',
        disconnected: '● 离线（重连中...）',
        connecting: '● 连接中...'
    };
    el.textContent = texts[status];
}

// ========== 身份选择弹窗 ==========
function showRoleModal() {
    document.getElementById('roleModal').classList.add('active');
}

function closeRoleModal() {
    document.getElementById('roleModal').classList.remove('active');
}

function selectAdminRole() {
    closeRoleModal();
    showAdminLogin();
}

function selectUserRole() {
    closeRoleModal();
    showRegister();
}

// ========== 用户退出登录功能 ==========
function logout() {
    if (!confirm('确定要退出登录吗？您的评论和点赞数据将保留。')) {
        return;
    }
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAdmin');
    currentUser = null;
    isAdmin = false;
    isUserMode = false;
    
    document.getElementById('userCard').style.display = 'none';
    document.getElementById('adminCard').style.display = 'none';
    document.getElementById('statsCard').style.display = 'none';
    document.getElementById('guestCard').style.display = 'block';
    document.getElementById('postCreator').style.display = 'none';
    
    renderPosts();
    showToast('👋 已退出登录');
    
    setTimeout(() => {
        showRoleModal();
    }, 500);
}

// ========== 登记功能 ==========
function selectAvatar(el) {
    document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    selectedAvatar = el.dataset.avatar;
    checkFormValid();
}

function generateRandomId() {
    const adjectives = ['快乐', '阳光', '可爱', '聪明', '勇敢', '温柔', '机智', '善良'];
    const nouns = ['小猫', '小狗', '小兔', '小熊', '小鸟', '小鱼', '小鹿', '小马'];
    const id = adjectives[Math.floor(Math.random() * adjectives.length)] + 
               nouns[Math.floor(Math.random() * nouns.length)] + 
               Math.floor(Math.random() * 1000);
    document.getElementById('userId').value = id;
    checkFormValid();
}

function selectGender(el) {
    document.querySelectorAll('.gender-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    selectedGender = el.dataset.gender;
    checkFormValid();
}

function selectAge(el) {
    document.querySelectorAll('.age-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    selectedAge = el.dataset.age;
    checkFormValid();
}

function checkFormValid() {
    const userId = document.getElementById('userId').value.trim();
    const isValid = selectedAvatar && userId && selectedGender && selectedAge;
    document.getElementById('submitBtn').disabled = !isValid;
}

document.getElementById('userId')?.addEventListener('input', checkFormValid);

async function submitRegister() {
    const userId = document.getElementById('userId').value.trim();
    
    const userData = {
        avatar: selectedAvatar,
        userId: userId,
        gender: selectedGender,
        age: selectedAge
    };
    
    try {
        const res = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const result = await res.json();
        
        if (result.success) {
            currentUser = { ...userData, id: result.user.id };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            closeRegister(true); // 登记成功，不显示身份选择弹窗
            showUserInfo();
            showToast('🎉 欢迎加入小红薯！');
        } else {
            showToast('❌ ' + result.error);
        }
    } catch (err) {
        showToast('❌ 网络错误，请重试');
        console.error(err);
    }
}

function showUserInfo() {
    document.getElementById('guestCard').style.display = 'none';
    document.getElementById('userCard').style.display = 'block';
    document.getElementById('adminCard').style.display = 'none';
    document.getElementById('statsCard').style.display = 'block';
    document.getElementById('clearStatsBtn').style.display = 'none';
    
    document.getElementById('displayAvatar').textContent = currentUser.avatar;
    document.getElementById('displayName').textContent = currentUser.userId;
    document.getElementById('displayMeta').textContent = `${currentUser.gender} · ${currentUser.age}`;
    
    // 重新渲染帖子，更新评论输入框状态
    renderPosts();
}

function showAdminInfo() {
    document.getElementById('guestCard').style.display = 'none';
    document.getElementById('userCard').style.display = 'none';
    document.getElementById('adminCard').style.display = 'block';
    document.getElementById('statsCard').style.display = 'block';
    document.getElementById('clearStatsBtn').style.display = 'inline-block';
    
    // 重新渲染帖子
    renderPosts();
}

// 管理员切换到用户模式（用于评论互动）
function switchToUserMode() {
    if (!currentUser) {
        showToast('❌ 您还没有用户身份，请先登记为用户');
        return;
    }
    isUserMode = true;
    document.getElementById('adminCard').style.display = 'none';
    document.getElementById('userCard').style.display = 'block';
    document.getElementById('statsCard').style.display = 'none';
    document.getElementById('postCreator').style.display = 'none';
    
    // 添加切换回管理模式的按钮
    const userCard = document.getElementById('userCard');
    let switchBtn = document.getElementById('switchToAdminBtn');
    if (!switchBtn) {
        switchBtn = document.createElement('button');
        switchBtn.id = 'switchToAdminBtn';
        switchBtn.className = 'register-btn';
        switchBtn.style.marginTop = '12px';
        switchBtn.textContent = '🔐 切换回管理模式';
        switchBtn.onclick = switchToAdminMode;
        userCard.insertBefore(switchBtn, userCard.querySelector('.logout-btn'));
    }
    switchBtn.style.display = 'block';
    
    showToast('👤 已切换到用户模式，现在可以评论和点赞了');
    renderPosts();
}

// 切换回管理模式（需要重新验证密码）
function switchToAdminMode() {
    // 隐藏用户卡片，显示管理员登录弹窗
    document.getElementById('userCard').style.display = 'none';
    document.getElementById('guestCard').style.display = 'block';
    document.getElementById('statsCard').style.display = 'none';
    document.getElementById('postCreator').style.display = 'none';
    document.getElementById('adminCard').style.display = 'none';
    
    // 重置状态
    isAdmin = false;
    isUserMode = false;
    
    // 显示管理员登录弹窗
    showAdminLogin();
    showToast('🔐 请重新验证管理员身份');
    renderPosts();
}

function showRegister() {
    selectedAvatar = '';
    selectedGender = '';
    selectedAge = '';
    document.getElementById('userId').value = '';
    document.querySelectorAll('.avatar-option, .gender-option, .age-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    checkFormValid();
    
    const modal = document.getElementById('registerModal');
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeRegister(skipRoleModal = false) {
    document.getElementById('registerModal').classList.remove('active');
    setTimeout(() => {
        if (!skipRoleModal) {
            showRoleModal();
        }
    }, 300);
}

// ========== 管理员功能 ==========
function showAdminLogin() {
    document.getElementById('adminModal').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('adminModal').classList.add('active');
        document.getElementById('adminPassword').focus();
    }, 10);
}

function closeAdminModal(skipRoleModal = false) {
    document.getElementById('adminModal').classList.remove('active');
    setTimeout(() => {
        document.getElementById('adminModal').style.display = 'none';
        document.getElementById('adminPassword').value = '';
        if (!skipRoleModal) {
            showRoleModal();
        }
    }, 300);
}

function verifyAdmin() {
    const pwd = document.getElementById('adminPassword').value;
    if (pwd === 'admin123') {
        isAdmin = true;
        isUserMode = false;
        localStorage.setItem('isAdmin', 'true'); // 保存管理员状态
        document.getElementById('postCreator').style.display = 'block';
        closeAdminModal(true); // 验证成功，不显示身份选择弹窗
        showAdminInfo();
        showToast('✅ 管理员验证成功！');
        loadPosts();
    } else {
        showToast('❌ 密码错误');
    }
}

// ========== 清除统计数据功能 ==========
async function clearStats() {
    if (!isAdmin) {
        showToast('❌ 只有管理员可以清除数据');
        return;
    }
    
    if (!confirm('⚠️ 警告：确定要清除所有用户统计数据吗？\n此操作不可恢复！')) {
        return;
    }
    
    if (!confirm('再次确认：您真的要清除所有统计数据吗？')) {
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/stats/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'admin123' })
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast('✅ 统计数据已清除');
            loadStats();
        } else {
            showToast('❌ ' + result.error);
        }
    } catch (err) {
        showToast('❌ 清除失败，请重试');
        console.error(err);
    }
}

// ========== 帖子功能 ==========
async function loadPosts() {
    try {
        const res = await fetch(`${API_URL}/api/posts`);
        posts = await res.json();
        renderPosts();
    } catch (err) {
        console.error('加载帖子失败:', err);
        document.getElementById('postsContainer').innerHTML = 
            '<div class="empty-state"><div class="emoji">😢</div><p>加载失败，请刷新重试</p></div>';
    }
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="emoji">📝</div>
                <p>还没有帖子，管理员快来发布第一条吧！</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    <div class="admin-badge">🍠</div>
                    <div class="author-info">
                        <h4>管理员</h4>
                        <span>${formatTime(post.created_at)}</span>
                    </div>
                </div>
                ${isAdmin ? `<button class="delete-btn" onclick="deletePost(${post.id})">🗑️</button>` : ''}
            </div>
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="post-actions">
                <div class="action-btn ${isLiked(post.id) ? 'active' : ''}" onclick="toggleLike(${post.id})" id="like-btn-${post.id}">
                    <span>${isLiked(post.id) ? '❤️' : '🤍'}</span>
                    <span id="like-count-${post.id}">${post.likes || 0}</span>
                </div>
                <div class="action-btn" onclick="toggleComments(${post.id})">
                    <span>💬</span>
                    <span id="comment-count-${post.id}">0</span>
                </div>
            </div>
            <div class="comments-section" id="comments-${post.id}">
                ${currentUser || isAdmin ? `
                    <div class="comment-input-area">
                        <input type="text" class="comment-input" id="comment-input-${post.id}" 
                               placeholder="写下你的评论..." 
                               onkeypress="if(event.key==='Enter')submitComment(${post.id})">
                        <button class="comment-submit" onclick="submitComment(${post.id})">发送</button>
                    </div>
                ` : '<p style="color:#999;font-size:14px;text-align:center;padding:20px;">请先登录后评论</p>'}
                <div class="comments-list" id="comments-list-${post.id}"></div>
            </div>
        </div>
    `).join('');
    
    posts.forEach(post => loadCommentCount(post.id));
}

function addPostRealtime(post) {
    posts.unshift(post);
    renderPosts();
}

async function publishPost() {
    const content = document.getElementById('postContent').value.trim();
    if (!content) {
        showToast('请输入内容');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, password: 'admin123' })
        });
        
        const result = await res.json();
        
        if (result.success) {
            document.getElementById('postContent').value = '';
            showToast('✅ 发布成功！');
        }
    } catch (err) {
        showToast('❌ 发布失败');
    }
}

async function deletePost(postId) {
    if (!confirm('确定要删除这条帖子吗？')) return;
    
    try {
        const res = await fetch(`${API_URL}/api/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'admin123' })
        });
        
        if (res.ok) {
            posts = posts.filter(p => p.id !== postId);
            renderPosts();
            showToast('已删除');
        }
    } catch (err) {
        showToast('❌ 删除失败');
    }
}

// ========== 评论功能 ==========
async function loadCommentCount(postId) {
    try {
        const res = await fetch(`${API_URL}/api/posts/${postId}/comments`);
        const comments = await res.json();
        const countEl = document.getElementById(`comment-count-${postId}`);
        if (countEl) countEl.textContent = comments.length;
    } catch (err) {
        console.error('加载评论数失败:', err);
    }
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    const isActive = section.classList.contains('active');
    
    if (!isActive) {
        section.classList.add('active');
        loadComments(postId);
    } else {
        section.classList.remove('active');
    }
}

async function loadComments(postId) {
    try {
        const res = await fetch(`${API_URL}/api/posts/${postId}/comments`);
        const comments = await res.json();
        
        const list = document.getElementById(`comments-list-${postId}`);
        list.innerHTML = comments.map(c => renderCommentItem(c)).join('');
        
        document.getElementById(`comment-count-${postId}`).textContent = comments.length;
    } catch (err) {
        console.error('加载评论失败:', err);
    }
}

function renderCommentItem(c) {
    // 如果没有头像（如管理员评论），显示默认头像
    const avatar = c.avatar || '🍠';
    const canReply = currentUser || isAdmin;
    // 如果有 parent_id，显示回复标识
    const replyTag = c.parent_id ? '<span class="reply-tag">回复</span> ' : '';
    return `
        <div class="comment-item ${c.parent_id ? 'reply-comment' : ''}" data-comment-id="${c.id}">
            <div class="comment-avatar">${avatar}</div>
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${c.user_id}</span>
                    ${replyTag}
                    <span class="comment-meta">${formatTime(c.created_at)}</span>
                </div>
                <div class="comment-text">${escapeHtml(c.content)}</div>
                <div class="comment-actions">
                    <span class="comment-action" onclick="likeComment(${c.id})">
                        🤍 ${c.likes || 0}
                    </span>
                    ${canReply ? `<span class="comment-action" onclick="showReplyInput(${c.post_id}, ${c.id})">↩️ 回复</span>` : ''}
                </div>
                <div class="reply-input-area" id="reply-input-${c.id}" style="display: none;">
                    <input type="text" class="comment-input reply-input" id="reply-text-${c.id}" 
                           placeholder="回复 ${escapeHtml(c.user_id)}..." 
                           onkeypress="if(event.key==='Enter')submitReply(${c.post_id}, ${c.id})">
                    <button class="comment-submit reply-submit" onclick="submitReply(${c.post_id}, ${c.id})">发送</button>
                    <button class="comment-submit reply-cancel" onclick="hideReplyInput(${c.id})">取消</button>
                </div>
            </div>
        </div>
    `;
}

async function submitComment(postId, parentId = null) {
    // 获取用户ID：普通用户、用户模式下的管理员、或直接使用管理员身份
    const userId = currentUser ? currentUser.userId : (isAdmin ? '管理员' : null);
    
    if (!userId) {
        showToast('请先登记');
        return;
    }
    
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;
    
    input.value = '';
    
    try {
        const res = await fetch(`${API_URL}/api/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                postId,
                userId: userId,
                content,
                parentId
            })
        });
    } catch (err) {
        showToast('❌ 评论失败');
    }
}

// 显示回复输入框
function showReplyInput(postId, commentId) {
    const replyArea = document.getElementById(`reply-input-${commentId}`);
    if (replyArea) {
        replyArea.style.display = 'flex';
        document.getElementById(`reply-text-${commentId}`).focus();
    }
}

// 隐藏回复输入框
function hideReplyInput(commentId) {
    const replyArea = document.getElementById(`reply-input-${commentId}`);
    if (replyArea) {
        replyArea.style.display = 'none';
        document.getElementById(`reply-text-${commentId}`).value = '';
    }
}

// 提交回复
async function submitReply(postId, parentId) {
    const userId = currentUser ? currentUser.userId : (isAdmin ? '管理员' : null);
    
    if (!userId) {
        showToast('请先登记');
        return;
    }
    
    const input = document.getElementById(`reply-text-${parentId}`);
    const content = input.value.trim();
    if (!content) return;
    
    try {
        const res = await fetch(`${API_URL}/api/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                postId,
                userId: userId,
                content,
                parentId
            })
        });
        
        if (res.ok) {
            hideReplyInput(parentId);
            // 重新加载评论以显示回复
            loadComments(postId);
        }
    } catch (err) {
        showToast('❌ 回复失败');
    }
}

function addCommentRealtime(data) {
    const { postId, comment } = data;
    
    // 如果是回复评论，不在这里添加（通过重新加载评论列表显示）
    if (comment.parent_id) {
        loadComments(postId);
        return;
    }
    
    const list = document.getElementById(`comments-list-${postId}`);
    
    if (list) {
        // 添加 post_id 到评论对象以便渲染回复功能
        const commentWithPostId = { ...comment, post_id: postId };
        const div = document.createElement('div');
        div.innerHTML = renderCommentItem(commentWithPostId);
        list.insertBefore(div.firstElementChild, list.firstChild);
        
        const countEl = document.getElementById(`comment-count-${postId}`);
        if (countEl) {
            countEl.textContent = parseInt(countEl.textContent) + 1;
        }
    }
}

// ========== 点赞功能 ==========
const likedPosts = new Set();

function isLiked(postId) {
    return likedPosts.has(postId);
}

async function toggleLike(postId) {
    // 获取用户ID：普通用户、用户模式下的管理员、或直接使用管理员身份
    const userId = currentUser ? currentUser.userId : (isAdmin ? '管理员' : null);
    
    if (!userId) {
        showToast('请先登记');
        return;
    }
    
    const isLikedNow = isLiked(postId);
    const action = isLikedNow ? 'unlike' : 'like';
    
    if (isLikedNow) {
        likedPosts.delete(postId);
    } else {
        likedPosts.add(postId);
    }
    
    const btn = document.getElementById(`like-btn-${postId}`);
    btn.classList.toggle('active');
    btn.querySelector('span:first-child').textContent = isLiked(postId) ? '❤️' : '🤍';
    btn.classList.add('animating');
    setTimeout(() => btn.classList.remove('animating'), 300);
    
    try {
        await fetch(`${API_URL}/api/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                postId,
                userId: userId,
                action
            })
        });
    } catch (err) {
        showToast('❌ 操作失败');
    }
}

function updateLikeRealtime(data) {
    const { postId, likes } = data;
    const countEl = document.getElementById(`like-count-${postId}`);
    if (countEl) {
        countEl.textContent = likes;
    }
}

// ========== 统计功能 ==========
async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/api/stats`);
        const stats = await res.json();
        updateStatsUI(stats);
    } catch (err) {
        console.error('加载统计失败:', err);
    }
}

function updateStatsUI(stats) {
    document.getElementById('totalUsers').textContent = `共${stats.total}人`;
    document.getElementById('maleCount').textContent = stats.male;
    document.getElementById('femaleCount').textContent = stats.female;
    document.getElementById('age1Count').textContent = stats.age18_30 + '人';
    document.getElementById('age2Count').textContent = stats.age31_45 + '人';
    document.getElementById('age3Count').textContent = stats.age46_55 + '人';
    
    const total = stats.total || 1;
    const malePercent = Math.round(stats.male / total * 100);
    const femalePercent = Math.round(stats.female / total * 100);
    
    document.getElementById('maleBar').style.width = malePercent + '%';
    document.getElementById('malePercent').textContent = malePercent + '%';
    document.getElementById('femaleBar').style.width = femalePercent + '%';
    document.getElementById('femalePercent').textContent = femalePercent + '%';
    
    const maxAge = Math.max(stats.age18_30, stats.age31_45, stats.age46_55) || 1;
    document.getElementById('age1Bar').style.width = (stats.age18_30 / maxAge * 100) + '%';
    document.getElementById('age2Bar').style.width = (stats.age31_45 / maxAge * 100) + '%';
    document.getElementById('age3Bar').style.width = (stats.age46_55 / maxAge * 100) + '%';
}

function highlightElement(id) {
    const el = document.getElementById(id);
    el.style.animation = 'none';
    setTimeout(() => {
        el.style.animation = 'highlight 1s ease';
    }, 10);
}

// ========== 工具函数 ==========
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timeStr) {
    const date = new Date(timeStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    return date.toLocaleDateString('zh-CN');
}

// 点击遮罩关闭弹窗
document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this && this.id !== 'roleModal' && this.id !== 'registerModal') {
            if (this.id === 'adminModal') {
                closeAdminModal();
            }
        }
    });
});