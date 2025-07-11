import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/index.js';
import UserAgent from 'user-agents';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fetch from 'node-fetch';
import { spawn } from 'child_process'; // <-- 添加缺失的导入

const ffmpegPath = ffmpegInstaller.path; // <-- 获取ffmpeg的确切路径

puppeteer.use(StealthPlugin());

const findStreamUrlRecursively = (obj) => {
  if (!obj || typeof obj !== 'object') return null;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        // 寻找常见的流媒体URL模式
        if (value.includes('.flv') || value.includes('.m3u8')) {
          // 避免匹配到非流媒体链接，如封面图或头像
          if (!value.includes('cover') && !value.includes('avatar')) {
             return value;
          }
        }
      } else if (typeof value === 'object') {
        const found = findStreamUrlRecursively(value);
        if (found) return found;
      }
    }
  }

  return null;
};


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 设置ffmpeg路径
// ffmpeg.setFfmpegPath(ffmpegInstaller.path); // <-- 移除此行，因为不再需要

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 录制文件存储目录
const RECORDINGS_DIR = path.join(__dirname, '../../recordings');
const TEMP_DIR = path.join(__dirname, '../../temp');

// 确保目录存在
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class StreamRecorder {
  constructor() {
    this.activeRecordings = new Map(); // roomId -> recording info
    this.recordingQueue = new Map(); // 录制队列
    this.recordingsDir = path.join(__dirname, '..', '..', 'recordings');
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  /**
   * 开始基于流的录制
   * @param {Object} options 录制选项
   * @param {string} options.roomId 直播间ID
   * @param {string} options.streamUrl 直播流地址 (HLS/FLV/RTMP)
   * @param {string} options.quality 录制质量 high/medium/low
   * @param {boolean} options.audioOnly 是否仅录制音频
   * @param {number} options.maxDuration 最大录制时长(分钟)
   */
  async startStreamRecording(options) {
    console.log('************************************************************');
    console.log(`*** RECORDER SERVICE EXECUTED for room ${options.roomId} ***`);
    console.log('************************************************************');
    
    const { roomId, quality = 'source', audioOnly = false } = options;

    if (this.activeRecordings.has(roomId)) {
      throw new Error(`房间 ${roomId} 的录制任务已经在进行中`);
    }

    let browser = null;
    try {
      // 1. 获取房间信息
      const roomResult = await db.query('SELECT * FROM live_rooms WHERE id = $1', [roomId]);
      if (roomResult.rows.length === 0) {
        throw new Error(`数据库中未找到ID为 ${roomId} 的直播间`);
      }
      const roomPageUrl = roomResult.rows[0].url;
      // const userAgent = new UserAgent().toString(); // 移除随机UA
      // 【V8 终极伪装】使用一个非常标准和现代的User-Agent，以通过指纹检测
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

      // 2. 启动Puppeteer并注入间谍代码
      console.log(`[Recorder] 启动Puppeteer为房间 ${roomId} 解析: ${roomPageUrl}`);
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setUserAgent(userAgent);
      
      let successfulStreamRequest = null;
      const streamDataPromise = new Promise((resolve, reject) => {
        // 设置一个15秒的超时定时器
        const timeoutId = setTimeout(() => {
          reject(new Error('等待流数据超时 (15秒)'));
        }, 15000);

        // 暴露一个函数给页面，用于回传数据
        page.exposeFunction('onStreamDataFound', (data) => {
          clearTimeout(timeoutId); // 清除超时
          console.log('[Recorder] ✅✅✅ 间谍代码成功捕获到流数据和Cookies!');
          successfulStreamRequest = data;
          resolve();
        });
      });

      // 【终极方案 V6】完美伪装：同时监听网络请求头和劫持JSON
      let lastSeenHeaders = {};
      await page.setRequestInterception(true);

      page.on('request', (request) => {
        // 记录所有发往主站的请求头，以最后一个为准
        if (request.url().includes('live.douyin.com')) {
          lastSeenHeaders = request.headers();
        }
        request.continue();
      });

      await page.evaluateOnNewDocument(() => {
        console.log('[Recorder Injection] V6 间谍代码已注入，正在劫持 JSON.parse...');
        const originalParse = JSON.parse;
        JSON.parse = function(...args) {
          const result = originalParse.apply(this, args);
          try {
            const text = JSON.stringify(result);
            if (text.includes('.flv') || text.includes('.m3u8')) {
              console.log('[Recorder Injection] V6 捕获到包含流线索的JSON，正在回传...');
              window.onStreamDataFound(result);
            }
          } catch (e) {
            // 忽略错误
          }
          return result;
        };
      });
      
      console.log('[Recorder] 正在访问页面，等待回调...');
      await page.goto(roomPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await streamDataPromise;

      if (!successfulStreamRequest) {
        throw new Error('执行了终极方案V6，但仍未捕获到流数据。');
      }
      
      const capturedUrl = findStreamUrlRecursively(successfulStreamRequest);

      if (!capturedUrl) {
        console.error("[Recorder] 成功捕获JSON，但未能从中提取流地址。JSON DUMP:", JSON.stringify(successfulStreamRequest, null, 2));
        throw new Error('成功捕获数据块，但未能从中提取出流地址。');
      }

      console.log(`[Recorder] ✅ 成功锁定流地址: ${capturedUrl}`);
      
      // 【V7 最终方案】返璞归真，只发送最核心的请求头
      const fetchHeaders = {
        'User-Agent': userAgent,
        'Referer': roomPageUrl,
        'Accept': '*/*', // 明确表示我们接受任何类型的内容
      };
      
      console.log(`[Recorder] 正在使用捕获的URL和【极简】请求头连接...`);
      const streamResponse = await fetch(capturedUrl, {
        headers: fetchHeaders
      });

      if (!streamResponse.ok) {
        console.error(`[Recorder] V7请求失败的Header详情:`, JSON.stringify(fetchHeaders, null, 2));
        throw new Error(`连接上游流失败: ${streamResponse.status} ${streamResponse.statusText}`);
      }
      
      console.log(`[Recorder] ✅ 连接成功，开始推流给FFmpeg`);
      
      await browser.close();
      browser = null;

      // 4. 将流送入FFmpeg
      const inputStream = streamResponse.body;
      const recordingInfo = await this.pipeStreamToFfmpeg(roomId, inputStream, quality, audioOnly);

      return recordingInfo;

    } catch (error) {
      console.error(`❌ [Recorder] 致命错误 (房间 ${roomId}):`, error);
      if (browser) await browser.close();
      throw error;
    }
  }

  async pipeStreamToFfmpeg(roomId, inputStream, quality, audioOnly) {
     const recordingIdResult = await db.query(`
        INSERT INTO stream_recordings (
          room_id, started_at, quality, audio_only, status, temp_filename
        ) VALUES ($1, NOW(), $2, $3, 'recording', $4)
        RETURNING id
      `, [roomId, quality, audioOnly, 'temp.flv']);
      
    if (!recordingIdResult.rows || recordingIdResult.rows.length === 0) {
      throw new Error('在数据库中创建录制记录失败');
    }
    const recordingId = recordingIdResult.rows[0].id;

    console.log(`📝 [Recorder Service] 在数据库中创建录制记录，ID: ${recordingId}`);

    const tempFilename = `temp_recording_${roomId}_${Date.now()}.flv`; 
    const tempFilepath = path.join(TEMP_DIR, tempFilename);

    await db.query('UPDATE stream_recordings SET temp_filename = $1 WHERE id = $2', [tempFilename, recordingId]);

    console.log('🔴 [Direct Record] Bypassing FFmpeg. Starting direct stream dump.');
    const fileStream = fs.createWriteStream(tempFilepath);
    
    inputStream.pipe(fileStream);

    // 监听输入流的错误
    inputStream.on('error', (err) => {
      console.error(`[Direct Record] Input stream error for room ${roomId}:`, err);
      this.handleRecordingError(roomId, err);
    });

    // 监听文件流的错误
    fileStream.on('error', (err) => {
      console.error(`[Direct Record] File stream error for room ${roomId}:`, err);
      this.handleRecordingError(roomId, err);
    });

    this.activeRecordings.set(roomId.toString(), {
      id: recordingId,
      startTime: Date.now(),
      tempFilepath: tempFilepath,
      inputStream: inputStream,
      fileStream: fileStream
    });
    
    console.log(`🚀 [Direct Record] Dumping stream for room ${roomId} to: ${tempFilepath}`);

    await db.query("UPDATE live_rooms SET is_recording = true WHERE id = $1", [roomId]);

    return { recordingId, roomId, tempFilepath };
  }


  /**
   * 停止录制
   */
  async stopStreamRecording(roomId) {
    const recording = this.activeRecordings.get(roomId.toString());
    if (!recording) {
      return { success: false, message: "未找到该房间的录制任务" };
    }

    try {
      console.log(`🛑 [Direct Record] Stopping stream dump for room ${roomId}`);
      
      const { inputStream, fileStream } = recording;

      // 停止接收数据并准备关闭文件
      inputStream.destroy();
      
      // 等待文件流完成写入并关闭
      fileStream.end(async () => {
        console.log(`[Direct Record] File stream for room ${roomId} has been closed.`);
        // 文件关闭后，处理完成逻辑
        await this.handleRecordingComplete(roomId);
      });
      
      return { success: true, message: "录制已停止" };

    } catch (error) {
      console.error('停止直接录制失败:', error);
      await this.handleRecordingError(roomId, error); // 确保在出错时也清理状态
      throw error;
    }
  }

  /**
   * 处理录制完成
   */
  async handleRecordingComplete(roomId) {
    const recording = this.activeRecordings.get(roomId.toString());
    if (!recording) return;

    // 从map中移除，防止重复处理
    this.activeRecordings.delete(roomId.toString());

    const { id, tempFilepath, startTime } = recording;
    
    try {
      if (fs.existsSync(tempFilepath)) {
        const finalFilename = `stream_dump_${id}.flv`;
        const finalFilepath = path.join(this.recordingsDir, finalFilename);
        
        fs.renameSync(tempFilepath, finalFilepath);
        
        const stats = fs.statSync(finalFilepath);
        const duration = Math.floor((Date.now() - startTime) / 1000);
        
        await db.query(`
          UPDATE stream_recordings 
          SET 
            ended_at = NOW(),
            filename = $1,
            file_size = $2,
            duration = $3,
            status = 'completed',
            file_path = $4
          WHERE id = $5
        `, [finalFilename, stats.size, duration, finalFilepath, id]);

        console.log(`✅ [Direct Record] 文件已保存: ${finalFilepath}`);
      }
      
      await db.query("UPDATE live_rooms SET is_recording = false WHERE id = $1", [roomId]);

    } catch (error) {
      console.error('处理直接录制完成失败:', error);
      await this.handleRecordingError(roomId, error);
    }
  }

  /**
   * 处理录制错误
   */
  async handleRecordingError(roomId, error) {
    const recording = this.activeRecordings.get(roomId.toString());
    if (!recording) return;

    // 从map中移除，防止重复处理
    this.activeRecordings.delete(roomId.toString());

    const { id, tempFilepath, inputStream, fileStream } = recording;
    console.error(`❌ 房间 ${roomId} 的直接录制发生错误 (记录ID: ${id}):`, error);

    try {
      // 确保流都已关闭
      if (inputStream && !inputStream.destroyed) {
        inputStream.destroy();
      }
      if (fileStream && !fileStream.closed) {
        fileStream.end();
      }

      // 清理临时文件
      if (fs.existsSync(tempFilepath)) {
        fs.unlinkSync(tempFilepath);
        console.log(`[Direct Record] 已清理临时文件: ${tempFilepath}`);
      }

      // 更新数据库记录
      await db.query(`
        UPDATE stream_recordings 
        SET 
          ended_at = NOW(),
          status = 'error',
          error_message = $1
        WHERE id = $2
      `, [error.message, id]);

      // (已移除) 不再需要更新废弃的 stream_monitor_rooms 表

      // 清理录制信息
      await db.query("UPDATE live_rooms SET is_recording = false WHERE id = $1", [roomId]);

    } catch (dbError) {
      console.error('处理直接录制错误时的数据库错误:', dbError);
    }
  }

  /**
   * 更新录制进度
   */
  async updateRecordingProgress(recordingId, timemark) {
    // This is more complex with stream copy, as we don't get easy progress.
    // For now, we'll just log the timemark.
    console.log(`📹 录制进度 (记录ID: ${recordingId}): ${timemark}`);
  }

  /**
   * 获取活跃录制状态
   */
  getActiveRecordings() {
    const recordings = {};
    for (const [roomId, info] of this.activeRecordings) {
      recordings[roomId] = {
        recordingId: info.id,
        filename: info.tempFilepath,
        startTime: info.startTime,
        status: 'recording',
        quality: 'source',
        audioOnly: false
      };
    }
    return recordings;
  }

  /**
   * 获取录制文件列表
   */
  async getRecordingFiles(roomId = null) {
    try {
      let query = `
        SELECT 
          id,
          room_id,
          started_at,
          ended_at,
          filename,
          file_size,
          duration,
          quality,
          audio_only,
          status,
          file_path
        FROM stream_recordings 
        WHERE status = 'completed'
      `;
      
      const params = [];
      if (roomId) {
        query += ' AND room_id = $1';
        params.push(roomId);
      }
      
      query += ' ORDER BY started_at DESC LIMIT 100';
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('获取录制文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取录制文件下载路径
   */
  getDownloadPath(filename) {
    const filePath = path.join(RECORDINGS_DIR, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * 清理过期录制文件
   */
  async cleanupOldRecordings(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      // 获取过期的录制记录
      const oldRecordings = await db.query(`
        SELECT filename, file_path 
        FROM stream_recordings 
        WHERE ended_at < $1 AND status = 'completed'
      `, [cutoffDate]);

      let deletedCount = 0;
      for (const recording of oldRecordings.rows) {
        const filePath = recording.file_path || path.join(RECORDINGS_DIR, recording.filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      // 删除数据库记录
      await db.query(`
        DELETE FROM stream_recordings 
        WHERE ended_at < $1 AND status = 'completed'
      `, [cutoffDate]);

      console.log(`🧹 清理了 ${deletedCount} 个过期录制文件`);
      return deletedCount;
    } catch (error) {
      console.error('清理过期录制文件失败:', error);
      throw error;
    }
  }
}

// 创建单例
const streamRecorder = new StreamRecorder();

export default streamRecorder; 