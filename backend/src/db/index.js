import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

let dbInstance = null;
let usingPostgreSQL = false;

// 持久化文件路径
const PERSISTENCE_FILE = path.join(__dirname, '../../data/memory_db.json');

// 确保数据目录存在
const dataDir = path.dirname(PERSISTENCE_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * 加载持久化数据
 */
function loadPersistedData() {
  try {
    if (fs.existsSync(PERSISTENCE_FILE)) {
      const data = fs.readFileSync(PERSISTENCE_FILE, 'utf8');
      console.log('📁 从文件加载持久化数据:', PERSISTENCE_FILE);
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('⚠️ 加载持久化数据失败:', error);
  }
  return null;
}

/**
 * 保存数据到文件
 */
function saveDataToFile(data) {
  try {
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('💾 数据已保存到文件:', PERSISTENCE_FILE);
  } catch (error) {
    console.error('❌ 保存数据失败:', error);
  }
}

/**
 * 创建内存数据库模拟器（带持久化）
 */
function createMemoryDatabase() {
  // 尝试加载持久化数据
  const persistedData = loadPersistedData();
  
  const memoryData = persistedData || {
    // 用户表
    users: [
      {
        id: 1,
        username: 'admin',
        password_hash: '$2a$10$rQp8jQhYJ.KczB8y0EgO8OqP8z5g5X9P5l2fL4j5y9mNdO5G8WJ7W', // 密码: admin123
        email: 'admin@example.com',
        created_at: new Date()
      },
      {
        id: 2,
        username: 'admin163',
        password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 密码: password
        email: 'admin@163.com',
        created_at: new Date()
      }
    ],
    // 主播表
    anchors: [],
    // 直播间管理表
    live_rooms: [],
    // 实时监控表
    stream_monitor_rooms: [],
    // 录制记录表
    stream_recordings: [],
    // 排班表
    schedules: []
  };
  
  let nextId = persistedData ? 
    Math.max(
      ...Object.values(memoryData).flat().map(item => item.id || 0),
      3 // 确保从3开始
    ) + 1 : 3;

  // 定期保存数据的函数
  const saveData = () => {
    saveDataToFile({
      ...memoryData,
      _metadata: {
        lastSaved: new Date().toISOString(),
        nextId: nextId
      }
    });
  };

  // 每30秒自动保存一次
  setInterval(saveData, 30000);

  // 进程退出时保存数据
  process.on('SIGINT', () => {
    console.log('🔄 正在保存数据...');
    saveData();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('🔄 正在保存数据...');
    saveData();
    process.exit(0);
  });
  
  return {
    query: async (sql, params = []) => {
      console.log('🔄 内存数据库查询:', sql.slice(0, 80) + '...');
      console.log('🔍 完整SQL:', sql);
      console.log('🔍 参数数组:', params);
      console.log('🔍 参数详情:', params.map((p, i) => `[${i}]: ${JSON.stringify(p)} (${typeof p})`));
      
      try {
        const sqlLower = sql.toLowerCase().trim();
        console.log('🔍 处理后的SQL (小写):', sqlLower.slice(0, 100) + '...');
        
        // 添加详细的条件判断调试
        console.log('🔍 SQL条件检查:');
        console.log('  - includes("live_rooms"):', sqlLower.includes('live_rooms'));
        console.log('  - startsWith("insert"):', sqlLower.startsWith('insert'));
        console.log('  - includes("create table"):', sqlLower.includes('create table'));
        console.log('  - includes("users"):', sqlLower.includes('users'));
        console.log('  - includes("anchors"):', sqlLower.includes('anchors'));
        console.log('  - includes("stream_monitor_rooms"):', sqlLower.includes('stream_monitor_rooms'));
        
        // 忽略建表和索引语句
        if (sqlLower.includes('create table') || sqlLower.includes('create index') || sqlLower.includes('create trigger') || sqlLower.includes('create or replace function')) {
          return { rows: [] };
        }
        
        // 执行查询后自动保存（对于写操作）
        const isWriteOperation = sqlLower.startsWith('insert') || sqlLower.startsWith('update') || sqlLower.startsWith('delete');
        
        const result = await executeQuery(sqlLower, params, memoryData, nextId);
        
        // 如果是写操作，立即保存数据
        if (isWriteOperation) {
          saveData();
        }
        
        return result;
        
      } catch (error) {
        console.warn('内存数据库查询错误:', error);
        return { rows: [] };
      }
    }
  };
}

// 提取查询执行逻辑
async function executeQuery(sqlLower, params, memoryData, nextId) {
  // 用户表查询
  if (sqlLower.includes('users')) {
    if (sqlLower.startsWith('select') && (sqlLower.includes('where email') || sqlLower.includes('where phone_number'))) {
      const account = params[0];
      // 支持按邮箱或用户名查找
      const user = memoryData.users.find(u => u.email === account || u.username === account);
      return { rows: user ? [user] : [] };
    }
    if (sqlLower.startsWith('select') && sqlLower.includes('where username')) {
      const username = params[0];
      const user = memoryData.users.find(u => u.username === username);
      return { rows: user ? [user] : [] };
    }
    if (sqlLower.startsWith('select') && sqlLower.includes('where id')) {
      const userId = params[0];
      const user = memoryData.users.find(u => u.id == userId);
      return { rows: user ? [user] : [] };
    }
    if (sqlLower.startsWith('insert')) {
      const newUser = {
        id: nextId++,
        username: params[0],
        password_hash: params[1],
        email: params[2] || null,
        created_at: new Date()
      };
      memoryData.users.push(newUser);
      return { rows: [newUser] };
    }
  }
  
  // 直播间管理表查询 - 移到anchors之前，避免bound_anchors字段干扰
  if (sqlLower.includes('live_rooms')) {
    console.log('🎯 进入live_rooms处理分支');
    
    if (sqlLower.startsWith('select')) {
      console.log('🎯 进入SELECT分支');
      if (sqlLower.includes('where user_id')) {
        const userId = params[0];
        console.log('🔍 SELECT live_rooms 查询调试:');
        console.log('📊 查询用户ID:', userId, typeof userId);
        console.log('📊 当前live_rooms总数:', memoryData.live_rooms.length);
        console.log('📊 所有房间数据:', memoryData.live_rooms.map(r => ({ 
          id: r.id, 
          title: r.title, 
          user_id: r.user_id, 
          user_id_type: typeof r.user_id 
        })));
        
        const rooms = memoryData.live_rooms.filter(r => r.user_id == userId);
        console.log('📊 过滤后的房间:', rooms.map(r => ({ id: r.id, title: r.title, user_id: r.user_id })));
        return { rows: rooms };
      }
      if (sqlLower.includes('where id') && sqlLower.includes('and user_id')) {
        const roomId = params[0];
        const userId = params[1];
        const room = memoryData.live_rooms.find(r => r.id == roomId && r.user_id == userId);
        return { rows: room ? [room] : [] };
      }
      return { rows: memoryData.live_rooms };
    }
    if (sqlLower.startsWith('insert')) {
      console.log('🎯 进入INSERT分支');
      console.log('🔍 内存数据库INSERT参数调试:');
      console.log('📊 参数数组长度:', params.length);
      console.log('📊 参数详情:', params.map((p, i) => `params[${i}] = ${JSON.stringify(p)} (${typeof p})`));
      
      const newRoom = {
        id: nextId++,
        user_id: params[0],        
        title: params[1],          
        url: params[2],            
        streamer: params[3] || '未知主播',  
        platform: params[4] || '其他',     
        description: params[5] || '',      
        status: 'IDLE',            
        is_monitored: 0, // 默认值为0 (未监控)
        created_at: new Date(),    
        updated_at: new Date()     
      };
      
      console.log('📝 新房间对象:', newRoom);
      
      memoryData.live_rooms.push(newRoom);
      console.log('✅ 内存数据库插入成功:', { id: newRoom.id, title: newRoom.title, user_id: newRoom.user_id });
      console.log('📊 当前live_rooms数据:', memoryData.live_rooms.map(r => ({ id: r.id, title: r.title, user_id: r.user_id })));
      return { rows: [newRoom] };
    }
    if (sqlLower.startsWith('update')) {
      console.log('🎯 进入UPDATE分支');
      const roomId = params[params.length - 1]; // ID通常是最后一个参数
      const room = memoryData.live_rooms.find(r => r.id == roomId);
      
      if (room) {
        if (sqlLower.includes('set title')) {
          // 完整的更新
          room.title = params[0];
          room.url = params[1];
          room.streamer = params[2];
          room.description = params[3];
          room.updated_at = new Date();
        } else if (sqlLower.includes('set status')) {
          // 只更新状态
          room.status = params[0];
          room.updated_at = new Date();
        } else if (sqlLower.includes('set is_monitored')) {
          // 只更新监控状态
          room.is_monitored = params[0];
          room.updated_at = new Date();
        }
        
        console.log('📝 更新后的房间:', room);
        return { rows: [room], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sqlLower.startsWith('delete')) {
      const roomId = params[0];
      const userId = params[1]; 
      
      console.log('🔍 DELETE live_rooms 调试:');
      console.log('📊 roomId:', roomId, typeof roomId);
      console.log('📊 userId:', userId, typeof userId);
      
      const index = memoryData.live_rooms.findIndex(r => r.id == roomId && (!userId || r.user_id == userId));
      console.log('📊 找到的索引:', index);
      
      if (index !== -1) {
        const deleted = memoryData.live_rooms.splice(index, 1);
        console.log('✅ 删除成功:', deleted[0] ? { id: deleted[0].id, title: deleted[0].title } : 'null');
        return { rows: deleted };
      }
      console.log('❌ 未找到要删除的房间');
      return { rows: [] };
    }
  }

  // 主播表查询 - 增加 schedules 排除条件，避免JOIN查询冲突
  if (sqlLower.includes('anchors') && !sqlLower.includes('schedules')) {
    console.log('🎯 进入anchors处理分支');
    
    if (sqlLower.startsWith('select')) {
      if (sqlLower.includes('where user_id')) {
        const userId = params[0];
        console.log('🔍 SELECT anchors 查询调试:');
        console.log('📊 查询用户ID:', userId, typeof userId);
        console.log('📊 当前anchors总数:', memoryData.anchors.length);
        
        const anchors = memoryData.anchors.filter(a => a.user_id == userId);
        console.log('📊 过滤后的主播:', anchors.map(a => ({ id: a.id, name: a.name, user_id: a.user_id })));
        return { rows: anchors };
      }
      return { rows: memoryData.anchors };
    }
    if (sqlLower.startsWith('insert')) {
      console.log('🎯 进入INSERT分支');
      
      const newAnchor = {
        id: nextId++,
        user_id: params[0],     
        name: params[1],        
        avatar: params[2] || null,  
        gender: params[3] || 'male',
        age: params[4] || 25,       
        rating: params[5] || 'regular', 
        created_at: new Date(),
        updated_at: new Date()
      };
      
      memoryData.anchors.push(newAnchor);
      console.log('✅ 主播插入成功:', { id: newAnchor.id, name: newAnchor.name, user_id: newAnchor.user_id });
      return { rows: [newAnchor] };
    }
    if (sqlLower.startsWith('update')) {
      const anchorId = params[params.length - 1]; 
      
      console.log('🔍 UPDATE anchors 调试:');
      console.log('📊 anchorId:', anchorId, typeof anchorId);
      console.log('📊 当前anchors数量:', memoryData.anchors.length);
      
      const anchor = memoryData.anchors.find(a => a.id == anchorId);
      console.log('📊 找到的主播:', anchor ? { id: anchor.id, name: anchor.name } : 'null');
      
      if (anchor) {
        if (params[0] !== undefined) anchor.name = params[0];
        if (params[1] !== undefined) anchor.avatar = params[1];
        if (params[2] !== undefined) anchor.gender = params[2];
        if (params[3] !== undefined) anchor.age = params[3];
        if (params[4] !== undefined) anchor.rating = params[4];
        anchor.updated_at = new Date();
        
        console.log('✅ 主播更新成功:', { id: anchor.id, name: anchor.name, avatar: anchor.avatar });
        return { rows: [anchor] };
      }
      console.log('❌ 未找到要更新的主播');
      return { rows: [] };
    }
    if (sqlLower.startsWith('delete')) {
      const anchorId = params[0];
      console.log('🔍 DELETE anchors 调试:');
      console.log('📊 anchorId:', anchorId, typeof anchorId);
      console.log('📊 当前anchors数量:', memoryData.anchors.length);
      
      const index = memoryData.anchors.findIndex(a => a.id == anchorId);
      console.log('📊 找到的索引:', index);
      
      if (index !== -1) {
        const deleted = memoryData.anchors.splice(index, 1);
        console.log('✅ 删除成功:', deleted[0] ? { id: deleted[0].id, name: deleted[0].name } : 'null');
        console.log('📊 删除后anchors数量:', memoryData.anchors.length);
        return { rows: deleted };
      }
      console.log('❌ 未找到要删除的主播');
      return { rows: [] };
    }
  }

  // 排班表查询
  if (sqlLower.includes('schedules')) {
    console.log('🎯 进入schedules处理分支');
    
    if (sqlLower.startsWith('select')) {
        const userId = params[0];
        let schedules = memoryData.schedules.filter(s => s.user_id == userId);

        let dateParamIndex = params.findIndex(p => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p));
        if (dateParamIndex !== -1) {
            const date = params[dateParamIndex];
            schedules = schedules.filter(s => s.date === date);
        }

        let roomIdParamIndex = params.findIndex((p, i) => i > dateParamIndex && !isNaN(parseInt(p, 10)));
        if (roomIdParamIndex !== -1) {
            const roomId = params[roomIdParamIndex];
            schedules = schedules.filter(s => s.room_id == roomId);
        }

        // 模拟LEFT JOIN
        const joinedSchedules = schedules.map(schedule => {
            const anchor = memoryData.anchors.find(a => a.id == schedule.anchor_id);
            return {
                ...schedule,
                anchor_name: anchor ? anchor.name : '未知主播',
                anchor_avatar: anchor ? anchor.avatar : '',
                anchor_rating: anchor ? anchor.rating : 'regular'
            };
        });

        return { rows: joinedSchedules };
    }
    
    if (sqlLower.startsWith('insert')) {
      const newSchedule = {
        id: nextId++,
        user_id: params[0],
        anchor_id: params[1],
        date: params[2],
        time_slot: params[3],
        room_id: params[4],
        created_at: new Date()
      };
      memoryData.schedules.push(newSchedule);
      return { rows: [newSchedule] };
    }
    
    if (sqlLower.startsWith('delete')) {
      const [anchorId, date, timeSlot, roomId] = params;
      const initialLength = memoryData.schedules.length;
      memoryData.schedules = memoryData.schedules.filter(s => 
        !(s.anchor_id == anchorId && s.date === date && s.time_slot === timeSlot && s.room_id == roomId)
      );
      return { rowCount: initialLength - memoryData.schedules.length };
    }
  }
  
  // 实时监控表查询
  if (sqlLower.includes('stream_monitor_rooms')) {
    if (sqlLower.startsWith('select')) {
      // 处理复杂的统计查询
      if (sqlLower.includes('count(*)') && sqlLower.includes('filter')) {
        return { 
          rows: [{ 
            total_rooms: memoryData.stream_monitor_rooms.length,
            live_rooms: memoryData.stream_monitor_rooms.filter(r => r.status === 'live').length,
            recording_rooms: memoryData.stream_monitor_rooms.filter(r => r.is_recording).length
          }] 
        };
      }
      // 简单的count查询保持兼容
      if (sqlLower.includes('count(*)')) {
        return { 
          rows: [{ 
            total_rooms: memoryData.stream_monitor_rooms.length,
            live_rooms: memoryData.stream_monitor_rooms.filter(r => r.status === 'live').length,
            recording_rooms: memoryData.stream_monitor_rooms.filter(r => r.is_recording).length
          }] 
        };
      }
      // 查询特定房间
      if (sqlLower.includes('where url')) {
        const url = params[0];
        const room = memoryData.stream_monitor_rooms.find(r => r.url === url);
        return { rows: room ? [room] : [] };
      }
      return { rows: memoryData.stream_monitor_rooms };
    }
    if (sqlLower.startsWith('insert')) {
      const newRoom = {
        id: nextId++,
        url: params[0],
        title: params[1],
        streamer: params[2],
        category: params[3],
        status: 'unknown',
        is_recording: false,
        created_at: new Date(),
        updated_at: new Date(),
        last_check: '从未检测',
        recording_duration: 0,
        total_recordings: 0
      };
      memoryData.stream_monitor_rooms.push(newRoom);
      console.log('✅ 监控房间插入成功:', { id: newRoom.id, title: newRoom.title, url: newRoom.url });
      return { rows: [newRoom] };
    }
    if (sqlLower.startsWith('update')) {
      const roomId = params[params.length - 1];
      const room = memoryData.stream_monitor_rooms.find(r => r.id == roomId);
      if (room) {
        // 解析不同的UPDATE语句
        if (sqlLower.includes('is_recording') && sqlLower.includes('recording_duration')) {
          // 录制状态更新
          if (params[0] !== undefined) room.status = params[0];
          if (params[1] !== undefined) room.is_recording = params[1];
          if (params[2] !== undefined) room.recording_duration = params[2];
          if (params[3] !== undefined) room.last_check = params[3];
        } else if (sqlLower.includes('total_recordings')) {
          // 停止录制时的更新
          if (params[0] !== undefined) room.is_recording = params[0];
          if (params[1] !== undefined) room.total_recordings = params[1];
        } else {
          // 其他更新
          if (params[0] !== undefined) room.status = params[0];
          if (params[1] !== undefined) room.last_check = params[1];
        }
        room.updated_at = new Date();
        console.log('✅ 监控房间更新成功:', { id: room.id, status: room.status, is_recording: room.is_recording });
        return { rows: [room] };
      }
      console.log('❌ 未找到要更新的监控房间:', roomId);
      return { rows: [] };
    }
    if (sqlLower.startsWith('delete')) {
      const roomId = params[0];
      const index = memoryData.stream_monitor_rooms.findIndex(r => r.id == roomId);
      if (index !== -1) {
        const deleted = memoryData.stream_monitor_rooms.splice(index, 1);
        console.log('✅ 监控房间删除成功:', deleted[0] ? { id: deleted[0].id, title: deleted[0].title } : 'null');
        return { rows: deleted };
      }
      console.log('❌ 未找到要删除的监控房间:', roomId);
      return { rows: [] };
    }
  }
  
  // 录制记录表查询
  if (sqlLower.includes('stream_recordings')) {
    if (sqlLower.startsWith('select')) {
      // 处理复杂的统计查询
      if (sqlLower.includes('count(*)') || sqlLower.includes('sum(')) {
        const completedRecordings = memoryData.stream_recordings.filter(r => r.status === 'completed');
        return { 
          rows: [{ 
            total_recordings: completedRecordings.length,
            total_duration: completedRecordings.reduce((sum, r) => sum + (r.duration || 0), 0),
            total_size: completedRecordings.reduce((sum, r) => sum + (r.file_size || 0), 0)
          }] 
        };
      }
      // 按room_id查询录制记录
      if (sqlLower.includes('where room_id')) {
        const roomId = params[0];
        const recordings = memoryData.stream_recordings.filter(r => r.room_id == roomId);
        return { rows: recordings };
      }
      // 查询已完成的录制
      if (sqlLower.includes('where status = \'completed\'')) {
        const recordings = memoryData.stream_recordings.filter(r => r.status === 'completed');
        return { rows: recordings };
      }
      return { rows: memoryData.stream_recordings };
    }
    if (sqlLower.startsWith('insert')) {
      const newRecording = {
        id: nextId++,
        room_id: params[0],
        started_at: new Date(),
        quality: params[1] || 'medium',
        audio_only: params[2] || false,
        status: params[3] || 'recording',
        temp_filename: params[4] || null
      };
      memoryData.stream_recordings.push(newRecording);
      console.log('✅ 录制记录插入成功:', { id: newRecording.id, room_id: newRecording.room_id });
      return { rows: [newRecording] };
    }
    if (sqlLower.startsWith('update')) {
      // 不同的UPDATE场景
      if (sqlLower.includes('where room_id') && sqlLower.includes('and status = \'recording\'')) {
        // 停止录制时的更新
        const roomId = params[params.length - 1];
        const recording = memoryData.stream_recordings.find(r => r.room_id == roomId && r.status === 'recording');
        if (recording) {
          recording.ended_at = new Date();
          recording.filename = params[0];
          recording.file_size = params[1];
          recording.duration = params[2];
          recording.status = 'completed';
          console.log('✅ 录制记录完成更新:', { id: recording.id, filename: recording.filename });
          return { rows: [recording] };
        }
      } else if (sqlLower.includes('where id')) {
        // 按ID更新录制记录
        const recordingId = params[params.length - 1];
        const recording = memoryData.stream_recordings.find(r => r.id == recordingId);
        if (recording) {
          // 根据参数数量判断更新类型
          if (params.length >= 5) {
            // 完整更新
            recording.ended_at = new Date();
            recording.filename = params[0];
            recording.file_size = params[1];
            recording.duration = params[2];
            recording.status = params[3];
            recording.file_path = params[4];
          } else if (params.length === 2) {
            // 进度更新
            recording.duration = params[0];
          }
          console.log('✅ 录制记录ID更新:', { id: recording.id, status: recording.status });
          return { rows: [recording] };
        }
      }
      console.log('❌ 未找到要更新的录制记录');
      return { rows: [] };
    }
  }

  // 默认返回空结果
  return { rows: [] };
}

async function initDatabase() {
  try {
    console.log('🔄 初始化数据库连接...');
    
    // 尝试连接 PostgreSQL
    if (process.env.DATABASE_URL || process.env.PGDATABASE) {
      try {
        console.log('🐘 尝试连接 PostgreSQL 数据库...');
        
        const config = process.env.DATABASE_URL ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        } : {
          user: process.env.PGUSER || 'postgres',
          host: process.env.PGHOST || 'localhost',
          database: process.env.PGDATABASE || 'ketu_live_score',
          password: process.env.PGPASSWORD || 'password',
          port: parseInt(process.env.PGPORT || '5432'),
        };

        const pool = new Pool(config);
        
        // 测试连接
        const client = await pool.connect();
        console.log('✅ PostgreSQL 连接成功');
        client.release();
        
        dbInstance = pool;
        usingPostgreSQL = true;
        
        // 执行初始化脚本
        try {
          const initScript = fs.readFileSync(path.join(__dirname, '../../../stream_recordings.sql'), 'utf8');
          await pool.query(initScript);
          console.log('✅ PostgreSQL 表结构初始化完成');
        } catch (initError) {
          console.warn('⚠️ PostgreSQL 表结构初始化失败（可能已存在）:', initError.message);
        }
        
        return dbInstance;
        
      } catch (pgError) {
        console.warn('⚠️ PostgreSQL 连接失败:', pgError.message);
        console.log('🔄 回退到内存数据库模式...');
      }
    }
    
    // 使用内存数据库模拟器（带持久化）
    console.log('📦 使用内存数据库模拟器（带持久化功能）');
    dbInstance = createMemoryDatabase();
    usingPostgreSQL = false;
    
    console.log('✅ 内存数据库初始化完成');
    return dbInstance;
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

// 初始化数据库
const dbPromise = initDatabase();

export default {
  async query(text, params) {
    const db = await dbPromise;
    return db.query(text, params);
  },
  
  isPostgreSQL() {
    return usingPostgreSQL;
  }
}; 