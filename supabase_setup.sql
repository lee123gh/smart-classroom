-- ===== 智学课堂 Supabase 建表 SQL =====
-- 在 Supabase 控制台 → SQL Editor 中执行以下全部内容

-- 1. 用户表（教师+学生统一存储）
CREATE TABLE IF NOT EXISTS app_users (
    user_id TEXT PRIMARY KEY,          -- 学号/工号
    name TEXT NOT NULL,                -- 姓名
    phone TEXT,                        -- 手机号
    password_hash TEXT NOT NULL,       -- SHA-256 哈希
    role TEXT NOT NULL DEFAULT 'student', -- teacher / student
    class_name TEXT,                   -- 学生所属班级名称
    class_id TEXT,                     -- 学生所属班级ID
    registered_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 班级表
CREATE TABLE IF NOT EXISTS app_classes (
    id TEXT PRIMARY KEY,               -- class_xxx
    name TEXT NOT NULL,                -- 班级名称
    code TEXT,                         -- 6位班级码
    teacher_name TEXT,
    students JSONB DEFAULT '[]'::jsonb, -- 学生列表
    created_at TEXT
);

-- 3. 班级隔离数据表（考勤、作业、视频等）
CREATE TABLE IF NOT EXISTS app_data (
    data_key TEXT NOT NULL,            -- attendanceData / homeworkData / videoData 等
    class_id TEXT NOT NULL,
    data_value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (data_key, class_id)
);

-- 4. 学生加入班级关联表
CREATE TABLE IF NOT EXISTS app_student_classes (
    user_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    class_name TEXT,
    class_code TEXT,
    joined_at TEXT,
    PRIMARY KEY (user_id, class_id)
);

-- ===== 开启 RLS（行级安全）并允许匿名访问 =====
-- 因为是前端直连，使用 anon key，需要允许匿名读写

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_student_classes ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户的所有操作（开发阶段用，生产环境应收紧权限）
CREATE POLICY "允许匿名访问用户表" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "允许匿名访问班级表" ON app_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "允许匿名访问数据表" ON app_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "允许匿名访问学生班级表" ON app_student_classes FOR ALL USING (true) WITH CHECK (true);
