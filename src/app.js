// Edge兼容polyfill
if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
        if (this == null) throw new TypeError('find called on null or undefined');
        if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;
        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) return value;
        }
        return undefined;
    };
}

// ===== 数据层 =====
var defaultStudents = [
    { id: 's1', name: '李明', avatar: '李' },
    { id: 's2', name: '王芳', avatar: '王' },
    { id: 's3', name: '张伟', avatar: '张' },
    { id: 's4', name: '刘洋', avatar: '刘' },
    { id: 's5', name: '陈静', avatar: '陈' },
    { id: 's6', name: '杨帆', avatar: '杨' },
    { id: 's7', name: '赵磊', avatar: '赵' },
    { id: 's8', name: '黄丽', avatar: '黄' },
    { id: 's9', name: '周杰', avatar: '周' },
    { id: 's10', name: '吴倩', avatar: '吴' },
    { id: 's11', name: '徐鹏', avatar: '徐' },
    { id: 's12', name: '孙悦', avatar: '孙' },
    { id: 's13', name: '马强', avatar: '马' },
    { id: 's14', name: '朱琳', avatar: '朱' },
    { id: 's15', name: '胡军', avatar: '胡' },
    { id: 's16', name: '郭敏', avatar: '郭' },
    { id: 's17', name: '何伟', avatar: '何' },
    { id: 's18', name: '林娜', avatar: '林' },
    { id: 's19', name: '罗刚', avatar: '罗' },
    { id: 's20', name: '高燕', avatar: '高' }
];

// 班级管理系统
var classData = JSON.parse(localStorage.getItem('classData')) || [];
var teacherCurrentClassId = localStorage.getItem('teacherCurrentClassId') || '';
var studentJoinedClasses = JSON.parse(localStorage.getItem('studentJoinedClasses')) || [];
var studentCurrentClassId = localStorage.getItem('studentCurrentClassId') || '';

// 自动清理乱码学生数据（检测XML/CSS/代码残留）
function cleanGarbledStudentData() {
    var cleaned = false;
    classData.forEach(function(cls) {
        if (!cls.students) return;
        var before = cls.students.length;
        cls.students = cls.students.filter(function(s) {
            return isValidStudentName(s.name || '');
        });
        if (cls.students.length !== before) cleaned = true;
    });
    if (cleaned) {
        localStorage.setItem('classData', JSON.stringify(classData));
    }
}
cleanGarbledStudentData();

// 初始化默认班级（仅首次）
if (classData.length === 0) {
    classData = [{
        id: 'class_' + Date.now(),
        name: '默认班级',
        code: 'CLASS01',
        teacherName: '张教授',
        students: defaultStudents.map(function(s) { return {id: s.id, name: s.name, avatar: s.avatar}; }),
        createdAt: new Date().toISOString().split('T')[0]
    }];
    localStorage.setItem('classData', JSON.stringify(classData));
    teacherCurrentClassId = classData[0].id;
    localStorage.setItem('teacherCurrentClassId', teacherCurrentClassId);
}

// 确保当前班级ID有效
if (teacherCurrentClassId && !classData.find(function(c) { return c.id === teacherCurrentClassId; })) {
    teacherCurrentClassId = classData[0] ? classData[0].id : '';
    localStorage.setItem('teacherCurrentClassId', teacherCurrentClassId);
}
if (!teacherCurrentClassId && classData.length > 0) {
    teacherCurrentClassId = classData[0].id;
    localStorage.setItem('teacherCurrentClassId', teacherCurrentClassId);
}

// 兼容：获取当前班级的学生列表
function getCurrentClassStudents() {
    var cls = classData.find(function(c) { return c.id === teacherCurrentClassId; });
    return cls ? cls.students : defaultStudents;
}

// 兼容：students 变量指向当前班级学生
var students = getCurrentClassStudents();

// 按班级隔离的数据读写
function getClassDataKey(key) {
    return key + '_' + teacherCurrentClassId;
}

function saveClassIsolatedData(key, data) {
    localStorage.setItem(getClassDataKey(key), JSON.stringify(data));
}

function loadClassIsolatedData(key, fallback) {
    return JSON.parse(localStorage.getItem(getClassDataKey(key))) || fallback;
}

// 学生端按班级隔离的数据读写
function getStudentClassDataKey(key) {
    return key + '_' + studentCurrentClassId;
}

function saveStudentClassIsolatedData(key, data) {
    localStorage.setItem(getStudentClassDataKey(key), JSON.stringify(data));
}

function loadStudentClassIsolatedData(key, fallback) {
    return JSON.parse(localStorage.getItem(getStudentClassDataKey(key))) || fallback;
}

var currentUser = null;
var currentRole = 'teacher';
var checkinCode = null;
var checkinTimer = null;
var checkinTimeLeft = 300;
var rollCallInterval = null;
var currentGradeSubmission = null;
var currentSubmitHomework = null;
var learningInterval = null;
var learningSeconds = 0;
var isLearning = false;

// 初始化数据（按班级隔离）
var attendanceData = loadClassIsolatedData('attendanceData', {});
var homeworkData = loadClassIsolatedData('homeworkData', [
    { id: 'hw1', title: '数据结构作业一：线性表', desc: '实现单链表的基本操作，包括插入、删除、查找等。', deadline: '2026-06-25T23:59', createdAt: '2026-06-15', submissions: {} },
    { id: 'hw2', title: '算法设计：排序算法比较', desc: '比较各种排序算法的时间复杂度，并给出实际测试数据。', deadline: '2026-06-28T23:59', createdAt: '2026-06-17', submissions: {} },
    { id: 'hw3', title: '数据库设计作业', desc: '设计一个学生信息管理系统的数据库结构。', deadline: '2026-07-02T23:59', createdAt: '2026-06-19', submissions: {} }
]);
var rollCallHistory = loadClassIsolatedData('rollCallHistory', []);
var monitorData = {};

// 视频数据与观看进度（按班级隔离）
var videoData = loadClassIsolatedData('videoData', []);
var videoProgressData = loadClassIsolatedData('videoProgressData', {});
var selectedVideoFile = null;
var currentPlayingVideoId = null;

// 初始化默认视频（仅首次，当前班级无视频时）
if (videoData.length === 0) {
    videoData = [
        { id: 'v1', title: '数据结构与算法 - 第3章 线性表', desc: '讲解单链表、双链表的基本操作与实现', duration: 2700, uploadedAt: '2026-06-15', url: '' },
        { id: 'v2', title: '数据库系统概论 - 关系模型', desc: '关系代数、SQL查询语言基础', duration: 1800, uploadedAt: '2026-06-17', url: '' },
        { id: 'v3', title: '操作系统原理 - 进程管理', desc: '进程调度、死锁、进程同步', duration: 3600, uploadedAt: '2026-06-19', url: '' },
        { id: 'v4', title: '计算机网络 - TCP/IP协议栈', desc: 'TCP三次握手、UDP、IP路由', duration: 2400, uploadedAt: '2026-06-19', url: '' }
    ];
    // 模拟部分学生的观看进度
    students.forEach(function(s) {
        videoProgressData[s.id] = {};
        videoData.forEach(function(v) {
            var rand = Math.random();
            if (rand > 0.3) {
                videoProgressData[s.id][v.id] = {
                    watched: Math.floor(v.duration * (0.2 + Math.random() * 0.8)),
                    completed: rand > 0.6,
                    lastWatched: '2026-06-19'
                };
            }
        });
    });
    saveClassIsolatedData('videoData', videoData);
    saveClassIsolatedData('videoProgressData', videoProgressData);
}

// ===== 班级管理功能 =====
function generateClassCode() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code = '';
    for (var i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // 确保不重复
    if (classData.find(function(c) { return c.code === code; })) return generateClassCode();
    return code;
}

function createNewClass() {
    var name = document.getElementById('newClassName').value.trim();
    var teacherName = document.getElementById('newClassTeacher').value.trim();
    if (!name) {
        showToast('请输入班级名称', 'error');
        return;
    }
    var newClass = {
        id: 'class_' + Date.now(),
        name: name,
        code: generateClassCode(),
        teacherName: teacherName || (currentUser ? currentUser.name : '教师'),
        students: [],
        createdAt: new Date().toISOString().split('T')[0]
    };
    classData.push(newClass);
    localStorage.setItem('classData', JSON.stringify(classData));

    // 初始化该班级的数据
    var prevClassId = teacherCurrentClassId;
    teacherCurrentClassId = newClass.id;
    localStorage.setItem('teacherCurrentClassId', teacherCurrentClassId);
    saveClassIsolatedData('attendanceData', {});
    saveClassIsolatedData('homeworkData', []);
    saveClassIsolatedData('rollCallHistory', []);
    saveClassIsolatedData('videoData', []);
    saveClassIsolatedData('videoProgressData', {});

    hideModal('createClassModal');
    document.getElementById('newClassName').value = '';
    document.getElementById('newClassTeacher').value = '';

    // 切换到新班级
    switchTeacherClass(newClass.id);
    showToast('班级创建成功！班级号: ' + newClass.code, 'success');
}

function deleteClass(classId) {
    var cls = classData.find(function(c) { return c.id === classId; });
    if (!cls) return;
    if (classData.length <= 1) {
        showToast('至少保留一个班级', 'warning');
        return;
    }
    if (!confirm('确定删除班级 "' + cls.name + '" 吗？删除后不可恢复。')) return;

    classData = classData.filter(function(c) { return c.id !== classId; });
    localStorage.setItem('classData', JSON.stringify(classData));

    // 清理该班级的隔离数据
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('_' + classId) === key.length - ('_' + classId).length) keysToRemove.push(key);
    }
    keysToRemove.forEach(function(k) { localStorage.removeItem(k); });

    if (teacherCurrentClassId === classId) {
        switchTeacherClass(classData[0].id);
    }
    renderTeacherClassPage();
    showToast('班级已删除', 'success');
}

function viewClassCode(classId) {
    var cls = classData.find(function(c) { return c.id === classId; });
    if (!cls) return;

    document.getElementById('viewClassCodeName').textContent = cls.name;
    document.getElementById('viewClassCodeText').textContent = cls.code;

    var qrContainer = document.getElementById('viewClassCodeQR');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: cls.code,
        width: 160,
        height: 160,
        colorDark: '#1a5f4a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    showModal('viewClassCodeModal');
}

function enterTeacherClass(classId) {
    switchTeacherClass(classId);
    showPage('teacherDashboard');
    // 更新侧边栏active状态
    document.querySelectorAll('#teacherApp .sidebar-nav .nav-item').forEach(function(item, i) {
        item.classList.toggle('active', i === 1); // 总览看板是第二个
    });
}

function switchTeacherClass(classId) {
    if (!classId || !classData.find(function(c) { return c.id === classId; })) return;

    // 保存当前班级数据
    saveCurrentClassData();

    teacherCurrentClassId = classId;
    localStorage.setItem('teacherCurrentClassId', teacherCurrentClassId);

    // 加载新班级数据
    students = getCurrentClassStudents();
    attendanceData = loadClassIsolatedData('attendanceData', {});
    homeworkData = loadClassIsolatedData('homeworkData', []);
    rollCallHistory = loadClassIsolatedData('rollCallHistory', []);
    videoData = loadClassIsolatedData('videoData', []);
    videoProgressData = loadClassIsolatedData('videoProgressData', {});

    // 如果视频为空，初始化默认视频
    if (videoData.length === 0) {
        videoData = [
            { id: 'v1', title: '数据结构与算法 - 第3章 线性表', desc: '讲解单链表、双链表的基本操作与实现', duration: 2700, uploadedAt: '2026-06-15', url: '' },
            { id: 'v2', title: '数据库系统概论 - 关系模型', desc: '关系代数、SQL查询语言基础', duration: 1800, uploadedAt: '2026-06-17', url: '' },
            { id: 'v3', title: '操作系统原理 - 进程管理', desc: '进程调度、死锁、进程同步', duration: 3600, uploadedAt: '2026-06-19', url: '' },
            { id: 'v4', title: '计算机网络 - TCP/IP协议栈', desc: 'TCP三次握手、UDP、IP路由', duration: 2400, uploadedAt: '2026-06-19', url: '' }
        ];
        saveClassIsolatedData('videoData', videoData);
    }

    // 更新所有班级选择器
    updateAllTeacherClassSelectors();

    // 刷新当前页面
    initTeacherDashboard();
    renderTeacherClassPage();
}

function saveCurrentClassData() {
    saveClassIsolatedData('attendanceData', attendanceData);
    saveClassIsolatedData('homeworkData', homeworkData);
    saveClassIsolatedData('rollCallHistory', rollCallHistory);
    saveClassIsolatedData('videoData', videoData.map(function(v) { var copy = {}; for (var k in v) { copy[k] = v[k]; } copy.url = ''; return copy; }));
    saveClassIsolatedData('videoProgressData', videoProgressData);
}

function updateAllTeacherClassSelectors() {
    var selectors = document.querySelectorAll('[id^="teacherClassSelector"]');
    selectors.forEach(function(sel) {
        var currentVal = sel.value;
        sel.innerHTML = classData.map(function(c) {
            return '<option value="' + c.id + '" ' + (c.id === teacherCurrentClassId ? 'selected' : '') + '>' + c.name + '</option>';
        }).join('');
    });
}

function renderTeacherClassPage() {
    var grid = document.getElementById('teacherClassGrid');
    if (!grid) return;

    grid.innerHTML = classData.map(function(cls) {
        return '<div class="class-card">\' +'
                + '            \'<div class="class-card-header">\' +'
                + '                \'<div class="class-card-title">\' + cls.name + \'</div>\' +'
                + '                \'<div class="class-card-code">\' + cls.code + \'</div>\' +'
                + '            \'</div>\' +'
                + '            \'<div class="class-card-meta">\' +'
                + '                \'<span>\' +'
                + '                    \'<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>\' +'
                + '                    \' \' + cls.students.length + \' 名学生\' +'
                + '                \'</span>\' +'
                + '                \'<span>\' +'
                + '                    \'<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>\' +'
                + '                    \' \' + cls.createdAt +'
                + '                \'</span>\' +'
                + '            \'</div>\' +'
                + '            \'<div class="class-card-actions">\' +'
                + '                \'<button class="btn btn-info btn-sm" onclick="viewClassCode('\' + cls.id + \'')">查看班级码</button>\' +'
                + '                \'<button class="btn btn-success btn-sm" onclick="enterTeacherClass('\' + cls.id + \'')">进入课堂</button>\' +'
                + '                \'<button class="btn btn-danger btn-sm" onclick="deleteClass('\' + cls.id + \'')">删除</button>\' +'
                + '            \'</div>\' +'
                + '        \'</div>\';'
                + '    }).join(\'\') || \'<div class="empty-state"><p>暂无班级，请创建新班级</p></div>\';'
                + '}'
                + ''
                + '// ===== 学生端班级管理 ====='
                + 'function joinClassByCode() {'
                + '    var code = document.getElementById(\'joinClassCodeInput\').value.trim().toUpperCase();'
                + '    if (!code || code.length !== 6) {'
                + '        showToast(\'请输入6位班级号\', \'error\');'
                + '        return;'
                + '    }'
                + ''
                + '    var cls = classData.find(function(c) { return c.code === code; });'
                + '    if (!cls) {'
                + '        showToast(\'班级号不存在，请检查后重试\', \'error\');'
                + '        return;'
                + '    }'
                + ''
                + '    if (studentJoinedClasses.find(function(c) { return c.classId === cls.id; })) {'
                + '        showToast(\'你已经加入了该班级\', \'warning\');'
                + '        return;'
                + '    }'
                + ''
                + '    studentJoinedClasses.push({'
                + '        classId: cls.id,'
                + '        className: cls.name,'
                + '        classCode: cls.code,'
                + '        joinedAt: new Date().toISOString().split(\'T\')[0]'
                + '    });'
                + '    localStorage.setItem(\'studentJoinedClasses\', JSON.stringify(studentJoinedClasses));'
                + ''
                + '    // 将学生添加到班级学生列表'
                + '    if (currentUser) {'
                + '        var studentExists = cls.students.find(function(s) { return s.name === currentUser.name; });'
                + '        if (!studentExists) {'
                + '            cls.students.push({'
                + '                id: \'s\' + Date.now(),'
                + '                name: currentUser.name,'
                + '                avatar: currentUser.name.charAt(0)'
                + '            });'
                + '            localStorage.setItem(\'classData\', JSON.stringify(classData));'
                + '        }'
                + '    }'
                + ''
                + '    document.getElementById(\'joinClassCodeInput\').value = \'\';'
                + '    switchStudentClass(cls.id);'
                + '    renderStudentClassPage();'
                + '    showToast(\'成功加入班级: \' + cls.name, \'success\');'
                + '}'
                + ''
                + 'function enterStudentClass(classId) {'
                + '    switchStudentClass(classId);'
                + '    showStudentPage(\'studentDashboard\');'
                + '    document.querySelectorAll(\'#studentApp .sidebar-nav .nav-item\').forEach(function(item, i) {'
                + '        item.classList.toggle(\'active\', i === 1); // 学习看板是第二个'
                + '    });'
                + '}'
                + ''
                + 'function switchStudentClass(classId) {'
                + '    if (!classId) return;'
                + ''
                + '    studentCurrentClassId = classId;'
                + '    localStorage.setItem(\'studentCurrentClassId\', studentCurrentClassId);'
                + ''
                + '    // 加载该班级的数据（学生端）'
                + '    attendanceData = loadStudentClassIsolatedData(\'attendanceData\', {});'
                + '    homeworkData = loadStudentClassIsolatedData(\'homeworkData\', []);'
                + '    videoData = loadStudentClassIsolatedData(\'videoData\', []);'
                + '    videoProgressData = loadStudentClassIsolatedData(\'videoProgressData\', {});'
                + ''
                + '    // 获取班级学生列表'
                + '    var cls = classData.find(function(c) { return c.id === classId; });'
                + '    students = cls ? cls.students : defaultStudents;'
                + ''
                + '    // 更新所有学生端班级选择器'
                + '    updateAllStudentClassSelectors();'
                + ''
                + '    // 刷新当前页面'
                + '    initStudentDashboard();'
                + '    renderStudentClassPage();'
                + '}'
                + ''
                + 'function updateAllStudentClassSelectors() {'
                + '    var selectors = document.querySelectorAll(\'[id^="studentClassSelector"]\');'
                + '    selectors.forEach(function(sel) {'
                + '        sel.innerHTML = studentJoinedClasses.map(function(c) {'
                + '            return \'<option value="\' + c.classId + \'" \' + (c.classId === studentCurrentClassId ? \'selected\' : \'\') + \'>\' + c.className + \'</option>\';'
                + '        }).join(\'\');'
                + '    });'
                + '}'
                + ''
                + 'function renderStudentClassPage() {'
                + '    var grid = document.getElementById(\'studentClassGrid\');'
                + '    if (!grid) return;'
                + ''
                + '    grid.innerHTML = studentJoinedClasses.map(function(jc) {'
                + '        var cls = classData.find(function(c) { return c.id === jc.classId; });'
                + '        return ''
            <div class="class-card">
                <div class="class-card-header">
                    <div class="class-card-title">' + jc.className + '</div>
                    <div class="class-card-code">' + jc.classCode + '</div>
                </div>
                <div class="class-card-meta">
                    <span>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        加入时间: ' + jc.joinedAt + '
                    </span>
                    ' + (cls ? '<span>' + cls.students.length + ' 名学生</span>' : '') + '
                </div>
                <div class="class-card-actions">
                    <button class="btn btn-success btn-sm" onclick="enterStudentClass(\' + jc.classId + \')">进入课堂</button>
                    <button class="btn btn-danger btn-sm" onclick="leaveClass(\' + jc.classId + \')">退出班级</button>
                </div>
            </div>
        ';
    }).join('') || '<div class="empty-state"><p>你还没有加入任何班级，请输入班级号加入</p></div>';
}

function leaveClass(classId) {
    if (!confirm('确定退出该班级吗？')) return;
    studentJoinedClasses = studentJoinedClasses.filter(function(c) { return c.classId !== classId; });
    localStorage.setItem('studentJoinedClasses', JSON.stringify(studentJoinedClasses));

    if (studentCurrentClassId === classId) {
        if (studentJoinedClasses.length > 0) {
            switchStudentClass(studentJoinedClasses[0].classId);
        } else {
            studentCurrentClassId = '';
            localStorage.setItem('studentCurrentClassId', '');
        }
    }
    renderStudentClassPage();
    updateAllStudentClassSelectors();
    showToast('已退出班级', 'success');
}

// ===== 登录相关 =====
// 版本标记：用于强制刷新旧数据
var AUTH_VERSION = 'v2';
var storedAuthVersion = localStorage.getItem('authVersion');
if (storedAuthVersion !== AUTH_VERSION) {
    // 清除旧版认证数据，强制重新注册
    localStorage.removeItem('registeredUsers');
    localStorage.setItem('authVersion', AUTH_VERSION);
}
var registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];

function switchAuthTab(tab) {
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
    document.getElementById('loginFormArea').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerFormArea').style.display = tab === 'register' ? 'block' : 'none';
}

var regRole = 'student';
function selectRegRole(role) {
    regRole = role;
    var container = document.getElementById('registerFormArea');
    if (container) {
        var buttons = container.querySelectorAll('[data-reg-role]');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].classList.remove('active');
        }
        var btn = container.querySelector('[data-reg-role="' + role + '"]');
        if (btn) btn.classList.add('active');
    }
    var regIdLabel = document.getElementById('regIdLabel');
    var regId = document.getElementById('regId');
    var regClassGroup = document.getElementById('regClassGroup');
    if (regIdLabel) regIdLabel.textContent = role === 'teacher' ? '工号' : '学号';
    if (regId) regId.placeholder = role === 'teacher' ? '请输入工号' : '请输入学号';
    if (regClassGroup) regClassGroup.style.display = role === 'teacher' ? 'none' : 'block';
}

function selectRole(role) {
    currentRole = role;
    var container = document.getElementById('loginFormArea');
    if (container) {
        var buttons = container.querySelectorAll('.role-btn');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].classList.remove('active');
        }
        var btn = container.querySelector('[data-role="' + role + '"]');
        if (btn) btn.classList.add('active');
    }
    var classSelectGroup = document.getElementById('classSelectGroup');
    if (classSelectGroup) {
        classSelectGroup.style.display = role === 'student' ? 'block' : 'none';
    }
}

function handleLogin(e) {
    e.preventDefault();
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }

    // 必须注册后才能登录
    var regUser = registeredUsers.find(function(u) { return u.name === username || u.id === username; });
    if (!regUser) {
        showToast('用户不存在，请先注册', 'error');
        return;
    }

    // 校验密码
    if (password !== regUser.password) {
        showToast('密码错误，请重试', 'error');
        return;
    }

    // 校验角色：注册为教师只能登录教师端，注册为学生只能登录学生端
    if (regUser.role && regUser.role !== currentRole) {
        var expectedRoleText = regUser.role === 'teacher' ? '教师端' : '学生端';
        showToast('该账号注册为' + (regUser.role === 'teacher' ? '教师' : '学生') + '，请在' + expectedRoleText + '登录', 'error');
        return;
    }

    currentUser = { name: regUser.name, role: currentRole };

    if (currentRole === 'teacher') {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('teacherApp').classList.add('active');
        // 更新所有教师名显示
        var teacherNameEls = document.querySelectorAll('[id^="teacherName"]');
        for (var i = 0; i < teacherNameEls.length; i++) { teacherNameEls[i].textContent = currentUser.name; }
        document.querySelector('#teacherApp .user-avatar').textContent = currentUser.name[0];
        // 初始化班级选择器
        students = getCurrentClassStudents();
        updateAllTeacherClassSelectors();
        renderTeacherClassPage();
        initTeacherDashboard();
    } else {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('studentApp').classList.add('active');
        // 更新所有学生名显示
        var studentNameEls = document.querySelectorAll('[id^="studentNameDisplay"]');
        for (var i = 0; i < studentNameEls.length; i++) { studentNameEls[i].textContent = currentUser.name; }
        document.querySelector('#studentApp .user-avatar').textContent = currentUser.name[0];
        // 初始化学生端班级选择器
        if (studentJoinedClasses.length > 0 && !studentCurrentClassId) {
            studentCurrentClassId = studentJoinedClasses[0].classId;
            localStorage.setItem('studentCurrentClassId', studentCurrentClassId);
        }
        if (studentCurrentClassId) {
            var cls = classData.find(function(c) { return c.id === studentCurrentClassId; });
            students = cls ? cls.students : defaultStudents;
            attendanceData = loadStudentClassIsolatedData('attendanceData', {});
            homeworkData = loadStudentClassIsolatedData('homeworkData', []);
            videoData = loadStudentClassIsolatedData('videoData', []);
            videoProgressData = loadStudentClassIsolatedData('videoProgressData', {});
        }
        updateAllStudentClassSelectors();
        renderStudentClassPage();
        initStudentDashboard();
    }
}

function handleRegister(e) {
    e.preventDefault();
    var name = document.getElementById('regName').value.trim();
    var id = document.getElementById('regId').value.trim();
    var phone = document.getElementById('regPhone').value.trim();
    var password = document.getElementById('regPassword').value;
    var passwordConfirm = document.getElementById('regPasswordConfirm').value;
    var className = document.getElementById('regClass');
    var classText = className.options[className.selectedIndex].text;

    if (!name || !id || !phone || !password) {
        showToast('请填写完整信息', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('密码至少6位', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }

    if (!/^1\d{10}$/.test(phone)) {
        showToast('请输入正确的手机号', 'error');
        return;
    }

    if (registeredUsers.find(function(u) { return u.id === id; })) {
        showToast('该学号/工号已注册', 'error');
        return;
    }

    var newUser = {
        name: name, id: id, phone: phone, password: password,
        role: regRole,
        class: regRole === 'student' ? classText : null,
        classId: regRole === 'student' ? className.value : null,
        registeredAt: new Date().toISOString().split('T')[0]
    };
    registeredUsers.push(newUser);
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

    // 学生注册时自动添加到默认班级
    if (regRole === 'student') {
        var newStudent = { id: 's' + Date.now(), name: name, avatar: name.charAt(0) };
        if (classData.length > 0) {
            classData[0].students.push(newStudent);
            localStorage.setItem('classData', JSON.stringify(classData));
        }
        students.push(newStudent);
    }

    showToast('注册成功！请登录', 'success');

    // 切换到登录并自动填充
    switchAuthTab('login');
    document.getElementById('username').value = id;
    document.getElementById('password').value = '';
    currentRole = regRole;
    var allRoleBtns = document.querySelectorAll('.role-btn');
    for (var i = 0; i < allRoleBtns.length; i++) { allRoleBtns[i].classList.remove('active'); }
    var targetBtn = document.querySelector('[data-role="' + regRole + '"]');
    if (targetBtn) targetBtn.classList.add('active');
    var classSelectGroup = document.getElementById('classSelectGroup');
    if (classSelectGroup) {
        classSelectGroup.style.display = regRole === 'student' ? 'block' : 'none';
    }

    // 清空注册表单
    document.getElementById('regName').value = '';
    document.getElementById('regId').value = '';
    document.getElementById('regPhone').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regPasswordConfirm').value = '';
}

function showQRCode() {
    var url = window.location.href;
    var container = document.getElementById('qrCodeContainer');
    container.innerHTML = '';
    document.getElementById('qrUrlText').textContent = url;

    new QRCode(container, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#1a5f4a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    showModal('qrModal');
}

function logout() {
    currentUser = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('teacherApp').classList.remove('active');
    document.getElementById('studentApp').classList.remove('active');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    switchAuthTab('login');
}

// ===== 教师端 =====
function showPage(pageId) {
    document.querySelectorAll('#teacherApp .page').forEach(function(p) { return p.classList.add('hidden'; }));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelectorAll('#teacherApp .sidebar-nav .nav-item').forEach(function(item) { return item.classList.remove('active'; }));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (pageId === 'teacherClasses') { renderTeacherClassPage(); updateAllTeacherClassSelectors(); }
    if (pageId === 'teacherDashboard') { initTeacherDashboard(); updateAllTeacherClassSelectors(); }
    if (pageId === 'teacherCheckin') { renderCheckinPage(); updateAllTeacherClassSelectors(); }
    if (pageId === 'teacherRollCall') { renderRollCallPage(); updateAllTeacherClassSelectors(); }
    if (pageId === 'teacherHomework') { renderHomeworkPage(); updateAllTeacherClassSelectors(); }
    if (pageId === 'teacherMonitor') { renderMonitorPage(); updateAllTeacherClassSelectors(); }
}

function initTeacherDashboard() {
    renderDashboardCheckin();
    renderDashboardHomework();
    updateStats();
}

function updateStats() {
    var today = new Date().toISOString().split('T')[0];
    var todayData = attendanceData[today] || {};
    var present = 0;
    for (var k in todayData) { if (todayData[k] === 'present') present++; }
    var total = students.length;
    var rate = total > 0 ? Math.round((present / total) * 100) : 0;
    document.getElementById('todayAttendance').textContent = rate + '%';
    document.getElementById('totalStudents').textContent = total;

    var pending = 0;
    homeworkData.forEach(function(hw) {
        students.forEach(function(s) {
            if (hw.submissions[s.id] && !hw.submissions[s.id].graded) pending++;
        });
    });
    document.getElementById('pendingHomework').textContent = pending;
}

function renderDashboardCheckin() {
    var container = document.getElementById('dashboardCheckin');
    var today = new Date().toISOString().split('T')[0];
    var todayData = attendanceData[today] || {};

    container.innerHTML = students.slice(0, 8).map(function(s) {
        var status = todayData[s.id] || 'unknown';
        var statusClass = '';
        var statusText = '未签到';
        if (status === 'present') { statusClass = 'present'; statusText = '已签到'; }
        else if (status === 'late') { statusClass = 'late'; statusText = '迟到'; }
        else if (status === 'absent') { statusClass = 'absent'; statusText = '缺勤'; }

        return '
            <div class="checkin-card ' + statusClass + '">
                <div class="checkin-avatar">' + s.avatar + '</div>
                <div class="checkin-name">' + s.name + '</div>
                <div class="checkin-status">' + statusText + '</div>
            </div>
        ';
    }).join('');
}

function renderDashboardHomework() {
    var container = document.getElementById('dashboardHomework');
    container.innerHTML = homeworkData.slice(0, 2).map(function(hw) {
        var submitted = Object.keys(hw.submissions).length;
        var total = students.length;
        var progress = Math.round((submitted / total) * 100);

        return '
            <div class="homework-item">
                <div class="homework-header">
                    <div>
                        <div class="homework-title">' + hw.title + '</div>
                        <div class="homework-meta">截止: ' + new Date(hw.deadline).toLocaleString('zh-CN') + '</div>
                    </div>
                    <span class="badge ' + progress === 100 ? 'badge-success' : 'badge-info' + '">' + progress + '% 已提交</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:' + progress + '%"></div>
                </div>
            </div>
        ';
    }).join('');
}

// 签到功能
function renderCheckinPage() {
    renderTodayCheckin();
    renderCheckinHistory();
    renderPersonalStats();
    renderAttendanceMatrix();
}

function renderTodayCheckin() {
    var container = document.getElementById('todayCheckinGrid');
    var today = new Date().toISOString().split('T')[0];
    var todayData = attendanceData[today] || {};

    container.innerHTML = students.map(function(s) {
        var status = todayData[s.id] || 'unknown';
        var statusClass = '';
        var statusText = '未签到';
        if (status === 'present') { statusClass = 'present'; statusText = '已签到'; }
        else if (status === 'late') { statusClass = 'late'; statusText = '迟到'; }
        else if (status === 'absent') { statusClass = 'absent'; statusText = '缺勤'; }

        return '
            <div class="checkin-card ' + statusClass + '" onclick="toggleStudentStatus('' + s.id + '')">
                <div class="checkin-avatar">' + s.avatar + '</div>
                <div class="checkin-name">' + s.name + '</div>
                <div class="checkin-status">' + statusText + '</div>
            </div>
        ';
    }).join('');
}

function toggleStudentStatus(studentId) {
    var today = new Date().toISOString().split('T')[0];
    if (!attendanceData[today]) attendanceData[today] = {};

    var current = attendanceData[today][studentId];
    var next = 'present';
    if (current === 'present') next = 'late';
    else if (current === 'late') next = 'absent';
    else if (current === 'absent') next = null;

    if (next) attendanceData[today][studentId] = next;
    else delete attendanceData[today][studentId];

    saveClassIsolatedData('attendanceData', attendanceData);
    renderTodayCheckin();
    renderDashboardCheckin();
    updateStats();
}

function startCheckin() {
    checkinCode = Math.floor(1000 + Math.random() * 9000).toString();
    checkinTimeLeft = 300;
    document.getElementById('checkinCode').textContent = checkinCode;
    document.getElementById('checkinCodeArea').style.display = 'block';
    document.getElementById('checkinStatus').textContent = '进行中';
    document.getElementById('checkinStatus').className = 'badge badge-success';

    if (checkinTimer) clearInterval(checkinTimer);
    checkinTimer = setInterval(function() {
        checkinTimeLeft--;
        var mins = Math.floor(checkinTimeLeft / 60).toString();
        if (mins.length < 2) mins = '0' + mins;
        var secs = (checkinTimeLeft % 60).toString();
        if (secs.length < 2) secs = '0' + secs;
        document.getElementById('checkinTimer').textContent = '剩余时间: ' + mins + ':' + secs + '';

        if (checkinTimeLeft <= 0) {
            clearInterval(checkinTimer);
            document.getElementById('checkinStatus').textContent = '已结束';
            document.getElementById('checkinStatus').className = 'badge badge-warning';
            checkinCode = null;
        }
    }, 1000);

    showToast('签到已发起！', 'success');
}

function renderCheckinHistory() {
    var tbody = document.getElementById('checkinHistoryTable');
    var dates = Object.keys(attendanceData).sort().reverse().slice(0, 10);

    tbody.innerHTML = dates.map(function(date) {
        var data = attendanceData[date];
        var present = 0, late = 0, absent = 0;
        for (var k in data) {
            if (data[k] === 'present') present++;
            else if (data[k] === 'late') late++;
            else if (data[k] === 'absent') absent++;
        }
        var total = students.length;
        var rate = Math.round((present / total) * 100);

        return '
            <tr>
                <td>' + date + '</td>
                <td>' + total + '</td>
                <td>' + present + '</td>
                <td>' + late + '</td>
                <td>' + absent + '</td>
                <td><span class="badge ' + rate >= 90 ? 'badge-success' : rate >= 80 ? 'badge-warning' : 'badge-danger' + '">' + rate + '%</span></td>
            </tr>
        ';
    }).join('') || '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">暂无记录</td></tr>';
}

function renderPersonalStats() {
    var tbody = document.getElementById('personalStatsTable');
    var dates = Object.keys(attendanceData);

    tbody.innerHTML = students.map(function(s) {
        var present = 0, late = 0, absent = 0;
        dates.forEach(function(date) {
            var status = attendanceData[date][s.id];
            if (status === 'present') present++;
            else if (status === 'late') late++;
            else if (status === 'absent') absent++;
        });
        var total = dates.length || 1;
        var rate = Math.round((present / total) * 100);

        return '
            <tr>
                <td>' + s.name + '</td>
                <td>' + present + '</td>
                <td>' + late + '</td>
                <td>' + absent + '</td>
                <td><span class="badge ' + rate >= 90 ? 'badge-success' : rate >= 80 ? 'badge-warning' : 'badge-danger' + '">' + rate + '%</span></td>
            </tr>
        ';
    }).join('');
}

// 考勤名单上传 - 支持带考勤数据的表格导入
function handleRosterUpload(event) {
    var file = event.target.files[0];
    if (!file) return;

    // 检测Excel文件，使用SheetJS解析
    var isExcel = file.name.indexOf('.xlsx') === file.name.length - 5 || file.name.indexOf('.xls') === file.name.length - 4 || file.name.indexOf('.xlsm') === file.name.length - 5;
    if (isExcel) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = new Uint8Array(e.target.result);
                var workbook = XLSX.read(data, { type: 'array' });
                var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                // 将Excel转为CSV文本，复用后续解析逻辑
                var csvContent = XLSX.utils.sheet_to_csv(firstSheet);
                processRosterContent(csvContent, file.name);
            } catch (err) {
                showToast('Excel文件解析失败：' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
        var content = e.target.result;
        processRosterContent(content, file.name);
    };
    reader.readAsText(file, 'UTF-8');
}

// 处理解析后的文本内容（CSV/TXT/Excel转CSV）
function processRosterContent(content, fileName) {
        // 修复乱码：检测并移除 UTF-8 BOM
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.substring(1);
        }
        // 尝试修复 GBK 乱码（简单替换常见乱码字符）
        content = fixGarbledText(content);
        
        var lines = content.split(/\r?\n/).map(function(line) { return line.trim(; })).filter(function(line) { return line.length > 0; });
        if (lines.length === 0) {
            showToast('文件内容为空', 'error');
            return;
        }

        // 解析表头
        var headerLine = lines[0];
        var headers = parseCSVLine(headerLine);
        
        // 判断是否是考勤表（有日期列）还是纯名单
        var isAttendanceSheet = headers.length > 1 && headers.some(function(h) { return /^\d{1; },2}[-\/]\d{1,2}/.test(h));
        
        var newStudents = [];
        var importedAttendance = {}; // date -> {studentId -> status}
        
        // 通用：判断是否为有效学生姓名
        function isValidStudentName(name) {
            if (!name || typeof name !== 'string') return false;
            name = name.trim();
            if (name.length < 2 || name.length > 20) return false;
            
            // 过滤XML标签
            if (name.indexOf('<?xml') === 0 || name.indexOf('<') === 0 || name.indexOf('xmlns') !== -1) return false;
            
            // 过滤URL/命名空间
            if (name.indexOf('schemas-microsoft') !== -1 || name.indexOf('http://') !== -1 || 
                name.indexOf('urn:') !== -1 || name.indexOf('REC-') !== -1) return false;
            
            // 过滤CSS属性（根据截图中的实际乱码内容）
            var cssPatterns = [
                'font-weight:', 'font-style:', 'font-family:', 'font-size:',
                'color:', 'background:', 'border:', 'padding-', 'margin-',
                'text-align:', 'white-space:', 'vertical-align:', 'line-height:',
                'display:', 'position:', 'float:', 'clear:',
                'width:', 'height:', 'min-', 'max-',
                'overflow:', 'visibility:', 'z-index:',
                'table', 'tr ', 'tr{', 'td ', 'td{', 'th ', 'th{',
                'col ', 'col{', 'br ', 'br{', 'div ', 'div{', 'span ', 'span{',
                '.font', '#font', '@page', '@media', '@import',
                'mso-', 'windowtext', '10.0pt', 'stylesheet',
                'style=', 'class=', 'id=', 'name='
            ];
            for (var pi = 0; pi < cssPatterns.length; pi++) {
                if (name.indexOf(cssPatterns[pi]) !== -1) return false;
            }
            
            // 过滤包含CSS代码特征的行（冒号+分号 或 花括号）
            if ((name.indexOf(':') !== -1 && name.indexOf(';') !== -1) || 
                (name.indexOf('{') !== -1 || name.indexOf('}') !== -1)) return false;
            
            // 过滤XML/HTML残留
            name = name.replace(/<[^>]+>/g, '').trim();
            if (!name || name.length < 2) return false;
            
            return name;
        }

        if (isAttendanceSheet) {
            // 考勤表格式：姓名,日期1,日期2,...
            var dateHeaders = headers.slice(1);
            
            for (var i = 1; i < lines.length; i++) {
                var cells = parseCSVLine(lines[i]);
                if (cells.length === 0) continue;
                
                var name = isValidStudentName(cells[0].trim());
                if (!name || name === '姓名' || name === '学生') continue;
                
                var studentId = 's' + Date.now() + '_' + i;
                newStudents.push({
                    id: studentId,
                    name: name,
                    avatar: name.charAt(0)
                });
                
                // 解析考勤标记
                for (var j = 1; j < cells.length && j <= dateHeaders.length; j++) {
                    var dateKey = normalizeDate(dateHeaders[j - 1]);
                    var mark = cells[j].trim();
                    var status = parseAttendanceMark(mark);
                    
                    if (status) {
                        if (!importedAttendance[dateKey]) importedAttendance[dateKey] = {};
                        importedAttendance[dateKey][studentId] = status;
                    }
                }
            }
        } else {
            // 纯名单格式：每行一个姓名
            lines.forEach(function(line, idx) {
                var names = line.indexOf(',') !== -1 ? line.split(',').map(function(n) { return n.trim(); }) : [line];
                names.forEach(function(name) {
                    name = isValidStudentName(name);
                    if (!name || name === '姓名' || name === 'name' || name === '学生') return;
                    
                    newStudents.push({
                        id: 's' + Date.now() + '_' + idx,
                        name: name,
                        avatar: name.charAt(0)
                    });
                });
            });
        }

        if (newStudents.length === 0) {
            showToast('未能从文件中解析到学生姓名，请检查文件格式', 'error');
            return;
        }

        // 替换当前班级的学生名单
        var cls = classData.find(function(c) { return c.id === teacherCurrentClassId; });
        if (cls) {
            cls.students = newStudents;
            localStorage.setItem('classData', JSON.stringify(classData));
        }
        students.length = 0;
        newStudents.forEach(function(s) { students.push(s; }));
        
        // 合并导入的考勤数据
        Object.keys(importedAttendance).forEach(function(date) {
            if (!attendanceData[date]) attendanceData[date] = {};
            for (var ik in importedAttendance[date]) { attendanceData[date][ik] = importedAttendance[date][ik]; }
        });
        saveCurrentClassData();

        // 更新上传信息展示
        document.getElementById('rosterFileName').textContent = fileName;
        document.getElementById('rosterStudentCount').textContent = students.length;
        document.getElementById('rosterFileInfo').style.display = 'block';

        // 刷新相关页面
        renderTodayCheckin();
        renderDashboardCheckin();
        renderPersonalStats();
        renderAttendanceMatrix(); // 刷新考勤矩阵
        updateStats();

        var msg = isAttendanceSheet 
            ? '成功导入 ' + students.length + ' 名学生及考勤记录' 
            : '成功导入 ' + students.length + ' 名学生';
        showToast(msg, 'success');
    };
    reader.readAsText(file, 'UTF-8');
}

// 修复乱码文本 - 将UTF-8错误解析的GBK乱码替换为正确字符
function fixGarbledText(text) {
    // 这些是多字节UTF-8字符被错误当作单字节解析时产生的乱码模式
    var fixes = {
        '\u00E2\u20AC\u201C': '\u201C',  // "
        '\u00E2\u20AC\u201D': '\u201D',  // "
        '\u00E2\u20AC\u02DC': '\uFF5E',  // ～
        '\u00E2\u20AC\u2122': '\u2019',  // '
        '\u00C3\u2014': '\u2014',        // —
        '\u00C2\u00B7': '\u00B7',        // ·
        '\u00E3\u0080\u0081': '\u3001',  // 、
        '\u00EF\u00BC\u008C': '\uFF0C',  // ，
        '\u00EF\u00BC\u009B': '\u3010',  // 【
        '\u00EF\u00BC\u009D': '\u3011',  // 】
        '\u00EF\u00BC\u0088': '\uFF08',  // （
        '\u00EF\u00BC\u0089': '\uFF09',  // ）
        '\u00EF\u00BC\u009A': '\uFF1A',  // ：
        '\u00EF\u00BC\u009B': '\uFF1B',  // ；
        '\u00EF\u00BC\u009F': '\uFF1F',  // ？
        '\u00EF\u00BC\u0081': '\uFF01'   // ！
    };
    
    var result = text;
    Object.keys(fixes).forEach(function(garbled) {
        // 使用字符串分割替换，避免正则特殊字符问题
        var correct = fixes[garbled];
        while (result.indexOf(garbled) !== -1) {
            result = result.split(garbled).join(correct);
        }
    });
    
    return result;
}

// 解析 CSV 行（处理引号）
function parseCSVLine(line) {
    var cells = [];
    var current = '';
    var inQuotes = false;
    
    for (var i = 0; i < line.length; i++) {
        var char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    cells.push(current.trim());
    return cells;
}

// 标准化日期格式
function normalizeDate(dateStr) {
    // 支持 6-20, 06-20, 2026-06-20 等格式
    var match = dateStr.match(/(\d{1,2})[-\/](\d{1,2})/);
    if (match) {
        var month = match[1];
        if (month.length < 2) month = '0' + month;
        var day = match[2];
        if (day.length < 2) day = '0' + day;
        var year = new Date().getFullYear();
        return '' + year + '-' + month + '-' + day + '';
    }
    return dateStr;
}

// 解析考勤标记
function parseAttendanceMark(mark) {
    if (!mark) return null;
    var m = mark.trim();
    // √ ✓ ✔ 出勤
    if (/^[√✓✔vV]+$/.test(m)) return 'present';
    // ○ ◯ 〇 迟到
    if (/^[○◯〇oO0]$/.test(m)) return 'late';
    // × ✕ ✖ 缺勤
    if (/^[×✕✖xX]$/.test(m)) return 'absent';
    // 文字匹配
    if (m === '出勤' || m === '到' || m === '正常') return 'present';
    if (m === '迟到' || m === '晚') return 'late';
    if (m === '缺勤' || m === '未到' || m === '旷课') return 'absent';
    return null;
}

// 渲染考勤矩阵表格（支持编辑）
function renderAttendanceMatrix() {
    var container = document.getElementById('attendanceMatrixContainer');
    if (!container) return;
    
    var dates = Object.keys(attendanceData).sort();
    if (dates.length === 0 || students.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无考勤记录，请导入考勤表或开始签到</div>';
        return;
    }
    
    // 构建表格
    var html = '<div style="overflow-x:auto;"><table class="data-table attendance-matrix">';
    
    // 表头
    html += '<thead><tr><th style="min-width:100px;">学生</th>';
    dates.forEach(function(date) {
        var display = date.substring(5); // MM-DD
        html += '<th style="min-width:60px; text-align:center;">' + display + '</th>';
    });
    html += '<th style="min-width:80px;">出勤率</th></tr></thead>';
    
    // 表格体
    html += '<tbody>';
    students.forEach(function(s) {
        var present = 0, late = 0, absent = 0, total = 0;
        
        html += '<tr><td style="font-weight:500;">' + s.name + '</td>';
        
        dates.forEach(function(date) {
            var status = attendanceData[date][s.id];
            var mark = '';
            var cellClass = '';
            
            if (status === 'present') { mark = '√'; cellClass = 'status-present'; present++; total++; }
            else if (status === 'late') { mark = '○'; cellClass = 'status-late'; late++; total++; }
            else if (status === 'absent') { mark = '×'; cellClass = 'status-absent'; absent++; total++; }
            else { mark = '-'; cellClass = 'status-none'; }
            
            html += '<td class="attendance-cell ' + cellClass + '" 
                        onclick="editAttendanceCell('' + s.id + '', '' + date + '')" 
                        style="text-align:center; cursor:pointer; font-size:1.1rem; font-weight:600;">' + mark + '</td>';
        });
        
        var rate = total > 0 ? Math.round((present / total) * 100) : 0;
        html += '<td><span class="badge ' + rate >= 90 ? 'badge-success' : rate >= 80 ? 'badge-warning' : 'badge-danger' + '">' + rate + '%</span></td>';
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// 编辑考勤单元格
function editAttendanceCell(studentId, date) {
    var currentStatus = attendanceData[date] ? attendanceData[date][studentId] : null;
    
    // 循环切换状态：null -> present -> late -> absent -> null
    var newStatus = null;
    if (currentStatus === null || currentStatus === undefined) newStatus = 'present';
    else if (currentStatus === 'present') newStatus = 'late';
    else if (currentStatus === 'late') newStatus = 'absent';
    else if (currentStatus === 'absent') newStatus = null;
    
    if (!attendanceData[date]) attendanceData[date] = {};
    if (newStatus === null) {
        delete attendanceData[date][studentId];
    } else {
        attendanceData[date][studentId] = newStatus;
    }
    
    saveCurrentClassData();
    renderAttendanceMatrix();
    renderPersonalStats();
    updateStats();
    
    var statusText = newStatus === 'present' ? '出勤' : newStatus === 'late' ? '迟到' : newStatus === 'absent' ? '缺勤' : '未签到';
    showToast('已更新为：' + statusText + '', 'success');
}

// 导出考勤统计 - 输出与导入格式一致的考勤表
function exportAttendanceStats() {
    var dates = Object.keys(attendanceData).sort();
    
    if (dates.length === 0 || students.length === 0) {
        showToast('暂无考勤数据可导出', 'error');
        return;
    }
    
    // 构建与导入格式一致的 CSV
    var csv = '\uFEFF'; // UTF-8 BOM
    
    // 表头：姓名,日期1,日期2,...
    var displayDates = dates.map(function(d) { return d.substring(5; })); // MM-DD
    csv += '姓名,' + displayDates.join(',') + '\n';
    
    // 数据行
    students.forEach(function(s) {
        csv += s.name;
        dates.forEach(function(date) {
            var status = attendanceData[date][s.id];
            var mark = '';
            if (status === 'present') mark = '√';
            else if (status === 'late') mark = '○';
            else if (status === 'absent') mark = '×';
            csv += ',' + mark;
        });
        csv += '\n';
    });
    
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '考勤表_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    showToast('考勤表已导出（√出勤 ○迟到 ×缺勤）', 'success');
}

// 点名功能
function renderRollCallPage() {
    var grid = document.getElementById('studentListGrid');
    grid.innerHTML = students.map(function(s) {
        return '<div class="student-chip" id="chip-' + s.id + '">' + s.name + '</div>';
    }).join('');

    var historyTbody = document.getElementById('rollCallHistory');
    historyTbody.innerHTML = rollCallHistory.slice().reverse().map(function(r) {
        return '<tr>\' +'
                + '            \'<td>\' + r.time + \'</td>\' +'
                + '            \'<td>\' + r.studentName + \'</td>\' +'
                + '            \'<td><span class="badge \' + (r.answered ? \'badge-success\' : \'badge-warning\') + \'">\' + (r.answered ? \'已回答\' : \'未回答\') + \'</span></td>\' +'
                + '            \'<td>\' +'
                + '                \'<button class="btn btn-sm \' + (r.answered ? \'btn-outline\' : \'btn-success\') + \'" onclick="markAnswered('\' + r.id + \'', \' + (!r.answered) + \')">\' +'
                + '                    (r.answered ? \'标记未答\' : \'标记已答\') +'
                + '                \'</button>\' +'
                + '            \'</td>\' +'
                + '        \'</tr>\';'
                + '    }).join(\'\') || \'<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">暂无记录</td></tr>\';'
                + '}'
                + ''
                + 'function startRollCall() {'
                + '    var display = document.getElementById(\'pickerDisplay\');'
                + '    var btn = document.getElementById(\'rollCallBtn\');'
                + ''
                + '    if (rollCallInterval) {'
                + '        clearInterval(rollCallInterval);'
                + '        rollCallInterval = null;'
                + '        btn.textContent = \'开始点名\';'
                + '        display.classList.remove(\'rolling\');'
                + '        return;'
                + '    }'
                + ''
                + '    btn.textContent = \'停止\';'
                + '    display.classList.add(\'rolling\');'
                + ''
                + '    rollCallInterval = setInterval(function() {'
                + '        var random = students[Math.floor(Math.random() * students.length)];'
                + '        display.textContent = random.name;'
                + '    }, 80);'
                + ''
                + '    setTimeout(function() {'
                + '        clearInterval(rollCallInterval);'
                + '        rollCallInterval = null;'
                + '        btn.textContent = \'开始点名\';'
                + '        display.classList.remove(\'rolling\');'
                + ''
                + '        var selected = students[Math.floor(Math.random() * students.length)];'
                + '        display.textContent = selected.name;'
                + ''
                + '        document.querySelectorAll(\'.student-chip\').forEach(function(chip) { return chip.classList.remove(\'selected\'; }));'
                + '        document.getElementById(\'chip-\' + selected.id + \'\').classList.add(\'selected\');'
                + ''
                + '        var record = {'
                + '            id: Date.now().toString(),'
                + '            studentId: selected.id,'
                + '            studentName: selected.name,'
                + '            time: new Date().toLocaleString(\'zh-CN\'),'
                + '            answered: false'
                + '        };'
                + '        rollCallHistory.push(record);'
                + '        saveClassIsolatedData(\'rollCallHistory\', rollCallHistory);'
                + '        renderRollCallPage();'
                + ''
                + '        showToast(\'点名: \' + selected.name + \'\', \'success\');'
                + '    }, 3000);'
                + '}'
                + ''
                + 'function markAnswered(recordId, answered) {'
                + '    var record = rollCallHistory.find(function(r) { return r.id === recordId; });'
                + '    if (record) {'
                + '        record.answered = answered;'
                + '        saveClassIsolatedData(\'rollCallHistory\', rollCallHistory);'
                + '        renderRollCallPage();'
                + '    }'
                + '}'
                + ''
                + '// 作业管理'
                + 'function renderHomeworkPage() {'
                + '    var container = document.getElementById(\'homeworkListContainer\');'
                + '    container.innerHTML = homeworkData.map(function(hw) {'
                + '        var submitted = Object.keys(hw.submissions).length;'
                + '        var graded = 0;'
                + '        for (var sk in hw.submissions) { if (hw.submissions[sk].graded) graded++; }'
                + '        var total = students.length;'
                + '        var progress = Math.round((submitted / total) * 100);'
                + ''
                + '        return ''
            <div class="card">
                <div class="card-body">
                    <div class="homework-item" style="margin-bottom:0;">
                        <div class="homework-header">
                            <div>
                                <div class="homework-title">' + hw.title + '</div>
                                <div class="homework-meta">' + hw.desc + '</div>
                                <div class="homework-meta" style="margin-top:4px;">截止: ' + new Date(hw.deadline).toLocaleString('zh-CN') + '</div>
                            </div>
                            <button class="btn btn-info btn-sm" onclick="viewSubmissions('' + hw.id + '')">查看提交</button>
                        </div>
                        <div class="homework-stats">
                            <div class="homework-stat">
                                <div class="homework-stat-value">' + submitted + '</div>
                                <div class="homework-stat-label">已提交</div>
                            </div>
                            <div class="homework-stat">
                                <div class="homework-stat-value">' + graded + '</div>
                                <div class="homework-stat-label">已批改</div>
                            </div>
                            <div class="homework-stat">
                                <div class="homework-stat-value">' + total - submitted + '</div>
                                <div class="homework-stat-label">未提交</div>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:' + progress + '%"></div>
                        </div>
                    </div>
                </div>
            </div>
        ';
    }).join('');

    renderPendingSubmissions();
}

function renderPendingSubmissions() {
    var container = document.getElementById('pendingSubmissions');
    var pending = [];
    homeworkData.forEach(function(hw) {
        var submissions = hw.submissions;
        for (var sid in submissions) {
            if (submissions.hasOwnProperty(sid)) {
                var sub = submissions[sid];
                if (!sub.graded) {
                    var student = students.find(function(s) { return s.id === sid; });
                    var item = {};
                    for (var key in sub) { item[key] = sub[key]; }
                    item.student = student;
                    item.hwTitle = hw.title;
                    item.hwId = hw.id;
                    item.studentId = sid;
                    pending.push(item);
                }
            }
        }
    });

    container.innerHTML = pending.map(function(p) {
        return '<div class="homework-item">\' +'
                + '            \'<div class="homework-header">\' +'
                + '                \'<div>\' +'
                + '                    \'<div class="homework-title">\' + p.hwTitle + \'</div>\' +'
                + '                    \'<div class="homework-meta">提交学生: \' + p.student.name + \' | 提交时间: \' + p.submittedAt + \'</div>\' +'
                + '                \'</div>\' +'
                + '                \'<button class="btn btn-success btn-sm" onclick="openGradeModal('\' + p.hwId + \'', '\' + p.studentId + \'')">去批改</button>\' +'
                + '            \'</div>\' +'
                + '        \'</div>\';'
                + '    }).join(\'\') || \'<div class="empty-state">暂无待批改作业</div>\';'
                + '}'
                + ''
                + 'function viewSubmissions(hwId) {'
                + '    var hw = homeworkData.find(function(h) { return h.id === hwId; });'
                + '    if (!hw) return;'
                + ''
                + '    var html = \'<h4 style="margin-bottom:16px;">\' + hw.title + \' - 提交情况</h4>\';'
                + '    html += \'<table class="data-table"><thead><tr><th>学生</th><th>状态</th><th>提交时间</th><th>成绩</th><th>操作</th></tr></thead><tbody>\';'
                + ''
                + '    students.forEach(function(s) {'
                + '        var sub = hw.submissions[s.id];'
                + '        if (sub) {'
                + '            html += ''
                <tr>
                    <td>' + s.name + '</td>
                    <td><span class="badge badge-success">已提交</span></td>
                    <td>' + sub.submittedAt + '</td>
                    <td>' + (sub.score !== undefined ? sub.score : '-') + '</td>
                    <td>
                        ' + (!sub.graded ? '<button class="btn btn-success btn-sm" onclick="openGradeModal(\'' + hwId + '\', \'' + s.id + '\')">批改</button>' : '<span class="badge badge-info">已批改</span>') + '
                    </td>
                </tr>
            ';
        } else {
            html += '
                <tr>
                    <td>' + s.name + '</td>
                    <td><span class="badge badge-warning">未提交</span></td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                </tr>
            ';
        }
    });

    html += '</tbody></table>';

    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = '
        <div class="modal" style="max-width:800px;">
            <div class="modal-header">
                <h3>作业提交详情</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">' + html + '</div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">关闭</button>
            </div>
        </div>
    ';
    document.body.appendChild(modal);
}

function createHomework() {
    var title = document.getElementById('hwTitle').value;
    var desc = document.getElementById('hwDesc').value;
    var deadline = document.getElementById('hwDeadline').value;

    if (!title || !deadline) {
        showToast('请填写完整信息', 'error');
        return;
    }

    homeworkData.push({
        id: 'hw' + Date.now(),
        title,
        desc,
        deadline,
        createdAt: new Date().toISOString().split('T')[0],
        submissions: {}
    });

    saveClassIsolatedData('homeworkData', homeworkData);
    hideModal('createHomeworkModal');
    renderHomeworkPage();
    renderDashboardHomework();
    showToast('作业发布成功！', 'success');

    document.getElementById('hwTitle').value = '';
    document.getElementById('hwDesc').value = '';
    document.getElementById('hwDeadline').value = '';
}

function openGradeModal(hwId, studentId) {
    currentGradeSubmission = { hwId: hwId, studentId: studentId };
    var hw = homeworkData.find(function(h) { return h.id === hwId; });
    var student = students.find(function(s) { return s.id === studentId; });
    var sub = hw.submissions[studentId];

    document.getElementById('gradeStudentInfo').innerHTML = '
        <p><strong>作业:</strong> ' + hw.title + '</p>
        <p><strong>学生:</strong> ' + student.name + '</p>
        <p><strong>提交时间:</strong> ' + sub.submittedAt + '</p>
        ' + (sub.fileName ? '<p><strong>附件:</strong> ' + sub.fileName + '</p>' : '') + '
        ' + (sub.comment ? '<p><strong>学生备注:</strong> ' + sub.comment + '</p>' : '') + '
        <hr style="margin:16px 0; border:none; border-top:1px solid var(--border);">
    ';

    document.getElementById('gradeScore').value = sub.score || '';
    document.getElementById('gradeComment').value = sub.comment || '';
    updateStarDisplay(sub.score ? Math.ceil(sub.score / 20) : 0);

    showModal('gradeModal');
}

function setGrade(stars) {
    updateStarDisplay(stars);
    document.getElementById('gradeScore').value = stars * 20;
}

function updateStarDisplay(filled) {
    document.querySelectorAll('#gradeStars .star').forEach(function(star, i) {
        star.classList.toggle('filled', i < filled);
    });
}

function submitGrade() {
    if (!currentGradeSubmission) return;
    var hwId = currentGradeSubmission.hwId;
    var studentId = currentGradeSubmission.studentId;
    var hw = homeworkData.find(function(h) { return h.id === hwId; });

    if (hw && hw.submissions[studentId]) {
        hw.submissions[studentId].score = parseInt(document.getElementById('gradeScore').value) || 0;
        hw.submissions[studentId].teacherComment = document.getElementById('gradeComment').value;
        hw.submissions[studentId].graded = true;
        hw.submissions[studentId].gradedAt = new Date().toLocaleString('zh-CN');

        saveClassIsolatedData('homeworkData', homeworkData);
        hideModal('gradeModal');
        renderHomeworkPage();
        updateStats();
        showToast('评分提交成功！', 'success');
    }
}

// 在线监督 - 视频进度监控
function renderMonitorPage() {
    // 填充视频选择下拉
    var select = document.getElementById('monitorVideoSelect');
    if (select.children.length === 0) {
        select.innerHTML = videoData.map(function(v) { return '<option value="\' + v.id + \'">\' + v.title + \'</option>\'; }).join(\'\');'
                + '    }'
                + '    var selectedVideoId = select.value || (videoData[0] && videoData[0].id);'
                + '    var video = videoData.find(function(v) { return v.id === selectedVideoId; });'
                + '    if (!video) return;'
                + ''
                + '    document.getElementById(\'monitorTotalVideos\').textContent = videoData.length;'
                + ''
                + '    var grid = document.getElementById(\'monitorGrid\');'
                + '    var completed = 0, watching = 0, notStarted = 0;'
                + ''
                + '    grid.innerHTML = students.map(function(s) {'
                + '        var sp = (videoProgressData[s.id] || {})[selectedVideoId];'
                + '        var progress = 0, statusBadge = \'\', statusText = \'未开始\', barColor = \'var(--danger)\';'
                + ''
                + '        if (sp) {'
                + '            progress = Math.min(100, Math.round((sp.watched / video.duration) * 100));'
                + '            if (sp.completed) {'
                + '                statusBadge = \'<span class="badge badge-success">已完成</span>\';'
                + '                statusText = \'已完成\';'
                + '                barColor = \'var(--success)\';'
                + '                completed++;'
                + '            } else if (progress > 0) {'
                + '                statusBadge = \'<span class="badge badge-warning">学习中</span>\';'
                + '                statusText = \'学习中\';'
                + '                barColor = \'var(--accent)\';'
                + '                watching++;'
                + '            }'
                + '        } else {'
                + '            statusBadge = \'<span class="badge badge-danger">未开始</span>\';'
                + '            notStarted++;'
                + '        }'
                + ''
                + '        return ''
            <div class="monitor-card">
                <div class="monitor-header">
                    <div class="monitor-avatar">' + s.avatar + '</div>
                    <div class="monitor-info">
                        <h4>' + s.name + '</h4>
                        <span>' + statusText + '</span>
                    </div>
                    ' + statusBadge + '
                </div>
                <div style="margin-top:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary);">观看进度</span>
                        <span style="font-size:0.85rem; font-weight:600; color:var(--primary);">' + progress + '%</span>
                    </div>
                    <div class="progress-bar" style="height:8px;">
                        <div class="progress-fill" style="width:' + progress + '%; background:' + barColor + ';"></div>
                    </div>
                </div>
                <div class="monitor-stats-row" style="margin-top:12px;">
                    <div class="monitor-stat">
                        <div class="monitor-stat-value">' + formatSeconds(sp ? sp.watched : 0) + '</div>
                        <div class="monitor-stat-label">已观看</div>
                    </div>
                    <div class="monitor-stat">
                        <div class="monitor-stat-value">' + formatSeconds(video.duration) + '</div>
                        <div class="monitor-stat-label">总时长</div>
                    </div>
                    <div class="monitor-stat">
                        <div class="monitor-stat-value">' + sp ? sp.lastWatched : '-' + '</div>
                        <div class="monitor-stat-label">最后观看</div>
                    </div>
                </div>
            </div>
        ';
    }).join('');

    document.getElementById('monitorCompleted').textContent = completed;
    document.getElementById('monitorWatching').textContent = watching;
    document.getElementById('monitorNotStarted').textContent = notStarted;
}

function formatSeconds(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    var sStr = s.toString();
    if (sStr.length < 2) sStr = '0' + sStr;
    return '' + m + ':' + sStr + '';
}

// ===== 学生端 =====
function showStudentPage(pageId) {
    document.querySelectorAll('#studentApp .page').forEach(function(p) { return p.classList.add('hidden'; }));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelectorAll('#studentApp .sidebar-nav .nav-item').forEach(function(item) { return item.classList.remove('active'; }));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (pageId === 'studentClasses') { renderStudentClassPage(); updateAllStudentClassSelectors(); }
    if (pageId === 'studentDashboard') { initStudentDashboard(); updateAllStudentClassSelectors(); }
    if (pageId === 'studentHomework') { renderStudentHomework(); updateAllStudentClassSelectors(); }
    if (pageId === 'studentGrades') { renderStudentGrades(); updateAllStudentClassSelectors(); }
    if (pageId === 'studentLearning') { renderLearningResources(); updateAllStudentClassSelectors(); }
}

function initStudentDashboard() {
    var studentId = 's1';
    var today = new Date().toISOString().split('T')[0];
    var todayData = attendanceData[today] || {};
    var myStatus = todayData[studentId];

    document.getElementById('studentCheckinStatus').textContent = myStatus === 'present' ? '已签到' : myStatus === 'late' ? '迟到' : '未签到';
    document.getElementById('studentCheckinStatus').className = 'badge ' + myStatus === 'present' ? 'badge-success' : myStatus === 'late' ? 'badge-warning' : 'badge-info' + '';

    // 渲染最新作业
    var hwContainer = document.getElementById('studentDashboardHomework');
    hwContainer.innerHTML = homeworkData.slice(0, 2).map(function(hw) {
        var sub = hw.submissions[studentId];
        var statusBadge = '<span class="badge badge-warning">待完成</span>';
        if (sub) {
            statusBadge = sub.graded ? '<span class="badge badge-success">已批改 ' + sub.score + '分</span>' : '<span class="badge badge-info">已提交</span>';
        }
        return '
            <div class="homework-item">
                <div class="homework-header">
                    <div>
                        <div class="homework-title">' + hw.title + '</div>
                        <div class="homework-meta">截止: ' + new Date(hw.deadline).toLocaleString('zh-CN') + '</div>
                    </div>
                    ' + statusBadge + '
                </div>
            </div>
        ';
    }).join('');

    // 渲染最近成绩
    var gradesContainer = document.getElementById('studentRecentGrades');
    var grades = [];
    homeworkData.forEach(function(hw) {
        if (hw.submissions[studentId] && hw.submissions[studentId].graded) {
            grades.push({ title: hw.title, score: hw.submissions[studentId].score });
        }
    });

    gradesContainer.innerHTML = grades.slice(0, 3).map(function(g) {
        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border);">\' +'
                + '            \'<span>\' + g.title + \'</span>\' +'
                + '            \'<span style="font-weight:700; color:var(--primary); font-size:1.2rem;">\' + g.score + \'分</span>\' +'
                + '        \'</div>\';'
                + '    }).join(\'\') || \'<div class="empty-state">暂无成绩记录</div>\';'
                + '}'
                + ''
                + 'function studentCheckin() {'
                + '    var input = document.getElementById(\'studentCheckinInput\').value;'
                + '    if (!checkinCode) {'
                + '        showToast(\'当前没有进行中的签到\', \'error\');'
                + '        return;'
                + '    }'
                + '    if (input !== checkinCode) {'
                + '        showToast(\'签到码错误\', \'error\');'
                + '        return;'
                + '    }'
                + ''
                + '    var today = new Date().toISOString().split(\'T\')[0];'
                + '    if (!attendanceData[today]) attendanceData[today] = {};'
                + '    attendanceData[today][\'s1\'] = \'present\';'
                + '    saveStudentClassIsolatedData(\'attendanceData\', attendanceData);'
                + ''
                + '    document.getElementById(\'studentCheckinStatus\').textContent = \'已签到\';'
                + '    document.getElementById(\'studentCheckinStatus\').className = \'badge badge-success\';'
                + '    document.getElementById(\'studentCheckinInput\').value = \'\';'
                + '    showToast(\'签到成功！\', \'success\');'
                + '    renderStudentCheckinHistory();'
                + '}'
                + ''
                + 'function renderStudentCheckinHistory() {'
                + '    var tbody = document.getElementById(\'studentCheckinHistory\');'
                + '    if (!tbody) return;'
                + '    var dates = Object.keys(attendanceData).sort().reverse();'
                + ''
                + '    tbody.innerHTML = dates.map(function(date) {'
                + '        var status = attendanceData[date][\'s1\'];'
                + '        if (!status) return \'\';'
                + '        var badge = \'\';'
                + '        if (status === \'present\') badge = \'<span class="badge badge-success">已签到</span>\';'
                + '        else if (status === \'late\') badge = \'<span class="badge badge-warning">迟到</span>\';'
                + '        else badge = \'<span class="badge badge-danger">缺勤</span>\';'
                + ''
                + '        return ''
            <tr>
                <td>' + date + '</td>
                <td>' + badge + '</td>
                <td>08:30</td>
            </tr>
        ';
    }).join('') || '<tr><td colspan="3" style="text-align:center; color:var(--text-secondary);">暂无记录</td></tr>';
}

function renderStudentHomework() {
    var studentId = 's1';

    // 待完成
    var pending = homeworkData.filter(function(hw) { return !hw.submissions[studentId]; });
    document.getElementById('studentPendingHomework').innerHTML = pending.map(function(hw) {
        return '<div class="homework-item">\' +'
                + '            \'<div class="homework-header">\' +'
                + '                \'<div>\' +'
                + '                    \'<div class="homework-title">\' + hw.title + \'</div>\' +'
                + '                    \'<div class="homework-meta">\' + hw.desc + \'</div>\' +'
                + '                    \'<div class="homework-meta" style="margin-top:4px; color:var(--danger);">截止: \' + new Date(hw.deadline).toLocaleString(\'zh-CN\') + \'</div>\' +'
                + '                \'</div>\' +'
                + '                \'<button class="btn btn-success btn-sm" onclick="openSubmitModal('\' + hw.id + \'')">去提交</button>\' +'
                + '            \'</div>\' +'
                + '        \'</div>\';'
                + '    }).join(\'\') || \'<div class="empty-state">暂无待完成作业</div>\';'
                + ''
                + '    // 已提交'
                + '    var submitted = homeworkData.filter(function(hw) { return hw.submissions[studentId] && !hw.submissions[studentId].graded; });'
                + '    document.getElementById(\'studentSubmittedHomework\').innerHTML = submitted.map(function(hw) {'
                + '        return \'<div class="homework-item">\' +'
                + '            \'<div class="homework-header">\' +'
                + '                \'<div>\' +'
                + '                    \'<div class="homework-title">\' + hw.title + \'</div>\' +'
                + '                    \'<div class="homework-meta">提交时间: \' + hw.submissions[studentId].submittedAt + \'</div>\' +'
                + '                \'</div>\' +'
                + '                \'<span class="badge badge-info">待批改</span>\' +'
                + '            \'</div>\' +'
                + '        \'</div>\';'
                + '    }).join(\'\') || \'<div class="empty-state">暂无已提交作业</div>\';'
                + ''
                + '    // 已批改'
                + '    var graded = homeworkData.filter(function(hw) { return hw.submissions[studentId] && hw.submissions[studentId].graded; });'
                + '    document.getElementById(\'studentGradedHomework\').innerHTML = graded.map(function(hw) {'
                + '        var comment = hw.submissions[studentId].teacherComment;'
                + '        return \'<div class="homework-item">\' +'
                + '            \'<div class="homework-header">\' +'
                + '                \'<div>\' +'
                + '                    \'<div class="homework-title">\' + hw.title + \'</div>\' +'
                + '                    \'<div class="homework-meta">提交时间: \' + hw.submissions[studentId].submittedAt + \'</div>\' +'
                + '                \'</div>\' +'
                + '                \'<span class="badge badge-success">\' + hw.submissions[studentId].score + \'分</span>\' +'
                + '            \'</div>\' +'
                + '            (comment ? \'<div class="comment-box"><strong>教师评语:</strong> \' + comment + \'</div>\' : \'\') +'
                + '        \'</div>\';'
                + '    }).join(\'\') || \'<div class="empty-state">暂无已批改作业</div>\';'
                + '}'
                + ''
                + 'function openSubmitModal(hwId) {'
                + '    currentSubmitHomework = hwId;'
                + '    var hw = homeworkData.find(function(h) { return h.id === hwId; });'
                + '    document.getElementById(\'submitHwInfo\').innerHTML = ''
        <p><strong>作业:</strong> ' + hw.title + '</p>
        <p><strong>要求:</strong> ' + hw.desc + '</p>
        <hr style="margin:16px 0; border:none; border-top:1px solid var(--border);">
    ';
    document.getElementById('selectedFile').style.display = 'none';
    document.getElementById('submitComment').value = '';
    showModal('submitHomeworkModal');
}

function handleFileSelect(event) {
    var file = event.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('selectedFile').style.display = 'block';
    }
}

function submitHomework() {
    if (!currentSubmitHomework) return;
    var hw = homeworkData.find(function(h) { return h.id === currentSubmitHomework; });
    if (hw) {
        hw.submissions['s1'] = {
            submittedAt: new Date().toLocaleString('zh-CN'),
            fileName: document.getElementById('fileName').textContent || null,
            comment: document.getElementById('submitComment').value,
            graded: false
        };
        saveStudentClassIsolatedData('homeworkData', homeworkData);
        hideModal('submitHomeworkModal');
        renderStudentHomework();
        showToast('作业提交成功！', 'success');
    }
}

function renderStudentGrades() {
    var studentId = 's1';
    var tbody = document.getElementById('studentGradeTable');
    var grades = [];

    homeworkData.forEach(function(hw) {
        if (hw.submissions[studentId] && hw.submissions[studentId].graded) {
            grades.push({
                title: hw.title,
                submittedAt: hw.submissions[studentId].submittedAt,
                score: hw.submissions[studentId].score,
                comment: hw.submissions[studentId].teacherComment || '无评语'
            });
        }
    });

    tbody.innerHTML = grades.map(function(g) {
        var badgeClass = g.score >= 90 ? 'badge-success' : (g.score >= 80 ? 'badge-info' : 'badge-warning');
        return '<tr>\' +'
                + '            \'<td>\' + g.title + \'</td>\' +'
                + '            \'<td>\' + g.submittedAt + \'</td>\' +'
                + '            \'<td><span class="badge \' + badgeClass + \'">\' + g.score + \'</span></td>\' +'
                + '            \'<td>\' + g.comment + \'</td>\' +'
                + '        \'</tr>\';'
                + '    }).join(\'\') || \'<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">暂无成绩记录</td></tr>\';'
                + ''
                + '    // 成绩趋势图'
                + '    var trend = document.getElementById(\'gradeTrend\');'
                + '    trend.innerHTML = grades.slice(-6).map(function(g) {'
                + '        return \'<div style="display:flex; flex-direction:column; align-items:center; gap:8px;">\' +'
                + '            \'<div style="width:40px; background:var(--primary); border-radius:4px 4px 0 0; height:\' + g.score * 1.5 + \'px; opacity:0.8;"></div>\' +'
                + '            \'<span style="font-size:0.75rem; color:var(--text-secondary);">\' + g.score + \'</span>\' +'
                + '        \'</div>\';'
                + '    }).join(\'\');'
                + '}'
                + ''
                + '// 学生端 - 视频学习'
                + 'function renderLearningResources() {'
                + '    var container = document.getElementById(\'learningResources\');'
                + '    var studentId = \'s1\';'
                + ''
                + '    container.innerHTML = videoData.map(function(v) {'
                + '        var sp = ((videoProgressData[studentId] || {})[v.id]) || {};'
                + '        var progress = v.duration > 0 ? Math.min(100, Math.round((sp.watched || 0) / v.duration * 100)) : 0;'
                + '        var statusBadge = \'<span class="badge badge-danger">未开始</span>\';'
                + '        if (sp.completed) statusBadge = \'<span class="badge badge-success">已完成</span>\';'
                + '        else if (progress > 0) statusBadge = \'<span class="badge badge-warning">学习中 \' + progress + \'%</span>\';'
                + ''
                + '        return ''
            <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:var(--bg-primary); border-radius:var(--radius-sm); margin-bottom:12px;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                        <svg width="20" height="20" fill="none" stroke="var(--primary)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span style="font-weight:600;">' + v.title + '</span>
                        ' + statusBadge + '
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">' + v.desc + '</div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="progress-bar" style="flex:1; height:6px;">
                            <div class="progress-fill" style="width:' + progress + '%; background:' + sp.completed ? 'var(--success)' : 'var(--accent)' + ';"></div>
                        </div>
                        <span style="font-size:0.8rem; color:var(--text-secondary); min-width:70px; text-align:right;">' + progress + '% · ' + formatSeconds(v.duration) + '</span>
                    </div>
                </div>
                <button class="btn ' + sp.completed ? 'btn-outline' : 'btn-success' + ' btn-sm" style="margin-left:16px;" onclick="playVideo('' + v.id + '')">
                    ' + sp.completed ? '重新观看' : progress > 0 ? '继续观看' : '开始观看' + '
                </button>
            </div>
        ';
    }).join('') || '<div class="empty-state">暂无学习视频，请等待教师上传</div>';
}

function playVideo(videoId) {
    var video = videoData.find(function(v) { return v.id === videoId; });
    if (!video) return;

    currentPlayingVideoId = videoId;
    var studentId = 's1';

    document.getElementById('videoListArea').style.display = 'none';
    document.getElementById('videoPlayerCard').style.display = 'block';
    document.getElementById('currentVideoTitle').textContent = video.title;
    document.getElementById('learningStatus').textContent = '学习中';
    document.getElementById('learningStatus').className = 'badge badge-success';

    var videoEl = document.getElementById('learningVideo');
    if (video.url) {
        videoEl.src = video.url;
        // 恢复上次观看位置
        var sp = ((videoProgressData[studentId] || {})[videoId]) || {};
        if (sp.watched) {
            videoEl.currentTime = sp.watched;
        }
        videoEl.play();
    } else {
        // 无实际文件时用模拟模式
        videoEl.removeAttribute('src');
        videoEl.load();
        simulateVideoPlayback(video);
    }

    updateVideoProgressUI(video);
}

function simulateVideoPlayback(video) {
    var studentId = 's1';
    if (!videoProgressData[studentId]) videoProgressData[studentId] = {};
    if (!videoProgressData[studentId][video.id]) {
        videoProgressData[studentId][video.id] = { watched: 0, completed: false, lastWatched: new Date().toISOString().split('T')[0] };
    }

    if (window._simInterval) clearInterval(window._simInterval);
    window._simInterval = setInterval(function() {
        if (currentPlayingVideoId !== video.id) { clearInterval(window._simInterval); return; }
        var sp = videoProgressData[studentId][video.id];
        if (sp.completed) { clearInterval(window._simInterval); return; }

        sp.watched = Math.min(video.duration, sp.watched + 5);
        sp.lastWatched = new Date().toISOString().split('T')[0];
        if (sp.watched >= video.duration) {
            sp.completed = true;
            sp.watched = video.duration;
            clearInterval(window._simInterval);
            document.getElementById('learningStatus').textContent = '已完成';
            document.getElementById('learningStatus').className = 'badge badge-success';
            showToast('恭喜！视频观看完成', 'success');
        }
        saveStudentClassIsolatedData('videoProgressData', videoProgressData);
        updateVideoProgressUI(video);
    }, 1000);
}

function onVideoTimeUpdate() {
    var videoEl = document.getElementById('learningVideo');
    var videoId = currentPlayingVideoId;
    if (!videoId || !videoEl.duration) return;

    var video = videoData.find(function(v) { return v.id === videoId; });
    if (!video) return;

    var studentId = 's1';
    if (!videoProgressData[studentId]) videoProgressData[studentId] = {};
    if (!videoProgressData[studentId][videoId]) {
        videoProgressData[studentId][videoId] = { watched: 0, completed: false, lastWatched: new Date().toISOString().split('T')[0] };
    }

    var sp = videoProgressData[studentId][videoId];
    sp.watched = Math.floor(videoEl.currentTime);
    sp.lastWatched = new Date().toISOString().split('T')[0];

    // 视看超过95%视为完成
    if (videoEl.currentTime / videoEl.duration >= 0.95 && !sp.completed) {
        sp.completed = true;
        showToast('恭喜！视频观看完成', 'success');
    }

    saveStudentClassIsolatedData('videoProgressData', videoProgressData);
    updateVideoProgressUI(video);
}

function onVideoEnded() {
    var videoId = currentPlayingVideoId;
    if (!videoId) return;
    var studentId = 's1';
    if (!videoProgressData[studentId]) videoProgressData[studentId] = {};
    if (!videoProgressData[studentId][videoId]) {
        videoProgressData[studentId][videoId] = { watched: 0, completed: false, lastWatched: '' };
    }
    videoProgressData[studentId][videoId].completed = true;
    var video = videoData.find(function(v) { return v.id === videoId; });
    if (video) videoProgressData[studentId][videoId].watched = video.duration;
    videoProgressData[studentId][videoId].lastWatched = new Date().toISOString().split('T')[0];
    saveStudentClassIsolatedData('videoProgressData', videoProgressData);
    document.getElementById('learningStatus').textContent = '已完成';
    document.getElementById('learningStatus').className = 'badge badge-success';
    showToast('恭喜！视频观看完成', 'success');
}

function updateVideoProgressUI(video) {
    var studentId = 's1';
    var sp = ((videoProgressData[studentId] || {})[video.id]) || {};
    var watched = sp.watched || 0;
    var progress = video.duration > 0 ? Math.min(100, Math.round((watched / video.duration) * 100)) : 0;

    document.getElementById('videoProgressText').textContent = progress + '%';
    document.getElementById('videoProgressBar').style.width = progress + '%';
    document.getElementById('videoWatchedTime').textContent = formatSeconds(watched);
    document.getElementById('videoTotalTime').textContent = formatSeconds(video.duration);
}

function closeVideoPlayer() {
    if (window._simInterval) clearInterval(window._simInterval);
    var videoEl = document.getElementById('learningVideo');
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
    currentPlayingVideoId = null;

    document.getElementById('videoPlayerCard').style.display = 'none';
    document.getElementById('videoListArea').style.display = 'block';
    document.getElementById('learningStatus').textContent = '未在学习';
    document.getElementById('learningStatus').className = 'badge badge-info';

    renderLearningResources();
}

// 教师上传视频
function handleVideoFileSelect(event) {
    var file = event.target.files[0];
    if (file) {
        selectedVideoFile = file;
        document.getElementById('videoFileName').textContent = file.name;
        document.getElementById('selectedVideoFile').style.display = 'block';
    }
}

function uploadVideo() {
    var title = document.getElementById('videoTitle').value;
    var desc = document.getElementById('videoDesc').value;

    if (!title) {
        showToast('请输入视频标题', 'error');
        return;
    }

    var newVideo = {
        id: 'v' + Date.now(),
        title: title,
        desc: desc || '暂无描述',
        duration: selectedVideoFile ? 0 : 1800,
        uploadedAt: new Date().toISOString().split('T')[0],
        url: ''
    };

    // 如果有文件，创建本地URL
    if (selectedVideoFile) {
        var url = URL.createObjectURL(selectedVideoFile);
        newVideo.url = url;
        // 获取视频时长
        var tempVideo = document.createElement('video');
        tempVideo.preload = 'metadata';
        tempVideo.src = url;
        tempVideo.onloadedmetadata = function() {
            newVideo.duration = Math.floor(tempVideo.duration);
            videoData.push(newVideo);
            saveClassIsolatedData('videoData', videoData.map(function(v) { var copy = {}; for (var k in v) { copy[k] = v[k]; } copy.url = ''; return copy; })); // 不存blob URL
            hideModal('uploadVideoModal');
            renderMonitorPage();
            showToast('视频发布成功！', 'success');
            document.getElementById('videoTitle').value = '';
            document.getElementById('videoDesc').value = '';
            selectedVideoFile = null;
        };
    } else {
        videoData.push(newVideo);
        saveClassIsolatedData('videoData', videoData);
        hideModal('uploadVideoModal');
        renderMonitorPage();
        showToast('视频发布成功！', 'success');
        document.getElementById('videoTitle').value = '';
        document.getElementById('videoDesc').value = '';
    }
}

// ===== 通用工具 =====
function switchTab(tab, contentId) {
    tab.parentElement.querySelectorAll('.tab').forEach(function(t) { return t.classList.remove('active'; }));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function(c) { return c.classList.remove('active'; }));
    document.getElementById(contentId).classList.add('active');
}

function switchStudentTab(tab, contentId) {
    tab.parentElement.querySelectorAll('.tab').forEach(function(t) { return t.classList.remove('active'; }));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function(c) { return c.classList.remove('active'; }));
    document.getElementById(contentId).classList.add('active');
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type) {
    if (!type) type = 'success';
    var toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

// 点击模态框外部关闭
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.classList.remove('active');
    });
});

// 初始化（安全调用，防止DOM不存在时报错）
try { renderStudentCheckinHistory(); } catch(e) {}
try { updateAllTeacherClassSelectors(); } catch(e) {}
try { updateAllStudentClassSelectors(); } catch(e) {}
