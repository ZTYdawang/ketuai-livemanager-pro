import express from 'express';
import authMiddleware from '../middleware/auth.js';
import db from '../db/index.js';
import puppeteer from 'puppeteer';
import UserAgent from 'user-agents';
import streamRecorder from '../services/streamRecorder.js';
import path from 'path';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fetch from 'node-fetch'; // 引入node-fetch

puppeteerExtra.use(StealthPlugin());

const router = express.Router();

// 通用延迟函数，兼容所有puppeteer版本
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 获取所有监控的直播间
 */
router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const rooms = await db.query(`
      SELECT 
        id,
        url,
        title,
        streamer,
        category,
        status,
        is_recording,
        created_at,
        updated_at,
        last_check,
        recording_duration,
        total_recordings
      FROM stream_monitor_rooms 
      ORDER BY updated_at DESC
    `);

    res.json({
      success: true,
      data: rooms.rows
    });
  } catch (error) {
    console.error('获取监控房间列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取监控房间列表失败'
    });
  }
});

/**
 * 添加新的直播间
 */
router.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const { url, title, streamer, category } = req.body;

    if (!url || !title || !streamer || !category) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 检查是否已存在相同URL的直播间
    const existing = await db.query(
      'SELECT id FROM stream_monitor_rooms WHERE url = $1',
      [url]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: '该直播间已存在'
      });
    }

    const result = await db.query(`
      INSERT INTO stream_monitor_rooms (
        url, title, streamer, category, status, is_recording, 
        created_at, updated_at, last_check, recording_duration, total_recordings
      ) VALUES ($1, $2, $3, $4, 'unknown', false, NOW(), NOW(), '从未检测', 0, 0)
      RETURNING *
    `, [url, title, streamer, category]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('添加直播间失败:', error);
    res.status(500).json({
      success: false,
      error: '添加直播间失败'
    });
  }
});

/**
 * 更新直播间状态
 */
router.put('/rooms/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isRecording, recordingDuration } = req.body;

    const result = await db.query(`
      UPDATE stream_monitor_rooms 
      SET 
        status = $1,
        is_recording = $2,
        recording_duration = $3,
        last_check = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [status, isRecording, recordingDuration || 0, new Date().toLocaleString(), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '直播间不存在'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('更新直播间状态失败:', error);
    res.status(500).json({
      success: false,
      error: '更新直播间状态失败'
    });
  }
});

/**
 * 删除直播间
 */
router.delete('/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM stream_monitor_rooms WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '直播间不存在'
      });
    }

    res.json({
      success: true,
      message: '直播间删除成功'
    });
  } catch (error) {
    console.error('删除直播间失败:', error);
    res.status(500).json({
      success: false,
      error: '删除直播间失败'
    });
  }
});

/**
 * 记录录制开始
 */
router.post('/rooms/:id/recording/start', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { quality, audioOnly } = req.body;

    // 更新房间录制状态
    await db.query(`
      UPDATE stream_monitor_rooms 
      SET 
        is_recording = true,
        updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // 插入录制记录
    const result = await db.query(`
      INSERT INTO stream_recordings (
        room_id, started_at, quality, audio_only, status
      ) VALUES ($1, NOW(), $2, $3, 'recording')
      RETURNING *
    `, [id, quality, audioOnly]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('开始录制失败:', error);
    res.status(500).json({
      success: false,
      error: '开始录制失败'
    });
  }
});

/**
 * 记录录制结束
 */
router.post('/rooms/:id/recording/stop', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { filename, fileSize, duration } = req.body;

    // 更新房间录制状态
    await db.query(`
      UPDATE stream_monitor_rooms 
      SET 
        is_recording = false,
        total_recordings = total_recordings + 1,
        updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // 更新录制记录
    await db.query(`
      UPDATE stream_recordings 
      SET 
        ended_at = NOW(),
        filename = $1,
        file_size = $2,
        duration = $3,
        status = 'completed'
      WHERE room_id = $4 AND status = 'recording'
    `, [filename, fileSize, duration, id]);

    res.json({
      success: true,
      message: '录制停止成功'
    });
  } catch (error) {
    console.error('停止录制失败:', error);
    res.status(500).json({
      success: false,
      error: '停止录制失败'
    });
  }
});

/**
 * 获取录制历史
 */
router.get('/rooms/:id/recordings', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const recordings = await db.query(`
      SELECT 
        id,
        started_at,
        ended_at,
        filename,
        file_size,
        duration,
        quality,
        audio_only,
        status
      FROM stream_recordings 
      WHERE room_id = $1
      ORDER BY started_at DESC
      LIMIT 50
    `, [id]);

    res.json({
      success: true,
      data: recordings.rows
    });
  } catch (error) {
    console.error('获取录制历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取录制历史失败'
    });
  }
});

/**
 * 获取系统统计
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [roomStats, recordingStats] = await Promise.all([
      db.query(`
        SELECT 
          COUNT(*) as total_rooms,
          COUNT(*) FILTER (WHERE status = 'live') as live_rooms,
          COUNT(*) FILTER (WHERE is_recording = true) as recording_rooms
        FROM stream_monitor_rooms
      `),
      db.query(`
        SELECT 
          COUNT(*) as total_recordings,
          SUM(duration) as total_duration,
          SUM(file_size) as total_size
        FROM stream_recordings
        WHERE status = 'completed'
      `)
    ]);

    res.json({
      success: true,
      data: {
        rooms: roomStats.rows[0],
        recordings: recordingStats.rows[0]
      }
    });
  } catch (error) {
    console.error('获取系统统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取系统统计失败'
    });
  }
});

/**
 * 获取直播流地址
 */
router.post('/stream-url', authMiddleware, async (req, res) => {
  let browser = null;
  
  try {
    const { url, roomId, type } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: '缺少直播间URL'
      });
    }

    console.log(`🎬 开始解析直播流: ${url}`);
    
    // 启动无头浏览器
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // 设置随机用户代理
    const userAgent = new UserAgent();
    await page.setUserAgent(userAgent.toString());
    
    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 拦截网络请求来获取流地址
    const streamUrls = [];
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const requestUrl = request.url();
      
      // 优化流媒体URL检测，特别支持HTTP-FLV和HLS
      if (requestUrl.includes('.m3u8') || 
          requestUrl.includes('.flv') || 
          requestUrl.includes('live.') ||
          requestUrl.includes('/live/') ||
          requestUrl.includes('stream.') ||
          requestUrl.includes('/stream/') ||
          requestUrl.includes('hls') ||
          requestUrl.includes('flv') ||
          (requestUrl.includes('douyin') && requestUrl.includes('live')) ||
          (requestUrl.includes('tiktok') && requestUrl.includes('live'))) {
        console.log(`🎯 发现可能的流URL: ${requestUrl}`);
        streamUrls.push(requestUrl);
      }
      
      request.continue();
    });
    
    // 访问直播间页面
    console.log(`📱 正在访问: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // 等待页面加载 - 使用通用delay函数
    await delay(3000);
    
    // 尝试点击播放按钮（如果有的话）
    try {
      // 抖音直播播放按钮的可能选择器
      const playSelectors = [
        '[data-e2e="video-play-button"]',
        '.play-button',
        '.xgplayer-play',
        '.video-play-btn',
        '[data-testid="play-button"]',
        'button[aria-label*="播放"]',
        'button[aria-label*="play"]'
      ];
      
      for (const selector of playSelectors) {
        try {
          await page.click(selector, { timeout: 1000 });
          console.log(`✅ 成功点击播放按钮: ${selector}`);
          await delay(2000);
          break;
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      console.log('🔘 未找到播放按钮或已自动播放');
    }
    
    // 再等待一段时间让网络请求完成
    await delay(3000);
    
    // 检查页面中是否有流信息
    const pageStreamUrls = await page.evaluate(() => {
      const urls = [];
      
      // 检查video元素的src
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (video.src && (video.src.includes('.m3u8') || video.src.includes('.flv'))) {
          urls.push(video.src);
        }
        
        // 检查video的source子元素
        const sources = video.querySelectorAll('source');
        sources.forEach(source => {
          if (source.src && (source.src.includes('.m3u8') || source.src.includes('.flv'))) {
            urls.push(source.src);
          }
        });
      });
      
      // 检查script标签中的流URL - 扩展正则以捕获HTTP-FLV
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        const content = script.textContent || '';
        
        // HLS流检测
        const m3u8Matches = content.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g);
        if (m3u8Matches) urls.push(...m3u8Matches);
        
        // FLV流检测 - 更全面的匹配
        const flvMatches = content.match(/https?:\/\/[^"'\s]+\.flv[^"'\s]*/g);
        if (flvMatches) urls.push(...flvMatches);
        
        // 抖音特殊的流URL格式检测
        const douyinStreamMatches = content.match(/https?:\/\/[^"'\s]*live[^"'\s]*\.(flv|m3u8)[^"'\s]*/g);
        if (douyinStreamMatches) urls.push(...douyinStreamMatches);
        
        // 通用直播流检测
        const liveStreamMatches = content.match(/https?:\/\/[^"'\s]*\/live\/[^"'\s]*/g);
        if (liveStreamMatches) {
          liveStreamMatches.forEach(match => {
            if (match.includes('.flv') || match.includes('.m3u8') || 
                match.includes('stream') || match.includes('live')) {
              urls.push(match);
            }
          });
        }
      });
      
      // 检查全局变量中可能的流URL
      try {
        if (window.__INITIAL_STATE__ && typeof window.__INITIAL_STATE__ === 'object') {
          const stateStr = JSON.stringify(window.__INITIAL_STATE__);
          const streamMatches = stateStr.match(/https?:\/\/[^"']*\.(flv|m3u8)[^"']*/g);
          if (streamMatches) urls.push(...streamMatches);
        }
      } catch (e) {}
      
      return urls;
    });
    
    // 合并所有找到的流URL并进行清理
    const allStreamUrlsRaw = [...new Set([...streamUrls, ...pageStreamUrls])];
    const allStreamUrls = allStreamUrlsRaw.map(url => {
      try {
        // 使用JSON解析来反转义常见的编码 (例如, \u0026 -> &)
        // 并清理URL中可能存在的多余反斜杠和非标准字符
        const decodedUrl = JSON.parse(`"${url.replace(/\\/g, '\\\\')}"`);
        return decodedUrl.trim();
      } catch (e) {
        return url.trim();
      }
    }).filter(url => url.startsWith('http'));
    
    if (allStreamUrls.length > 0) {
      // 优先级：FLV > HLS（因为抖音主要使用FLV）
      const flvUrl = allStreamUrls.find(url => url.includes('.flv'));
      const m3u8Url = allStreamUrls.find(url => url.includes('.m3u8'));
      const selectedUrl = flvUrl || m3u8Url || allStreamUrls[0];
      
      console.log(`✅ 成功获取流地址: ${selectedUrl}`);
      console.log(`🔍 检测到的流类型: ${flvUrl ? 'HTTP-FLV' : m3u8Url ? 'HLS' : '未知'}`);
      
      // 更新数据库中的状态
      if (roomId) {
        await db.query(`
          UPDATE stream_monitor_rooms 
          SET 
            status = 'live',
            last_check = $1,
            updated_at = NOW()
          WHERE id = $2
        `, [new Date().toLocaleString(), roomId]);
      }
      
      res.json({
        success: true,
        streamUrl: selectedUrl,
        type: selectedUrl.includes('.flv') ? 'flv' : selectedUrl.includes('.m3u8') ? 'hls' : 'unknown',
        allUrls: allStreamUrls,
        platform: url.includes('douyin') ? 'douyin' : url.includes('tiktok') ? 'tiktok' : 'other'
      });
    } else {
      console.log('⚠️ 未找到流地址');
      
      // 更新状态为offline
      if (roomId) {
        await db.query(`
          UPDATE stream_monitor_rooms 
          SET 
            status = 'offline',
            last_check = $1,
            updated_at = NOW()
          WHERE id = $2
        `, [new Date().toLocaleString(), roomId]);
      }
      
      res.status(404).json({
        success: false,
        error: '未找到直播流地址，可能直播已结束'
      });
    }
    
  } catch (error) {
    console.error('❌ 获取流地址失败:', error);
    res.status(500).json({
      success: false,
      error: '获取流地址失败: ' + error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * 获取直播间截图
 */
router.post('/screenshot', authMiddleware, async (req, res) => {
  let browser = null;
  
  try {
    const { url, roomId } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: '缺少直播间URL'
      });
    }

    console.log(`📸 开始截图: ${url}`);
    
    // 启动无头浏览器
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // 设置随机用户代理
    const userAgent = new UserAgent();
    await page.setUserAgent(userAgent.toString());
    
    // 设置视口
    await page.setViewport({ width: 1280, height: 720 });
    
    // 访问直播间页面
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // 等待页面加载 - 使用通用delay函数
    await delay(3000);
    
    // 尝试截取视频区域
    let screenshot;
    try {
      // 尝试找到视频元素
      const videoElement = await page.$('video');
      if (videoElement) {
        screenshot = await videoElement.screenshot({ 
          type: 'png',
          encoding: 'binary'
        });
        console.log('✅ 成功截取视频区域');
      } else {
        // 如果没有视频元素，截取整个页面
        screenshot = await page.screenshot({ 
          type: 'png',
          fullPage: false,
          encoding: 'binary'
        });
        console.log('✅ 截取整个页面');
      }
    } catch (e) {
      // 备用：截取整个页面
      screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: false,
        encoding: 'binary'
      });
      console.log('✅ 使用备用截图方式');
    }
    
    // 更新最后检测时间
    if (roomId) {
      await db.query(`
        UPDATE stream_monitor_rooms 
        SET 
          last_check = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [new Date().toLocaleString(), roomId]);
    }
    
    // 返回图片数据
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', screenshot.length);
    res.send(screenshot);
    
  } catch (error) {
    console.error('❌ 截图失败:', error);
    res.status(500).json({
      success: false,
      error: '截图失败: ' + error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * 【流录制】开始
 */
router.post('/rooms/:id/stream-recording/start', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { quality, audioOnly, maxDuration } = req.body;

    console.log(`[API] 接到房间 ${id} 的流录制请求...`);

    // 关键改动：等待录制服务完全启动
    const recordingInfo = await streamRecorder.startStreamRecording({
      roomId: id,
      quality,
      audioOnly,
      maxDuration
    });

    console.log(`[API] 房间 ${id} 的流录制已成功启动，返回信息:`, recordingInfo);

    res.json({
      success: true,
      message: '流录制已启动',
      data: recordingInfo,
    });
    
  } catch (error) {
    console.error(`[API] 房间 ${req.params.id} 的流录制失败:`, error);
    res.status(500).json({
      success: false,
      error: `启动流录制失败: ${error.message}`
    });
  }
});


/**
 * 【流录制】停止
 */
router.post('/rooms/:id/stream-recording/stop', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[API] 接到房间 ${id} 的停止流录制请求...`);

    // 关键改动：等待录制服务完全停止
    const result = await streamRecorder.stopStreamRecording(id);

    console.log(`[API] 房间 ${id} 的流录制已成功停止`);
    
    if (result.success) {
       res.json({ success: true, message: '流录制已停止' });
    } else {
       res.status(404).json({ success: false, error: result.message });
    }

  } catch (error) {
    console.error(`[API] 停止房间 ${req.params.id} 的流录制失败:`, error);
    res.status(500).json({
      success: false,
      error: `停止流录制失败: ${error.message}`
    });
  }
});

/**
 * 获取活跃的录制状态
 */
router.get('/active-recordings', authMiddleware, async (req, res) => {
  try {
    const activeRecordings = streamRecorder.getActiveRecordings();
    
    res.json({
      success: true,
      data: activeRecordings
    });

  } catch (error) {
    console.error('获取活跃录制失败:', error);
    res.status(500).json({
      success: false,
      error: '获取活跃录制失败'
    });
  }
});

/**
 * 获取录制文件列表
 */
router.get('/recordings', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.query;
    
    const recordings = await streamRecorder.getRecordingFiles(roomId);
    
    res.json({
      success: true,
      data: recordings
    });

  } catch (error) {
    console.error('获取录制文件列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取录制文件列表失败'
    });
  }
});

/**
 * 下载录制文件
 */
router.get('/recordings/:filename/download', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // 验证文件名安全性
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: '无效的文件名'
      });
    }

    const filePath = streamRecorder.getDownloadPath(filename);
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: '录制文件不存在'
      });
    }

    // 设置下载头
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // 发送文件
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('文件下载失败:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: '文件下载失败'
          });
        }
      }
    });

  } catch (error) {
    console.error('下载录制文件失败:', error);
    res.status(500).json({
      success: false,
      error: '下载录制文件失败'
    });
  }
});

/**
 * 清理过期录制文件
 */
router.post('/recordings/cleanup', authMiddleware, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    
    const deletedCount = await streamRecorder.cleanupOldRecordings(daysOld);
    
    res.json({
      success: true,
      data: { deletedCount },
      message: `清理了 ${deletedCount} 个过期录制文件`
    });

  } catch (error) {
    console.error('清理过期录制文件失败:', error);
    res.status(500).json({
      success: false,
      error: '清理过期录制文件失败'
    });
  }
});

/**
 * 流代理API - 解决403访问问题
 */
router.post('/proxy-stream', authMiddleware, async (req, res) => {
  try {
    const { streamUrl, roomUrl, type = 'flv' } = req.body;

    if (!streamUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少流地址'
      });
    }

    // POST请求只是验证和返回成功状态
    console.log(`🔄 验证代理请求: ${streamUrl}`);
    
    res.json({
      success: true,
      message: '代理配置成功，请使用GET请求获取流数据'
    });

  } catch (error) {
    console.error('流代理配置失败:', error);
    res.status(500).json({
      success: false,
      error: `流代理配置失败: ${error.message}`
    });
  }
});

/**
 * 流代理API - GET请求用于实际数据传输
 */
router.get('/proxy-stream', async (req, res) => {
  try {
    const { streamUrl, roomUrl, type = 'flv' } = req.query;

    if (!streamUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少流地址'
      });
    }

    console.log(`🔄 代理传输流数据: ${streamUrl}`);
    
    // 设置请求头，模拟真实浏览器访问
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': roomUrl || 'https://live.douyin.com/',
      'Accept': type === 'flv' ? 'video/x-flv,*/*' : 'application/vnd.apple.mpegurl,*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity', // 不使用压缩，方便代理
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
      'DNT': '1',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    };

    // 使用node的http(s)模块进行请求代理
    const https = await import('https');
    const http = await import('http');
    const { URL } = await import('url');
    
    const parsedUrl = new URL(streamUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers
    };

    console.log(`📡 代理请求配置:`, {
      hostname: options.hostname,
      path: options.path.substring(0, 100) + '...',
      headers: {
        'User-Agent': headers['User-Agent'],
        'Referer': headers['Referer']
      }
    });

    const proxyReq = httpModule.request(options, (proxyRes) => {
      console.log(`📊 代理响应状态: ${proxyRes.statusCode}`);
      
      if (proxyRes.statusCode === 200) {
        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // 设置内容类型
        const contentType = proxyRes.headers['content-type'] || 
          (type === 'flv' ? 'video/x-flv' : 'application/vnd.apple.mpegurl');
        res.setHeader('Content-Type', contentType);
        
        // 如果有内容长度，传递给客户端
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        
        // 设置缓存控制
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        console.log('✅ 开始代理流数据传输...');
        
        // 将远程流数据管道到响应
        proxyRes.pipe(res);
        
        proxyRes.on('end', () => {
          console.log('✅ 代理流传输完成');
        });
        
        proxyRes.on('error', (error) => {
          console.error('❌ 代理流传输错误:', error);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: '代理流传输错误'
            });
          }
        });
        
      } else if (proxyRes.statusCode === 403) {
        console.log('❌ 代理也遇到403错误');
        res.status(403).json({
          success: false,
          error: '流访问被拒绝，防盗链保护无法绕过'
        });
      } else {
        console.log(`❌ 代理失败，状态码: ${proxyRes.statusCode}`);
        res.status(proxyRes.statusCode || 500).json({
          success: false,
          error: `代理请求失败，状态码: ${proxyRes.statusCode}`
        });
      }
    });

    proxyReq.on('error', (error) => {
      console.error('❌ 代理请求错误:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: `代理请求失败: ${error.message}`
        });
      }
    });

    // 设置超时
    proxyReq.setTimeout(30000, () => {
      console.log('❌ 代理请求超时');
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: '代理请求超时'
        });
      }
    });

    proxyReq.end();

  } catch (error) {
    console.error('流代理失败:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: `流代理失败: ${error.message}`
      });
    }
  }
});

// 导出路由
export default router; 